import { formatarISO } from '@/lib/datas'
import { paraNumero } from '@/lib/money'
import {
  ROTULO_COMPLEXIDADE,
  ROTULO_FASE,
  ROTULO_PERIODICIDADE,
  ROTULO_PRIORIDADE,
} from '@/lib/logistica/demandas'
import type { DemandaNaTrilha } from '@/lib/logistica/painel'
import type { ColunaExport } from './linhas'

/**
 * Exportação da trilha de demandas (relatório, item 4).
 *
 * Uma linha por demanda, nas mesmas colunas que a trilha mostra, e com o mesmo
 * recorte de período: quem exporta "a semana 34" recebe exatamente o que viu.
 * A coluna de observações só existe para quem pode lê-las na tela.
 */

const COLUNAS_BASE = [
  { chave: 'titulo', titulo: 'Demanda', largura: 40, tipo: 'texto' },
  { chave: 'fase', titulo: 'Fase', largura: 24, tipo: 'texto' },
  { chave: 'prioridade', titulo: 'Prioridade', largura: 12, tipo: 'texto' },
  { chave: 'atrasada', titulo: 'Atrasada', largura: 10, tipo: 'texto' },
  { chave: 'enviado', titulo: 'O que vai', largura: 28, tipo: 'texto' },
  { chave: 'itens', titulo: 'Itens', largura: 40, tipo: 'texto' },
  { chave: 'subsidiaria', titulo: 'Subsidiária', largura: 30, tipo: 'texto' },
  { chave: 'departamento', titulo: 'Departamento', largura: 22, tipo: 'texto' },
  { chave: 'produto', titulo: 'Produto', largura: 22, tipo: 'texto' },
  { chave: 'complexidade', titulo: 'Complexidade', largura: 13, tipo: 'texto' },
  { chave: 'origem', titulo: 'Origem', largura: 12, tipo: 'texto' },
  { chave: 'recorrencia', titulo: 'Recorrência', largura: 13, tipo: 'texto' },
  // `valor` no começo da chave é o que faz a planilha formatar em reais.
  { chave: 'valorCustoEnvio', titulo: 'Custo do envio', largura: 15, tipo: 'numero' },
  { chave: 'responsavel', titulo: 'Responsável', largura: 22, tipo: 'texto' },
  { chave: 'solicitadaEm', titulo: 'Solicitada em', largura: 14, tipo: 'data' },
  { chave: 'previsaoInicio', titulo: 'Previsão de início', largura: 16, tipo: 'data' },
  { chave: 'previsaoConclusao', titulo: 'Previsão de conclusão', largura: 18, tipo: 'data' },
  { chave: 'concluidaEm', titulo: 'Concluída em', largura: 14, tipo: 'data' },
  { chave: 'clickup', titulo: 'Link do ClickUp', largura: 40, tipo: 'texto' },
  { chave: 'formulario', titulo: 'Link do formulário', largura: 40, tipo: 'texto' },
] as const satisfies readonly ColunaExport[]

const COLUNA_OBSERVACOES = {
  chave: 'observacoes',
  titulo: 'Observações',
  largura: 48,
  tipo: 'texto',
} as const satisfies ColunaExport

export function colunasDaTrilha(verObservacoes: boolean): readonly ColunaExport[] {
  return verObservacoes ? [...COLUNAS_BASE, COLUNA_OBSERVACOES] : COLUNAS_BASE
}

type Chave = (typeof COLUNAS_BASE)[number]['chave'] | typeof COLUNA_OBSERVACOES.chave
export type LinhaDaTrilha = Record<Chave, string | number | null>

const ROTULO_ORIGEM = { manual: 'Manual', solicitacao: 'Presente', clickup: 'ClickUp' } as const

const data = (d: Date | null) => (d ? formatarISO(d) : null)

export function linhasDaTrilha(demandas: readonly DemandaNaTrilha[]): LinhaDaTrilha[] {
  return demandas.map((d) => ({
    titulo: d.titulo,
    fase: ROTULO_FASE[d.fase],
    prioridade: ROTULO_PRIORIDADE[d.prioridade],
    atrasada: d.atrasada ? 'Sim' : 'Não',
    enviado: d.enviado.rotulo,
    itens: d.enviado.itens.join(', ') || null,
    subsidiaria: d.subsidiaria,
    departamento: d.departamento,
    produto: d.produto,
    complexidade: d.complexidade ? ROTULO_COMPLEXIDADE[d.complexidade] : null,
    origem: ROTULO_ORIGEM[d.origem],
    recorrencia:
      d.recorrente && d.periodicidade ? ROTULO_PERIODICIDADE[d.periodicidade] : 'Pontual',
    valorCustoEnvio: d.custoEnvio === null ? null : paraNumero(d.custoEnvio),
    responsavel: d.responsavel,
    solicitadaEm: data(d.solicitadaEm),
    previsaoInicio: data(d.previsaoInicio),
    previsaoConclusao: data(d.previsaoConclusao),
    concluidaEm: data(d.concluidaEm),
    clickup: d.clickupUrl,
    formulario: d.linkFormulario,
    observacoes: d.observacoes,
  }))
}

/** `demandas-semana-2026-34.xlsx`: o período no nome, para não confundir arquivos. */
export function nomeDoArquivoDaTrilha(rotuloDoPeriodo: string, formato: 'csv' | 'xlsx'): string {
  const slug = rotuloDoPeriodo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `demandas-${slug}.${formato}`
}
