'use server'

import { revalidatePath } from 'next/cache'
import { MotivoEnvio } from '@prisma/client'
import { db } from '@/lib/db'
import { autorizarAction } from '@/lib/auth-guards'
import { problemaDoModelo } from '@/lib/carta'
import { comoErro, type ResultadoDaAction } from './comuns'

/**
 * Modelos de carta, editados pela área sem deploy.
 *
 * Modelo nunca é excluído, só desativado: some das sugestões e pode voltar.
 * Nenhuma solicitação aponta para ele, a carta guarda o texto como ficou.
 */

function revalidarModelos() {
  revalidatePath('/admin/cartas')
  revalidatePath('/solicitacoes/nova')
}

export async function salvarModelo(dados: {
  id?: string
  motivo: MotivoEnvio
  texto: string
}): Promise<ResultadoDaAction> {
  try {
    await autorizarAction('carta.gerenciarModelos')

    if (!Object.values(MotivoEnvio).includes(dados.motivo)) {
      return { ok: false, erro: 'Motivo desconhecido.' }
    }
    const problema = problemaDoModelo(dados.texto)
    if (problema) return { ok: false, erro: problema, campo: 'texto' }
    const texto = dados.texto.trim()

    if (dados.id) {
      await db.modeloCarta.update({ where: { id: dados.id }, data: { texto } })
    } else {
      // O novo entra no fim da lista do motivo: a ordem de quem já usa os
      // modelos não muda por causa dele.
      const ultimo = await db.modeloCarta.aggregate({
        where: { motivo: dados.motivo },
        _max: { ordem: true },
      })
      await db.modeloCarta.create({
        data: { motivo: dados.motivo, texto, ordem: (ultimo._max.ordem ?? -1) + 1 },
      })
    }

    revalidarModelos()
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}

export async function alternarModelo(id: string, ativo: boolean): Promise<ResultadoDaAction> {
  try {
    await autorizarAction('carta.gerenciarModelos')
    await db.modeloCarta.update({ where: { id }, data: { ativo } })
    revalidarModelos()
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}

/**
 * Troca o modelo de lugar com o vizinho, dentro do mesmo motivo.
 *
 * A ordem é renumerada inteira a cada movimento, e não só trocada entre os
 * dois: modelos antigos podem ter a mesma `ordem`, e trocar dois números
 * iguais não mudaria nada na tela.
 */
export async function moverModelo(
  id: string,
  direcao: 'subir' | 'descer',
): Promise<ResultadoDaAction> {
  try {
    await autorizarAction('carta.gerenciarModelos')

    await db.$transaction(async (tx) => {
      const modelo = await tx.modeloCarta.findUniqueOrThrow({
        where: { id },
        select: { motivo: true },
      })
      const lista = await tx.modeloCarta.findMany({
        where: { motivo: modelo.motivo },
        orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
        select: { id: true },
      })
      const de = lista.findIndex((m) => m.id === id)
      const para = direcao === 'subir' ? de - 1 : de + 1
      if (para < 0 || para >= lista.length) return
      ;[lista[de], lista[para]] = [lista[para]!, lista[de]!]

      for (const [ordem, m] of lista.entries()) {
        await tx.modeloCarta.update({ where: { id: m.id }, data: { ordem } })
      }
    })

    revalidarModelos()
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}
