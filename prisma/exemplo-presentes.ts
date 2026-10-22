import type {
  FaseOperacional,
  MotivoEnvio,
  Prisma,
  PrismaClient,
  StatusSolicitacao,
} from '@prisma/client'
import { acompanhamentosFaltando } from '../src/lib/acompanhamentos'
import { aplicarModelo, MODELOS_DE_CARTA } from '../src/lib/carta'
import { formatarCodigo } from '../src/lib/codigo'
import { cpfValido } from '../src/lib/cpf'
import { anoCorrente, instanteLocal, intervaloDoMes, partesLocais } from '../src/lib/datas'
import { demandaDoPresente, faseDoPresente } from '../src/lib/logistica/ponte'
import { totalDosItens } from '../src/lib/money'
import { precisaDeCompra } from '../src/lib/status'
import { CATALOGO_AUVP } from './catalogo-auvp'
import { gerador } from './exemplo-logistica'

/**
 * Solicitações de presente de exemplo: uns cinco meses de uso da ferramenta.
 *
 * **Fictício.** Clientes, endereços e cartas são inventados; os produtos e os
 * preços são os do catálogo real. O objetivo é que cada tela tenha o volume e
 * a variedade que vai ter de verdade: todos os status, a rota com e sem
 * Financeiro, o kit de vinho com a garrafa, presente específico, produto sem
 * preço, cliente que já recebeu várias vezes, consultora perto do limite e um
 * mês em que o limite estourou.
 *
 * Cada solicitação percorre o fluxo como no uso real: o histórico tem uma
 * linha por passo, datada e assinada por quem moveu, e só passos que a máquina
 * de estados permite. O presente aprovado já está na trilha da Logística, na
 * fase que a ponte daria a ele.
 *
 * Carrega uma vez só. As datas são relativas ao dia da carga e ficam lá, como
 * no uso real, em que o pedido de ontem não muda de data. Rodar de novo não
 * acrescenta nada: se algum cliente de exemplo já tem solicitação, o conjunto
 * já está no banco. Os códigos continuam de onde o contador do ano está, então
 * não colidem com o que alguém já tenha criado pela tela.
 */

const DIA = 86_400_000
const HORA = 3_600_000

const BIA = 'bia@auvp.com.br'
const FINANCEIRO = 'financeiro@auvp.com.br'

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

type Endereco = {
  entregaCep: string
  entregaLogradouro: string
  entregaBairro: string
  entregaCidade: string
  entregaUf: string
}

const ENDERECOS: readonly [string, string, string, string, string][] = [
  ['01426001', 'Rua Oscar Freire', 'Jardim Paulista', 'São Paulo', 'SP'],
  ['04538133', 'Avenida Brigadeiro Faria Lima', 'Itaim Bibi', 'São Paulo', 'SP'],
  ['05402000', 'Rua Teodoro Sampaio', 'Pinheiros', 'São Paulo', 'SP'],
  ['04094050', 'Avenida Ibirapuera', 'Moema', 'São Paulo', 'SP'],
  ['13025320', 'Rua Coronel Quirino', 'Cambuí', 'Campinas', 'SP'],
  ['14025000', 'Avenida Presidente Vargas', 'Jardim América', 'Ribeirão Preto', 'SP'],
  ['22410002', 'Rua Visconde de Pirajá', 'Ipanema', 'Rio de Janeiro', 'RJ'],
  ['22290030', 'Avenida Pasteur', 'Botafogo', 'Rio de Janeiro', 'RJ'],
  ['24220031', 'Rua Moreira César', 'Icaraí', 'Niterói', 'RJ'],
  ['30140071', 'Rua da Bahia', 'Lourdes', 'Belo Horizonte', 'MG'],
  ['30310000', 'Avenida do Contorno', 'Funcionários', 'Belo Horizonte', 'MG'],
  ['38400100', 'Avenida Rondon Pacheco', 'Tibery', 'Uberlândia', 'MG'],
  ['80240000', 'Avenida Sete de Setembro', 'Batel', 'Curitiba', 'PR'],
  ['86010000', 'Avenida Higienópolis', 'Centro', 'Londrina', 'PR'],
  ['88015200', 'Avenida Beira-Mar Norte', 'Centro', 'Florianópolis', 'SC'],
  ['89010000', 'Rua XV de Novembro', 'Centro', 'Blumenau', 'SC'],
  ['90570020', 'Rua Padre Chagas', 'Moinhos de Vento', 'Porto Alegre', 'RS'],
  ['70390025', 'SHIS QI 11', 'Lago Sul', 'Brasília', 'DF'],
  ['74115060', 'Avenida T-4', 'Setor Bueno', 'Goiânia', 'GO'],
  ['40140130', 'Avenida Sete de Setembro', 'Vitória', 'Salvador', 'BA'],
  ['51020000', 'Avenida Boa Viagem', 'Boa Viagem', 'Recife', 'PE'],
  ['60170001', 'Avenida Beira Mar', 'Meireles', 'Fortaleza', 'CE'],
  ['29055200', 'Avenida Nossa Senhora da Penha', 'Praia do Canto', 'Vitória', 'ES'],
  ['78050000', 'Avenida Historiador Rubens de Mendonça', 'Bosque da Saúde', 'Cuiabá', 'MT'],
]

