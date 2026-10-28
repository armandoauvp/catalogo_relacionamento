/**
 * O ciclo de vida do pedido no Tiny, como a pauta de 22/10/2026 definiu:
 *
 * | Momento                   | Situação no Tiny e aqui |
 * | ------------------------- | ----------------------- |
 * | o pedido nasce            | Em aberto               |
 * | a expedição fecha a lista | Preparando envio        |
 * | a expedição conclui       | Pronto para envio       |
 *
 * O nascimento é a própria criação do pedido (`pedido.incluir`). Os dois
 * passos seguintes partem daqui, pela fila, com `pedido.alterar.situacao`; e o
 * que alguém mudar direto no Tiny volta pela sincronização.
 *
 * A única volta permitida é o cancelamento: a solicitação cancelada aqui
 * cancela o pedido lá, enquanto ele ainda não saiu da AUVP.
 */

import { codigoDaSituacao } from './leitura'

export type PassoDaExpedicao = 'fechar' | 'concluir'

export const SITUACAO_DO_PASSO: Record<PassoDaExpedicao, 'preparando_envio' | 'pronto_envio'> = {
  fechar: 'preparando_envio',
  concluir: 'pronto_envio',
}

export const ROTULO_DO_PASSO: Record<PassoDaExpedicao, string> = {
  fechar: 'Fechar expedição',
  concluir: 'Concluir',
}

/** A ordem em que o pedido anda no Tiny. Cancelado e não entregue saem dela. */
const ORDEM = [
  'aberto',
  'aprovado',
  'preparando_envio',
  'faturado',
  'pronto_envio',
  'enviado',
  'entregue',
]

/**
 * A situação que vale para a tela: a que a expedição já pediu, mesmo que a
 * fila ainda não a tenha levado ao Tiny, ou a última lida de lá.
 */
export function situacaoVigente(p: {
  situacao: string | null
  situacaoPendente: string | null
}): string | null {
  return p.situacaoPendente ?? p.situacao
}

/**
 * O Tiny já está nesta situação ou além dela? Quando alguém anda o pedido
 * direto no Tiny, o passo que a expedição pediu aqui perde o sentido, e
 * mandá-lo faria o pedido voltar.
 */
export function jaChegou(situacaoNoTiny: string | null, destino: string): boolean {
  // O cancelamento perde o sentido quando o pedido já saiu ou já foi cancelado.
  if (destino === 'cancelado') return !cancelamentoCabe(situacaoNoTiny)
  if (!situacaoNoTiny) return false
  // Pedido sincronizado antes da tradução tem a situação em texto ("Em aberto").
  const codigo = codigoDaSituacao(situacaoNoTiny)
  if (codigo === 'cancelado' || codigo === 'nao_entregue') return true
  const atual = ORDEM.indexOf(codigo)
  return atual >= 0 && atual >= ORDEM.indexOf(destino)
}

/**
 * O pedido ainda está na AUVP? Depois de "Enviado" o presente está com os
 * Correios: cancelar no Tiny não o traria de volta, só esconderia o envio.
 * Sem situação, o pedido ainda vai nascer, e cancelar é não mandá-lo.
 */
export function cancelamentoCabe(situacao: string | null): boolean {
  if (situacao === null) return true
  const atual = ORDEM.indexOf(codigoDaSituacao(situacao))
  return atual >= 0 && atual < ORDEM.indexOf('enviado')
}

/**
 * O passo só anda para a frente: fechar a expedição de um pedido que já está
 * "Pronto para envio" no Tiny o faria voltar. Pedido sem situação ainda (na
 * fila para nascer) pode receber o passo; ele vai ao Tiny depois de criado.
 */
export function passoPermitido(situacaoAtual: string | null, passo: PassoDaExpedicao): boolean {
  if (situacaoAtual === null) return true
  const atual = ORDEM.indexOf(codigoDaSituacao(situacaoAtual))
  if (atual < 0) return false
  return ORDEM.indexOf(SITUACAO_DO_PASSO[passo]) > atual
}
