import type {
  ComplexidadeDemanda,
  FaseOperacional,
  Periodicidade,
  PrioridadeDemanda,
  Prisma,
} from '@prisma/client'
import { paraNumero, somar, type Dinheiro } from '@/lib/money'
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

/** As ordens que a trilha oferece além da padrão (relatório de 29/10, item 2). */
export const ORDENS_DA_TRILHA = ['prioridade', 'pedido', 'inicio', 'previsao'] as const
export type OrdemDaTrilha = (typeof ORDENS_DA_TRILHA)[number]

export const ROTULO_DA_ORDEM: Record<OrdemDaTrilha, string> = {
  prioridade: 'Prioridade',
  pedido: 'Data do pedido',
  inicio: 'Início',
  previsao: 'Previsão de conclusão',
}

/**
 * A trilha na ordem escolhida.
 *
 * Fora a padrão, é ordem de calendário pura, sem separar abertas de
 * concluídas: quem pede "por data" quer ler a linha do tempo. O pedido vem do
 * mais recente, que é o que se procura; início e previsão, do mais próximo,
 * com quem não tem a data no fim. Empate cai na data do pedido.
 */
export function compararPorOrdem<
  T extends Datas & {
    prioridade: PrioridadeDemanda
    fase: FaseOperacional
    previsaoInicio: Date | null
  },
>(ordem: OrdemDaTrilha, agora: Date) {
  if (ordem === 'prioridade') return compararNaTrilha<T>(agora)

  const chave = (d: T): number => {
    if (ordem === 'pedido') return -d.solicitadaEm.getTime()
    const data = ordem === 'inicio' ? d.previsaoInicio : d.previsaoConclusao
    return data?.getTime() ?? Infinity
  }
  return (a: T, b: T): number =>
    chave(a) - chave(b) || a.solicitadaEm.getTime() - b.solicitadaEm.getTime()
}

// ---------------------------------------------------------------------------
// Envios lançados na tarefa (relatório de 29/10, item 1)
// ---------------------------------------------------------------------------

export type EnvioLancado = { quantidade: number; enviadoEm: Date; anuladoEm: Date | null }

/**
 * Quanto foi despachado. O anulado não conta: é o lançamento feito por
 * engano, que fica no histórico só para mostrar o que aconteceu. Com
 * intervalo, só o que saiu dentro dele, pela data do envio e não pela data em
 * que alguém lançou.
 */
export function somaDosEnvios(
  envios: readonly EnvioLancado[],
  intervalo?: { inicio: Date; fim: Date },
): number {
  return envios
    .filter((e) => e.anuladoEm === null)
    .filter((e) => !intervalo || (e.enviadoEm >= intervalo.inicio && e.enviadoEm < intervalo.fim))
    .reduce((soma, e) => soma + e.quantidade, 0)
}

/** O envio mais recente que vale, para a linha dizer "último em 29/10". */
export function ultimoEnvio(envios: readonly EnvioLancado[]): Date | null {
  const validos = envios.filter((e) => e.anuladoEm === null).map((e) => e.enviadoEm.getTime())
  return validos.length ? new Date(Math.max(...validos)) : null
}

/** Um lote despachado é grande, mas não sem fim: um zero a mais vira o mês inteiro. */
export const TETO_DO_ENVIO = 100_000

/**
 * O que concluir uma tarefa pede de despacho (pedido da área de 05/11): a
 * conclusão já lança o que saiu, para a tarefa passar de "pedida" a
 * "despachada" sem ninguém lembrar de abrir o botão Envios. Sem nada lançado,
 * a quantidade é obrigatória; com lançamentos, é opcional, para não contar duas
 * vezes. Quem já estava concluída e é salva de novo não pede nada.
 */
export function despachoAoConcluir(
  faseAnterior: FaseOperacional | null,
  faseNova: FaseOperacional,
  jaDespachado: number,
): 'obrigatorio' | 'opcional' | null {
  if (faseNova !== 'concluido' || faseAnterior === 'concluido') return null
  return jaDespachado > 0 ? 'opcional' : 'obrigatorio'
}