const NOMES = [
  'André Luiz Barbosa',
  'Beatriz Fontes Ramos',
  'Caio Henrique Vasconcelos',
  'Daniela Prado Teixeira',
  'Eduardo Nogueira Campos',
  'Fabiana Rezende Lopes',
  'Gabriel Antunes Moura',
  'Helena Duarte Siqueira',
  'Igor Matos Farias',
  'Juliana Peixoto Brandão',
  'Leonardo Sampaio Reis',
  'Mariana Cunha Pacheco',
  'Nelson Tavares Coelho',
  'Otávio Mendes Guerra',
  'Patrícia Leal Monteiro',
  'Rafael Bittencourt Lima',
  'Sabrina Torres Macedo',
  'Thiago Andrade Pires',
  'Vanessa Queiroz Araújo',
  'Wagner Freitas Rocha',
  'Alessandra Moraes Viana',
  'Bruno Cardoso Paiva',
  'Camila Ribeiro Falcão',
  'Diego Martins Souto',
  'Elaine Carvalho Dutra',
  'Felipe Gonçalves Brito',
  'Gisele Amaral Pinto',
  'Henrique Lacerda Melo',
  'Isabela Fernandes Costa',
  'José Ricardo Albuquerque',
  'Larissa Domingues Prates',
  'Marcelo Azevedo Quintela',
  'Natália Borges Sardinha',
  'Paulo Sérgio Medeiros',
  'Renata Valente Castro',
  'Sérgio Batista Rangel',
  'Tatiana Correia Leme',
  'Vinícius Holanda Barros',
  'Yasmin Figueiredo Lins',
  'Rodrigo Esteves Bastos',
]

