/**
 * Filtrar uma tabela clicando no grupo de uma linha (status, categoria,
 * etiqueta...). A regra é uma só para todas as telas:
 *
 * - um valor por coluna: clicar em outro grupo da mesma coluna troca o filtro;
 * - clicar no grupo já filtrado tira o filtro;
 * - os outros filtros da URL ficam, e a paginação volta para a primeira.
 *
 * Pura, para servir a página de servidor e a tabela de cliente.
 */

export type ParametrosDaUrl = Record<string, string | string[] | undefined>

/** Parâmetros que não são filtro e que mudar o filtro invalida. */
const ZERAM_COM_O_FILTRO = ['pagina']

function semVazios(params: ParametrosDaUrl): [string, string][] {
  return Object.entries(params).flatMap(([chave, valor]) =>
    (Array.isArray(valor) ? valor : [valor])
      .filter((v): v is string => typeof v === 'string' && v !== '')
      .map((v) => [chave, v] as [string, string]),
  )
}

export function valorDoFiltro(params: ParametrosDaUrl, chave: string): string | undefined {
  const valor = params[chave]
  return Array.isArray(valor) ? valor[0] : valor || undefined
}

/** O endereço com o filtro `chave=valor` ligado, ou desligado se já estava. */
export function hrefDoGrupo(
  caminho: string,
  params: ParametrosDaUrl,
  chave: string,
  valor: string,
): string {
  const ativo = valorDoFiltro(params, chave) === valor
  const q = new URLSearchParams(
    semVazios(params).filter(([c]) => c !== chave && !ZERAM_COM_O_FILTRO.includes(c)),
  )
  if (!ativo) q.set(chave, valor)
  const s = q.toString()
  return s ? `${caminho}?${s}` : caminho
}

/** O endereço sem o filtro da chave: o "×" da linha "Filtrando por". */
export function hrefSemFiltro(caminho: string, params: ParametrosDaUrl, chave: string): string {
  const q = new URLSearchParams(
    semVazios(params).filter(([c]) => c !== chave && !ZERAM_COM_O_FILTRO.includes(c)),
  )
  const s = q.toString()
  return s ? `${caminho}?${s}` : caminho
}
