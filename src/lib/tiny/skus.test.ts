import { describe, expect, it } from 'vitest'
import { conferirSku, lerPlanilhaDeSkus } from './skus'

const doTiny = [
  { codigo: 'PRES-VINHO-01', nome: 'Vinho El Enemigo', tipoVariacao: 'N' },
  { codigo: 'PRES-VINHO-010', nome: 'Vinho Alma Negra', tipoVariacao: 'N' },
  { codigo: 'BEBIDAS', nome: 'Bebidas', tipoVariacao: 'P' },
]

describe('conferirSku', () => {
  it('aceita o código exato, sem diferença de caixa nem espaço', () => {
    expect(conferirSku(' pres-vinho-01 ', doTiny)).toEqual({
      ok: true,
      nomeNoTiny: 'Vinho El Enemigo',
    })
  })

  it('não aceita o código que a busca trouxe só por conter o texto', () => {
    expect(conferirSku('PRES-VINHO-0', doTiny).ok).toBe(false)
  })

  it('recusa o produto-pai de variações, que o Tiny não vende', () => {
    const r = conferirSku('BEBIDAS', doTiny)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/variações/)
  })
})

describe('lerPlanilhaDeSkus', () => {
  const catalogo = [
    { id: 'p1', nome: 'Vinho El Enemigo', skuTiny: null },
    { id: 'p2', nome: 'Caneca AUVP', skuTiny: 'CANECA-ANTIGA' },
  ]

  it('acha as colunas pelo nome, depois de linhas de título, e casa o presente sem acento', () => {
    const r = lerPlanilhaDeSkus(
      [
        ['Correspondência de SKUs'],
        ['Presente', 'Código atual no Olist', 'SKU no Tiny'],
        ['vinho el enemigo', '', 'PRES-VINHO-01'],
        ['Caneca AUVP', 'X', 'PRES-CANECA'],
      ],
      catalogo,
    )
    expect(r.faltando).toEqual([])
    expect(r.linhas).toEqual([
      {
        linha: 3,
        presente: 'vinho el enemigo',
        sku: 'PRES-VINHO-01',
        produtoId: 'p1',
        skuAtual: null,
        erro: null,
      },
      {
        linha: 4,
        presente: 'Caneca AUVP',
        sku: 'PRES-CANECA',
        produtoId: 'p2',
        skuAtual: 'CANECA-ANTIGA',
        erro: null,
      },
    ])
  })

  it('pula a linha sem SKU e aponta presente desconhecido ou repetido', () => {
    const r = lerPlanilhaDeSkus(
      [
        ['Presente', 'SKU'],
        ['Vinho El Enemigo', ''],
        ['Vinho Inexistente', 'X1'],
        ['Caneca AUVP', 'A'],
        ['Caneca AUVP', 'B'],
      ],
      catalogo,
    )
    expect(r.linhas.map((l) => [l.linha, l.erro])).toEqual([
      [3, 'Presente não encontrado no catálogo: confira o nome.'],
      [4, null],
      [5, 'Presente repetido (também na linha 4).'],
    ])
  })

  it('diz quais colunas faltam quando não acha o cabeçalho', () => {
    expect(lerPlanilhaDeSkus([['Nome', 'Preço']], catalogo).faltando).toEqual([
      'Presente',
      'SKU no Tiny',
    ])
  })
})