/** CPF com dígitos verificadores válidos: a validação recusaria um inventado. */
function gerarCpf(aleatorio: () => number): string {
  const base = Array.from({ length: 9 }, () => Math.floor(aleatorio() * 10))
  const digito = (numeros: number[]) => {
    const soma = numeros.reduce((s, n, i) => s + n * (numeros.length + 1 - i), 0)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  const d1 = digito(base)
  const d2 = digito([...base, d1])
  return [...base, d1, d2].join('')
}

type ClienteDeExemplo = {
  nome: string
  cpf: string
  telefone: string | null
  email: string | null
  consultor: string
  /** Quanto mais alto, mais presentes recebe: há cliente que recebe todo mês. */
  peso: number
  endereco: Endereco & { entregaNumero: string; entregaComplemento: string | null }
  /** Para onde se mudou no meio do período: o pedido antigo mantém o endereço antigo. */
  mudouPara?: Endereco & { entregaNumero: string; entregaComplemento: string | null }
}

function montarClientes(aleatorio: () => number): ClienteDeExemplo[] {
  return NOMES.map((nome, i) => {
    const [cep, logradouro, bairro, cidade, uf] = ENDERECOS[i % ENDERECOS.length]!
    const numero = String(100 + Math.floor(aleatorio() * 2900))
    const complemento =
      aleatorio() < 0.55
        ? `Apto ${1 + Math.floor(aleatorio() * 24)}${aleatorio() < 0.5 ? '1' : '2'}`
        : null
    const partes = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(' ')
    const cliente: ClienteDeExemplo = {
      nome,
      cpf: gerarCpf(aleatorio),
      // Um em cada cinco veio sem telefone, e metade sem e-mail.
      telefone:
        aleatorio() < 0.8
          ? `${['11', '21', '31', '41', '48', '51', '61', '71', '81', '85'][i % 10]}9${String(
              Math.floor(aleatorio() * 1e8),
            ).padStart(8, '0')}`
          : null,
      email: aleatorio() < 0.5 ? `${partes[0]}.${partes.at(-1)}@exemplo.com.br` : null,
      // Carlos atende mais clientes; Fernanda tem carteira menor.
      consultor: i < 24 ? 'carlos@auvp.com.br' : 'fernanda@auvp.com.br',
      peso: i % 7 === 0 ? 4 : i % 3 === 0 ? 2 : 1,
      endereco: {
        entregaCep: cep,
        entregaLogradouro: logradouro,
        entregaNumero: numero,
        entregaComplemento: complemento,
        entregaBairro: bairro,
        entregaCidade: cidade,
        entregaUf: uf,
      },
    }
    return cliente
  }).map((c, i) =>
    // Dois clientes frequentes se mudaram: a solicitação antiga continua
    // mostrando o endereço para onde o presente foi.
    i === 7 || i === 28
      ? {
          ...c,
          mudouPara: {
            entregaCep: '04543011',
            entregaLogradouro: 'Rua Joaquim Floriano',
            entregaNumero: String(400 + i),
            entregaComplemento: 'Conjunto 81',
            entregaBairro: 'Itaim Bibi',
            entregaCidade: 'São Paulo',
            entregaUf: 'SP',
          },
        }
      : c,
  )
}

// ---------------------------------------------------------------------------
// O que se manda em cada ocasião
// ---------------------------------------------------------------------------

const PRODUTOS = new Map(CATALOGO_AUVP.map((p) => [p.nome, p]))
const VINHOS = CATALOGO_AUVP.filter((p) => p.serveComoAcompanhamento === 'vinho').map((p) => p.nome)
const WHISKIES = CATALOGO_AUVP.filter((p) => p.nome.startsWith('Whisky')).map((p) => p.nome)

const KIT_VINHO = 'Kit Vinho com Abridor Elétrico e Petisqueira - Escolha o vinho'
const KIT_QUEIJOS = 'Kit Queijos com Vinho - Escolha o vinho'
const CAIXA_MDF = 'Caixa MDF para vinho com Acessórios - Escolha o vinho'

/** `VINHO` e `WHISKY` são sorteados entre as garrafas do catálogo. */
const CESTAS: Record<MotivoEnvio, readonly (readonly string[])[]> = {
  aniversario: [
    ['VINHO'],
    [KIT_VINHO, 'VINHO'],
    [CAIXA_MDF, 'VINHO'],
    ['Kit Café Constantino'],
    ['Kit Café Orfeu com Prensa Francesa'],
    ['Kit Aperol'],
    ['Kit Presente Granado'],
    ['Kit Presente Loccitane Romã'],
    ['Kit Abridor de Garrafas + Cerveja Artesanal'],
  ],
  casamento: [
    [KIT_QUEIJOS, 'VINHO'],
    [KIT_VINHO, 'VINHO'],
    ['VINHO', 'VINHO'],
    ['Kit Churrasco AUVP com faca'],
    ['Kit Churrasco AUVP com Garra e Acessórios'],
  ],
  nascimento: [
    ['Cadeira de balanço Baby - Menina'],
    ['Cadeira de balanço Baby - Menino'],
    ['Cadeira de balanço Baby - Unissex', 'Kit Presente Granado'],
    ['Tapete Musical Baby - Menina'],
    ['Tapete Musical Baby - Menino'],
  ],
  // Os brindes da prateleira moram aqui: é a rota que pula o Financeiro.
  reforco_relacionamento: [
    ['Livro - A Psicologia Financeira'],
    ['Livro - A arte de gastar dinheiro'],
    ['Livro - A Psicologia Financeira', 'Livro - A arte de gastar dinheiro'],
    ['Kit Mochila AUVP'],
    ['Boné Capitalismo', 'Meia AUVP'],
    ['Caneca AUVP', 'Agenda e Caneta AUVP'],
    ['Garrafa AUVP', 'Caneta e Moleskine AUVP'],
    ['Kit Canga AUVP'],
    ['Carteira AUVP', 'Boné Capitalismo'],
    ['Kit Café Constantino'],
    ['Kit Caneca de Chopp + Cerveja Artesanal'],
  ],
  primeiro_milhao: [
    ['WHISKY'],
    ['WHISKY', 'Carteira AUVP'],
    ['WHISKY', 'Livro - A Psicologia Financeira'],
    ['VINHO', 'Kit Mochila AUVP'],
  ],
  outro: [
    ['Kit Mochila AUVP'],
    ['Livro - A Psicologia Financeira'],
    ['Kit Café Orfeu com Prensa Francesa'],
    ['VINHO'],
  ],
}

const PESO_DO_MOTIVO: readonly [MotivoEnvio, number][] = [
  ['aniversario', 34],
  ['reforco_relacionamento', 30],
  ['primeiro_milhao', 10],
  ['casamento', 8],
  ['nascimento', 8],
  ['outro', 10],
]

const MOTIVOS_OUTRO = [
  'Renovação do contrato de consultoria',
  'Indicação de um novo cliente',
  'Agradecimento pela presença no evento de fim de ano',
]

/** Presente específico: fora do catálogo, com o link de onde comprar. */
const ESPECIFICOS = [
  {
    descricaoLivre: 'Luminária de mesa gravada com o nome do cliente',
    urlExterna: 'https://www.exemplo-loja.com.br/luminaria-gravada',
    valorUnitario: '220.00',
  },
  {
    descricaoLivre: 'Vale-jantar para dois em restaurante da cidade do cliente',
    urlExterna: 'https://www.exemplo-loja.com.br/vale-jantar',
    valorUnitario: '380.00',
  },
  {
    descricaoLivre: 'Camisa oficial do time do coração',
    urlExterna: 'https://www.exemplo-loja.com.br/camisa-oficial',
    valorUnitario: '350.00',
  },
  {
    descricaoLivre: 'Kit de jardinagem com vasos e sementes',
    urlExterna: 'https://www.exemplo-loja.com.br/kit-jardinagem',
    valorUnitario: '160.00',
  },
]

const OBSERVACOES = [
  'Entregar na portaria; o cliente viaja na semana que vem.',
  'Cliente pediu discrição: sem logo da AUVP na caixa.',
  'Entregar no escritório, em horário comercial.',
  'Confirmar o tamanho antes de embalar.',
]

type Item = {
  produto: string | null
  descricaoLivre: string | null
  urlExterna: string | null
  valorUnitario: string
  quantidade: number
}

function escolher<T>(lista: readonly T[], aleatorio: () => number): T {
  return lista[Math.floor(aleatorio() * lista.length)]!
}

function escolherPorPeso<T>(lista: readonly [T, number][], aleatorio: () => number): T {
  const total = lista.reduce((s, [, p]) => s + p, 0)
  let alvo = aleatorio() * total
  for (const [valor, peso] of lista) {
    alvo -= peso
    if (alvo < 0) return valor
  }
  return lista.at(-1)![0]
}

function montarItens(motivo: MotivoEnvio, aleatorio: () => number): Item[] {
  // Um em cada vinte é presente específico, sozinho ou junto de um item.
  if (aleatorio() < 0.05) {
    const especifico = { produto: null, quantidade: 1, ...escolher(ESPECIFICOS, aleatorio) }
    return aleatorio() < 0.5
      ? [especifico]
      : [especifico, catalogo('Livro - A Psicologia Financeira')]
  }

  const nomes = escolher(CESTAS[motivo], aleatorio).map((n) =>
    n === 'VINHO'
      ? escolher(VINHOS, aleatorio)
      : n === 'WHISKY'
        ? escolher(WHISKIES, aleatorio)
        : n,
  )
  // Duas garrafas iguais viram uma linha com quantidade 2, como a tela faria.
  const itens = new Map<string, Item>()
  for (const nome of nomes) {
    const existente = itens.get(nome)
    if (existente) existente.quantidade++
    else itens.set(nome, catalogo(nome))
  }
  return [...itens.values()]
}

function catalogo(nome: string): Item {
  const p = PRODUTOS.get(nome)
  if (!p) throw new Error(`Produto de exemplo fora do catálogo: ${nome}`)
  return {
    produto: nome,
    descricaoLivre: null,
    urlExterna: null,
    // Produto sem preço na planilha congela como zero, o mesmo que
    // `criarSolicitacao` faz.
    valorUnitario: p.valor ?? '0',
    quantidade: 1,
  }
}

// ---------------------------------------------------------------------------
// O caminho de cada solicitação
// ---------------------------------------------------------------------------

type Passo = { status: StatusSolicitacao; em: Date; por: string; motivo?: string }

/** O que acontece fora do fluxo feliz, e com que frequência. */
type Excecao = 'nenhuma' | 'duplicado' | 'desistiu' | 'esgotado' | 'extravio' | 'devolvido'

function sortearExcecao(aleatorio: () => number, compra: boolean): Excecao {
  const r = aleatorio()
  if (r < 0.025) return 'duplicado'
  if (r < 0.05 && compra) return 'desistiu'
  if (r < 0.08 && compra) return 'esgotado'
  if (r < 0.13) return 'extravio'
  if (r < 0.155) return 'devolvido'
  return 'nenhuma'
}

/**
 * O próximo lote do Admin depois de um instante: ele encaminha a pilha às
 * terças e às sextas, no fim da manhã. É o que faz a fila de aprovação
 * acumular alguns dias, como acontece de verdade.
 */
function proximoLote(depoisDe: Date, aleatorio: () => number): Date {
  for (let d = 0; d < 8; d++) {
    const { ano, mes, dia } = partesLocais(new Date(depoisDe.getTime() + d * DIA))
    const meiaNoite = instanteLocal(ano, mes, dia)
    const semana = new Date(meiaNoite.getTime() + 12 * HORA).getUTCDay()
    const lote = new Date(meiaNoite.getTime() + (10 + aleatorio() * 2) * HORA)
    if ((semana === 2 || semana === 5) && lote > depoisDe) return lote
  }
  return new Date(depoisDe.getTime() + DIA)
}

/**
 * Todos os passos que esta solicitação dá, do pedido em diante: quem chama
 * corta no presente. Assim uma solicitação de ontem fica em "Pendente" e a de
 * três meses atrás já foi entregue, pelo mesmo caminho.
 *
 * Problema surgido na última semana fica sem solução: é o que o Admin ainda
 * está resolvendo.
 */
function caminho(
  inicio: Date,
  consultor: string,
  compra: boolean,
  excecao: Excecao,
  aleatorio: () => number,
  agora: Date,
): Passo[] {
  const passos: Passo[] = [{ status: 'pendente', em: inicio, por: consultor }]
  let t = inicio.getTime()
  const andar = (minDias: number, maxDias: number) => {
    t += (minDias + aleatorio() * (maxDias - minDias)) * DIA
    return new Date(t)
  }
  const passo = (status: StatusSolicitacao, por: string, motivo?: string) =>
    passos.push({ status, em: new Date(t), por, ...(motivo ? { motivo } : {}) })

  if (excecao === 'duplicado') {
    andar(0.1, 0.8)
    passo('cancelado', BIA, 'Pedido duplicado: o consultor abriu outro para o mesmo cliente.')
    return passos
  }

  // A aprovação sai no lote do Admin, e os dois passos quase sempre juntos; às
  // vezes a solicitação espera mais um dia em "Aguardando aprovação".
  t = proximoLote(new Date(t + HORA), aleatorio).getTime()
  passo('aguardando_aprovacao', BIA)
  if (aleatorio() < 0.3) andar(0.5, 1.5)
  else t += 60_000
  passo(compra ? 'aguardando_compra' : 'organizando_envio', BIA)

  if (compra) {
    if (excecao === 'desistiu') {
      andar(1, 3)
      passo('cancelado', BIA, 'O cliente encerrou o contrato antes do envio.')
      return passos
    }
    if (excecao === 'esgotado') {
      andar(0.5, 1.5)
      passo('deu_problema', FINANCEIRO, 'Produto esgotado no fornecedor; aguardando reposição.')
      if (t > agora.getTime() - 7 * DIA) return passos
      andar(2, 4)
      passo('aguardando_compra', BIA)
    }
    andar(1, 5)
    passo('comprado', FINANCEIRO)
    andar(1, 3)
    passo('organizando_envio', FINANCEIRO)
  }

  if (excecao === 'extravio') {
    andar(2, 4)
    passo('deu_problema', BIA, 'A transportadora informou extravio do pacote.')
    if (t > agora.getTime() - 7 * DIA) return passos
    andar(1, 3)
    passo('organizando_envio', BIA)
  }

  andar(2, 6)
  passo('entregue', BIA)

  if (excecao === 'devolvido') {
    andar(2, 5)
    passo(
      'devolvido',
      BIA,
      'Destinatário ausente após três tentativas; o pacote voltou para a AUVP.',
    )
    return passos
  }

  if (aleatorio() < 0.6) {
    andar(1, 6)
    passo('cliente_confirmou', BIA)
  }
  return passos
}

/** Quando o pacote saiu: um dia depois de entrar na expedição pela última vez. */
function saidaDoPacote(passos: readonly Passo[]): Date | null {
  const ultima = passos.findLast((p) => p.status === 'organizando_envio')
  return ultima ? new Date(ultima.em.getTime() + DIA) : null
}

function rastreio(aleatorio: () => number): { rastreio: string; transportadora: string } {
  const numero = String(Math.floor(aleatorio() * 1e9)).padStart(9, '0')
  const r = aleatorio()
  if (r < 0.6) return { rastreio: `QB${numero}BR`, transportadora: 'Correios' }
  if (r < 0.85) return { rastreio: `1009${numero}0`, transportadora: 'Jadlog' }
  return { rastreio: `LGI${numero}`, transportadora: 'Loggi' }
}

// ---------------------------------------------------------------------------
// Quanto cada consultor gasta por mês
// ---------------------------------------------------------------------------

/**
 * Alvo de gasto por mês, do mais antigo ao atual. Carlos (limite de R$ 5.000)
 * estoura em um mês; Fernanda (R$ 3.000) estoura em outro e fecha o mês atual
 * perto do teto, contando as solicitações escritas à mão no seed.
 */
const ALVO_POR_MES: Record<string, readonly number[]> = {
  'carlos@auvp.com.br': [3900, 4400, 5600, 4100, 1700],
  'fernanda@auvp.com.br': [2500, 3250, 2300, 2700, 2050],
}

/** Um instante de dia útil, em horário comercial de São Paulo, dentro de [de, ate). */
function horarioComercial(de: Date, ate: Date, aleatorio: () => number): Date | null {
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    const dia = new Date(de.getTime() + aleatorio() * (ate.getTime() - de.getTime()))
    const { ano, mes, dia: d } = partesLocais(dia)
    const meiaNoite = instanteLocal(ano, mes, d)
    const semana = new Date(meiaNoite.getTime() + 12 * HORA).getUTCDay()
    if (semana === 0 || semana === 6) continue
    const instante = new Date(meiaNoite.getTime() + (9 + aleatorio() * 9) * HORA)
    if (instante >= de && instante < ate) return instante
  }
  return null
}

