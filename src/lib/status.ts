import { OrigemProduto, StatusSolicitacao } from '@prisma/client'

/**
 * Máquina de estados do fluxo de solicitação (seção 5 da spec).
 *
 * O fluxo feliz é linear. Fora dele existem três regras:
 *
 * - `deu_problema` pode ser acionado a partir de qualquer status vivo;
 * - `devolvido` só a partir de `entregue` em diante;
 * - de `deu_problema` a solicitação volta para qualquer status anterior do
 *   fluxo linear, ou é cancelada.
 *
 * `cliente_confirmou`, `devolvido` e `cancelado` são terminais.
 */

/** Ordem do fluxo linear. O índice é o que define "status anterior". */
export const FLUXO_LINEAR: readonly StatusSolicitacao[] = [
  StatusSolicitacao.pendente,
  StatusSolicitacao.aguardando_aprovacao,
  StatusSolicitacao.aguardando_compra,
  StatusSolicitacao.comprado,
  StatusSolicitacao.organizando_envio,
  StatusSolicitacao.entregue,
  StatusSolicitacao.cliente_confirmou,
] as const

/**
 * Atalhos que saem do fluxo linear.
 *
 * Solicitação cujos itens já estão em estoque não passa pelo Financeiro: da
 * aprovação ela é liberada para envio.
 *
 * O atalho **parte de `aguardando_aprovacao`**, e é isso que importa: ele pula
 * o Financeiro, nunca a aprovação. Nada sai do pedido do consultor direto para
 * a expedição: alguém precisa dar o OK antes, e é esse OK que libera o envio.
 *
 * Quem decide se o atalho aparece é a tela, olhando os itens
 * (`precisaDeCompra`); aqui só se declara que ele é uma transição válida.
 */
const ATALHOS: Partial<Record<StatusSolicitacao, readonly StatusSolicitacao[]>> = {
  [StatusSolicitacao.aguardando_aprovacao]: [StatusSolicitacao.organizando_envio],
}

/** Status a partir dos quais uma devolução faz sentido. */
const A_PARTIR_DE_ENTREGUE: readonly StatusSolicitacao[] = [
  StatusSolicitacao.entregue,
  StatusSolicitacao.cliente_confirmou,
] as const

export const STATUS_TERMINAIS: readonly StatusSolicitacao[] = [
  StatusSolicitacao.cliente_confirmou,
  StatusSolicitacao.devolvido,
  StatusSolicitacao.cancelado,
] as const

/** Status que exigem motivo preenchido, gravado no histórico. */
export const STATUS_QUE_EXIGEM_MOTIVO: readonly StatusSolicitacao[] = [
  StatusSolicitacao.deu_problema,
  StatusSolicitacao.devolvido,
  StatusSolicitacao.cancelado,
] as const

/**
 * Status que não contam para o saldo gasto no mês.
 *
 * Vazio de propósito. A spec dizia para excluir cancelados e devolvidos, mas a
 * área corrigiu: uma devolução normalmente vira reenvio, então o dinheiro
 * continua comprometido e tirar esses casos da conta subestimaria o gasto.
 *
 * Mantido como lista, e não removido, porque a pergunta "isto conta no saldo?"
 * segue sendo uma decisão de negócio: se um dia algum status deixar de contar,
 * ele entra aqui e vale para o saldo, para o painel e para a exportação de uma
 * vez só.
 */
export const STATUS_FORA_DO_SALDO: readonly StatusSolicitacao[] = [] as const

export const ROTULO_STATUS: Record<StatusSolicitacao, string> = {
  pendente: 'Pendente',
  aguardando_aprovacao: 'Aguardando aprovação',
  aguardando_compra: 'Aguardando compra',
  comprado: 'Comprado',
  organizando_envio: 'Organizando envio',
  entregue: 'Entregue / rastreio finalizado',
  cliente_confirmou: 'Cliente confirmou recebimento',
  deu_problema: 'Deu problema',
  devolvido: 'Devolvido',
  cancelado: 'Cancelado',
}

export function ehTerminal(status: StatusSolicitacao): boolean {
  return STATUS_TERMINAIS.includes(status)
}

