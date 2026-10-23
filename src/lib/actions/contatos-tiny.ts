'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { autorizarAction } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { tinyConfigurado } from '@/lib/env'
import { validarContato } from '@/lib/tiny/contato'
import { enfileirarContatos, processarFila, reenviarContato } from '@/lib/tiny/fila'
import { conferirRepetidos } from '@/lib/tiny/lote'
import { comoErro, primeiroErro, type ResultadoDaAction } from './comuns'

/**
 * Contatos (clientes) do Tiny: o cadastro e a edição de um, a atualização em
 * massa por planilha e, da base daqui, a exportação. Tudo entra na fila; quem
 * fala com o Tiny é ela. Exigem `tiny.operar`.
 */

const SEM_TOKEN = 'O Tiny ainda não está ligado: falta o token na Vercel (TINY_API_TOKEN).'

function processarDepois() {
  after(async () => {
    await processarFila({ prazoMs: 40_000 }).catch((e) => console.error('Fila do Tiny:', e))
  })
}

const campos = z.record(z.string(), z.string().max(300))

const contatoSchema = z.object({
  tinyId: z.string().regex(/^\d+$/).nullable().default(null),
  campos,
})

export async function salvarContato(entrada: unknown): Promise<ResultadoDaAction> {
  try {
    const usuario = await autorizarAction('tiny.operar')
    if (!tinyConfigurado) return { ok: false, erro: SEM_TOKEN }
    const validado = contatoSchema.safeParse(entrada)
    if (!validado.success) return primeiroErro(validado.error)

    const { destinatario, erros } = validarContato(validado.data.campos)
    if (erros.length) return { ok: false, erro: erros.join(' ') }

    await enfileirarContatos(
      [{ destinatario, tinyId: validado.data.tinyId }],
      validado.data.tinyId ? 'Edição' : 'Cadastro',
      usuario,
    )
    processarDepois()
    revalidatePath('/tiny/contatos')
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}

const planilhaSchema = z.object({
  arquivo: z.string().trim().max(200).nullable().default(null),
  linhas: z
    .array(z.object({ linha: z.number().int().positive(), campos }))
    .min(1, 'A planilha não tem nenhuma linha válida.')
    .max(2000, 'Uma atualização vai até 2.000 linhas; divida a planilha.'),
})

/**
 * Atualização cadastral em massa, sem gerar pedido: cada linha vira um
 * contato na fila. O servidor valida de novo o que a prévia aprovou.
 */
export async function importarContatos(
  entrada: unknown,
): Promise<ResultadoDaAction<{ novos: number; atualizados: number }>> {
  try {
    const usuario = await autorizarAction('tiny.operar')
    if (!tinyConfigurado) return { ok: false, erro: SEM_TOKEN }
    const validado = planilhaSchema.safeParse(entrada)
    if (!validado.success) return primeiroErro(validado.error)

    const linhas = conferirRepetidos(
      validado.data.linhas.map((l) => ({ linha: l.linha, ...validarContato(l.campos) })),
    )
    const comErro = linhas.find((l) => l.erros.length)
    if (comErro) return { ok: false, erro: `Linha ${comErro.linha}: ${comErro.erros.join(' ')}` }

    const resultado = await enfileirarContatos(
      linhas.map((l) => ({ destinatario: l.destinatario, linha: l.linha })),
      validado.data.arquivo ? `Planilha ${validado.data.arquivo}` : 'Planilha',
      usuario,
    )
    processarDepois()
    revalidatePath('/tiny/contatos')
    return { ok: true, dados: resultado }
  } catch (e) {
    return comoErro(e)
  }
}

export async function reenviarContatoNoTiny(id: string): Promise<ResultadoDaAction> {
  try {
    const usuario = await autorizarAction('tiny.operar')
    await reenviarContato(id, usuario.id)
    processarDepois()
    revalidatePath('/tiny/contatos')
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}

const idsSchema = z
  .array(z.string().min(1).max(40))
  .min(1, 'Escolha ao menos um cliente.')
  .max(500, 'Até 500 clientes por vez.')

/**
 * Manda clientes da base daqui ao Tiny como contatos. Quem não tem o mínimo
 * (nome e documento válidos) fica de fora, com o motivo.
 */
export async function exportarClientesParaOTiny(
  ids: unknown,
): Promise<ResultadoDaAction<{ enviados: number; ignorados: { nome: string; motivo: string }[] }>> {
  try {
    const usuario = await autorizarAction('tiny.operar')
    await autorizarAction('cliente.gerenciar')
    if (!tinyConfigurado) return { ok: false, erro: SEM_TOKEN }
    const validado = idsSchema.safeParse(ids)
    if (!validado.success) return primeiroErro(validado.error)

    const clientes = await db.cliente.findMany({ where: { id: { in: validado.data } } })
    const lidos = clientes.map((c) => ({
      nome: c.nome,
      ...validarContato({
        nome: c.nome,
        cpfCnpj: c.cpf,
        email: c.email ?? undefined,
        telefone: c.telefone ?? undefined,
        cep: c.cep ?? undefined,
        endereco: c.logradouro ?? undefined,
        numero: c.numero ?? undefined,
        complemento: c.complemento ?? undefined,
        bairro: c.bairro ?? undefined,
        cidade: c.cidade ?? undefined,
        uf: c.uf ?? undefined,
      }),
    }))
    const validos = lidos.filter((l) => !l.erros.length)
    if (validos.length) {
      await enfileirarContatos(
        validos.map((l) => ({ destinatario: l.destinatario })),
        'Base de clientes',
        usuario,
      )
      processarDepois()
    }
    revalidatePath('/tiny/contatos')
    return {
      ok: true,
      dados: {
        enviados: validos.length,
        ignorados: lidos
          .filter((l) => l.erros.length)
          .map((l) => ({ nome: l.nome, motivo: l.erros.join(' ') })),
      },
    }
  } catch (e) {
    return comoErro(e)
  }
}
