import type {
  ComplexidadeDemanda,
  FaseOperacional,
  Periodicidade,
  PrioridadeDemanda,
  Prisma,
} from '@prisma/client'
import { somar, ZERO, type Dinheiro } from '@/lib/money'
import type { Fatia } from '@/lib/periodo'

/**
 * Regras das demandas da Logística: o que a trilha mostra, em que ordem, e
 * como o painel soma.
 *
 * Tudo aqui é função pura sobre os campos da demanda, para que a tela, a
 * exportação e os testes contem do mesmo jeito.
 */

/** As fases da proposta, na ordem em que a demanda anda. */
export const FASES: readonly FaseOperacional[] = [
  'recebido',
  'em_analise',
  'aguardando_documentacao',
  'aguardando_suprimentos',
  'em_execucao',
  'revisao',
  'finalizacao',
  'concluido',
]

export const ROTULO_FASE: Record<FaseOperacional, string> = {
  recebido: 'Recebido',
  em_analise: 'Em análise',
  aguardando_documentacao: 'Aguardando documentação',
  aguardando_suprimentos: 'Aguardando suprimentos',
  em_execucao: 'Em execução',
  revisao: 'Revisão',
  finalizacao: 'Finalização',
  concluido: 'Concluído',
}

export const ROTULO_PRIORIDADE: Record<PrioridadeDemanda, string> = {
  urgente: 'Urgente',
  alta: 'Alta',
  normal: 'Normal',
  baixa: 'Baixa',
}

export const ROTULO_COMPLEXIDADE: Record<ComplexidadeDemanda, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
}

/**
 * A esteira prioritária, agora dentro da trilha (relatório, item 4): o que é
 * urgente ou alta prioridade sobe para o topo e ganha destaque.
 */
export function ehPrioritaria(prioridade: PrioridadeDemanda): boolean {
  return prioridade === 'urgente' || prioridade === 'alta'
}

/**
 * O que está sendo enviado.
 *
 * Regra da área: com mais de um item, a trilha diz "Kit" e a lista completa
 * vai para o detalhe. Sem item informado, vale o produto, que é o que o
 * ClickUp sempre traz.
 */
export function oQueEstaSendoEnviado(
  itens: readonly string[],
  produto: string | null,
): { rotulo: string; itens: string[] } {
  const limpos = itens.map((i) => i.trim()).filter(Boolean)
  if (limpos.length > 1) return { rotulo: 'Kit', itens: limpos }
  if (limpos.length === 1) return { rotulo: limpos[0]!, itens: limpos }
  return { rotulo: produto ?? 'Não informado', itens: [] }
}

type Datas = {
  solicitadaEm: Date
  previsaoConclusao: Date | null
  concluidaEm: Date | null
}

/** Aberta num instante: já tinha sido pedida e ainda não tinha terminado. */
export function estavaAberta(d: Datas, instante: Date): boolean {
  return d.solicitadaEm < instante && (d.concluidaEm === null || d.concluidaEm > instante)
}

/**
 * Atrasada num instante: aberta, e com a previsão de conclusão já vencida.
 *
 * O instante é parâmetro para o status de uma semana passada ser contado
 * como estava no fim daquela semana, e não como está hoje.
 */
export function estavaAtrasada(d: Datas, instante: Date): boolean {
  return estavaAberta(d, instante) && d.previsaoConclusao !== null && d.previsaoConclusao < instante
}

const PESO_DA_PRIORIDADE: Record<PrioridadeDemanda, number> = {
  urgente: 0,
  alta: 1,
  normal: 2,
  baixa: 3,
}

/**
 * Ordem da trilha.
 *
 * Primeiro o que está aberto, porque é o que pede ação; dentro disso, as
 * prioritárias, atrasadas antes; depois pela previsão, a mais próxima antes,
 * e a demanda sem previsão no fim do seu grupo, para não esconder uma que tem
 * data atrás de uma que não tem. Concluídas descem, as mais recentes primeiro.
 */
