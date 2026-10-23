'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import type { Prisma } from '@prisma/client'
import { autorizarAction } from '@/lib/auth-guards'
import { fimDoDiaLocal, formatarISO } from '@/lib/datas'
import { db } from '@/lib/db'
import { tinyConfigurado } from '@/lib/env'
import { clienteProvider, type EnderecoDoCliente } from '@/lib/providers'
import {
  listarTransportadoras,
  pesquisarContatos,
  pesquisarProdutos,
  type ProdutoDoTiny,
} from '@/lib/tiny/api'
import { classificarBusca } from '@/lib/tiny/leitura'
import {
  configuracaoTiny,
  marcarPassoDaExpedicao,
  processarFila,
  reenviarPedido,
  registrarEvento,
  sincronizarPedidos,
  type ResultadoDaRodada,
} from '@/lib/tiny/fila'
import { validarLinha } from '@/lib/tiny/lote'
import { chaveDoLote, montarPedido, resumoDosItens } from '@/lib/tiny/pedido'
import { configuracaoTinySchema, loteSchema, pedidoAvulsoSchema } from '@/lib/validators/tiny'
import { comoErro, primeiroErro, type ResultadoDaAction } from './comuns'

/**
 * Ações da integração com o Tiny. Todas exigem `tiny.operar` (Admin e
 * Logística); o token nunca sai do servidor.
 */

const SEM_TOKEN = 'O Tiny ainda não está ligado: falta o token na Vercel (TINY_API_TOKEN).'

function revalidarTiny(loteId?: string) {
  revalidatePath('/tiny')
  if (loteId) revalidatePath(`/tiny/lotes/${loteId}`)
}

/** Esvazia a fila depois da resposta, sem a tela esperar o Tiny. */
function processarDepois() {
  after(async () => {
    await processarFila({ prazoMs: 40_000 }).catch((e) => console.error('Fila do Tiny:', e))
  })
}

export async function buscarProdutosNoTiny(
  texto: string,
): Promise<ResultadoDaAction<ProdutoDoTiny[]>> {
  try {
    await autorizarAction('tiny.operar')
    if (!tinyConfigurado) return { ok: false, erro: SEM_TOKEN }
    const busca = texto.trim()
    if (busca.length < 3) return { ok: false, erro: 'Digite ao menos 3 letras do produto.' }
    return { ok: true, dados: (await pesquisarProdutos(busca)).slice(0, 30) }
  } catch (e) {
    if (e instanceof Error && e.name === 'ErroDoTiny') return { ok: false, erro: e.message }
    return comoErro(e)
  }
}

export async function buscarTransportadoras(): Promise<ResultadoDaAction<string[]>> {
  try {
    await autorizarAction('tiny.operar')
    if (!tinyConfigurado) return { ok: false, erro: SEM_TOKEN }
    return { ok: true, dados: await listarTransportadoras() }
  } catch (e) {
    if (e instanceof Error && e.name === 'ErroDoTiny') return { ok: false, erro: e.message }
    return comoErro(e)
  }
}

export type ResultadoDoLote = {
  loteId: string
  criados: number
  /** Linhas que já tinham virado pedido com o mesmo marcador e produto. */
  jaEnviados: { linha: number; nome: string }[]
}

/**
 * Grava o lote: cada linha vira um pedido na fila, e o lote inteiro uma
 * demanda na trilha da Logística, tudo na mesma transação. Quem já recebeu
 * este produto com este marcador é pulado: importar a mesma planilha de novo
 * não duplica nenhum pedido.
 */
