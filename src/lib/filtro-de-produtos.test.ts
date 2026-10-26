import { describe, expect, it } from 'vitest'
import { filtroDeProdutosSchema, produtosDoFiltro } from './filtro-de-produtos'

const produto = (nome: string, campos: Partial<Record<string, unknown>> = {}) => ({
  nome,
  categoriaId: 'livros',
  origem: 'mediante_pedido',
  ativo: true,
  skuTiny: 'SKU-1' as string | null,
  ...campos,
})

const PRODUTOS = [
  produto('Livro'),
  produto('Caneca', { categoriaId: 'brindes', origem: 'estoque_interno', skuTiny: null }),
  produto('Vinho antigo', { categoriaId: 'bebida', ativo: false, skuTiny: null }),
]

const nomes = (bruto: Record<string, string>) =>
  produtosDoFiltro(PRODUTOS, filtroDeProdutosSchema.parse(bruto)).map((p) => p.nome)

describe('filtro do cadastro de produtos', () => {
  it('sem filtro, todos', () => {
    expect(nomes({})).toEqual(['Livro', 'Caneca', 'Vinho antigo'])
  })

  it('por categoria, origem e situação, juntos', () => {
    expect(nomes({ categoria: 'brindes' })).toEqual(['Caneca'])
    expect(nomes({ origem: 'estoque_interno' })).toEqual(['Caneca'])
    expect(nomes({ situacao: 'desativado' })).toEqual(['Vinho antigo'])
    expect(nomes({ origem: 'mediante_pedido', situacao: 'ativo' })).toEqual(['Livro'])
  })

  it('sem SKU olha só os ativos: o desativado não vai a lugar nenhum', () => {
    expect(nomes({ sku: 'falta' })).toEqual(['Caneca'])
  })

  it('valor estranho na URL é ignorado', () => {
    expect(nomes({ origem: 'qualquer', situacao: 'talvez' })).toHaveLength(3)
  })
})
