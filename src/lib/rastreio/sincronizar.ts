import { db } from '@/lib/db'
import { correiosConfigurado } from '@/lib/env'
import { consultarObjeto, ErroDosCorreios } from './correios'
import {
  ehCodigoDosCorreios,
  ehEntrega,
  entregueEm,
  maisNovosPrimeiro,
  normalizarCodigo,
} from './leitura'

/**
 * Traz dos Correios o histórico dos objetos que ainda andam e grava o que for
 * novo. Roda junto com a sincronização do Tiny (cron e botão "Atualizar
 * rastreios"). Rastreio não muda status: o evento de entrega só acende o aviso
 * para quem marca "entregue" aqui dentro.
 */

/** Consultar de novo o mesmo objeto só depois disto. */
export const INTERVALO_DE_CONSULTA_MS = 60 * 60_000
/** Objeto de pedido mais antigo que isto não é mais acompanhado. */
const DIAS_DE_ACOMPANHAMENTO = 90
/** Entre uma consulta e outra, para não esbarrar no limite do CWS. */
const INTERVALO_ENTRE_CHAMADAS_MS = 400

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

export type ResultadoDoRastreio = {
  consultados: number
  novosEventos: number
  entregues: number
  /** Credencial recusada: nenhuma outra consulta adiantaria. */
  interrompida: string | null
}

/** Os códigos dos Correios que ainda andam, na solicitação e no pedido do Tiny. */
async function codigosEmAndamento(agora: Date): Promise<string[]> {
  const desde = new Date(agora.getTime() - DIAS_DE_ACOMPANHAMENTO * 86_400_000)
  const [solicitacoes, pedidos] = await Promise.all([
    db.solicitacao.findMany({
      where: {
        rastreio: { not: null },
        status: { not: 'cancelado' },
        atualizadoEm: { gte: desde },
      },
      select: { rastreio: true },
    }),
    db.pedidoTiny.findMany({
      where: { rastreio: { not: null }, enviadoEm: { gte: desde } },
      select: { rastreio: true },
    }),
  ])
  return [
    ...new Set(
      [...solicitacoes, ...pedidos]
        .map((r) => normalizarCodigo(r.rastreio))
        .filter(ehCodigoDosCorreios),
    ),
  ]
}

/** Grava a consulta de um objeto: só os eventos novos, e a entrega quando vier. */
export async function gravarConsulta(
  codigo: string,
  agora: Date,
): Promise<{ novos: number; entregue: boolean }> {
  const lido = await consultarObjeto(codigo)
  const entrega = entregueEm(lido.eventos)
  return db.$transaction(async (tx) => {
    await tx.objetoRastreado.upsert({
      where: { codigo },
      create: { codigo, consultadoEm: agora, entregueEm: entrega, erro: lido.erro },
      update: { consultadoEm: agora, erro: lido.erro, ...(entrega ? { entregueEm: entrega } : {}) },
    })
    const { count } = await tx.eventoDeRastreio.createMany({
      data: lido.eventos.map((e) => ({ ...e, codigoObjeto: codigo })),
      skipDuplicates: true,
    })
    return { novos: count, entregue: Boolean(entrega) }
  })
}

export async function sincronizarRastreios({
  prazoMs = 20_000,
  agora = () => new Date(),
}: { prazoMs?: number; agora?: () => Date } = {}): Promise<ResultadoDoRastreio> {
  const resultado: ResultadoDoRastreio = {
    consultados: 0,
    novosEventos: 0,
    entregues: 0,
    interrompida: null,
  }
  if (!correiosConfigurado) return resultado
  const fim = Date.now() + prazoMs

  const codigos = await codigosEmAndamento(agora())
  const conhecidos = new Map(
    (
      await db.objetoRastreado.findMany({
        where: { codigo: { in: codigos } },
        select: { codigo: true, entregueEm: true, consultadoEm: true },
      })
    ).map((o) => [o.codigo, o]),
  )
  const limite = agora().getTime() - INTERVALO_DE_CONSULTA_MS
  // Nunca consultado primeiro; entregue não volta a ser consultado.
  const fila = codigos
    .filter((c) => {
      const o = conhecidos.get(c)
      return !o || (!o.entregueEm && (!o.consultadoEm || o.consultadoEm.getTime() < limite))
    })
    .sort(
      (a, b) =>
        (conhecidos.get(a)?.consultadoEm?.getTime() ?? 0) -
        (conhecidos.get(b)?.consultadoEm?.getTime() ?? 0),
    )

  for (const [i, codigo] of fila.entries()) {
    if (Date.now() >= fim) break
    if (i > 0) await esperar(INTERVALO_ENTRE_CHAMADAS_MS)
    try {
      const { novos, entregue } = await gravarConsulta(codigo, agora())
      resultado.consultados++
      resultado.novosEventos += novos
      if (entregue) resultado.entregues++
    } catch (erro) {
      if (!(erro instanceof ErroDosCorreios)) throw erro
      if (erro.status === 401 || erro.status === 403) {
        resultado.interrompida = erro.message
        break
      }
      // Queda dos Correios: tenta de novo na próxima rodada.
      await db.objetoRastreado.upsert({
        where: { codigo },
        create: { codigo, consultadoEm: agora(), erro: erro.message },
        update: { consultadoEm: agora(), erro: erro.message },
      })
    }
  }
  return resultado
}

export type Rastreamento = {
  codigo: string
  entregueEm: Date | null
  consultadoEm: Date | null
  erro: string | null
  eventos: {
    id: string
    ocorridoEm: Date
    descricao: string
    local: string | null
    destino: string | null
    entrega: boolean
  }[]
}

/** O histórico gravado de um código, para a tela. Nulo se não é dos Correios. */
export async function rastreamentoDe(
  codigo: string | null | undefined,
): Promise<Rastreamento | null> {
  if (!ehCodigoDosCorreios(codigo)) return null
  const alvo = normalizarCodigo(codigo)
  const objeto = await db.objetoRastreado.findUnique({
    where: { codigo: alvo },
    include: { eventos: true },
  })
  return {
    codigo: alvo,
    entregueEm: objeto?.entregueEm ?? null,
    consultadoEm: objeto?.consultadoEm ?? null,
    erro: objeto?.erro ?? null,
    eventos: maisNovosPrimeiro(objeto?.eventos ?? []).map((e) => ({
      id: e.id,
      ocorridoEm: e.ocorridoEm,
      descricao: e.descricao,
      local: e.local,
      destino: e.destino,
      entrega: ehEntrega(e),
    })),
  }
}

/**
 * Quem abre a tela vê o histórico gravado na hora, e a consulta, se estiver
 * velha, roda depois da resposta: a próxima visita já vem atualizada, sem a
 * tela esperar os Correios.
 */
export async function atualizarSeVelho(r: Rastreamento | null, agora = new Date()) {
  if (!r || !correiosConfigurado || r.entregueEm) return
  if (r.consultadoEm && r.consultadoEm.getTime() > agora.getTime() - INTERVALO_DE_CONSULTA_MS)
    return
  await gravarConsulta(r.codigo, agora).catch(() => null)
}
