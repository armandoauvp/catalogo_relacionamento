import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { fimDoDiaLocal, instanteLocal } from './datas'

/**
 * Filtro da base de clientes. A tela, a exportação em Excel e a seleção para o
 * Tiny leem o mesmo schema e montam o mesmo `where`: o que a pessoa vê é o que
 * baixa e o que manda.
 */

export const ORDENS_DE_CLIENTES = {
  nome: 'Nome',
  recentes: 'Cadastro mais recente',
  envios: 'Mais solicitações',
} as const

export type OrdemDeClientes = keyof typeof ORDENS_DE_CLIENTES

const dia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined)

export const filtroDeClientesSchema = z.object({
  busca: z.string().trim().max(100).optional().catch(undefined),
  etiqueta: z.string().trim().max(40).optional().catch(undefined),
  uf: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .optional()
    .catch(undefined),
  de: dia,
  ate: dia,
  ordem: z
    .enum(Object.keys(ORDENS_DE_CLIENTES) as [OrdemDeClientes, ...OrdemDeClientes[]])
    .default('nome')
    .catch('nome'),
})

export type FiltroDeClientes = z.output<typeof filtroDeClientesSchema>

/** Meia-noite de São Paulo no dia do campo de data. */
function inicioDoDia(diaIso: string): Date {
  const [ano, mes, d] = diaIso.split('-').map(Number) as [number, number, number]
  return instanteLocal(ano, mes, d)
}

export function whereDeClientes(f: FiltroDeClientes): Prisma.ClienteWhereInput {
  const e: Prisma.ClienteWhereInput[] = []
  if (f.busca) {
    const digitos = f.busca.replace(/\D/g, '')
    const soDocumento = digitos.length >= 3 && /^[\d.\-\s]+$/.test(f.busca)
    e.push(
      soDocumento
        ? { cpf: { startsWith: digitos } }
        : {
            OR: [
              { nome: { contains: f.busca, mode: 'insensitive' } },
              { email: { contains: f.busca, mode: 'insensitive' } },
            ],
          },
    )
  }
  if (f.etiqueta) e.push({ etiquetas: { has: f.etiqueta } })
  if (f.uf) e.push({ uf: f.uf })
  if (f.de) e.push({ criadoEm: { gte: inicioDoDia(f.de) } })
  const fim = fimDoDiaLocal(f.ate)
  if (fim) e.push({ criadoEm: { lte: fim } })
  return e.length ? { AND: e } : {}
}

export function ordemDeClientes(ordem: OrdemDeClientes): Prisma.ClienteOrderByWithRelationInput[] {
  if (ordem === 'recentes') return [{ criadoEm: 'desc' }]
  if (ordem === 'envios') return [{ solicitacoes: { _count: 'desc' } }, { nome: 'asc' }]
  return [{ nome: 'asc' }]
}

/** O filtro como query string, para o link da exportação levar o mesmo recorte. */
export function queryDoFiltro(f: FiltroDeClientes): string {
  const q = new URLSearchParams()
  for (const [chave, valor] of Object.entries(f)) {
    if (valor && !(chave === 'ordem' && valor === 'nome')) q.set(chave, String(valor))
  }
  return q.toString()
}
