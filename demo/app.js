/**
 * Vitrine estática do Catálogo de Presentes.
 *
 * Renderização em JavaScript puro, sem build: o GitHub Pages serve os arquivos
 * como estão, e quem precisar ajustar um texto não depende de toolchain.
 *
 * O seletor "Ver como" reproduz a matriz de permissões de
 * `src/lib/permissions.ts`. É o ponto mais útil da demonstração: mostra que
 * cada perfil enxerga um conjunto diferente de telas.
 */

const PERMISSOES = {
  consultor: ['catalogo', 'nova', 'minhas', 'logistica'],
  admin: [
    'catalogo',
    'nova',
    'minhas',
    'gestao',
    'detalhe',
    'compras',
    'expedicao',
    'produtos',
    'clientes',
    'usuarios',
    'logistica',
  ],
  financeiro: ['catalogo', 'gestao', 'detalhe', 'compras', 'expedicao', 'logistica'],
  logistica: ['logistica', 'catalogo', 'expedicao'],
}

/** Telas que ficam sob o item "Administração", para a barra não crescer. */
const SOB_ADMINISTRACAO = ['produtos', 'clientes', 'usuarios']

const TELAS = [
  {
    id: 'catalogo',
    rotulo: 'Catálogo',
    descricao: 'Os presentes disponíveis, com valor e estoque',
  },
  {
    id: 'nova',
    rotulo: 'Nova solicitação',
    descricao: 'As cinco etapas do pedido, do cliente à revisão',
  },
  {
    id: 'minhas',
    rotulo: 'Minhas solicitações',
    descricao: 'O que o consultor pediu e o status de cada envio',
  },
  {
    id: 'compras',
    rotulo: 'Fila de compras',
    descricao: 'Itens enviados para compra, com valor e site',
  },
  {
    id: 'expedicao',
    rotulo: 'Expedição',
    descricao: 'Pedidos prontos para separar, com endereço de envio',
  },
  {
    id: 'logistica',
    rotulo: 'Logística',
    descricao: 'Status da operação, volume, demandas e equipe',
  },
  { id: 'gestao', rotulo: 'Gestão', descricao: 'Fluxo completo, mudança de status e exportação' },
  { id: 'produtos', rotulo: 'Produtos', descricao: 'Cadastro, edição e ativação do catálogo' },
  { id: 'clientes', rotulo: 'Clientes', descricao: 'Cadastro manual e importação por CSV' },
  { id: 'usuarios', rotulo: 'Usuários', descricao: 'Perfil de acesso e limite mensal' },
]

let perfil = 'admin'
let tela = 'catalogo'
let filtroCategoria = ''
let busca = ''

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

/**
 * Preço de um produto, espelha `src/components/valor-do-produto.tsx`.
 *
 * Nulo não é zero: parte dos brindes personalizados veio da área sem preço, e
 * "R$ 0,00" se leria como grátis.
 */
function preco(p, classe = '') {
  if (p.valor === null || p.valor === undefined) {
    return '<span class="text-sm text-muted-foreground">valor a definir</span>'
  }
  const prefixo =
    p.tipoValor === 'medio' ? '<span class="text-xs text-muted-foreground">a partir de</span> ' : ''
  return `${prefixo}<span class="${classe}">${brl(p.valor)}</span>`
}

const totalDaSolicitacao = (s) =>
  s.itens.reduce((acc, i) => acc + i.valorUnitario * i.quantidade, 0)

function selo(status) {
  const s = STATUS[status]
  return `<span class="inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold ${s.classe}">${esc(s.rotulo)}</span>`
}

/**
 * Bloco de número. Espelha `src/components/stat.tsx`: fonte de corpo (não a de
 * título) e sem tabular-nums, que serve a coluna de tabela e não a número solto.
 */
function cartao(titulo, valor, rodape, destaque) {
  return `
    <div class="rounded-lg border bg-card p-5 shadow-[0_1px_2px_rgba(11,41,5,0.04)]">
      <p class="text-sm text-muted-foreground">${esc(titulo)}</p>
      <p class="font-body mt-1.5 font-semibold tracking-tight ${destaque ? 'text-4xl sm:text-5xl' : 'text-3xl'}">${esc(valor)}</p>
      ${rodape ? `<p class="mt-1.5 text-sm text-muted-foreground">${rodape}</p>` : ''}
    </div>`
}

function cabecalho(titulo, descricao, sobrancelha, acoes) {
  return `
    <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        ${sobrancelha ? `<p class="font-ui mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">${esc(sobrancelha)}</p>` : ''}
        <h1 class="font-display text-3xl font-semibold tracking-tight">${esc(titulo)}</h1>
        ${descricao ? `<p class="mt-2 max-w-prose text-sm text-muted-foreground">${esc(descricao)}</p>` : ''}
      </div>
      ${acoes ? `<div class="flex items-center gap-2">${acoes}</div>` : ''}
    </div>`
}

function emConstrucao(texto) {
  return `
    <div class="rounded-lg border border-dashed bg-muted/40 p-5 text-sm text-muted-foreground">
      <p class="font-ui mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground">Em construção</p>
      ${texto}
    </div>`
}

/** Barra de filtros agrupada numa superfície, como na aplicação. */
function barraDeFiltros(conteudo) {
  return `<div class="mb-6 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">${conteudo}</div>`
}

/** O olho da marca, lido do cabeçalho para não repetir o traçado no arquivo. */
function olhoPath() {
  return document.querySelector('header svg path').getAttribute('d')
}

/** Estado vazio com a marca, como em `src/components/pagina.tsx`. */
function estadoVazio(titulo, descricao) {
  return `
    <div class="flex flex-col items-center rounded-lg border bg-card px-6 py-16 text-center">
      <svg viewBox="0 0 400 250" fill="currentColor" class="w-16 text-muted-foreground/25" aria-hidden="true">
        <path d="${olhoPath()}" />
      </svg>
      <p class="font-display mt-6 text-lg font-semibold">${esc(titulo)}</p>
      ${descricao ? `<p class="mt-2 max-w-sm text-sm text-muted-foreground">${esc(descricao)}</p>` : ''}
    </div>`
}

/**
 * Ilustração do produto: mesma regra da aplicação: nome antes da categoria.
 * As formas vêm de `ilustracoes.js`, gerado de `src/lib/ilustracoes.ts`.
 */
const POR_PALAVRA = [
  [/chocolate|bombom/, 'chocolate'],
  [/espumante|champanhe/, 'espumante'],
  [/ta[çc]a/, 'taca'],
  [/difusor/, 'difusor'],
  [/caneca|x[íi]cara/, 'caneca'],
  [/cesta/, 'gourmet'],
  [/ch[áa]\b/, 'bem-estar'],
  [/livro/, 'livros'],
  [/placa|trof[ée]u/, 'placas e troféus'],
  [/vinho|whisky|gin\b/, 'vinhos e destilados'],
]

function ilustracao(nome, categoria) {
  const alvo = (nome || '').toLowerCase()
  for (const [padrao, chave] of POR_PALAVRA) {
    if (padrao.test(alvo) && ILUSTRACOES[chave]) return ILUSTRACOES[chave]
  }
  return ILUSTRACOES[(categoria || '').toLowerCase()] || ILUSTRACOES.padrao
}

function imagemDoProduto(p) {
  const foto = p.semFoto ? null : `produtos/${p.slug}.webp`

  // Moldura com proporção fixa e a imagem com width/height reais: o espaço é
  // reservado antes de a foto chegar, então nada se move ao carregar.
  const quadro = (conteudo) =>
    `<div class="relative aspect-[3/4] overflow-hidden border-b bg-muted/50 [perspective:1200px]">${conteudo}</div>`

  if (!foto) {
    return quadro(`
      <svg viewBox="0 0 200 150" fill="none" stroke="currentColor" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
        class="h-full w-full text-primary/40 transition-transform duration-500 ease-apple group-hover:scale-105">
        ${ilustracao(p.nome, p.categoria)}
      </svg>`)
  }

  if (p.temVerso) {
    // Produto com os dois lados desenhados: a foto gira em 3D no hover.
    return quadro(`
      <div class="absolute inset-0 transition-transform duration-700 ease-apple [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] motion-reduce:transition-none">
        <img src="${foto}" alt="${esc(p.nome)}" width="900" height="1200" loading="lazy"
          class="absolute inset-0 h-full w-full object-cover [backface-visibility:hidden]" />
        <img src="produtos/${p.slug}-verso.webp" alt="${esc(p.nome)}: verso" width="900" height="1200" loading="lazy"
          class="absolute inset-0 h-full w-full object-cover [backface-visibility:hidden] [transform:rotateY(180deg)]" />
      </div>
      <span class="selo-lado pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-1 font-roboto text-[10px] font-bold uppercase tracking-wider text-foreground shadow-sm backdrop-blur-sm">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3 shrink-0">${ICONES.girar}</svg>
        <span class="group-hover:hidden">Frente</span><span class="hidden group-hover:inline">Verso</span>
      </span>`)
  }

  return quadro(`
    <img src="${foto}" alt="${esc(p.nome)}" width="900" height="1200" loading="lazy"
      class="h-full w-full object-cover transition-transform duration-500 ease-apple group-hover:scale-105" />`)
}

/** Selo de categoria: ícone e nome, como na Central. */
const TOM_DA_CATEGORIA = {
  'personalizado auvp': 'bg-[hsl(var(--chart-1)/0.14)] text-[hsl(var(--chart-1))]',
  'bebês e crianças': 'bg-[hsl(var(--chart-4)/0.14)] text-[hsl(var(--chart-4))]',
  bebida: 'bg-[hsl(var(--chart-3)/0.16)] text-[hsl(var(--chart-3))]',
  'beleza e bem estar': 'bg-[hsl(var(--chart-5)/0.14)] text-[hsl(var(--chart-5))]',
  livro: 'bg-[hsl(var(--chart-7)/0.16)] text-[hsl(var(--chart-7))]',
  'canecas e garrafas': 'bg-[hsl(var(--chart-1)/0.14)] text-[hsl(var(--chart-1))]',
  vestuário: 'bg-[hsl(var(--chart-5)/0.14)] text-[hsl(var(--chart-5))]',
  papelaria: 'bg-[hsl(var(--chart-4)/0.14)] text-[hsl(var(--chart-4))]',
  acessórios: 'bg-[hsl(var(--chart-2)/0.14)] text-[hsl(var(--chart-2))]',
  bebidas: 'bg-[hsl(var(--chart-3)/0.16)] text-[hsl(var(--chart-3))]',
  'casa & mesa': 'bg-[hsl(var(--chart-7)/0.16)] text-[hsl(var(--chart-7))]',
  'sacolas & caixas': 'bg-[hsl(var(--chart-8)/0.14)] text-[hsl(var(--chart-8))]',
}

function iconeSvg(chave, classe) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="${classe}">${ICONES[chave] || ICONES.padrao}</svg>`
}

function categoriaBadge(categoria) {
  const chave = categoria.toLowerCase()
  const tom = TOM_DA_CATEGORIA[chave] || 'bg-muted text-muted-foreground'
  return `<span class="inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-roboto text-[10px] font-bold uppercase tracking-wider ${tom}">
    ${iconeSvg(chave, 'h-3 w-3 shrink-0')}${esc(categoria)}
  </span>`
}

/**
 * Selo do kit que embala bebida.
 *
 * Dito no card, e não só no aviso que trava depois: quem olha o catálogo
 * precisa saber antes de escolher. Espelha `CardDeProduto` e a tela de
 * catálogo da aplicação.
 */
function seloDeAcompanhamento(p) {
  if (!p.exigeAcompanhamento) return ''
  return `<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">vai com ${esc(p.exigeAcompanhamento)}</span>`
}

/** Link da loja onde o presente é comprado, como em `LinkDoProduto`. */
function linkDaLoja(p) {
  if (!p.urlCompra) return ''
  const dominio = p.urlCompra
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
  return `<a href="${esc(p.urlCompra)}" target="_blank" rel="noopener noreferrer" title="${esc(p.urlCompra)}"
    class="inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary-emphasis hover:underline">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3 shrink-0" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
    <span class="truncate">${esc(dominio)}</span>
  </a>`
}

// --- telas ------------------------------------------------------------------