export async function criarLote(entrada: unknown): Promise<ResultadoDaAction<ResultadoDoLote>> {
  try {
    const usuario = await autorizarAction('tiny.operar')
    if (!tinyConfigurado) return { ok: false, erro: SEM_TOKEN }

    const validado = loteSchema.safeParse(entrada)
    if (!validado.success) return primeiroErro(validado.error)
    const dados = validado.data
    // A pauta de 22/10/2026 exige SKU em todo pedido: sem ele o Tiny não liga o
    // item ao estoque.
    if (!dados.produto.codigo?.trim()) {
      return {
        ok: false,
        erro: 'O produto escolhido não tem SKU (código) no Tiny. Cadastre o código lá e busque de novo.',
      }
    }

    const linhas = dados.linhas.map((l) => ({ linha: l.linha, ...validarLinha(l.campos) }))
    const comErro = linhas.find((l) => l.erros.length)
    if (comErro) {
      return { ok: false, erro: `Linha ${comErro.linha}: ${comErro.erros.join(' ')}` }
    }
    const repetidos = new Set<string>()
    for (const l of linhas) {
      if (repetidos.has(l.destinatario.cpfCnpj)) {
        return { ok: false, erro: `Linha ${l.linha}: CPF/CNPJ repetido no lote.` }
      }
      repetidos.add(l.destinatario.cpfCnpj)
    }

    const comChave = linhas.map((l) => ({
      ...l,
      chave: chaveDoLote(dados.marcador, l.destinatario.cpfCnpj, dados.produto.codigo),
    }))
    const existentes = new Set(
      (
        await db.pedidoTiny.findMany({
          where: { chave: { in: comChave.map((l) => l.chave) } },
          select: { chave: true },
        })
      ).map((p) => p.chave),
    )
    const novas = comChave.filter((l) => !existentes.has(l.chave))
    const jaEnviados = comChave
      .filter((l) => existentes.has(l.chave))
      .map((l) => ({ linha: l.linha, nome: l.destinatario.nome }))

    if (novas.length === 0) {
      return {
        ok: false,
        erro: 'Todas as linhas já viraram pedido com este marcador e este produto.',
      }
    }

    // O preço do lote é o que a tela mandou, editável sobre o do Tiny; a
    // coluna de valor da planilha, quando existe, vale para a própria linha.
    const valorUnitario = Number(dados.produto.preco).toFixed(2)
    const agora = new Date()
    const totalDeItens = novas.reduce((s, l) => s + l.quantidade, 0)

    const loteId = await db.$transaction(async (tx) => {
      const demanda = await tx.demandaLogistica.create({
        data: {
          origem: 'manual',
          titulo: `Envio em lote · ${dados.marcador} (${novas.length} pedidos)`,
          subsidiaria: dados.subsidiaria,
          departamento: dados.departamento,
          produto: 'Envio em lote pelo Tiny',
          itens: [`${totalDeItens}× ${dados.produto.nome}`],
          fase: 'em_execucao',
          prioridade: 'normal',
          complexidade: novas.length > 30 ? 'alta' : 'media',
          responsavel: usuario.nome,
          solicitadaEm: agora,
          previsaoConclusao: fimDoDiaLocal(formatarISO(new Date(agora.getTime() + 7 * 86_400_000))),
          observacoes: dados.arquivo ? `Planilha: ${dados.arquivo}` : null,
        },
      })

      const lote = await tx.loteTiny.create({
        data: {
          marcador: dados.marcador,
          arquivo: dados.arquivo,
          sku: dados.produto.codigo,
          produto: dados.produto.nome,
          valorUnitario,
          transportadora: dados.transportadora,
          formaFrete: dados.formaFrete,
          subsidiaria: dados.subsidiaria,
          departamento: dados.departamento,
          criadoPorId: usuario.id,
          demandaId: demanda.id,
        },
      })

      await tx.pedidoTiny.createMany({
        data: novas.map((l) => {
          const itens = [
            {
              codigo: dados.produto.codigo,
              descricao: dados.produto.nome,
              quantidade: l.quantidade,
              valorUnitario: l.valorUnitario ?? valorUnitario,
            },
          ]
          return {
            origem: 'lote' as const,
            chave: l.chave,
            loteId: lote.id,
            linha: l.linha,
            destinatario: l.destinatario.nome,
            cpfCnpj: l.destinatario.cpfCnpj,
            resumo: resumoDosItens(itens),
            payload: montarPedido({
              destinatario: l.destinatario,
              itens,
              transportadora: dados.transportadora,
              formaFrete: dados.formaFrete,
              marcador: dados.marcador,
              observacao: `Envio em lote · ${dados.marcador}`,
            }) as unknown as Prisma.InputJsonValue,
          }
        }),
      })

      await registrarEvento(
        tx,
        null,
        'lote',
        `${usuario.nome} importou ${novas.length} pedidos (${dados.marcador})` +
          (jaEnviados.length ? `; ${jaEnviados.length} já tinham sido enviados.` : '.'),
        usuario.id,
      )
      return lote.id
    })

    processarDepois()
    revalidarTiny(loteId)
    revalidatePath('/logistica')
    return { ok: true, dados: { loteId, criados: novas.length, jaEnviados } }
  } catch (e) {
    return comoErro(e)
  }
}

export async function processarAgora(): Promise<ResultadoDaAction<ResultadoDaRodada>> {
  try {
    await autorizarAction('tiny.operar')
    if (!tinyConfigurado) return { ok: false, erro: SEM_TOKEN }
    // O botão espera a rodada: quem clicou quer ver o resultado.
    const resultado = await processarFila({ prazoMs: 40_000 })
    revalidarTiny()
    return { ok: true, dados: resultado }
  } catch (e) {
    return comoErro(e)
  }
}

