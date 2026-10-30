import type {
  ComplexidadeDemanda,
  FaseOperacional,
  OrigemDemanda,
  Periodicidade,
  PrioridadeDemanda,
  Prisma,
} from '@prisma/client'
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
  compararPorOrdem,
  ehPrioritaria,
  estavaAtrasada,
  contarRecorrentes,
  oQueEstaSendoEnviado,
  somaDosEnvios,
  ultimoEnvio,
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
import { whereDoRecorte, type FiltroDaTrilha } from './filtro-da-trilha'

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
  concluidaEm: Date | null
  recorrente: boolean
  periodicidade: Periodicidade | null
  itens: string[]
  /** O que a Logística lançou de despachado nesta demanda (relatório de 29/10). */
  envios: {
    total: number
    noPeriodo: number
    ultimo: Date | null
    /** Do mais recente ao mais antigo, anulados inclusive. */
    historico: LancamentoDeEnvio[]
  }
}

export type LancamentoDeEnvio = {
  id: string
  quantidade: number
  enviadoEm: Date
  observacao: string | null
  registradoPor: string
  criadoEm: Date
  anuladoEm: Date | null
  anuladoPor: string | null
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
  opcoes: {
    verObservacoes: boolean
    agora?: Date
    limite?: number
    /** O clique nos grupos da linha; só a trilha e a exportação o respeitam. */
    recorte?: FiltroDaTrilha
  },
): Promise<{ demandas: DemandaNaTrilha[]; total: number }> {
  const agora = opcoes.agora ?? new Date()
  const linhas = await db.demandaLogistica.findMany({
    where: { AND: [whereDaTrilha(periodo), whereDoRecorte(opcoes.recorte ?? {})] },
    include: {
      envios: {
        orderBy: [{ enviadoEm: 'desc' }, { criadoEm: 'desc' }],
        include: {
          registrante: { select: { nome: true } },
          anulador: { select: { nome: true } },
        },
      },
    },
  })

  const ordenadas = linhas.sort(compararPorOrdem(opcoes.recorte?.ordem ?? 'prioridade', agora))
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
      concluidaEm: d.concluidaEm,
      recorrente: d.recorrente,
      periodicidade: d.periodicidade,
      itens: d.itens,
      envios: {
        total: somaDosEnvios(d.envios),
        noPeriodo: somaDosEnvios(d.envios, periodo),
        ultimo: ultimoEnvio(d.envios),
        historico: d.envios.map((e) => ({
          id: e.id,
          quantidade: e.quantidade,
          enviadoEm: e.enviadoEm,
          observacao: e.observacao,
          registradoPor: e.registrante.nome,
          criadoEm: e.criadoEm,
          anuladoEm: e.anuladoEm,
          anuladoPor: e.anulador?.nome ?? null,
        })),
      },
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
  }
  /**
   * Itens despachados no período, pela data de cada lançamento: é o
   * fechamento do mês que a gestão pediu, por subsidiária e departamento.
   */
  despachados: {
    total: number
    porDepartamento: LinhaDeVolume[]
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

  const [doPeriodo, totalAnterior, daEvolucao, trilha, status, enviosDoPeriodo] = await Promise.all(
    [
      db.demandaLogistica.findMany({
        where: { ...ATIVAS, solicitadaEm: { gte: periodo.inicio, lt: periodo.fim } },
        select: { subsidiaria: true, departamento: true, recorrente: true },
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
      // O envio conta no período em que saiu, mesmo de demanda pedida antes.
      db.envioDaDemanda.findMany({
        where: {
          anuladoEm: null,
          enviadoEm: { gte: periodo.inicio, lt: periodo.fim },
          demanda: ATIVAS,
        },
        select: {
          quantidade: true,
          demanda: { select: { subsidiaria: true, departamento: true } },
        },
      }),
    ],
  )

  const contagens = volumePorFatia(daEvolucao, fatias)

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
    },
    despachados: {
      total: enviosDoPeriodo.reduce((soma, e) => soma + e.quantidade, 0),
      porDepartamento: volumePorDepartamento(
        enviosDoPeriodo.map((e) => ({ ...e.demanda, quantidade: e.quantidade })),
      ),
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