function telaCatalogo() {
  const termo = busca.trim().toLowerCase()
  const ativos = PRODUTOS.filter((p) => p.ativo)
  const visiveis = ativos.filter(
    (p) =>
      (!filtroCategoria || p.categoria === filtroCategoria) &&
      (!termo || p.nome.toLowerCase().includes(termo)),
  )

  const contagem = (cat) => ativos.filter((p) => p.categoria === cat).length

  const opcao = (rotulo, chaveIcone, valor, ativo, total) => `
    <button data-categoria="${valor}" aria-pressed="${ativo}"
      class="group flex shrink-0 items-center gap-2.5 rounded-xl border bg-card py-2 pl-2 pr-3.5 text-left transition-[border-color,box-shadow,background-color] duration-300 ease-apple ${
        ativo
          ? 'border-primary bg-primary/5 ring-2 ring-primary/25'
          : 'hover:border-primary/40 hover:shadow-sm'
      }">
      <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
        valor === ''
          ? 'bg-primary/10 text-primary'
          : TOM_DA_CATEGORIA[valor.toLowerCase()] || 'bg-muted text-muted-foreground'
      }">${iconeSvg(valor === '' ? 'todos' : valor.toLowerCase(), 'h-4 w-4')}</span>
      <span class="min-w-0">
        <span class="block font-display text-xs font-bold leading-tight text-foreground whitespace-nowrap">${esc(rotulo)}</span>
        <span class="mt-0.5 block font-roboto text-[10px] leading-tight text-muted-foreground">${total} ${total === 1 ? 'item' : 'itens'}</span>
      </span>
    </button>`

  const filtros = [
    opcao('Todos', 'todos', '', !filtroCategoria, ativos.length),
    ...CATEGORIAS.filter((c) => contagem(c) > 0).map((c) =>
      opcao(c, c.toLowerCase(), c, filtroCategoria === c, contagem(c)),
    ),
  ].join('')

  const cards = visiveis
    .map(
      (p) => `
      <article class="group flex flex-col overflow-hidden rounded-2xl border bg-card transition-[transform,box-shadow,border-color] duration-300 ease-apple hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl">
        ${imagemDoProduto(p)}
        <div class="flex flex-1 flex-col items-start gap-1.5 p-4">
          <div class="flex flex-wrap items-center gap-1.5">
            ${categoriaBadge(p.categoria)}${seloDeAcompanhamento(p)}
          </div>
          <h2 class="font-display font-semibold leading-snug">${esc(p.nome)}</h2>
          ${linkDaLoja(p)}
          <div class="mt-auto flex w-full items-end justify-between gap-3 pt-3">
            <p class="flex items-baseline gap-1.5 leading-tight">${preco(p, 'text-lg font-semibold')}</p>
            ${
              p.origem === 'estoque_interno'
                ? '<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">pronta entrega</span>'
                : '<span class="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">sob encomenda</span>'
            }
          </div>
        </div>
      </article>`,
    )
    .join('')

  return `
    ${cabecalho('Catálogo', 'Escolha o presente e siga para a solicitação. Produtos desativados não aparecem aqui.')}
    <div class="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
      <input id="busca" value="${esc(busca)}" placeholder="Buscar por nome ou descrição"
        class="h-10 w-64 rounded-md border border-input bg-background px-3 text-sm" />
      <p class="ml-auto pr-1 text-sm text-muted-foreground">${visiveis.length} ${visiveis.length === 1 ? 'presente' : 'presentes'}</p>
    </div>
    <div role="group" aria-label="Filtrar por categoria" class="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">${filtros}</div>
    ${
      visiveis.length === 0
        ? estadoVazio(
            'Nenhum presente encontrado',
            'Nenhum produto ativo bate com esses filtros. Tente outra busca ou volte para “Todos”.',
          )
        : `<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">${cards}</div>`
    }
    <p class="mt-6 text-xs text-muted-foreground">
      Os ${PRODUTOS.length} presentes são os do catálogo real da área. “Pronta entrega” sai do
      estoque interno assim que o Admin aprovar; “sob encomenda” passa pelo Financeiro antes.
      Produto desativado no cadastro some daqui e continua visível nas solicitações antigas.
    </p>`
}

// --- nova solicitação: estado do protótipo ----------------------------------

/**
 * O fluxo de nova solicitação é navegável de verdade nesta vitrine.
 *
 * As outras telas são retratos: esta é o caminho inteiro, as cinco etapas, com
 * as regras que mandam nele. É o que a área precisa percorrer para aprovar o
 * V1, porque é aqui que o consultor passa o tempo dele.
 *
 * O que está reproduzido, e não simulado por cima: a trava do kit que embala
 * bebida, o limite do mês, a validação por campo, a prévia da carta e a rota
 * que o pedido segue depois da aprovação. O que não existe aqui é servidor:
 * o CPF encontra um cliente fixo e nada é gravado.
 */
let novaEtapa = 0
let novaMaiorEtapa = 0
let novaConferir = false
let novaCpf = ''
let novaCliente = null
let novaItens = []
let novaBusca = ''
let novaCategoria = ''
let novaAcompanhamento = null
let novaEntrega = {
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  destinatario: '',
}
let novaCarta = { motivo: 'Aniversário', motivoOutro: '', mensagem: '' }

const NOVA_ETAPAS = ['Cliente', 'Itens', 'Entrega', 'Carta', 'Revisão']
const NOVA_CONSULTOR = 'Carlos Consultor'
const NOVA_LIMITE = 5000
const NOVA_GASTO_ANTERIOR = 1126

/** O cliente que o CPF de exemplo encontra. Não há banco nesta vitrine. */
const NOVA_CLIENTE_EXEMPLO = {
  nome: 'Marina Alves Pereira',
  cpf: '529.982.247-25',
  telefone: '(11) 98888-7777',
  email: 'marina@exemplo.com.br',
  jaRecebeu: [
    {
      data: '12/02/2026',
      itens: 'Vinho Silk & Spice, Kit Café Constantino',
      status: 'aguardando_compra',
    },
  ],
}

const MODELOS_DEMO = {
  Aniversário: [
    'Feliz aniversário, {nome}! Que este novo ano venha com saúde, conquistas e boas decisões. Obrigado por caminhar com a gente.',
    'Parabéns, {nome}! Um brinde a mais um ano e a tudo o que você vem construindo.',
  ],
  Casamento: [
    'Parabéns pelo casamento, {nome}! Que a vida a dois seja tão bem planejada quanto os sonhos de vocês.',
  ],
  Nascimento: [
    'Parabéns pela chegada do bebê, {nome}! Que venha muita saúde e um futuro bem preparado.',
  ],
  'Reforço de relacionamento': [
    'Oi, {nome}! Passando para agradecer pela confiança. Seguimos juntos e à disposição sempre que precisar.',
  ],
  'Primeiro milhão': [
    'Parabéns pelo primeiro milhão, {nome}! É o resultado de consistência e de boas escolhas.',
  ],
  Outro: ['Oi, {nome}! Este presente é um jeito de dizer que a gente lembra de você.'],
}

const UFS_DEMO = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]

const novaPrimeiroNome = (nome) => (nome || '').trim().split(/\s+/)[0] || ''

const novaProdutoPorSlug = (slug) => PRODUTOS.find((p) => p.slug === slug)

const novaTotal = () =>
  novaItens.reduce((acc, i) => acc + (novaProdutoPorSlug(i.slug)?.valor ?? 0) * i.quantidade, 0)

/** Espelha `acompanhamentosFaltando` de src/lib/acompanhamentos.ts. */
function novaPendencias() {
  const oferecidos = new Set(
    novaItens.map((i) => novaProdutoPorSlug(i.slug)?.serveComoAcompanhamento).filter(Boolean),
  )
  const faltando = new Map()
  for (const item of novaItens) {
    const p = novaProdutoPorSlug(item.slug)
    if (!p?.exigeAcompanhamento || oferecidos.has(p.exigeAcompanhamento)) continue
    const nomes = faltando.get(p.exigeAcompanhamento) ?? []
    if (!nomes.includes(p.nome)) nomes.push(p.nome)
    faltando.set(p.exigeAcompanhamento, nomes)
  }
  return [...faltando.entries()].map(([exigencia, produtos]) => ({ exigencia, produtos }))
}

/** Espelha `precisaDeCompra` de src/lib/status.ts. */
const novaPassaPeloFinanceiro = () =>
  novaItens.some((i) => novaProdutoPorSlug(i.slug)?.origem !== 'estoque_interno')

/** Espelha a validação por campo do formulário real. */
function novaProblemas(etapa) {
  const p = {}
  if (etapa === 0 && !novaCliente) p.cpf = 'Informe o CPF do cliente.'
  if (etapa === 1) {
    if (novaItens.length === 0) p.itens = 'Escolha ao menos um presente.'
    else if (novaPendencias().length > 0) p.itens = 'Falta o acompanhamento.'
  }
  if (etapa === 2) {
    if (novaEntrega.cep.replace(/\D/g, '').length !== 8) p.cep = 'CEP deve ter 8 dígitos.'
    if (!novaEntrega.logradouro.trim()) p.logradouro = 'Informe a rua ou avenida.'
    if (!novaEntrega.numero.trim()) p.numero = 'Informe o número, ou "s/n".'
    if (!novaEntrega.bairro.trim()) p.bairro = 'Informe o bairro.'
    if (!novaEntrega.cidade.trim()) p.cidade = 'Informe a cidade.'
    if (novaEntrega.uf.length !== 2) p.uf = 'Escolha o estado.'
    if (!novaEntrega.destinatario.trim()) p.destinatario = 'Informe quem recebe o presente.'
  }
  if (etapa === 3) {
    if (!novaCarta.mensagem.trim()) p.mensagem = 'Escreva a mensagem da carta.'
    if (novaCarta.motivo === 'Outro' && !novaCarta.motivoOutro.trim())
      p.motivoOutro = 'Diga qual é o motivo.'
  }
  return p
}

const erroDoCampo = (erros, chave) =>
  erros[chave]
    ? `<p class="flex items-start gap-1.5 text-xs text-error"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mt-0.5 size-3 shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>${esc(erros[chave])}</p>`
    : ''

const campoDemo = (id, rotulo, valor, erros, extra = '') => `
  <div class="space-y-1.5 ${extra}">
    <label for="${id}" class="font-ui text-sm font-medium">${esc(rotulo)}</label>
    <input id="${id}" data-nova-campo="${id}" value="${esc(valor)}"
      class="h-10 w-full rounded-md border bg-background px-3 text-sm ${erros[id] ? 'border-error' : 'border-input'}" />
    ${erroDoCampo(erros, id)}
  </div>`

// --- nova solicitação: as cinco etapas --------------------------------------

function novaTrilha() {
  return NOVA_ETAPAS.map((nome, i) => {
    const pendente = i <= novaMaiorEtapa && Object.keys(novaProblemas(i)).length > 0
    const concluida = i < novaMaiorEtapa && !pendente
    const atual = i === novaEtapa
    const marca = concluida
      ? '<span class="grid size-5 place-items-center rounded-full bg-success text-[10px] font-bold text-success-foreground">✓</span>'
      : `<span class="grid size-5 place-items-center rounded-full ${
          atual
            ? 'bg-primary text-primary-foreground'
            : pendente
              ? 'bg-warning text-warning-foreground'
              : 'bg-muted text-muted-foreground'
        } text-[10px] font-bold">${i + 1}</span>`

    return `
      <li class="flex items-center gap-1">
        <button ${i <= novaMaiorEtapa ? `data-nova-ir="${i}"` : 'disabled'}
          class="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
            atual
              ? 'bg-primary/10 font-medium text-primary-emphasis'
              : i <= novaMaiorEtapa
                ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                : 'text-muted-foreground/60'
          }">${marca}${esc(nome)}</button>
        ${i < NOVA_ETAPAS.length - 1 ? '<span class="h-px w-5 bg-border"></span>' : ''}
      </li>`
  }).join('')
}