export async function sincronizarAgora(): Promise<ResultadoDaAction<{ atualizados: number }>> {
  try {
    await autorizarAction('tiny.operar')
    if (!tinyConfigurado) return { ok: false, erro: SEM_TOKEN }
    const resultado = await sincronizarPedidos({ prazoMs: 40_000 })
    revalidarTiny()
    revalidatePath('/solicitacoes')
    return { ok: true, dados: resultado }
  } catch (e) {
    return comoErro(e)
  }
}

export async function reenviar(id: string): Promise<ResultadoDaAction> {
  try {
    const usuario = await autorizarAction('tiny.operar')
    const pedido = await db.pedidoTiny.findUniqueOrThrow({
      where: { id },
      select: { loteId: true },
    })
    await reenviarPedido(id, usuario.id)
    processarDepois()
    revalidarTiny(pedido.loteId ?? undefined)
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}

export async function reenviarFalhasDoLote(
  loteId: string,
): Promise<ResultadoDaAction<{ reenviados: number }>> {
  try {
    const usuario = await autorizarAction('tiny.operar')
    const falhas = await db.pedidoTiny.findMany({
      where: { loteId, envio: 'falhou' },
      select: { id: true },
    })
    for (const f of falhas) await reenviarPedido(f.id, usuario.id)
    if (falhas.length) processarDepois()
    revalidarTiny(loteId)
    return { ok: true, dados: { reenviados: falhas.length } }
  } catch (e) {
    return comoErro(e)
  }
}

type ResultadoDoPasso = ResultadoDaAction<{ marcados: number; ignorados: number }>

/**
 * "Fechar expedição" na tela da Expedição: os presentes da lista passam a
 * "Preparando envio" no Tiny, como a pauta de 22/10/2026 definiu.
 */
export async function fecharExpedicao(solicitacaoIds: string[]): Promise<ResultadoDoPasso> {
  try {
    const usuario = await autorizarAction('tiny.operar')
    const pedidos = await db.pedidoTiny.findMany({
      where: { solicitacaoId: { in: solicitacaoIds } },
      select: { id: true },
    })
    const r = await marcarPassoDaExpedicao(
      pedidos.map((p) => p.id),
      'fechar',
      usuario,
    )
    if (r.marcados) processarDepois()
    revalidatePath('/expedicao')
    revalidarTiny()
    return { ok: true, dados: { ...r, ignorados: solicitacaoIds.length - r.marcados } }
  } catch (e) {
    return comoErro(e)
  }
}

/** O mesmo fechamento, para todos os pedidos de um lote importado. */
export async function fecharExpedicaoDoLote(loteId: string): Promise<ResultadoDoPasso> {
  try {
    const usuario = await autorizarAction('tiny.operar')
    const pedidos = await db.pedidoTiny.findMany({ where: { loteId }, select: { id: true } })
    const r = await marcarPassoDaExpedicao(
      pedidos.map((p) => p.id),
      'fechar',
      usuario,
    )
    if (r.marcados) processarDepois()
    revalidarTiny(loteId)
    return { ok: true, dados: r }
  } catch (e) {
    return comoErro(e)
  }
}

/** "Concluir": o pacote está pronto, e o pedido vai a "Pronto para envio". */
export async function concluirExpedicao(pedidoTinyIds: string[]): Promise<ResultadoDoPasso> {
  try {
    const usuario = await autorizarAction('tiny.operar')
    const r = await marcarPassoDaExpedicao(pedidoTinyIds, 'concluir', usuario)
    if (r.marcados) processarDepois()
    const lotes = await db.pedidoTiny.findMany({
      where: { id: { in: pedidoTinyIds }, loteId: { not: null } },
      select: { loteId: true },
      distinct: ['loteId'],
    })
    revalidatePath('/expedicao')
    revalidarTiny()
    for (const l of lotes) revalidatePath(`/tiny/lotes/${l.loteId}`)
    return { ok: true, dados: r }
  } catch (e) {
    return comoErro(e)
  }
}

export async function salvarConfiguracaoTiny(dados: FormData): Promise<ResultadoDaAction> {
  try {
    await autorizarAction('tiny.operar')
    const validado = configuracaoTinySchema.safeParse(Object.fromEntries(dados.entries()))
    if (!validado.success) return primeiroErro(validado.error)
    await configuracaoTiny()
    await db.configuracaoTiny.update({ where: { id: 'unica' }, data: validado.data })
    revalidarTiny()
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}

// ---------------------------------------------------------------------------
// Nova venda: pedido avulso
// ---------------------------------------------------------------------------

/** O cliente como a tela de nova venda preenche, venha do Tiny ou da base. */
export type ClienteParaPedido = {
  origem: 'tiny' | 'base'
  nome: string
  cpfCnpj: string
  email: string | null
  telefone: string | null
  cep: string
  endereco: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
}

export async function buscarClientesParaPedido(
  texto: string,
): Promise<ResultadoDaAction<ClienteParaPedido[]>> {
  try {
    await autorizarAction('tiny.operar')
    const busca = texto.trim()
    if (busca.length < 3) return { ok: false, erro: 'Digite ao menos 3 letras ou o CPF/CNPJ.' }
    const criterio = classificarBusca(busca)

    // A base daqui primeiro: é rápida e não gasta chamada do Tiny.
    const daBase = await clienteProvider.buscarPorTexto(busca, 8)
    const doTiny = tinyConfigurado
      ? await pesquisarContatos(
          criterio?.tipo === 'cpfCnpj' ? { cpfCnpj: criterio.valor } : { pesquisa: busca },
        )
          .then((r) => r.contatos.filter((c) => c.ativo).slice(0, 12))
          .catch(() => [])
      : []

    // O mesmo documento nos dois lados: vale o do Tiny, que é o que vai no pedido.
    const noTiny = new Set(doTiny.map((c) => c.cpfCnpj))
    const enderecoDaBase = (e: EnderecoDoCliente | null) => ({
      cep: e?.cep ?? '',
      endereco: e?.logradouro ?? '',
      numero: e?.numero ?? '',
      complemento: e?.complemento ?? '',
      bairro: e?.bairro ?? '',
      cidade: e?.cidade ?? '',
      uf: e?.uf ?? '',
    })
    return {
      ok: true,
      dados: [
        ...doTiny.map((c): ClienteParaPedido => ({
          origem: 'tiny',
          nome: c.nome,
          cpfCnpj: c.cpfCnpj,
          email: c.email,
          telefone: c.fone,
          ...c.endereco,
        })),
        ...daBase
          .filter((c) => !noTiny.has(c.cpf))
          .map((c): ClienteParaPedido => ({
            origem: 'base',
            nome: c.nome,
            cpfCnpj: c.cpf,
            email: c.email,
            telefone: c.telefone,
            ...enderecoDaBase(c.endereco),
          })),
      ],
    }
  } catch (e) {
    return comoErro(e)
  }
}

/**
 * Grava o pedido montado à mão na fila, como os outros. A chave vem da tela:
 * enviar duas vezes devolve o mesmo pedido em vez de criar outro.
 */
export async function criarPedidoAvulso(
  entrada: unknown,
): Promise<ResultadoDaAction<{ id: string }>> {
  try {
    const usuario = await autorizarAction('tiny.operar')
    if (!tinyConfigurado) return { ok: false, erro: SEM_TOKEN }

    const validado = pedidoAvulsoSchema.safeParse(entrada)
    if (!validado.success) return primeiroErro(validado.error)
    const dados = validado.data

    // Quantidade e valor são dos itens; da linha só interessa o destinatário.
    const { destinatario, erros } = validarLinha({
      ...dados.destinatario,
      quantidade: '1',
      valor: '',
    })
    if (erros.length) return { ok: false, erro: `Cliente: ${erros.join(' ')}` }

    const chave = `avulso:${dados.chave}`
    const existente = await db.pedidoTiny.findUnique({ where: { chave }, select: { id: true } })
    if (existente) return { ok: true, dados: existente }

    const itens = dados.itens.map((i) => ({
      ...i,
      valorUnitario: Number(i.valorUnitario).toFixed(2),
    }))
    const pedido = await db.$transaction(async (tx) => {
      const criado = await tx.pedidoTiny.create({
        data: {
          origem: 'avulso',
          chave,
          criadoPorId: usuario.id,
          destinatario: destinatario.nome,
          cpfCnpj: destinatario.cpfCnpj,
          resumo: resumoDosItens(itens),
          payload: montarPedido({
            destinatario,
            itens,
            transportadora: dados.transportadora,
            formaFrete: dados.formaFrete,
            marcador: dados.marcador,
            observacao: dados.observacao,
          }) as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      })
      await registrarEvento(
        tx,
        criado.id,
        'avulso',
        `${usuario.nome} montou um pedido para ${destinatario.nome} (${resumoDosItens(itens)}).`,
        usuario.id,
      )
      return criado
    })

    processarDepois()
    revalidarTiny()
    return { ok: true, dados: pedido }
  } catch (e) {
    return comoErro(e)
  }
}
