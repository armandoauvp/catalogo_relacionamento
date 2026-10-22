import { describe, expect, it } from 'vitest'
import {
  chaveDoLote,
  chaveDoPresente,
  montarPedido,
  resumoDosItens,
  servicosDaTransportadora,
  tipoDePessoa,
} from './pedido'

const destinatario = {
  nome: 'Marina Alves Pereira',
  cpfCnpj: '529.982.247-25',
  email: 'marina@exemplo.com.br',
  telefone: '(11) 98765-4321',
  cep: '01310100',
  endereco: 'Avenida Paulista',
  numero: '1000',
  complemento: 'Apto 152',
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  uf: 'sp',
}

describe('pedido para o Tiny', () => {
  it('monta cliente, entrega, itens e frete pela AUVP', () => {
    const p = montarPedido({
      destinatario,
      nomeDoDestinatario: 'Marina (portaria)',
      itens: [{ codigo: 'LIV-01', descricao: 'Livro AUVP', quantidade: 2, valorUnitario: '35.00' }],
      transportadora: 'Correios',
      formaFrete: 'PAC CONTRATO',
      marcador: 'IMPORT-01',
      numeroNoSistema: 'SOL-2026-0012',
    })
    expect(p.cliente).toMatchObject({
      nome: 'Marina Alves Pereira',
      tipo_pessoa: 'F',
      cpf_cnpj: '52998224725',
      fone: '11987654321',
      cep: '01310-100',
      uf: 'SP',
      atualizar_cliente: 'S',
    })
    expect(p.endereco_entrega.nome_destinatario).toBe('Marina (portaria)')
    expect(p.itens).toEqual([
      {
        item: {
          codigo: 'LIV-01',
          descricao: 'Livro AUVP',
          unidade: 'UN',
          quantidade: '2',
          valor_unitario: '35.00',
        },
      },
    ])
    expect(p.frete_por_conta).toBe('R')
    expect(p.marcadores).toEqual([{ marcador: { descricao: 'IMPORT-01' } }])
    expect(p.numero_pedido_ecommerce).toBe('SOL-2026-0012')
  })

  it('item sem SKU vai só pela descrição; campos vazios ficam de fora', () => {
    const p = montarPedido({
      destinatario,
      itens: [{ codigo: null, descricao: 'Vale-jantar', quantidade: 1, valorUnitario: '380.00' }],
    })
    expect(p.itens[0]!.item).not.toHaveProperty('codigo')
    expect(p).not.toHaveProperty('marcadores')
    expect(p).not.toHaveProperty('nome_transportador')
  })

  it('corta o que passa do tamanho que o Tiny aceita', () => {
    const p = montarPedido({
      destinatario: { ...destinatario, bairro: 'B'.repeat(80), numero: '12345678901234' },
      itens: [{ descricao: 'X'.repeat(200), quantidade: 1, valorUnitario: '1.00' }],
    })
    expect(p.cliente.bairro).toHaveLength(30)
    expect(p.cliente.numero).toHaveLength(10)
    expect(p.itens[0]!.item.descricao).toHaveLength(120)
  })

  it('CNPJ é pessoa jurídica', () => {
    expect(tipoDePessoa('11.222.333/0001-81')).toBe('J')
    expect(tipoDePessoa('52998224725')).toBe('F')
  })

  it('serviços da transportadora como no AUVP-Eventos', () => {
    expect(servicosDaTransportadora('Correios')).toContain('PAC CONTRATO')
    expect(servicosDaTransportadora('Total Express')).toEqual(['Serviço Expresso'])
    expect(servicosDaTransportadora('Loggi')).toEqual(['Padrao'])
  })

  it('a chave do lote ignora máscara e caixa: a mesma pessoa não recebe duas vezes', () => {
    expect(chaveDoLote('Import-01', '529.982.247-25', 'LIV-01')).toBe(
      chaveDoLote('import-01 ', '52998224725', 'liv-01'),
    )
    expect(chaveDoLote('A', '52998224725', 'X')).not.toBe(chaveDoLote('B', '52998224725', 'X'))
    expect(chaveDoPresente('abc')).toBe('presente:abc')
  })

  it('resume os itens numa linha', () => {
    expect(
      resumoDosItens([
        { descricao: 'Livro', quantidade: 2 },
        { descricao: 'Caneca', quantidade: 1 },
      ]),
    ).toBe('2× Livro, 1× Caneca')
  })
})