function novaEtapaCliente(erros) {
  const c = novaCliente
  return `
    <p class="font-display text-lg font-semibold">Para quem é o presente?</p>
    <p class="mt-1 text-sm text-muted-foreground">
      O CPF identifica o cliente. Se já existir, usamos o cadastro que está lá.
    </p>

    <div class="mt-5 flex flex-wrap items-start gap-2">
      <div class="min-w-56 flex-1 space-y-1.5">
        <label for="nova-cpf" class="font-ui text-sm font-medium">CPF do cliente</label>
        <input id="nova-cpf" data-nova-campo="nova-cpf" value="${esc(novaCpf)}" placeholder="000.000.000-00"
          class="h-10 w-full rounded-md border bg-background px-3 text-sm ${erros.cpf ? 'border-error' : 'border-input'}" />
        ${erroDoCampo(erros, 'cpf')}
        <p class="text-xs text-muted-foreground">Nesta demonstração, qualquer CPF com 11 dígitos encontra um cliente.</p>
      </div>
      <button data-nova-buscar class="font-ui mt-[1.6rem] h-10 rounded-[5px] border border-primary bg-primary px-5 text-sm font-semibold uppercase text-primary-foreground">
        Buscar
      </button>
    </div>

    ${
      c
        ? `<div class="mt-5 space-y-3 rounded-lg border border-success/30 bg-success/10 p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="font-ui text-xs font-semibold uppercase tracking-wider text-success">Cliente encontrado</p>
                <p class="mt-1.5 font-medium">${esc(c.nome)}</p>
                <p class="text-sm tabular-nums text-muted-foreground">${esc(c.cpf)}</p>
              </div>
              <button data-nova-trocar class="text-sm text-muted-foreground underline-offset-4 hover:underline">Trocar de cliente</button>
            </div>
            <dl class="grid gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
              <div class="flex gap-2"><dt>Telefone</dt><dd class="text-foreground tabular-nums">${esc(c.telefone)}</dd></div>
              <div class="flex min-w-0 gap-2"><dt>E-mail</dt><dd class="truncate text-foreground">${esc(c.email)}</dd></div>
            </dl>
            <div class="space-y-2 border-t pt-3">
              <p class="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Você já mandou</p>
              ${c.jaRecebeu
                .map(
                  (h) => `<p class="flex flex-wrap items-center gap-x-2 text-sm">
                    <span class="tabular-nums text-muted-foreground">${esc(h.data)}</span>
                    <span class="min-w-0 flex-1">${esc(h.itens)}</span>
                    ${selo(h.status)}
                  </p>`,
                )
                .join('')}
              <p class="text-xs text-muted-foreground">Existe para não repetir o presente do ano passado.</p>
            </div>
          </div>`
        : ''
    }`
}

