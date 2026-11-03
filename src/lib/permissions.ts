import { Perfil } from '@prisma/client'

/**
 * Matriz de permissões (seção 3 da spec).
 *
 * Tudo passa por aqui: menu, guarda de rota e server action consultam a mesma
 * tabela, para que esconder um botão e bloquear a ação nunca divirjam.
 *
 * O perfil Financeiro veio "a definir" na spec e foi definido pela área depois:
 * recebe as solicitações enviadas para compra, com data, produto, valor e
 * site: e altera o status do pedido. É o que está implementado abaixo:
 * `compras.verFila` e `solicitacao.alterarStatus`.
 *
 * `expedicao.verFila` e `expedicao.registrarRastreio` não pertencem a um perfil
 * novo: a expedição trabalha fora desta ferramenta, e quem exporta o pedido
 * para ela: e depois anota o rastreio que ela devolve, é quem já enxerga
 * tudo: Admin e Financeiro. O consultor lê o rastreio, não o escreve.
 *
 * O acesso a dados sensíveis do cliente segue liberado para o Financeiro por
 * coerência com a permissão de exportar, já que a exportação da spec carrega
 * CPF, telefone e endereço. Único ponto ainda não confirmado do perfil, e por
 * isso isolado em `PENDENTE_CONFIRMACAO`.
 * Ver docs/05-perguntas-em-aberto.md.
 *
 * O perfil Logística entrou com o Dashboard Logístico (ADR 0008). O dashboard
 * é leitura para a empresa inteira, a proposta pede "leitura rápida por
 * qualquer colaborador", então `logistica.ver` vale para todos os perfis. O
 * que é só do time: definir o status da semana, cuidar de equipe e FAQ, e ler
 * as observações das demandas, que podem trazer nome e endereço de cliente.
 * O time também opera a expedição, que até aqui era feita fora da ferramenta.
 *
 * Há um admin por área, ao lado do Admin geral, que continua podendo tudo e é o
 * único que promove alguém a admin. O de Relacionamento aprova, cuida do catálogo
 * e gerencia os consultores; o de Logística opera como o time e vê as solicitações
 * sem alterá-las. Até onde cada um mexe em Usuários é `perfisAoAlcance`.
 */

export const ACOES = [
  'catalogo.ver',
  'catalogo.gerenciar',
  'carta.gerenciarModelos',
  'compras.verFila',
  'compras.operar',
  'expedicao.verFila',
  'expedicao.registrarRastreio',
  'solicitacao.criar',
  'solicitacao.verProprias',
  'solicitacao.verTodas',
  'solicitacao.editar',
  'solicitacao.alterarStatus',
  'solicitacao.aprovar',
  'cliente.verDadosSensiveis',
  'cliente.gerenciar',
  'usuario.gerenciar',
  'usuario.definirLimite',
  'exportar',
  'saldo.verProprio',
  'saldo.verTodos',
  'logistica.ver',
  'logistica.verObservacoes',
  'logistica.gerenciar',
  'tiny.operar',
] as const

export type Acao = (typeof ACOES)[number]

/**
 * Escopo de uma permissão de leitura.
 * `proprias` significa: só os registros ligados ao próprio usuário.
 */
export type Escopo = 'nenhum' | 'proprias' | 'todas'

/**
 * Único ponto do perfil Financeiro ainda sem confirmação da área.
 * Isolado aqui para que a resposta vire a alteração de uma linha.
 */
const PENDENTE_CONFIRMACAO = {
  /**
   * Proposta: as observações das demandas ficam só com Logística e Admin.
   * Vêm do ClickUp em texto livre, e é onde aparecem nome e endereço de quem
   * recebe. Virar `true` abre para todos os perfis que veem o dashboard.
   */
  todosVeemObservacoesDaLogistica: false,
  /**
   * Proposta: Financeiro vê dados sensíveis de todos os clientes.
   * A lista que a área pediu para a fila de compras, data, produto, valor,
   * site: não inclui CPF nem endereço, mas a permissão de exportar concedida
   * pela spec traz esses campos junto. Mantido `true` para não deixar a
   * exportação incoerente; virar `false` restringe os dois lugares de uma vez.
   */
  financeiroVeDadosSensiveis: true,
} as const