export function compararNaTrilha<
  T extends Datas & { prioridade: PrioridadeDemanda; fase: FaseOperacional },
>(agora: Date) {
  return (a: T, b: T): number => {
    const concluidaA = a.fase === 'concluido' ? 1 : 0
    const concluidaB = b.fase === 'concluido' ? 1 : 0
    if (concluidaA !== concluidaB) return concluidaA - concluidaB
    if (concluidaA === 1) {
      return (b.concluidaEm?.getTime() ?? 0) - (a.concluidaEm?.getTime() ?? 0)
    }

    const prioritariaA = ehPrioritaria(a.prioridade) ? 0 : 1
    const prioritariaB = ehPrioritaria(b.prioridade) ? 0 : 1
    if (prioritariaA !== prioritariaB) return prioritariaA - prioritariaB

    const atrasadaA = estavaAtrasada(a, agora) ? 0 : 1
    const atrasadaB = estavaAtrasada(b, agora) ? 0 : 1
    if (atrasadaA !== atrasadaB) return atrasadaA - atrasadaB

    if (a.prioridade !== b.prioridade) {
      return PESO_DA_PRIORIDADE[a.prioridade] - PESO_DA_PRIORIDADE[b.prioridade]
    }

    const previsaoA = a.previsaoConclusao?.getTime() ?? Infinity
    const previsaoB = b.previsaoConclusao?.getTime() ?? Infinity
    if (previsaoA !== previsaoB) return previsaoA - previsaoB

    return a.solicitadaEm.getTime() - b.solicitadaEm.getTime()
  }
}

// ---------------------------------------------------------------------------
// Agregações do painel
// ---------------------------------------------------------------------------

export type LinhaDeVolume = {
  subsidiaria: string
  departamento: string
  quantidade: number
  /** De 0 a 100, sobre a quantidade. */
  percentual: number
  /** Soma do custo informado. Demanda sem custo não entra, e é contada à parte. */
  custo: Dinheiro
  semCusto: number
}

export const SEM_DEPARTAMENTO = 'Sem departamento'
export const SEM_SUBSIDIARIA = 'Sem subsidiária'

/**
 * "Volume de Pedidos por Departamento" (relatório, item 2), na hierarquia
 * subsidiária e departamento, em quantidade e em custo: a Logística quer
 * saber "quanto a gente está gastando de envio por empresa ou departamento".
 * Ordem decrescente pela quantidade, empate pelo nome para a ordem não mudar
 * entre recargas.
 */
export function volumePorDepartamento(
  demandas: readonly {
    subsidiaria: string | null
    departamento: string | null
    custoEnvio: Prisma.Decimal | null
  }[],
): LinhaDeVolume[] {
  const grupos = new Map<
    string,
    { subsidiaria: string; departamento: string; custos: Prisma.Decimal[]; quantidade: number }
  >()
  for (const d of demandas) {
    const subsidiaria = d.subsidiaria?.trim() || SEM_SUBSIDIARIA
    const departamento = d.departamento?.trim() || SEM_DEPARTAMENTO
    const chave = `${subsidiaria}\u0000${departamento}`
    const grupo = grupos.get(chave) ?? { subsidiaria, departamento, custos: [], quantidade: 0 }
    grupo.quantidade++
    if (d.custoEnvio !== null) grupo.custos.push(d.custoEnvio)
    grupos.set(chave, grupo)
  }

  const total = demandas.length
  return [...grupos.values()]
    .map((g) => ({
      subsidiaria: g.subsidiaria,
      departamento: g.departamento,
      quantidade: g.quantidade,
      percentual: total ? (g.quantidade / total) * 100 : 0,
      custo: g.custos.length ? somar(g.custos) : ZERO,
      semCusto: g.quantidade - g.custos.length,
    }))
    .sort(
      (a, b) =>
        b.quantidade - a.quantidade || a.departamento.localeCompare(b.departamento, 'pt-BR'),
    )
}

// ---------------------------------------------------------------------------
// Fase, conclusão e recorrência
// ---------------------------------------------------------------------------