function novaEtapaItens(erros) {
  const pendencias = novaPendencias()
  const total = novaTotal()
  const depois = NOVA_GASTO_ANTERIOR + total

  const base = novaAcompanhamento
    ? PRODUTOS.filter((p) => p.ativo && p.serveComoAcompanhamento === novaAcompanhamento)
    : PRODUTOS.filter((p) => p.ativo)

  const termo = novaBusca.trim().toLowerCase()
  const visiveis = base.filter(
    (p) =>
      (!novaCategoria || p.categoria === novaCategoria) &&
      (!termo || p.nome.toLowerCase().includes(termo)),
  )

  const categorias = [...new Set(base.map((p) => p.categoria))]
    .map((nome) => ({ nome, total: base.filter((p) => p.categoria === nome).length }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  const pilula = (rotulo, valor, ativa, qtd) => `
    <button data-nova-cat="${esc(valor)}" class="rounded-xl border px-3 py-1.5 text-left transition-[border-color,background-color] ${
      ativa ? 'border-primary bg-primary/5 ring-2 ring-primary/25' : 'hover:border-primary/40'
    }">
      <span class="font-display block text-xs font-bold leading-tight whitespace-nowrap">${esc(rotulo)}</span>
      <span class="font-roboto mt-0.5 block text-[10px] leading-tight text-muted-foreground">${qtd} ${qtd === 1 ? 'item' : 'itens'}</span>
    </button>`

  const cards = visiveis
    .slice(0, 12)
    .map((p) => {
      const qtd = novaItens.find((i) => i.slug === p.slug)?.quantidade ?? 0
      return `
      <div class="relative flex flex-col overflow-hidden rounded-xl border transition-[border-color,box-shadow] ${
        qtd > 0 ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/40'
      }">
        ${imagemDoProduto(p)}
        ${qtd > 0 ? `<span class="font-ui absolute right-2 top-2 z-20 grid size-7 place-items-center rounded-full bg-primary text-xs font-bold tabular-nums text-primary-foreground">${qtd}</span>` : ''}
        <div class="flex flex-1 flex-col items-start gap-1 p-3">
          <div class="flex flex-wrap items-center gap-1.5">${categoriaBadge(p.categoria)}${seloDeAcompanhamento(p)}</div>
          <p class="font-display text-sm font-semibold leading-snug">${esc(p.nome)}</p>
          ${linkDaLoja(p)}
          <p class="mt-auto pt-1 text-sm font-medium">${preco(p)}</p>
        </div>
        <button data-nova-add="${p.slug}" aria-label="Adicionar ${esc(p.nome)}" class="absolute inset-0 z-10 cursor-pointer rounded-xl"></button>
      </div>`
    })
    .join('')

  return `
    <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
      <div>
        <p class="font-display text-lg font-semibold">O que vai no envio?</p>
        <p class="mt-1 text-sm text-muted-foreground">
          Escolha do catálogo ou descreva um presente específico com o link onde comprar.
        </p>
      </div>
      ${
        novaItens.length > 0
          ? `<p class="text-right text-sm">
              <span class="text-muted-foreground">${novaItens.length} ${novaItens.length === 1 ? 'item' : 'itens'}</span>
              <span class="block font-semibold tabular-nums">${brl(total)}</span>
            </p>`
          : ''
      }
    </div>

    ${
      depois > NOVA_LIMITE
        ? `<p class="mt-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
            Com este pedido, o mês fecha em ${brl(depois)}, acima do limite de ${brl(NOVA_LIMITE)}.
            Dá para seguir assim, mas o Admin vai ver o estouro.
          </p>`
        : ''
    }

    ${
      novaAcompanhamento
        ? `<div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/40 px-3 py-2">
            <p class="min-w-0 flex-1 text-sm">Mostrando só o que serve como <strong>${esc(novaAcompanhamento)}</strong>.</p>
            <button data-nova-limpar-acomp class="text-xs text-muted-foreground underline-offset-4 hover:underline">Ver o catálogo inteiro</button>
          </div>`
        : ''
    }

    <div class="mt-4 space-y-3">
      <input id="nova-busca" data-nova-campo="nova-busca" value="${esc(novaBusca)}" placeholder="Buscar no catálogo"
        class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
      <div class="-mx-1 flex flex-wrap gap-2 px-1">
        ${pilula('Todos', '', !novaCategoria, base.length)}
        ${categorias.map((c) => pilula(c.nome, c.nome, novaCategoria === c.nome, c.total)).join('')}
      </div>
    </div>

    <div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">${cards}</div>
    ${visiveis.length > 12 ? `<p class="mt-3 text-xs text-muted-foreground">Mostrando 12 de ${visiveis.length}. Na ferramenta, a grade traz o catálogo inteiro.</p>` : ''}

    <div class="mt-6 rounded-lg border border-dashed p-4">
      <p class="text-sm font-medium">Presente específico</p>
      <p class="mt-1 text-xs text-muted-foreground">
        Fora do catálogo. O link é obrigatório: é por ele que o Financeiro compra. Um item assim
        nunca satisfaz o acompanhamento de um kit, porque é texto livre.
      </p>
    </div>

    ${pendencias.length > 0 ? '' : ''}`
}

function novaEtapaEntrega(erros) {
  return `
    <p class="font-display text-lg font-semibold">Para onde enviar?</p>
    <p class="mt-1 text-sm text-muted-foreground">
      O endereço fica gravado nesta solicitação. Se o cliente se mudar, o histórico continua
      mostrando para onde o presente foi.
    </p>

    <div class="mt-5 grid gap-3 sm:grid-cols-6">
      <div class="space-y-1.5 sm:col-span-2">
        <label for="nova-cep" class="font-ui text-sm font-medium">CEP</label>
        <div class="flex gap-2">
          <input id="nova-cep" data-nova-campo="nova-cep" value="${esc(novaEntrega.cep)}" placeholder="00000-000"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm ${erros.cep ? 'border-error' : 'border-input'}" />
          <button data-nova-cep class="font-ui h-10 shrink-0 rounded-[5px] border border-input px-3 text-sm">Buscar</button>
        </div>
        ${erroDoCampo(erros, 'cep')}
      </div>
      ${campoDemo('logradouro', 'Logradouro', novaEntrega.logradouro, erros, 'sm:col-span-4')}
      ${campoDemo('numero', 'Número', novaEntrega.numero, erros, 'sm:col-span-1')}
      ${campoDemo('complemento', 'Complemento', novaEntrega.complemento, erros, 'sm:col-span-2')}
      ${campoDemo('bairro', 'Bairro', novaEntrega.bairro, erros, 'sm:col-span-3')}
      ${campoDemo('cidade', 'Cidade', novaEntrega.cidade, erros, 'sm:col-span-4')}
      <div class="space-y-1.5 sm:col-span-2">
        <label for="uf" class="font-ui text-sm font-medium">Estado</label>
        <select id="uf" data-nova-uf class="h-10 w-full rounded-md border bg-background px-3 text-sm ${erros.uf ? 'border-error' : 'border-input'}">
          <option value="">UF</option>
          ${UFS_DEMO.map((uf) => `<option ${novaEntrega.uf === uf ? 'selected' : ''}>${uf}</option>`).join('')}
        </select>
        ${erroDoCampo(erros, 'uf')}
      </div>
      ${campoDemo('destinatario', 'Quem recebe', novaEntrega.destinatario, erros, 'sm:col-span-6')}
    </div>
    <p class="mt-2 text-xs text-muted-foreground">
      O botão do CEP preenche rua, bairro, cidade e estado, e o cursor pula para o número.
    </p>`
}

function novaFolhaDaCarta() {
  const nome = novaPrimeiroNome(novaEntrega.destinatario || novaCliente?.nome || '')
  const corpo = novaCarta.mensagem.trim()
  const primeiraFrase = corpo.split(/[.!?]/, 1)[0] ?? ''
  const jaCumprimenta = nome && new RegExp(`\\b${nome}\\b`, 'i').test(primeiraFrase)
  const ocasiao =
    novaCarta.motivo === 'Outro' ? novaCarta.motivoOutro || 'Uma lembrança' : novaCarta.motivo

  return `
    <div class="flex flex-col rounded-xl bg-card p-6 shadow-sm ring-1 ring-border/60">
      <div class="flex items-center justify-between gap-3 border-b pb-3">
        <svg viewBox="0 0 400 250" fill="currentColor" class="h-5 w-auto text-primary-emphasis" aria-hidden="true"><path d="${olhoPath()}"/></svg>
        <span class="font-ui text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">${esc(ocasiao)}</span>
      </div>
      <div class="font-roboto flex-1 space-y-3 pt-5 text-sm leading-relaxed">
        ${nome && !jaCumprimenta ? `<p>Olá, ${esc(nome)},</p>` : ''}
        ${
          corpo
            ? `<p class="whitespace-pre-wrap">${esc(corpo)}</p>`
            : '<p class="italic text-muted-foreground/70">A mensagem aparece aqui conforme você escreve.</p>'
        }
      </div>
      <p class="font-display mt-6 border-t pt-3 text-sm text-muted-foreground">
        ${esc(NOVA_CONSULTOR)}
        <span class="block text-xs text-muted-foreground/70">Relacionamento AUVP</span>
      </p>
    </div>`
}

function novaEtapaCarta(erros) {
  const nome = novaPrimeiroNome(novaEntrega.destinatario || novaCliente?.nome || '')
  const modelos = MODELOS_DEMO[novaCarta.motivo] ?? []
  const restam = 600 - novaCarta.mensagem.length

  return `
    <p class="font-display text-lg font-semibold">A carta que vai junto</p>
    <p class="mt-1 text-sm text-muted-foreground">
      A mensagem acompanha o presente. A impressão continua sendo feita fora do sistema.
    </p>

    <div class="mt-5 grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div class="min-w-0 space-y-5">
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="space-y-1.5">
            <label for="nova-motivo" class="font-ui text-sm font-medium">Motivo do envio</label>
            <select id="nova-motivo" data-nova-motivo class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              ${Object.keys(MODELOS_DEMO)
                .map(
                  (m) => `<option ${novaCarta.motivo === m ? 'selected' : ''}>${esc(m)}</option>`,
                )
                .join('')}
            </select>
          </div>
          ${
            novaCarta.motivo === 'Outro'
              ? `<div class="space-y-1.5">
                  <label for="motivoOutro" class="font-ui text-sm font-medium">Qual?</label>
                  <input id="motivoOutro" data-nova-campo="motivoOutro" value="${esc(novaCarta.motivoOutro)}" placeholder="Formatura, mudança de casa…"
                    class="h-10 w-full rounded-md border bg-background px-3 text-sm ${erros.motivoOutro ? 'border-error' : 'border-input'}" />
                  ${erroDoCampo(erros, 'motivoOutro')}
                </div>`
              : ''
          }
        </div>

        <div class="space-y-2">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <label for="nova-mensagem" class="font-ui text-sm font-medium">Mensagem</label>
            <span class="text-xs tabular-nums ${restam < 0 ? 'font-medium text-error' : 'text-muted-foreground'}">
              ${restam < 0 ? `${-restam} a mais do que cabe` : `${restam} caracteres restantes`}
            </span>
          </div>
          <textarea id="nova-mensagem" data-nova-campo="nova-mensagem" rows="6" placeholder="Escreva a mensagem que vai na carta."
            class="w-full rounded-md border bg-background p-3 text-sm ${erros.mensagem ? 'border-error' : 'border-input'}">${esc(novaCarta.mensagem)}</textarea>
          ${erroDoCampo(erros, 'mensagem')}

          <div class="space-y-1.5">
            <p class="text-xs text-muted-foreground">${novaCarta.mensagem.trim() ? 'Trocar por um modelo:' : 'Começar de um modelo:'}</p>
            <div class="flex flex-wrap gap-2">
              ${modelos
                .map(
                  (m, i) =>
                    `<button data-nova-modelo="${i}" class="max-w-full rounded-lg border px-3 py-2 text-left text-xs leading-snug transition-colors hover:border-primary/40">
                      <span class="line-clamp-2">${esc(m.replaceAll('{nome}', nome || 'cliente'))}</span>
                    </button>`,
                )
                .join('')}
            </div>
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="font-ui text-sm font-medium">Observações internas</label>
          <div class="h-16 w-full rounded-md border border-input bg-background p-3 text-sm text-muted-foreground">
            Não vai na carta. Fica para quem processa o envio.
          </div>
        </div>
      </div>

      <div>
        <p class="font-ui mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Como vai ficar</p>
        ${novaFolhaDaCarta()}
      </div>
    </div>`
}

function novaEtapaRevisao() {
  const total = novaTotal()
  const depois = NOVA_GASTO_ANTERIOR + total
  const linhas = novaItens
    .map((i) => {
      const p = novaProdutoPorSlug(i.slug)
      const unit = p?.valor ?? 0
      return `
      <li class="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
        <span class="min-w-0">
          <span class="font-medium">${esc(p?.nome ?? '')}</span>
          <span class="block text-xs tabular-nums text-muted-foreground">${i.quantidade} × ${p?.valor === null ? 'valor a definir' : brl(unit)}</span>
        </span>
        <span class="shrink-0 tabular-nums">${brl(unit * i.quantidade)}</span>
      </li>`
    })
    .join('')

  const bloco = (titulo, corpo, etapa) => `
    <div class="rounded-lg bg-muted/40 p-4 text-sm">
      <div class="mb-1.5 flex items-baseline justify-between gap-3">
        <p class="font-ui text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">${esc(titulo)}</p>
        <button data-nova-ir="${etapa}" class="text-xs text-muted-foreground underline-offset-4 hover:underline">Editar</button>
      </div>
      ${corpo}
    </div>`

  return `
    <p class="font-display text-lg font-semibold">Confira antes de enviar</p>
    <p class="mt-1 text-sm text-muted-foreground">
      Nada foi criado ainda. A solicitação nasce ao enviar, com o código e o histórico.
    </p>

    <div class="mt-5 grid gap-4 sm:grid-cols-2">
      ${bloco('Cliente', `<p class="font-medium">${esc(novaCliente?.nome ?? '')}</p><p class="tabular-nums text-muted-foreground">${esc(novaCliente?.cpf ?? '')}</p>`, 0)}
      ${bloco(
        'Entrega',
        `<p class="font-medium">${esc(novaEntrega.destinatario)}</p>
         <p class="text-muted-foreground">${esc(novaEntrega.logradouro)}, ${esc(novaEntrega.numero)}${novaEntrega.complemento ? ', ' + esc(novaEntrega.complemento) : ''}</p>
         <p class="text-muted-foreground">${esc(novaEntrega.bairro)} · ${esc(novaEntrega.cidade)}/${esc(novaEntrega.uf)} · <span class="tabular-nums">${esc(novaEntrega.cep)}</span></p>`,
        2,
      )}
    </div>

    <div class="mt-6">
      <div class="mb-2 flex items-baseline justify-between gap-3">
        <p class="font-ui text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Itens</p>
        <button data-nova-ir="1" class="text-xs text-muted-foreground underline-offset-4 hover:underline">Editar itens</button>
      </div>
      <ul class="divide-y rounded-lg border">
        ${linhas}
        <li class="flex items-baseline justify-between gap-3 px-4 py-3">
          <span class="text-sm text-muted-foreground">Total</span>
          <span class="text-lg font-semibold tabular-nums">${brl(total)}</span>
        </li>
      </ul>
      ${depois > NOVA_LIMITE ? `<p class="mt-2 text-xs text-muted-foreground">O mês fecha em ${brl(depois)}, acima do limite de ${brl(NOVA_LIMITE)}.</p>` : ''}
    </div>

    <div class="mt-6">
      <div class="mb-2 flex items-baseline justify-between gap-3">
        <p class="font-ui text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Carta</p>
        <button data-nova-ir="3" class="text-xs text-muted-foreground underline-offset-4 hover:underline">Editar a carta</button>
      </div>
      ${novaFolhaDaCarta()}
    </div>

    <div class="mt-6 rounded-lg bg-muted/40 p-4 text-sm">
      <p class="font-ui mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">O que acontece ao enviar</p>
      <p>
        O pedido entra como <strong>pendente</strong> e espera a aprovação do Admin.
        ${
          novaPassaPeloFinanceiro()
            ? 'Depois dela, passa pelo Financeiro, porque há item que precisa ser comprado.'
            : 'Depois dela, vai direto para a expedição separar: está tudo em estoque.'
        }
      </p>
    </div>`
}

function novaResumo() {
  const total = novaTotal()
  const depois = NOVA_GASTO_ANTERIOR + total
  const percentual = Math.min(100, (depois / NOVA_LIMITE) * 100)
  const estoura = depois > NOVA_LIMITE

  const itens = novaItens
    .map((i) => {
      const p = novaProdutoPorSlug(i.slug)
      return `
      <div class="flex items-start gap-2 text-sm">
        <div class="min-w-0 flex-1">
          <p class="font-medium leading-snug">${esc(p?.nome ?? '')}</p>
          <p class="tabular-nums text-muted-foreground">${i.quantidade} × ${p?.valor === null ? 'valor a definir' : brl(p?.valor ?? 0)}</p>
        </div>
        <button data-nova-remove="${p?.slug}" aria-label="Remover" class="mt-1 text-muted-foreground transition-colors hover:text-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
        </button>
      </div>`
    })
    .join('')

  return `
    <aside class="h-fit rounded-lg border bg-card p-5 lg:sticky lg:top-24">
      <p class="font-ui mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Resumo</p>
      ${
        novaCliente
          ? `<p class="text-sm font-medium">${esc(novaCliente.nome)}</p>
             <p class="text-xs tabular-nums text-muted-foreground">${esc(novaCliente.cpf)}</p>`
          : '<p class="text-sm text-muted-foreground">Nenhum cliente escolhido ainda.</p>'
      }

      <div class="mt-4 space-y-3 border-t pt-4">
        ${itens || '<p class="text-sm text-muted-foreground">Nenhum item adicionado.</p>'}
      </div>

      <div class="mt-4 space-y-1 border-t pt-4">
        <div class="flex items-baseline justify-between">
          <span class="text-sm text-muted-foreground">Total</span>
          <span class="text-xl font-semibold tabular-nums">${brl(total)}</span>
        </div>
        ${
          novaItens.length > 0
            ? `<p class="text-xs text-muted-foreground">${
                novaPassaPeloFinanceiro()
                  ? 'Depois da aprovação, passa pelo Financeiro comprar.'
                  : 'Depois da aprovação, vai direto para a expedição.'
              }</p>`
            : ''
        }
      </div>

      <div class="mt-4 space-y-1.5 border-t pt-4">
        <div class="flex items-baseline justify-between gap-2">
          <span class="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Seu mês</span>
          <span class="text-xs tabular-nums ${estoura ? 'font-medium text-warning' : 'text-muted-foreground'}">${brl(depois)} de ${brl(NOVA_LIMITE)}</span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-muted">
          <div class="h-full rounded-full transition-[width] duration-500 ${estoura ? 'bg-warning' : 'bg-primary'}" style="width:${Math.max(2, percentual)}%"></div>
        </div>
        <p class="text-xs text-muted-foreground">
          ${estoura ? `Passa ${brl(depois - NOVA_LIMITE)} do limite. Não impede o pedido.` : `Restam ${brl(NOVA_LIMITE - depois)} neste mês.`}
        </p>
      </div>
    </aside>`
}

/**
 * Nova solicitação: as cinco etapas, navegáveis.
 *
 * É a tela em que o consultor passa o tempo dele, então é a única da vitrine
 * que funciona de verdade em vez de ser um retrato. As regras que aparecem
 * aqui são as mesmas da ferramenta, reescritas em JavaScript puro logo acima:
 * a trava do kit, o limite do mês, a validação por campo e a rota depois da
 * aprovação.
 */
function telaNova() {
  const erros = novaConferir ? novaProblemas(novaEtapa) : {}
  const pendencias = novaPendencias()
  const corpo =
    novaEtapa === 0
      ? novaEtapaCliente(erros)
      : novaEtapa === 1
        ? novaEtapaItens(erros)
        : novaEtapa === 2
          ? novaEtapaEntrega(erros)
          : novaEtapa === 3
            ? novaEtapaCarta(erros)
            : novaEtapaRevisao()

  return `
    ${cabecalho('Enviar um presente', 'Cinco etapas, do cliente à revisão. Nada é enviado antes da última.')}

    <div class="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div class="min-w-0">
        <ol class="mb-6 flex flex-wrap items-center gap-x-1 gap-y-2">${novaTrilha()}</ol>

        ${
          pendencias.length > 0
            ? `<div class="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
                <p class="min-w-0 flex-1 text-sm">
                  ${pendencias
                    .map(
                      (p) =>
                        `“${esc(p.produtos.join('”, “'))}” ${p.produtos.length === 1 ? 'precisa' : 'precisam'} de um ${esc(p.exigencia)} na mesma solicitação`,
                    )
                    .join('; ')}. Escolha no catálogo antes de continuar.
                </p>
                <button data-nova-acomp="${esc(pendencias[0].exigencia)}" class="font-ui inline-flex h-8 items-center rounded-[5px] border px-3 text-xs font-semibold uppercase">
                  Escolher o ${esc(pendencias[0].exigencia)}
                </button>
              </div>`
            : ''
        }

        <div class="rounded-lg border bg-card p-6 shadow-[0_1px_2px_rgba(11,41,5,0.04)]">${corpo}</div>

        <div class="mt-6 flex items-center justify-between gap-3">
          <button ${novaEtapa === 0 ? 'disabled' : `data-nova-ir="${novaEtapa - 1}"`}
            class="font-ui h-10 rounded-[5px] px-4 text-sm font-semibold uppercase ${novaEtapa === 0 ? 'text-muted-foreground/50' : 'hover:bg-accent'}">
            Voltar
          </button>
          ${
            novaEtapa < 4
              ? `<button data-nova-continuar class="font-ui h-10 rounded-[5px] border px-5 text-sm font-semibold uppercase ${
                  Object.keys(novaProblemas(novaEtapa)).length === 0
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background'
                }">Continuar</button>`
              : `<button data-nova-enviar class="font-ui h-10 rounded-[5px] border border-primary bg-primary px-5 text-sm font-semibold uppercase text-primary-foreground">Enviar solicitação</button>`
          }
        </div>
      </div>

      ${novaResumo()}
    </div>

    <p class="mt-6 text-xs text-muted-foreground">
      Este fluxo é navegável: preencha, volte, edite. Nada é gravado, e o CPF encontra sempre o
      mesmo cliente de exemplo. O valor de cada item é relido do banco e congelado na hora de
      gravar, para que reajuste de preço não mexa em solicitação já feita.
    </p>`
}

/**
 * Rota do pedido: tem o que comprar, ou já está na prateleira?
 *
 * Espelha `precisaDeCompra` de `src/lib/status.ts`. A coluna existe para que o
 * Admin decida sem abrir cada pedido.
 */
function precisaDeCompra(s) {
  return s.itens.some((i) => !i.emEstoque)
}

const ENCAMINHAVEIS = ['pendente', 'aguardando_aprovacao']

function linhasDeSolicitacao(lista, comConsultor, comSelecao) {
  return lista
    .map(
      (s) => `
    <tr class="border-b last:border-0 hover:bg-muted/40">
      ${
        comSelecao
          ? `<td class="px-4 py-3.5"><input type="checkbox" class="size-4 accent-primary align-middle" ${
              ENCAMINHAVEIS.includes(s.status) ? 'checked' : 'disabled'
            } /></td>`
          : ''
      }
      <td class="whitespace-nowrap px-4 py-3.5 font-medium tabular-nums">
        <button data-detalhe="${esc(s.codigo)}" class="underline-offset-4 hover:text-primary-emphasis hover:underline">${esc(s.codigo)}</button>
      </td>
      <td class="whitespace-nowrap px-4 py-3.5 tabular-nums text-muted-foreground">${esc(s.data)}</td>
      ${comConsultor ? `<td class="px-4 py-3.5">${esc(s.consultor)}</td>` : ''}
      <td class="px-4 py-3.5">${esc(s.cliente)}</td>
      <td class="px-4 py-3.5 text-right tabular-nums">${s.itens.length}</td>
      <td class="whitespace-nowrap px-4 py-3.5 text-right font-medium tabular-nums">${brl(totalDaSolicitacao(s))}</td>
      ${
        comSelecao
          ? `<td class="whitespace-nowrap px-4 py-3.5">${
              ENCAMINHAVEIS.includes(s.status)
                ? `<span class="rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    precisaDeCompra(s) ? 'border text-foreground' : 'bg-muted text-muted-foreground'
                  }">${precisaDeCompra(s) ? 'compra' : 'estoque'}</span>`
                : '<span class="text-muted-foreground">-</span>'
            }</td>`
          : ''
      }
      <td class="px-4 py-3.5">
        ${selo(s.status)}
        ${s.rastreio ? `<span class="mt-0.5 block text-xs tabular-nums text-muted-foreground">${esc(s.rastreio)}</span>` : ''}
      </td>
    </tr>`,
    )
    .join('')
}

