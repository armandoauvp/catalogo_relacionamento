import { env } from '@/lib/env'
import { cartoesDePostagem, lerResposta, normalizarCodigo, type ObjetoLido } from './leitura'

/**
 * Cliente da API Rastro dos Correios (CWS). Só roda no servidor: usuário,
 * código de acesso e cartão de postagem nunca vão ao navegador nem ao banco.
 *
 * Duas chamadas: o token, gerado com o cartão de postagem do contrato da AUVP
 * (`token/v1/autentica/cartaopostagem`, Basic com usuário e código de acesso),
 * e a consulta do objeto (`srorastro/v1/objetos/{codigo}?resultado=T`, todos
 * os eventos). A API só devolve objetos postados pelo próprio contrato.
 */

export class ErroDosCorreios extends Error {
  constructor(
    message: string,
    /** Status HTTP, para separar credencial errada (401/403) de queda. */
    readonly status: number | null,
  ) {
    super(message)
    this.name = 'ErroDosCorreios'
  }
}

const TEMPO_LIMITE_MS = 15_000
/** Sem a validade na resposta, um token vale pouco: gerar outro é barato. */
const VALIDADE_PADRAO_MS = 30 * 60_000

/** Um token por cartão: cada empresa posta com o seu, no mesmo contrato. */
const tokens = new Map<string, { valor: string; expiraEm: number }>()

async function token(cartao: string): Promise<string> {
  // Folga de um minuto: o token não expira no meio da consulta.
  const emUso = tokens.get(cartao)
  if (emUso && emUso.expiraEm - 60_000 > Date.now()) return emUso.valor

  const basico = Buffer.from(`${env.CORREIOS_USUARIO}:${env.CORREIOS_CODIGO_ACESSO}`).toString(
    'base64',
  )
  const resposta = await fetch(`${env.CORREIOS_API_URL}/token/v1/autentica/cartaopostagem`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basico}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ numero: cartao }),
    cache: 'no-store',
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  }).catch(() => null)
  if (!resposta) throw new ErroDosCorreios('Os Correios não responderam a tempo.', null)
  if (!resposta.ok) {
    throw new ErroDosCorreios(
      resposta.status === 401 || resposta.status === 403
        ? `Os Correios recusaram as credenciais do CWS (usuário, código de acesso ou o cartão ${cartao}).`
        : `Os Correios responderam HTTP ${resposta.status} ao gerar o token.`,
      resposta.status,
    )
  }
  const corpo = (await resposta.json().catch(() => null)) as {
    token?: string
    expiraEm?: string
  } | null
  if (!corpo?.token) throw new ErroDosCorreios('Os Correios não devolveram o token.', null)

  const expira = corpo.expiraEm ? new Date(corpo.expiraEm).getTime() : NaN
  tokens.set(cartao, {
    valor: corpo.token,
    expiraEm: Number.isNaN(expira) ? Date.now() + VALIDADE_PADRAO_MS : expira,
  })
  return corpo.token
}

/** Uma consulta com o token de um cartão. */
async function consultarCom(cartao: string, alvo: string): Promise<ObjetoLido> {
  const chamar = async () =>
    fetch(`${env.CORREIOS_API_URL}/srorastro/v1/objetos/${encodeURIComponent(alvo)}?resultado=T`, {
      headers: { Authorization: `Bearer ${await token(cartao)}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    }).catch(() => null)

  let resposta = await chamar()
  // Token vencido antes da hora: um novo, uma vez só.
  if (resposta?.status === 401) {
    tokens.delete(cartao)
    resposta = await chamar()
  }
  if (!resposta) throw new ErroDosCorreios('Os Correios não responderam a tempo.', null)
  // 404 é objeto que os Correios não conhecem, e 403, objeto de outro cartão:
  // os dois são resposta, e o próximo cartão pode conhecê-lo.
  if (resposta.status === 404 || resposta.status === 403) {
    return { codigo: alvo, eventos: [], erro: 'Os Correios não acharam este objeto.' }
  }
  if (!resposta.ok) {
    throw new ErroDosCorreios(
      `Os Correios responderam HTTP ${resposta.status} ao rastreio.`,
      resposta.status,
    )
  }
  const [objeto] = lerResposta(await resposta.json().catch(() => null))
  if (!objeto) return { codigo: alvo, eventos: [], erro: 'Os Correios não trouxeram este objeto.' }
  return { ...objeto, codigo: alvo }
}

/**
 * O histórico de um objeto, com todos os eventos. Cada empresa da AUVP posta
 * com o próprio cartão, e a API só mostra o objeto ao cartão dele: tenta um
 * por um, na ordem da variável, até um conhecer o objeto.
 */
export async function consultarObjeto(codigo: string): Promise<ObjetoLido> {
  const alvo = normalizarCodigo(codigo)
  let ultimo: ObjetoLido = { codigo: alvo, eventos: [], erro: 'Nenhum cartão de postagem.' }
  for (const cartao of cartoesDePostagem(env.CORREIOS_CARTAO_POSTAGEM)) {
    ultimo = await consultarCom(cartao, alvo)
    if (ultimo.eventos.length) return ultimo
  }
  return ultimo
}
