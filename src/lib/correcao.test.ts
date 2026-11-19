import { describe, expect, it } from 'vitest'
import { StatusSolicitacao } from '@prisma/client'
import {
  alteracoesDaCorrecao,
  compradoIntacto,
  correcaoCabe,
  type DadosDaCorrecao,
  type ItemComparavel,
} from './correcao'

const cuia: ItemComparavel = {
  id: 'i1',
  nome: 'Cuia AUVP + Vela',
  produtoId: null,
  urlExterna: 'https://loja.com/cuia',
  valorUnitario: '95.00',
  quantidade: 1,
  doEstoque: false,
}
const livro: ItemComparavel = {
  id: 'i2',
  nome: 'Livro - A arte de gastar dinheiro',
  produtoId: 'p1',
  urlExterna: null,
  valorUnitario: '35.00',
  quantidade: 1,
  doEstoque: false,
}

const pedido: DadosDaCorrecao = {
  entregaDestinatario: 'Maicon Benato',
  entregaCep: '95032030',
  entregaLogradouro: 'Rua Antônio Bolfe',
  entregaNumero: '316',
  entregaComplemento: 'apto 61',
  entregaBairro: 'Colina Sorriso',
  entregaCidade: 'Caxias do Sul',
  entregaUf: 'RS',
  motivo: 'Reforço de relacionamento',
  saudacaoCarta: 'Caro Maicon,',
  mensagemCarta: 'Obrigado pela parceria.',
  observacoes: null,
  itens: [livro, cuia],
}

describe('janela da correção', () => {
  it('vale até a compra', () => {
    expect(correcaoCabe(StatusSolicitacao.pendente)).toBe(true)
    expect(correcaoCabe(StatusSolicitacao.aguardando_compra)).toBe(true)
    expect(correcaoCabe(StatusSolicitacao.comprado)).toBe(false)
    expect(correcaoCabe(StatusSolicitacao.organizando_envio)).toBe(false)
  })

  it('vale em "Deu problema" enquanto o pedido não foi ao Tiny', () => {
    expect(correcaoCabe(StatusSolicitacao.deu_problema)).toBe(true)
    expect(correcaoCabe(StatusSolicitacao.deu_problema, true)).toBe(false)
  })
})

describe('o que mudou', () => {
  it('nada, quando nada mudou', () => {
    expect(alteracoesDaCorrecao(pedido, { ...pedido })).toEqual([])
  })

  it('campo a campo, com o antes e o depois', () => {
    const corrigido = { ...pedido, entregaNumero: '320', observacoes: 'Entregar na portaria' }
    expect(alteracoesDaCorrecao(pedido, corrigido)).toEqual([
      { campo: 'Número', antes: '316', depois: '320' },
      { campo: 'Observações', antes: null, depois: 'Entregar na portaria' },
    ])
  })

  it('espaço em branco não conta como mudança', () => {
    expect(alteracoesDaCorrecao(pedido, { ...pedido, observacoes: '  ' })).toEqual([])
  })

  it('item corrigido, retirado e acrescentado', () => {
    const corrigido = {
      ...pedido,
      itens: [
        { ...cuia, doEstoque: true },
        { ...cuia, id: null, nome: 'Meia AUVP', valorUnitario: '25.00' },
      ],
    }
    const mudancas = alteracoesDaCorrecao(pedido, corrigido)
    expect(mudancas.map((m) => m.campo)).toEqual([
      'Item retirado',
      'Item corrigido',
      'Item acrescentado',
    ])
    expect(mudancas[1]!.depois).toContain('do estoque')
  })
})

describe('item já comprado', () => {
  it('fica intacto quando nada nele mudou', () => {
    expect(compradoIntacto(cuia, { ...cuia })).toBe(true)
  })

  it('não pode mudar de valor nem sair', () => {
    expect(compradoIntacto(cuia, { ...cuia, valorUnitario: '80.00' })).toBe(false)
    expect(compradoIntacto(cuia, undefined)).toBe(false)
  })
})
