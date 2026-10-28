import { StatusSolicitacao } from '@prisma/client'
import { db } from './db'
import { formatarCpf, formatarTelefone } from './cpf'
import { formatarCep } from './cep'
import { formatarData } from './datas'
import { totalDosItens, type Dinheiro } from './money'
import { ROTULO_MOTIVO } from './validators/solicitacao'
import { precisaDeCompra } from './status'
import type { ColunaExport } from './export/linhas'

/**
 * Pedido de expedição.
 *
 * Hoje a área monta uma planilha à mão com estes dados e manda para a
 * expedição. O objetivo é que a solicitação do consultor já produza o pedido
 * pronto, sem redigitação: a carta continua sendo feita fora, como a área
 * pediu.
 *
 * Duas coisas mandam uma solicitação para cá:
 *
 * - o caminho normal, depois que o Financeiro compra;
 * - o atalho: itens que já estão em estoque não passam pelo Financeiro, e a
 *   aprovação já os libera para envio.
 */

export type ItemDoPedido = {
  produto: string
  quantidade: number
  deCatalogo: boolean
  /** Do estoque ou comprado, a expedição precisa saber o que separar. */
  jaEmEstoque: boolean
}

export type PedidoDeExpedicao = {
  id: string
  codigo: string
  data: Date
  status: StatusSolicitacao

  consultor: string
  cliente: string
  clienteCpf: string
  clienteTelefone: string | null

  destinatario: string
  cep: string
  logradouro: string
  numero: string
  complemento: string | null
  bairro: string
  cidade: string
  uf: string
  /** Uma linha só, no formato que a planilha usa hoje. */
  enderecoCompleto: string

  motivo: string
  observacoes: string | null
  itens: ItemDoPedido[]
  valorTotal: Dinheiro

  /** Fase 2: preenchidos quando o pedido for criado no ERP. */
  rastreio: string | null
  transportadora: string | null
}

/** Status em que a solicitação está sob responsabilidade da expedição. */
export const STATUS_DA_EXPEDICAO: readonly StatusSolicitacao[] = [
  StatusSolicitacao.organizando_envio,
] as const

export type FiltroDaExpedicao = {
  incluirEnviadas?: boolean
  de?: Date
  ate?: Date
}

export async function filaDeExpedicao(
  filtro: FiltroDaExpedicao = {},
): Promise<PedidoDeExpedicao[]> {
  const status = filtro.incluirEnviadas
    ? [...STATUS_DA_EXPEDICAO, StatusSolicitacao.entregue]
    : [...STATUS_DA_EXPEDICAO]

  const solicitacoes = await db.solicitacao.findMany({
    where: {
      status: { in: status },
      ...(filtro.de || filtro.ate
        ? {
            dataSolicitacao: {
              ...(filtro.de ? { gte: filtro.de } : {}),
              ...(filtro.ate ? { lte: filtro.ate } : {}),
            },
          }
        : {}),
    },
    include: {
      consultor: { select: { nome: true } },
      cliente: { select: { nome: true, cpf: true, telefone: true } },
      itens: {
        include: {
          produto: {
            select: { nome: true, origem: true, controlaEstoque: true, estoque: true },
          },
        },
      },
    },
    // Mais antigas primeiro: a expedição trabalha por ordem de chegada.
    orderBy: { dataSolicitacao: 'asc' },
  })

  return solicitacoes.map((s) => ({
    id: s.id,
    codigo: s.codigo,
    data: s.dataSolicitacao,
    status: s.status,

    consultor: s.consultor.nome,
    cliente: s.cliente.nome,
    clienteCpf: formatarCpf(s.cliente.cpf),
    clienteTelefone: s.cliente.telefone ? formatarTelefone(s.cliente.telefone) : null,

    destinatario: s.entregaDestinatario,
    cep: formatarCep(s.entregaCep),
    logradouro: s.entregaLogradouro,
    numero: s.entregaNumero,
    complemento: s.entregaComplemento,
    bairro: s.entregaBairro,
    cidade: s.entregaCidade,
    uf: s.entregaUf,
    enderecoCompleto: [
      `${s.entregaLogradouro}, ${s.entregaNumero}`,
      s.entregaComplemento,
      s.entregaBairro,
      `${s.entregaCidade}/${s.entregaUf}`,
      `CEP ${formatarCep(s.entregaCep)}`,
    ]
      .filter(Boolean)
      .join(' - '),

    motivo: s.motivo === 'outro' ? (s.motivoOutro ?? 'Outro') : ROTULO_MOTIVO[s.motivo],
    observacoes: s.observacoes,
    itens: s.itens.map((item) => ({
      produto: item.produto?.nome ?? item.descricaoLivre ?? '-',
      quantidade: item.quantidade,
      deCatalogo: item.produtoId !== null,
      // A mesma regra que decidiu a rota na aprovação: pela origem do produto,
      // e não pela contagem de peças, que a área não mantém.
      jaEmEstoque: !precisaDeCompra([item]),
    })),
    valorTotal: totalDosItens(
      s.itens.map((i) => ({ valorUnitario: i.valorUnitario, quantidade: i.quantidade })),
    ),

    rastreio: s.rastreio,
    transportadora: s.transportadora,
  }))
}

