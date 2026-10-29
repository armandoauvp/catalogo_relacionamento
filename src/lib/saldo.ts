import { Prisma, type Perfil } from '@prisma/client'
import { db } from './db'
import { intervaloDoMes } from './datas'
import { STATUS_FORA_DO_SALDO } from './status'
import { ZERO, dinheiro, type Dinheiro } from './money'

/**
 * Saldo gasto no mês (seção 8 da spec).
 *
 * Soma do `valor_total` de **todas** as solicitações do consultor no mês
 * corrente, canceladas e devolvidas inclusive: a área reenvia, então o dinheiro
 * continua comprometido. Quem decide o que fica de fora é `STATUS_FORA_DO_SALDO`,
 * hoje vazia de propósito, ver `src/lib/status.ts`.
 *
 * Estourar o limite apenas sinaliza no V1. O bloqueio depende de decisão da
 * área, e por isso `estourou` é devolvido como informação, não como veto.
 */

export type ResumoDeSaldo = {
  gasto: Dinheiro
  limite: Dinheiro | null
  /** Percentual do limite consumido, ou null quando não há limite definido. */
  percentual: number | null
  estourou: boolean
  inicio: Date
  fim: Date
}

export async function saldoDoMes(
  consultorId: string,
  referencia: Date = new Date(),
): Promise<ResumoDeSaldo> {
  const { inicio, fim } = intervaloDoMes(referencia)

  const [agregado, usuario] = await Promise.all([
    db.solicitacao.aggregate({
      _sum: { valorTotal: true },
      where: {
        consultorId,
        dataSolicitacao: { gte: inicio, lt: fim },
        status: { notIn: [...STATUS_FORA_DO_SALDO] },
        // Teste não é presente de verdade: não gasta o limite de ninguém.
        teste: false,
      },
    }),
    db.usuario.findUnique({
      where: { id: consultorId },
      select: { limiteMensal: true },
    }),
  ])

  const gasto = agregado._sum.valorTotal ?? ZERO
  const limite = usuario?.limiteMensal ?? null

  return {
    gasto: dinheiro(gasto),
    limite: limite ? dinheiro(limite) : null,
    percentual:
      limite && !new Prisma.Decimal(limite).isZero()
        ? dinheiro(gasto).dividedBy(limite).times(100).toNumber()
        : null,
    estourou: limite ? dinheiro(gasto).greaterThan(limite) : false,
    inicio,
    fim,
  }
}

/** Saldo de todos os consultores no mês, visão de Admin e Financeiro. */
export async function saldoDoMesPorConsultor(referencia: Date = new Date()) {
  const { inicio, fim } = intervaloDoMes(referencia)

  const [agrupado, usuarios] = await Promise.all([
    db.solicitacao.groupBy({
      by: ['consultorId'],
      _sum: { valorTotal: true },
      _count: { _all: true },
      where: {
        dataSolicitacao: { gte: inicio, lt: fim },
        status: { notIn: [...STATUS_FORA_DO_SALDO] },
        teste: false,
      },
    }),
    db.usuario.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, email: true, perfil: true, limiteMensal: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  const porConsultor = new Map(agrupado.map((g) => [g.consultorId, g]))

  return usuarios.map((u) => {
    const linha = porConsultor.get(u.id)
    const gasto = dinheiro(linha?._sum.valorTotal ?? ZERO)
    const limite = u.limiteMensal ? dinheiro(u.limiteMensal) : null

    return {
      usuarioId: u.id,
      nome: u.nome,
      email: u.email,
      perfil: u.perfil as Perfil,
      solicitacoes: linha?._count._all ?? 0,
      gasto,
      limite,
      estourou: limite ? gasto.greaterThan(limite) : false,
    }
  })
}

/**
 * Gasto do time no mês.
 *
 * Para Admin e Financeiro, o próprio gasto costuma ser zero, eles não criam
 * solicitações. O número que interessa a esses perfis é o do time inteiro.
 */
export async function saldoDoMesDoTime(referencia: Date = new Date()) {
  const { inicio, fim } = intervaloDoMes(referencia)

  const agregado = await db.solicitacao.aggregate({
    _sum: { valorTotal: true },
    _count: { _all: true },
    where: {
      dataSolicitacao: { gte: inicio, lt: fim },
      status: { notIn: [...STATUS_FORA_DO_SALDO] },
    },
  })

  return {
    gasto: dinheiro(agregado._sum.valorTotal ?? ZERO),
    solicitacoes: agregado._count._all,
    inicio,
    fim,
  }
}
