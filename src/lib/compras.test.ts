import { describe, expect, it } from 'vitest'
import { Prisma, StatusSolicitacao } from '@prisma/client'
import {
  agruparPorFornecedor,
  compraCompleta,
  falta,
  linkDeCompraEditavel,
  linkDoItem,
  type ItemParaCompra,
  notaDoStatus,
} from './compras'
import { fornecedorDoItem } from './fornecedores'

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

describe('compra por fornecedor', () => {
  const base = {
    data: new Date('2026-11-10T12:00:00Z'),
    consultorNome: 'Bia',
    clienteNome: 'Ana',
    notaDeCompra: null,
    categoria: null,
    deCatalogo: true,
    valorUnitario: new Prisma.Decimal(100),
    quantidade: 1,
    valor: new Prisma.Decimal(100),
    status: StatusSolicitacao.aguardando_compra,
    precisaComprar: true,
    compradoEm: null as Date | null,
    nota: null,
  }
  const item = (
    itemId: string,
    solicitacaoId: string,
    site: string,
    extra: Partial<ItemParaCompra> = {},
  ): ItemParaCompra => ({
    ...base,
    itemId,
    solicitacaoId,
    codigo: solicitacaoId,
    produto: itemId,
    site,
    fornecedor: fornecedorDoItem({ site, notaDeCompra: null, categoria: null }),
    ...extra,
  })
  const ML = 'https://www.mercadolivre.com.br/x'
  const CB = 'https://www.casadabebida.com.br/y'

  it('falta comprar só o que está na compra, precisa de compra e ninguém marcou', () => {
    expect(falta(item('a', 's1', ML))).toBe(true)
    expect(falta(item('a', 's1', ML, { compradoEm: new Date() }))).toBe(false)
    expect(falta(item('a', 's1', ML, { precisaComprar: false }))).toBe(false)
    expect(falta(item('a', 's1', ML, { status: StatusSolicitacao.comprado }))).toBe(false)
  })

  it('agrupa por loja, conta solicitações e soma o valor, a maior primeiro', () => {
    const grupos = agruparPorFornecedor([
      item('a', 's1', ML),
      item('b', 's2', ML),
      item('c', 's2', CB),
      item('d', 's3', ML, { compradoEm: new Date() }),
    ])
    expect(grupos.map((g) => g.fornecedor.nome)).toEqual(['Mercado Livre', 'Casa da Bebida'])
    expect(grupos[0]).toMatchObject({ solicitacoes: 2 })
    expect(grupos[0]!.itens.map((i) => i.itemId)).toEqual(['a', 'b'])
    expect(grupos[0]!.valor.toString()).toBe('200')
  })

  it('"Sem fornecedor definido" vai sempre por último', () => {
    const grupos = agruparPorFornecedor([
      item('a', 's1', 'não é link'),
      item('b', 's2', 'não é link'),
      item('c', 's3', CB),
    ])
    expect(grupos.at(-1)?.fornecedor.chave).toBe('sem')
  })

  it('a solicitação fica completa quando o último item que precisa de compra é marcado', () => {
    const agora = new Date()
    expect(
      compraCompleta([
        { precisaComprar: true, compradoEm: agora },
        { precisaComprar: true, compradoEm: null },
      ]),
    ).toBe(false)
    expect(
      compraCompleta([
        { precisaComprar: true, compradoEm: agora },
        { precisaComprar: true, compradoEm: agora },
      ]),
    ).toBe(true)
    // O item de estoque está na prateleira: não segura a solicitação.
    expect(
      compraCompleta([
        { precisaComprar: true, compradoEm: agora },
        { precisaComprar: false, compradoEm: null },
      ]),
    ).toBe(true)
  })
})

describe('nota que acompanha o pedido na fila', () => {
  const quando = (h: number) => new Date(Date.UTC(2026, 10, 19, h))
  const lilian = { nome: 'Lilian' }

  it('mostra o recado de quem o devolveu de "Deu problema"', () => {
    const nota = notaDoStatus(
      [
        {
          statusNovo: StatusSolicitacao.deu_problema,
          motivo: 'Sem estoque',
          criadoEm: quando(10),
          usuario: { nome: 'Dani' },
        },
        {
          statusNovo: StatusSolicitacao.aguardando_compra,
          motivo: 'Troquei o link do vinho',
          criadoEm: quando(12),
          usuario: lilian,
        },
      ],
      StatusSolicitacao.aguardando_compra,
    )
    expect(nota).toEqual({ texto: 'Troquei o link do vinho', autor: 'Lilian', quando: quando(12) })
  })

  it('nota de status anterior, do sistema ou vazia não aparece', () => {
    const deuProblema = [
      {
        statusNovo: StatusSolicitacao.deu_problema,
        motivo: 'Sem estoque',
        criadoEm: quando(10),
        usuario: lilian,
      },
    ]
    expect(notaDoStatus(deuProblema, StatusSolicitacao.aguardando_compra)).toBeNull()
    const importada = [
      {
        statusNovo: StatusSolicitacao.aguardando_compra,
        motivo: 'Liberada no ClickUp',
        criadoEm: quando(9),
        usuario: null,
      },
    ]
    expect(notaDoStatus(importada, StatusSolicitacao.aguardando_compra)).toBeNull()
    expect(notaDoStatus([], StatusSolicitacao.aguardando_compra)).toBeNull()
  })
})
