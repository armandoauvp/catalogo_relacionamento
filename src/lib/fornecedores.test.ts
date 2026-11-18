import { describe, expect, it } from 'vitest'
import {
  PEDIDO_DIRETO,
  fornecedorDaCategoria,
  fornecedorDoItem,
  siteDeCompra,
} from './fornecedores'

describe('fornecedor por categoria', () => {
  it('bebida vem da Casa da Bebida', () => {
    expect(fornecedorDaCategoria('Bebidas')).toBe('https://casadabebida.com.br')
  })

  it('não depende de caixa nem de espaço em volta', () => {
    expect(fornecedorDaCategoria('  bebidas ')).toBe('https://casadabebida.com.br')
  })

  it('categoria sem fornecedor definido devolve nulo', () => {
    expect(fornecedorDaCategoria('Papelaria')).toBeNull()
    expect(fornecedorDaCategoria(null)).toBeNull()
  })
})

describe('site de compra do item', () => {
  it('o link do presente específico vence o padrão da categoria', () => {
    expect(siteDeCompra('https://loja.exemplo.com/vinho', 'Bebidas')).toEqual({
      url: 'https://loja.exemplo.com/vinho',
      origem: 'item',
    })
  })

  it('item de catálogo de bebida cai no fornecedor da categoria', () => {
    expect(siteDeCompra(null, 'Bebidas')).toEqual({
      url: 'https://casadabebida.com.br',
      origem: 'categoria',
    })
  })

  it('item de catálogo sem fornecedor não inventa link', () => {
    expect(siteDeCompra(null, 'Papelaria')).toBeNull()
  })
})

describe('a categoria é o último recurso', () => {
  it('aceita "Bebida" e "Bebidas", a planilha mudou o plural no caminho', () => {
    expect(fornecedorDaCategoria('Bebida')).toBe('https://casadabebida.com.br')
    expect(fornecedorDaCategoria('Bebidas')).toBe('https://casadabebida.com.br')
  })
})

describe('fornecedor de cada item', () => {
  const item = (
    site: string | null,
    notaDeCompra: string | null = null,
    categoria: string | null = null,
  ) => fornecedorDoItem({ site, notaDeCompra, categoria })

  it('reconhece a loja pelo domínio do link, com ou sem www e subdomínio', () => {
    expect(item('https://www.mercadolivre.com.br/livro/p/1').nome).toBe('Mercado Livre')
    expect(item('https://produto.mercadolivre.com.br/MLB-1').nome).toBe('Mercado Livre')
    expect(item('https://www.casadabebida.com.br/vinho/x').nome).toBe('Casa da Bebida')
    expect(item('https://colombina-express.lojaintegrada.com.br/kit').nome).toBe('Colombina')
  })

  it('a mesma loja tem sempre a mesma chave, para agrupar', () => {
    expect(item('https://www.mercadolivre.com.br/a').chave).toBe(
      item('https://produto.mercadolivre.com.br/b').chave,
    )
  })

  it('loja desconhecida aparece pelo próprio domínio', () => {
    expect(item('https://www.lojanova.com.br/x')).toMatchObject({
      nome: 'lojanova.com.br',
      site: 'https://lojanova.com.br',
    })
  })

  it('sem link, vale o fornecedor padrão da categoria', () => {
    expect(item(null, null, 'Bebida').nome).toBe('Casa da Bebida')
  })

  it('o que é encomendado direto fica junto, com ou sem detalhe na nota', () => {
    expect(item(null, PEDIDO_DIRETO).chave).toBe('direto')
    expect(item(null, `${PEDIDO_DIRETO} (caneca)`).chave).toBe('direto')
  })

  it('sem nada, fica em "Sem fornecedor definido", e link inválido não quebra', () => {
    expect(item(null).chave).toBe('sem')
    expect(item('não é link').chave).toBe('sem')
  })
})
