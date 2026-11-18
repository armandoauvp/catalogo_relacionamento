import { MotivoEnvio, Prisma } from '@prisma/client'
import { LIMITE_DA_SAUDACAO } from './carta'

/**
 * Leitura das solicitações que vinham pelo formulário do ClickUp ("Solicitação
 * de compra | CX"), para a importação de uma vez em `scripts/importar-clickup.ts`.
 *
 * O formulário guardava o endereço em texto livre e o motivo como a primeira
 * linha da descrição. Aqui mora só o que dá para ler com segurança; o que não
 * der fica com a tarefa, e o texto original vai junto na observação.
 */

/** Marca gravada na observação: é ela que impede importar a mesma tarefa duas vezes. */
export function marcaDoClickUp(idDaTarefa: string): string {
  return `[ClickUp ${idDaTarefa}]`
}

/** CEP em qualquer formato: 89056-098, 89.056-098 ou 35995000. */
export function cepDoTexto(texto: string): string | null {
  const achado = texto.match(/(?<!\d)(\d{2})\.?(\d{3})-?(\d{3})(?!\d)/)
  return achado ? `${achado[1]}${achado[2]}${achado[3]}` : null
}

/**
 * O número da casa, na ordem em que a escrita é mais confiável: depois de "nº"
 * ou "Nr."; "S/N" escrito; depois de uma vírgula; e, por fim, o primeiro
 * número solto ("Rua Antônio Bolfe 316"). Aceita o "1-75" de Bauru.
 */
export function numeroDoTexto(texto: string): string {
  const semCep = texto.replace(/(?<!\d)\d{2}\.?\d{3}-?\d{3}(?!\d)/g, '')
  const numero = String.raw`(\d{1,5}(?:-\d{1,4})?[A-Za-z]?)\b`
  const marcado = semCep.match(new RegExp(String.raw`\bn(?:[º°o]|r)\.?\s*` + numero, 'i'))
  if (marcado) return marcado[1]!
  if (/\bs\/n\b/i.test(semCep)) return 'S/N'
  const depoisDaVirgula = semCep.match(new RegExp(String.raw`,\s*` + numero))
  if (depoisDaVirgula) return depoisDaVirgula[1]!
  const solto = semCep.match(new RegExp(String.raw`\b` + numero))
  return solto ? solto[1]! : 'S/N'
}

/**
 * O trecho que descreve apartamento, bloco, casa ou sala. Só vale com número
 * ("apto 61", "Casa 07"): sozinho, "AP" costuma ser a sigla do Amapá.
 */
export function complementoDoTexto(texto: string): string | null {
  const achado = texto.match(
    /\b(?:ap(?:to|t|artamento)?|bloco|bl|casa|sala|torre|lote|conj(?:unto)?)[º°.]*[ \t]*\d[\w/-]*(?:[ \t]+(?:bloco|bl|torre)\.?[ \t]*\w+)?/i,
  )
  return achado ? achado[0].trim() : null
}

/** O logradouro escrito à mão: o texto até a primeira vírgula. */
export function logradouroDoTexto(texto: string): string {
  return (texto.split(/[,\n]/, 1)[0] ?? '').trim()
}

/**
 * O motivo do envio pela linha que o consultor escreveu. O que não casa com
 * nenhum vira "outro", com o texto dele.
 */
export function motivoDoTexto(linha: string | null): {
  motivo: MotivoEnvio
  motivoOutro: string | null
} {
  const texto = (linha ?? '').trim()
  const t = texto.toLowerCase()
  if (/anivers/.test(t)) return { motivo: MotivoEnvio.aniversario, motivoOutro: null }
  if (/casament|noiv|bodas/.test(t)) return { motivo: MotivoEnvio.casamento, motivoOutro: null }
  if (/nasc|beb[eê]|filh[oa]|maternidade|gesta/.test(t)) {
    return { motivo: MotivoEnvio.nascimento, motivoOutro: null }
  }
  if (/milh[aã]o/.test(t)) return { motivo: MotivoEnvio.primeiro_milhao, motivoOutro: null }
  if (/relacionamento|refor[cç]o|private/.test(t)) {
    return { motivo: MotivoEnvio.reforco_relacionamento, motivoOutro: null }
  }
  return { motivo: MotivoEnvio.outro, motivoOutro: texto.slice(0, 200) || 'Importada do ClickUp' }
}

/**
 * A carta do formulário vinha inteira, saudação inclusive. Uma primeira linha
 * curta que termina em vírgula ou exclamação ("Adriel,") é a saudação; fora
 * isso a carta fica inteira no corpo, sem saudação.
 */
export function separarSaudacao(carta: string): { saudacao: string; corpo: string } {
  const texto = carta.trim()
  const [primeira = '', ...resto] = texto.split('\n')
  const linha = primeira.trim()
  const ehSaudacao = resto.length > 0 && linha.length <= LIMITE_DA_SAUDACAO && /[,!]$/.test(linha)
  return ehSaudacao
    ? { saudacao: linha, corpo: resto.join('\n').trim() }
    : { saudacao: '', corpo: texto }
}

/** Valor em reais: "113.21", "1.234,56" ou "R$ 120". Nulo quando não é número. */
export function valorDoTexto(texto: string | null | undefined): string | null {
  if (!texto) return null
  let limpo = texto.replace(/[^\d,.]/g, '')
  if (limpo.includes(',')) limpo = limpo.replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null
  return limpo
}

/**
 * O valor de cada item quando o pedido do ClickUp é quebrado em vários. Item
 * do catálogo traz o preço do banco (`fixos`); o único item sem preço fica com
 * o que sobra do valor aprovado. Dois itens sem preço não têm como ser
 * divididos: quem decide é a área, não uma conta.
 */
export function valoresDosItens(
  total: string,
  fixos: readonly (string | null)[],
): string[] | string {
  const livres = fixos.filter((v) => v === null).length
  if (livres > 1) return 'Mais de um item sem valor: falta dizer quanto é cada um.'
  const soma = fixos.reduce((acc, v) => acc.plus(v ?? 0), new Prisma.Decimal(0))
  const resto = new Prisma.Decimal(total).minus(soma)
  if (livres === 1 && resto.isNegative()) {
    return `Os itens do catálogo somam R$ ${soma.toFixed(2)}, mais que os R$ ${total} aprovados.`
  }
  return fixos.map((v) => v ?? resto.toFixed(2))
}

/** O primeiro link do campo; o campo às vezes traz dois, separados por " e " ou "/". */
export function primeiroLink(texto: string | null | undefined): string | null {
  const achado = (texto ?? '').match(/https?:\/\/[^\s]+/)
  return achado ? achado[0] : null
}
