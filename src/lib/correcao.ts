import type { StatusSolicitacao } from '@prisma/client'
import { linkDeCompraEditavel } from './compras'
import { formatarBRL } from './money'

/**
 * Correção do pedido pelo Admin, depois de criado.
 *
 * Vale até a compra: na mesma janela da troca de link, porque depois disso o
 * que foi comprado é o que vai. Item já marcado como comprado não muda nem sai,
 * mesmo com a solicitação ainda em "Aguardando compra".
 *
 * Cada campo que muda vira uma linha em `SolicitacaoAlteracao`, com o antes e
 * o depois em texto: a solicitação continua legível como foi pedida.
 */

export function correcaoCabe(status: StatusSolicitacao): boolean {
  return linkDeCompraEditavel(status)
}

export type ItemComparavel = {
  /** Nulo no item que a correção acrescenta. */
  id: string | null
  nome: string
  produtoId: string | null
  urlExterna: string | null
  valorUnitario: string
  quantidade: number
  doEstoque: boolean
}

export type DadosDaCorrecao = {
  entregaDestinatario: string
  entregaCep: string
  entregaLogradouro: string
  entregaNumero: string
  entregaComplemento: string | null
  entregaBairro: string
  entregaCidade: string
  entregaUf: string
  /** O motivo já em texto, "Aniversário" ou o "outro" escrito. */
  motivo: string
  saudacaoCarta: string
  mensagemCarta: string
  observacoes: string | null
  itens: ItemComparavel[]
}

export type Alteracao = { campo: string; antes: string | null; depois: string | null }

const ROTULO_DO_CAMPO: Record<Exclude<keyof DadosDaCorrecao, 'itens'>, string> = {
  entregaDestinatario: 'Quem recebe',
  entregaCep: 'CEP',
  entregaLogradouro: 'Logradouro',
  entregaNumero: 'Número',
  entregaComplemento: 'Complemento',
  entregaBairro: 'Bairro',
  entregaCidade: 'Cidade',
  entregaUf: 'UF',
  motivo: 'Motivo',
  saudacaoCarta: 'Saudação da carta',
  mensagemCarta: 'Carta',
  observacoes: 'Observações',
}

/** O item numa linha, do jeito que a linha do tempo mostra. */
export function rotuloDoItem(item: ItemComparavel): string {
  const partes = [
    `${item.quantidade}× ${item.nome}`,
    formatarBRL(item.valorUnitario),
    item.doEstoque ? 'do estoque' : null,
    item.urlExterna,
  ]
  return partes.filter(Boolean).join(' · ')
}

const vazioComoNulo = (v: string | null) => (v && v.trim() ? v.trim() : null)

/** O que mudou entre o pedido gravado e a correção, campo a campo e item a item. */
export function alteracoesDaCorrecao(antes: DadosDaCorrecao, depois: DadosDaCorrecao): Alteracao[] {
  const mudancas: Alteracao[] = []

  for (const campo of Object.keys(ROTULO_DO_CAMPO) as (keyof typeof ROTULO_DO_CAMPO)[]) {
    const a = vazioComoNulo(antes[campo])
    const d = vazioComoNulo(depois[campo])
    if (a !== d) mudancas.push({ campo: ROTULO_DO_CAMPO[campo], antes: a, depois: d })
  }

  const depoisPorId = new Map(depois.itens.filter((i) => i.id).map((i) => [i.id, i]))
  for (const item of antes.itens) {
    const novo = item.id ? depoisPorId.get(item.id) : undefined
    if (!novo) {
      mudancas.push({ campo: 'Item retirado', antes: rotuloDoItem(item), depois: null })
      continue
    }
    const a = rotuloDoItem(item)
    const d = rotuloDoItem(novo)
    if (a !== d) mudancas.push({ campo: 'Item corrigido', antes: a, depois: d })
  }
  for (const item of depois.itens.filter((i) => !i.id)) {
    mudancas.push({ campo: 'Item acrescentado', antes: null, depois: rotuloDoItem(item) })
  }

  return mudancas
}

/**
 * O item comprado ficou como estava? A tela já trava a linha; a action confere
 * de novo, porque o que foi comprado é o que vai.
 */
export function compradoIntacto(
  antes: ItemComparavel,
  depois: ItemComparavel | undefined,
): boolean {
  return depois !== undefined && rotuloDoItem(antes) === rotuloDoItem(depois)
}
