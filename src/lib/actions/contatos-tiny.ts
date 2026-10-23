'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { autorizarAction } from '@/lib/auth-guards'
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
    await autorizarAction('tiny.operar')
    await reenviarContato(id)
    processarDepois()
    revalidatePath('/tiny/contatos')
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}
