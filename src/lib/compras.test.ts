import { describe, expect, it } from 'vitest'
import { siteDeCompra } from './compras'

describe('onde comprar', () => {
  it('o produto de catálogo leva o link do cadastro', () => {
    expect(
      siteDeCompra({ urlExterna: null, produto: { urlCompra: 'https://casadabebida.com.br/v' } }),
    ).toBe('https://casadabebida.com.br/v')
  })

  it('o link do presente específico vem primeiro', () => {
    expect(
      siteDeCompra({
        urlExterna: 'https://loja.com/x',
        produto: { urlCompra: 'https://casadabebida.com.br/v' },
      }),
    ).toBe('https://loja.com/x')
    expect(siteDeCompra({ urlExterna: 'https://loja.com/x', produto: null })).toBe(
      'https://loja.com/x',
    )
  })

  it('sem nenhum dos dois, não inventa link', () => {
    expect(siteDeCompra({ urlExterna: null, produto: { urlCompra: null } })).toBeNull()
    expect(siteDeCompra({ urlExterna: null, produto: null })).toBeNull()
  })
})