/** O custo é opcional, então nada confere o número depois: um dígito a mais fica. */
export const TETO_DO_CUSTO = 1_000_000

/**
 * O que impede lançar um envio, ou nulo se ele pode ir.
 *
 * A data é o fim do dia escolhido, como as previsões; por isso "hoje" vale
 * até o fim do dia, e amanhã não: envio é registro do que já saiu.
 */
export function problemaDoEnvio(
  envio: { quantidade: number; enviadoEm: Date; custo?: number | null },
  fimDeHoje: Date,
): string | null {
  if (!Number.isInteger(envio.quantidade) || envio.quantidade < 1) {
    return 'Informe quantos itens saíram, um número inteiro maior que zero.'
  }
  if (envio.quantidade > TETO_DO_ENVIO) {
    return `Mais de ${TETO_DO_ENVIO.toLocaleString('pt-BR')} num lançamento só? Confira o número.`
  }
  if (envio.enviadoEm > fimDeHoje)
    return 'O envio ainda não aconteceu: use a data de hoje ou antes.'
  if (envio.custo != null && envio.custo > TETO_DO_CUSTO) {
    return `Mais de ${TETO_DO_CUSTO.toLocaleString('pt-BR')} de custo num lançamento só? Confira o valor.`
  }
  return null
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
}

export const SEM_DEPARTAMENTO = 'Sem departamento'
export const SEM_SUBSIDIARIA = 'Sem subsidiária'

/**
 * "Volume de Pedidos por Departamento" (relatório, item 2), na hierarquia
 * subsidiária e departamento. Ordem decrescente pela quantidade, empate pelo
 * nome para a ordem não mudar entre recargas.
 *
 * Cada linha conta 1, a não ser que traga `quantidade`: é assim que os
 * envios lançados somam as peças despachadas, e não quantos lançamentos houve.
 */
export function volumePorDepartamento(
  demandas: readonly {
    subsidiaria: string | null
    departamento: string | null
    quantidade?: number
  }[],
): LinhaDeVolume[] {
  const grupos = new Map<
    string,
    { subsidiaria: string; departamento: string; quantidade: number }
  >()
  for (const d of demandas) {
    const subsidiaria = d.subsidiaria?.trim() || SEM_SUBSIDIARIA
    const departamento = d.departamento?.trim() || SEM_DEPARTAMENTO
    const chave = `${subsidiaria}\u0000${departamento}`
    const grupo = grupos.get(chave) ?? { subsidiaria, departamento, quantidade: 0 }
    grupo.quantidade += d.quantidade ?? 1
    grupos.set(chave, grupo)
  }

  const total = demandas.reduce((soma, d) => soma + (d.quantidade ?? 1), 0)
  return [...grupos.values()]
    .map((g) => ({
      subsidiaria: g.subsidiaria,
      departamento: g.departamento,
      quantidade: g.quantidade,
      percentual: total ? (g.quantidade / total) * 100 : 0,
    }))
    .sort(
      (a, b) =>
        b.quantidade - a.quantidade || a.departamento.localeCompare(b.departamento, 'pt-BR'),
    )
}

/**
 * Custo dos envios por subsidiária e departamento (relatório de 29/10): o
 * fechamento do mês em dinheiro.
 *
 * A soma é em `Decimal`. `quantidade` vira número só no fim, para a barra e o
 * texto. Envio sem custo fica fora da soma e é contado à parte: nulo não é zero,
 * e a tela precisa dizer quando o total ainda não é o valor inteiro.
 */
