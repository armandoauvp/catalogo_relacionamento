import { Prisma, SituacaoNoFornecedor } from '@prisma/client'
import { db } from './db'
import { lerOferta, type OfertaLida } from './oferta-do-fornecedor'

/**
 * A conferência diária do fornecedor: abre o `urlCompra` de cada produto ativo
 * e grava o preço e a disponibilidade que a loja publica.
 *
 * Só informa. O catálogo avisa o consultor do esgotado e mostra ao Admin a
 * diferença de preço; desativar o presente ou trocar o preço é decisão dele.
 * O preço da loja pode ser só de uma parte do kit (a cerveja do kit de
 * cerveja), e o daqui pode incluir frete: igualar sozinho erraria nos dois.
 */

/** Conferido há menos que isto, fica para a próxima rodada. */
const VALIDADE_MS = 20 * 3_600_000
const TEMPO_DA_PAGINA_MS = 12_000
const PAGINAS_AO_MESMO_TEMPO = 4
/** Página de produto passa de 1 MB com folga; mais que isto não é página de produto. */
const TAMANHO_MAXIMO = 4 * 1024 * 1024

export type ResultadoDaConferencia = {
  situacao: SituacaoNoFornecedor
  preco: string | null
  erro: string | null
}

/** O que a leitura vira no banco: sem situação lida, "não conferido" com o motivo. */
export function resultadoDaLeitura(oferta: OfertaLida): ResultadoDaConferencia {
  if (oferta.situacao) return { situacao: oferta.situacao, preco: oferta.preco, erro: null }
  return {
    situacao: SituacaoNoFornecedor.nao_conferido,
    preco: oferta.preco,
    erro: 'A loja não publica preço e estoque de um jeito que dê para ler; confira pelo link.',
  }
}

/**
 * O link foi digitado por um Admin, mas quem o abre é o servidor: endereço
 * interno não é página de loja.
 */
export function enderecoPermitido(url: string): boolean {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
  const host = u.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    return false
  }
  // IPv4 privado e de loopback; IPv6 entre colchetes.
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)) return false
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false
  return !host.startsWith('[')
}

async function lerPagina(url: string): Promise<ResultadoDaConferencia> {
  const naoConferido = (erro: string): ResultadoDaConferencia => ({
    situacao: SituacaoNoFornecedor.nao_conferido,
    preco: null,
    erro,
  })
  if (!enderecoPermitido(url)) return naoConferido('O link de compra não é um endereço de loja.')

  try {
    const resposta = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; CatalogoAUVP/1.0; conferencia de estoque)',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'pt-BR,pt;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(TEMPO_DA_PAGINA_MS),
      cache: 'no-store',
    })
    if (!resposta.ok) {
      return naoConferido(
        resposta.status === 404
          ? 'O link de compra não existe mais (a loja respondeu 404).'
          : `A loja respondeu ${resposta.status}.`,
      )
    }
    const html = await resposta.text()
    if (html.length > TAMANHO_MAXIMO) return naoConferido('A página é grande demais para ler.')
    return resultadoDaLeitura(lerOferta(html))
  } catch (e) {
    const tempo = e instanceof Error && e.name === 'TimeoutError'
    return naoConferido(tempo ? 'A loja demorou demais para responder.' : 'A loja não respondeu.')
  }
}

async function gravar(produtoId: string, r: ResultadoDaConferencia, agora: Date) {
  await db.produto.update({
    where: { id: produtoId },
    data: {
      fornecedorSituacao: r.situacao,
      // O preço anterior fica quando a leitura falha: ainda é a melhor notícia.
      ...(r.preco ? { fornecedorPreco: new Prisma.Decimal(r.preco) } : {}),
      fornecedorConferidoEm: agora,
      fornecedorErro: r.erro,
    },
  })
}

/** O botão "Conferir agora" do Admin, logo depois de trocar o link. */
export async function conferirProduto(produtoId: string, agora = new Date()) {
  const produto = await db.produto.findUniqueOrThrow({
    where: { id: produtoId },
    select: { urlCompra: true },
  })
  if (!produto.urlCompra?.trim()) {
    await db.produto.update({
      where: { id: produtoId },
      data: {
        fornecedorSituacao: null,
        fornecedorPreco: null,
        fornecedorConferidoEm: null,
        fornecedorErro: null,
      },
    })
    return null
  }
  const r = await lerPagina(produto.urlCompra.trim())
  await gravar(produtoId, r, agora)
  return r
}

export type RodadaDoFornecedor = { conferidos: number; esgotados: number; naoConferidos: number }

/**
 * Os produtos ativos com link, o que está há mais tempo sem conferir primeiro,
 * até o prazo acabar. O que sobrar fica para a próxima chamada.
 */
export async function conferirFornecedores({
  prazoMs,
  agora = () => new Date(),
}: {
  prazoMs: number
  agora?: () => Date
}): Promise<RodadaDoFornecedor> {
  const fim = Date.now() + prazoMs
  const fila = await db.produto.findMany({
    where: {
      ativo: true,
      urlCompra: { not: null },
      OR: [
        { fornecedorConferidoEm: null },
        { fornecedorConferidoEm: { lt: new Date(agora().getTime() - VALIDADE_MS) } },
      ],
    },
    orderBy: { fornecedorConferidoEm: { sort: 'asc', nulls: 'first' } },
    select: { id: true, urlCompra: true },
  })

  const rodada: RodadaDoFornecedor = { conferidos: 0, esgotados: 0, naoConferidos: 0 }
  const trabalhador = async () => {
    // Deixa folga para a última página que começar terminar dentro do prazo.
    while (fila.length && Date.now() + TEMPO_DA_PAGINA_MS < fim) {
      const p = fila.shift()!
      const url = p.urlCompra?.trim()
      if (!url) continue
      const r = await lerPagina(url)
      await gravar(p.id, r, agora())
      rodada.conferidos++
      if (r.situacao === SituacaoNoFornecedor.esgotado) rodada.esgotados++
      if (r.situacao === SituacaoNoFornecedor.nao_conferido) rodada.naoConferidos++
    }
  }
  await Promise.all(Array.from({ length: PAGINAS_AO_MESMO_TEMPO }, trabalhador))
  return rodada
}