export const ROTULO_PERIODICIDADE: Record<Periodicidade, string> = {
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
}

/**
 * A data de conclusão acompanha a fase: entrar em "Concluído" grava o
 * momento, sair dela apaga. Já concluída e salva de novo, mantém a data
 * original, senão editar um detalhe mudaria quando a entrega aconteceu.
 */
export function concluidaEmParaFase(
  fase: FaseOperacional,
  concluidaEmAtual: Date | null,
  agora: Date,
): Date | null {
  if (fase !== 'concluido') return null
  return concluidaEmAtual ?? agora
}

const DIA_MS = 86_400_000

function somarPeriodo(data: Date, periodicidade: Periodicidade, vezes: number): Date {
  if (periodicidade === 'semanal') return new Date(data.getTime() + 7 * vezes * DIA_MS)
  if (periodicidade === 'quinzenal') return new Date(data.getTime() + 14 * vezes * DIA_MS)
  // Mensal anda pelo calendário: 31/01 vai a 28/02, e não a 03/03.
  const alvo = new Date(data.getTime())
  const dia = alvo.getUTCDate()
  alvo.setUTCDate(1)
  alvo.setUTCMonth(alvo.getUTCMonth() + vezes)
  const ultimoDoMes = new Date(
    Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0),
  ).getUTCDate()
  alvo.setUTCDate(Math.min(dia, ultimoDoMes))
  return alvo
}

/**
 * As datas da próxima ocorrência de uma demanda recorrente.
 *
 * As previsões andam um período. Se a ocorrência foi concluída tão tarde que
 * a próxima previsão já passou, andam mais de um, até a primeira que ainda
 * está por vir: nascer atrasada não ajudaria ninguém.
 */
export function proximaOcorrencia(
  anterior: {
    periodicidade: Periodicidade
    previsaoInicio: Date | null
    previsaoConclusao: Date
  },
  agora: Date,
): { solicitadaEm: Date; previsaoInicio: Date | null; previsaoConclusao: Date } {
  let vezes = 1
  while (somarPeriodo(anterior.previsaoConclusao, anterior.periodicidade, vezes) <= agora) {
    vezes++
  }
  return {
    solicitadaEm: agora,
    previsaoInicio: anterior.previsaoInicio
      ? somarPeriodo(anterior.previsaoInicio, anterior.periodicidade, vezes)
      : null,
    previsaoConclusao: somarPeriodo(anterior.previsaoConclusao, anterior.periodicidade, vezes),
  }
}

/** Quantas são recorrentes e quantas pontuais: a Logística diz que metade do trabalho é rotina. */
export function contarRecorrentes(demandas: readonly { recorrente: boolean }[]): {
  recorrentes: number
  pontuais: number
} {
  const recorrentes = demandas.filter((d) => d.recorrente).length
  return { recorrentes, pontuais: demandas.length - recorrentes }
}

/**
 * A previsão de início só aparece enquanto a demanda não começou. Depois, a
 * data que interessa é a de finalização, e mostrar as duas seria o
 * "redundante" que a Logística temia.
 */
export function mostraPrevisaoDeInicio(fase: FaseOperacional): boolean {
  return fase === 'recebido' || fase === 'em_analise'
}

/** Quantas demandas foram pedidas em cada fatia do gráfico de evolução. */
export function volumePorFatia(
  demandas: readonly { solicitadaEm: Date }[],
  fatias: readonly Fatia[],
): number[] {
  return fatias.map(
    (f) => demandas.filter((d) => d.solicitadaEm >= f.inicio && d.solicitadaEm < f.fim).length,
  )
}

/**
 * Variação contra o período anterior. Sem base, não há percentual: "de 0 para
 * 5" não é "+∞%", é "5 a mais".
 */
export function variacao(
  atual: number,
  anterior: number,
): { diferenca: number; percentual: number | null } {
  return {
    diferenca: atual - anterior,
    percentual: anterior > 0 ? ((atual - anterior) / anterior) * 100 : null,
  }
}
