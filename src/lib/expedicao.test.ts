import { describe, expect, it } from 'vitest'
import { StatusSolicitacao } from '@prisma/client'
import { Prisma } from '@prisma/client'
import {
  skusDaChegada,
  chegouAgora,
  diasDesde,
  pendenciaDoEnvio,
  pecasASeparar,
  linhasDaExpedicao,
  COLUNAS_DA_EXPEDICAO,
  type PedidoDeExpedicao,
} from './expedicao'

function pedido(sobrescritas: Partial<PedidoDeExpedicao> = {}): PedidoDeExpedicao {
  return {
    id: 'p1',
    codigo: 'SOL-2026-0001',
    data: new Date('2026-03-10T12:00:00Z'),
    status: StatusSolicitacao.organizando_envio,
    consultor: 'Ana',
    cliente: 'Cliente Um',
    clienteCpf: '123.456.789-09',
    clienteTelefone: '(11) 98888-7777',
    destinatario: 'Cliente Um',
    cep: '01310-100',
    logradouro: 'Av. Paulista',
    numero: '1000',
    complemento: null,
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    uf: 'SP',
    enderecoCompleto: 'Av. Paulista, 1000 - Bela Vista - São Paulo/SP - CEP 01310-100',
    naExpedicaoDesde: new Date('2026-03-10T12:00:00Z'),
    teste: false,
    motivo: 'Aniversário',
    observacoes: null,
    carta: {
      saudacao: 'Olá, Cliente,',
      corpo: 'Feliz aniversário!',
      assinatura: 'Ana',
      ocasiao: 'Aniversário',
    },
    itens: [{ produto: 'Caneca', quantidade: 2, deCatalogo: true, jaEmEstoque: true }],
    valorTotal: new Prisma.Decimal('100.00'),
    rastreio: null,
    transportadora: null,
    ...sobrescritas,
  }
}

describe('peças a separar', () => {
  it('soma as quantidades, e não os pedidos', () => {
    const fila = [
      pedido({
        itens: [
          { produto: 'Caneca', quantidade: 2, deCatalogo: true, jaEmEstoque: true },
          { produto: 'Vinho', quantidade: 1, deCatalogo: false, jaEmEstoque: false },
        ],
      }),
      pedido({ id: 'p2' }),
    ]

    expect(pecasASeparar(fila)).toBe(5)
  })

  it('fila vazia não quebra a conta', () => {
    expect(pecasASeparar([])).toBe(0)
  })
})

describe('linhas da planilha de expedição', () => {
  it('gera uma linha por item, não por pedido', () => {
    const linhas = linhasDaExpedicao([
      pedido({
        itens: [
          { produto: 'Caneca', quantidade: 2, deCatalogo: true, jaEmEstoque: true },
          { produto: 'Vinho', quantidade: 1, deCatalogo: false, jaEmEstoque: false },
        ],
      }),
    ])

    expect(linhas).toHaveLength(2)
    expect(linhas.map((l) => l.produto)).toEqual(['Caneca', 'Vinho'])
  })

  it('marca a origem do item: da prateleira ou de uma compra', () => {
    const linhas = linhasDaExpedicao([
      pedido({
        itens: [
          { produto: 'Caneca', quantidade: 1, deCatalogo: true, jaEmEstoque: true },
          { produto: 'Vinho', quantidade: 1, deCatalogo: false, jaEmEstoque: false },
        ],
      }),
    ])

    expect(linhas.map((l) => l.origem)).toEqual(['Estoque', 'Compra'])
  })

  it('repete o endereço em cada linha, quem separa lê item a item', () => {
    const linhas = linhasDaExpedicao([
      pedido({
        itens: [
          { produto: 'Caneca', quantidade: 1, deCatalogo: true, jaEmEstoque: true },
          { produto: 'Vinho', quantidade: 1, deCatalogo: false, jaEmEstoque: false },
        ],
      }),
    ])

    expect(linhas.every((l) => l.cep === '01310-100' && l.cidade === 'São Paulo')).toBe(true)
  })

  it('a carta vai uma vez por pedido, na linha do primeiro item', () => {
    const [primeira, segunda] = linhasDaExpedicao([
      pedido({
        itens: [
          { produto: 'Caneca', quantidade: 1, deCatalogo: true, jaEmEstoque: true },
          { produto: 'Vinho', quantidade: 1, deCatalogo: true, jaEmEstoque: false },
        ],
      }),
    ])
    expect(primeira!.carta).toBe('Olá, Cliente,\n\nFeliz aniversário!\n\nAna')
    expect(segunda!.carta).toBeNull()
  })

  it('preenche exatamente as colunas declaradas, sem sobra nem falta', () => {
    const [linha] = linhasDaExpedicao([pedido()])
    expect(Object.keys(linha!).sort()).toEqual(COLUNAS_DA_EXPEDICAO.map((c) => c.chave).sort())
  })
})

