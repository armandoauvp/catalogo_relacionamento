import { describe, expect, it } from 'vitest'
import { MotivoEnvio } from '@prisma/client'
import { itemSchema, linkDeCompraSchema, solicitacaoSchema } from './solicitacao'

describe('troca do link de compra', () => {
  it('aceita http e https', () => {
    expect(linkDeCompraSchema.safeParse({ itemId: 'i1', link: 'https://loja.com/x' }).success).toBe(
      true,
    )
    expect(linkDeCompraSchema.safeParse({ itemId: 'i1', link: 'http://loja.com/x' }).success).toBe(
      true,
    )
  })

  it('vazio volta ao link original', () => {
    const r = linkDeCompraSchema.safeParse({ itemId: 'i1', link: '  ' })
    expect(r.success && r.data.link).toBe(null)
  })

  it('recusa o que não é página da web', () => {
    for (const link of ['javascript:alert(1)', 'loja.com', 'ftp://loja.com/x']) {
      expect(linkDeCompraSchema.safeParse({ itemId: 'i1', link }).success, link).toBe(false)
    }
  })
})

const enderecoValido = {
  entregaCep: '01310-100',
  entregaLogradouro: 'Avenida Paulista',
  entregaNumero: '1000',
  entregaComplemento: '',
  entregaBairro: 'Bela Vista',
  entregaCidade: 'São Paulo',
  entregaUf: 'sp',
  entregaDestinatario: 'Maria Souza',
}

describe('item da solicitação', () => {
  it('aceita item de catálogo', () => {
    const r = itemSchema.safeParse({ produtoId: 'p1', valorUnitario: '149,90', quantidade: 2 })
    expect(r.success).toBe(true)
  })

  it('aceita presente específico com descrição e link', () => {
    const r = itemSchema.safeParse({
      descricaoLivre: 'Vinho argentino',
      urlExterna: 'https://loja.exemplo.com/vinho',
      valorUnitario: '250,00',
    })
    expect(r.success).toBe(true)
  })

  it('recusa presente específico sem o link onde comprar', () => {
    const r = itemSchema.safeParse({ descricaoLivre: 'Vinho argentino', valorUnitario: '250,00' })
    expect(r.success).toBe(false)
  })

  it('recusa item que é catálogo e específico ao mesmo tempo', () => {
    const r = itemSchema.safeParse({
      produtoId: 'p1',
      descricaoLivre: 'Vinho',
      urlExterna: 'https://loja.exemplo.com',
      valorUnitario: '10',
    })
    expect(r.success).toBe(false)
  })

  it('recusa item vazio', () => {
    const r = itemSchema.safeParse({ valorUnitario: '10' })
    expect(r.success).toBe(false)
  })

  it('lê valor no formato brasileiro', () => {
    const r = itemSchema.parse({ produtoId: 'p1', valorUnitario: '1.234,56' })
    expect(r.valorUnitario).toBe(1234.56)
  })
})

describe('solicitação', () => {
  const base = {
    ...enderecoValido,
    clienteId: 'c1',
    motivo: MotivoEnvio.aniversario,
    mensagemCarta: 'Parabéns!',
    observacoes: '',
    itens: [{ produtoId: 'p1', valorUnitario: '149,90', quantidade: 1 }],
  }

  it('aceita dois itens de catálogo e um específico, critério de aceite', () => {
    const r = solicitacaoSchema.safeParse({
      ...base,
      itens: [
        { produtoId: 'p1', valorUnitario: '149,90', quantidade: 1 },
        { produtoId: 'p2', valorUnitario: '89,90', quantidade: 2 },
        {
          descricaoLivre: 'Kit de chá importado',
          urlExterna: 'https://loja.exemplo.com/kit',
          valorUnitario: '320,00',
        },
      ],
    })
    expect(r.success).toBe(true)
  })

  it('normaliza CEP e UF', () => {
    const r = solicitacaoSchema.parse(base)
    expect(r.entregaCep).toBe('01310100')
    expect(r.entregaUf).toBe('SP')
  })

  it('exige descrição quando o motivo é "outro"', () => {
    const semDescricao = solicitacaoSchema.safeParse({ ...base, motivo: MotivoEnvio.outro })
    expect(semDescricao.success).toBe(false)

    const comDescricao = solicitacaoSchema.safeParse({
      ...base,
      motivo: MotivoEnvio.outro,
      motivoOutro: 'Promoção do cliente a sócio',
    })
    expect(comDescricao.success).toBe(true)
  })

  it('recusa solicitação sem itens', () => {
    expect(solicitacaoSchema.safeParse({ ...base, itens: [] }).success).toBe(false)
  })

  it('recusa carta vazia', () => {
    expect(solicitacaoSchema.safeParse({ ...base, mensagemCarta: '   ' }).success).toBe(false)
  })

  it('recusa CEP inválido', () => {
    expect(solicitacaoSchema.safeParse({ ...base, entregaCep: '123' }).success).toBe(false)
  })
})
