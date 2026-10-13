import { describe, expect, it } from 'vitest'
import { Prisma, type FaseOperacional, type PrioridadeDemanda } from '@prisma/client'
import { lerPeriodo, fatiasDoPeriodo } from '@/lib/periodo'
import {
  compararNaTrilha,
  concluidaEmParaFase,
  contarRecorrentes,
  estavaAberta,
  estavaAtrasada,
  mostraPrevisaoDeInicio,
  oQueEstaSendoEnviado,
  proximaOcorrencia,
  SEM_DEPARTAMENTO,
  variacao,
  volumePorDepartamento,
  volumePorFatia,
} from './demandas'

const AGORA = new Date('2026-08-19T15:00:00Z')
const dia = (d: string) => new Date(`${d}T15:00:00Z`)

describe('oQueEstaSendoEnviado', () => {
  it('mais de um item vira "Kit", com a lista guardada para o detalhe', () => {
    expect(oQueEstaSendoEnviado(['Camiseta', 'Caneca'], 'AUVP Escola')).toEqual({
      rotulo: 'Kit',
      itens: ['Camiseta', 'Caneca'],
    })
  })

  it('um item é o próprio item', () => {
    expect(oQueEstaSendoEnviado(['Livro'], 'AUVP Escola').rotulo).toBe('Livro')
  })

  it('sem item, vale o produto; item em branco não conta', () => {
    expect(oQueEstaSendoEnviado(['  '], 'Consultoria').rotulo).toBe('Consultoria')
    expect(oQueEstaSendoEnviado([], null).rotulo).toBe('Não informado')
  })
})

describe('aberta e atrasada', () => {
  const base = {
    solicitadaEm: dia('2026-08-10'),
    previsaoConclusao: dia('2026-08-15'),
    concluidaEm: null,
  }

  it('passou da previsão sem concluir: atrasada', () => {
    expect(estavaAtrasada(base, AGORA)).toBe(true)
  })

  it('concluída não está atrasada, nem se terminou depois do prazo', () => {
    expect(estavaAtrasada({ ...base, concluidaEm: dia('2026-08-18') }, AGORA)).toBe(false)
  })

  it('sem previsão não conta como atrasada; a trilha aponta a falta à parte', () => {
    expect(estavaAtrasada({ ...base, previsaoConclusao: null }, AGORA)).toBe(false)
  })

  it('olhada no passado, conta como estava naquele instante', () => {
    const fimDaSemana32 = new Date('2026-08-10T03:00:00Z')
    const tarde = {
      ...base,
      solicitadaEm: dia('2026-08-03'),
      previsaoConclusao: dia('2026-08-05'),
      concluidaEm: dia('2026-08-12'),
    }
    expect(estavaAtrasada(tarde, fimDaSemana32)).toBe(true)
    expect(estavaAtrasada(tarde, AGORA)).toBe(false)
  })

  it('ainda não pedida não está aberta', () => {
    expect(estavaAberta({ ...base, solicitadaEm: dia('2026-08-25') }, AGORA)).toBe(false)
  })
})

describe('ordem da trilha', () => {
  type D = {
    id: string
    prioridade: PrioridadeDemanda
    fase: FaseOperacional
    solicitadaEm: Date
    previsaoConclusao: Date | null
    concluidaEm: Date | null
  }
  const d = (id: string, resto: Partial<D>): D => ({
    id,
    prioridade: 'normal',
    fase: 'em_execucao',
    solicitadaEm: dia('2026-08-10'),
    previsaoConclusao: dia('2026-08-25'),
    concluidaEm: null,
    ...resto,
  })

  it('prioritárias no topo, atrasadas antes, sem previsão no fim do grupo, concluídas no fim', () => {
    const lista = [
      d('concluida', { fase: 'concluido', concluidaEm: dia('2026-08-18') }),
      d('normal-sem-previsao', { previsaoConclusao: null }),
      d('normal-cedo', { previsaoConclusao: dia('2026-08-21') }),
      d('alta-em-dia', { prioridade: 'alta' }),
      d('alta-atrasada', { prioridade: 'alta', previsaoConclusao: dia('2026-08-12') }),
      d('urgente', { prioridade: 'urgente' }),
    ]
    expect(lista.sort(compararNaTrilha<D>(AGORA)).map((x) => x.id)).toEqual([
      'alta-atrasada',
      'urgente',
      'alta-em-dia',
      'normal-cedo',
      'normal-sem-previsao',
      'concluida',
    ])
  })
})

