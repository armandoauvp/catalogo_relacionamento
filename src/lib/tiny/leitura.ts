/**
 * Leitura das respostas da API v2 do Tiny, sem rede: o que chega de lá vira
 * os tipos desta ferramenta aqui, e só aqui. As funções são puras para serem
 * testadas com o JSON da documentação.
 */

type Bruto = Record<string, unknown>

/**
 * O Tiny devolve listas como `[{registro: {...}}]` e, às vezes, como um objeto
 * só. Aqui vira sempre um array dos objetos de dentro.
 */
export function listaDe(valor: unknown, chave: string): Bruto[] {
  if (!valor) return []
  const itens = Array.isArray(valor) ? valor : [valor]
  return itens
    .map((item) => (item && typeof item === 'object' && chave in item ? item[chave] : item))
    .filter((item): item is Bruto => Boolean(item) && typeof item === 'object')
}

export const texto = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim())
const ouNulo = (v: unknown) => texto(v) || null

/** "35,00" e "35.00" viram "35.00"; vazio vira "0". */
export function decimalDoTiny(v: unknown): string {
  const t = texto(v)
  if (!t) return '0'
  // Com vírgula, o ponto é separador de milhar ("1.234,56").
  return t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
}

// ---------------------------------------------------------------------------
// Situação do pedido
// ---------------------------------------------------------------------------

/**
 * A busca e o detalhe devolvem a situação como a tela do Tiny escreve ("Em
 * aberto", "Preparando envio", "Atendido"), e a alteração recebe o código
 * (`preparando_envio`). O ciclo daqui compara códigos, então tudo que chega
 * passa por esta tradução.
 */
const SITUACAO_POR_TEXTO: Record<string, string> = {
  aberto: 'aberto',
  em_aberto: 'aberto',
  aprovado: 'aprovado',
  preparando_envio: 'preparando_envio',
  faturado: 'faturado',
  atendido: 'faturado',
  faturado_atendido: 'faturado',
  pronto_envio: 'pronto_envio',
  pronto_para_envio: 'pronto_envio',
  enviado: 'enviado',
  entregue: 'entregue',
  nao_entregue: 'nao_entregue',
  cancelado: 'cancelado',
}

export function codigoDaSituacao(valor: unknown): string {
  const chave = texto(valor)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '_')
    .replace(/^_|_$/g, '')
  return SITUACAO_POR_TEXTO[chave] ?? chave
}

/** As situações que a busca aceita, na ordem em que o pedido anda. */
export const SITUACOES_DE_PEDIDO = [
  'aberto',
  'aprovado',
  'preparando_envio',
  'faturado',
  'pronto_envio',
  'enviado',
  'entregue',
  'nao_entregue',
  'cancelado',
] as const

// ---------------------------------------------------------------------------
// Busca
// ---------------------------------------------------------------------------

export type CriterioDeBusca =
  | { tipo: 'numero'; valor: string }
  | { tipo: 'cpfCnpj'; valor: string }
  | { tipo: 'cliente'; valor: string }

/**
 * Uma caixa de busca só, como no AUVP-Eventos: só dígitos e curto é número do
 * pedido; 11 ou 14 dígitos, com ou sem pontuação, é CPF ou CNPJ; o resto é
 * nome do cliente.
 */
