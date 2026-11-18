/**
 * Onde cada categoria é comprada, quando não há link em lugar nenhum.
 *
 * É o último recurso da fila de compras. O catálogo da área traz o link produto
 * a produto (`Produto.urlCompra`), e o presente específico traz o que o
 * consultor digitou: os dois vencem este mapa, porque apontam para o item, e
 * não para a loja.
 *
 * O que sobra aqui é o caso do produto cadastrado sem link: bebida é sempre
 * comprada na Casa da Bebida, então o Financeiro chega à loja certa mesmo
 * assim. Outras categorias entram à medida que forem definidas.
 *
 * Mapa fixo, e não coluna no banco, porque é regra da área e não dado que
 * alguém edita tela a tela, para isso já existe `urlCompra` no produto.
 */
const POR_CATEGORIA: Record<string, string> = {
  // A área passou `casadabebida.com.br/u`; o `/u` parece truncado, então fica
  // o domínio, que resolve para a loja.
  bebida: 'https://casadabebida.com.br',
  // A planilha antiga usava o plural. Os dois apontam para a mesma loja.
  bebidas: 'https://casadabebida.com.br',
}

export function fornecedorDaCategoria(categoria: string | null | undefined): string | null {
  return POR_CATEGORIA[(categoria ?? '').trim().toLowerCase()] ?? null
}

/**
 * Nome de cada loja, pelo domínio do link. Os que a área usa hoje; loja nova
 * aparece pelo próprio domínio até ganhar nome aqui. Subdomínio conta como a
 * mesma loja (`produto.mercadolivre.com.br` é o Mercado Livre).
 */
const LOJAS: readonly (readonly [dominio: string, nome: string])[] = [
  ['casadabebida.com.br', 'Casa da Bebida'],
  ['mercadolivre.com.br', 'Mercado Livre'],
  ['colombina-express.lojaintegrada.com.br', 'Colombina'],
  ['robertadecoracoes.com.br', 'Roberta Decorações'],
  ['amazon.com.br', 'Amazon'],
  ['magazineluiza.com.br', 'Magazine Luiza'],
]

/** A nota do catálogo para o que é encomendado direto, sem loja on-line. */
export const PEDIDO_DIRETO = 'Pedido direto ao fornecedor'

export type Fornecedor = {
  /** Agrupa os itens: o mesmo fornecedor tem sempre a mesma chave. */
  chave: string
  nome: string
  /** A página da loja, quando há; o link de cada item segue no item. */
  site: string | null
}

const SEM_FORNECEDOR: Fornecedor = { chave: 'sem', nome: 'Sem fornecedor definido', site: null }

function dominio(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * De qual fornecedor sai um item, para o Financeiro comprar tudo de uma loja
 * de uma vez. Sai do mesmo lugar que o site da fila (`siteDeCompra`): o link do
 * item ou, sem ele, o padrão da categoria. Sem link, o que é encomendado direto
 * fica junto; o resto, em "Sem fornecedor definido", para não sumir da vista.
 */
export function fornecedorDoItem(item: {
  site: string | null | undefined
  notaDeCompra: string | null | undefined
  categoria: string | null | undefined
}): Fornecedor {
  const onde = siteDeCompra(item.site, item.categoria)
  const host = onde ? dominio(onde.url) : null
  if (host) {
    const loja = LOJAS.find(([d]) => host === d || host.endsWith(`.${d}`))
    return {
      chave: `site:${loja?.[0] ?? host}`,
      nome: loja?.[1] ?? host,
      site: `https://${loja?.[0] ?? host}`,
    }
  }
  if (item.notaDeCompra?.startsWith(PEDIDO_DIRETO)) {
    return { chave: 'direto', nome: PEDIDO_DIRETO, site: null }
  }
  return SEM_FORNECEDOR
}

/**
 * Site que o Financeiro usa para comprar um item.
 *
 * O link do presente específico vence o padrão da categoria: ele foi escolhido
 * pelo consultor para aquele item.
 */
export function siteDeCompra(
  urlExterna: string | null | undefined,
  categoria: string | null | undefined,
): { url: string; origem: 'item' | 'categoria' } | null {
  if (urlExterna) return { url: urlExterna, origem: 'item' }

  const padrao = fornecedorDaCategoria(categoria)
  return padrao ? { url: padrao, origem: 'categoria' } : null
}
