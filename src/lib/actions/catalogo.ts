'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { autorizarAction } from '@/lib/auth-guards'
import { fotoDoFormulario } from '@/lib/arquivos'
import { produtoSchema, categoriaSchema } from '@/lib/validators/produto'
import { tinyConfigurado } from '@/lib/env'
import { pesquisarProdutos } from '@/lib/tiny/api'
import { ErroDoTiny } from '@/lib/tiny/erros'
import { conferirSku, lerPlanilhaDeSkus, type ConferenciaDoSku } from '@/lib/tiny/skus'
import { comoErro, primeiroErro, type ResultadoDaAction } from './comuns'

/**
 * CRUD do catálogo.
 *
 * Requisito de primeira ordem da spec: a área de Relacionamento cadastra,
 * edita e desativa produto sem passar pelo time técnico.
 *
 * Produto **nunca é excluído**. Uma solicitação antiga precisa continuar
 * legível como foi criada, e o item aponta para o produto. Desativar tira do
 * catálogo do consultor e deixa o histórico intacto.
 */

function revalidarCatalogo() {
  revalidatePath('/admin/catalogo')
  revalidatePath('/catalogo')
  revalidatePath('/solicitacoes/nova')
}

/** Campos do formulário, já no formato que o schema espera. */
function comoProduto(dados: FormData, fotoUrl: string | null) {
  return {
    nome: String(dados.get('nome') ?? ''),
    descricao: dados.get('descricao'),
    categoriaId: String(dados.get('categoriaId') ?? ''),
    fotoUrl,
    valor: String(dados.get('valor') ?? ''),
    tipoValor: String(dados.get('tipoValor') ?? 'exato'),
    origem: String(dados.get('origem') ?? 'mediante_pedido'),
    controlaEstoque: dados.get('controlaEstoque') === 'on',
    estoque: dados.get('estoque'),
    urlCompra: dados.get('urlCompra'),
    notaDeCompra: dados.get('notaDeCompra'),
    exigeAcompanhamento: dados.get('exigeAcompanhamento'),
    serveComoAcompanhamento: dados.get('serveComoAcompanhamento'),
    ativo: dados.get('ativo') !== 'off',
    skuTiny: dados.get('skuTiny'),
  }
}

export async function salvarProduto(dados: FormData): Promise<ResultadoDaAction<{ id: string }>> {
  try {
    const usuario = await autorizarAction('catalogo.gerenciar')

    const foto = await fotoDoFormulario(dados, usuario.id)
    if (!foto.ok) return { ok: false, erro: foto.erro, campo: 'foto' }

    // A URL interna não passa por `urlOpcional`, que exige URL absoluta.
    const urlRelativa = foto.url?.startsWith('/') ? foto.url : null

    const validado = produtoSchema.safeParse(comoProduto(dados, urlRelativa ? null : foto.url))
    if (!validado.success) return primeiroErro(validado.error)

    const id = String(dados.get('id') ?? '')
    // Só confere quando o SKU muda: editar a foto não pode depender do Tiny.
    const anterior = id
      ? await db.produto.findUnique({ where: { id }, select: { skuTiny: true } })
      : null
    let nomeNoTiny: { nomeNoTiny: string | null } | null = null
    if (validado.data.skuTiny !== anterior?.skuTiny) {
      const conferencia = await conferirNoTiny(validado.data.skuTiny)
      if (!conferencia.ok) return { ok: false, erro: conferencia.erro, campo: 'skuTiny' }
      nomeNoTiny = { nomeNoTiny: conferencia.nomeNoTiny || null }
    }

    const valores = {
      ...validado.data,
      ...nomeNoTiny,
      fotoUrl: urlRelativa ?? validado.data.fotoUrl,
      // Nulo é "a área ainda não informou", e segue nulo até ela informar.
      valor: validado.data.valor === null ? null : new Prisma.Decimal(validado.data.valor),
      // Produto que não controla estoque não guarda quantidade: um número
      // parado ali seria lido como disponibilidade real.
      estoque: validado.data.controlaEstoque ? validado.data.estoque : null,
    }

    const produto = id
      ? await db.produto.update({ where: { id }, data: valores, select: { id: true } })
      : await db.produto.create({ data: valores, select: { id: true } })

    revalidarCatalogo()
    return { ok: true, dados: { id: produto.id } }
  } catch (e) {
    return comoErro(e)
  }
}

/**
 * Procura o SKU no Tiny. Sem token (desenvolvimento, demonstração) não há o
 * que conferir, e o SKU passa como veio.
 */
