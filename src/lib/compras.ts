import { StatusSolicitacao } from '@prisma/client'
import { db } from './db'
import { subtotal, totalDosItens, type Dinheiro } from './money'
import { precisaDeCompra } from './status'
import { fornecedorDoItem, type Fornecedor } from './fornecedores'

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
  /** De que loja sai, para comprar por fornecedor (`fornecedorDoItem`). */
  fornecedor: Fornecedor
  /** Item de estoque numa solicitação com compra: está na prateleira, não se compra. */
  precisaComprar: boolean
  /** Quando o Financeiro marcou este item como comprado. */
  compradoEm: Date | null
  /** O recado de quem pôs o pedido no status atual (`notaDoStatus`). */
  nota: NotaDoStatus | null
}

export type NotaDoStatus = { texto: string; autor: string; quando: Date }

/**
 * O recado que acompanha o pedido no status em que ele está: a nota escrita na
 * mudança que o trouxe até aqui, como "troquei o link do vinho" de quem o
 * devolveu de "Deu problema". Nota de mudança anterior já foi lida e não vale;
 * a do sistema (importação, sem autor) não é recado de ninguém.
 */
export function notaDoStatus(
  historico: readonly {
    statusNovo: StatusSolicitacao
    motivo: string | null
    criadoEm: Date
    usuario: { nome: string } | null
  }[],
  status: StatusSolicitacao,
): NotaDoStatus | null {
  const ultima = [...historico].sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime())[0]
  if (!ultima || ultima.statusNovo !== status || !ultima.motivo?.trim() || !ultima.usuario) {
    return null
  }
  return { texto: ultima.motivo.trim(), autor: ultima.usuario.nome, quando: ultima.criadoEm }
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
      // Só a mudança mais recente: é ela que diz o recado do status atual.
      historico: {
        select: {
          statusNovo: true,
          motivo: true,
          criadoEm: true,
          usuario: { select: { nome: true } },
        },
        orderBy: { criadoEm: 'desc' },
        take: 1,
      },
      itens: {
        include: {
          produto: {
            select: {
              nome: true,
              urlCompra: true,
              notaDeCompra: true,
              origem: true,
              controlaEstoque: true,
              estoque: true,
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
    s.itens.map((item) => {
      const site = linkDoItem(item)
      const notaDeCompra = item.produto?.notaDeCompra ?? null
      const categoria = item.produto?.categoria.nome ?? null
      return {
        itemId: item.id,
        solicitacaoId: s.id,
        codigo: s.codigo,
        data: s.dataSolicitacao,
        consultorNome: s.consultor.nome,
        clienteNome: s.cliente.nome,
        produto: item.produto?.nome ?? item.descricaoLivre ?? '-',
        site,
        notaDeCompra,
        categoria,
        deCatalogo: item.produtoId !== null,
        valorUnitario: item.valorUnitario,
        quantidade: item.quantidade,
        valor: subtotal(item.valorUnitario, item.quantidade),
        status: s.status,
        fornecedor: fornecedorDoItem({ site, notaDeCompra, categoria }),
        precisaComprar: precisaDeCompra([item]),
        compradoEm: item.compradoEm,
        nota: notaDoStatus(s.historico, s.status),
      }
    }),
  )
}

/** O item ainda espera o Financeiro: a solicitação está na compra e ninguém o marcou. */
export function falta(
  item: Pick<ItemParaCompra, 'status' | 'precisaComprar' | 'compradoEm'>,
): boolean {
  return (
    item.status === StatusSolicitacao.aguardando_compra && item.precisaComprar && !item.compradoEm
  )
}

/**
 * A solicitação está toda comprada? Só contam os itens que precisam de compra:
 * o de estoque já está na prateleira. É o que leva a solicitação a "Comprado"
 * quando o Financeiro compra por fornecedor, um item de cada vez.
 */
export function compraCompleta(
  itens: readonly { precisaComprar: boolean; compradoEm: Date | null }[],
): boolean {
  return itens.every((i) => !i.precisaComprar || i.compradoEm !== null)
}

export type GrupoDeFornecedor = {
  fornecedor: Fornecedor
  itens: ItemParaCompra[]
  /** Quantas solicitações têm item neste fornecedor. */
  solicitacoes: number
  valor: Dinheiro
}

/**
 * O que falta comprar, agrupado por fornecedor: a visão que o Financeiro usa
 * para comprar de uma loja de uma vez e juntar o frete. O fornecedor com mais
 * solicitações vem primeiro; "Sem fornecedor definido", por último.
 */
export function agruparPorFornecedor(itens: readonly ItemParaCompra[]): GrupoDeFornecedor[] {
  const grupos = new Map<string, ItemParaCompra[]>()
  for (const item of itens.filter(falta)) {
    grupos.set(item.fornecedor.chave, [...(grupos.get(item.fornecedor.chave) ?? []), item])
  }
  return [...grupos.values()]
    .map((doGrupo) => ({
      fornecedor: doGrupo[0]!.fornecedor,
      itens: doGrupo,
      solicitacoes: new Set(doGrupo.map((i) => i.solicitacaoId)).size,
      valor: totalDosItens(doGrupo),
    }))
    .sort(
      (a, b) =>
        Number(a.fornecedor.chave === 'sem') - Number(b.fornecedor.chave === 'sem') ||
        b.solicitacoes - a.solicitacoes ||
        a.fornecedor.nome.localeCompare(b.fornecedor.nome, 'pt-BR'),
    )
}

/**
 * Onde comprar um item. Primeiro o link que quem aprova trocou, quando o
 * pedido esgotou ou não serve; depois o do presente específico, escolhido pelo
 * consultor; por último o do produto de catálogo, onde a área sempre compra
 * aquilo. Vale para a fila e para o detalhe, que o Financeiro abre a partir dela.
 */
export function linkDoItem(item: {
  linkDeCompra?: string | null
  urlExterna: string | null
  produto?: { urlCompra: string | null } | null
}): string | null {
  return item.linkDeCompra ?? item.urlExterna ?? item.produto?.urlCompra ?? null
}

/**
 * Até quando o link de compra pode ser trocado: enquanto ninguém comprou. Depois
 * de comprado, o link é registro do que foi feito, não instrução.
 */
const STATUS_COM_LINK_EDITAVEL: readonly StatusSolicitacao[] = [
  StatusSolicitacao.pendente,
  StatusSolicitacao.aguardando_aprovacao,
  StatusSolicitacao.aguardando_compra,
]

export function linkDeCompraEditavel(status: StatusSolicitacao): boolean {
  return STATUS_COM_LINK_EDITAVEL.includes(status)
}

/** Total da fila, para o cabeçalho da tela do Financeiro. */
export function totalDaFila(itens: readonly ItemParaCompra[]): Dinheiro {
  return totalDosItens(itens)
}
