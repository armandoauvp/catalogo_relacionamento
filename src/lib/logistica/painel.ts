import type {
  ComplexidadeDemanda,
  FaseOperacional,
  OrigemDemanda,
  Periodicidade,
  PrioridadeDemanda,
  Prisma,
} from '@prisma/client'
import { somar, ZERO, type Dinheiro } from '@/lib/money'
import { db } from '@/lib/db'
import {
  fatiasDoPeriodo,
  intervaloDaSemana,
  lerPeriodo,
  rotuloDaSemana,
  semanaIso,
  type Periodo,
  type SemanaIso,
} from '@/lib/periodo'
import {
  compararNaTrilha,
  ehPrioritaria,
  estavaAtrasada,
  contarRecorrentes,
  mostraPrevisaoDeInicio,
  oQueEstaSendoEnviado,
  variacao,
  volumePorDepartamento,
  volumePorFatia,
  type LinhaDeVolume,
} from './demandas'
import {
  LIMIARES,
  statusDaSemana,
  sugerirSituacao,
  type StatusDaSemana,
} from './status-operacional'

/**
 * Leitura do banco para o Dashboard Logístico.
 *
 * As regras moram em `demandas.ts` e `status-operacional.ts`, puras e
 * testadas; aqui só se busca o que elas precisam. O mesmo `trilhaDoPeriodo`
 * serve a tela e a exportação, para a planilha nunca divergir do que se vê.
 */

/**
 * Teto da trilha na tela. Um ano inteiro passa de centenas de demandas, e
 * ninguém lê isso rolando; a exportação leva todas.
 */
export const LIMITE_DA_TRILHA_NA_TELA = 200

/** Arquivada some do painel inteiro: números, gráficos, trilha e planilha. */
const ATIVAS = { ativa: true } satisfies Prisma.DemandaLogisticaWhereInput

export type DemandaNaTrilha = {
  id: string
  origem: OrigemDemanda
  titulo: string
  clickupUrl: string | null
  linkFormulario: string | null
  fase: FaseOperacional
  prioridade: PrioridadeDemanda
  prioritaria: boolean
  complexidade: ComplexidadeDemanda | null
  atrasada: boolean
  enviado: { rotulo: string; itens: string[] }
  subsidiaria: string | null
  departamento: string | null
  produto: string | null
  responsavel: string | null
  /** Nulo também quando quem lê não pode ver observações. */
  observacoes: string | null
  solicitadaEm: Date
  previsaoInicio: Date | null
  previsaoConclusao: Date | null
  /** Só antes de a demanda começar; depois, a data que vale é a de finalização. */
  mostrarInicio: boolean
  concluidaEm: Date | null
  /** Texto decimal ("12.50"): `Decimal` não atravessa para o formulário. */
  custoEnvio: string | null
  recorrente: boolean
  periodicidade: Periodicidade | null
  itens: string[]
}

/**
 * As demandas que estiveram em andamento em algum momento do período: pedidas
 * antes do fim e não concluídas antes do início. É o que a Logística chama de
 * "a trilha da semana", e inclui o que vem de semanas anteriores ainda aberto.
 */
export function whereDaTrilha(periodo: Periodo): Prisma.DemandaLogisticaWhereInput {
  return {
    ...ATIVAS,
    solicitadaEm: { lt: periodo.fim },
    OR: [{ concluidaEm: null }, { concluidaEm: { gte: periodo.inicio } }],
  }
}

