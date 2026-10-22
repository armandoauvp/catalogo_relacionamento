import type { EnvioTiny } from '@prisma/client'

/** O andamento do envio, como a tela diz. */
export const ROTULO_ENVIO: Record<EnvioTiny, string> = {
  pendente: 'Na fila',
  processando: 'Enviando',
  enviado: 'No Tiny',
  falhou: 'Falhou',
}

/** As situações de pedido do Tiny (tabela "Situações dos Pedidos" da API v2). */
const ROTULO_SITUACAO: Record<string, string> = {
  aberto: 'Em aberto',
  aprovado: 'Aprovado',
  preparando_envio: 'Preparando envio',
  faturado: 'Faturado',
  pronto_envio: 'Pronto para envio',
  enviado: 'Enviado',
  entregue: 'Entregue',
  nao_entregue: 'Não entregue',
  cancelado: 'Cancelado',
}

export function rotuloDaSituacao(situacao: string | null | undefined): string | null {
  if (!situacao) return null
  return ROTULO_SITUACAO[situacao] ?? situacao
}

export type TomDoSelo = 'success' | 'warning' | 'error' | 'info' | 'muted'

/** A cor do selo junta o envio e a situação no Tiny: o que importa a quem olha. */
export function tomDoPedido(envio: EnvioTiny, situacao: string | null): TomDoSelo {
  if (envio === 'falhou') return 'error'
  if (envio !== 'enviado') return 'warning'
  if (situacao === 'entregue') return 'success'
  if (situacao === 'cancelado' || situacao === 'nao_entregue') return 'error'
  return 'info'
}
