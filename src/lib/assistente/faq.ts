import type { Perfil } from '@prisma/client'
import { pode, type Acao } from '@/lib/permissions'

/**
 * Perguntas frequentes da Caixinha, o assistente da plataforma.
 *
 * Não há IA: é uma FAQ que a pessoa pesquisa, com a tela certa ao lado de cada
 * resposta. Cada pergunta diz para quem vale pela mesma matriz de
 * `permissions.ts`, então ninguém lê como fazer algo que não pode fazer. Quem
 * pergunta o que é de outro perfil recebe a resposta "quem faz", que existe
 * justamente para isso.
 *
 * Ao mudar uma tela de lugar ou uma regra de fluxo, revise as respostas daqui.
 */
export type ItemDaFaq = {
  id: string
  pergunta: string
  resposta: string
  /** Tela que resolve a dúvida. */
  href?: string
  /** Rótulo do botão que leva à tela. */
  rotuloDoLink?: string
  /** Em vez de levar a uma tela, abre o tour guiado. */
  abreTour?: boolean
  /** Vale para quem tem ao menos uma destas permissões. Sem nada, vale para todos. */
  exige?: Acao | Acao[]
  /** Some para quem tem esta permissão (ex.: a Logística não "pede" à Logística). */
  excetoQuem?: Acao
  /** Restringe a perfis específicos, quando a dúvida só existe para eles. */
  paraPerfis?: Perfil[]
  /** Palavras que alguém usaria e que não estão na pergunta. */
  termos?: string[]
  /** Aparece entre as sugestões antes de a pessoa digitar. */
  destaque?: boolean
}

