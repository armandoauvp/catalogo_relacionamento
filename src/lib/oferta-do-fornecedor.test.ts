import { describe, expect, it } from 'vitest'
import { lerOferta, precoDoTexto, situacaoDaDisponibilidade } from './oferta-do-fornecedor'
import { enderecoPermitido, resultadoDaLeitura } from './conferencia-do-fornecedor'

const jsonLd = (dados: unknown) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(dados)}</script></head></html>`

describe('oferta lida da página da loja', () => {
  it('lê preço e esgotado do JSON-LD, como a Casa da Bebida publica', () => {
    const html = jsonLd({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'El Enemigo Cabernet Franc 750 ml',
      offers: { '@type': 'Offer', price: 199.98, availability: 'https://schema.org/OutOfStock' },
    })
    expect(lerOferta(html)).toEqual({ preco: '199.98', situacao: 'esgotado' })
  })

  it('acha o produto dentro do @graph e ignora bloco malformado', () => {
    const html =
      '<script type="application/ld+json">{ quebrado </script>' +
      jsonLd({
        '@graph': [
          { '@type': 'Organization', name: 'Loja' },
          { '@type': ['Product'], offers: [{ price: '89,90', availability: 'InStock' }] },
        ],
      })
    expect(lerOferta(html)).toEqual({ preco: '89.90', situacao: 'disponivel' })
  })

  it('com várias ofertas, basta uma disponível, e vale o menor preço', () => {
    const html = jsonLd({
      '@type': 'Product',
      offers: [
        { price: '120.00', availability: 'https://schema.org/OutOfStock' },
        { price: '99.00', availability: 'https://schema.org/InStock' },
      ],
    })
    expect(lerOferta(html)).toEqual({ preco: '99.00', situacao: 'disponivel' })
  })

  it('sem JSON-LD, lê as meta tags, como a Loja Integrada', () => {
    const html = `<meta itemprop="price" content="25.00"/>
      <link itemprop="availability" href="http://schema.org/LimitedAvailability"/>`
    expect(lerOferta(html)).toEqual({ preco: '25.00', situacao: 'limitado' })
  })

  it('página sem dados estruturados não inventa nada', () => {
    expect(lerOferta('<html><body>R$ 50,00 Comprar</body></html>')).toEqual({
      preco: null,
      situacao: null,
    })
  })

  it('entende preço brasileiro e disponibilidade do Open Graph', () => {
    expect(precoDoTexto('R$ 1.299,90')).toBe('1299.90')
    expect(precoDoTexto('1,299.90')).toBe('1299.90')
    expect(precoDoTexto('0')).toBeNull()
    expect(situacaoDaDisponibilidade('in stock')).toBe('disponivel')
    expect(situacaoDaDisponibilidade('out_of_stock')).toBe('esgotado')
    expect(situacaoDaDisponibilidade('https://schema.org/SoldOut')).toBe('esgotado')
    expect(situacaoDaDisponibilidade('qualquer coisa')).toBeNull()
  })
})

describe('conferência do fornecedor', () => {
  it('sem disponibilidade lida, fica "não conferido" com o motivo, e guarda o preço', () => {
    expect(resultadoDaLeitura({ preco: '10.00', situacao: null })).toMatchObject({
      situacao: 'nao_conferido',
      preco: '10.00',
    })
    expect(resultadoDaLeitura({ preco: null, situacao: 'esgotado' })).toEqual({
      situacao: 'esgotado',
      preco: null,
      erro: null,
    })
  })

  it('o servidor só abre endereço de loja, nunca um interno', () => {
    expect(enderecoPermitido('https://www.casadabebida.com.br/vinho/x/')).toBe(true)
    expect(enderecoPermitido('http://localhost:3000/api')).toBe(false)
    expect(enderecoPermitido('http://169.254.169.254/latest/meta-data')).toBe(false)
    expect(enderecoPermitido('http://10.0.0.5/')).toBe(false)
    expect(enderecoPermitido('http://172.20.1.1/')).toBe(false)
    expect(enderecoPermitido('http://[::1]/')).toBe(false)
    expect(enderecoPermitido('ftp://loja.com.br/')).toBe(false)
    expect(enderecoPermitido('não é link')).toBe(false)
  })
})
