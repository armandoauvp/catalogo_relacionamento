import { describe, expect, it } from 'vitest'
import {
  dataDosCorreios,
  ehCodigoDosCorreios,
  ehEntrega,
  entregueEm,
  lerResposta,
  maisNovosPrimeiro,
  normalizarCodigo,
} from './leitura'

const resposta = {
  objetos: [
    {
      codObjeto: 'YO110166166BR',
      eventos: [
        {
          codigo: 'BDE',
          tipo: '01',
          dtHrCriado: '2026-10-28T12:51:35',
          descricao: 'Objeto entregue ao destinatário',
          unidade: {
            tipo: 'Unidade de Distribuição',
            endereco: { cidade: 'NOVA IGUACU', uf: 'RJ' },
          },
        },
        {
          codigo: 'RO',
          tipo: '01',
          dtHrCriado: '2026-10-25T08:00:00',
          descricao: 'Objeto em transferência - por favor aguarde',
          unidade: { tipo: 'Unidade de Tratamento', endereco: { cidade: 'GOIANIA', uf: 'GO' } },
          unidadeDestino: {
            tipo: 'Unidade de Tratamento',
            endereco: { cidade: 'RIO DE JANEIRO', uf: 'RJ' },
          },
        },
        {
          codigo: 'PO',
          tipo: '01',
          dtHrCriado: '2026-10-22T09:29:52',
          descricao: 'Objeto postado',
        },
        { codigo: 'XX', tipo: '01', descricao: 'sem data, descartado' },
      ],
    },
    {
      codObjeto: 'AA000000000BR',
      mensagem: 'SRO-020: Objeto não encontrado na base de dados dos Correios.',
    },
  ],
}

describe('leitura da API Rastro', () => {
  it('lê os eventos com data de Brasília, local e destino', () => {
    const [obj] = lerResposta(resposta)
    expect(obj!.codigo).toBe('YO110166166BR')
    expect(obj!.erro).toBeNull()
    expect(obj!.eventos).toHaveLength(3)
    expect(obj!.eventos[0]).toMatchObject({
      codigo: 'BDE',
      descricao: 'Objeto entregue ao destinatário',
      local: 'Unidade de Distribuição - NOVA IGUACU - RJ',
      destino: null,
    })
    expect(obj!.eventos[0]!.ocorridoEm.toISOString()).toBe('2026-10-28T15:51:35.000Z')
    expect(obj!.eventos[1]!.destino).toBe('Unidade de Tratamento - RIO DE JANEIRO - RJ')
    expect(obj!.eventos[2]!.local).toBeNull()
  })

  it('objeto não encontrado é erro do objeto, com a mensagem dos Correios', () => {
    const [, nao] = lerResposta(resposta)
    expect(nao).toEqual({
      codigo: 'AA000000000BR',
      eventos: [],
      erro: 'SRO-020: Objeto não encontrado na base de dados dos Correios.',
    })
  })

  it('resposta fora do formato não derruba nada', () => {
    expect(lerResposta(null)).toEqual([])
    expect(lerResposta({ objetos: [{}] })).toEqual([{ codigo: '', eventos: [], erro: null }])
  })

  it('entrega pelo código ou pela descrição; o mais recente vale', () => {
    const [obj] = lerResposta(resposta)
    expect(entregueEm(obj!.eventos)?.toISOString()).toBe('2026-10-28T15:51:35.000Z')
    expect(ehEntrega({ codigo: 'BDI', tipo: '23', descricao: 'x' })).toBe(true)
    expect(ehEntrega({ codigo: 'BDE', tipo: '20', descricao: 'Carteiro não atendido' })).toBe(false)
    expect(entregueEm(obj!.eventos.slice(1))).toBeNull()
  })

  it('data com fuso respeita o fuso; inválida vira nulo', () => {
    expect(dataDosCorreios('2026-10-28T12:51:35Z')?.toISOString()).toBe('2026-10-28T12:51:35.000Z')
    expect(dataDosCorreios('ontem')).toBeNull()
    expect(dataDosCorreios(undefined)).toBeNull()
  })

  it('só código dos Correios é consultado, com espaço e caixa corrigidos', () => {
    expect(normalizarCodigo(' yo110166166br ')).toBe('YO110166166BR')
    expect(ehCodigoDosCorreios('yo 110166166 br')).toBe(true)
    expect(ehCodigoDosCorreios('TOTAL123456')).toBe(false)
    expect(ehCodigoDosCorreios(null)).toBe(false)
  })

  it('a linha do tempo vem do mais novo para o mais antigo', () => {
    const d = (h: number) => ({ ocorridoEm: new Date(Date.UTC(2026, 9, 1, h)) })
    expect(maisNovosPrimeiro([d(1), d(3), d(2)]).map((e) => e.ocorridoEm.getUTCHours())).toEqual([
      3, 2, 1,
    ])
  })
})
