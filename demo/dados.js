/**
 * Dados fictícios da vitrine.
 *
 * Espelham o seed de desenvolvimento (prisma/seed.ts) para que a demonstração
 * mostre as mesmas situações que o time encontra ao rodar o projeto: produto
 * desativado, presente específico com link, solicitações em status diferentes.
 *
 * Nenhum dado real de cliente entra aqui. Os CPFs são exibidos mascarados.
 */

/**
 * Catálogo e categorias vivem em `demo/produtos.js`, gerado de
 * `prisma/catalogo-auvp.ts`: a mesma fonte do seed da aplicação. Aqui ficam
 * só os dados fictícios que a vitrine inventa: clientes, consultores e
 * solicitações.
 */

const SOLICITACOES = [
  {
    codigo: 'SOL-2026-0001',
    data: '12/02/2026',
    consultor: 'Carlos Consultor',
    cliente: 'Marina Alves Pereira',
    cpf: '***.982.247-**',
    telefone: '(11) 98888-7777',
    motivo: 'Aniversário',
    status: 'aguardando_compra',
    carta:
      'Marina, parabéns pelo seu dia! Que o novo ciclo venha cheio de conquistas. Um abraço da AUVP.',
    entrega: 'Avenida Paulista, 1000: Apto 152, Bela Vista, São Paulo/SP · 01310-100',
    destinatario: 'Marina Alves Pereira',
    itens: [
      {
        produto: 'Vinho Silk & Spice',
        quantidade: 1,
        valorUnitario: 100.0,
        site: null,
        emEstoque: false,
      },
      {
        produto: 'Kit Café Constantino',
        quantidade: 1,
        valorUnitario: 190.0,
        site: null,
        emEstoque: false,
      },
    ],
    historico: [
      {
        de: 'Aguardando aprovação',
        para: 'Aguardando compra',
        quando: '14/02/2026 09:12',
        quem: 'Bia Relacionamento',
      },
      {
        de: 'Pendente',
        para: 'Aguardando aprovação',
        quando: '12/02/2026 16:40',
        quem: 'Bia Relacionamento',
      },
      { de: null, para: 'Pendente', quando: '12/02/2026 15:02', quem: 'Carlos Consultor' },
    ],
  },
  {
    codigo: 'SOL-2026-0002',
    data: '03/02/2026',
    consultor: 'Carlos Consultor',
    cliente: 'Roberto Cardoso Lima',
    cpf: '***.444.777-**',
    motivo: 'Primeiro milhão',
    status: 'entregue',
    rastreio: 'AA123456789BR',
    transportadora: 'Correios',
    carta: 'Roberto, o primeiro milhão é resultado de disciplina. Parabéns por essa marca!',
    entrega: 'Avenida Atlântica, 2000, Copacabana, Rio de Janeiro/RJ · 22071-900',
    destinatario: 'Roberto Cardoso Lima',
    itens: [
      {
        produto: 'Whisky Woodford Reserve Bourbon',
        quantidade: 1,
        valorUnitario: 250.0,
        categoria: 'Bebida',
        site: null,
      },
      { produto: 'Carteira AUVP', quantidade: 1, valorUnitario: 35.0, site: null, emEstoque: true },
    ],
    historico: [
      {
        de: 'Organizando envio',
        para: 'Entregue / rastreio finalizado',
        quando: '20/02/2026 11:30',
        quem: 'Bia Relacionamento',
      },
      {
        de: 'Comprado',
        para: 'Organizando envio',
        quando: '17/02/2026 14:05',
        quem: 'Bia Relacionamento',
      },
      { de: null, para: 'Pendente', quando: '03/02/2026 10:20', quem: 'Carlos Consultor' },
    ],
  },
  {
    codigo: 'SOL-2026-0003',
    data: '24/02/2026',
    consultor: 'Fernanda Consultora',
    cliente: 'Juliana Moreira Dias',
    cpf: '***.509.460-**',
    motivo: 'Nascimento',
    status: 'aguardando_compra',
    carta: 'Juliana, felicidades para a família que acaba de crescer!',
    entrega: 'Avenida Afonso Pena, 500, Sala 12, Centro, Belo Horizonte/MG · 30130-010',
    destinatario: 'Juliana Moreira Dias',
    itens: [
      {
        produto: 'Kit Presente Granado',
        quantidade: 1,
        valorUnitario: 150.0,
        site: null,
        categoria: 'Beleza e Bem estar',
        emEstoque: false,
      },
      {
        produto: 'Whisky Woodford Reserve Bourbon',
        quantidade: 1,
        valorUnitario: 250.0,
        site: null,
        // Sem link próprio: o site vem do fornecedor padrão da categoria.
        categoria: 'Bebida',
        emEstoque: false,
      },
      {
        produto: 'Enxoval de berço bordado com o nome do bebê',
        quantidade: 1,
        valorUnitario: 450.0,
        site: 'https://www.exemplo-loja.com.br/enxoval-bordado',
        emEstoque: false,
      },
    ],
    historico: [
      {
        de: 'Aguardando aprovação',
        para: 'Aguardando compra',
        quando: '25/02/2026 08:45',
        quem: 'Bia Relacionamento',
      },
      { de: null, para: 'Pendente', quando: '24/02/2026 17:55', quem: 'Fernanda Consultora' },
    ],
  },
  {
    codigo: 'SOL-2026-0004',
    data: '26/02/2026',
    consultor: 'Fernanda Consultora',
    cliente: 'Marina Alves Pereira',
    cpf: '***.982.247-**',
    motivo: 'Reforço de relacionamento',
    status: 'deu_problema',
    carta: 'Marina, obrigado pela confiança de sempre.',
    entrega: 'Avenida Paulista, 1000: Apto 152, Bela Vista, São Paulo/SP · 01310-100',
    destinatario: 'Marina Alves Pereira',
    itens: [
      { produto: 'Kit Churrasco AUVP com faca', quantidade: 1, valorUnitario: 330.0, site: null },
    ],
    historico: [
      {
        de: 'Comprado',
        para: 'Deu problema',
        quando: '28/02/2026 10:02',
        quem: 'Bia Relacionamento',
        motivo: 'Fornecedor cancelou o pedido por falta de itens da cesta.',
      },
      { de: null, para: 'Pendente', quando: '26/02/2026 09:10', quem: 'Fernanda Consultora' },
    ],
  },
  {
    codigo: 'SOL-2026-0005',
    data: '02/03/2026',
    consultor: 'Carlos Consultor',
    cliente: 'Juliana Moreira Dias',
    cpf: '***.509.460-**',
    telefone: '(31) 98888-1234',
    motivo: 'Casamento',
    status: 'organizando_envio',
    carta: 'Juliana, felicidades nesta nova etapa! Um brinde a vocês dois. Equipe AUVP.',
    entrega: 'Avenida Afonso Pena, 867, Centro, Belo Horizonte/MG · 30130-002',
    destinatario: 'Juliana Moreira Dias',
    // Tudo em estoque: esta solicitação pulou o Financeiro e foi da aprovação
    // direto para a expedição.
    itens: [
      {
        produto: 'Boné Capitalismo',
        quantidade: 2,
        valorUnitario: 35.0,
        site: null,
        emEstoque: true,
      },
      {
        produto: 'Kit Mochila AUVP',
        quantidade: 1,
        valorUnitario: 135.0,
        site: null,
        emEstoque: true,
      },
    ],
    historico: [
      {
        de: 'Aguardando aprovação',
        para: 'Organizando envio',
        quando: '03/03/2026 09:30',
        quem: 'Bia Relacionamento',
        motivo: null,
      },
      {
        de: 'Pendente',
        para: 'Aguardando aprovação',
        quando: '02/03/2026 14:20',
        quem: 'Bia Relacionamento',
      },
      { de: null, para: 'Pendente', quando: '02/03/2026 11:05', quem: 'Carlos Consultor' },
    ],
  },
  {
    codigo: 'SOL-2026-0006',
    data: '04/03/2026',
    consultor: 'Carlos Consultor',
    cliente: 'Marina Alves Pereira',
    cpf: '***.982.247-**',
    telefone: '(11) 98888-7777',
    motivo: 'Reforço de relacionamento',
    status: 'pendente',
    carta: 'Marina, obrigado por seguir com a gente mais um ano.',
    entrega: 'Avenida Paulista, 1000: Apto 152, Bela Vista, São Paulo/SP · 01310-100',
    destinatario: 'Marina Alves Pereira',
    // Tudo em estoque: ao aprovar, o Admin já libera para envio.
    itens: [
      {
        produto: 'Meia AUVP',
        quantidade: 2,
        valorUnitario: 25.0,
        site: null,
        emEstoque: true,
      },
    ],
    historico: [
      { de: null, para: 'Pendente', quando: '04/03/2026 10:12', quem: 'Carlos Consultor' },
    ],
  },
  {
    codigo: 'SOL-2026-0007',
    data: '04/03/2026',
    consultor: 'Fernanda Consultora',
    cliente: 'Roberto Cardoso Lima',
    cpf: '***.444.777-**',
    motivo: 'Casamento',
    status: 'pendente',
    carta: 'Roberto, felicidades nesta nova etapa!',
    entrega: 'Avenida Atlântica, 2000, Copacabana, Rio de Janeiro/RJ · 22071-900',
    destinatario: 'Roberto Cardoso Lima',
    // Bebida não controla estoque: esta passa pelo Financeiro.
    itens: [
      {
        produto: 'Whisky Woodford Reserve Bourbon',
        quantidade: 1,
        valorUnitario: 250.0,
        site: null,
        categoria: 'Bebida',
        emEstoque: false,
      },
    ],
    historico: [
      { de: null, para: 'Pendente', quando: '04/03/2026 11:40', quem: 'Fernanda Consultora' },
    ],
  },
]

