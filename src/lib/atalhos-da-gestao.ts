import { StatusSolicitacao } from '@prisma/client'
import { STATUS_PARA_APROVAR } from './status'
import type { ParametrosDaUrl } from './filtro-por-grupo'
import type { FiltroSolicitacoes } from './validators/filtros'

/**
 * Os atalhos acima da tabela da gestão: cada um é uma pilha em que o Admin
 * atua, na ordem do fluxo (pedido da área em 19/11/2026, "filtrar o que
 * preciso atuar"). Fazem o papel das colunas de um kanban sem trocar a tabela,
 * que é onde a gestão encaminha em lote e exporta.
 *
 * O atalho troca só o recorte de status: período, consultor e busca ficam.
 */

export type AtalhoDaGestao = {
  chave: string
  rotulo: string
  /** Os status que o atalho junta, para a contagem. */
  status: readonly StatusSolicitacao[]
  /** O que vai na URL: a fila de aprovação ou um status só. */
  parametro: { fila: 'aprovar' } | { status: StatusSolicitacao }
}

export const ATALHOS_DA_GESTAO: readonly AtalhoDaGestao[] = [
  {
    chave: 'aprovar',
    rotulo: 'Para aprovar',
    status: STATUS_PARA_APROVAR,
    parametro: { fila: 'aprovar' },
  },
  {
    chave: StatusSolicitacao.deu_problema,
    rotulo: 'Deu problema',
    status: [StatusSolicitacao.deu_problema],
    parametro: { status: StatusSolicitacao.deu_problema },
  },
  {
    chave: StatusSolicitacao.aguardando_compra,
    rotulo: 'Aguardando compra',
    status: [StatusSolicitacao.aguardando_compra],
    parametro: { status: StatusSolicitacao.aguardando_compra },
  },
  {
    // Comprado não é chegado: é a pilha que espera o "Chegou" da Logística.
    chave: StatusSolicitacao.comprado,
    rotulo: 'Esperando chegar',
    status: [StatusSolicitacao.comprado],
    parametro: { status: StatusSolicitacao.comprado },
  },
  {
    chave: StatusSolicitacao.organizando_envio,
    rotulo: 'Organizando envio',
    status: [StatusSolicitacao.organizando_envio],
    parametro: { status: StatusSolicitacao.organizando_envio },
  },
]

const DO_RECORTE = ['status', 'fila', 'pagina']

/** O endereço do atalho; sem atalho, "Todas", que só tira o recorte de status. */
export function hrefDoAtalho(
  caminho: string,
  params: ParametrosDaUrl,
  atalho: AtalhoDaGestao | null,
): string {
  const q = new URLSearchParams()
  for (const [chave, valor] of Object.entries(params)) {
    if (DO_RECORTE.includes(chave)) continue
    for (const v of [valor].flat()) if (typeof v === 'string' && v) q.append(chave, v)
  }
  if (atalho) for (const [chave, valor] of Object.entries(atalho.parametro)) q.set(chave, valor)
  const s = q.toString()
  return s ? `${caminho}?${s}` : caminho
}

/** Qual atalho a URL ligou; nulo é "Todas" ou um recorte que nenhum atalho faz. */
export function atalhoAtivo(filtro: Pick<FiltroSolicitacoes, 'status' | 'fila'>): string | null {
  if (filtro.fila === 'aprovar') return 'aprovar'
  if (filtro.status?.length !== 1) return null
  const [status] = filtro.status
  return (
    ATALHOS_DA_GESTAO.find((a) => 'status' in a.parametro && a.parametro.status === status)
      ?.chave ?? null
  )
}

/** Quantas solicitações cada atalho junta, a partir da contagem por status. */
export function contagemDoAtalho(
  porStatus: Partial<Record<StatusSolicitacao, number>>,
  atalho: AtalhoDaGestao,
): number {
  return atalho.status.reduce((soma, s) => soma + (porStatus[s] ?? 0), 0)
}