describe('volume por departamento', () => {
  const d = (departamento: string | null, custo: string | null, subsidiaria = 'Do Not Scare') => ({
    subsidiaria,
    departamento,
    custoEnvio: custo === null ? null : new Prisma.Decimal(custo),
  })

  it('conta, ordena do maior para o menor e soma 100%', () => {
    const linhas = volumePorDepartamento([
      d('Produto & CX', '10'),
      d('Produto & CX', '15.50'),
      d('Produto & CX', null),
      d('Consultoria', '30', 'AUVP Consultoria'),
    ])
    expect(linhas.map((l) => [l.departamento, l.quantidade])).toEqual([
      ['Produto & CX', 3],
      ['Consultoria', 1],
    ])
    expect(linhas.reduce((s, l) => s + l.percentual, 0)).toBeCloseTo(100)
  })

  it('soma o custo informado e conta à parte o que veio sem custo', () => {
    const [produto] = volumePorDepartamento([
      d('Produto & CX', '10'),
      d('Produto & CX', '15.50'),
      d('Produto & CX', null),
    ])
    expect(produto!.custo.toString()).toBe('25.5')
    expect(produto!.semCusto).toBe(1)
  })

  it('departamento vazio vai para um balde nomeado, não some', () => {
    const [linha] = volumePorDepartamento([
      { subsidiaria: null, departamento: '  ', custoEnvio: null },
    ])
    expect(linha!.departamento).toBe(SEM_DEPARTAMENTO)
    expect(linha!.custo.toString()).toBe('0')
  })

  it('sem demanda, sem linha', () => {
    expect(volumePorDepartamento([])).toEqual([])
  })
})

describe('data de conclusão acompanha a fase', () => {
  const ontem = new Date('2026-08-18T15:00:00Z')

  it('entrar em Concluído grava agora; já concluída, mantém a data original', () => {
    expect(concluidaEmParaFase('concluido', null, AGORA)).toEqual(AGORA)
    expect(concluidaEmParaFase('concluido', ontem, AGORA)).toEqual(ontem)
  })

  it('sair de Concluído apaga a data', () => {
    expect(concluidaEmParaFase('revisao', ontem, AGORA)).toBeNull()
  })
})

describe('próxima ocorrência de uma recorrente', () => {
  it('semanal anda sete dias nas duas previsões', () => {
    const p = proximaOcorrencia(
      {
        periodicidade: 'semanal',
        previsaoInicio: dia('2026-08-18'),
        previsaoConclusao: dia('2026-08-21'),
      },
      AGORA,
    )
    expect(p.previsaoInicio).toEqual(dia('2026-08-25'))
    expect(p.previsaoConclusao).toEqual(dia('2026-08-28'))
    expect(p.solicitadaEm).toEqual(AGORA)
  })

  it('concluída muito tarde, pula até a primeira previsão que ainda está por vir', () => {
    const p = proximaOcorrencia(
      { periodicidade: 'semanal', previsaoInicio: null, previsaoConclusao: dia('2026-08-01') },
      AGORA,
    )
    expect(p.previsaoConclusao).toEqual(dia('2026-08-22'))
    expect(p.previsaoInicio).toBeNull()
  })

  it('mensal anda pelo calendário: 31/01 vai a 28/02', () => {
    const p = proximaOcorrencia(
      { periodicidade: 'mensal', previsaoInicio: null, previsaoConclusao: dia('2027-01-31') },
      dia('2027-01-20'),
    )
    expect(p.previsaoConclusao).toEqual(dia('2027-02-28'))
  })

  it('quinzenal anda catorze dias', () => {
    const p = proximaOcorrencia(
      { periodicidade: 'quinzenal', previsaoInicio: null, previsaoConclusao: dia('2026-08-20') },
      AGORA,
    )
    expect(p.previsaoConclusao).toEqual(dia('2026-09-03'))
  })
})

describe('recorrentes e previsão de início', () => {
  it('separa recorrentes de pontuais', () => {
    expect(
      contarRecorrentes([{ recorrente: true }, { recorrente: false }, { recorrente: true }]),
    ).toEqual({
      recorrentes: 2,
      pontuais: 1,
    })
  })

  it('a previsão de início só aparece antes de a demanda começar', () => {
    expect(mostraPrevisaoDeInicio('recebido')).toBe(true)
    expect(mostraPrevisaoDeInicio('em_analise')).toBe(true)
    expect(mostraPrevisaoDeInicio('em_execucao')).toBe(false)
    expect(mostraPrevisaoDeInicio('concluido')).toBe(false)
  })
})

describe('volume por fatia', () => {
  it('cada demanda cai em exatamente uma semana', () => {
    const fatias = fatiasDoPeriodo(lerPeriodo({}, AGORA))
    const contagem = volumePorFatia(
      [
        { solicitadaEm: new Date('2026-08-17T03:00:00Z') }, // segunda 00:00, semana 34
        { solicitadaEm: new Date('2026-08-17T02:59:59Z') }, // domingo 23:59, semana 33
      ],
      fatias,
    )
    expect(contagem.at(-1)).toBe(1)
    expect(contagem.at(-2)).toBe(1)
  })
})

describe('variacao', () => {
  it('sem base não inventa percentual', () => {
    expect(variacao(5, 0)).toEqual({ diferenca: 5, percentual: null })
    expect(variacao(30, 20)).toEqual({ diferenca: 10, percentual: 50 })
  })
})