export function exigeMotivo(status: StatusSolicitacao): boolean {
  return STATUS_QUE_EXIGEM_MOTIVO.includes(status)
}

export function contaNoSaldo(status: StatusSolicitacao): boolean {
  return !STATUS_FORA_DO_SALDO.includes(status)
}

/**
 * Lista os status para os quais uma solicitação pode ir a partir do atual.
 * É a fonte única: a tela do Admin monta o seletor com isso, e a action de
 * mudança de status valida com isso.
 */
export function transicoesPermitidas(atual: StatusSolicitacao): StatusSolicitacao[] {
  if (ehTerminal(atual)) return []

  // De "deu problema" volta-se para qualquer etapa anterior do fluxo linear,
  // ou cancela-se. Não se sabe de onde veio, então o fluxo inteiro é oferecido
  // e o Admin escolhe; o histórico registra a origem.
  if (atual === StatusSolicitacao.deu_problema) {
    return [...FLUXO_LINEAR, StatusSolicitacao.cancelado]
  }

  const indice = FLUXO_LINEAR.indexOf(atual)
  const proximos: StatusSolicitacao[] = []

  // Próxima etapa do fluxo linear.
  const proximo = indice >= 0 ? FLUXO_LINEAR[indice + 1] : undefined
  if (proximo) proximos.push(proximo)

  // Atalhos declarados: hoje, aprovação direto para expedição.
  for (const atalho of ATALHOS[atual] ?? []) {
    if (!proximos.includes(atalho)) proximos.push(atalho)
  }

  // "Deu problema" é acionável de qualquer status vivo.
  proximos.push(StatusSolicitacao.deu_problema)

  // "Devolvido" só a partir de entregue.
  if (A_PARTIR_DE_ENTREGUE.includes(atual)) {
    proximos.push(StatusSolicitacao.devolvido)
  }

  proximos.push(StatusSolicitacao.cancelado)

  return proximos
}

export function transicaoPermitida(atual: StatusSolicitacao, novo: StatusSolicitacao): boolean {
  return transicoesPermitidas(atual).includes(novo)
}

/**
 * Os dois passos de quem compra, que pedem `compras.operar`: marcar como comprado
 * e liberar o que foi comprado para envio. A saída direta da aprovação para a
 * expedição não está aqui, porque o que está em estoque não passa pela compra.
 */
export function ehPassoDeCompra(atual: StatusSolicitacao, novo: StatusSolicitacao): boolean {
  return (
    (atual === StatusSolicitacao.aguardando_compra && novo === StatusSolicitacao.comprado) ||
    (atual === StatusSolicitacao.comprado && novo === StatusSolicitacao.organizando_envio)
  )
}

/**
 * Quando a expedição pode dar o pedido como entregue. Sem rastreio não há o que
 * acompanhar: quem marca precisa ter visto o pedido sair.
 */
export function podeMarcarEntregue(status: StatusSolicitacao, rastreio: string | null): boolean {
  return status === StatusSolicitacao.organizando_envio && Boolean(rastreio)
}

export type ResultadoValidacao = { ok: true } | { ok: false; erro: string }

/**
 * Valida uma mudança de status completa, motivo incluído.
 * Chamada pela server action antes de qualquer escrita.
 */
export function validarMudancaDeStatus(
  atual: StatusSolicitacao,
  novo: StatusSolicitacao,
  motivo?: string | null,
): ResultadoValidacao {
  if (atual === novo) {
    return { ok: false, erro: 'A solicitação já está nesse status.' }
  }

  if (ehTerminal(atual)) {
    return {
      ok: false,
      erro: `"${ROTULO_STATUS[atual]}" é um status final e não admite mudança.`,
    }
  }

  if (!transicaoPermitida(atual, novo)) {
    return {
      ok: false,
      erro: `Não é possível ir de "${ROTULO_STATUS[atual]}" para "${ROTULO_STATUS[novo]}".`,
    }
  }

  if (exigeMotivo(novo) && !motivo?.trim()) {
    return {
      ok: false,
      erro: `"${ROTULO_STATUS[novo]}" exige o preenchimento do motivo.`,
    }
  }

  return { ok: true }
}