function telaMinhas() {
  const minhas = SOLICITACOES.filter((s) => s.consultor === 'Carlos Consultor')
  // Tudo entra na conta, cancelado e devolvido inclusive: a área reenvia.
  const gasto = minhas.reduce((acc, s) => acc + totalDaSolicitacao(s), 0)
  const limite = 5000
  const pct = Math.min(100, (gasto / limite) * 100)

  return `
    ${cabecalho('Minhas solicitações', 'Os presentes que você pediu, com o status e o rastreio de cada envio.')}
    <div class="mb-6 rounded-lg border bg-card p-5 shadow-sm">
      <p class="text-sm text-muted-foreground">Gasto no mês</p>
      <p class="mt-1 text-2xl font-semibold">${brl(gasto)}</p>
      <div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div class="h-full bg-success" style="width:${pct}%"></div>
      </div>
      <p class="mt-2 text-sm text-muted-foreground">${brl(gasto)} de ${brl(limite)}, tudo o que foi solicitado no mês entra na conta.</p>
    </div>
    <div class="overflow-hidden rounded-lg border bg-card shadow-[0_1px_2px_rgba(11,41,5,0.04)]">
      <table class="w-full text-sm">
        <thead class="border-b bg-muted/40 text-left text-muted-foreground">
          <tr>
            <th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Código</th><th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Data</th>
            <th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Cliente</th><th class="font-ui h-11 px-4 text-right text-xs font-semibold uppercase tracking-[0.08em]">Itens</th>
            <th class="font-ui h-11 px-4 text-right text-xs font-semibold uppercase tracking-[0.08em]">Valor</th><th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Status</th>
          </tr>
        </thead>
        <tbody>${linhasDeSolicitacao(minhas, false)}</tbody>
      </table>
    </div>`
}

function telaGestao() {
  const total = SOLICITACOES.reduce((acc, s) => acc + totalDaSolicitacao(s), 0)
  const pendentes = SOLICITACOES.filter((s) => ENCAMINHAVEIS.includes(s.status)).length

  return `
    ${cabecalho('Solicitações', 'Acompanhe o fluxo inteiro, corrija dados e exporte o resultado filtrado.')}
    <div class="mb-6 flex flex-wrap items-center gap-2">
      <input placeholder="Código, cliente ou consultor" class="h-9 w-56 rounded-md border border-input px-3 text-sm" />
      <input type="date" class="h-9 rounded-md border border-input px-3 text-sm" />
      <select class="h-9 rounded-md border border-input bg-card px-3 text-sm"><option>Todos os consultores</option></select>
      <select class="h-9 rounded-md border border-input bg-card px-3 text-sm">
        <option>Todos os status</option>
        ${Object.values(STATUS)
          .map((s) => `<option>${esc(s.rotulo)}</option>`)
          .join('')}
      </select>
      <span class="ml-auto flex gap-2">
        <span class="rounded-md border bg-card px-3 py-1.5 text-sm text-muted-foreground">Exportar CSV</span>
        <span class="rounded-md border bg-card px-3 py-1.5 text-sm text-muted-foreground">Exportar XLSX</span>
      </span>
    </div>
    <div class="mb-6 grid gap-4 sm:grid-cols-3">
      ${cartao('Solicitações no filtro', String(SOLICITACOES.length))}
      ${cartao('Valor somado', brl(total), 'Todos os status entram na conta, cancelados e devolvidos inclusive.')}
      ${cartao('Precisando de atenção', String(SOLICITACOES.filter((s) => s.status === 'deu_problema').length), 'com status “deu problema”')}
    </div>
    <div class="mb-4 flex min-h-14 flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
      <p class="text-sm font-medium">${pendentes} selecionadas</p>
      <div class="flex flex-wrap items-center gap-2 sm:ml-auto">
        <span class="rounded-[5px] border border-primary bg-primary px-4 py-1.5 font-ui text-xs font-semibold uppercase text-primary-foreground">Aprovar e encaminhar</span>
        <span class="rounded-[5px] border bg-card px-4 py-1.5 font-ui text-xs font-semibold uppercase">Mandar comprar</span>
        <span class="rounded-[5px] border bg-card px-4 py-1.5 font-ui text-xs font-semibold uppercase">Liberar para envio</span>
      </div>
    </div>
    <div class="overflow-hidden rounded-lg border bg-card shadow-[0_1px_2px_rgba(11,41,5,0.04)]">
      <table class="w-full text-sm">
        <thead class="border-b bg-muted/40 text-left text-muted-foreground">
          <tr>
            <th class="font-ui h-11 w-10 px-4"><input type="checkbox" class="size-4 accent-primary align-middle" checked /></th>
            <th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Código</th><th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Data</th>
            <th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Consultor</th><th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Cliente</th>
            <th class="font-ui h-11 px-4 text-right text-xs font-semibold uppercase tracking-[0.08em]">Itens</th><th class="font-ui h-11 px-4 text-right text-xs font-semibold uppercase tracking-[0.08em]">Valor</th>
            <th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Rota</th>
            <th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Status</th>
          </tr>
        </thead>
        <tbody>${linhasDeSolicitacao(SOLICITACOES, true, true)}</tbody>
      </table>
    </div>
    <p class="mt-4 text-xs text-muted-foreground">
      O Admin trabalha por pilha: marca os pedidos acumulados e encaminha de uma vez. Quando a
      solicitação ainda está pendente, a aprovação entra como um passo antes do destino e vira uma
      linha própria do histórico, nada vai do pedido do consultor para a expedição sem o OK.
      A exportação leva o resultado inteiro do filtro, uma linha por item, para que a soma dos
      valores feche. Clique num código para ver o detalhe.
    </p>`
}

let detalheSelecionado = 'SOL-2026-0004'

/**
 * O que já está desenhado na tela.
 *
 * Serve para distinguir "trocou de tela" de "a mesma tela mudou de estado".
 * A distinção importa porque a animação de entrada é de troca de tela: repetir
 * a cada clique faz a página inteira reaparecer do zero, e filtrar uma
 * categoria ou digitar uma letra passa a piscar.
 */
let telaDesenhada = null
let perfilDesenhado = null

function telaDetalhe() {
  const s = SOLICITACOES.find((x) => x.codigo === detalheSelecionado) ?? SOLICITACOES[0]

  const itens = s.itens
    .map(
      (i) => `
    <tr class="border-b last:border-0">
      <td class="p-3">
        ${esc(i.produto)}
        ${i.site ? `<a href="${esc(i.site)}" target="_blank" rel="noopener" class="block truncate text-xs text-muted-foreground underline underline-offset-2">${esc(i.site)}</a>` : ''}
      </td>
      <td class="p-3 text-right">${i.quantidade}</td>
      <td class="p-3 text-right">${brl(i.valorUnitario)}</td>
      <td class="p-3 text-right">${brl(i.valorUnitario * i.quantidade)}</td>
    </tr>`,
    )
    .join('')

  const historico = s.historico
    .map(
      (h) => `
    <div class="border-l-2 border-border pl-3 text-sm">
      <p>${h.de ? `${esc(h.de)} → ` : ''}<strong>${esc(h.para)}</strong></p>
      <p class="text-xs text-muted-foreground">${esc(h.quando)} · ${esc(h.quem)}</p>
      ${h.motivo ? `<p class="mt-1 text-xs text-foreground">${esc(h.motivo)}</p>` : ''}
    </div>`,
    )
    .join('')

  const outras = SOLICITACOES.map(
    (x) =>
      `<option value="${esc(x.codigo)}" ${x.codigo === s.codigo ? 'selected' : ''}>${esc(x.codigo)}</option>`,
  ).join('')

  return `
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">${esc(s.codigo)}</h1>
        <p class="mt-1 text-sm text-muted-foreground">${esc(s.data)} · ${esc(s.consultor)}</p>
      </div>
      <div class="flex items-center gap-3">
        ${selo(s.status)}
        <select id="trocaDetalhe" class="h-9 rounded-md border border-input bg-card px-2 text-sm">${outras}</select>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-3">
      <div class="space-y-6 lg:col-span-2">
        <div class="overflow-hidden rounded-lg border bg-card shadow-[0_1px_2px_rgba(11,41,5,0.04)]">
          <div class="border-b p-4 font-medium">Itens</div>
          <table class="w-full text-sm">
            <thead class="border-b bg-muted/40 text-left text-muted-foreground">
              <tr><th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Item</th><th class="font-ui h-11 px-4 text-right text-xs font-semibold uppercase tracking-[0.08em]">Qtd.</th>
              <th class="font-ui h-11 px-4 text-right text-xs font-semibold uppercase tracking-[0.08em]">Unitário</th><th class="font-ui h-11 px-4 text-right text-xs font-semibold uppercase tracking-[0.08em]">Subtotal</th></tr>
            </thead>
            <tbody>
              ${itens}
              <tr><td colspan="3" class="font-ui h-11 px-4 text-right text-xs font-semibold uppercase tracking-[0.08em]">Total</td>
              <td class="font-ui h-11 px-4 text-right text-xs font-semibold uppercase tracking-[0.08em]">${brl(totalDaSolicitacao(s))}</td></tr>
            </tbody>
          </table>
        </div>

        <div class="rounded-lg border bg-card p-5">
          <p class="font-medium">Carta</p>
          <p class="mt-1 text-sm text-muted-foreground">Motivo: ${esc(s.motivo)}</p>
          <p class="mt-3 whitespace-pre-wrap text-sm">${esc(s.carta)}</p>
        </div>

        <div class="rounded-lg border bg-card p-5">
          <p class="mb-3 font-medium">Histórico</p>
          <div class="space-y-3">${historico}</div>
        </div>
      </div>

      <div class="space-y-6">
        <div class="rounded-lg border bg-card p-5">
          <p class="font-medium">Cliente</p>
          <p class="mt-2 text-sm">${esc(s.cliente)}</p>
          <p class="text-sm text-muted-foreground">${esc(s.cpf)}</p>
        </div>
        <div class="rounded-lg border bg-card p-5">
          <p class="font-medium">Entrega</p>
          <p class="mt-2 text-sm">${esc(s.destinatario)}</p>
          <p class="text-sm text-muted-foreground">${esc(s.entrega)}</p>
        </div>
        <div class="rounded-lg border bg-card p-5">
          <p class="mb-2 font-medium">Alterar status</p>
          ${
            perfil === 'consultor'
              ? '<p class="text-sm text-muted-foreground">Seu perfil acompanha o status, mas não o altera.</p>'
              : `<p class="text-sm text-muted-foreground">A partir de <strong>${esc(STATUS[s.status].rotulo)}</strong> a solicitação pode ir para:</p>
                 <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                   ${
                     s.status === 'deu_problema'
                       ? '<li>qualquer etapa anterior do fluxo</li><li>Cancelado <span class="text-xs">(exige motivo)</span></li>'
                       : '<li>a próxima etapa do fluxo</li><li>Deu problema <span class="text-xs">(exige motivo)</span></li><li>Cancelado <span class="text-xs">(exige motivo)</span></li>'
                   }
                 </ul>`
          }
        </div>
      </div>
    </div>`
}

/**
 * Fornecedor padrão por categoria, espelha `src/lib/fornecedores.ts`.
 *
 * Bebida é sempre comprada na Casa da Bebida, por regra da área. O link do
 * presente específico vence o padrão: ele foi escolhido para aquele item.
 */
const FORNECEDOR_DA_CATEGORIA = { bebidas: 'https://casadabebida.com.br' }

