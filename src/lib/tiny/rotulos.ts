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

/**
 * O serviço de envio como a tela deve dizer. O Tiny devolve o nome do serviço
 * (`forma_frete`, "PAC CONTRATO") e, à parte, a forma de envio em código de uma
 * letra (`forma_envio`): sem serviço, o pedido 1353 mostrava só "S", que não diz
 * nada a quem lê. Código não traduzido não vai cru para a tela.
 */
export function rotuloDoServico(
  formaFrete: string | null | undefined,
  formaEnvio: string | null | undefined,
): string {
  if (formaFrete?.trim()) return formaFrete.trim()
  const codigo = formaEnvio?.trim()
  // "S" é o pedido sem forma de envio: o que acontece quando ninguém a escolhe.
  if (!codigo || codigo.toUpperCase() === 'S') return 'Não definido no Tiny'
  return `Forma de envio "${codigo}" do Tiny, sem serviço`
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