export const FAQ: ItemDaFaq[] = [
  // --- Para todos -------------------------------------------------------------
  {
    id: 'o-que-e',
    pergunta: 'O que dá para fazer aqui?',
    resposta:
      'A plataforma junta duas coisas: os presentes que a AUVP manda para clientes, do pedido do consultor até a entrega, e o trabalho da Logística, com os pedidos de toda a empresa e o painel da semana. O que aparece no menu depende do seu perfil.',
    termos: ['plataforma', 'sistema', 'caixinha', 'ajuda', 'inicio', 'comecar'],
    destaque: true,
  },
  {
    id: 'tour',
    pergunta: 'Onde revejo o tour guiado?',
    resposta:
      'No menu da sua conta, no canto superior direito, em "Ver o tour". Ou pelo botão abaixo.',
    abreTour: true,
    rotuloDoLink: 'Abrir o tour',
    termos: ['tutorial', 'passo a passo', 'guia', 'apresentacao'],
  },
  {
    id: 'tema',
    pergunta: 'Como deixo a tela clara ou escura?',
    resposta:
      'Pelo botão de sol e lua no menu superior, ao lado do seu nome. A escolha fica guardada neste navegador. Para voltar a seguir o tema do computador, use "Tema do computador" no menu da sua conta.',
    termos: ['modo escuro', 'tema', 'dark', 'claro', 'escuro', 'noturno', 'cor'],
  },
  {
    id: 'painel-logistica',
    pergunta: 'O que mostra o Dashboard Logístico?',
    resposta:
      'A situação da semana (operação normal, alto volume, risco de atraso ou crítica), os pedidos e os despachados do período e as demandas em andamento. O período escolhido no topo vale para o painel inteiro e para a exportação.',
    href: '/logistica',
    rotuloDoLink: 'Abrir o painel',
    exige: 'logistica.ver',
    termos: ['dashboard', 'painel', 'semana', 'indicadores', 'status da semana'],
  },
  {
    id: 'custo-percentual',
    pergunta: 'Por que o custo de envio aparece só em porcentagem?',
    resposta:
      'O painel mostra a fatia de cada departamento no custo de frete e operação, sem valor em reais, porque ele é lido pela empresa inteira. O valor fica no histórico de quem lança o envio.',
    href: '/logistica',
    rotuloDoLink: 'Abrir o painel',
    exige: 'logistica.verCustos',
    termos: ['custo', 'frete', 'reais', 'percentual', 'departamento'],
  },

  // --- Conta e perfis ---------------------------------------------------------
  {
    id: 'por-que-colaborador',
    pergunta: 'Por que só vejo a Logística no menu?',
    resposta:
      'Quem entra pela primeira vez é Colaborador AUVP: pode pedir à Logística e ler o painel. Se você trabalha com presentes ou na Logística, o admin da sua área ajusta o seu perfil em Usuários.',
    paraPerfis: ['colaborador'],
    termos: ['perfil', 'acesso', 'permissao', 'menu', 'catalogo', 'colaborador'],
    destaque: true,
  },
  {
    id: 'virar-consultor',
    pergunta: 'Como passo a pedir presentes para clientes?',
    resposta:
      'Pedir presente é do perfil Consultor. Peça ao Admin de Relacionamento para mudar o seu perfil; ao recarregar a página, o catálogo e a nova solicitação aparecem no menu.',
    paraPerfis: ['colaborador'],
    termos: ['consultor', 'presente', 'cliente', 'perfil', 'acesso'],
  },

  // --- Presentes: consultor ---------------------------------------------------
  {
    id: 'nova-solicitacao',
    pergunta: 'Como peço um presente para um cliente?',
    resposta:
      'Em "Nova solicitação" você passa por cinco etapas: o cliente, o presente, a entrega, a carta e a revisão. O resumo ao lado mostra o total e por onde o pedido passa depois da aprovação.',
    href: '/solicitacoes/nova',
    rotuloDoLink: 'Nova solicitação',
    exige: 'solicitacao.criar',
    termos: ['presente', 'enviar', 'mandar', 'brinde', 'cliente', 'solicitar', 'pedido'],
    destaque: true,
  },
  {
    id: 'catalogo',
    pergunta: 'Onde vejo os presentes disponíveis?',
    resposta:
      'No Catálogo. Clique no selo de uma categoria para filtrar. Cada presente mostra o valor e a rota: "Em estoque" sai direto para o envio depois da aprovação; "Sob pedido" passa antes pelo Financeiro, que compra.',
    href: '/catalogo',
    rotuloDoLink: 'Abrir o catálogo',
    exige: 'catalogo.ver',
    termos: ['produtos', 'opcoes', 'vinho', 'kit', 'categoria', 'estoque', 'sob pedido'],
    destaque: true,
  },
  {
    id: 'fora-do-catalogo',
    pergunta: 'O presente que eu quero não está no catálogo. E agora?',
    resposta:
      'Na nova solicitação, escolha um presente específico, descreva o que é e cole o link de onde comprar. Ele passa pelo Financeiro, como todo presente sob pedido.',
    href: '/solicitacoes/nova',
    rotuloDoLink: 'Nova solicitação',
    exige: 'solicitacao.criar',
    termos: ['especifico', 'outro', 'link', 'site', 'personalizado', 'fora'],
  },
  {
    id: 'kit-vinho',
    pergunta: 'Por que o kit pede para escolher um vinho?',
    resposta:
      'Alguns kits ("Escolha o vinho") existem para levar uma garrafa e não vão sozinhos. Escolha um dos vinhos do catálogo no mesmo pedido; um presente específico digitado à mão não conta.',
    href: '/catalogo',
    rotuloDoLink: 'Ver os vinhos',
    exige: 'solicitacao.criar',
    termos: ['vinho', 'kit', 'acompanhamento', 'garrafa', 'bebida', 'queijos', 'mdf'],
  },
  {
    id: 'valor-a-definir',
    pergunta: 'O que quer dizer "valor a definir"?',
    resposta:
      'O presente ainda não tem preço cadastrado. Dá para pedir normalmente; o valor entra como zero no pedido até a área definir o preço no catálogo.',
    exige: 'catalogo.ver',
    termos: ['preco', 'sem valor', 'zero', 'custo'],
  },
  {
    id: 'carta',
    pergunta: 'Como escrevo a carta?',
    resposta:
      'Na etapa da carta, escolha o motivo (aniversário, primeiro milhão...) e use uma sugestão de texto como ponto de partida. A prévia ao lado mostra como a carta fica, e o guia "como escrever" abre na mesma etapa. A saudação também pode ser editada.',
    href: '/solicitacoes/nova',
    rotuloDoLink: 'Nova solicitação',
    exige: 'solicitacao.criar',
    termos: ['mensagem', 'texto', 'modelo', 'sugestao', 'saudacao', 'cartao', 'bilhete'],
    destaque: true,
  },
  {
    id: 'limite-mes',
    pergunta: 'Quanto ainda posso gastar no mês?',
    resposta:
      'A nova solicitação mostra a barra do mês já contando o pedido que você está montando. Passar do limite não bloqueia: a área é avisada e pode compensar em outro mês. Tudo conta no gasto do mês, inclusive o que foi cancelado ou devolvido.',
    href: '/solicitacoes/nova',
    rotuloDoLink: 'Nova solicitação',
    exige: 'saldo.verProprio',
    termos: ['saldo', 'limite', 'gasto', 'orcamento', 'verba', 'teto', 'estourar'],
    destaque: true,
  },
  {
    id: 'acompanhar-solicitacao',
    pergunta: 'Como acompanho o presente que pedi?',
    resposta:
      'Em "Minhas solicitações", abra o pedido: o status, o histórico e o rastreio ficam lá, com uma frase dizendo o que acontece agora. Os status são Pendente, Aguardando compra, Comprado, Organizando envio e Entregue.',
    href: '/solicitacoes',
    rotuloDoLink: 'Minhas solicitações',
    exige: 'solicitacao.verProprias',
    termos: ['status', 'andamento', 'onde esta', 'situacao', 'historico'],
    destaque: true,
  },
  {
    id: 'rastreio',
    pergunta: 'Onde vejo o código de rastreio?',
    resposta:
      'Na própria solicitação, em "Minhas solicitações". O rastreio aparece quando o pedido sai; ele volta sozinho do Tiny ou é anotado pela Logística. Se for dos Correios, o cartão mostra também o histórico do objeto: postado, em transferência, saiu para entrega e entregue.',
    href: '/solicitacoes',
    rotuloDoLink: 'Minhas solicitações',
    exige: 'solicitacao.verProprias',
    termos: ['rastreamento', 'codigo', 'correios', 'transportadora', 'entrega', 'envio'],
  },
  {
    id: 'avisos',
    pergunta: 'Como fico sabendo quando o presente anda, chega ou dá problema?',
    resposta:
      'Pelo sininho, no canto de cima. Cada movimento dos Correios de um presente seu vira um aviso: entregue em verde, e retirada na agência, tentativa sem sucesso, extravio ou devolução em destaque, para você avisar o cliente. O número mostra quantos você ainda não viu; abrir a lista marca como vistos.',
    href: '/avisos',
    rotuloDoLink: 'Abrir os avisos',
    exige: 'solicitacao.verProprias',
    termos: [
      'aviso',
      'notificacao',
      'sininho',
      'sino',
      'extraviado',
      'retirada',
      'devolvido',
      'entregue',
    ],
  },
  {
    id: 'confirmar-recebimento',
    pergunta: 'Como confirmo que o cliente recebeu o presente?',
    resposta:
      'Quando a solicitação estiver em "Entregue", abra o pedido e clique em "Meu cliente recebeu". A plataforma pede um segundo clique para confirmar, para ninguém marcar por engano.',
    href: '/solicitacoes',
    rotuloDoLink: 'Minhas solicitações',
    exige: 'solicitacao.confirmarRecebimento',
    termos: ['recebeu', 'chegou', 'entregue', 'confirmacao', 'recebimento'],
  },
  {
    id: 'aguardando-compra',
    pergunta: 'Por que meu pedido está em "Aguardando compra"?',
    resposta:
      'Foi aprovado, e o presente é sob pedido: o Financeiro precisa comprar antes de ele seguir para o envio. Presente em estoque pula essa etapa.',
    href: '/solicitacoes',
    rotuloDoLink: 'Minhas solicitações',
    exige: 'solicitacao.verProprias',
    termos: ['compra', 'financeiro', 'parado', 'demorando', 'sob pedido'],
  },
  {
    id: 'quem-aprova',
    pergunta: 'Quem aprova o meu pedido?',
    resposta:
      'O Admin de Relacionamento (ou o Admin geral). Nada vai para a compra ou para o envio sem esse OK. Enquanto isso, o pedido fica em "Pendente".',
    exige: 'solicitacao.criar',
    termos: ['aprovacao', 'pendente', 'admin', 'liberar', 'ok'],
  },
  {
    id: 'cancelar',
    pergunta: 'Preciso cancelar ou corrigir um pedido. Como faço?',
    resposta:
      'Corrigir e cancelar são do Admin de Relacionamento: fale com ele dizendo o código da solicitação. O que foi cancelado continua contando no gasto do mês.',
    exige: 'solicitacao.criar',
    excetoQuem: 'solicitacao.alterarStatus',
    termos: ['cancelamento', 'corrigir', 'errei', 'mudar', 'editar', 'desistir'],
  },

  // --- Aprovação (admins) -----------------------------------------------------
  {
    id: 'pilhas-da-gestao',
    pergunta: 'Como vejo só o que preciso resolver?',
    resposta:
      'Na Gestão, os atalhos acima da tabela separam as pilhas, cada um com a contagem: Para aprovar, Deu problema, Aguardando compra, Esperando chegar e Organizando envio. Um clique filtra a lista; "Todas" volta. Período, consultor e busca continuam valendo junto.',
    href: '/admin/solicitacoes',
    rotuloDoLink: 'Abrir a Gestão',
    exige: 'solicitacao.verTodas',
    termos: [
      'filtrar',
      'kanban',
      'pilha',
      'deu problema',
      'atuar',
      'resolver',
      'pendencias',
      'atrasado',
    ],
  },
  {
    id: 'voltar-status',
    pergunta: 'Como volto uma solicitação para um status anterior?',
    resposta:
      'No detalhe da solicitação, em "Novo status", escolha uma das opções "↩ Voltar para..." (Aguardando aprovação, Aguardando compra...) e escreva o motivo, que fica no histórico. A tela diz antes o que será desfeito: antes de "Comprado", os itens voltam para a fila do Financeiro; antes de "Organizando envio", o pedido no Tiny é cancelado se ainda não saiu, e vai de novo quando a solicitação voltar à expedição; antes da aprovação, a demanda sai da trilha da Logística. A Gestão em lote não volta status.',
    href: '/admin/solicitacoes',
    rotuloDoLink: 'Abrir a Gestão',
    exige: 'solicitacao.alterarStatus',
    termos: ['voltar', 'desfazer', 'anterior', 'errei', 'retornar', 'status', 'engano'],
  },
  {
    id: 'motivo-do-problema',
    pergunta: 'Como registro por que deu problema?',
    resposta:
      'Ao mudar para "Deu problema", escolha um dos motivos prontos: Sem estoque, Não emite NF ou Faltam informações. Se não for nenhum deles, "Outro" abre o texto livre. O motivo fica no histórico, com quem mudou e quando.',
    href: '/financeiro/compras',
    rotuloDoLink: 'Abrir a fila de compras',
    exige: 'solicitacao.alterarStatus',
    termos: [
      'deu problema',
      'motivo',
      'sem estoque',
      'nota fiscal',
      'nf',
      'falta informacao',
      'problema',
    ],
  },
  {
    id: 'aprovar-lote',
    pergunta: 'Como aprovo várias solicitações de uma vez?',
    resposta:
      'Na Gestão, o cartão "Para aprovar" filtra o que espera o seu OK. Marque as linhas (ou a caixa do cabeçalho) e use a ação em lote. Cada passo vira uma linha do histórico; o que não pode andar volta com o motivo.',
    href: '/admin/solicitacoes?fila=aprovar',
    rotuloDoLink: 'Abrir "Para aprovar"',
    exige: 'solicitacao.aprovar',
    termos: ['aprovar', 'lote', 'varias', 'todas', 'pendentes', 'fila'],
    destaque: true,
  },
  {
    id: 'trocar-link',
    pergunta: 'Posso trocar o link de compra antes de aprovar?',
    resposta:
      'Sim. No detalhe da solicitação, use "Trocar link" no item, por exemplo quando o produto acabou no site. O link original continua guardado e dá para voltar a ele.',
    href: '/admin/solicitacoes',
    rotuloDoLink: 'Abrir a Gestão',
    exige: 'solicitacao.editar',
    termos: ['link', 'site', 'esgotado', 'fora de estoque', 'url', 'comprar em outro lugar'],
  },
  {
    id: 'corrigir-pedido',
    pergunta: 'Como corrijo um pedido que veio errado?',
    resposta:
      'No detalhe da solicitação, ou no "Corrigir" da fila de compras, você ajusta itens, valores, endereço e carta até a compra, e também em "Deu problema" enquanto o pedido não foi ao Tiny. Item já comprado fica travado. Item da casa, como cuia e vela, se marca como "Sai do estoque da AUVP" e não passa pela fila de compras. Cada mudança fica no pedido, com o que era antes. Ao devolver o pedido para a compra, escreva na Nota o que corrigiu: ela aparece para o Financeiro na fila de compras.',
    href: '/financeiro/compras',
    rotuloDoLink: 'Abrir a fila de compras',
    exige: 'solicitacao.editar',
    termos: [
      'editar',
      'corrigir',
      'errado',
      'alterar',
      'valor',
      'endereço',
      'carta',
      'item interno',
      'estoque',
      'cuia',
      'vela',
      'trocar item',
    ],
  },
  {
    id: 'exportar',
    pergunta: 'Como exporto as solicitações?',
    resposta:
      'Na Gestão, filtre por período, consultor ou status e use a exportação: a planilha sai com o mesmo recorte da tela.',
    href: '/admin/solicitacoes',
    rotuloDoLink: 'Abrir a Gestão',
    exige: 'solicitacao.verTodas',
    termos: ['planilha', 'excel', 'csv', 'relatorio', 'baixar', 'filtrar'],
  },

  // --- Financeiro -------------------------------------------------------------
  {
    id: 'fila-compras',
    pergunta: 'O que eu preciso comprar?',
    resposta:
      'A Fila de compras abre agrupada por fornecedor: cada loja com quantas solicitações e quanto há para comprar, e os itens embaixo, com o link. Assim dá para comprar tudo de uma loja de uma vez e juntar o frete. "Copiar lista" leva os itens e links; "Por item" mostra a lista completa.',
    href: '/financeiro/compras',
    rotuloDoLink: 'Abrir a Fila de compras',
    exige: 'compras.verFila',
    termos: [
      'compras',
      'comprar',
      'fila',
      'financeiro',
      'pagar',
      'site',
      'fornecedor',
      'loja',
      'frete',
      'mercado livre',
      'casa da bebida',
    ],
    destaque: true,
  },
  {
    id: 'marcar-comprado',
    pergunta: 'Comprei. O que faço agora?',
    resposta:
      'Na Fila de compras, por fornecedor, selecione os itens que comprou (ou "Selecionar tudo" da loja) e marque como comprados. A solicitação vai a "Comprado" quando o último item dela é marcado, mesmo que os itens sejam de lojas diferentes. Depois ela fica "a caminho" até a Logística confirmar a chegada.',
    href: '/financeiro/compras',
    rotuloDoLink: 'Abrir a Fila de compras',
    exige: 'compras.operar',
    termos: ['comprado', 'liberar', 'envio', 'expedicao', 'proximo passo', 'chegou'],
  },

  // --- Logística --------------------------------------------------------------
  {
    id: 'confirmar-chegada',
    pergunta: 'O item comprado chegou. O que faço?',
    resposta:
      'Na Expedição, no fim da tela, fica o que está "a caminho": o que o Financeiro comprou e ainda não chegou. Com o item na mão, clique em "Chegou". O pedido passa a "Pronto para processar", com o selo "Novo", e vira pedido no Tiny. O número no item "Expedição" do menu mostra quantos estão prontos.',
    href: '/expedicao#a-caminho',
    rotuloDoLink: 'Ver o que está a caminho',
    exige: 'expedicao.receberItem',
    termos: ['chegou', 'chegada', 'recebi', 'pacote', 'a caminho', 'comprado', 'tiny', 'novo'],
    destaque: true,
  },
  {
    id: 'em-comprado',
    pergunta: 'Meu pedido está em "Comprado". O que falta?',
    resposta:
      'O Financeiro já comprou, e o item está a caminho da Logística. Quando ele chegar, a Logística confirma e o pedido segue para o envio.',
    href: '/solicitacoes',
    rotuloDoLink: 'Minhas solicitações',
    exige: 'solicitacao.verProprias',
    termos: ['comprado', 'parado', 'demorando', 'chegar', 'logistica'],
  },
  {
    id: 'expedicao',
    pergunta: 'Como registro o rastreio e marco como entregue?',
    resposta:
      'Na Expedição ficam os presentes a separar e postar, com o endereço. Anote o rastreio quando sair. Rastreio não muda o status: "Entregue" é marcado por quem acompanha, e só com rastreio. Quando os Correios registram a entrega, aparece o aviso em verde ao lado do botão.',
    href: '/expedicao',
    rotuloDoLink: 'Abrir a Expedição',
    exige: 'expedicao.registrarRastreio',
    termos: ['rastreio', 'entregue', 'postar', 'separar', 'envio', 'correios'],
    destaque: true,
  },
  {
    id: 'trilha',
    pergunta: 'Como organizo as demandas da Logística?',
    resposta:
      'Na trilha do painel: cada demanda tem fase, prioridade, complexidade e responsável. Os pedidos de colaboradores chegam em "Recebido" com o nome de quem pediu, e o presente aprovado entra sozinho.',
    href: '/logistica',
    rotuloDoLink: 'Abrir a trilha',
    exige: 'logistica.gerenciar',
    termos: ['trilha', 'demanda', 'fase', 'prioridade', 'responsavel', 'clickup', 'tarefa'],
    destaque: true,
  },
  {
    id: 'lancar-envio',
    pergunta: 'Onde lanço o que foi despachado e o custo do envio?',
    resposta:
      'Na demanda, em "Envios": o que saiu no dia e o custo de frete e operação. Concluir uma tarefa já registra o envio do dia, e o presente entregue lança as peças sozinho.',
    href: '/logistica',
    rotuloDoLink: 'Abrir a trilha',
    exige: 'logistica.gerenciar',
    termos: ['despachado', 'custo', 'frete', 'envio', 'concluir', 'pecas'],
  },
  {
    id: 'status-semana',
    pergunta: 'Como defino o status da semana?',
    resposta:
      'O painel sugere a situação pelos números (demandas atrasadas e abertas). Quem gerencia a Logística pode definir à mão, sempre com o motivo.',
    href: '/logistica',
    rotuloDoLink: 'Abrir o painel',
    exige: 'logistica.gerenciar',
    termos: ['semana', 'critica', 'atraso', 'volume', 'situacao'],
  },
  {
    id: 'tiny',
    pergunta: 'Como funciona a integração com o Tiny?',
    resposta:
      'O presente vira pedido no Tiny sozinho, pela fila, quando fica pronto para processar: na aprovação, se é de estoque, ou quando a Logística confirma que o item comprado chegou. Situação e rastreio voltam de lá. Pedido em "Falhou" quase sempre é produto sem SKU, ou com um SKU que o Tiny não tem: o item vai ligado ao produto cadastrado lá, e o pedido não é enviado se ele não existir, para não criar produto repetido. Corrija o SKU (aqui ou no Tiny) e use Reenviar.',
    href: '/tiny',
    rotuloDoLink: 'Abrir o Tiny',
    exige: 'tiny.operar',
    termos: ['tiny', 'erp', 'falhou', 'sku', 'reenviar', 'pedido', 'integracao'],
    destaque: true,
  },
  {
    id: 'tiny-lote',
    pergunta: 'Como mando vários pedidos ao Tiny por planilha?',
    resposta:
      'Em "Importar lote" no Tiny, escolha primeiro para qual Tiny vai (AUVP Consultoria, Do Not Scare ou Super Nova) e suba a planilha. O produto é procurado na conta escolhida. Em "Natureza da operação", escreva o nome igual ao cadastro no Tiny; vazio, vale a padrão da conta, e a tela sugere as já usadas. Quem já recebeu com o mesmo marcador, CPF/CNPJ e SKU naquela conta é pulado, então reimportar não duplica pedido.',
    href: '/tiny/importar',
    rotuloDoLink: 'Importar planilha',
    exige: 'tiny.operar',
    termos: ['lote', 'planilha', 'importar', 'eventos', 'varios', 'massa', 'natureza', 'operacao'],
  },
  {
    id: 'tiny-contas',
    pergunta: 'Como escolho para qual Tiny vai: Consultoria, Do Not Scare ou Super Nova?',
    resposta:
      'São três contas do Tiny, uma por empresa, cada uma com produtos, SKUs e contatos próprios. Importar lote e Nova venda perguntam a conta antes de tudo. Em Pedidos, Estoque e Contatos, a fileira "Tiny:" logo abaixo das abas troca a conta lida. Os presentes do Relacionamento vão sempre à AUVP Consultoria. Na Fila, a coluna Tiny mostra para onde foi cada pedido. Se o token cadastrado for de outra empresa, nada é lido nem enviado por ele, e a tela diz qual variável corrigir na Vercel.',
    href: '/tiny/importar',
    rotuloDoLink: 'Importar lote',
    exige: 'tiny.operar',
    termos: [
      'tiny',
      'conta',
      'dns',
      'do not scare',
      'super nova',
      'supernova',
      'consultoria',
      'empresa',
    ],
  },

  // --- Administração ----------------------------------------------------------
  {
    id: 'mudar-perfil',
    pergunta: 'Como mudo o perfil de alguém?',
    resposta:
      'Em Usuários. Cada admin de área mexe só em quem está ao alcance dele: o de Relacionamento alterna entre Colaborador e Consultor; o de Logística, entre Colaborador, Consultor e Logística. Só o Admin geral promove alguém a admin. O menu novo aparece para a pessoa assim que ela recarregar a página.',
    href: '/admin/usuarios',
    rotuloDoLink: 'Abrir Usuários',
    exige: 'usuario.gerenciar',
    termos: ['perfil', 'promover', 'consultor', 'acesso', 'permissao', 'admin', 'usuario'],
    destaque: true,
  },
  {
    id: 'limite-consultor',
    pergunta: 'Como defino o limite mensal de um consultor?',
    resposta:
      'Em Usuários, no consultor. A mesma tela mostra o gasto de cada um no mês e no mês anterior; passar do limite só sinaliza, não bloqueia.',
    href: '/admin/usuarios',
    rotuloDoLink: 'Abrir Usuários',
    exige: 'usuario.definirLimite',
    termos: ['limite', 'teto', 'gasto', 'orcamento', 'saldo', 'estourou'],
  },
  {
    id: 'produtos',
    pergunta: 'Como cadastro ou corrijo um presente do catálogo?',
    resposta:
      'Em Produtos: nome, categoria, preço, foto, SKU e se é de estoque ou sob pedido. Nada é apagado; um presente que sai do catálogo é desativado, para os pedidos antigos continuarem legíveis.',
    href: '/admin/catalogo',
    rotuloDoLink: 'Abrir Produtos',
    exige: 'catalogo.gerenciar',
    termos: ['produto', 'cadastrar', 'preco', 'foto', 'sku', 'desativar', 'catalogo'],
  },
  {
    id: 'pausar-produto',
    pergunta: 'O presente ficou sem estoque. Tiro do catálogo?',
    resposta:
      'Na lista de Produtos, "Ver na loja" abre o site para conferir se ainda tem; se acabou, use "Pausar no catálogo" na mesma linha: ele some para os consultores e fica marcado como pausado. Quando voltar ao estoque, clique em "Reativar". Nada se perde, e os pedidos antigos continuam como foram feitos.',
    href: '/admin/catalogo',
    rotuloDoLink: 'Abrir Produtos',
    exige: 'catalogo.gerenciar',
    termos: [
      'sem estoque',
      'pausar',
      'reativar',
      'esgotado',
      'tirar',
      'remover',
      'voltar',
      'desativar',
    ],
  },
  {
    id: 'modelos-carta',
    pergunta: 'Como mudo as sugestões de texto da carta?',
    resposta:
      'Em Modelos de carta: cada motivo tem as suas sugestões, e o marcador {nome} vira o nome do cliente. O guia de como escrever também é editado ali.',
    href: '/admin/cartas',
    rotuloDoLink: 'Abrir Modelos de carta',
    exige: 'carta.gerenciarModelos',
    termos: ['modelo', 'sugestao', 'texto', 'carta', 'guia', 'mensagem'],
  },
  {
    id: 'clientes',
    pergunta: 'Como importo a lista de clientes?',
    resposta:
      'Em Clientes, pela importação de CSV. Importar não apaga nada: só grava o que veio preenchido, e as etiquetas se somam.',
    href: '/admin/clientes',
    rotuloDoLink: 'Abrir Clientes',
    exige: 'cliente.gerenciar',
    termos: ['csv', 'importar', 'planilha', 'clientes', 'cadastro', 'etiqueta'],
  },
  // --- Pedir à Logística ------------------------------------------------------
  // No fim da lista: quem tem outro trabalho vê primeiro as perguntas dele.
  {
    id: 'pedir-logistica',
    pergunta: 'Como peço algo à Logística?',
    resposta:
      'Em "Meus pedidos", clique em "Pedir à Logística" e diga o que precisa, os itens, a empresa e o departamento, para quando e os detalhes (endereço, contato). O pedido entra na trilha da Logística em "Recebido", com o seu nome.',
    href: '/logistica/pedidos',
    rotuloDoLink: 'Ir para Meus pedidos',
    exige: 'logistica.pedir',
    excetoQuem: 'logistica.gerenciar',
    termos: ['demanda', 'trabalho', 'kit', 'brinde', 'envio', 'solicitar', 'material'],
    destaque: true,
  },
  {
    id: 'acompanhar-pedido-logistica',
    pergunta: 'Como acompanho o que pedi à Logística?',
    resposta:
      'Em "Meus pedidos" aparece a fase de cada pedido (Recebido, Em análise, Em execução, Concluído...), a previsão e quem está cuidando. Prioridade e responsável são definidos pela Logística.',
    href: '/logistica/pedidos',
    rotuloDoLink: 'Ir para Meus pedidos',
    exige: 'logistica.pedir',
    excetoQuem: 'logistica.gerenciar',
    termos: ['fase', 'andamento', 'previsao', 'responsavel', 'status'],
    destaque: true,
  },
  {
    id: 'faq-logistica',
    pergunta: 'Onde ficam as dúvidas sobre a Logística em si?',
    resposta:
      'A própria Logística mantém uma página de perguntas e a equipe com quem falar, dentro do módulo de Logística.',
    href: '/logistica/faq',
    rotuloDoLink: 'Abrir a FAQ da Logística',
    exige: 'logistica.ver',
    termos: ['equipe', 'contato', 'duvidas', 'falar com'],
  },
]

/** As perguntas que este perfil pode ler, na ordem da lista. */
export function faqDoPerfil(perfil: Perfil): ItemDaFaq[] {
  return FAQ.filter((item) => {
    if (item.paraPerfis && !item.paraPerfis.includes(perfil)) return false
    if (item.excetoQuem && pode(perfil, item.excetoQuem)) return false
    if (!item.exige) return true
    const exige = Array.isArray(item.exige) ? item.exige : [item.exige]
    return exige.some((acao) => pode(perfil, acao))
  })
}