export function classificarBusca(entrada: string): CriterioDeBusca | null {
  const t = entrada.trim()
  if (!t) return null
  const digitos = t.replace(/\D/g, '')
  const soPontuacaoDeDocumento = /^[\d.\-/\s]+$/.test(t)
  if (soPontuacaoDeDocumento && (digitos.length === 11 || digitos.length === 14)) {
    return { tipo: 'cpfCnpj', valor: digitos }
  }
  if (/^\d{1,10}$/.test(t)) return { tipo: 'numero', valor: t }
  return { tipo: 'cliente', valor: t }
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export type ResumoDoPedido = {
  id: string
  numero: string
  numeroEcommerce: string | null
  /** Como o Tiny manda: dd/mm/aaaa. */
  data: string
  cliente: string
  valor: string
  situacao: string
  rastreio: string | null
}

export function lerResumoDoPedido(p: Bruto): ResumoDoPedido {
  return {
    id: texto(p.id),
    numero: texto(p.numero),
    numeroEcommerce: ouNulo(p.numero_ecommerce),
    data: texto(p.data_pedido),
    cliente: texto(p.nome),
    valor: decimalDoTiny(p.valor),
    situacao: codigoDaSituacao(p.situacao),
    rastreio: ouNulo(p.codigo_rastreamento),
  }
}

export type PaginaDePedidos = { pedidos: ResumoDoPedido[]; pagina: number; paginas: number }

export function lerPaginaDePedidos(r: Bruto & { vazio?: boolean }): PaginaDePedidos {
  if (r.vazio) return { pedidos: [], pagina: 1, paginas: 1 }
  return {
    pedidos: listaDe(r.pedidos, 'pedido').map(lerResumoDoPedido),
    pagina: Number(r.pagina) || 1,
    paginas: Number(r.numero_paginas) || 1,
  }
}

export type EnderecoDoTiny = {
  endereco: string
  numero: string
  complemento: string
  bairro: string
  cep: string
  cidade: string
  uf: string
}

function lerEndereco(e: Bruto): EnderecoDoTiny {
  return {
    endereco: texto(e.endereco),
    numero: texto(e.numero),
    complemento: texto(e.complemento),
    bairro: texto(e.bairro),
    cep: texto(e.cep).replace(/\D/g, ''),
    cidade: texto(e.cidade),
    uf: texto(e.uf).toUpperCase(),
  }
}

/** "Rua X, 10 - Apto 2 · Centro · São Paulo/SP · 01001-000", sem pedaços vazios. */
export function enderecoEmUmaLinha(e: EnderecoDoTiny): string {
  const rua = [e.endereco, e.numero].filter(Boolean).join(', ')
  const cep = e.cep.length === 8 ? `${e.cep.slice(0, 5)}-${e.cep.slice(5)}` : e.cep
  const cidade = [e.cidade, e.uf].filter(Boolean).join('/')
  return [[rua, e.complemento].filter(Boolean).join(' - '), e.bairro, cidade, cep]
    .filter(Boolean)
    .join(' · ')
}

export type DetalheDoPedido = ResumoDoPedido & {
  dataPrevista: string | null
  dataFaturamento: string | null
  dataEnvio: string | null
  dataEntrega: string | null
  cliente: string
  clienteDados: {
    nome: string
    cpfCnpj: string
    email: string | null
    fone: string | null
    endereco: EnderecoDoTiny
  }
  entrega: { nome: string; endereco: EnderecoDoTiny } | null
  itens: {
    codigo: string
    descricao: string
    unidade: string
    quantidade: number
    valorUnitario: string
  }[]
  marcadores: { descricao: string; cor: string | null }[]
  transportadora: string | null
  formaEnvio: string | null
  formaFrete: string | null
  fretePorConta: string | null
  valorFrete: string
  valorDesconto: string
  totalProdutos: string
  urlRastreio: string | null
  notaFiscalId: string | null
  observacao: string | null
  observacaoInterna: string | null
  ecommerce: string | null
}

export function lerDetalheDoPedido(p: Bruto): DetalheDoPedido {
  const cliente = (p.cliente ?? {}) as Bruto
  const entrega = (p.endereco_entrega ?? null) as Bruto | null
  const ecommerce = (p.ecommerce ?? null) as Bruto | null
  const notaFiscal = texto(p.id_nota_fiscal)

  return {
    ...lerResumoDoPedido({ ...p, nome: cliente.nome ?? p.nome, valor: p.total_pedido ?? p.valor }),
    dataPrevista: ouNulo(p.data_prevista),
    dataFaturamento: ouNulo(p.data_faturamento),
    dataEnvio: ouNulo(p.data_envio),
    dataEntrega: ouNulo(p.data_entrega),
    clienteDados: {
      nome: texto(cliente.nome),
      cpfCnpj: texto(cliente.cpf_cnpj).replace(/\D/g, ''),
      email: ouNulo(cliente.email),
      fone: ouNulo(cliente.fone),
      endereco: lerEndereco(cliente),
    },
    entrega:
      entrega && texto(entrega.endereco)
        ? {
            nome: texto(entrega.nome_destinatario) || texto(cliente.nome),
            endereco: lerEndereco(entrega),
          }
        : null,
    itens: listaDe(p.itens, 'item').map((i) => ({
      codigo: texto(i.codigo),
      descricao: texto(i.descricao),
      unidade: texto(i.unidade) || 'UN',
      quantidade: Number(decimalDoTiny(i.quantidade)) || 0,
      valorUnitario: decimalDoTiny(i.valor_unitario),
    })),
    marcadores: listaDe(p.marcadores, 'marcador')
      .map((m) => ({ descricao: texto(m.descricao), cor: ouNulo(m.cor) }))
      .filter((m) => m.descricao),
    transportadora: ouNulo(p.nome_transportador),
    formaEnvio: ouNulo(p.forma_envio),
    formaFrete: ouNulo(p.forma_frete),
    fretePorConta: ouNulo(p.frete_por_conta),
    valorFrete: decimalDoTiny(p.valor_frete),
    valorDesconto: decimalDoTiny(p.valor_desconto),
    totalProdutos: decimalDoTiny(p.total_produtos),
    urlRastreio: ouNulo(p.url_rastreamento),
    notaFiscalId: notaFiscal && notaFiscal !== '0' ? notaFiscal : null,
    observacao: ouNulo(p.obs),
    observacaoInterna: ouNulo(p.obs_interna),
    ecommerce: ecommerce ? ouNulo(ecommerce.nomeEcommerce ?? ecommerce.nome) : null,
  }
}

/** Cor do marcador como o Tiny manda ("#ff0000" ou "ff0000"), ou nada se inválida. */
export function corDoMarcador(cor: string | null): string | null {
  if (!cor) return null
  const hex = cor.replace(/^#/, '')
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex}` : null
}

/** "2026-10-22" (campo de data do navegador) vira "22/10/2026", como o Tiny pede. */
export function dataParaOTiny(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null
}

// ---------------------------------------------------------------------------
// Produtos e estoque
// ---------------------------------------------------------------------------

export type ProdutoNaBusca = {
  id: string
  codigo: string
  nome: string
  preco: string
  unidade: string
}

export type PaginaDeProdutos = { produtos: ProdutoNaBusca[]; pagina: number; paginas: number }

export function lerPaginaDeProdutos(r: Bruto & { vazio?: boolean }): PaginaDeProdutos {
  if (r.vazio) return { produtos: [], pagina: 1, paginas: 1 }
  return {
    produtos: listaDe(r.produtos, 'produto').map((p) => ({
      id: texto(p.id),
      codigo: texto(p.codigo),
      nome: texto(p.nome),
      preco: decimalDoTiny(p.preco),
      unidade: texto(p.unidade) || 'UN',
    })),
    pagina: Number(r.pagina) || 1,
    paginas: Number(r.numero_paginas) || 1,
  }
}

export type EstoqueDoProduto = {
  id: string
  codigo: string
  nome: string
  unidade: string
  saldo: number
  reservado: number
  /** Saldo menos o reservado: o que ainda pode sair. */
  disponivel: number
  depositos: { nome: string; empresa: string | null; saldo: number; desconsiderado: boolean }[]
}

export function lerEstoque(p: Bruto): EstoqueDoProduto {
  const saldo = Number(decimalDoTiny(p.saldo)) || 0
  const reservado = Number(decimalDoTiny(p.saldoReservado)) || 0
  return {
    id: texto(p.id),
    codigo: texto(p.codigo),
    nome: texto(p.nome),
    unidade: texto(p.unidade) || 'UN',
    saldo,
    reservado,
    disponivel: saldo - reservado,
    depositos: listaDe(p.depositos, 'deposito').map((d) => ({
      nome: texto(d.nome),
      empresa: ouNulo(d.empresa),
      saldo: Number(decimalDoTiny(d.saldo)) || 0,
      // Depósito marcado para não contar no saldo geral.
      desconsiderado: texto(d.desconsiderar).toUpperCase() === 'S',
    })),
  }
}

const enderecoWeb = (url: string) => (/^https?:\/\//.test(url) ? url : null)

/** A primeira foto do produto: anexo, ou imagem externa quando não há anexo. */
export function imagemDoProduto(p: Bruto): string | null {
  // O anexo vem como texto dentro de `{anexo: "..."}`, e não como objeto.
  const anexos = Array.isArray(p.anexos) ? p.anexos : []
  const primeiro = anexos[0] as { anexo?: unknown } | string | undefined
  const deAnexo = enderecoWeb(texto(typeof primeiro === 'string' ? primeiro : primeiro?.anexo))
  if (deAnexo) return deAnexo
  const externa = listaDe(p.imagens_externas, 'imagem_externa')[0]
  return enderecoWeb(texto(externa?.url))
}

// ---------------------------------------------------------------------------
// Contatos (clientes do Tiny)
// ---------------------------------------------------------------------------

export type ContatoDoTiny = {
  id: string
  codigo: string | null
  nome: string
  fantasia: string | null
  /** Só dígitos. */
  cpfCnpj: string
  email: string | null
  fone: string | null
  endereco: EnderecoDoTiny
  ativo: boolean
}

export function lerContato(c: Bruto): ContatoDoTiny {
  const situacao = texto(c.situacao).toLowerCase()
  return {
    id: texto(c.id),
    codigo: ouNulo(c.codigo),
    nome: texto(c.nome),
    fantasia: ouNulo(c.fantasia),
    cpfCnpj: texto(c.cpf_cnpj).replace(/\D/g, ''),
    email: ouNulo(c.email),
    fone: ouNulo(c.fone) ?? ouNulo(c.celular),
    endereco: lerEndereco(c),
    // A busca devolve "Ativo"/"Inativo"; o cadastro, "A"/"I".
    ativo: !situacao || situacao.startsWith('a'),
  }
}

export type PaginaDeContatos = { contatos: ContatoDoTiny[]; pagina: number; paginas: number }

export function lerPaginaDeContatos(r: Bruto & { vazio?: boolean }): PaginaDeContatos {
  if (r.vazio) return { contatos: [], pagina: 1, paginas: 1 }
  return {
    contatos: listaDe(r.contatos, 'contato').map(lerContato),
    pagina: Number(r.pagina) || 1,
    paginas: Number(r.numero_paginas) || 1,
  }
}
