import { describe, expect, it } from 'vitest'
import { StatusSolicitacao } from '@prisma/client'
import { linkDeCompraEditavel, linkDoItem } from './compras'

describe('onde comprar', () => {
  it('o produto de catálogo leva o link do cadastro', () => {
    expect(
      linkDoItem({ urlExterna: null, produto: { urlCompra: 'https://casadabebida.com.br/v' } }),
    ).toBe('https://casadabebida.com.br/v')
  })

  it('o link do presente específico vem primeiro', () => {
    expect(
      linkDoItem({
        urlExterna: 'https://loja.com/x',
        produto: { urlCompra: 'https://casadabebida.com.br/v' },
      }),
    ).toBe('https://loja.com/x')
    expect(linkDoItem({ urlExterna: 'https://loja.com/x', produto: null })).toBe(
      'https://loja.com/x',
    )
  })

  it('o link trocado na aprovação vale por cima dos outros', () => {
    expect(
      linkDoItem({
        linkDeCompra: 'https://outra.com/y',
        urlExterna: null,
        produto: { urlCompra: 'https://casadabebida.com.br/v' },
      }),
    ).toBe('https://outra.com/y')
    expect(
      linkDoItem({ linkDeCompra: 'https://outra.com/y', urlExterna: 'https://loja.com/x' }),
    ).toBe('https://outra.com/y')
  })

  it('o link só se troca enquanto ninguém comprou', () => {
    for (const status of Object.values(StatusSolicitacao)) {
      const antesDaCompra = ['pendente', 'aguardando_aprovacao', 'aguardando_compra'].includes(
        status,
      )
      expect(linkDeCompraEditavel(status), status).toBe(antesDaCompra)
    }
  })

  it('sem nenhum dos dois, não inventa link', () => {
    expect(linkDoItem({ urlExterna: null, produto: { urlCompra: null } })).toBeNull()
    expect(linkDoItem({ urlExterna: null, produto: null })).toBeNull()
  })
})