export function custoPorDepartamento(
  envios: readonly {
    subsidiaria: string | null
    departamento: string | null
    custo: Prisma.Decimal.Value | null
  }[],
): { total: Dinheiro; semCusto: number; porDepartamento: LinhaDeVolume[] } {
  const comCusto = envios.flatMap((e) => (e.custo === null ? [] : [{ ...e, custo: e.custo }]))
  const total = somar(comCusto.map((e) => e.custo))

  const grupos = new Map<
    string,
    { subsidiaria: string; departamento: string; custos: Prisma.Decimal.Value[] }
  >()
  for (const e of comCusto) {
    const subsidiaria = e.subsidiaria?.trim() || SEM_SUBSIDIARIA
    const departamento = e.departamento?.trim() || SEM_DEPARTAMENTO
    const chave = `${subsidiaria}\u0000${departamento}`
    const grupo = grupos.get(chave) ?? { subsidiaria, departamento, custos: [] }
    grupo.custos.push(e.custo)
    grupos.set(chave, grupo)
  }

  const porDepartamento = [...grupos.values()]
    .map((g) => {
      const soma = somar(g.custos)
      return {
        subsidiaria: g.subsidiaria,
        departamento: g.departamento,
        quantidade: paraNumero(soma),
        percentual: total.isZero() ? 0 : paraNumero(soma.dividedBy(total).times(100)),
      }
    })
    .sort(
      (a, b) =>
        b.quantidade - a.quantidade || a.departamento.localeCompare(b.departamento, 'pt-BR'),
    )

  return { total, semCusto: envios.length - comCusto.length, porDepartamento }
}

// ---------------------------------------------------------------------------
// Fase, conclusão e recorrência
// ---------------------------------------------------------------------------

export const ROTULO_PERIODICIDADE: Record<Periodicidade, string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
  personalizada: 'A cada N dias',
}

/** O que o selo diz: "Mensal", ou "A cada 3 dias" na periodicidade livre. */
export function rotuloDaRecorrencia(
  periodicidade: Periodicidade | null,
  intervaloDias: number | null,
): string | null {
  if (!periodicidade) return null
  if (periodicidade === 'personalizada' && intervaloDias) {
    return `A cada ${intervaloDias} ${intervaloDias === 1 ? 'dia' : 'dias'}`
  }
  return ROTULO_PERIODICIDADE[periodicidade]
}

/** O maior intervalo livre: mais que um ano não é rotina, é outra demanda. */
export const TETO_DO_INTERVALO = 365

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

type Recorrencia = { periodicidade: Periodicidade; intervaloDias?: number | null }

function somarPeriodo(data: Date, recorrencia: Recorrencia, vezes: number): Date {
  const { periodicidade, intervaloDias } = recorrencia
  const emDias = (dias: number) => new Date(data.getTime() + dias * vezes * DIA_MS)
  if (periodicidade === 'diaria') return emDias(1)
  if (periodicidade === 'semanal') return emDias(7)
  if (periodicidade === 'quinzenal') return emDias(14)
  if (periodicidade === 'personalizada') {
    // O banco garante o intervalo nessa periodicidade; sem ele, o laço não andaria.
    if (!intervaloDias || intervaloDias < 1) throw new Error('Periodicidade livre sem intervalo.')
    return emDias(intervaloDias)
  }
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
  anterior: Recorrencia & {
    previsaoInicio: Date | null
    previsaoConclusao: Date
  },
  agora: Date,
): { solicitadaEm: Date; previsaoInicio: Date | null; previsaoConclusao: Date } {
  let vezes = 1
  while (somarPeriodo(anterior.previsaoConclusao, anterior, vezes) <= agora) {
    vezes++
  }
  return {
    solicitadaEm: agora,
    previsaoInicio: anterior.previsaoInicio
      ? somarPeriodo(anterior.previsaoInicio, anterior, vezes)
      : null,
    previsaoConclusao: somarPeriodo(anterior.previsaoConclusao, anterior, vezes),
  }
}

/**
 * A série acabou: a próxima ocorrência teria a conclusão depois do fim que a
 * Logística marcou. Sem fim marcado, a série não acaba.
 */
export function serieTerminou(previsaoConclusao: Date, recorrenteAte: Date | null): boolean {
  return recorrenteAte !== null && previsaoConclusao > recorrenteAte
}

/** Quantas são recorrentes e quantas pontuais: a Logística diz que metade do trabalho é rotina. */
export function contarRecorrentes(demandas: readonly { recorrente: boolean }[]): {
  recorrentes: number
  pontuais: number
} {
  const recorrentes = demandas.filter((d) => d.recorrente).length
  return { recorrentes, pontuais: demandas.length - recorrentes }
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
