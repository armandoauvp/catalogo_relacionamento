import type { z } from 'zod'
import { db } from './db'
import { ordemDeClientes, whereDeClientes, type FiltroDeClientes } from './filtro-de-clientes'
import { acumularEtiquetas, type cadastroDoSiteSchema } from './validators/cliente'

/**
 * Consultas da base de clientes que a tela e a exportação dividem: o recorte
 * do filtro, com o número de solicitações e o total enviado de cada um.
 */

export async function clientesDoFiltro(filtro: FiltroDeClientes, limite?: number) {
  const clientes = await db.cliente.findMany({
    where: whereDeClientes(filtro),
    orderBy: ordemDeClientes(filtro.ordem),
    include: { _count: { select: { solicitacoes: true } } },
    ...(limite ? { take: limite } : {}),
  })

  // Tudo conta, cancelado e devolvido inclusive, como no saldo do mês: a área reenvia.
  const totais = clientes.length
    ? await db.solicitacao.groupBy({
        by: ['clienteId'],
        where: { clienteId: { in: clientes.map((c) => c.id) } },
        _sum: { valorTotal: true },
      })
    : []
  const porCliente = new Map(totais.map((t) => [t.clienteId, t._sum.valorTotal]))

  return clientes.map((c) => ({
    ...c,
    solicitacoes: c._count.solicitacoes,
    total: porCliente.get(c.id) ?? null,
  }))
}

/** Todas as etiquetas em uso, para o filtro oferecer as que existem. */
export async function etiquetasEmUso(): Promise<string[]> {
  const linhas = await db.$queryRaw<{ etiqueta: string }[]>`
    SELECT DISTINCT unnest(etiquetas) AS etiqueta FROM clientes ORDER BY 1
  `
  return linhas.map((l) => l.etiqueta)
}

/**
 * O cadastro que chega do site: cria pelo CPF, ou completa quem já existe com
 * o que veio preenchido, somando as etiquetas. Nunca apaga um dado da base.
 */
export async function gravarCadastroDoSite(
  dados: z.output<typeof cadastroDoSiteSchema>,
): Promise<{ id: string; criado: boolean }> {
  const existente = await db.cliente.findUnique({
    where: { cpf: dados.cpf },
    select: { id: true, etiquetas: true },
  })
  if (!existente) {
    const novo = await db.cliente.create({
      data: { ...dados, origem: 'site' },
      select: { id: true },
    })
    return { id: novo.id, criado: true }
  }

  const { cpf: _cpf, etiquetas, ...campos } = dados
  const preenchidos = Object.fromEntries(
    Object.entries(campos).filter(([, v]) => v !== null && v !== undefined),
  )
  await db.cliente.update({
    where: { id: existente.id },
    data: { ...preenchidos, etiquetas: acumularEtiquetas(existente.etiquetas, etiquetas) },
  })
  return { id: existente.id, criado: false }
}
