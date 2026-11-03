import type { Perfil } from '@prisma/client'
import { pode, type Acao } from './permissions'

/**
 * Os tours guiados, um por perfil: o que cada um mostra e em que ordem.
 *
 * Adaptado do `Tour` do Design System (`armandoauvp/central`). Lá o passo aponta
 * para um elemento dentro de uma caixa de demonstração; aqui ele aponta para a
 * tela de verdade e leva a pessoa até ela, então cada passo diz a `rota` e o
 * `alvo`, o valor do atributo `data-tour` na tela.
 *
 * Cada passo declara a permissão que o torna verdadeiro: o tour nunca aponta
 * para o que o perfil não pode usar, mesmo que a matriz mude depois.
 *
 * Sem o alvo na tela, como numa lista vazia ou no menu recolhido do celular, o
 * passo aparece centralizado: o texto continua valendo.
 */
export type PassoDoTour = {
  rota: string
  alvo: string
  titulo: string
  texto: string
  acao: Acao
}

const CONTA: PassoDoTour = {
  rota: '',
  alvo: 'conta',
  titulo: 'Para rever depois',
  texto: 'Este tour fica no menu da sua conta, em "Ver o tour". Pode abrir quando quiser.',
  acao: 'catalogo.ver',
}

/** O caminho do presente: é o mesmo para o Admin geral e o de Relacionamento. */
const GESTAO_DOS_PRESENTES: readonly PassoDoTour[] = [
  {
    rota: '/',
    alvo: 'para-aprovar',
    titulo: 'O que espera o seu OK',
    texto:
      'Toda solicitação nova chega aqui. Nada é comprado nem enviado sem a sua aprovação. No dia a dia, é só clicar neste cartão para abrir a lista.',
    acao: 'solicitacao.aprovar',
  },
  {
    rota: '/admin/solicitacoes',
    alvo: 'lista-gestao',
    titulo: 'Aprovar um ou vários',
    texto:
      'Clique no código para abrir e use o botão "Aprovar". Para vários, marque as caixinhas e use "Aprovar e encaminhar". A coluna Rota diz se vai para compra ou sai do estoque.',
    acao: 'solicitacao.alterarStatus',
  },
  {
    rota: '/admin/solicitacoes',
    alvo: 'filtros-gestao',
    titulo: 'Encontrar e exportar',
    texto: 'Filtre por período, consultor ou status. A exportação leva o mesmo recorte da tela.',
    acao: 'exportar',
  },
  {
    rota: '/admin/catalogo',
    alvo: 'lista-produtos',
    titulo: 'Presentes e preços',
    texto:
      'Cadastre, edite preço e foto, ou tire um presente do catálogo. As solicitações já feitas não mudam.',
    acao: 'catalogo.gerenciar',
  },
  {
    rota: '/admin/cartas',
    alvo: 'modelos-carta',
    titulo: 'Guia e sugestões para a carta',
    texto:
      'O guia de escrita, logo acima, e os textos que o consultor vê ao escrever a carta, por motivo. Edite sem pedir a ninguém.',
    acao: 'carta.gerenciarModelos',
  },
]

/** A operação: é a mesma para o time e para o Admin de Logística. */
const OPERACAO_DA_LOGISTICA: readonly PassoDoTour[] = [
  {
    rota: '/logistica',
    alvo: 'status-semana',
    titulo: 'Como está a operação',
    texto: 'A situação da semana, sugerida pelos números. Vocês podem definir à mão, com o motivo.',
    acao: 'logistica.gerenciar',
  },
  {
    rota: '/logistica',
    alvo: 'trilha',
    titulo: 'A trilha de demandas',
    texto:
      'Tudo em andamento no período. Cadastre em "Nova demanda"; o presente aprovado entra sozinho. Dá para ordenar por data e filtrar clicando nos selos.',
    acao: 'logistica.gerenciar',
  },
  {
    rota: '/logistica',
    alvo: 'envios-demanda',
    titulo: 'Lançar o que saiu',
    texto:
      'Tarefa longa recebe os envios de cada semana aqui, sem criar outra demanda. O total alimenta o fechamento do mês.',
    acao: 'logistica.gerenciar',
  },
  {
    rota: '/expedicao',
    alvo: 'lista-expedicao',
    titulo: 'Separar e postar',
    texto:
      'Os pedidos liberados, com itens e endereço. Registre o rastreio aqui: o consultor lê na solicitação dele.',
    acao: 'expedicao.registrarRastreio',
  },
  {
    rota: '/tiny',
    alvo: 'painel-tiny',
    titulo: 'O Tiny',
    texto: 'O que está indo para o Tiny e o que falhou. Situação e rastreio voltam sozinhos de lá.',
    acao: 'tiny.operar',
  },
]