const MATRIZ: Record<Perfil, Record<Acao, boolean>> = {
  [Perfil.consultor]: {
    'catalogo.ver': true,
    'catalogo.gerenciar': false,
    'carta.gerenciarModelos': false,
    'compras.verFila': false,
    'compras.operar': false,
    'expedicao.verFila': false,
    'expedicao.registrarRastreio': false,
    'solicitacao.criar': true,
    'solicitacao.verProprias': true,
    'solicitacao.verTodas': false,
    'solicitacao.editar': false,
    'solicitacao.alterarStatus': false,
    'solicitacao.aprovar': false,
    'cliente.verDadosSensiveis': true, // limitado pelo escopo `proprias`
    'cliente.gerenciar': false,
    'usuario.gerenciar': false,
    'usuario.definirLimite': false,
    exportar: false,
    'saldo.verProprio': true,
    'saldo.verTodos': false,
    'logistica.ver': true,
    'logistica.verObservacoes': PENDENTE_CONFIRMACAO.todosVeemObservacoesDaLogistica,
    'logistica.gerenciar': false,
    'tiny.operar': false,
  },
  [Perfil.admin]: {
    'catalogo.ver': true,
    'catalogo.gerenciar': true,
    'carta.gerenciarModelos': true,
    'compras.verFila': true,
    'compras.operar': true,
    'expedicao.verFila': true,
    'expedicao.registrarRastreio': true,
    'solicitacao.criar': true,
    'solicitacao.verProprias': true,
    'solicitacao.verTodas': true,
    'solicitacao.editar': true,
    'solicitacao.alterarStatus': true,
    // O OK que libera a compra ou o envio é do Admin: é para ele a fila de aprovação.
    'solicitacao.aprovar': true,
    'cliente.verDadosSensiveis': true,
    'cliente.gerenciar': true,
    'usuario.gerenciar': true,
    'usuario.definirLimite': true,
    exportar: true,
    'saldo.verProprio': true,
    'saldo.verTodos': true,
    'logistica.ver': true,
    'logistica.verObservacoes': true,
    'logistica.gerenciar': true,
    'tiny.operar': true,
  },
  [Perfil.admin_relacionamento]: {
    'catalogo.ver': true,
    'catalogo.gerenciar': true,
    'carta.gerenciarModelos': true,
    // Acompanha a compra e a expedição, mas quem marca é quem compra e quem posta.
    'compras.verFila': true,
    'compras.operar': false,
    'expedicao.verFila': true,
    'expedicao.registrarRastreio': false,
    'solicitacao.criar': true,
    'solicitacao.verProprias': true,
    'solicitacao.verTodas': true,
    'solicitacao.editar': true,
    'solicitacao.alterarStatus': true,
    'solicitacao.aprovar': true,
    'cliente.verDadosSensiveis': true,
    'cliente.gerenciar': true,
    'usuario.gerenciar': true,
    'usuario.definirLimite': true,
    exportar: true,
    'saldo.verProprio': true,
    'saldo.verTodos': true,
    'logistica.ver': true,
    'logistica.verObservacoes': PENDENTE_CONFIRMACAO.todosVeemObservacoesDaLogistica,
    'logistica.gerenciar': false,
    'tiny.operar': false,
  },
  [Perfil.admin_logistica]: {
    'catalogo.ver': true,
    'catalogo.gerenciar': false,
    'carta.gerenciarModelos': false,
    'compras.verFila': false,
    'compras.operar': false,
    'expedicao.verFila': true,
    'expedicao.registrarRastreio': true,
    'solicitacao.criar': false,
    'solicitacao.verProprias': false,
    // Lê para responder sobre um envio, sem mexer no que é do Relacionamento.
    'solicitacao.verTodas': true,
    'solicitacao.editar': false,
    'solicitacao.alterarStatus': false,
    'solicitacao.aprovar': false,
    'cliente.verDadosSensiveis': true,
    'cliente.gerenciar': false,
    'usuario.gerenciar': true,
    // O limite é o orçamento do consultor, e esse é do Relacionamento.
    'usuario.definirLimite': false,
    exportar: false,
    'saldo.verProprio': false,
    'saldo.verTodos': false,
    'logistica.ver': true,
    'logistica.verObservacoes': true,
    'logistica.gerenciar': true,
    'tiny.operar': true,
  },
  [Perfil.financeiro]: {
    'catalogo.ver': true,
    'catalogo.gerenciar': false,
    'carta.gerenciarModelos': false,
    'compras.verFila': true,
    'compras.operar': true,
    'expedicao.verFila': true,
    'expedicao.registrarRastreio': true,
    'solicitacao.criar': false,
    'solicitacao.verProprias': true,
    'solicitacao.verTodas': true,
    'solicitacao.editar': false,
    // Definido pela área: o Financeiro altera o status do pedido.
    'solicitacao.alterarStatus': true,
    'solicitacao.aprovar': false,
    'cliente.verDadosSensiveis': PENDENTE_CONFIRMACAO.financeiroVeDadosSensiveis,
    'cliente.gerenciar': false,
    'usuario.gerenciar': false,
    'usuario.definirLimite': false,
    exportar: true,
    'saldo.verProprio': true,
    'saldo.verTodos': true,
    'logistica.ver': true,
    'logistica.verObservacoes': PENDENTE_CONFIRMACAO.todosVeemObservacoesDaLogistica,
    'logistica.gerenciar': false,
    'tiny.operar': false,
  },
  [Perfil.logistica]: {
    'catalogo.ver': true,
    'catalogo.gerenciar': false,
    'carta.gerenciarModelos': false,
    'compras.verFila': false,
    'compras.operar': false,
    // Quem separa e posta é o time, então a fila e o rastreio são dele.
    'expedicao.verFila': true,
    'expedicao.registrarRastreio': true,
    'solicitacao.criar': false,
    'solicitacao.verProprias': false,
    'solicitacao.verTodas': false,
    'solicitacao.editar': false,
    'solicitacao.alterarStatus': false,
    'solicitacao.aprovar': false,
    // O endereço de envio está na fila da expedição, e sem ele não há envio.
    'cliente.verDadosSensiveis': true,
    'cliente.gerenciar': false,
    'usuario.gerenciar': false,
    'usuario.definirLimite': false,
    exportar: false,
    'saldo.verProprio': false,
    'saldo.verTodos': false,
    'logistica.ver': true,
    'logistica.verObservacoes': true,
    'logistica.gerenciar': true,
    // Quem expede é quem acompanha os pedidos no Tiny e importa os lotes.
    'tiny.operar': true,
  },
}