function site(item) {
  const padrao = FORNECEDOR_DA_CATEGORIA[(item.categoria || '').toLowerCase()]
  const url = item.site || padrao

  if (!url) {
    return '<span class="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">catálogo</span>'
  }

  return `
    <a href="${esc(url)}" target="_blank" rel="noopener" class="block truncate underline underline-offset-2">${esc(url.replace(/^https?:\/\//, ''))}</a>
    ${item.site ? '' : `<span class="text-xs text-muted-foreground">fornecedor padrão de ${esc(item.categoria)}</span>`}`
}

function telaCompras() {
  const naFila = []
  for (const s of SOLICITACOES) {
    if (!['aguardando_compra', 'comprado'].includes(s.status)) continue
    for (const i of s.itens)
      naFila.push({
        ...i,
        codigo: s.codigo,
        data: s.data,
        consultor: s.consultor,
        cliente: s.cliente,
        status: s.status,
      })
  }
  const total = naFila.reduce((acc, i) => acc + i.valorUnitario * i.quantidade, 0)

  const linhas = naFila
    .map(
      (i) => `
    <tr class="border-b last:border-0 hover:bg-muted/40">
      <td class="whitespace-nowrap p-3">${esc(i.data)}</td>
      <td class="whitespace-nowrap p-3 font-medium">${esc(i.codigo)}</td>
      <td class="p-3">
        ${esc(i.produto)}
        <div class="text-xs text-muted-foreground">${esc(i.consultor)} · para ${esc(i.cliente)}</div>
      </td>
      <td class="max-w-xs p-3">${site(i)}</td>
      <td class="p-3 text-right">${i.quantidade}</td>
      <td class="whitespace-nowrap p-3 text-right">${brl(i.valorUnitario * i.quantidade)}</td>
      <td class="p-3">${selo(i.status)}</td>
    </tr>`,
    )
    .join('')

  return `
    ${cabecalho('Fila de compras', 'Itens das solicitações enviadas para compra, em ordem de chegada.')}
    <div class="mb-6 grid gap-4 sm:grid-cols-3">
      ${cartao('Valor total da fila', brl(total), `${naFila.length} ${naFila.length === 1 ? 'item' : 'itens'} no total.`, true)}
      ${cartao('Aguardando compra', String(naFila.filter((i) => i.status === 'aguardando_compra').length), 'Ainda não comprados.')}
      ${cartao('Já comprados', String(naFila.filter((i) => i.status === 'comprado').length), 'Seguem visíveis até saírem para envio.')}
    </div>
    <div class="overflow-hidden rounded-lg border bg-card shadow-[0_1px_2px_rgba(11,41,5,0.04)]">
      <table class="w-full text-sm">
        <thead class="border-b bg-muted/40 text-left text-muted-foreground">
          <tr>
            <th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Data</th><th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Código</th>
            <th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Produto</th><th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Site</th>
            <th class="font-ui h-11 px-4 text-right text-xs font-semibold uppercase tracking-[0.08em]">Qtd.</th><th class="font-ui h-11 px-4 text-right text-xs font-semibold uppercase tracking-[0.08em]">Valor</th>
            <th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Status</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>
    <p class="mt-4 text-xs text-muted-foreground">
      Data, produto, valor e site, os campos que a área pediu. A lista é por item, e não por
      solicitação, porque a compra acontece item a item. O Financeiro também altera o status.
    </p>`
}

/**
 * Fila da expedição: a planilha que a área monta à mão hoje.
 *
 * Espelha `src/app/expedicao/page.tsx`: uma solicitação chega aqui pelo caminho
 * normal (depois da compra) ou pelo atalho (tudo em estoque, sem passar pelo
 * Financeiro). Por isso cada item diz de onde vem.
 */
function telaExpedicao() {
  const fila = SOLICITACOES.filter((s) => s.status === 'organizando_envio')
  const pecas = fila.reduce((acc, s) => acc + s.itens.reduce((n, i) => n + i.quantidade, 0), 0)
  const doEstoque = fila.reduce(
    (acc, s) => acc + s.itens.filter((i) => i.emEstoque).reduce((n, i) => n + i.quantidade, 0),
    0,
  )

  const cartoes = fila
    .map(
      (s) => `
    <div class="rounded-lg border bg-card shadow-[0_1px_2px_rgba(11,41,5,0.04)]">
      <div class="flex flex-wrap items-start justify-between gap-3 border-b p-5">
        <div>
          <p class="font-display text-base font-semibold">${esc(s.codigo)}</p>
          <p class="mt-1 text-sm text-muted-foreground">${esc(s.data)} · ${esc(s.consultor)} · ${esc(s.motivo)}</p>
        </div>
        ${selo(s.status)}
      </div>
      <div class="grid gap-6 p-5 md:grid-cols-2">
        <div>
          <p class="font-ui mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Separar</p>
          <ul class="space-y-1.5 text-sm">
            ${s.itens
              .map(
                (i) => `
              <li class="flex items-baseline justify-between gap-3">
                <span>${i.quantidade}× ${esc(i.produto)}</span>
                <span class="rounded-full px-2 py-0.5 text-xs ${
                  i.emEstoque ? 'bg-muted text-muted-foreground' : 'border text-muted-foreground'
                }">${i.emEstoque ? 'estoque' : 'compra'}</span>
              </li>`,
              )
              .join('')}
          </ul>
          <p class="mt-3 border-t pt-3 text-xs text-muted-foreground">
            Valor da solicitação: ${brl(totalDaSolicitacao(s))}
          </p>
        </div>
        <div>
          <p class="font-ui mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Enviar para</p>
          <address class="text-sm not-italic leading-relaxed">
            <span class="font-medium">${esc(s.destinatario)}</span><br />
            ${esc(s.entrega)}
            ${s.telefone ? `<br />${esc(s.telefone)}` : ''}
          </address>
        </div>
      </div>
    </div>`,
    )
    .join('')

  return `
    ${cabecalho(
      'Pedidos para separar',
      'Tudo o que a expedição precisa para embalar e postar, em ordem de chegada. A carta continua sendo escrita fora daqui.',
      null,
      '<span class="rounded-[5px] border px-5 py-2 font-ui text-sm font-semibold uppercase">Baixar CSV</span><span class="rounded-[5px] border px-5 py-2 font-ui text-sm font-semibold uppercase">Baixar planilha</span>',
    )}
    <div class="mb-8 grid gap-4 sm:grid-cols-3">
      ${cartao('Peças a separar', String(pecas), `Em ${fila.length} ${fila.length === 1 ? 'pedido' : 'pedidos'}.`, true)}
      ${cartao('Direto do estoque', String(doEstoque), 'Não passaram pelo Financeiro.')}
      ${cartao('Compradas', String(pecas - doEstoque), 'Chegaram por uma compra do Financeiro.')}
    </div>
    ${cartoes || estadoVazio('Nada para separar agora', 'Os pedidos aparecem quando o Admin move a solicitação para organizando envio.')}
    <p class="mt-6 text-xs text-muted-foreground">
      Substitui a planilha montada à mão. Duas portas trazem uma solicitação até aqui: o caminho
      normal, depois que o Financeiro compra, e o atalho, itens já em estoque vão da aprovação
      direto para a expedição.
    </p>`
}

/** Clientes: cadastro manual e importação por CSV. */
function telaClientes() {
  const porCliente = new Map()
  for (const s of SOLICITACOES) {
    porCliente.set(s.cliente, {
      nome: s.cliente,
      cpf: s.cpf,
      telefone: s.telefone || null,
      total: (porCliente.get(s.cliente)?.total ?? 0) + 1,
    })
  }

  const linhas = [...porCliente.values()]
    .map(
      (c) => `
    <tr class="border-b last:border-0 hover:bg-muted/40">
      <td class="p-3 font-medium">${esc(c.nome)}</td>
      <td class="p-3 text-muted-foreground">${esc(c.cpf)}</td>
      <td class="p-3 text-muted-foreground">${esc(c.telefone || '-')}</td>
      <td class="p-3 text-right">${c.total}</td>
      <td class="p-3 text-right"><span class="text-xs text-muted-foreground">Editar</span></td>
    </tr>`,
    )
    .join('')

  return `
    ${cabecalho(
      'Clientes',
      'Cadastro manual ou importação por CSV. O CPF é a chave que evita duplicatas.',
      null,
      '<span class="rounded-[5px] border px-5 py-2 font-ui text-sm font-semibold uppercase">Importar CSV</span><span class="rounded-[5px] border border-primary bg-primary px-5 py-2 font-ui text-sm font-semibold uppercase text-primary-foreground">Novo cliente</span>',
    )}
    <div class="overflow-hidden rounded-lg border bg-card">
      <table class="w-full text-sm">
        <thead class="border-b bg-muted/40 text-left text-muted-foreground">
          <tr>
            <th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Nome</th>
            <th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">CPF</th>
            <th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Telefone</th>
            <th class="font-ui h-11 px-4 text-right text-xs font-semibold uppercase tracking-[0.08em]">Solicitações</th>
            <th class="font-ui h-11 px-4 text-right text-xs font-semibold uppercase tracking-[0.08em]">Ações</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>
    <p class="mt-4 text-xs text-muted-foreground">
      Na importação, linha com CPF que já existe atualiza o cadastro em vez de criar outro, e as
      linhas inválidas voltam numeradas com o motivo, sem derrubar o arquivo inteiro. Os CPFs desta
      vitrine são fictícios e aparecem mascarados.
    </p>`
}

function telaProdutos() {
  const linhas = PRODUTOS.map(
    (p) => `
    <tr class="border-b last:border-0 ${p.ativo ? '' : 'text-muted-foreground'}">
      <td class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">${esc(p.nome)}</td>
      <td class="p-3">${esc(p.categoria)}</td>
      <td class="whitespace-nowrap p-3 text-right">${preco(p)}</td>
      <td class="p-3">
        <span class="rounded-full px-2 py-0.5 text-xs ${p.origem === 'estoque_interno' ? 'bg-muted text-muted-foreground' : 'border'}">
          ${p.origem === 'estoque_interno' ? 'estoque' : 'sob pedido'}
        </span>
      </td>
      <td class="p-3">
        <span class="rounded-md border px-2 py-0.5 text-xs">${p.ativo ? 'ativo' : 'desativado'}</span>
      </td>
      <td class="p-3 text-right text-xs text-muted-foreground">
        Editar · ${p.ativo ? 'Desativar' : 'Reativar'}
      </td>
    </tr>`,
  ).join('')

  return `
    ${cabecalho(
      'Gerenciar catálogo',
      'Cadastro, edição e ativação de produtos, feitos pela própria área.',
      null,
      '<span class="rounded-[5px] border px-5 py-2 font-ui text-sm font-semibold uppercase">Categorias</span><span class="rounded-[5px] border border-primary bg-primary px-5 py-2 font-ui text-sm font-semibold uppercase text-primary-foreground">Novo produto</span>',
    )}
    <div class="overflow-hidden rounded-lg border bg-card">
      <table class="w-full text-sm">
        <thead class="border-b bg-muted/40 text-left text-muted-foreground">
          <tr><th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Produto</th><th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Categoria</th>
          <th class="font-ui h-11 px-4 text-right text-xs font-semibold uppercase tracking-[0.08em]">Valor</th><th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">De onde sai</th>
          <th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Situação</th>
          <th class="font-ui h-11 px-4 text-right text-xs font-semibold uppercase tracking-[0.08em]">Ações</th></tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>
    <p class="mt-4 text-xs text-muted-foreground">
      Produto nunca é excluído: a ação é desativar. O desativado some do catálogo do consultor e
      permanece nas solicitações antigas, que precisam continuar legíveis como foram criadas.
    </p>`
}

function telaUsuarios() {
  const linhas = CONSULTORES.map(
    (u) => `
    <tr class="border-b last:border-0">
      <td class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">${esc(u.nome)}</td>
      <td class="p-3"><span class="rounded-md bg-muted px-2 py-0.5 text-xs">${esc(u.perfil)}</span></td>
      <td class="whitespace-nowrap p-3 text-right">${u.limite ? brl(u.limite) : '-'}</td>
      <td class="p-3 text-right text-xs text-muted-foreground">Editar</td>
    </tr>`,
  ).join('')

  return `
    ${cabecalho('Usuários', 'Perfil e limite mensal são geridos aqui, dentro da ferramenta, sem passar por TI.')}
    <p class="mb-6 text-sm text-muted-foreground">
      Usuários não são criados aqui: entram sozinhos no primeiro login pelo SSO, como consultor.
      Esta tela promove, define o teto mensal e desativa quem saiu do time.
    </p>
    <div class="overflow-hidden rounded-lg border bg-card">
      <table class="w-full text-sm">
        <thead class="border-b bg-muted/40 text-left text-muted-foreground">
          <tr><th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Nome</th><th class="font-ui h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em]">Perfil</th>
          <th class="font-ui h-11 px-4 text-right text-xs font-semibold uppercase tracking-[0.08em]">Limite mensal</th>
          <th class="font-ui h-11 px-4 text-right text-xs font-semibold uppercase tracking-[0.08em]">Ações</th></tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>`
}

