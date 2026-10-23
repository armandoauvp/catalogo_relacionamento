import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { fimDoDiaLocal, instanteLocal } from '@/lib/datas'

/**
 * O histórico da integração com o Tiny: o que aconteceu, quando e quem fez.
 * Os eventos nunca são editados; aqui só se filtra.
 */

export const ROTULO_DO_EVENTO: Record<string, string> = {
  enfileirado: 'Entrou na fila',
  enviado: 'Criado no Tiny',
  falhou: 'Falhou',
  adiado: 'Adiado',
  duplicidade: 'Duplicidade',
  reenviado: 'Reenviado',
  expedicao: 'Expedição',
  situacao: 'Situação no Tiny',
  rastreio: 'Rastreio',
  lote: 'Lote importado',
  avulso: 'Nova venda',
  contatos: 'Contatos',
}

export function rotuloDoEvento(tipo: string): string {
  return ROTULO_DO_EVENTO[tipo] ?? tipo
}

/** "fila" é o que a própria fila fez, sem pessoa. */
export const PESSOA_DA_FILA = 'fila'

export const POR_PAGINA = 50

const dia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined)

export const filtroDoHistoricoSchema = z.object({
  tipo: z.string().max(30).optional().catch(undefined),
  pessoa: z.string().max(40).optional().catch(undefined),
  busca: z.string().trim().max(100).optional().catch(undefined),
  de: dia,
  ate: dia,
  pagina: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
})

export type FiltroDoHistorico = z.output<typeof filtroDoHistoricoSchema>

export function whereDoHistorico(f: FiltroDoHistorico): Prisma.EventoTinyWhereInput {
  const e: Prisma.EventoTinyWhereInput[] = []
  if (f.tipo) e.push({ tipo: f.tipo })
  if (f.pessoa) e.push({ usuarioId: f.pessoa === PESSOA_DA_FILA ? null : f.pessoa })
  if (f.busca) e.push({ mensagem: { contains: f.busca, mode: 'insensitive' } })
  if (f.de) {
    const [ano, mes, d] = f.de.split('-').map(Number) as [number, number, number]
    e.push({ criadoEm: { gte: instanteLocal(ano, mes, d) } })
  }
  const fim = fimDoDiaLocal(f.ate)
  if (fim) e.push({ criadoEm: { lte: fim } })
  return e.length ? { AND: e } : {}
}
