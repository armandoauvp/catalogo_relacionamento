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
  intervaloDias: null,
  recorrenteAte: null,
  itens: ['Camiseta', 'Caneca'],
  envios: {
    total: 1250,
    noPeriodo: 500,
    ultimo: null,
    historico: [
      {
        id: 'e1',
        quantidade: 500,
        enviadoEm: new Date('2026-08-19T15:00:00Z'),
        custo: '1250.50',
        observacao: null,
        registradoPor: 'Ana',
        criadoEm: new Date('2026-08-19T15:00:00Z'),
        anuladoEm: null,
        anuladoPor: null,
      },
    ],
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

  it('a recorrência livre diz o intervalo, e a série diz até quando vai', () => {
    const [linha] = linhasDaTrilha([
      {
        ...demanda,
        periodicidade: 'personalizada',
        intervaloDias: 3,
        recorrenteAte: new Date('2026-12-20T02:59:59.999Z'),
      },
    ])
    expect(linha?.recorrencia).toBe('Recorrente · A cada 3 dias até 2026-12-19')
  })

  it('a coluna de observações só existe para quem pode lê-las', () => {
    const semObservacoes = gerarCsv(linhasDaTrilha([demanda]), colunasDaTrilha(false))
    const comObservacoes = gerarCsv(linhasDaTrilha([demanda]), colunasDaTrilha(true))
    expect(semObservacoes).not.toContain('Entregar na portaria')
    expect(comObservacoes).toContain('Entregar na portaria')
  })

  it('o custo não vai à planilha: desde 05/11 ele aparece só em percentual, no painel', () => {
    for (const verObservacoes of [false, true]) {
      const csv = gerarCsv(linhasDaTrilha([demanda]), colunasDaTrilha(verObservacoes))
      expect(csv).not.toMatch(/custo/i)
      expect(csv).not.toMatch(/1250[.,]5/)
    }
  })

  it('o nome do arquivo carrega o período, sem acento nem espaço', () => {
    expect(nomeDoArquivoDaTrilha('Semana 2026-34', 'xlsx')).toBe('demandas-semana-2026-34.xlsx')
    expect(nomeDoArquivoDaTrilha('Março de 2026', 'csv')).toBe('demandas-marco-de-2026.csv')
  })
})