// ---------------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------------

type Rascunho = {
  consultor: string
  cliente: ClienteDeExemplo
  motivo: MotivoEnvio
  itens: Item[]
  inicio: Date
  /** Exceção escolhida, em vez de sorteada. */
  excecao?: Excecao
}

export async function semearPresentes(
  db: PrismaClient,
  { usuarios, produtos }: { usuarios: Map<string, string>; produtos: Map<string, { id: string }> },
  agora = new Date(),
) {
  const aleatorio = gerador(2026)
  const clientesDeExemplo = montarClientes(aleatorio)

  for (const c of clientesDeExemplo) {
    if (!cpfValido(c.cpf)) throw new Error(`CPF de exemplo inválido: ${c.cpf}`)
  }

  // Os clientes primeiro: a primeira solicitação de cada um sai do cadastro.
  const clientes = new Map<string, string>()
  for (const c of clientesDeExemplo) {
    const dados = { nome: c.nome, telefone: c.telefone, email: c.email }
    const cliente = await db.cliente.upsert({
      where: { cpf: c.cpf },
      create: { ...dados, cpf: c.cpf, criadoPor: usuarios.get(c.consultor) },
      update: dados,
    })
    clientes.set(c.cpf, cliente.id)
  }

  const jaCarregado = await db.solicitacao.count({
    where: { cliente: { cpf: { in: clientesDeExemplo.map((c) => c.cpf) } } },
  })
  if (jaCarregado) return { clientes: clientes.size, solicitacoes: 0 }

  // Mês a mês, cada consultor pede até chegar perto do alvo daquele mês.
  const rascunhos: Rascunho[] = []
  const meses = 5
  const hoje = partesLocais(agora)
  for (const [consultor, alvos] of Object.entries(ALVO_POR_MES)) {
    const carteira = clientesDeExemplo
      .filter((c) => c.consultor === consultor)
      .map((c) => [c, c.peso] as [ClienteDeExemplo, number])

    for (let m = 0; m < meses; m++) {
      const atras = meses - 1 - m
      const mes = ((((hoje.mes - 1 - atras) % 12) + 12) % 12) + 1
      const ano = hoje.ano + Math.floor((hoje.mes - 1 - atras) / 12)
      const { inicio, fim } = intervaloDoMes(instanteLocal(ano, mes, 15))
      const ate = fim < agora ? fim : agora
      let gasto = 0
      let falhas = 0
      while (falhas < 25) {
        const motivo = escolherPorPeso(PESO_DO_MOTIVO, aleatorio)
        const itens = montarItens(motivo, aleatorio)
        const valor = Number(totalDosItens(itens))
        const quando = horarioComercial(inicio, ate, aleatorio)
        // Brinde sem preço sempre caberia no alvo e encheria o mês de pedidos
        // de R$ 0,00; na vida real eles são minoria.
        const semPreco = valor === 0 && aleatorio() < 0.75
        if (!quando || semPreco || gasto + valor > alvos[m]!) {
          falhas++
          continue
        }
        gasto += valor
        rascunhos.push({
          consultor,
          cliente: escolherPorPeso(carteira, aleatorio),
          motivo,
          itens,
          inicio: quando,
        })
      }
    }
  }

  // O código segue a ordem de criação, ano a ano, depois do que o contador já
  // entregou.
  rascunhos.sort((a, b) => a.inicio.getTime() - b.inicio.getTime())

  // O sorteio pode não deixar nenhum problema em aberto hoje, e a tela de
  // "Deu problema" é das que mais precisam de exemplo. Três pedidos de uma a
  // duas semanas atrás tiveram o pacote extraviado nos últimos dias.
  rascunhos
    .filter((r) => r.inicio > new Date(agora.getTime() - 16 * DIA))
    .filter((r) => r.inicio < new Date(agora.getTime() - 9 * DIA))
    .slice(0, 3)
    .forEach((r) => (r.excecao = 'extravio'))
  const anos = [...new Set(rascunhos.map((r) => anoCorrente(r.inicio)))]
  const contadores = await db.contadorCodigo.findMany({ where: { ano: { in: anos } } })
  const sequencia = new Map(contadores.map((c) => [c.ano, c.valor]))
  const gravacoes = rascunhos.map((r) => {
    const ano = anoCorrente(r.inicio)
    const numero = (sequencia.get(ano) ?? 0) + 1
    sequencia.set(ano, numero)
    const dados = montarSolicitacao(
      r,
      formatarCodigo(ano, numero),
      { usuarios, produtos },
      aleatorio,
      agora,
    )
    return () => db.solicitacao.create({ data: dados })
  })

  // O contador vai junto, para a próxima solicitação criada na tela não
  // repetir um código.
  for (const [ano, valor] of sequencia) {
    await db.contadorCodigo.upsert({ where: { ano }, create: { ano, valor }, update: { valor } })
  }

  // Em lotes pequenos: rápido o bastante no banco remoto da Vercel, sem
  // abrir mais conexões do que o pool tem.
  for (let i = 0; i < gravacoes.length; i += 8) {
    await Promise.all(gravacoes.slice(i, i + 8).map((g) => g()))
  }

  return { clientes: clientes.size, solicitacoes: gravacoes.length }
}

