import { describe, expect, it } from 'vitest'
import { jaChegou, passoPermitido } from './ciclo'
import {
  classificarBusca,
  codigoDaSituacao,
  corDoMarcador,
  dataParaOTiny,
  decimalDoTiny,
  enderecoEmUmaLinha,
  imagemDoProduto,
  lerDetalheDoPedido,
  lerEstoque,
  lerPaginaDePedidos,
} from './leitura'
import { rotuloDaSituacao } from './rotulos'

describe('situação do pedido', () => {
  it('traduz o texto da tela do Tiny para o código', () => {
    expect(codigoDaSituacao('Em aberto')).toBe('aberto')
    expect(codigoDaSituacao('Aberto')).toBe('aberto')
    expect(codigoDaSituacao('Preparando envio')).toBe('preparando_envio')
    expect(codigoDaSituacao('Atendido')).toBe('faturado')
    expect(codigoDaSituacao('Faturado (atendido)')).toBe('faturado')
    expect(codigoDaSituacao('Pronto para envio')).toBe('pronto_envio')
    expect(codigoDaSituacao('Não Entregue')).toBe('nao_entregue')
    expect(codigoDaSituacao('cancelado')).toBe('cancelado')
  })

  it('o ciclo e o rótulo aceitam a situação gravada em texto', () => {
    expect(passoPermitido('preparando envio', 'concluir')).toBe(true)
    expect(passoPermitido('Pronto para envio', 'fechar')).toBe(false)
    expect(jaChegou('Preparando envio', 'preparando_envio')).toBe(true)
    expect(rotuloDaSituacao('preparando envio')).toBe('Preparando envio')
  })
})

describe('busca de pedidos', () => {
  it('número curto é número do pedido', () => {
    expect(classificarBusca(' 12345 ')).toEqual({ tipo: 'numero', valor: '12345' })
  })

  it('CPF e CNPJ, com ou sem pontuação', () => {
    expect(classificarBusca('123.456.789-09')).toEqual({ tipo: 'cpfCnpj', valor: '12345678909' })
    expect(classificarBusca('12345678000195')).toEqual({
      tipo: 'cpfCnpj',
      valor: '12345678000195',
    })
  })

  it('o resto é nome do cliente, e vazio não busca', () => {
    expect(classificarBusca('Maria')).toEqual({ tipo: 'cliente', valor: 'Maria' })
    expect(classificarBusca('   ')).toBeNull()
  })
})

describe('respostas do Tiny', () => {
  it('decimal com vírgula e milhar', () => {
    expect(decimalDoTiny('1.234,56')).toBe('1234.56')
    expect(decimalDoTiny('35.00')).toBe('35.00')
    expect(decimalDoTiny('')).toBe('0')
  })

  it('página de pedidos, com um registro só fora de lista', () => {
    const pagina = lerPaginaDePedidos({
      status: 'OK',
      pagina: '2',
      numero_paginas: '5',
      pedidos: {
        pedido: {
          id: '99',
          numero: '1020',
          data_pedido: '22/10/2026',
          nome: 'Maria',
          valor: '35,00',
          situacao: 'Entregue',
          codigo_rastreamento: 'QB1BR',
        },
      },
    })
    expect(pagina.pagina).toBe(2)
    expect(pagina.paginas).toBe(5)
    expect(pagina.pedidos[0]).toMatchObject({
      id: '99',
      cliente: 'Maria',
      valor: '35.00',
      situacao: 'entregue',
      rastreio: 'QB1BR',
      numeroEcommerce: null,
    })
  })

  it('busca sem resultado vira página vazia', () => {
    expect(lerPaginaDePedidos({ vazio: true })).toEqual({ pedidos: [], pagina: 1, paginas: 1 })
  })

  it('detalhe com itens, marcadores e entrega', () => {
    const d = lerDetalheDoPedido({
      id: '99',
      numero: '1020',
      situacao: 'Em aberto',
      total_pedido: '70.00',
      id_nota_fiscal: '0',
      cliente: { nome: 'Maria', cpf_cnpj: '123.456.789-09', cep: '01001-000', uf: 'sp' },
      endereco_entrega: { endereco: 'Rua A', numero: '10', cidade: 'Santos', uf: 'SP' },
      itens: [
        { item: { codigo: 'LIV', descricao: 'Livro', quantidade: '2.00', valor_unitario: '35' } },
      ],
      marcadores: [{ marcador: { descricao: 'Evento X', cor: 'ff0000' } }],
    })
    expect(d.situacao).toBe('aberto')
    expect(d.valor).toBe('70.00')
    expect(d.notaFiscalId).toBeNull()
    expect(d.clienteDados.cpfCnpj).toBe('12345678909')
    expect(d.clienteDados.endereco.uf).toBe('SP')
    expect(d.entrega?.nome).toBe('Maria')
    expect(d.itens).toEqual([
      { codigo: 'LIV', descricao: 'Livro', unidade: 'UN', quantidade: 2, valorUnitario: '35' },
    ])
    expect(d.marcadores).toEqual([{ descricao: 'Evento X', cor: 'ff0000' }])
  })

  it('endereço em uma linha sem pedaços vazios', () => {
    expect(
      enderecoEmUmaLinha({
        endereco: 'Rua A',
        numero: '10',
        complemento: '',
        bairro: 'Centro',
        cep: '01001000',
        cidade: 'São Paulo',
        uf: 'SP',
      }),
    ).toBe('Rua A, 10 · Centro · São Paulo/SP · 01001-000')
  })

  it('cor do marcador só se for hexadecimal', () => {
    expect(corDoMarcador('ff0000')).toBe('#ff0000')
    expect(corDoMarcador('vermelho')).toBeNull()
  })
})

describe('datas para o Tiny', () => {
  it('converte o campo de data e recusa o resto', () => {
    expect(dataParaOTiny('2026-10-22')).toBe('22/10/2026')
    expect(dataParaOTiny('22/10/2026')).toBeNull()
    expect(dataParaOTiny(undefined)).toBeNull()
  })
})

describe('estoque', () => {
  it('saldo, reservado e depósitos', () => {
    const e = lerEstoque({
      id: '11',
      nome: 'Livro',
      codigo: 'LIV',
      saldo: '42,00',
      saldoReservado: '5',
      depositos: [
        { deposito: { nome: 'Geral', desconsiderar: 'N', saldo: '40', empresa: 'AUVP' } },
        { deposito: { nome: 'Eventos', desconsiderar: 'S', saldo: '2' } },
      ],
    })
    expect(e.saldo).toBe(42)
    expect(e.disponivel).toBe(37)
    expect(e.depositos[1]).toEqual({
      nome: 'Eventos',
      empresa: null,
      saldo: 2,
      desconsiderado: true,
    })
  })

  it('foto do anexo ou da imagem externa, só com endereço web', () => {
    expect(imagemDoProduto({ anexos: [{ anexo: 'https://x/a.jpg' }] })).toBe('https://x/a.jpg')
    const externa = { imagens_externas: [{ imagem_externa: { url: 'https://x/b.png' } }] }
    expect(imagemDoProduto({ anexos: [], ...externa })).toBe('https://x/b.png')
    expect(imagemDoProduto({ anexos: [{ anexo: 'javascript:alert(1)' }] })).toBeNull()
  })
})