const TOURS: Record<Perfil, readonly PassoDoTour[]> = {
  admin: [
    ...GESTAO_DOS_PRESENTES,
    {
      rota: '/admin/usuarios',
      alvo: 'lista-usuarios',
      titulo: 'Quem faz o quê',
      texto:
        'Quem entra pela primeira vez vira Consultor. Aqui você define o perfil e o limite mensal de cada um.',
      acao: 'usuario.gerenciar',
    },
    CONTA,
  ],
  admin_relacionamento: [
    ...GESTAO_DOS_PRESENTES,
    {
      rota: '/admin/usuarios',
      alvo: 'lista-usuarios',
      titulo: 'Os seus consultores',
      texto:
        'Quem entra pela primeira vez já aparece aqui como Consultor. Defina o limite mensal e desative quem saiu do time.',
      acao: 'usuario.definirLimite',
    },
    CONTA,
  ],
  admin_logistica: [
    ...OPERACAO_DA_LOGISTICA,
    {
      rota: '/admin/solicitacoes',
      alvo: 'lista-gestao',
      titulo: 'As solicitações, para consulta',
      texto:
        'Todas as solicitações, para responder sobre um envio. A aprovação e o status ficam com o Relacionamento e o Financeiro.',
      acao: 'solicitacao.verTodas',
    },
    {
      rota: '/admin/usuarios',
      alvo: 'lista-usuarios',
      titulo: 'O seu time',
      texto:
        'Quem entra pela primeira vez vira Consultor. Aqui você põe a pessoa na Logística, devolve a Consultor e desativa quem saiu.',
      acao: 'usuario.gerenciar',
    },
    CONTA,
  ],
  consultor: [
    {
      rota: '/',
      alvo: 'nova-solicitacao',
      titulo: 'Enviar um presente',
      texto: 'É por aqui que tudo começa: cliente, presente, entrega e a carta.',
      acao: 'solicitacao.criar',
    },
    {
      rota: '/catalogo',
      alvo: 'grade-catalogo',
      titulo: 'O catálogo',
      texto:
        'Os presentes disponíveis, com valor e se saem do estoque ou são comprados sob pedido.',
      acao: 'catalogo.ver',
    },
    {
      rota: '/solicitacoes/nova',
      alvo: 'etapas-solicitacao',
      titulo: 'Cinco etapas',
      texto:
        'Nada é enviado antes da última. O "Continuar" mostra o que falta preencher, e dá para voltar a qualquer etapa já feita.',
      acao: 'solicitacao.criar',
    },
    {
      rota: '/solicitacoes/nova',
      alvo: 'resumo-solicitacao',
      titulo: 'O resumo',
      texto: 'O que já foi escolhido, o total e por onde o pedido passa depois da aprovação.',
      acao: 'solicitacao.criar',
    },
    {
      rota: '/solicitacoes',
      alvo: 'lista-minhas',
      titulo: 'Acompanhar',
      texto:
        'Abra uma solicitação para ver quem age agora, o histórico e o rastreio, sem precisar perguntar a ninguém.',
      acao: 'solicitacao.verProprias',
    },
    CONTA,
  ],
  financeiro: [
    {
      rota: '/',
      alvo: 'nav-compras',
      titulo: 'A sua fila',
      texto: 'O que o Relacionamento aprovou e precisa ser comprado aparece na Fila de compras.',
      acao: 'compras.verFila',
    },
    {
      rota: '/financeiro/compras',
      alvo: 'lista-compras',
      titulo: 'O que comprar e onde',
      texto: 'Um item por linha, com o valor e o site. O código abre a solicitação inteira.',
      acao: 'compras.verFila',
    },
    {
      rota: '/financeiro/compras',
      alvo: 'passo-fila',
      titulo: 'Comprou? Marque aqui',
      texto:
        'Primeiro "Marcar como comprado", depois "Liberar para envio", que manda para a expedição e gera o pedido no Tiny.',
      acao: 'compras.operar',
    },
    {
      rota: '/admin/solicitacoes',
      alvo: 'lista-gestao',
      titulo: 'A visão completa',
      texto:
        'Todas as solicitações, com filtro e exportação. Cancelar ou registrar problema é por aqui.',
      acao: 'solicitacao.verTodas',
    },
    CONTA,
  ],
  logistica: [...OPERACAO_DA_LOGISTICA, CONTA],
}

/** Os passos do perfil, só os que ele pode de fato usar. */
export function passosDoTour(perfil: Perfil): PassoDoTour[] {
  return TOURS[perfil].filter((p) => pode(perfil, p.acao))
}

/**
 * Abre sozinho só na primeira tela do tour: a pessoa pode ter entrado por um
 * link no meio de uma solicitação, e o tour a tiraria dali, perdendo o rascunho.
 */
export function abreSozinho(perfil: Perfil, jaViu: boolean, caminho: string): boolean {
  if (jaViu) return false
  return passosDoTour(perfil)[0]?.rota === caminho
}

/** Onde ficar enquanto o passo não pede outra tela: `rota` vazia vale para qualquer uma. */
export function rotaDoPasso(passo: PassoDoTour, caminhoAtual: string): string | null {
  if (!passo.rota) return null
  return passo.rota === caminhoAtual ? null : passo.rota
}
