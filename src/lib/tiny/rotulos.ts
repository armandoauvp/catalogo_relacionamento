import type { EnvioTiny } from '@prisma/client'
import { codigoDaSituacao } from './leitura'

/** O andamento do envio, como a tela diz. */
export const ROTULO_ENVIO: Record<EnvioTiny, string> = {
  pendente: 'Na fila',
  processando: 'Enviando',
  enviado: 'No Tiny',
  falhou: 'Falhou',
  cancelado: 'Cancelado',
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
  return ROTULO_SITUACAO[codigoDaSituacao(situacao)] ?? situacao
}

/**
 * O que o selo do pedido diz: o andamento do envio enquanto ele não está no
 * Tiny, e a situação de lá depois. Passo da expedição ainda a caminho do Tiny
 * já aparece, marcado como "a caminho", para quem clicou ver que pegou.
 */
export function seloDoPedido(p: {
  envio: EnvioTiny
  situacao: string | null
  situacaoPendente: string | null
}): { texto: string; tom: TomDoSelo; aCaminho: boolean } {
  const vigente = p.situacaoPendente ?? p.situacao
  if (p.envio !== 'enviado') {
    return { texto: ROTULO_ENVIO[p.envio], tom: tomDoPedido(p.envio, vigente), aCaminho: false }
  }
  return {
    texto: rotuloDaSituacao(vigente) ?? ROTULO_ENVIO.enviado,
    tom: tomDoPedido(p.envio, vigente),
    aCaminho: Boolean(p.situacaoPendente),
  }
}

export type TomDoSelo = 'success' | 'warning' | 'error' | 'info' | 'muted'

/** A cor do selo junta o envio e a situação no Tiny: o que importa a quem olha. */
export function tomDoPedido(envio: EnvioTiny, situacao: string | null): TomDoSelo {
  if (envio === 'falhou') return 'error'
  if (envio === 'cancelado') return 'muted'
  if (envio !== 'enviado') return 'warning'
  const codigo = codigoDaSituacao(situacao)
  if (codigo === 'entregue') return 'success'
  if (codigo === 'cancelado' || codigo === 'nao_entregue') return 'error'
  return 'info'
}
