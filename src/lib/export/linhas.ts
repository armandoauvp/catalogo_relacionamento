import { db } from '@/lib/db'
import { formatarCpf } from '@/lib/cpf'
import { formatarISO } from '@/lib/datas'
import { subtotal, paraNumero } from '@/lib/money'
import { ROTULO_STATUS } from '@/lib/status'
import { ROTULO_MOTIVO } from '@/lib/validators/solicitacao'
import { whereDaGestao } from '@/lib/solicitacoes-filtradas'
import type { FiltroSolicitacoes } from '@/lib/validators/filtros'

/**
 * Montagem das linhas de exportação (seção 7 da spec).
 *
 * Uma linha por item, não por solicitação, é o que faz a soma da coluna de
 * valores fechar com o total. O valor total da solicitação aparece repetido em
 * todas as linhas dela, então somar essa coluna dá número inflado de
 * propósito; quem soma, soma o subtotal do item.
 */

export type ColunaExport = {
  chave: string
  titulo: string
  /** Largura sugerida na planilha, em caracteres. */
  largura: number
  tipo: 'texto' | 'numero' | 'data'
}

export const COLUNAS: readonly ColunaExport[] = [
  { chave: 'codigo', titulo: 'Código', largura: 16, tipo: 'texto' },
  { chave: 'dataSolicitacao', titulo: 'Data da solicitação', largura: 14, tipo: 'data' },
  { chave: 'consultor', titulo: 'Consultor', largura: 26, tipo: 'texto' },
  { chave: 'cliente', titulo: 'Cliente', largura: 26, tipo: 'texto' },
  { chave: 'cpf', titulo: 'CPF', largura: 16, tipo: 'texto' },
  { chave: 'telefone', titulo: 'Telefone', largura: 16, tipo: 'texto' },
  { chave: 'produto', titulo: 'Produto ou descrição', largura: 36, tipo: 'texto' },
  { chave: 'site', titulo: 'Site do item específico', largura: 32, tipo: 'texto' },
  { chave: 'quantidade', titulo: 'Quantidade', largura: 11, tipo: 'numero' },
  { chave: 'valorUnitario', titulo: 'Valor unitário', largura: 14, tipo: 'numero' },
  { chave: 'valorItem', titulo: 'Valor do item', largura: 14, tipo: 'numero' },
  {
    chave: 'valorTotalSolicitacao',
    titulo: 'Valor total da solicitação',
    largura: 18,
    tipo: 'numero',
  },
  { chave: 'motivo', titulo: 'Motivo do envio', largura: 22, tipo: 'texto' },
  { chave: 'endereco', titulo: 'Endereço completo', largura: 44, tipo: 'texto' },
  { chave: 'cidade', titulo: 'Cidade', largura: 20, tipo: 'texto' },
  { chave: 'uf', titulo: 'UF', largura: 6, tipo: 'texto' },
  { chave: 'status', titulo: 'Status', largura: 24, tipo: 'texto' },
  {
    chave: 'ultimaMudancaStatus',
    titulo: 'Data da última mudança de status',
    largura: 20,
    tipo: 'data',
  },
  { chave: 'tinyPedidoId', titulo: 'Pedido no Tiny', largura: 16, tipo: 'texto' },
  { chave: 'rastreio', titulo: 'Rastreio', largura: 20, tipo: 'texto' },
] as const

export type LinhaExport = Record<(typeof COLUNAS)[number]['chave'], string | number | null>

function enderecoCompleto(s: {
  entregaLogradouro: string
  entregaNumero: string
  entregaComplemento: string | null
  entregaBairro: string
  entregaCep: string
}): string {
  const partes = [
    `${s.entregaLogradouro}, ${s.entregaNumero}`,
    s.entregaComplemento,
    s.entregaBairro,
    `CEP ${s.entregaCep}`,
  ].filter(Boolean)
  return partes.join(' - ')
}

/**
 * Lê as solicitações que batem com o filtro da tela e as achata em linhas.
 * Deliberadamente sem paginação: a exportação leva o resultado inteiro do
 * filtro, e não a página visível.
 */
export async function linhasParaExportar(filtro: FiltroSolicitacoes): Promise<LinhaExport[]> {
  const solicitacoes = await db.solicitacao.findMany({
    where: await whereDaGestao(filtro),
    include: {
      consultor: { select: { nome: true } },
      cliente: { select: { nome: true, cpf: true, telefone: true } },
      itens: { include: { produto: { select: { nome: true } } } },
      historico: { orderBy: { criadoEm: 'desc' }, take: 1 },
    },
    orderBy: { dataSolicitacao: 'desc' },
  })

  return solicitacoes.flatMap((s) => {
    const ultimaMudanca = s.historico[0]?.criadoEm ?? null

    return s.itens.map<LinhaExport>((item) => ({
      codigo: s.codigo,
      dataSolicitacao: formatarISO(s.dataSolicitacao),
      consultor: s.consultor.nome,
      cliente: s.cliente.nome,
      cpf: formatarCpf(s.cliente.cpf),
      telefone: s.cliente.telefone,
      produto: item.produto?.nome ?? item.descricaoLivre ?? '',
      site: item.urlExterna,
      quantidade: item.quantidade,
      valorUnitario: paraNumero(item.valorUnitario),
      valorItem: paraNumero(subtotal(item.valorUnitario, item.quantidade)),
      valorTotalSolicitacao: paraNumero(s.valorTotal),
      motivo: s.motivo === 'outro' ? (s.motivoOutro ?? 'Outro') : ROTULO_MOTIVO[s.motivo],
      endereco: enderecoCompleto(s),
      cidade: s.entregaCidade,
      uf: s.entregaUf,
      status: ROTULO_STATUS[s.status],
      ultimaMudancaStatus: ultimaMudanca ? formatarISO(ultimaMudanca) : null,
      // Vazios no V1, por desenho.
      tinyPedidoId: s.tinyPedidoId,
      rastreio: s.rastreio,
    }))
  })
}
