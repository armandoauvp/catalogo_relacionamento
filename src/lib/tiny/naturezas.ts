import { db } from '@/lib/db'
import type { ContaTiny } from './contas'

/**
 * As naturezas da operação já usadas numa conta, a mais recente primeiro. A
 * API v2 do Tiny não lista as cadastradas lá, então a tela sugere estas.
 * Vêm dos lotes, que guardam a natureza numa coluna.
 */
export async function naturezasJaUsadas(conta: ContaTiny): Promise<string[]> {
  const lotes = await db.loteTiny.findMany({
    where: { conta, naturezaOperacao: { not: null } },
    orderBy: { criadoEm: 'desc' },
    distinct: ['naturezaOperacao'],
    select: { naturezaOperacao: true },
    take: 20,
  })
  return lotes.flatMap((l) => (l.naturezaOperacao ? [l.naturezaOperacao] : []))
}