async function conferirNoTiny(sku: string): Promise<ConferenciaDoSku> {
  if (!tinyConfigurado) return { ok: true, nomeNoTiny: '' }
  try {
    return conferirSku(sku, await pesquisarProdutos(sku.trim()))
  } catch (e) {
    if (!(e instanceof ErroDoTiny)) throw e
    return {
      ok: false,
      erro: `Não deu para conferir o SKU no Tiny agora: ${e.message} Tente de novo.`,
    }
  }
}

/** Uma conferência por vez: a tela de importação chama em sequência, no ritmo do Tiny. */
export async function conferirSkuNoTiny(
  sku: string,
): Promise<ResultadoDaAction<ConferenciaDoSku & { limite: boolean }>> {
  try {
    await autorizarAction('catalogo.gerenciar')
    if (!tinyConfigurado) return { ok: true, dados: { ok: true, nomeNoTiny: '', limite: false } }
    try {
      return {
        ok: true,
        dados: { ...conferirSku(sku, await pesquisarProdutos(sku.trim())), limite: false },
      }
    } catch (e) {
      if (!(e instanceof ErroDoTiny)) throw e
      // 6 e 11 são o bloqueio de um minuto por excesso de chamadas: a tela espera e repete.
      const limite = e.codigo === 6 || e.codigo === 11
      return { ok: true, dados: { ok: false, erro: e.message, limite } }
    }
  } catch (e) {
    return comoErro(e)
  }
}

/**
 * Grava os SKUs da planilha. O servidor lê a tabela de novo contra o catálogo
 * e só grava as linhas que a tela mandou, as que passaram na conferência do
 * Tiny. Conferir de novo aqui dobraria as chamadas, e o limite do Tiny é por
 * minuto: dezenas de SKUs não caberiam numa requisição.
 */
export async function gravarSkus(
  tabela: string[][],
  linhasConferidas: { linha: number; nomeNoTiny: string }[],
): Promise<ResultadoDaAction<{ gravados: number }>> {
  try {
    await autorizarAction('catalogo.gerenciar')
    const catalogo = await db.produto.findMany({ select: { id: true, nome: true, skuTiny: true } })
    // O nome vem da conferência que a tela fez no Tiny; só serve para exibir.
    const conferidas = new Map(linhasConferidas.map((c) => [c.linha, c.nomeNoTiny]))
    const gravar = lerPlanilhaDeSkus(tabela, catalogo).linhas.filter(
      (l) => !l.erro && l.produtoId && conferidas.has(l.linha),
    )
    await db.$transaction(
      gravar.map((l) =>
        db.produto.update({
          where: { id: l.produtoId! },
          data: { skuTiny: l.sku, nomeNoTiny: conferidas.get(l.linha)?.slice(0, 200) || null },
        }),
      ),
    )
    revalidarCatalogo()
    return { ok: true, dados: { gravados: gravar.length } }
  } catch (e) {
    return comoErro(e)
  }
}

/**
 * Ativa ou desativa um produto.
 *
 * É o que existe no lugar de excluir. O desativado some do catálogo do
 * consultor e continua aparecendo nas solicitações que já o usaram.
 */
export async function alternarProduto(id: string, ativo: boolean): Promise<ResultadoDaAction> {
  try {
    await autorizarAction('catalogo.gerenciar')
    await db.produto.update({ where: { id }, data: { ativo } })
    revalidarCatalogo()
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}

export async function salvarCategoria(dados: FormData): Promise<ResultadoDaAction> {
  try {
    await autorizarAction('catalogo.gerenciar')

    const validado = categoriaSchema.safeParse({
      nome: String(dados.get('nome') ?? ''),
      ativo: dados.get('ativo') !== 'off',
    })
    if (!validado.success) return primeiroErro(validado.error)

    const id = String(dados.get('id') ?? '')
    if (id) {
      await db.categoria.update({ where: { id }, data: validado.data })
    } else {
      await db.categoria.create({ data: validado.data })
    }

    revalidarCatalogo()
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}

/**
 * Desativa a categoria.
 *
 * Categoria com produto ativo não é desativada: os produtos sumiriam do
 * catálogo sem que ninguém tivesse pedido isso.
 */
export async function alternarCategoria(id: string, ativo: boolean): Promise<ResultadoDaAction> {
  try {
    await autorizarAction('catalogo.gerenciar')

    if (!ativo) {
      const ativos = await db.produto.count({ where: { categoriaId: id, ativo: true } })
      if (ativos > 0) {
        return {
          ok: false,
          erro: `Esta categoria tem ${ativos} ${ativos === 1 ? 'produto ativo' : 'produtos ativos'}. Desative os produtos antes.`,
        }
      }
    }

    await db.categoria.update({ where: { id }, data: { ativo } })
    revalidarCatalogo()
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}
