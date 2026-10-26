import type { Prisma } from '@prisma/client'
import { db } from './db'
import { precisaDeCompra } from './status'
import { whereDeSolicitacoes, type FiltroSolicitacoes } from './validators/filtros'

/** Os status em que a rota (compra ou estoque) ainda decide alguma coisa. */
const STATUS_DA_ROTA = ['pendente', 'aguardando_aprovacao'] as const

/**
 * O `where` da gestão, com a rota quando ela foi pedida. A rota depende de
 * comparar o estoque com a quantidade de cada item, o que não cabe num
 * `where`: as candidatas são lidas e passam por `precisaDeCompra`, a mesma
 * regra da coluna. Tela e exportação usam esta função, e veem o mesmo recorte.
 */
export async function whereDaGestao(
  filtro: FiltroSolicitacoes,
): Promise<Prisma.SolicitacaoWhereInput> {
  const where = whereDeSolicitacoes(filtro) as Prisma.SolicitacaoWhereInput
  if (!filtro.rota) return where

  const candidatas = await db.solicitacao.findMany({
    where: { AND: [where, { status: { in: [...STATUS_DA_ROTA] } }] },
    select: {
      id: true,
      itens: {
        select: {
          produtoId: true,
          quantidade: true,
          produto: { select: { origem: true, controlaEstoque: true, estoque: true } },
        },
      },
    },
  })
  const querCompra = filtro.rota === 'compra'
  const ids = candidatas.filter((s) => precisaDeCompra(s.itens) === querCompra).map((s) => s.id)
  return { AND: [where, { id: { in: ids } }] }
}