export async function trilhaDoPeriodo(
  periodo: Periodo,
  opcoes: { verObservacoes: boolean; agora?: Date; limite?: number },
): Promise<{ demandas: DemandaNaTrilha[]; total: number }> {
  const agora = opcoes.agora ?? new Date()
  const linhas = await db.demandaLogistica.findMany({ where: whereDaTrilha(periodo) })

  const ordenadas = linhas.sort(compararNaTrilha(agora))
  const visiveis = opcoes.limite ? ordenadas.slice(0, opcoes.limite) : ordenadas

  return {
    total: linhas.length,
    demandas: visiveis.map((d) => ({
      id: d.id,
      origem: d.origem,
      titulo: d.titulo,
      clickupUrl: d.clickupUrl,
      linkFormulario: d.linkFormulario,
      fase: d.fase,
      prioridade: d.prioridade,
      prioritaria: ehPrioritaria(d.prioridade),
      complexidade: d.complexidade,
      atrasada: estavaAtrasada(d, agora),
      enviado: oQueEstaSendoEnviado(d.itens, d.produto),
      subsidiaria: d.subsidiaria,
      departamento: d.departamento,
      produto: d.produto,
      responsavel: d.responsavel,
      // Filtrado aqui, no servidor: o que não pode ser lido não chega ao navegador.
      observacoes: opcoes.verObservacoes ? d.observacoes : null,
      solicitadaEm: d.solicitadaEm,
      previsaoInicio: d.previsaoInicio,
      previsaoConclusao: d.previsaoConclusao,
      mostrarInicio: mostraPrevisaoDeInicio(d.fase) && d.previsaoInicio !== null,
      concluidaEm: d.concluidaEm,
      custoEnvio: d.custoEnvio?.toString() ?? null,
      recorrente: d.recorrente,
      periodicidade: d.periodicidade,
      itens: d.itens,
    })),
  }
}

/**
 * A semana cujo status o painel mostra: a própria, num filtro semanal; nos
 * outros, a semana atual. Status é semanal por definição da proposta, e um
 * "status do ano" não teria leitura.
 */
export function semanaDeReferencia(periodo: Periodo, agora: Date): SemanaIso {
  return semanaIso(periodo.tipo === 'semana' ? periodo.inicio : agora)
}

async function statusDe(semana: SemanaIso, agora: Date): Promise<StatusDaSemana> {
  const { inicio, fim } = intervaloDaSemana(semana)
  // Semana em curso conta até agora; semana passada, até o seu fim.
  const instante = fim < agora ? fim : agora
  const inicioDaMedia = intervaloDaSemana(
    semanaIso(new Date(inicio.getTime() - LIMIARES.semanasNaMedia * 7 * 86_400_000)),
  ).inicio

  const abertasNoInstante: Prisma.DemandaLogisticaWhereInput = {
    ...ATIVAS,
    solicitadaEm: { lt: instante },
    OR: [{ concluidaEm: null }, { concluidaEm: { gt: instante } }],
  }

  const [volume, anteriores, abertas, atrasadas, manual] = await Promise.all([
    db.demandaLogistica.count({ where: { ...ATIVAS, solicitadaEm: { gte: inicio, lt: fim } } }),
    db.demandaLogistica.count({
      where: { ...ATIVAS, solicitadaEm: { gte: inicioDaMedia, lt: inicio } },
    }),
    db.demandaLogistica.count({ where: abertasNoInstante }),
    db.demandaLogistica.count({
      where: { AND: [abertasNoInstante, { previsaoConclusao: { lt: instante } }] },
    }),
    db.statusOperacionalSemana.findUnique({
      where: { ano_semana: { ano: semana.ano, semana: semana.semana } },
      include: { definidoPor: { select: { nome: true } } },
    }),
  ])

  const sugestao = sugerirSituacao({
    volume,
    mediaAnterior: anteriores / LIMIARES.semanasNaMedia,
    abertas,
    atrasadas,
  })

  return statusDaSemana(
    manual
      ? {
          situacao: manual.situacao,
          observacao: manual.observacao,
          definidoPor: manual.definidoPor?.nome ?? null,
          definidoEm: manual.definidoEm,
        }
      : null,
    sugestao,
  )
}