/**
 * Dashboard Logístico. Espelha `src/app/logistica/page.tsx` com os dados
 * congelados de `LOGISTICA`: status em destaque, números, volume por
 * departamento, evolução e a trilha cadastrada pela Logística, com a esteira
 * prioritária dentro, os recorrentes e os presentes que entram sozinhos.
 * As observações só aparecem para Logística e Admin, como na matriz.
 */
const SITUACAO = {
  normal: ['Operação normal', 'bg-success', 'bg-success/8', 'text-success'],
  alto_volume: ['Alto volume', 'bg-info', 'bg-info/8', 'text-info'],
  risco_de_atraso: ['Risco de atraso', 'bg-warning', 'bg-warning/10', 'text-warning'],
  critica: ['Operação crítica', 'bg-error', 'bg-error/8', 'text-error'],
}

const FASE = {
  recebido: ['Recebido', 'bg-muted text-muted-foreground'],
  em_analise: ['Em análise', 'bg-muted text-muted-foreground'],
  aguardando_documentacao: ['Aguardando documentação', 'bg-warning text-warning-foreground'],
  aguardando_suprimentos: ['Aguardando suprimentos', 'bg-warning text-warning-foreground'],
  em_execucao: ['Em execução', 'bg-info text-info-foreground'],
  revisao: ['Revisão', 'bg-info text-info-foreground'],
  finalizacao: ['Finalização', 'bg-info text-info-foreground'],
  concluido: ['Concluído', 'bg-success text-success-foreground'],
}

/** Dica no hover e no foco; no celular, fixa no pé da tela. */
function dica(gatilho, texto) {
  return `
    <span class="group relative inline-flex">
      <button type="button" class="inline-flex items-center text-muted-foreground hover:text-foreground">${gatilho}</button>
      <span role="tooltip" class="pointer-events-none fixed inset-x-4 bottom-4 z-30 translate-y-1 whitespace-pre-wrap rounded-lg border bg-popover p-3 text-left text-xs leading-relaxed opacity-0 shadow-lg transition-[opacity,transform] duration-150 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 sm:absolute sm:inset-x-auto sm:bottom-full sm:left-1/2 sm:mb-2 sm:w-72 sm:-translate-x-1/2">${esc(texto)}</span>
    </span>`
}

function botaoFalso(texto, ativo) {
  return `<span class="rounded-[5px] px-3 py-2 font-sora text-xs font-semibold uppercase ${
    ativo ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground'
  }">${texto}</span>`
}

function previsaoDaDemanda(d) {
  if (d.fase === 'concluido') {
    return `<p class="text-sm text-muted-foreground md:text-right">Concluída em ${d.concluida}</p>`
  }
  if (d.atrasada) {
    return `<p class="text-sm font-medium text-error md:text-right">Atrasada desde ${d.atrasada}</p>`
  }
  if (d.previsao) {
    const inicio = d.inicio
      ? `<span class="block text-xs text-muted-foreground">Começa ${d.inicio}</span>`
      : ''
    return `<p class="text-sm md:text-right">${inicio}<span class="text-muted-foreground">Previsão </span>${d.previsao}</p>`
  }
  return '<p class="text-sm font-medium md:text-right"><span class="text-warning">●</span> Sem previsão</p>'
}

