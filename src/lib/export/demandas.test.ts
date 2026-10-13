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
  mostrarInicio: false,
  concluidaEm: null,
  custoEnvio: '42.90',
  recorrente: true,
  periodicidade: 'semanal',
  itens: ['Camiseta', 'Caneca'],
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
      recorrencia: 'Semanal',
      valorCustoEnvio: 42.9,
    })
  })

  it('a coluna de observações só existe para quem pode lê-las', () => {
    const semObservacoes = gerarCsv(linhasDaTrilha([demanda]), colunasDaTrilha(false))
    const comObservacoes = gerarCsv(linhasDaTrilha([demanda]), colunasDaTrilha(true))
    expect(semObservacoes).not.toContain('Entregar na portaria')
    expect(comObservacoes).toContain('Entregar na portaria')
  })

  it('o nome do arquivo carrega o período, sem acento nem espaço', () => {
    expect(nomeDoArquivoDaTrilha('Semana 2026-34', 'xlsx')).toBe('demandas-semana-2026-34.xlsx')
    expect(nomeDoArquivoDaTrilha('Março de 2026', 'csv')).toBe('demandas-marco-de-2026.csv')
  })
})
