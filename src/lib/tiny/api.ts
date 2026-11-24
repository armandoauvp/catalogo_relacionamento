import { env, tokenDoTiny } from '@/lib/env'
import { NOME_DA_CONTA, type ContaTiny } from './contas'
import type { PedidoParaOTiny } from './pedido'
import type { ContatoParaOTiny } from './contato'
import { coletarErros, EMPRESA_TROCADA, ErroDoTiny } from './erros'
import { lerEmpresa, problemaDaEmpresa } from './empresa'
import {
  codigoDaSituacao,
  decimalDoTiny,
  imagemDoProduto,
  lerDetalheDoPedido,
  lerEstoque,
  lerContato,
  lerPaginaDeContatos,
  lerPaginaDePedidos,
  lerPaginaDeProdutos,
  listaDe,
  trechosDosMaisNovos,
  texto,
  type ContatoDoTiny,
  type CriterioDeBusca,
  type DetalheDoPedido,
  type EstoqueDoProduto,
  type PaginaDeContatos,
  type PaginaDePedidos,
  type PaginaDeProdutos,
} from './leitura'

export { listaDe }

/**
 * Cliente da API v2 do Tiny (Olist ERP). Só roda no servidor: o token sai
 * daqui direto para o Tiny e nunca vai ao navegador nem ao banco.
 *
 * Toda chamada é POST `application/x-www-form-urlencoded` com `token`,
 * `formato=json` e os parâmetros, como a documentação pede. Ver
 * docs/13-tiny.md.
 */

/** Uma requisição presa não pode segurar a fila inteira. */
const TEMPO_LIMITE_MS = 20_000

type Retorno = Record<string, unknown> & { status?: string; codigo_erro?: string | number }

async function chamar(
  conta: ContaTiny,
  endpoint: string,
  parametros: Record<string, string>,
): Promise<Retorno> {
  const token = tokenDoTiny(conta)
  if (!token) {
    throw new ErroDoTiny(`O token do Tiny da ${NOME_DA_CONTA[conta]} não está configurado.`, 1)
  }
  await conferirEmpresa(conta, token)
  return chamarCom(token, endpoint, parametros)
}

/** Token conferido continua valendo por um tempo; trocado é perguntado de novo antes. */
const CONFERIDO_POR_MS = 30 * 60_000
const TROCADO_POR_MS = 2 * 60_000
const conferidos = new Map<string, { problema: string | null; ate: number }>()

async function conferirEmpresa(conta: ContaTiny, token: string) {
  const chave = `${conta}:${token}`
  let conferido = conferidos.get(chave)
  if (!conferido || conferido.ate < Date.now()) {
    const problema = problemaDaEmpresa(conta, lerEmpresa(await chamarCom(token, 'info.php', {})))
    conferido = { problema, ate: Date.now() + (problema ? TROCADO_POR_MS : CONFERIDO_POR_MS) }
    conferidos.set(chave, conferido)
  }
  if (conferido.problema) throw new ErroDoTiny(conferido.problema, EMPRESA_TROCADA)
}