/**
 * Uma solicitação precisa passar pelo Financeiro?
 *
 * Quem responde é a **origem do produto**, que na planilha do catálogo é a
 * coluna "Estoque": "Estoque interno" já está na prateleira, "Mediante pedido"
 * é comprado quando alguém pede.
 *
 * A quantidade em estoque é um refinamento opcional, e não o critério: a área
 * não conta peça a peça hoje. Um produto de prateleira que *também* controle
 * quantidade e esteja sem saldo vai ao Financeiro; sem controle de quantidade,
 * prateleira significa prateleira.
 *
 * Precisa de compra:
 * - presente específico (é comprado num site, por definição);
 * - produto comprado sob demanda;
 * - produto de prateleira que controla quantidade e está sem saldo.
 */
export type ItemParaDecisao = {
  produtoId: string | null
  quantidade: number
  produto?: {
    origem: OrigemProduto
    controlaEstoque: boolean
    estoque: number | null
  } | null
}

export function precisaDeCompra(itens: readonly ItemParaDecisao[]): boolean {
  return itens.some((item) => {
    if (!item.produtoId || !item.produto) return true
    if (item.produto.origem === OrigemProduto.mediante_pedido) return true
    if (!item.produto.controlaEstoque) return false
    return (item.produto.estoque ?? 0) < item.quantidade
  })
}

/**
 * Próximo status sugerido depois da aprovação: expedição quando está tudo em
 * estoque, Financeiro quando há o que comprar.
 */
export function proximoDepoisDaAprovacao(itens: readonly ItemParaDecisao[]): StatusSolicitacao {
  return precisaDeCompra(itens)
    ? StatusSolicitacao.aguardando_compra
    : StatusSolicitacao.organizando_envio
}

/**
 * Caminho até o encaminhamento pedido, em um ou dois passos.
 *
 * O Admin trabalha por pilha: chegam vinte pedidos e ele decide de uma vez
 * quais vão comprar e quais já podem ser separados. Só que "pendente" não vira
 * "organizando envio" num salto, a aprovação é justamente o OK que falta, e
 * ela precisa aparecer no histórico.
 *
 * Então esta função devolve os passos a percorrer, e cada passo vira uma linha
 * de histórico. Nunca inventa uma transição: cada salto passa por
 * `transicaoPermitida`, a mesma função que a tela do detalhe usa.
 *
 * `automatico` significa "aprove e mande para onde tiver de ir": expedição
 * quando está tudo em estoque, Financeiro quando há o que comprar.
 */
export type Encaminhamento = StatusSolicitacao | 'automatico'

export type CaminhoDeEncaminhamento =
  { ok: true; passos: StatusSolicitacao[] } | { ok: false; erro: string }

export function caminhoDeEncaminhamento(
  atual: StatusSolicitacao,
  destino: Encaminhamento,
  itens: readonly ItemParaDecisao[],
): CaminhoDeEncaminhamento {
  const alvo =
    destino === 'automatico'
      ? atual === StatusSolicitacao.pendente || atual === StatusSolicitacao.aguardando_aprovacao
        ? proximoDepoisDaAprovacao(itens)
        : null
      : destino

  if (!alvo) {
    return {
      ok: false,
      erro: `"${ROTULO_STATUS[atual]}" não tem encaminhamento automático: escolha o destino.`,
    }
  }

  if (atual === alvo) {
    return { ok: false, erro: `Já está em "${ROTULO_STATUS[alvo]}".` }
  }

  if (transicaoPermitida(atual, alvo)) {
    return { ok: true, passos: [alvo] }
  }

  // O caso que dá o segundo passo: falta a aprovação no meio. É o OK do Admin,
  // e ele fica registrado como uma linha própria do histórico.
  const aprovacao = StatusSolicitacao.aguardando_aprovacao
  if (transicaoPermitida(atual, aprovacao) && transicaoPermitida(aprovacao, alvo)) {
    return { ok: true, passos: [aprovacao, alvo] }
  }

  return {
    ok: false,
    erro: `Não é possível ir de "${ROTULO_STATUS[atual]}" para "${ROTULO_STATUS[alvo]}".`,
  }
}