function montarSolicitacao(
  r: Rascunho,
  codigo: string,
  { usuarios, produtos }: { usuarios: Map<string, string>; produtos: Map<string, { id: string }> },
  aleatorio: () => number,
  agora: Date,
): Prisma.SolicitacaoCreateInput {
  const pendencias = acompanhamentosFaltando(
    r.itens.map((i) => {
      const p = i.produto ? PRODUTOS.get(i.produto)! : null
      return {
        produtoId: i.produto,
        produto: p
          ? {
              nome: p.nome,
              exigeAcompanhamento: p.exigeAcompanhamento ?? null,
              serveComoAcompanhamento: p.serveComoAcompanhamento ?? null,
            }
          : null,
      }
    }),
  )
  if (pendencias.length) throw new Error(`Exemplo sem acompanhamento em ${codigo}`)

  const compra = precisaDeCompra(
    r.itens.map((i) => ({
      produtoId: i.produto,
      quantidade: i.quantidade,
      produto: i.produto
        ? { origem: PRODUTOS.get(i.produto)!.origem, controlaEstoque: false, estoque: null }
        : null,
    })),
  )
  const sorteada = sortearExcecao(aleatorio, compra)
  const excecao = r.excecao ?? sorteada
  const todos = caminho(r.inicio, r.consultor, compra, excecao, aleatorio, agora)
  const passos = todos.filter((p) => p.em <= agora)
  const atual = passos.at(-1)!.status

  const saiu = saidaDoPacote(passos)
  const envio = rastreio(aleatorio)
  const temRastreio = saiu !== null && saiu <= agora && atual !== 'cancelado'

  const endereco =
    r.cliente.mudouPara && r.inicio > new Date(agora.getTime() - 60 * DIA)
      ? r.cliente.mudouPara
      : r.cliente.endereco

  const motivoOutro = r.motivo === 'outro' ? escolher(MOTIVOS_OUTRO, aleatorio) : null
  const modelo = escolher(MODELOS_DE_CARTA[r.motivo], aleatorio)
  const observacoes = aleatorio() < 0.12 ? escolher(OBSERVACOES, aleatorio) : null

  return {
    codigo,
    consultor: { connect: { id: usuarios.get(r.consultor)! } },
    cliente: { connect: { cpf: r.cliente.cpf } },
    motivo: r.motivo,
    motivoOutro,
    mensagemCarta: aplicarModelo(modelo, r.cliente.nome),
    observacoes,
    status: atual,
    valorTotal: totalDosItens(r.itens).toString(),
    ...endereco,
    entregaDestinatario: r.cliente.nome,
    rastreio: temRastreio ? envio.rastreio : null,
    transportadora: temRastreio ? envio.transportadora : null,
    dataSolicitacao: r.inicio,
    itens: {
      create: r.itens.map((i) => ({
        produto: i.produto ? { connect: { id: produtos.get(i.produto)!.id } } : undefined,
        descricaoLivre: i.descricaoLivre,
        urlExterna: i.urlExterna,
        valorUnitario: i.valorUnitario,
        quantidade: i.quantidade,
        criadoEm: r.inicio,
      })),
    },
    historico: {
      create: passos.map((p, k) => ({
        statusAnterior: k === 0 ? null : passos[k - 1]!.status,
        statusNovo: p.status,
        usuario: { connect: { id: usuarios.get(p.por)! } },
        motivo: p.motivo ?? null,
        criadoEm: p.em,
      })),
    },
    demanda: demandaNaTrilha(r, codigo, passos),
  }
}

