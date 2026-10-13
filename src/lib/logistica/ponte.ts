import type {
  ComplexidadeDemanda,
  FaseOperacional,
  Prisma,
  StatusSolicitacao,
} from '@prisma/client'
import { fimDoDiaLocal, formatarISO } from '@/lib/datas'
import { concluidaEmParaFase } from './demandas'

/**
 * Ponte entre o presente aprovado e a trilha da Logística (ADR 0009).
 *
 * Com a trilha cadastrada aqui dentro, o presente não precisa virar tarefa no
 * ClickUp: a aprovação abre a demanda na própria trilha, na mesma transação
 * da mudança de status, e cada status seguinte move a fase. A Logística pode
 * editar a demanda como qualquer outra; o que a solicitação não diz, título
 * revisto, responsável, custo, fica como ela deixou.
 */

/**
 * Como o presente aparece na trilha. **Suposição**: subsidiária e
 * departamento da área de Relacionamento ainda não foram confirmados, e os
 * prazos são o ponto de partida. Ver docs/05-perguntas-em-aberto.md.
 */
export const PONTE = {
  subsidiaria: 'AUVP Consultoria',
  departamento: 'Relacionamento',
  produto: 'Presente para cliente',
  /** Da aprovação à entrega, com tudo em estoque. */
  diasSemCompra: 7,
  /** Da aprovação à entrega, quando o Financeiro ainda compra. */
  diasComCompra: 15,
} as const

/**
 * A fase da demanda para cada status do presente. `null` é "ainda não é da
 * Logística": antes da aprovação, nada entra na trilha. `arquivar` tira o
 * presente cancelado do dashboard sem apagar.
 */
export function faseDoPresente(status: StatusSolicitacao): FaseOperacional | 'arquivar' | null {
  switch (status) {
    case 'pendente':
    case 'aguardando_aprovacao':
      return null
    case 'aguardando_compra':
      return 'aguardando_suprimentos'
    // Comprado: o item chegou ou está chegando, a demanda é da Logística.
    case 'comprado':
      return 'recebido'
    case 'organizando_envio':
      return 'em_execucao'
    case 'entregue':
    case 'cliente_confirmou':
      return 'concluido'
    case 'deu_problema':
    case 'devolvido':
      return 'revisao'
    case 'cancelado':
      return 'arquivar'
  }
}

export type PresenteParaATrilha = {
  codigo: string
  clienteNome: string
  itens: { nome: string; quantidade: number }[]
}

/** A demanda que um presente recém-aprovado abre na trilha. */
export function demandaDoPresente(
  presente: PresenteParaATrilha,
  status: StatusSolicitacao,
  fase: FaseOperacional,
  agora: Date,
) {
  const dias = status === 'aguardando_compra' ? PONTE.diasComCompra : PONTE.diasSemCompra
  const itens = presente.itens.map((i) =>
    i.quantidade > 1 ? `${i.quantidade}× ${i.nome}` : i.nome,
  )
  const complexidade: ComplexidadeDemanda = itens.length > 1 ? 'media' : 'baixa'

  return {
    origem: 'solicitacao' as const,
    titulo: `Presente para ${presente.clienteNome} (${presente.codigo})`,
    subsidiaria: PONTE.subsidiaria,
    departamento: PONTE.departamento,
    produto: PONTE.produto,
    itens,
    fase,
    prioridade: 'normal' as const,
    complexidade,
    solicitadaEm: agora,
    previsaoConclusao: fimDoDiaLocal(formatarISO(new Date(agora.getTime() + dias * 86_400_000))),
    concluidaEm: concluidaEmParaFase(fase, null, agora),
  }
}

/**
 * Leva a mudança de status do presente para a trilha. Recebe a transação de
 * quem muda o status: a demanda nasce, anda ou é arquivada junto com o
 * histórico, ou nada acontece.
 */
export async function sincronizarDemandaDoPresente(
  tx: Prisma.TransactionClient,
  solicitacaoId: string,
  status: StatusSolicitacao,
  agora: Date = new Date(),
): Promise<void> {
  const destino = faseDoPresente(status)
  if (destino === null) return

  const existente = await tx.demandaLogistica.findUnique({
    where: { solicitacaoId },
    select: { id: true, concluidaEm: true },
  })

  if (destino === 'arquivar') {
    if (existente)
      await tx.demandaLogistica.update({ where: { id: existente.id }, data: { ativa: false } })
    return
  }

  if (existente) {
    await tx.demandaLogistica.update({
      where: { id: existente.id },
      data: {
        fase: destino,
        ativa: true,
        concluidaEm: concluidaEmParaFase(destino, existente.concluidaEm, agora),
      },
    })
    return
  }

  const solicitacao = await tx.solicitacao.findUniqueOrThrow({
    where: { id: solicitacaoId },
    select: {
      codigo: true,
      cliente: { select: { nome: true } },
      itens: {
        select: { quantidade: true, descricaoLivre: true, produto: { select: { nome: true } } },
      },
    },
  })

  await tx.demandaLogistica.create({
    data: {
      ...demandaDoPresente(
        {
          codigo: solicitacao.codigo,
          clienteNome: solicitacao.cliente.nome,
          itens: solicitacao.itens.map((i) => ({
            nome: i.produto?.nome ?? i.descricaoLivre ?? 'Presente',
            quantidade: i.quantidade,
          })),
        },
        status,
        destino,
        agora,
      ),
      solicitacaoId,
    },
  })
}