export type PainelLogistico = {
  status: {
    semana: SemanaIso
    rotulo: string
    ehSemanaAtual: boolean
    atual: StatusDaSemana
  }
  volume: {
    total: number
    anterior: number
    variacao: { diferenca: number; percentual: number | null }
    porDepartamento: LinhaDeVolume[]
    recorrentes: number
    pontuais: number
    custo: Dinheiro
    /** Demandas do período sem custo informado: o total de custo não as inclui. */
    semCusto: number
  }
  evolucao: { rotulo: string; rotuloLongo: string; quantidade: number }[]
  trilha: { demandas: DemandaNaTrilha[]; total: number }
}

export async function painelLogistico(
  periodo: Periodo,
  opcoes: { verObservacoes: boolean; agora?: Date },
): Promise<PainelLogistico> {
  const agora = opcoes.agora ?? new Date()
  const anterior = lerPeriodo(periodo.anterior, agora)
  const fatias = fatiasDoPeriodo(periodo)
  const semana = semanaDeReferencia(periodo, agora)

  const [doPeriodo, totalAnterior, daEvolucao, trilha, status] = await Promise.all([
    db.demandaLogistica.findMany({
      where: { ...ATIVAS, solicitadaEm: { gte: periodo.inicio, lt: periodo.fim } },
      select: { subsidiaria: true, departamento: true, custoEnvio: true, recorrente: true },
    }),
    db.demandaLogistica.count({
      where: { ...ATIVAS, solicitadaEm: { gte: anterior.inicio, lt: anterior.fim } },
    }),
    db.demandaLogistica.findMany({
      where: { ...ATIVAS, solicitadaEm: { gte: fatias[0]!.inicio, lt: fatias.at(-1)!.fim } },
      select: { solicitadaEm: true },
    }),
    trilhaDoPeriodo(periodo, { ...opcoes, agora, limite: LIMITE_DA_TRILHA_NA_TELA }),
    statusDe(semana, agora),
  ])

  const contagens = volumePorFatia(daEvolucao, fatias)
  const custos = doPeriodo.flatMap((d) => (d.custoEnvio === null ? [] : [d.custoEnvio]))

  return {
    status: {
      semana,
      rotulo: rotuloDaSemana(semana),
      ehSemanaAtual: rotuloDaSemana(semana) === rotuloDaSemana(semanaIso(agora)),
      atual: status,
    },
    volume: {
      total: doPeriodo.length,
      anterior: totalAnterior,
      variacao: variacao(doPeriodo.length, totalAnterior),
      porDepartamento: volumePorDepartamento(doPeriodo),
      ...contarRecorrentes(doPeriodo),
      custo: custos.length ? somar(custos) : ZERO,
      semCusto: doPeriodo.length - custos.length,
    },
    evolucao: fatias.map((f, i) => ({
      rotulo: f.rotulo,
      rotuloLongo: f.rotuloLongo,
      quantidade: contagens[i]!,
    })),
    trilha,
  }
}

/**
 * Os valores já usados em cada campo de texto da demanda, para o cadastro
 * sugerir e a mesma subsidiária não aparecer com três grafias no gráfico.
 */
export async function sugestoesDoCadastro(): Promise<{
  subsidiarias: string[]
  departamentos: string[]
  produtos: string[]
  responsaveis: string[]
}> {
  const linhas = await db.demandaLogistica.findMany({
    where: ATIVAS,
    select: { subsidiaria: true, departamento: true, produto: true, responsavel: true },
    distinct: ['subsidiaria', 'departamento', 'produto', 'responsavel'],
  })
  const unicos = (valores: (string | null)[]) =>
    [...new Set(valores.filter((v): v is string => Boolean(v?.trim())))].sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    )
  return {
    subsidiarias: unicos(linhas.map((l) => l.subsidiaria)),
    departamentos: unicos(linhas.map((l) => l.departamento)),
    produtos: unicos(linhas.map((l) => l.produto)),
    responsaveis: unicos(linhas.map((l) => l.responsavel)),
  }
}
