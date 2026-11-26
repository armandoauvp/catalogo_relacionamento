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

describe('filtro pela conferência da loja', () => {
  const NA_LOJA = [
    produto('Ativo esgotado', { fornecedorSituacao: 'esgotado' }),
    produto('Ativo disponível', { fornecedorSituacao: 'disponivel' }),
    produto('Pausado que voltou', { ativo: false, fornecedorSituacao: 'disponivel' }),
    produto('Pausado com pouco', { ativo: false, fornecedorSituacao: 'limitado' }),
    produto('Pausado ainda esgotado', { ativo: false, fornecedorSituacao: 'esgotado' }),
    produto('Pausado sem leitura', { ativo: false, fornecedorSituacao: 'nao_conferido' }),
  ]
  const da = (fornecedor: string) =>
    produtosDoFiltro(NA_LOJA, filtroDeProdutosSchema.parse({ fornecedor })).map((p) => p.nome)

  it('esgotado é o ativo que a loja não tem', () => {
    expect(da('esgotado')).toEqual(['Ativo esgotado'])
  })

  it('voltou é o pausado que a loja tem de novo', () => {
    expect(da('voltou')).toEqual(['Pausado que voltou', 'Pausado com pouco'])
  })
})