/**
 * O que está esperando o OK do Admin. Os dois status dizem a mesma coisa para
 * quem usa, e toda solicitação nasce em `pendente`; aprovar anda pelos dois.
 */
export const STATUS_PARA_APROVAR: readonly StatusSolicitacao[] = [
  StatusSolicitacao.pendente,
  StatusSolicitacao.aguardando_aprovacao,
] as const

export type ProximoPasso = {
  destino: StatusSolicitacao
  /** O texto do botão: diz o que aconteceu, e não o nome do status. */
  rotulo: string
  explicacao: string
  /** Aprovar anda um ou dois status de uma vez, pelo caminho do lote. */
  aprovacao: boolean
}

/**
 * O passo natural de quem opera a solicitação, para virar um botão em vez de
 * uma escolha numa lista de status. Fora do fluxo feliz não há passo natural:
 * "deu problema" e os finais pedem decisão, e seguem na lista.
 */
export function proximoPasso(
  status: StatusSolicitacao,
  itens: readonly ItemParaDecisao[],
): ProximoPasso | null {
  switch (status) {
    case StatusSolicitacao.pendente:
    case StatusSolicitacao.aguardando_aprovacao: {
      const destino = proximoDepoisDaAprovacao(itens)
      return {
        destino,
        rotulo: `Aprovar e mandar para ${ROTULO_STATUS[destino]}`,
        explicacao:
          destino === StatusSolicitacao.organizando_envio
            ? 'Tudo em estoque: vai direto para a expedição, sem passar pelo Financeiro.'
            : 'Há o que comprar: vai para a fila do Financeiro antes da expedição.',
        aprovacao: true,
      }
    }
    case StatusSolicitacao.aguardando_compra:
      return {
        destino: StatusSolicitacao.comprado,
        rotulo: 'Marcar como comprado',
        explicacao: 'Todos os itens desta solicitação foram comprados.',
        aprovacao: false,
      }
    case StatusSolicitacao.comprado:
      return {
        destino: StatusSolicitacao.organizando_envio,
        rotulo: 'Liberar para envio',
        explicacao: 'Vai para a fila da expedição e vira pedido no Tiny.',
        aprovacao: false,
      }
    case StatusSolicitacao.organizando_envio:
      return {
        destino: StatusSolicitacao.entregue,
        rotulo: 'Marcar como entregue',
        explicacao: 'O rastreio não muda o status: entregue é decisão de quem acompanha.',
        aprovacao: false,
      }
    case StatusSolicitacao.entregue:
      return {
        destino: StatusSolicitacao.cliente_confirmou,
        rotulo: 'Cliente confirmou o recebimento',
        explicacao: 'Encerra a solicitação.',
        aprovacao: false,
      }
    default:
      return null
  }
}

/** A frase de cada status para quem pediu: quem age agora, e o que vem depois. */
const O_QUE_ACONTECE_AGORA: Record<StatusSolicitacao, string> = {
  pendente: 'Aguardando a aprovação do Relacionamento. Nada foi comprado nem enviado ainda.',
  aguardando_aprovacao:
    'Aguardando a aprovação do Relacionamento. Nada foi comprado nem enviado ainda.',
  aguardando_compra: 'Aprovada. Agora o Financeiro compra os itens.',
  comprado: 'Itens comprados. Falta liberar para a expedição.',
  organizando_envio:
    'Na expedição: a Logística separa e posta. O rastreio aparece aqui quando sair.',
  entregue: 'Entregue. Falta confirmar o recebimento com o cliente.',
  cliente_confirmou: 'Concluída: o cliente confirmou o recebimento.',
  deu_problema:
    'Deu problema no caminho. O motivo está no histórico, e o Relacionamento decide como segue.',
  devolvido: 'Devolvida. O motivo está no histórico.',
  cancelado: 'Cancelada. O motivo está no histórico.',
}

export function oQueAconteceAgora(status: StatusSolicitacao): string {
  return O_QUE_ACONTECE_AGORA[status]
}
