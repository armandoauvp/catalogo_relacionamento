/**
 * O SKU do catálogo confrontado com o cadastro do Tiny.
 *
 * O pedido liga o item ao produto de lá pelo código. Um SKU digitado errado
 * só apareceria quando o presente fosse aprovado; conferir no cadastro e na
 * importação traz o erro para quem está preenchendo.
 *
 * Pura: recebe o que a busca do Tiny devolveu e a tabela já lida da planilha.
 */

export type ProdutoAchadoNoTiny = {
  codigo: string
  nome: string
  /** "P" é o produto-pai de variações, "V" a variação, "N" o simples. */
  tipoVariacao: string
}

export type ConferenciaDoSku = { ok: true; nomeNoTiny: string } | { ok: false; erro: string }

const comparavel = (sku: string) => sku.trim().toLowerCase()

/**
 * A busca do Tiny procura o texto em qualquer parte do nome ou do código, então
 * o que volta precisa ter o código exatamente igual.
 */
export function conferirSku(
  sku: string,
  encontrados: readonly ProdutoAchadoNoTiny[],
): ConferenciaDoSku {
  const igual = encontrados.find((p) => comparavel(p.codigo) === comparavel(sku))
  if (!igual) {
    return {
      ok: false,
      erro: `O Tiny não tem produto com o SKU "${sku.trim()}". Cadastre o código lá (Cadastros → Produtos) e tente de novo.`,
    }
  }
  // O Tiny só vende a variação: o pai não tem estoque próprio.
  if (igual.tipoVariacao === 'P') {
    return {
      ok: false,
      erro: `"${sku.trim()}" é o produto-pai de "${igual.nome}", que tem variações. Use o SKU de uma das variações.`,
    }
  }
  return { ok: true, nomeNoTiny: igual.nome }
}

// ---------------------------------------------------------------------------
// Planilha de SKUs
// ---------------------------------------------------------------------------

const COLUNA_DO_PRESENTE = [
  'presente',
  'produto',
  'nome',
  'nome do produto',
  'presente no catalogo',
]
const COLUNA_DO_SKU = ['sku no tiny', 'sku', 'codigo', 'codigo (sku)', 'codigo no tiny', 'sku tiny']

/** Também serve para casar o nome da planilha com o do catálogo. */
export const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.:]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export type ProdutoDoCatalogo = { id: string; nome: string; skuTiny: string | null }

export type LinhaDeSku = {
  /** Número da linha como o Excel mostra, contando o cabeçalho. */
  linha: number
  presente: string
  sku: string
  produtoId: string | null
  /** O SKU que o produto tem hoje aqui, para a prévia mostrar a troca. */
  skuAtual: string | null
  erro: string | null
}

export type LeituraDeSkus = { linhas: LinhaDeSku[]; faltando: string[] }

/**
 * Uma linha por presente: o nome como está no catálogo e o SKU no Tiny. Linha
 * sem SKU é pulada em silêncio, para a planilha de correspondência poder ir
 * pela metade, só com o que já foi cadastrado lá.
 */
export function lerPlanilhaDeSkus(
  tabela: readonly (readonly string[])[],
  catalogo: readonly ProdutoDoCatalogo[],
): LeituraDeSkus {
  const indice = tabela.findIndex((linha) => {
    const cabecalho = linha.map((c) => normalizar(c ?? ''))
    return (
      cabecalho.some((c) => COLUNA_DO_PRESENTE.includes(c)) &&
      cabecalho.some((c) => COLUNA_DO_SKU.includes(c))
    )
  })
  if (indice < 0) return { linhas: [], faltando: ['Presente', 'SKU no Tiny'] }

  const cabecalho = tabela[indice]!.map((c) => normalizar(c ?? ''))
  // A ordem dos sinônimos decide quando a planilha tem mais de uma coluna
  // parecida: "SKU no Tiny" vence "Código", que no Olist é outra coisa.
  const coluna = (sinonimos: readonly string[]) =>
    sinonimos.map((s) => cabecalho.indexOf(s)).find((i) => i >= 0) ?? -1
  const colPresente = coluna(COLUNA_DO_PRESENTE)
  const colSku = coluna(COLUNA_DO_SKU)

  const porNome = new Map(catalogo.map((p) => [normalizar(p.nome), p]))
  const linhas: LinhaDeSku[] = []
  const vistos = new Map<string, number>()

  tabela.slice(indice + 1).forEach((celulas, i) => {
    const presente = (celulas?.[colPresente] ?? '').replace(/\s+/g, ' ').trim()
    const sku = (celulas?.[colSku] ?? '').trim()
    if (!sku) return

    const linha = indice + i + 2
    const produto = presente ? porNome.get(normalizar(presente)) : undefined
    let erro: string | null = null
    if (!presente) erro = 'Presente em branco.'
    else if (!produto) erro = 'Presente não encontrado no catálogo: confira o nome.'
    else if (sku.length > 60) erro = 'SKU com mais de 60 caracteres.'
    else if (vistos.has(produto.id))
      erro = `Presente repetido (também na linha ${vistos.get(produto.id)}).`

    if (produto && !vistos.has(produto.id)) vistos.set(produto.id, linha)
    linhas.push({
      linha,
      presente,
      sku,
      produtoId: produto?.id ?? null,
      skuAtual: produto?.skuTiny ?? null,
      erro,
    })
  })

  return { linhas, faltando: [] }
}
