import { z } from 'zod'

/**
 * Filtro do cadastro de produtos (Administração → Produtos). O catálogo tem
 * dezenas de itens e a tela já lê todos para as contagens: o recorte é feito
 * na memória, com esta função, em vez de uma segunda consulta.
 */

export const filtroDeProdutosSchema = z.object({
  categoria: z.string().max(40).optional().catch(undefined),
  origem: z.enum(['estoque_interno', 'mediante_pedido']).optional().catch(undefined),
  situacao: z.enum(['ativo', 'desativado']).optional().catch(undefined),
  /** A pauta de 22/10/2026 pede SKU em todo produto ativo: "falta" mostra o que falta. */
  sku: z.enum(['falta']).optional().catch(undefined),
})

export type FiltroDeProdutos = z.output<typeof filtroDeProdutosSchema>

export const ROTULO_DA_ORIGEM = {
  estoque_interno: 'estoque',
  mediante_pedido: 'sob pedido',
} as const

type ProdutoFiltravel = {
  categoriaId: string
  origem: string
  ativo: boolean
  skuTiny: string | null
}

export const temSku = (p: { skuTiny: string | null }) => Boolean(p.skuTiny?.trim())

export function produtosDoFiltro<P extends ProdutoFiltravel>(
  produtos: readonly P[],
  f: FiltroDeProdutos,
): P[] {
  return produtos.filter(
    (p) =>
      (!f.categoria || p.categoriaId === f.categoria) &&
      (!f.origem || p.origem === f.origem) &&
      (!f.situacao || p.ativo === (f.situacao === 'ativo')) &&
      (!f.sku || (p.ativo && !temSku(p))),
  )
}
