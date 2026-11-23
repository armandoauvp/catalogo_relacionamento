/**
 * Leitura da resposta da API Rastro dos Correios (CWS, `srorastro/v1`).
 *
 * O formato não está em documentação pública: o Swagger exige login no CWS.
 * Os nomes abaixo são os que as integrações conhecidas usam
 * (`objetos[].eventos[]` com `codigo`, `tipo`, `dtHrCriado`, `descricao`,
 * `unidade.endereco`). Por isso a leitura é tolerante: campo que falta vira
 * nulo, e evento sem data ou descrição é descartado em vez de derrubar a
 * consulta. Ver docs/15-rastreio.md.
 */

export type EventoLido = {
  ocorridoEm: Date
  codigo: string
  tipo: string
  descricao: string
  local: string | null
  destino: string | null
}

export type ObjetoLido =
  | { codigo: string; eventos: EventoLido[]; erro: null }
  | { codigo: string; eventos: []; erro: string }

type Bruto = Record<string, unknown>

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const objeto = (v: unknown): Bruto => (v && typeof v === 'object' ? (v as Bruto) : {})

/**
 * Os cartões de postagem da variável, um por empresa: "0012345678, 0087654321".
 * Vírgula, ponto e vírgula ou espaço separam; só dígitos contam; repetido sai.
 */
export function cartoesDePostagem(texto: string | null | undefined): string[] {
  return [
    ...new Set(
      (texto ?? '')
        .split(/[\s,;]+/)
        .map((c) => c.replace(/\D/g, ''))
        .filter(Boolean),
    ),
  ]
}

/** Código de objeto dos Correios: duas letras, nove dígitos, duas letras. */
export function ehCodigoDosCorreios(codigo: string | null | undefined): boolean {
  return /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(normalizarCodigo(codigo))
}

export function normalizarCodigo(codigo: string | null | undefined): string {
  return (codigo ?? '').replace(/\s+/g, '').toUpperCase()
}

/**
 * "2026-10-28T12:51:35" vem sem fuso e é hora de Brasília; com fuso, vale o
 * dele. São Paulo não tem horário de verão desde 2019.
 */
export function dataDosCorreios(valor: unknown): Date | null {
  const v = texto(valor)
  if (!v) return null
  const temFuso = /(Z|[+-]\d{2}:?\d{2})$/.test(v)
  const d = new Date(temFuso ? v : `${v}-03:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "Unidade de Distribuição - NOVA IGUACU - RJ", como a tela do Tiny mostra. */
function localDa(unidade: unknown): string | null {
  const u = objeto(unidade)
  const e = objeto(u.endereco)
  const partes = [texto(u.tipo) || texto(u.nome), texto(e.cidade), texto(e.uf)].filter(Boolean)
  return partes.length ? partes.join(' - ') : null
}

export function lerEvento(bruto: unknown): EventoLido | null {
  const e = objeto(bruto)
  const ocorridoEm = dataDosCorreios(e.dtHrCriado ?? e.data)
  const descricao = texto(e.descricao)
  if (!ocorridoEm || !descricao) return null
  return {
    ocorridoEm,
    codigo: texto(e.codigo),
    tipo: texto(e.tipo),
    descricao,
    local: localDa(e.unidade),
    destino: localDa(e.unidadeDestino),
  }
}

/**
 * Um objeto da resposta. "SRO-020: Objeto não encontrado" vem como mensagem
 * no lugar dos eventos, e é erro do objeto, não da consulta.
 */
export function lerObjeto(bruto: unknown): ObjetoLido {
  const o = objeto(bruto)
  const codigo = normalizarCodigo(texto(o.codObjeto))
  const eventos = (Array.isArray(o.eventos) ? o.eventos : [])
    .map(lerEvento)
    .filter((e): e is EventoLido => e !== null)
  const mensagem = texto(o.mensagem)
  if (!eventos.length && mensagem) return { codigo, eventos: [], erro: mensagem }
  return { codigo, eventos, erro: null }
}

export function lerResposta(bruto: unknown): ObjetoLido[] {
  const r = objeto(bruto)
  return (Array.isArray(r.objetos) ? r.objetos : []).map(lerObjeto)
}

/**
 * Entregue: "BDE", "BDI" e "BDR" de tipo "01" ou "23" são a baixa de entrega
 * nos Correios. A descrição entra junto porque o código depende de um formato
 * não documentado em público, e "entregue ao destinatário" não deixa dúvida.
 */
export function ehEntrega(e: Pick<EventoLido, 'codigo' | 'tipo' | 'descricao'>): boolean {
  if (['BDE', 'BDI', 'BDR'].includes(e.codigo) && ['01', '23'].includes(e.tipo)) return true
  return /entregue ao destinat[aá]rio/i.test(e.descricao)
}

/** Quando foi entregue, pelo evento de entrega mais recente; nulo se ainda não foi. */
export function entregueEm(eventos: readonly EventoLido[]): Date | null {
  const entregas = eventos.filter(ehEntrega).map((e) => e.ocorridoEm.getTime())
  return entregas.length ? new Date(Math.max(...entregas)) : null
}

/** Do mais novo para o mais antigo, como a linha do tempo mostra. */
export function maisNovosPrimeiro<T extends { ocorridoEm: Date }>(eventos: readonly T[]): T[] {
  return [...eventos].sort((a, b) => b.ocorridoEm.getTime() - a.ocorridoEm.getTime())
}
