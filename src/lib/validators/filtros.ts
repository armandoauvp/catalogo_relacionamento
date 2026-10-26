import { z } from 'zod'
import { StatusSolicitacao } from '@prisma/client'

/**
 * Filtros do painel de gestão.
 *
 * O mesmo schema alimenta a tabela e a exportação, é o que garante o critério
 * de aceite "a exportação respeita os filtros da tela".
 */
export const filtroSolicitacoesSchema = z.object({
  de: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
  consultorId: z.string().optional(),
  clienteId: z.string().optional(),
  produtoId: z.string().optional(),
  // A URL traz um valor só (`?status=aprovado`) ou vários repetidos; a
  // exportação lê a query com `Object.fromEntries`, que entrega texto.
  status: z.preprocess(
    (v) => (v === undefined || v === '' ? undefined : [v].flat()),
    z.array(z.nativeEnum(StatusSolicitacao)).optional(),
  ),
  /** Só para pendente e aguardando aprovação: tem o que comprar, ou sai do estoque. */
  rota: z.enum(['compra', 'estoque']).optional().catch(undefined),
  busca: z.string().trim().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(200).default(50),
})

export type FiltroSolicitacoes = z.output<typeof filtroSolicitacoesSchema>

/** Traduz o filtro para o `where` do Prisma. Um lugar só, sem duplicar lógica. */
export function whereDeSolicitacoes(filtro: FiltroSolicitacoes) {
  const where: Record<string, unknown> = {}

  if (filtro.de || filtro.ate) {
    where.dataSolicitacao = {
      ...(filtro.de ? { gte: filtro.de } : {}),
      ...(filtro.ate ? { lte: filtro.ate } : {}),
    }
  }

  if (filtro.consultorId) where.consultorId = filtro.consultorId
  if (filtro.clienteId) where.clienteId = filtro.clienteId
  if (filtro.status?.length) where.status = { in: filtro.status }

  // Filtrar por produto significa "solicitações que contêm este produto".
  if (filtro.produtoId) {
    where.itens = { some: { produtoId: filtro.produtoId } }
  }

  if (filtro.busca) {
    where.OR = [
      { codigo: { contains: filtro.busca, mode: 'insensitive' } },
      { cliente: { nome: { contains: filtro.busca, mode: 'insensitive' } } },
      { consultor: { nome: { contains: filtro.busca, mode: 'insensitive' } } },
    ]
  }

  return where
}
