import { describe, expect, it } from 'vitest'
import type { DemandaNaTrilha } from '@/lib/logistica/painel'
import { colunasDaTrilha, linhasDaTrilha, nomeDoArquivoDaTrilha } from './demandas'
import { gerarCsv } from './csv'

const demanda: DemandaNaTrilha = {
  id: 'd1',
  origem: 'manual',
  titulo: 'Kit boas-vindas turma 12',
  clickupUrl: 'https://app.clickup.com/t/abc',
  linkFormulario: null,
  fase: 'em_execucao',
  prioridade: 'alta',
  prioritaria: true,
  complexidade: 'media',
  atrasada: false,
  enviado: { rotulo: 'Kit', itens: ['Camiseta', 'Caneca'] },
  subsidiaria: 'Do Not Scare Soluções Interativas LTDA',
  departamento: 'Produto & CX',
  produto: 'AUVP Escola',
  responsavel: 'Ana',
  observacoes: 'Entregar na portaria',
  solicitadaEm: new Date('2026-08-17T15:00:00Z'),
  previsaoInicio: null,
  previsaoConclusao: new Date('2026-08-21T15:00:00Z'),
  concluidaEm: null,
  recorrente: true,
  periodicidade: 'semanal',
  itens: ['Camiseta', 'Caneca'],
  envios: {
    total: 1250,
    noPeriodo: 500,
    ultimo: null,
    historico: [],
    custo: { total: '3100.75', noPeriodo: '1250.50' },
  },
}

describe('exportação da trilha', () => {
  it('leva os rótulos legíveis, a lista do kit e as datas em ISO', () => {
    const [linha] = linhasDaTrilha([demanda])
    expect(linha).toMatchObject({
      fase: 'Em execução',
      prioridade: 'Alta',
      enviado: 'Kit',
      itens: 'Camiseta, Caneca',
      previsaoConclusao: '2026-08-21',
      previsaoInicio: null,
      origem: 'Manual',
      recorrencia: 'Recorrente · Semanal',
      despachadosNoPeriodo: 500,
      despachadosNoTotal: 1250,
    })
  })

  it('a coluna de observações só existe para quem pode lê-las', () => {
    const semObservacoes = gerarCsv(linhasDaTrilha([demanda]), colunasDaTrilha(false, false))
    const comObservacoes = gerarCsv(linhasDaTrilha([demanda]), colunasDaTrilha(true, false))
    expect(semObservacoes).not.toContain('Entregar na portaria')
    expect(comObservacoes).toContain('Entregar na portaria')
  })

  it('as colunas de custo só existem para quem pode vê-las', () => {
    const chaves = (verCustos: boolean) => colunasDaTrilha(false, verCustos).map((c) => c.chave)
    expect(chaves(false)).not.toContain('custoNoPeriodo')
    expect(chaves(true)).toEqual(expect.arrayContaining(['custoNoPeriodo', 'custoNoTotal']))
    expect(gerarCsv(linhasDaTrilha([demanda]), colunasDaTrilha(false, false))).not.toContain(
      'Custo no',
    )
  })

  it('o custo vai como número, para a planilha somar', () => {
    const [linha] = linhasDaTrilha([demanda])
    expect(linha).toMatchObject({ custoNoPeriodo: 1250.5, custoNoTotal: 3100.75 })
  })

  it('sem permissão, o custo não vem da trilha e a linha fica vazia', () => {
    const [linha] = linhasDaTrilha([{ ...demanda, envios: { ...demanda.envios, custo: null } }])
    expect(linha).toMatchObject({ custoNoPeriodo: null, custoNoTotal: null })
  })

  it('o nome do arquivo carrega o período, sem acento nem espaço', () => {
    expect(nomeDoArquivoDaTrilha('Semana 2026-34', 'xlsx')).toBe('demandas-semana-2026-34.xlsx')
    expect(nomeDoArquivoDaTrilha('Março de 2026', 'csv')).toBe('demandas-marco-de-2026.csv')
  })
})