/**
 * Cores dos status, iguais às de `src/components/status-badge.tsx`.
 *
 * cinza = não começou · âmbar = parado esperando alguém · azul = em andamento
 * verde = terminou bem · vermelho = deu errado (vazado quando já encerrado)
 */
const STATUS = {
  pendente: { rotulo: 'Pendente', classe: 'bg-muted text-muted-foreground' },
  aguardando_aprovacao: {
    rotulo: 'Aguardando aprovação',
    classe: 'bg-warning text-warning-foreground',
  },
  aguardando_compra: { rotulo: 'Aguardando compra', classe: 'bg-warning text-warning-foreground' },
  comprado: { rotulo: 'Comprado', classe: 'bg-info text-info-foreground' },
  organizando_envio: { rotulo: 'Organizando envio', classe: 'bg-info text-info-foreground' },
  entregue: {
    rotulo: 'Entregue / rastreio finalizado',
    classe: 'bg-success text-success-foreground',
  },
  cliente_confirmou: {
    rotulo: 'Cliente confirmou recebimento',
    classe: 'bg-primary text-primary-foreground',
  },
  deu_problema: { rotulo: 'Deu problema', classe: 'bg-error text-error-foreground' },
  devolvido: { rotulo: 'Devolvido', classe: 'border border-error text-error' },
  cancelado: { rotulo: 'Cancelado', classe: 'border border-border text-muted-foreground' },
}