async function chamarCom(
  token: string,
  endpoint: string,
  parametros: Record<string, string>,
): Promise<Retorno> {
  const corpo = new URLSearchParams({ token, formato: 'json', ...parametros })
  let resposta: Response
  try {
    resposta = await fetch(`${env.TINY_API_BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: corpo,
      cache: 'no-store',
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    })
  } catch {
    throw new ErroDoTiny('O Tiny não respondeu a tempo.', null)
  }

  if (!resposta.ok) throw new ErroDoTiny(`O Tiny respondeu HTTP ${resposta.status}.`, null)

  const json = (await resposta.json().catch(() => null)) as { retorno?: Retorno } | null
  const retorno = json?.retorno
  if (!retorno) throw new ErroDoTiny('O Tiny devolveu uma resposta que não é a esperada.', null)

  if (retorno.status === 'OK') return retorno

  const codigo = codigoDoErro(retorno)
  // "Nenhum registro" é resposta vazia, não falha.
  if (codigo === 20) return { ...retorno, vazio: true }
  throw new ErroDoTiny(coletarErros(retorno) || 'O Tiny recusou a operação.', codigo)
}

function codigoDoErro(retorno: Retorno): number | null {
  const direto = Number(retorno.codigo_erro)
  if (direto) return direto
  const registros = listaDe(retorno.registros, 'registro')
  const doRegistro = Number((registros[0] as { codigo_erro?: unknown } | undefined)?.codigo_erro)
  return doRegistro || null
}

// ---------------------------------------------------------------------------
// Produtos e transportadoras, para a importação em lote
// ---------------------------------------------------------------------------

export type ProdutoDoTiny = {
  id: string
  codigo: string
  nome: string
  preco: string
  unidade: string
  /** "P" é o pai de variações, que o Tiny não vende; "V" e "N" vendem. */
  tipoVariacao: string
}

export async function pesquisarProdutos(
  conta: ContaTiny,
  pesquisa: string,
): Promise<ProdutoDoTiny[]> {
  const r = await chamar(conta, 'produtos.pesquisa.php', { pesquisa })
  return listaDe(r.produtos, 'produto').map((p) => ({
    id: texto(p.id),
    codigo: texto(p.codigo),
    nome: texto(p.nome),
    // O Tiny devolve "35.00" ou "35,00", conforme a conta.
    preco: decimalDoTiny(p.preco),
    unidade: texto(p.unidade) || 'UN',
    tipoVariacao: texto(p.tipoVariacao) || 'N',
  }))
}

export async function listarTransportadoras(conta: ContaTiny): Promise<string[]> {
  const r = await chamar(conta, 'formas.envio.pesquisa.php', {})
  const nomes = listaDe(r.registros, 'registro')
    .map((t) => texto(t.nome ?? t.descricao).trim())
    .filter(Boolean)
  return [...new Set(nomes)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export async function incluirPedido(
  conta: ContaTiny,
  pedido: PedidoParaOTiny,
): Promise<{ id: string; numero: string }> {
  const r = await chamar(conta, 'pedido.incluir.php', { pedido: JSON.stringify({ pedido }) })
  const [registro] = listaDe(r.registros, 'registro')
  const id = texto(registro?.id ?? r.id)
  if (!id) throw new ErroDoTiny('O Tiny aceitou o pedido, mas não devolveu o número.', null)
  return { id, numero: texto(registro?.numero ?? r.numero) }
}

/** Muda a situação do pedido no Tiny: o fechamento e a conclusão da expedição. */
export async function alterarSituacao(
  conta: ContaTiny,
  id: string,
  situacao: string,
): Promise<void> {
  await chamar(conta, 'pedido.alterar.situacao', { id, situacao })
}

export type PedidoNoTiny = {
  situacao: string
  rastreio: string | null
  urlRastreio: string | null
  notaFiscalId: string | null
  transportadora: string | null
}

export async function obterPedido(conta: ContaTiny, id: string): Promise<PedidoNoTiny> {
  const r = await chamar(conta, 'pedido.obter.php', { id })
  const p = (r.pedido ?? {}) as Record<string, unknown>
  const ou = (v: unknown) => texto(v) || null
  return {
    situacao: codigoDaSituacao(p.situacao),
    rastreio: ou(p.codigo_rastreamento),
    urlRastreio: ou(p.url_rastreamento),
    notaFiscalId: ou(p.id_nota_fiscal) === '0' ? null : ou(p.id_nota_fiscal),
    transportadora: ou(p.nome_transportador),
  }
}

// ---------------------------------------------------------------------------
// Consulta: todos os pedidos do Tiny, inclusive os que não nasceram aqui
// ---------------------------------------------------------------------------

export type FiltroDePedidos = {
  pagina?: number
  busca?: CriterioDeBusca | null
  situacao?: string | null
  /** dd/mm/aaaa, como o Tiny pede. */
  dataInicial?: string | null
  dataFinal?: string | null
}

export async function pesquisarPedidos(
  conta: ContaTiny,
  filtro: FiltroDePedidos,
): Promise<PaginaDePedidos> {
  const parametros: Record<string, string> = { pagina: String(filtro.pagina ?? 1) }
  if (filtro.busca?.tipo === 'numero') parametros.numero = filtro.busca.valor
  if (filtro.busca?.tipo === 'cpfCnpj') parametros.cpf_cnpj = filtro.busca.valor
  if (filtro.busca?.tipo === 'cliente') parametros.cliente = filtro.busca.valor
  if (filtro.situacao) parametros.situacao = filtro.situacao
  if (filtro.dataInicial) parametros.dataInicial = filtro.dataInicial
  if (filtro.dataFinal) parametros.dataFinal = filtro.dataFinal
  return lerPaginaDePedidos(await chamar(conta, 'pedidos.pesquisa.php', parametros))
}

/**
 * A busca do Tiny devolve do mais antigo para o mais novo, e a primeira página
 * é a de meses atrás. Aqui a página 1 é a dos mais novos, sempre cheia: ela
 * junta a última página de lá, que vem incompleta, com o fim da penúltima.
 * Custa até quatro chamadas por página quando a busca tem várias.
 */
export async function pesquisarPedidosRecentesPrimeiro(
  conta: ContaTiny,
  filtro: FiltroDePedidos,
): Promise<PaginaDePedidos> {
  const primeira = await pesquisarPedidos(conta, { ...filtro, pagina: 1 })
  if (primeira.paginas <= 1) {
    return { pedidos: [...primeira.pedidos].reverse(), pagina: 1, paginas: 1 }
  }
  // A primeira página de uma busca com várias vem cheia: é o tamanho de lá.
  const porPagina = primeira.pedidos.length
  const lidas = new Map<number, PaginaDePedidos>([[1, primeira]])
  const ler = async (n: number) => {
    if (!lidas.has(n)) lidas.set(n, await pesquisarPedidos(conta, { ...filtro, pagina: n }))
    return lidas.get(n)!
  }
  const ultima = await ler(primeira.paginas)
  const { paginas, trechos } = trechosDosMaisNovos(
    filtro.pagina ?? 1,
    primeira.paginas,
    porPagina,
    ultima.pedidos.length,
  )
  const pedidos = []
  for (const t of trechos) pedidos.push(...(await ler(t.paginaTiny)).pedidos.slice(t.de, t.ate))
  return {
    pedidos: pedidos.reverse(),
    pagina: Math.min(Math.max(1, filtro.pagina ?? 1), paginas),
    paginas,
  }
}

export async function detalharPedido(conta: ContaTiny, id: string): Promise<DetalheDoPedido> {
  const r = await chamar(conta, 'pedido.obter.php', { id })
  if (r.vazio || !r.pedido) throw new ErroDoTiny('O Tiny não achou este pedido.', 20)
  return lerDetalheDoPedido(r.pedido as Record<string, unknown>)
}

// ---------------------------------------------------------------------------
// Estoque
// ---------------------------------------------------------------------------

export async function pesquisarProdutosPorPagina(
  conta: ContaTiny,
  pesquisa: string,
  pagina = 1,
): Promise<PaginaDeProdutos> {
  const r = await chamar(conta, 'produtos.pesquisa.php', { pesquisa, pagina: String(pagina) })
  return lerPaginaDeProdutos(r)
}

export async function obterEstoque(conta: ContaTiny, id: string): Promise<EstoqueDoProduto> {
  const r = await chamar(conta, 'produto.obter.estoque.php', { id })
  if (r.vazio || !r.produto) throw new ErroDoTiny('O Tiny não achou este produto.', 20)
  return lerEstoque(r.produto as Record<string, unknown>)
}

/** A foto é enfeite: se a chamada falhar, a tela segue sem ela. */
export async function obterImagemDoProduto(conta: ContaTiny, id: string): Promise<string | null> {
  try {
    const r = await chamar(conta, 'produto.obter.php', { id })
    return r.produto ? imagemDoProduto(r.produto as Record<string, unknown>) : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Contatos: leitura. A escrita vai pela fila de contatos.
// ---------------------------------------------------------------------------

export async function pesquisarContatos(
  conta: ContaTiny,
  filtro: {
    pesquisa?: string
    cpfCnpj?: string
    pagina?: number
  },
): Promise<PaginaDeContatos> {
  const parametros: Record<string, string> = { pagina: String(filtro.pagina ?? 1) }
  if (filtro.pesquisa) parametros.pesquisa = filtro.pesquisa
  if (filtro.cpfCnpj) parametros.cpf_cnpj = filtro.cpfCnpj
  return lerPaginaDeContatos(await chamar(conta, 'contatos.pesquisa.php', parametros))
}

export async function obterContato(conta: ContaTiny, id: string): Promise<ContatoDoTiny> {
  const r = await chamar(conta, 'contato.obter.php', { id })
  if (r.vazio || !r.contato) throw new ErroDoTiny('O Tiny não achou este contato.', 20)
  return lerContato(r.contato as Record<string, unknown>)
}

/** Inclui ou altera um contato. Só a fila chama: escrita no Tiny passa por ela. */
export async function gravarContato(
  conta: ContaTiny,
  contato: ContatoParaOTiny,
): Promise<{ id: string }> {
  const endpoint = contato.id ? 'contato.alterar.php' : 'contato.incluir.php'
  const r = await chamar(conta, endpoint, { contato: JSON.stringify({ contatos: [{ contato }] }) })
  const [registro] = listaDe(r.registros, 'registro')
  // Com um contato só, o Tiny às vezes diz OK no geral e Erro no registro.
  if (registro && texto(registro.status).toLowerCase() === 'erro') {
    throw new ErroDoTiny(
      coletarErros(registro) || 'O Tiny recusou o contato.',
      Number(registro.codigo_erro) || null,
    )
  }
  return { id: texto(registro?.id) || texto(contato.id) }
}
