import { StatusSolicitacao } from '@prisma/client'
import { db } from './db'
import { subtotal, totalDosItens, type Dinheiro } from './money'

/**
 * Fila de compras do perfil Financeiro.
 *
 * Definição da área: o Financeiro recebe as solicitações enviadas para compra
 * contendo data, produto, valor e site. É uma visão por item, não por
 * solicitação: quem compra compra item a item, e um item de catálogo e um
 * presente específico têm origens diferentes.
 *
 * O "site" sai de três lugares, nesta ordem: o link que o consultor digitou no
 * presente específico, o link do cadastro do produto (a coluna "Link" da
 * planilha do catálogo) e, por último, o fornecedor padrão da categoria em
 * `src/lib/fornecedores.ts`. Quando nenhum existe, sobra a nota de compra,
 * "Pedido direto ao fornecedor", ou a própria categoria.
 */

export type ItemParaCompra = {
  itemId: string
  solicitacaoId: string
  codigo: string
  /** Data da solicitação: a data que o Financeiro usa para priorizar. */
  data: Date
  consultorNome: string
  clienteNome: string
  /** Nome do produto do catálogo, ou a descrição do presente específico. */
  produto: string
  /**
   * Onde comprar: o link do presente específico ou o do produto de catálogo.
   * Nulo quando não há link, aí vale a nota, ou o padrão da categoria.
   */
  site: string | null
  /** Instrução que não é link, do cadastro do produto. */
  notaDeCompra: string | null
  categoria: string | null
  deCatalogo: boolean
  valorUnitario: Dinheiro
  quantidade: number
  valor: Dinheiro
  status: StatusSolicitacao
}

/**
 * Status que colocam a solicitação na fila do Financeiro.
 *
 * `aguardando_compra` é o estado que a área descreveu como "enviada para
 * compra". `comprado` fica visível junto para que o Financeiro confirme o que
 * já resolveu sem perder o item de vista no mesmo dia.
 */
export const STATUS_DA_FILA_DE_COMPRAS: readonly StatusSolicitacao[] = [
  StatusSolicitacao.aguardando_compra,
  StatusSolicitacao.comprado,
] as const

export type FiltroDaFila = {
  status?: StatusSolicitacao[]
  de?: Date
  ate?: Date
  consultorId?: string
}

export async function filaDeCompras(filtro: FiltroDaFila = {}): Promise<ItemParaCompra[]> {
  const status = filtro.status?.length ? filtro.status : [...STATUS_DA_FILA_DE_COMPRAS]

  const solicitacoes = await db.solicitacao.findMany({
    where: {
      status: { in: status },
      ...(filtro.consultorId ? { consultorId: filtro.consultorId } : {}),
      ...(filtro.de || filtro.ate
        ? {
            dataSolicitacao: {
              ...(filtro.de ? { gte: filtro.de } : {}),
              ...(filtro.ate ? { lte: filtro.ate } : {}),
            },
          }
        : {}),
    },
    include: {
      consultor: { select: { nome: true } },
      cliente: { select: { nome: true } },
      itens: {
        include: {
          produto: {
            select: {
              nome: true,
              urlCompra: true,
              notaDeCompra: true,
              categoria: { select: { nome: true } },
            },
          },
        },
      },
    },
    // Mais antigas primeiro: a fila de compra é ordem de chegada.
    orderBy: { dataSolicitacao: 'asc' },
  })

  return solicitacoes.flatMap((s) =>
    s.itens.map((item) => ({
      itemId: item.id,
      solicitacaoId: s.id,
      codigo: s.codigo,
      data: s.dataSolicitacao,
      consultorNome: s.consultor.nome,
      clienteNome: s.cliente.nome,
      produto: item.produto?.nome ?? item.descricaoLivre ?? '-',
      site: siteDeCompra(item),
      notaDeCompra: item.produto?.notaDeCompra ?? null,
      categoria: item.produto?.categoria.nome ?? null,
      deCatalogo: item.produtoId !== null,
      valorUnitario: item.valorUnitario,
      quantidade: item.quantidade,
      valor: subtotal(item.valorUnitario, item.quantidade),
      status: s.status,
    })),
  )
}

/**
 * Onde comprar um item. O link do presente específico foi escolhido pelo
 * consultor para aquele item; o do produto de catálogo é onde a área sempre
 * compra aquilo. Vale para a fila e para o detalhe, que o Financeiro abre a
 * partir dela: sem isso, o produto de catálogo chegava lá sem link.
 */
export function siteDeCompra(item: {
  urlExterna: string | null
  produto?: { urlCompra: string | null } | null
}): string | null {
  return item.urlExterna ?? item.produto?.urlCompra ?? null
}

/** Total da fila, para o cabeçalho da tela do Financeiro. */
export function totalDaFila(itens: readonly ItemParaCompra[]): Dinheiro {
  return totalDosItens(itens)
}
