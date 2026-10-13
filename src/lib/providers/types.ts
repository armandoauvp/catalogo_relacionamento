import type { Prisma, TipoValor, OrigemCliente, OrigemProduto } from '@prisma/client'

/**
 * Contratos das fontes de dados de catálogo e de clientes.
 *
 * O V1 lê tudo do próprio Postgres. A fase 2 troca o catálogo pelo Tiny ERP e
 * os clientes pelo Salesforce. Para que essa troca não vire migração de dados
 * nem reescrita de tela, as telas nunca falam com o Prisma diretamente para
 * esses dois domínios: falam com estas interfaces.
 *
 * Consequência prática do desenho: os tipos abaixo são de leitura e não
 * espelham as linhas do banco. `ProdutoDoCatalogo` não tem `criadoEm` porque o
 * Tiny não devolveria isso, e a tela não pode passar a depender de um campo que
 * some quando o provider mudar.
 */

export type ProdutoDoCatalogo = {
  id: string
  nome: string
  descricao: string | null
  categoriaId: string
  categoriaNome: string
  fotoUrl: string | null
  /** Nulo quando a área ainda não informou o preço. Nulo não é zero. */
  valor: Prisma.Decimal | null
  tipoValor: TipoValor
  /** Prateleira ou compra sob demanda, decide se passa pelo Financeiro. */
  origem: OrigemProduto
  /** Quando false, a tela omite disponibilidade em vez de exibir zero. */
  controlaEstoque: boolean
  estoque: number | null
  /** Onde o Financeiro compra. Vence o fornecedor padrão da categoria. */
  urlCompra: string | null
  /** Instrução de compra que não é link, "Pedido direto ao fornecedor". */
  notaDeCompra: string | null
  /** Rótulo que este presente exige na mesma solicitação, como `vinho`. */
  exigeAcompanhamento: string | null
  /** Rótulo que este presente satisfaz quando entra junto de um kit. */
  serveComoAcompanhamento: string | null
  ativo: boolean
  skuTiny: string | null
}

export type FiltroDeCatalogo = {
  /** Busca livre, aplicada a nome e descrição. */
  busca?: string
  categoriaId?: string
  /** Só o que sai da prateleira, ou só o que é comprado sob demanda. */
  origem?: OrigemProduto
  /** Padrão true: o consultor nunca enxerga produto desativado. */
  apenasAtivos?: boolean
  pagina?: number
  porPagina?: number
}

export type PaginaDeCatalogo = {
  itens: ProdutoDoCatalogo[]
  total: number
  pagina: number
  porPagina: number
}

export interface CatalogoProvider {
  readonly nome: 'local' | 'tiny'
  listar(filtro: FiltroDeCatalogo): Promise<PaginaDeCatalogo>
  obter(id: string): Promise<ProdutoDoCatalogo | null>
  /**
   * Disponibilidade no momento da solicitação.
   * Devolve null quando o produto não controla estoque.
   */
  consultarEstoque(id: string): Promise<number | null>
}

export type ClienteEncontrado = {
  id: string
  nome: string
  cpf: string
  telefone: string | null
  email: string | null
  salesforceId: string | null
  origem: OrigemCliente
}

export interface ClienteProvider {
  readonly nome: 'local' | 'salesforce'
  /** Busca por CPF: a chave de deduplicação da spec. */
  buscarPorCpf(cpf: string): Promise<ClienteEncontrado | null>
  buscarPorTexto(termo: string, limite?: number): Promise<ClienteEncontrado[]>
  obter(id: string): Promise<ClienteEncontrado | null>
}

/** Erro esperado de provider externo indisponível, a tela trata, não quebra. */
export class ProviderIndisponivelError extends Error {
  constructor(provider: string, causa?: unknown) {
    super(`Fonte de dados "${provider}" indisponível no momento.`)
    this.name = 'ProviderIndisponivelError'
    this.cause = causa
  }
}