/**
 * A demanda que a ponte teria aberto na trilha, na fase em que estaria hoje.
 * Sai da mesma `demandaDoPresente` que a aprovação usa.
 */
function demandaNaTrilha(
  r: Rascunho,
  codigo: string,
  passos: readonly Passo[],
): Prisma.SolicitacaoCreateInput['demanda'] {
  const aprovacao = passos.findIndex(
    (p, k) => k > 0 && passos[k - 1]!.status === 'aguardando_aprovacao',
  )
  if (aprovacao < 0) return undefined

  // O presente cancelado sai da trilha na fase em que estava.
  const ativa = passos.at(-1)!.status !== 'cancelado'
  const vigente = ativa ? passos.at(-1)! : passos.at(-2)!
  const fase = faseDoPresente(vigente.status) as FaseOperacional

  const base = demandaDoPresente(
    {
      codigo,
      clienteNome: r.cliente.nome,
      itens: r.itens.map((i) => ({
        nome: i.produto ?? i.descricaoLivre ?? 'Presente',
        quantidade: i.quantidade,
      })),
    },
    passos[aprovacao]!.status,
    fase,
    passos[aprovacao]!.em,
  )

  const entrega = passos.find((p) => p.status === 'entregue')
  return {
    create: {
      ...base,
      concluidaEm: fase === 'concluido' && entrega ? entrega.em : null,
      responsavel: 'Bruno Lima',
      ativa,
    },
  }
}