/** Total de peças a separar, o número que a expedição olha primeiro. */
export function pecasASeparar(pedidos: readonly PedidoDeExpedicao[]): number {
  return pedidos.reduce((acc, p) => acc + p.itens.reduce((soma, i) => soma + i.quantidade, 0), 0)
}

/**
 * Linhas da planilha de expedição.
 *
 * Uma linha por item, como na planilha que a área monta hoje, a expedição
 * separa item a item, não pedido a pedido.
 */
export const COLUNAS_DA_EXPEDICAO = [
  { chave: 'codigo', titulo: 'Código', largura: 16, tipo: 'texto' },
  { chave: 'data', titulo: 'Data da solicitação', largura: 14, tipo: 'data' },
  { chave: 'destinatario', titulo: 'Destinatário', largura: 28, tipo: 'texto' },
  { chave: 'produto', titulo: 'Produto', largura: 36, tipo: 'texto' },
  { chave: 'quantidade', titulo: 'Quantidade', largura: 11, tipo: 'numero' },
  { chave: 'origem', titulo: 'Origem', largura: 14, tipo: 'texto' },
  { chave: 'cep', titulo: 'CEP', largura: 12, tipo: 'texto' },
  { chave: 'logradouro', titulo: 'Logradouro', largura: 30, tipo: 'texto' },
  { chave: 'numero', titulo: 'Número', largura: 10, tipo: 'texto' },
  { chave: 'complemento', titulo: 'Complemento', largura: 18, tipo: 'texto' },
  { chave: 'bairro', titulo: 'Bairro', largura: 20, tipo: 'texto' },
  { chave: 'cidade', titulo: 'Cidade', largura: 20, tipo: 'texto' },
  { chave: 'uf', titulo: 'UF', largura: 6, tipo: 'texto' },
  { chave: 'telefone', titulo: 'Telefone', largura: 16, tipo: 'texto' },
  { chave: 'cpf', titulo: 'CPF do cliente', largura: 16, tipo: 'texto' },
  { chave: 'motivo', titulo: 'Motivo do envio', largura: 22, tipo: 'texto' },
  { chave: 'observacoes', titulo: 'Observações', largura: 32, tipo: 'texto' },
] as const satisfies readonly ColunaExport[]

export type LinhaDaExpedicao = Record<
  (typeof COLUNAS_DA_EXPEDICAO)[number]['chave'],
  string | number | null
>

export function linhasDaExpedicao(pedidos: readonly PedidoDeExpedicao[]): LinhaDaExpedicao[] {
  return pedidos.flatMap((p) =>
    p.itens.map<LinhaDaExpedicao>((item) => ({
      codigo: p.codigo,
      data: formatarData(p.data),
      destinatario: p.destinatario,
      produto: item.produto,
      quantidade: item.quantidade,
      origem: item.jaEmEstoque ? 'Estoque' : 'Compra',
      cep: p.cep,
      logradouro: p.logradouro,
      numero: p.numero,
      complemento: p.complemento,
      bairro: p.bairro,
      cidade: p.cidade,
      uf: p.uf,
      telefone: p.clienteTelefone,
      cpf: p.clienteCpf,
      motivo: p.motivo,
      observacoes: p.observacoes,
    })),
  )
}
