/**
 * Preço e disponibilidade lidos da página do fornecedor (`Produto.urlCompra`).
 *
 * Pedido da Lilian em 25/11/2026: o catálogo seguia oferecendo vinho que a Casa
 * da Bebida não tinha mais, e o preço daqui envelhecia sem ninguém ver.
 *
 * A leitura não depende do desenho da página. As lojas publicam o produto em
 * dados estruturados (schema.org `Product`, em JSON-LD ou em atributos
 * `itemprop`/`meta`), que é o que buscadores leem e por isso muda pouco. Página
 * sem esses dados devolve nulo: dizer "não conferido" é melhor que adivinhar.
 *
 * Pura: recebe o HTML já baixado. A busca na rede mora em `conferencia-do-fornecedor.ts`.
 */

export type SituacaoLida = 'disponivel' | 'limitado' | 'esgotado'

export type OfertaLida = {
  /** Decimal com ponto, "199.98". Nulo quando a página não diz. */
  preco: string | null
  situacao: SituacaoLida | null
}

/** O fim da URL do schema.org, sem caixa: "https://schema.org/OutOfStock" → "outofstock". */
export function situacaoDaDisponibilidade(valor: unknown): SituacaoLida | null {
  if (typeof valor !== 'string') return null
  // "in stock" e "in_stock" aparecem nas meta tags do Open Graph.
  const nome = (valor.trim().split('/').pop() ?? '').toLowerCase().replace(/[\s_-]/g, '')
  if (['instock', 'onlineonly', 'instoreonly', 'preorder', 'presale'].includes(nome)) {
    return 'disponivel'
  }
  if (nome === 'limitedavailability') return 'limitado'
  if (['outofstock', 'soldout', 'discontinued', 'backorder'].includes(nome)) return 'esgotado'
  return null
}

/** "199,98", "1.299,90", 199.98 → "199.98". */
export function precoDoTexto(valor: unknown): string | null {
  if (typeof valor === 'number')
    return Number.isFinite(valor) && valor > 0 ? valor.toFixed(2) : null
  if (typeof valor !== 'string') return null
  let t = valor.replace(/[^\d.,]/g, '')
  if (!t) return null
  // Vírgula depois do último ponto é decimal brasileiro: o ponto é milhar.
  if (t.includes(',') && t.lastIndexOf(',') > t.lastIndexOf('.')) {
    t = t.replace(/\./g, '').replace(',', '.')
  } else {
    t = t.replace(/,/g, '')
  }
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? n.toFixed(2) : null
}

type Objeto = Record<string, unknown>
const ehObjeto = (v: unknown): v is Objeto => typeof v === 'object' && v !== null

/** Todos os objetos do JSON-LD, inclusive os de dentro de `@graph` e de listas. */
function objetosDoJsonLd(html: string): Objeto[] {
  const objetos: Objeto[] = []
  const visitar = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(visitar)
    if (!ehObjeto(v)) return
    objetos.push(v)
    if (v['@graph']) visitar(v['@graph'])
  }
  const blocos = html.matchAll(
    /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )
  for (const [, conteudo] of blocos) {
    try {
      visitar(JSON.parse(conteudo!.trim()))
    } catch {
      // Bloco malformado é comum em loja virtual; os outros ainda valem.
    }
  }
  return objetos
}

const ehProduto = (o: Objeto) => {
  const tipo = o['@type']
  return Array.isArray(tipo) ? tipo.includes('Product') : tipo === 'Product'
}

function ofertaDoProduto(produto: Objeto): OfertaLida {
  const ofertas = [produto.offers].flat().filter(ehObjeto)
  // A mais barata das disponíveis: variações aparecem como várias ofertas.
  let preco: string | null = null
  let situacao: SituacaoLida | null = null
  for (const oferta of ofertas) {
    const s = situacaoDaDisponibilidade(oferta.availability)
    const p = precoDoTexto(oferta.price ?? oferta.lowPrice)
    if (s && (situacao === null || ordem(s) < ordem(situacao))) situacao = s
    if (p && (preco === null || Number(p) < Number(preco))) preco = p
  }
  return { preco, situacao }
}

/** Para juntar ofertas: basta uma disponível para o produto estar disponível. */
const ordem = (s: SituacaoLida) => ['disponivel', 'limitado', 'esgotado'].indexOf(s)

/** `<meta property="product:price:amount" content="25.00">`, `itemprop="price"` e afins. */
function atributo(html: string, nomes: readonly string[]): string | null {
  for (const nome of nomes) {
    const tags = html.matchAll(
      new RegExp(`<[^>]+(?:property|itemprop|name)\\s*=\\s*["']${nome}["'][^>]*>`, 'gi'),
    )
    for (const [tag] of tags) {
      const valor = /\b(?:content|href)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]
      if (valor) return valor
    }
  }
  return null
}

export function lerOferta(html: string): OfertaLida {
  const produto = objetosDoJsonLd(html).find(ehProduto)
  const doJsonLd = produto ? ofertaDoProduto(produto) : { preco: null, situacao: null }

  return {
    preco:
      doJsonLd.preco ??
      precoDoTexto(atributo(html, ['product:price:amount', 'og:price:amount', 'price'])),
    situacao:
      doJsonLd.situacao ??
      situacaoDaDisponibilidade(atributo(html, ['product:availability', 'availability'])),
  }
}