const CONSULTORES = [
  { nome: 'Carlos Consultor', limite: 5000, perfil: 'Consultor' },
  { nome: 'Fernanda Consultora', limite: 3000, perfil: 'Consultor' },
  { nome: 'Bia Relacionamento', limite: null, perfil: 'Admin' },
  { nome: 'Financeiro AUVP', limite: null, perfil: 'Financeiro' },
]

/**
 * Dashboard Logístico, fictício. Espelha o que `prisma/exemplo-logistica.ts`
 * gera para a aplicação, congelado numa semana para a vitrine não mudar.
 */
const LOGISTICA = {
  semana: '2026-34',
  dias: '17/08 – 23/08',
  status: {
    situacao: 'risco_de_atraso',
    motivo: '1 demanda passou da previsão.',
  },
  volume: { total: 26, anterior: 21 },
  porDepartamento: [
    {
      subsidiaria: 'Do Not Scare Soluções Interativas LTDA',
      linhas: [
        ['Produto & CX', 12],
        ['Conteúdo', 3],
        ['Eventos', 2],
      ],
    },
    { subsidiaria: 'AUVP Consultoria', linhas: [['Consultoria', 6]] },
    { subsidiaria: 'AUVP Holding', linhas: [['Administrativo', 3]] },
  ],
  evolucao: [
    ['2026-27', 18],
    ['2026-28', 21],
    ['2026-29', 19],
    ['2026-30', 24],
    ['2026-31', 22],
    ['2026-32', 31],
    ['2026-33', 21],
    ['2026-34', 26],
  ],
  custo: { total: 'R$ 1.214,30', semCusto: 3 },
  recorrentes: 9,
  pontuais: 17,
  trilha: [
    {
      titulo: 'Camisetas BR para o encontro',
      prioridade: 'Alta',
      fase: 'em_execucao',
      itens: ['Camiseta BR'],
      contexto: 'Produto & CX · AUVP Escola · Ana Souza · Complexidade baixa',
      previsao: '24/08/2026',
    },
    {
      titulo: 'Documentos para cartório',
      prioridade: 'Urgente',
      fase: 'aguardando_documentacao',
      itens: ['Documentos'],
      contexto: 'Administrativo · Holding · Bruno Lima · Complexidade alta',
      previsao: '21/08/2026',
      obs: 'Levar em mãos. Confirmar o horário do cartório na véspera.',
    },
    {
      titulo: 'Kit boas-vindas da turma',
      fase: 'finalizacao',
      itens: ['Camiseta', 'Caneca', 'Caderno'],
      contexto: 'Produto & CX · AUVP Escola · Carla Mendes · Complexidade média',
      atrasada: '18/08/2026',
      obs: 'Entregar na recepção do prédio, aos cuidados da equipe do departamento.',
    },
    {
      titulo: 'Brindes do evento The Brain',
      fase: 'aguardando_suprimentos',
      itens: ['Garrafa', 'Ecobag', 'Caneta'],
      contexto: 'Eventos · The Brain · Carla Mendes · Complexidade média',
      previsao: '25/08/2026',
    },
    {
      titulo: 'Material de apoio para consultores',
      fase: 'em_analise',
      itens: ['Pasta de apresentação'],
      contexto: 'Consultoria · Ana Souza · Complexidade baixa',
      previsao: null,
    },
    {
      titulo: 'Presente para Marina Alves Pereira (SOL-2026-0007)',
      presente: true,
      fase: 'em_execucao',
      itens: ['Kit Café', '2× Caneca AUVP'],
      contexto: 'Relacionamento · Presente para cliente · Complexidade média',
      previsao: '27/08/2026',
    },
    {
      titulo: 'Malote para os escritórios',
      recorrente: 'Semanal',
      fase: 'recebido',
      itens: ['Malote'],
      contexto: 'Consultoria · Bruno Lima · Complexidade baixa',
      inicio: '24/08/2026',
      previsao: '25/08/2026',
    },
    {
      titulo: 'Livros para alunos da Imersão',
      fase: 'concluido',
      itens: ['Livro AUVP'],
      contexto: 'Produto & CX · AUVP Escola · Bruno Lima · Complexidade baixa',
      concluida: '19/08/2026',
    },
  ],
  equipe: 'Ana (Coordenação de Logística) · Bruno (Expedição) · Carla (Suprimentos)',
}