describe('pendenciaDoEnvio', () => {
  const agora = new Date('2026-03-13T15:00:00Z')

  it('com rastreio não há pendência', () => {
    expect(pendenciaDoEnvio(pedido({ rastreio: 'AP1BR' }), null, agora)).toBeNull()
  })

  it('pedido que não foi ao Tiny aparece como erro', () => {
    expect(pendenciaDoEnvio(pedido(), { envio: 'falhou', situacao: null }, agora)?.tom).toBe(
      'error',
    )
  })

  it('pronto para envio sem rastreio diz o que falta e há quanto tempo', () => {
    expect(
      pendenciaDoEnvio(pedido(), { envio: 'enviado', situacao: 'pronto_envio' }, agora)?.texto,
    ).toBe('Pronto para envio há 3 dias: falta postar e registrar o rastreio.')
  })

  it('cobra o rastreio só depois de dois dias na expedição', () => {
    const recente = pedido({ naExpedicaoDesde: new Date('2026-03-12T15:00:00Z') })
    expect(pendenciaDoEnvio(recente, { envio: 'enviado', situacao: 'aberto' }, agora)).toBeNull()
    expect(pendenciaDoEnvio(pedido(), { envio: 'enviado', situacao: 'aberto' }, agora)?.texto).toBe(
      'Na expedição há 3 dias, ainda sem rastreio.',
    )
  })
})

describe('o que acabou de ficar pronto', () => {
  const agora = new Date('2026-11-18T15:00:00Z')
  const pronto = (horas: number, rastreio: string | null = null) => ({
    status: StatusSolicitacao.organizando_envio,
    rastreio,
    naExpedicaoDesde: new Date(agora.getTime() - horas * 3_600_000),
  })

  it('é novo nas primeiras 24 horas, até ganhar rastreio', () => {
    expect(chegouAgora(pronto(1), agora)).toBe(true)
    expect(chegouAgora(pronto(23), agora)).toBe(true)
    expect(chegouAgora(pronto(25), agora)).toBe(false)
    expect(chegouAgora(pronto(1, 'AA123456789BR'), agora)).toBe(false)
  })

  it('só o que está na expedição conta como novo', () => {
    expect(chegouAgora({ ...pronto(1), status: StatusSolicitacao.comprado }, agora)).toBe(false)
    expect(chegouAgora({ ...pronto(1), status: StatusSolicitacao.entregue }, agora)).toBe(false)
  })

  it('conta os dias inteiros desde a compra', () => {
    expect(diasDesde(new Date(agora.getTime() - 3_600_000), agora)).toBe(0)
    expect(diasDesde(new Date(agora.getTime() - 50 * 3_600_000), agora)).toBe(2)
    expect(diasDesde(new Date(agora.getTime() + 3_600_000), agora)).toBe(0)
  })
})

describe('skusDaChegada', () => {
  const catalogo = {
    id: 'c',
    produto: 'Vinho Alma Negra',
    externo: false,
    sku: 'AUVP-BEBIDAS-VINHO',
  }
  const externo = { id: 'e', produto: 'Luminária de mesa', externo: true, sku: null }

  it('o item de fora do catálogo leva o SKU que a Logística informa', () => {
    expect(skusDaChegada([catalogo, externo], { e: ' LUM-01 ' })).toEqual({
      ok: true,
      skus: [
        { itemId: 'c', sku: 'AUVP-BEBIDAS-VINHO', externo: false },
        { itemId: 'e', sku: 'LUM-01', externo: true },
      ],
    })
  })

  it('sem o SKU do item de fora, a chegada não anda e diz qual falta', () => {
    const r = skusDaChegada([catalogo, externo], { e: '  ' })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.erro).toContain('Luminária de mesa')
  })

  it('aproveita o SKU informado numa chegada anterior', () => {
    expect(skusDaChegada([{ ...externo, sku: 'LUM-01' }], {}).ok).toBe(true)
  })

  it('produto do catálogo sem SKU também segura a chegada', () => {
    const r = skusDaChegada([{ ...catalogo, sku: null }], {})
    expect(!r.ok && r.erro).toContain('Administração → Produtos')
  })

  it('o SKU digitado não vale para item do catálogo', () => {
    const r = skusDaChegada([catalogo], { c: 'OUTRO' })
    expect(r.ok && r.skus[0]!.sku).toBe('AUVP-BEBIDAS-VINHO')
  })
})