function telaLogistica() {
  const L = LOGISTICA
  const [rotuloSituacao, faixa, fundo, corIcone] = SITUACAO[L.status.situacao]
  const doTime = perfil === 'logistica' || perfil === 'admin'
  const dif = L.volume.total - L.volume.anterior
  const maiorDep = Math.max(...L.porDepartamento.flatMap((g) => g.linhas.map((l) => l[1])))
  const marcas = [0, 10, 20, 30, 40]
  const teto = 40
  const n = L.evolucao.length
  const x = (i) => (i / (n - 1)) * 100
  const y = (v) => 100 - (v / teto) * 100
  const linha = L.evolucao.map(([, v], i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')

  const departamentos = L.porDepartamento
    .map((g) => {
      const total = g.linhas.reduce((s, l) => s + l[1], 0)
      const linhas = g.linhas
        .map(
          ([dep, q]) => `
          <li class="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(6rem,11rem)_1fr_auto]">
            <span class="col-span-2 truncate sm:col-span-1">${esc(dep)}</span>
            <span class="relative h-3"><span class="absolute inset-y-0 left-0 rounded-r-[4px] bg-serie" style="width:${(q / maiorDep) * 100}%"></span></span>
            <span class="text-right tabular-nums"><span class="font-semibold">${q}</span><span class="ml-2 inline-block w-14 text-muted-foreground">${((q / L.volume.total) * 100).toFixed(1).replace('.', ',')}%</span></span>
          </li>`,
        )
        .join('')
      return `
      <div>
        <p class="font-ui mb-2 flex justify-between gap-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"><span>${esc(g.subsidiaria)}</span><span>${total}</span></p>
        <ul class="space-y-2.5">${linhas}</ul>
      </div>`
    })
    .join('')

  const trilha = L.trilha
    .map((d) => {
      const prioritaria = d.prioridade && d.fase !== 'concluido'
      const enviado =
        d.itens.length > 1
          ? dica(
              `<span class="text-foreground underline decoration-dotted underline-offset-4">Kit · ${d.itens.length} itens</span>`,
              d.itens.join('\n'),
            )
          : esc(d.itens[0])
      return `
      <li class="relative grid gap-x-6 gap-y-2 border-b px-5 py-3.5 last:border-0 md:grid-cols-[1fr_auto_13rem] md:items-center ${prioritaria ? 'bg-warning/5' : ''} ${d.fase === 'concluido' ? 'text-muted-foreground' : ''}">
        ${prioritaria ? '<span class="absolute inset-y-0 left-0 w-1 bg-warning"></span>' : ''}
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            ${prioritaria ? `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${d.prioridade === 'Urgente' ? 'bg-error text-error-foreground' : 'bg-warning text-warning-foreground'}">${d.prioridade}</span>` : ''}
            ${d.presente ? '<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">🎁 Presente</span>' : ''}
            ${d.recorrente ? `<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">↻ ${d.recorrente}</span>` : ''}
            <span class="font-medium">${esc(d.titulo)}</span>
            ${doTime && d.obs ? dica('ⓘ', d.obs) : ''}
          </div>
          <p class="mt-1 text-sm text-muted-foreground"><span class="text-foreground">${enviado}</span> · ${esc(d.contexto)}</p>
        </div>
        <div><span class="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${FASE[d.fase][1]}">${FASE[d.fase][0]}</span></div>
        ${previsaoDaDemanda(d)}
      </li>`
    })
    .join('')

  const grafico = `
    <div class="relative h-[220px]">
      ${marcas.map((v) => `<span class="absolute left-0 w-7 -translate-y-1/2 text-right text-xs text-muted-foreground" style="top:calc(8px + (100% - 36px) * ${y(v) / 100})">${v}</span>`).join('')}
      <div class="absolute bottom-7 left-10 right-3 top-2">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          ${marcas.map((v) => `<line x1="0" x2="100" y1="${y(v)}" y2="${y(v)}" class="stroke-border" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('')}
          <path d="${linha} L100,100 L0,100 Z" class="fill-serie" fill-opacity="0.1"/>
          <path d="${linha}" fill="none" class="stroke-serie" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
        </svg>
        ${L.evolucao.map(([r, v], i) => `<span title="Semana ${r}: ${v} pedidos" class="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-serie ring-2 ring-card" style="left:${x(i)}%;top:${y(v)}%"></span>`).join('')}
        <span class="absolute -translate-x-full -translate-y-[160%] pr-1 text-sm font-semibold" style="left:100%;top:${y(L.evolucao[n - 1][1])}%">${L.evolucao[n - 1][1]}</span>
      </div>
      <div class="absolute bottom-0 left-10 right-3 h-5">
        ${L.evolucao.map(([r], i) => `<span class="absolute -translate-x-1/2 whitespace-nowrap text-xs text-muted-foreground ${(n - 1 - i) % 2 ? 'max-sm:hidden' : ''}" style="left:${x(i)}%">${r}</span>`).join('')}
      </div>
    </div>`

  return `
    ${cabecalho(
      'Dashboard Logístico',
      'Status da operação, volume e custo dos envios e a trilha de demandas do período.',
      null,
    )}

    <div class="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg border bg-card p-3">
      <div class="flex flex-wrap gap-1">${botaoFalso('Semanal', true)}${botaoFalso('Mensal')}${botaoFalso('Anual')}${botaoFalso('Personalizado')}</div>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div class="leading-tight sm:text-right"><p class="font-display text-base font-semibold">Semana ${L.semana}</p><p class="text-xs text-muted-foreground">${L.dias}</p></div>
        <div class="flex rounded-md bg-muted p-0.5">${botaoFalso('‹ Anterior')}${botaoFalso('Semana atual')}${botaoFalso('Próxima ›')}</div>
      </div>
    </div>

    <section class="relative mb-6 overflow-hidden rounded-lg border bg-card">
      <span class="absolute inset-y-0 left-0 w-1.5 ${faixa}"></span>
      <div class="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 py-5 pl-7 pr-5 ${fundo}">
        <div class="flex items-center gap-4">
          <span class="text-4xl ${corIcone}" aria-hidden="true">⚠</span>
          <div>
            <p class="font-ui text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Status da operação · semana atual ${L.semana}</p>
            <h2 class="font-display mt-1 text-3xl font-semibold tracking-tight">${rotuloSituacao}</h2>
            <p class="mt-1 text-sm text-muted-foreground">${esc(L.status.motivo)}</p>
          </div>
        </div>
        <div class="flex flex-col items-start gap-2 text-sm sm:items-end">
          <p class="text-muted-foreground">Sugerido pelos números da semana</p>
          ${doTime ? '<span class="rounded-[5px] border bg-background px-3 py-2 font-sora text-xs font-semibold uppercase">Definir manualmente</span>' : ''}
        </div>
      </div>
    </section>

    <div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      ${cartao('Pedidos no período', String(L.volume.total), `+${dif} (+${Math.round((dif / L.volume.anterior) * 100)}%) em relação à semana anterior.<br />${L.recorrentes} recorrentes · ${L.pontuais} pontuais`, true)}
      ${cartao('Em andamento', '5', '1 atrasada · 1 sem previsão')}
      ${cartao('Custo dos envios', L.custo.total, `${L.custo.semCusto} pedidos sem custo informado.`)}
    </div>

    <div class="mb-6 grid gap-6 lg:grid-cols-2">
      <section class="rounded-lg border bg-card p-5">
        <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="font-display text-lg font-semibold">Volume de Pedidos por Departamento</h2>
            <p class="mt-0.5 text-sm text-muted-foreground">${L.volume.total} pedidos no período, por subsidiária e departamento.</p>
          </div>
          <div class="flex rounded-md bg-muted p-0.5">${botaoFalso('Quantidade', true)}${botaoFalso('Custo')}</div>
        </div>
        <div class="space-y-5">${departamentos}</div>
      </section>
      <section class="rounded-lg border bg-card p-5">
        <h2 class="font-display text-lg font-semibold">Evolução do volume</h2>
        <p class="mb-4 mt-0.5 text-sm text-muted-foreground">Pedidos por semana, nas oito semanas até a selecionada.</p>
        ${grafico}
      </section>
    </div>


    <section class="mb-6 rounded-lg border bg-card">
      <div class="flex flex-wrap items-start justify-between gap-3 px-5 pb-4 pt-5">
        <div>
          <h2 class="font-display text-lg font-semibold">Trilha de demandas</h2>
          <p class="mt-0.5 text-sm text-muted-foreground">${L.trilha.length} demandas em andamento no período · 2 prioritárias · 1 atrasada</p>
        </div>
        <div class="flex flex-wrap gap-2">${doTime ? '<span class="rounded-[5px] border border-primary bg-primary px-3 py-2 font-sora text-xs font-semibold uppercase text-primary-foreground">+ Nova demanda</span>' : ''}${botaoFalso('Exportar CSV')}${botaoFalso('Exportar planilha')}</div>
      </div>
      <ul class="border-t">${trilha}</ul>
    </section>

    <div class="grid gap-6 md:grid-cols-3">
      <div class="rounded-lg border bg-card p-5"><p class="font-display text-lg font-semibold">Produtos em estoque →</p><p class="mt-1 text-sm text-muted-foreground">Os presentes que a AUVP tem fisicamente, no catálogo.</p></div>
      <div class="rounded-lg border bg-card p-5"><p class="font-display text-lg font-semibold">Equipe de Logística →</p><p class="mt-1 text-sm text-muted-foreground">${esc(L.equipe)}</p></div>
      <div class="rounded-lg border bg-card p-5"><p class="font-display text-lg font-semibold">Perguntas frequentes →</p><p class="mt-1 text-sm text-muted-foreground">Em elaboração pela equipe de Logística.</p></div>
    </div>`
}

const RENDER = {
  catalogo: telaCatalogo,
  nova: telaNova,
  minhas: telaMinhas,
  gestao: telaGestao,
  detalhe: telaDetalhe,
  compras: telaCompras,
  expedicao: telaExpedicao,
  logistica: telaLogistica,
  produtos: telaProdutos,
  clientes: telaClientes,
  usuarios: telaUsuarios,
}

// --- montagem ---------------------------------------------------------------

function render() {
  const permitidas = PERMISSOES[perfil]
  if (!permitidas.includes(tela)) tela = permitidas[0]

  const visiveis = TELAS.filter((t) => permitidas.includes(t.id))
  const principais = visiveis.filter((t) => !SOB_ADMINISTRACAO.includes(t.id))
  const administracao = visiveis.filter((t) => SOB_ADMINISTRACAO.includes(t.id))
  const adminAtivo = administracao.some((t) => t.id === tela)

  const balao = (t, ativo) => `
    <div class="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-56 -translate-x-1/2 -translate-y-[5px] opacity-0 transition-[opacity,transform] duration-200 ease-apple group-hover/item:translate-y-0 group-hover/item:opacity-100">
      <div class="bg-popover relative rounded-xl border p-3 shadow-lg">
        <div class="bg-popover absolute -top-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 rounded-sm border-l border-t"></div>
        <div class="flex items-start gap-3">
          <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
            ativo ? 'bg-foreground text-background border-foreground' : 'bg-card text-foreground'
          }">${iconeSvg('tela:' + t.id, 'h-4 w-4')}</span>
          <div class="min-w-0">
            <p class="font-display text-foreground text-sm font-medium leading-tight">${esc(t.rotulo)}</p>
            <p class="text-muted-foreground font-roboto mt-0.5 text-xs leading-snug">${esc(t.descricao)}</p>
          </div>
        </div>
      </div>
    </div>`

  const itemPrincipal = (t) => {
    const ativo = t.id === tela
    return `
      <div class="group/item relative">
        <button data-tela="${t.id}" aria-current="${ativo ? 'page' : 'false'}"
          class="font-display relative whitespace-nowrap rounded-lg px-3 py-2 text-sm font-normal transition-colors duration-200 ${
            ativo ? 'text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }">
          ${esc(t.rotulo)}
          ${ativo ? '<span class="bg-foreground/30 absolute bottom-1 left-3 right-3 h-px rounded-full"></span>' : ''}
        </button>
        ${balao(t, ativo)}
      </div>`
  }

  // O submenu usa <details> nativo: abre no clique, fecha no Esc e funciona
  // pelo teclado sem nenhuma linha de JavaScript.
  const grupoAdmin = administracao.length
    ? `
      <details class="group/admin relative">
        <summary class="font-display relative flex cursor-pointer list-none items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-normal transition-colors duration-200 ${
          adminAtivo
            ? 'text-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }">
          ${iconeSvg('tela:administracao', 'h-4 w-4')}
          Administração
          <span class="transition-transform duration-200 group-open/admin:rotate-180">▾</span>
          ${adminAtivo ? '<span class="bg-foreground/30 absolute bottom-1 left-3 right-3 h-px rounded-full"></span>' : ''}
        </summary>
        <div class="bg-popover absolute left-0 top-full z-50 mt-1.5 w-72 rounded-xl border p-1.5 shadow-lg">
          ${administracao
            .map((t) => {
              const ativo = t.id === tela
              return `
              <button data-tela="${t.id}" class="flex w-full items-start gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-muted">
                <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                  ativo
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-card text-foreground'
                }">${iconeSvg('tela:' + t.id, 'h-4 w-4')}</span>
                <span class="min-w-0 flex-1">
                  <span class="font-display text-foreground block text-sm font-bold leading-tight">${esc(t.rotulo)}</span>
                  <span class="text-muted-foreground font-roboto mt-0.5 block text-xs leading-snug">${esc(t.descricao)}</span>
                </span>
                ${ativo ? '<span class="bg-background font-roboto mt-1 shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">Atual</span>' : ''}
              </button>`
            })
            .join('')}
        </div>
      </details>`
    : ''

  // As abas só mudam quando muda a tela ativa ou o perfil que as filtra.
  // Redesenhá-las a cada tecla digitada trocaria a barra inteira por uma
  // cópia idêntica, e o navegador pisca o que ele acabou de substituir.
  const trocouDeTela = tela !== telaDesenhada || perfil !== perfilDesenhado
  if (trocouDeTela) {
    document.getElementById('abas').innerHTML = principais.map(itemPrincipal).join('') + grupoAdmin
  }

  // A animação de entrada é da troca de tela, e só dela. Recriar o elemento
  // com a classe é o que faz o navegador rodar a animação de novo, então numa
  // atualização da mesma tela ele é recriado sem ela: escolher uma categoria,
  // adicionar um item ou digitar uma letra não reabre a página do zero.
  // Só opacity e transform, que não participam do cálculo de layout.
  const conteudo = document.getElementById('conteudo')
  conteudo.innerHTML = trocouDeTela
    ? `<div class="animar-entrada">${RENDER[tela]()}</div>`
    : `<div>${RENDER[tela]()}</div>`

  telaDesenhada = tela
  perfilDesenhado = perfil
}

/**
 * Cliques do fluxo de nova solicitação.
 *
 * Vem antes do resto porque o protótipo tem os próprios botões de categoria e
 * de navegação, que não devem cair nos handlers das telas de retrato.
 */
function cliqueDaNova(e) {
  const ir = e.target.closest('[data-nova-ir]')
  if (ir) {
    novaEtapa = Number(ir.dataset.novaIr)
    novaMaiorEtapa = Math.max(novaMaiorEtapa, novaEtapa)
    novaConferir = false
    render()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return true
  }

  if (e.target.closest('[data-nova-continuar]')) {
    // Etapa incompleta não avança, mas responde: o clique acende o que falta.
    if (Object.keys(novaProblemas(novaEtapa)).length > 0) {
      novaConferir = true
    } else {
      novaEtapa = Math.min(4, novaEtapa + 1)
      novaMaiorEtapa = Math.max(novaMaiorEtapa, novaEtapa)
      novaConferir = false
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    render()
    return true
  }

  if (e.target.closest('[data-nova-buscar]')) {
    novaCliente = novaCpf.replace(/\D/g, '').length === 11 ? NOVA_CLIENTE_EXEMPLO : null
    novaConferir = !novaCliente
    if (novaCliente && !novaEntrega.destinatario) novaEntrega.destinatario = novaCliente.nome
    render()
    return true
  }

  if (e.target.closest('[data-nova-trocar]')) {
    novaCliente = null
    novaCpf = ''
    render()
    return true
  }

  const add = e.target.closest('[data-nova-add]')
  if (add) {
    const slug = add.dataset.novaAdd
    const existente = novaItens.find((i) => i.slug === slug)
    if (existente) existente.quantidade++
    else novaItens.push({ slug, quantidade: 1 })
    novaConferir = false
    render()
    return true
  }

  const remove = e.target.closest('[data-nova-remove]')
  if (remove) {
    novaItens = novaItens.filter((i) => i.slug !== remove.dataset.novaRemove)
    render()
    return true
  }

  const acomp = e.target.closest('[data-nova-acomp]')
  if (acomp) {
    novaAcompanhamento = acomp.dataset.novaAcomp
    novaBusca = ''
    novaCategoria = ''
    novaEtapa = 1
    render()
    return true
  }

  if (e.target.closest('[data-nova-limpar-acomp]')) {
    novaAcompanhamento = null
    render()
    return true
  }

  const cat = e.target.closest('[data-nova-cat]')
  if (cat) {
    novaCategoria = cat.dataset.novaCat
    render()
    return true
  }

  const modelo = e.target.closest('[data-nova-modelo]')
  if (modelo) {
    const nome = novaPrimeiroNome(novaEntrega.destinatario || novaCliente?.nome || '')
    const texto = MODELOS_DEMO[novaCarta.motivo][Number(modelo.dataset.novaModelo)]
    novaCarta.mensagem = nome
      ? texto.replaceAll('{nome}', nome)
      : texto.replace(/^[^{]*\{nome\}[,!.\s]*/u, '').trim()
    novaConferir = false
    render()
    return true
  }

  if (e.target.closest('[data-nova-cep]')) {
    // Sem servidor: o CEP de exemplo preenche o endereço, como o ViaCEP faria.
    novaEntrega = {
      ...novaEntrega,
      cep: novaEntrega.cep || '01310-100',
      logradouro: 'Avenida Paulista',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      uf: 'SP',
    }
    render()
    document.getElementById('numero')?.focus()
    return true
  }

  if (e.target.closest('[data-nova-enviar]')) {
    // Fim do caminho: a vitrine mostra o que a ferramenta faria, e volta ao
    // começo para a próxima pessoa percorrer.
    detalheSelecionado = 'SOL-2026-0001'
    tela = 'detalhe'
    novaEtapa = 0
    novaMaiorEtapa = 0
    novaCliente = null
    novaCpf = ''
    novaItens = []
    novaCarta = { motivo: 'Aniversário', motivoOutro: '', mensagem: '' }
    novaEntrega = {
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      uf: '',
      destinatario: '',
    }
    render()
    return true
  }

  return false
}

document.addEventListener('click', (e) => {
  if (tela === 'nova' && cliqueDaNova(e)) return

  const cat = e.target.closest('[data-categoria]')
  if (cat) {
    filtroCategoria = cat.dataset.categoria
    render()
    return
  }

  const aba = e.target.closest('[data-tela]')
  if (aba) {
    tela = aba.dataset.tela
    // Fecha o submenu antes de redesenhar, senão ele reabre já aberto.
    document.querySelectorAll('details[open]').forEach((d) => d.removeAttribute('open'))
    render()
    return
  }

  const detalhe = e.target.closest('[data-detalhe]')
  if (detalhe) {
    detalheSelecionado = detalhe.dataset.detalhe
    tela = 'detalhe'
    render()
  }
})

document.addEventListener('change', (e) => {
  if (e.target.dataset.novaUf !== undefined) {
    novaEntrega.uf = e.target.value
    render()
    return
  }
  if (e.target.dataset.novaMotivo !== undefined) {
    novaCarta.motivo = e.target.value
    render()
    return
  }
  if (e.target.id === 'perfil') {
    perfil = e.target.value
    render()
  }
  if (e.target.id === 'trocaDetalhe') {
    detalheSelecionado = e.target.value
    render()
  }
})

/** Onde cada campo do protótipo guarda o que foi digitado. */
const CAMPOS_DA_NOVA = {
  'nova-cpf': (v) => (novaCpf = v),
  'nova-busca': (v) => (novaBusca = v),
  'nova-mensagem': (v) => (novaCarta.mensagem = v),
  motivoOutro: (v) => (novaCarta.motivoOutro = v),
  logradouro: (v) => (novaEntrega.logradouro = v),
  numero: (v) => (novaEntrega.numero = v),
  complemento: (v) => (novaEntrega.complemento = v),
  bairro: (v) => (novaEntrega.bairro = v),
  cidade: (v) => (novaEntrega.cidade = v),
  destinatario: (v) => (novaEntrega.destinatario = v),
  'nova-cep': (v) => (novaEntrega.cep = v),
}

document.addEventListener('input', (e) => {
  const campo = e.target.dataset.novaCampo
  if (campo && CAMPOS_DA_NOVA[campo]) {
    CAMPOS_DA_NOVA[campo](e.target.value)
    const posicao = e.target.selectionStart
    render()
    // Reidratar custa o foco e o cursor; devolver os dois mantém a digitação.
    const voltou = document.getElementById(campo)
    if (voltou) {
      voltou.focus()
      if (voltou.setSelectionRange) voltou.setSelectionRange(posicao, posicao)
    }
    return
  }

  if (e.target.id === 'busca') {
    busca = e.target.value
    render()
    // Reidratar o campo custa o foco e a posição do cursor; devolver os dois
    // mantém a digitação contínua.
    const campo = document.getElementById('busca')
    campo.focus()
    campo.setSelectionRange(campo.value.length, campo.value.length)
  }
})

render()
