'use server'

import { revalidatePath } from 'next/cache'
import { Perfil, Prisma } from '@prisma/client'
import { z } from 'zod'
import { db } from '@/lib/db'
import { autorizarAction } from '@/lib/auth-guards'
import { pode, problemaAoMudarPerfil } from '@/lib/permissions'
import { comoErro, primeiroErro, type ResultadoDaAction } from './comuns'

/**
 * Edição de usuário: perfil, limite mensal e ativação.
 *
 * Usuário não é criado aqui, ele entra sozinho no primeiro login pelo SSO,
 * como consultor. Esta tela é onde o Admin promove e define teto de gasto sem
 * passar por TI. O que cada admin alcança é `perfisAoAlcance`, conferido aqui
 * contra o perfil gravado, e não contra o que veio do navegador.
 */

const usuarioSchema = z.object({
  id: z.string().min(1),
  perfil: z.nativeEnum(Perfil),
  limiteMensal: z.preprocess((v) => {
    if (v === null || v === undefined || v === '') return null
    const texto = String(v).trim().replace(/\./g, '').replace(',', '.')
    const numero = Number(texto)
    return Number.isFinite(numero) ? numero : v
  }, z.number().min(0, 'O limite não pode ser negativo.').nullable()),
  ativo: z.boolean(),
})

export async function salvarUsuario(dados: FormData): Promise<ResultadoDaAction> {
  try {
    const admin = await autorizarAction('usuario.gerenciar')

    const validado = usuarioSchema.safeParse({
      id: String(dados.get('id') ?? ''),
      perfil: String(dados.get('perfil') ?? ''),
      limiteMensal: dados.get('limiteMensal'),
      ativo: dados.get('ativo') !== 'off',
    })
    if (!validado.success) return primeiroErro(validado.error)

    const { id, perfil, limiteMensal, ativo } = validado.data

    const alvo = await db.usuario.findUnique({ where: { id }, select: { perfil: true } })
    if (!alvo) return { ok: false, erro: 'Usuário não encontrado.' }

    const problema = problemaAoMudarPerfil(admin.perfil, alvo.perfil, perfil)
    if (problema) return { ok: false, erro: problema }

    const retiraAdminGeral = alvo.perfil === Perfil.admin && (perfil !== Perfil.admin || !ativo)

    // Um Admin que se rebaixa ou se desativa fica sem como voltar atrás.
    if (id === admin.id && (retiraAdminGeral || !ativo)) {
      return {
        ok: false,
        erro: 'Você não pode retirar o próprio acesso de Admin. Peça a outro Admin.',
      }
    }

    // Precisa sobrar alguém capaz de promover: só o Admin geral promove, e sem
    // ele a única saída seria mexer no banco à mão.
    if (retiraAdminGeral) {
      const outrosAdmins = await db.usuario.count({
        where: { perfil: Perfil.admin, ativo: true, id: { not: id } },
      })
      if (outrosAdmins === 0) {
        return {
          ok: false,
          erro: 'Este é o último Admin geral ativo. Promova outra pessoa antes.',
        }
      }
    }

    await db.usuario.update({
      where: { id },
      data: {
        perfil,
        ativo,
        // Sem a permissão, o campo nem vai na tela: em branco aqui apagaria o teto.
        ...(pode(admin.perfil, 'usuario.definirLimite')
          ? { limiteMensal: limiteMensal === null ? null : new Prisma.Decimal(limiteMensal) }
          : {}),
      },
    })

    revalidatePath('/admin/usuarios')
    revalidatePath('/')
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}