export function pode(perfil: Perfil, acao: Acao): boolean {
  return MATRIZ[perfil][acao]
}

/**
 * Escopo de leitura de solicitações.
 *
 * Consultor enxerga só as próprias, critério de aceite explícito da spec.
 * Admin e Financeiro enxergam todas.
 */
export function escopoDeSolicitacoes(perfil: Perfil): Escopo {
  if (pode(perfil, 'solicitacao.verTodas')) return 'todas'
  if (pode(perfil, 'solicitacao.verProprias')) return 'proprias'
  return 'nenhum'
}

/**
 * Escopo de leitura de dados sensíveis do cliente (CPF, telefone, endereço).
 * O consultor só vê os dados dos clientes das próprias solicitações.
 */
export function escopoDeDadosSensiveis(perfil: Perfil): Escopo {
  if (!pode(perfil, 'cliente.verDadosSensiveis')) return 'nenhum'
  return perfil === Perfil.consultor ? 'proprias' : 'todas'
}

/**
 * Filtro do Prisma correspondente ao escopo do usuário.
 * Quem chama nunca decide sozinho o `where` de consultor.
 */
export function filtroDeSolicitacoes(
  perfil: Perfil,
  usuarioId: string,
): { consultorId?: string } | null {
  const escopo = escopoDeSolicitacoes(perfil)
  if (escopo === 'todas') return {}
  if (escopo === 'proprias') return { consultorId: usuarioId }
  return null
}

/**
 * Quem começa pelo painel da Logística em vez do resumo de solicitações: quem
 * cuida da operação e não pede presente.
 */
export function comecaNaLogistica(perfil: Perfil): boolean {
  return pode(perfil, 'logistica.gerenciar') && !pode(perfil, 'solicitacao.criar')
}

/**
 * Os perfis que cada um enxerga e atribui em Usuários. Vale para os dois lados:
 * só mexe em quem está num destes perfis, e só pode pôr a pessoa num deles. Por
 * isso o Admin de Logística não rebaixa um admin nem tira alguém do Financeiro.
 *
 * Ao Relacionamento cabe um perfil só: gerencia consultores sem mudar o perfil
 * deles.
 */
const PERFIS_AO_ALCANCE: Partial<Record<Perfil, readonly Perfil[]>> = {
  [Perfil.admin]: Object.values(Perfil),
  [Perfil.admin_relacionamento]: [Perfil.consultor],
  [Perfil.admin_logistica]: [Perfil.consultor, Perfil.logistica],
}

export function perfisAoAlcance(perfil: Perfil): readonly Perfil[] {
  return PERFIS_AO_ALCANCE[perfil] ?? []
}

/** Por que este perfil não pode fazer esta mudança, ou nulo quando pode. */
export function problemaAoMudarPerfil(
  quemMuda: Perfil,
  perfilAtual: Perfil,
  perfilNovo: Perfil,
): string | null {
  const alcance = perfisAoAlcance(quemMuda)
  if (!alcance.includes(perfilAtual)) {
    return `Seu perfil não gerencia quem é ${ROTULO_PERFIL[perfilAtual]}.`
  }
  if (!alcance.includes(perfilNovo)) {
    return `Seu perfil não pode transformar alguém em ${ROTULO_PERFIL[perfilNovo]}.`
  }
  return null
}

export const ROTULO_PERFIL: Record<Perfil, string> = {
  consultor: 'Consultor',
  admin: 'Admin geral',
  admin_relacionamento: 'Admin Relacionamento',
  admin_logistica: 'Admin Logística',
  financeiro: 'Financeiro',
  logistica: 'Logística',
}

/**
 * Perfil com que a sessão enxerga a ferramenta.
 *
 * Na fase de testes (`PERFIL_LIVRE`), quem entra escolhe no menu da conta e o
 * escolhido vale por cima do cadastrado. Desligada a fase, volta o cadastrado
 * na navegação seguinte, sem ninguém precisar sair; por isso a escolha mora no
 * token, e não na coluna `perfil`, que segue sendo a delimitação de verdade.
 */
export function perfilEmVigor(cadastrado: Perfil, escolhido: unknown, livre: boolean): Perfil {
  if (!livre) return cadastrado
  const valido = (Object.values(Perfil) as unknown[]).includes(escolhido)
  return valido ? (escolhido as Perfil) : cadastrado
}
