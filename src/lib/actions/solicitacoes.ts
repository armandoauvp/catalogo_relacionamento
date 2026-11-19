'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { Prisma, StatusSolicitacao } from '@prisma/client'
import { db } from '@/lib/db'
import { autorizarAction } from '@/lib/auth-guards'
import { filtroDeSolicitacoes, pode } from '@/lib/permissions'
import { proximoCodigo } from '@/lib/codigo'
import { totalDosItens } from '@/lib/money'
import { normalizarCpf } from '@/lib/cpf'
import { clienteProvider, type EnderecoDoCliente } from '@/lib/providers'
import { acompanhamentosFaltando, mensagemDePendencia } from '@/lib/acompanhamentos'
import {
  ROTULO_STATUS,
  caminhoDeEncaminhamento,
  ehChegadaDoItem,
  ehPassoDeCompra,
  podeConfirmarRecebimento,
  podeMarcarEntregue,
  precisaDeCompra,
  validarMudancaDeStatus,
  type Encaminhamento,
} from '@/lib/status'
import {
  ROTULO_MOTIVO,
  correcaoSchema,
  solicitacaoSchema,
  mudancaDeStatusSchema,
  rastreioSchema,
  linkDeCompraSchema,
} from '@/lib/validators/solicitacao'
import {
  alteracoesDaCorrecao,
  compradoIntacto,
  correcaoCabe,
  type ItemComparavel,
} from '@/lib/correcao'
import { compraCompleta, linkDeCompraEditavel } from '@/lib/compras'
import { clienteSchema } from '@/lib/validators/cliente'
import { sincronizarDemandaDoPresente } from '@/lib/logistica/ponte'
import { cancelarPresenteNoTiny, enfileirarPresente, processarFila } from '@/lib/tiny/fila'
import { comoErro, primeiroErro, type ResultadoDaAction } from './comuns'

/**
 * O presente que chegou a "Organizando envio" entrou na fila do Tiny dentro da
 * transação; o envio em si roda depois da resposta, sem a tela esperar o Tiny.
 */
function processarFilaDepois() {
  after(async () => {
    await processarFila({ prazoMs: 40_000 }).catch((e) => console.error('Fila do Tiny:', e))
  })
}

/**
 * Escritas de solicitação.
 *
 * Toda ação começa por `autorizarAction`: esconder um botão não é controle de
 * acesso, e estas funções são endpoints acessíveis diretamente.
 */

export type ClienteEncontrado = {
  id: string
  nome: string
  cpf: string
  telefone: string | null
  email: string | null
  /** O padrão do cadastro, que só preenche a entrega; a solicitação guarda a cópia. */
  endereco: EnderecoDoCliente | null
}

/**
 * Busca um cliente por CPF.
 *
 * O CPF é a chave de deduplicação: a tela usa isto para oferecer o cliente
 * existente em vez de criar duplicata.
 */
export async function buscarClientePorCpf(
  cpf: string,
): Promise<ResultadoDaAction<ClienteEncontrado | null>> {
  try {
    await autorizarAction('solicitacao.criar')

    const limpo = normalizarCpf(cpf)
    if (limpo.length !== 11) return { ok: true, dados: null }

    const cliente = await clienteProvider.buscarPorCpf(limpo)
    if (!cliente) return { ok: true, dados: null }
    const { id, nome, telefone, email, endereco } = cliente
    return { ok: true, dados: { id, nome, cpf: cliente.cpf, telefone, email, endereco } }
  } catch (e) {
    return comoErro(e)
  }
}

export type PresenteJaEnviado = {
  codigo: string
  data: Date
  status: StatusSolicitacao
  itens: string[]
}

/**
 * O que este consultor já mandou para este cliente.
 *
 * Existe para não repetir presente. A área manda para o mesmo cliente
 * ano após ano, e a caneca que ele ganhou no aniversário passado é a pior
 * escolha possível para o próximo.
 *
 * O recorte é o do perfil, e não o do cliente: consultor só enxerga as
 * próprias solicitações, então a lista diz "o que você mandou", não "o que o
 * cliente recebeu". Admin e Financeiro veem tudo, como em toda outra tela.
 */
export async function presentesJaEnviados(
  clienteId: string,
): Promise<ResultadoDaAction<PresenteJaEnviado[]>> {
  try {
    const usuario = await autorizarAction('solicitacao.criar')

    const linhas = await db.solicitacao.findMany({
      where: {
        clienteId,
        ...filtroDeSolicitacoes(usuario.perfil, usuario.id),
      },
      select: {
        codigo: true,
        dataSolicitacao: true,
        status: true,
        itens: { select: { descricaoLivre: true, produto: { select: { nome: true } } } },
      },
      orderBy: { dataSolicitacao: 'desc' },
      // Cinco cabem na tela sem empurrar o formulário para baixo, e é mais do
      // que a área manda para um mesmo cliente num ano.
      take: 5,
    })

    return {
      ok: true,
      dados: linhas.map((l) => ({
        codigo: l.codigo,
        data: l.dataSolicitacao,
        status: l.status,
        itens: l.itens.map((i) => i.produto?.nome ?? i.descricaoLivre ?? 'item'),
      })),
    }
  } catch (e) {
    return comoErro(e)
  }
}

/** Cadastra um cliente novo a partir do formulário de solicitação. */
export async function criarCliente(entrada: unknown): Promise<ResultadoDaAction<{ id: string }>> {
  try {
    const usuario = await autorizarAction('solicitacao.criar')

    const validado = clienteSchema.safeParse(entrada)
    if (!validado.success) return primeiroErro(validado.error)

    // CPF repetido não vira erro: devolve quem já existe, que é o que a tela
    // precisa para oferecer o cliente em vez de duplicar.
    const existente = await db.cliente.findUnique({
      where: { cpf: validado.data.cpf },
      select: { id: true },
    })
    if (existente) return { ok: true, dados: { id: existente.id } }

    const cliente = await db.cliente.create({
      data: { ...validado.data, criadoPor: usuario.id },
      select: { id: true },
    })

    revalidatePath('/admin/clientes')
    return { ok: true, dados: { id: cliente.id } }
  } catch (e) {
    return comoErro(e)
  }
}

/**
 * Cria a solicitação.
 *
 * Tudo numa transação: o código sequencial, os itens, o total e a primeira
 * linha do histórico. Se qualquer parte falhar, não sobra código reservado sem
 * solicitação nem solicitação sem histórico.
 *
 * O valor unitário do item de catálogo é **relido do banco e copiado agora**,
 * nunca aceito do cliente, e congela. Reajuste de preço depois não mexe nesta
 * solicitação.
 */
export async function criarSolicitacao(
  entrada: unknown,
): Promise<ResultadoDaAction<{ id: string; codigo: string }>> {
  try {
    const usuario = await autorizarAction('solicitacao.criar')

    const validado = solicitacaoSchema.safeParse(entrada)
    if (!validado.success) return primeiroErro(validado.error)
    const dados = validado.data

    const idsDeProdutos = dados.itens.map((i) => i.produtoId).filter((id): id is string => !!id)
    const produtos = idsDeProdutos.length
      ? await db.produto.findMany({
          where: { id: { in: idsDeProdutos }, ativo: true },
          select: {
            id: true,
            nome: true,
            valor: true,
            exigeAcompanhamento: true,
            serveComoAcompanhamento: true,
          },
        })
      : []
    const porId = new Map(produtos.map((p) => [p.id, p]))

    const faltando = idsDeProdutos.find((id) => !porId.has(id))
    if (faltando) {
      return { ok: false, erro: 'Um dos produtos saiu do catálogo. Revise os itens.' }
    }

    // Kit que embala bebida não vai sozinho. A tela já impede, mas esta action
    // é um endpoint: quem chamar direto encontra a mesma regra.
    const pendencias = mensagemDePendencia(
      acompanhamentosFaltando(
        dados.itens.map((item) => ({
          produtoId: item.produtoId,
          produto: item.produtoId ? porId.get(item.produtoId) : null,
        })),
      ),
    )
    if (pendencias) return { ok: false, erro: pendencias, campo: 'itens' }

    const itens = dados.itens.map((item) => {
      if (item.produtoId) {
        return {
          produtoId: item.produtoId,
          descricaoLivre: null,
          urlExterna: null,
          // Produto sem preço informado congela como zero: é melhor do que
          // recusar a solicitação por um dado que só a área pode preencher.
          // O catálogo avisa "valor a definir" antes de a pessoa escolher.
          valorUnitario: porId.get(item.produtoId)!.valor ?? new Prisma.Decimal(0),
          quantidade: item.quantidade,
        }
      }
      return {
        produtoId: null,
        descricaoLivre: item.descricaoLivre,
        urlExterna: item.urlExterna,
        valorUnitario: new Prisma.Decimal(item.valorUnitario),
        quantidade: item.quantidade,
      }
    })

    const criada = await db.$transaction(async (tx) => {
      const codigo = await proximoCodigo(tx)

      const solicitacao = await tx.solicitacao.create({
        data: {
          codigo,
          consultorId: usuario.id,
          clienteId: dados.clienteId,
          motivo: dados.motivo,
          motivoOutro: dados.motivoOutro,
          mensagemCarta: dados.mensagemCarta,
          saudacaoCarta: dados.saudacaoCarta,
          observacoes: dados.observacoes,
          status: StatusSolicitacao.pendente,
          valorTotal: totalDosItens(itens),
          entregaCep: dados.entregaCep,
          entregaLogradouro: dados.entregaLogradouro,
          entregaNumero: dados.entregaNumero,
          entregaComplemento: dados.entregaComplemento,
          entregaBairro: dados.entregaBairro,
          entregaCidade: dados.entregaCidade,
          entregaUf: dados.entregaUf,
          entregaDestinatario: dados.entregaDestinatario,
          itens: { create: itens },
        },
        select: { id: true, codigo: true },
      })

      await tx.solicitacaoHistorico.create({
        data: {
          solicitacaoId: solicitacao.id,
          statusAnterior: null,
          statusNovo: StatusSolicitacao.pendente,
          usuarioId: usuario.id,
        },
      })

      return solicitacao
    })

    revalidatePath('/solicitacoes')
    revalidatePath('/admin/solicitacoes')
    return { ok: true, dados: criada }
  } catch (e) {
    return comoErro(e)
  }
}

/**
 * Muda o status de uma solicitação.
 *
 * A transição e a exigência de motivo passam por `validarMudancaDeStatus`, a
 * mesma função que a tela usa para montar as opções, para que o que é oferecido
 * e o que é aceito nunca divirjam.
 */
export async function alterarStatus(entrada: unknown): Promise<ResultadoDaAction> {
  try {
    const usuario = await autorizarAction('solicitacao.alterarStatus')

    const validado = mudancaDeStatusSchema.safeParse(entrada)
    if (!validado.success) return primeiroErro(validado.error)
    const { solicitacaoId, statusNovo, motivo } = validado.data

    const solicitacao = await db.solicitacao.findUnique({
      where: { id: solicitacaoId },
      select: { id: true, status: true },
    })
    if (!solicitacao) return { ok: false, erro: 'Solicitação não encontrada.' }

    const checagem = validarMudancaDeStatus(solicitacao.status, statusNovo, motivo)
    if (!checagem.ok) return { ok: false, erro: checagem.erro }

    if (ehPassoDeCompra(solicitacao.status, statusNovo)) await autorizarAction('compras.operar')
    if (ehChegadaDoItem(solicitacao.status, statusNovo)) {
      await autorizarAction('expedicao.receberItem')
    }

    await gravarMudancaDeStatus(usuario.id, solicitacao, statusNovo, motivo)
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}

/**
 * Dá o pedido como entregue, pela fila da expedição.
 *
 * Separada de `alterarStatus` porque quem posta acompanha a entrega, mas não
 * decide o resto do fluxo: a Logística marca isto e nenhum outro status.
 */
export async function marcarEntregue(solicitacaoId: string): Promise<ResultadoDaAction> {
  try {
    const usuario = await autorizarAction('expedicao.registrarRastreio')

    const solicitacao = await db.solicitacao.findUnique({
      where: { id: solicitacaoId },
      select: { id: true, status: true, rastreio: true },
    })
    if (!solicitacao) return { ok: false, erro: 'Solicitação não encontrada.' }

    if (!podeMarcarEntregue(solicitacao.status, solicitacao.rastreio)) {
      return {
        ok: false,
        erro: 'Só dá para marcar como entregue o pedido em organizando envio e com rastreio.',
      }
    }

    await gravarMudancaDeStatus(usuario.id, solicitacao, StatusSolicitacao.entregue)
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}

/**
 * O item comprado chegou à Logística: vai para a expedição e vira pedido no Tiny.
 *
 * Separada de `alterarStatus` pelo mesmo motivo de `marcarEntregue`: quem
 * recebe o pacote confirma a chegada e nenhum outro status. O pedido só entra
 * no Tiny a partir daqui, porque antes disso a Logística não tem o que processar.
 */
export async function confirmarChegada(solicitacaoId: string): Promise<ResultadoDaAction> {
  try {
    const usuario = await autorizarAction('expedicao.receberItem')

    const solicitacao = await db.solicitacao.findUnique({
      where: { id: solicitacaoId },
      select: { id: true, status: true },
    })
    if (!solicitacao) return { ok: false, erro: 'Solicitação não encontrada.' }

    if (!ehChegadaDoItem(solicitacao.status, StatusSolicitacao.organizando_envio)) {
      return { ok: false, erro: 'Só dá para confirmar a chegada de um pedido em "Comprado".' }
    }

    await gravarMudancaDeStatus(usuario.id, solicitacao, StatusSolicitacao.organizando_envio)
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}

/**
 * Encerra a solicitação entregue com o "cliente confirmou o recebimento".
 *
 * Separada de `alterarStatus` porque o consultor faz isto e nada mais: é ele
 * quem fala com o cliente. A busca passa pelo escopo, então a solicitação de
 * outra pessoa nem é encontrada.
 */
export async function confirmarRecebimento(solicitacaoId: string): Promise<ResultadoDaAction> {
  try {
    const usuario = await autorizarAction('solicitacao.confirmarRecebimento')

    const escopo = filtroDeSolicitacoes(usuario.perfil, usuario.id)
    if (!escopo) return { ok: false, erro: 'Solicitação não encontrada.' }

    const solicitacao = await db.solicitacao.findFirst({
      where: { id: solicitacaoId, ...escopo },
      select: { id: true, status: true },
    })
    if (!solicitacao) return { ok: false, erro: 'Solicitação não encontrada.' }

    if (!podeConfirmarRecebimento(solicitacao.status)) {
      return { ok: false, erro: 'Só dá para confirmar o recebimento depois de entregue.' }
    }

    await gravarMudancaDeStatus(usuario.id, solicitacao, StatusSolicitacao.cliente_confirmou)
    revalidatePath(`/solicitacoes/${solicitacao.id}`)
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}

/** Itens da solicitação com o que decide se precisam de compra. */
async function itensParaCompra(tx: Prisma.TransactionClient, solicitacaoId: string) {
  const itens = await tx.solicitacaoItem.findMany({
    where: { solicitacaoId },
    select: {
      id: true,
      produtoId: true,
      quantidade: true,
      compradoEm: true,
      doEstoque: true,
      produto: { select: { origem: true, controlaEstoque: true, estoque: true } },
    },
  })
  return itens.map((i) => ({ ...i, precisaComprar: precisaDeCompra([i]) }))
}

/** Marca como comprados, por quem marcou, os itens que precisam de compra e ainda não foram. */
async function registrarCompraDosItens(
  tx: Prisma.TransactionClient,
  solicitacaoId: string,
  usuarioId: string,
) {
  const faltando = (await itensParaCompra(tx, solicitacaoId))
    .filter((i) => i.precisaComprar && !i.compradoEm)
    .map((i) => i.id)
  if (faltando.length === 0) return
  await tx.solicitacaoItem.updateMany({
    where: { id: { in: faltando } },
    data: { compradoEm: new Date(), compradoPorId: usuarioId },
  })
}

export type ResumoDaCompra = {
  itensMarcados: number
  /** Solicitações que ficaram completas e foram para "Comprado". */
  completas: string[]
}

/**
 * Marca itens como comprados, da fila do Financeiro, um fornecedor de cada vez.
 *
 * Uma solicitação pode ter itens de lojas diferentes: comprar no Mercado Livre
 * não compra o vinho da Casa da Bebida. Por isso a compra é por item, e a
 * solicitação só vai a "Comprado" quando o último item que precisa de compra é
 * marcado, com a linha no histórico e a trilha andando junto, na mesma transação.
 * Item que já foi comprado, ou de solicitação fora da compra, é ignorado.
 */
export async function marcarItensComprados(
  itemIds: string[],
): Promise<ResultadoDaAction<ResumoDaCompra>> {
  try {
    const usuario = await autorizarAction('compras.operar')
    const ids = [...new Set(itemIds.filter((id) => typeof id === 'string' && id))].slice(0, 500)
    if (ids.length === 0) return { ok: false, erro: 'Selecione pelo menos um item.' }

    const doPedido = await db.solicitacaoItem.findMany({
      where: { id: { in: ids }, compradoEm: null },
      select: {
        id: true,
        solicitacao: { select: { id: true, codigo: true, status: true } },
      },
    })
    const porSolicitacao = new Map<string, { codigo: string; itens: string[] }>()
    for (const i of doPedido) {
      if (i.solicitacao.status !== StatusSolicitacao.aguardando_compra) continue
      const atual = porSolicitacao.get(i.solicitacao.id) ?? {
        codigo: i.solicitacao.codigo,
        itens: [],
      }
      atual.itens.push(i.id)
      porSolicitacao.set(i.solicitacao.id, atual)
    }

    const resumo: ResumoDaCompra = { itensMarcados: 0, completas: [] }
    // Uma transação por solicitação: um pedido que falhar não desfaz os outros.
    for (const [solicitacaoId, { codigo, itens }] of porSolicitacao) {
      await db.$transaction(async (tx) => {
        const r = await tx.solicitacaoItem.updateMany({
          where: { id: { in: itens }, compradoEm: null },
          data: { compradoEm: new Date(), compradoPorId: usuario.id },
        })
        resumo.itensMarcados += r.count
        if (!compraCompleta(await itensParaCompra(tx, solicitacaoId))) return
        await tx.solicitacao.update({
          where: { id: solicitacaoId },
          data: { status: StatusSolicitacao.comprado },
        })
        await tx.solicitacaoHistorico.create({
          data: {
            solicitacaoId,
            statusAnterior: StatusSolicitacao.aguardando_compra,
            statusNovo: StatusSolicitacao.comprado,
            usuarioId: usuario.id,
          },
        })
        await sincronizarDemandaDoPresente(tx, solicitacaoId, StatusSolicitacao.comprado, {
          registradoPor: usuario.id,
        })
        resumo.completas.push(codigo)
      })
    }

    revalidatePath('/financeiro/compras')
    revalidatePath('/admin/solicitacoes')
    revalidatePath('/expedicao')
    revalidatePath('/solicitacoes')
    revalidatePath('/logistica')
    return { ok: true, dados: resumo }
  } catch (e) {
    return comoErro(e)
  }
}

/** Grava uma mudança já autorizada e validada, com tudo o que anda junto com ela. */
async function gravarMudancaDeStatus(
  usuarioId: string,
  solicitacao: { id: string; status: StatusSolicitacao },
  statusNovo: StatusSolicitacao,
  motivo?: string | null,
) {
  const foiParaOTiny = await db.$transaction(async (tx) => {
    await tx.solicitacao.update({ where: { id: solicitacao.id }, data: { status: statusNovo } })
    await tx.solicitacaoHistorico.create({
      data: {
        solicitacaoId: solicitacao.id,
        statusAnterior: solicitacao.status,
        statusNovo,
        usuarioId,
        motivo,
      },
    })
    // Comprada a solicitação inteira, os itens que faltavam ficam comprados por
    // quem marcou: a compra por item e a por solicitação contam a mesma história.
    if (statusNovo === StatusSolicitacao.comprado) {
      await registrarCompraDosItens(tx, solicitacao.id, usuarioId)
    }
    // Aprovado, o presente entra na trilha da Logística; os status seguintes
    // movem a fase. Na mesma transação: ou anda tudo, ou nada.
    await sincronizarDemandaDoPresente(tx, solicitacao.id, statusNovo, { registradoPor: usuarioId })
    if (statusNovo === StatusSolicitacao.organizando_envio) {
      return enfileirarPresente(tx, solicitacao.id, usuarioId)
    }
    // Cancelado aqui não pode seguir para despacho no Tiny.
    if (statusNovo === StatusSolicitacao.cancelado) {
      return cancelarPresenteNoTiny(tx, solicitacao.id, usuarioId)
    }
    return false
  })
  if (foiParaOTiny) processarFilaDepois()

  revalidatePath(`/admin/solicitacoes/${solicitacao.id}`)
  revalidatePath('/admin/solicitacoes')
  revalidatePath('/financeiro/compras')
  revalidatePath('/expedicao')
  revalidatePath('/solicitacoes')
  revalidatePath('/logistica')
}

/**
 * Marca ou desmarca a solicitação como teste. Teste fica fora do saldo do mês
 * e da trilha da Logística; o resto (histórico, Tiny, expedição) segue igual,
 * com o selo, para homologar sem gastar o limite de ninguém.
 */
export async function marcarComoTeste(
  solicitacaoId: string,
  teste: boolean,
): Promise<ResultadoDaAction> {
  try {
    await autorizarAction('solicitacao.alterarStatus')
    await db.$transaction(async (tx) => {
      const { status } = await tx.solicitacao.update({
        where: { id: solicitacaoId },
        data: { teste },
        select: { status: true },
      })
      // Arquiva a demanda do teste, ou a devolve à trilha ao desmarcar.
      await sincronizarDemandaDoPresente(tx, solicitacaoId, status)
    })
    revalidatePath(`/admin/solicitacoes/${solicitacaoId}`)
    revalidatePath('/admin/solicitacoes')
    revalidatePath('/expedicao')
    revalidatePath('/solicitacoes')
    revalidatePath('/logistica')
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}

/** O que aconteceu com um lote, a tela precisa disso para dizer o que sobrou. */
export type ResumoDoLote = {
  movidas: { codigo: string; para: string }[]
  ignoradas: { codigo: string; motivo: string }[]
}

/**
 * Encaminha várias solicitações de uma vez.
 *
 * O Admin trabalha por pilha: chegam vinte pedidos e ele decide de uma vez
 * quais vão para a compra e quais já podem ser separados. Abrir vinte telas
 * para isso é o que a planilha fazia melhor que um sistema.
 *
 * Duas coisas que o lote **não** afrouxa:
 *
 * - a aprovação continua acontecendo. Quando a solicitação ainda está pendente,
 *   `caminhoDeEncaminhamento` insere o passo da aprovação antes do destino, e
 *   ele vira uma linha própria do histórico;
 * - o que não pode andar não anda em silêncio. A solicitação é ignorada com o
 *   motivo, e a tela mostra a lista.
 */
export async function encaminharEmLote(
  ids: string[],
  destino: Encaminhamento,
): Promise<ResultadoDaAction<ResumoDoLote>> {
  try {
    const usuario = await autorizarAction('solicitacao.alterarStatus')
    const operaCompra = pode(usuario.perfil, 'compras.operar')
    const recebeItem = pode(usuario.perfil, 'expedicao.receberItem')

    if (ids.length === 0) {
      return { ok: false, erro: 'Selecione pelo menos uma solicitação.' }
    }

    const solicitacoes = await db.solicitacao.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        codigo: true,
        status: true,
        itens: {
          select: {
            produtoId: true,
            quantidade: true,
            doEstoque: true,
            produto: { select: { origem: true, controlaEstoque: true, estoque: true } },
          },
        },
      },
      orderBy: { codigo: 'asc' },
    })

    const resumo: ResumoDoLote = { movidas: [], ignoradas: [] }
    let algumParaOTiny = false

    for (const solicitacao of solicitacoes) {
      const caminho = caminhoDeEncaminhamento(solicitacao.status, destino, solicitacao.itens)

      if (!caminho.ok) {
        resumo.ignoradas.push({ codigo: solicitacao.codigo, motivo: caminho.erro })
        continue
      }

      if (
        !operaCompra &&
        caminho.passos.some((passo, i) =>
          ehPassoDeCompra(caminho.passos[i - 1] ?? solicitacao.status, passo),
        )
      ) {
        resumo.ignoradas.push({
          codigo: solicitacao.codigo,
          motivo: 'Marcar a compra é do Financeiro.',
        })
        continue
      }

      if (
        !recebeItem &&
        caminho.passos.some((passo, i) =>
          ehChegadaDoItem(caminho.passos[i - 1] ?? solicitacao.status, passo),
        )
      ) {
        resumo.ignoradas.push({
          codigo: solicitacao.codigo,
          motivo: 'Confirmar que o item chegou é da Logística.',
        })
        continue
      }

      // Uma transação por solicitação: um pedido que não pode andar não desfaz
      // o encaminhamento dos outros dezenove.
      await db.$transaction(async (tx) => {
        let anterior = solicitacao.status

        for (const passo of caminho.passos) {
          await tx.solicitacao.update({ where: { id: solicitacao.id }, data: { status: passo } })
          await tx.solicitacaoHistorico.create({
            data: {
              solicitacaoId: solicitacao.id,
              statusAnterior: anterior,
              statusNovo: passo,
              usuarioId: usuario.id,
            },
          })
          anterior = passo
        }

        await sincronizarDemandaDoPresente(tx, solicitacao.id, anterior, {
          registradoPor: usuario.id,
        })
        if (anterior === StatusSolicitacao.organizando_envio) {
          algumParaOTiny =
            (await enfileirarPresente(tx, solicitacao.id, usuario.id)) || algumParaOTiny
        }
        if (anterior === StatusSolicitacao.cancelado) {
          algumParaOTiny =
            (await cancelarPresenteNoTiny(tx, solicitacao.id, usuario.id)) || algumParaOTiny
        }
      })

      const ultimo = caminho.passos[caminho.passos.length - 1]!
      resumo.movidas.push({ codigo: solicitacao.codigo, para: ROTULO_STATUS[ultimo] })
    }
    if (algumParaOTiny) processarFilaDepois()

    revalidatePath('/admin/solicitacoes')
    revalidatePath('/financeiro/compras')
    revalidatePath('/expedicao')
    revalidatePath('/solicitacoes')
    revalidatePath('/logistica')
    return { ok: true, dados: resumo }
  } catch (e) {
    return comoErro(e)
  }
}

/**
 * Troca o link de compra de um item: o que o consultor pediu esgotou, ou não
 * serve. Quem aprova troca ali mesmo, sem devolver o pedido. O item continua
 * o mesmo, e o valor congelado não muda; só muda onde o Financeiro compra.
 */
export async function trocarLinkDeCompra(entrada: unknown): Promise<ResultadoDaAction> {
  try {
    await autorizarAction('solicitacao.editar')

    const validado = linkDeCompraSchema.safeParse(entrada)
    if (!validado.success) return primeiroErro(validado.error)
    const { itemId, link } = validado.data

    const item = await db.solicitacaoItem.findUnique({
      where: { id: itemId },
      select: { solicitacao: { select: { id: true, status: true } } },
    })
    if (!item) return { ok: false, erro: 'Item não encontrado.' }

    if (!linkDeCompraEditavel(item.solicitacao.status)) {
      return { ok: false, erro: 'Depois de comprado, o link não muda mais.' }
    }

    await db.solicitacaoItem.update({ where: { id: itemId }, data: { linkDeCompra: link } })

    revalidatePath(`/admin/solicitacoes/${item.solicitacao.id}`)
    revalidatePath(`/solicitacoes/${item.solicitacao.id}`)
    revalidatePath('/financeiro/compras')
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}

/**
 * Corrige o pedido depois de criado: itens, entrega e carta. É do Admin, até a
 * compra (`correcaoCabe`), e cada campo que muda fica registrado com o antes e
 * o depois (`alteracoesDaCorrecao`).
 *
 * As regras da criação valem aqui também: item do catálogo usa o preço do
 * banco (o que já estava no pedido fica com o valor congelado), o kit que
 * exige vinho é conferido de novo, e item já comprado não muda nem sai.
 */
export async function corrigirSolicitacao(
  entrada: unknown,
): Promise<ResultadoDaAction<{ alteracoes: number }>> {
  try {
    const usuario = await autorizarAction('solicitacao.editar')

    const validado = correcaoSchema.safeParse(entrada)
    if (!validado.success) return primeiroErro(validado.error)
    const dados = validado.data

    const atual = await db.solicitacao.findUnique({
      where: { id: dados.solicitacaoId },
      include: {
        itens: { include: { produto: { select: { nome: true } } } },
        pedidoTiny: { select: { id: true } },
      },
    })
    if (!atual) return { ok: false, erro: 'Solicitação não encontrada.' }
    if (!correcaoCabe(atual.status, atual.pedidoTiny !== null)) {
      return {
        ok: false,
        erro: atual.pedidoTiny
          ? 'O pedido já foi ao Tiny: corrija lá, para os dois não divergirem.'
          : 'Depois de comprado, o pedido não muda mais.',
      }
    }

    const existentes = new Map(atual.itens.map((i) => [i.id, i]))
    const desconhecido = dados.itens.find((i) => i.id && !existentes.has(i.id))
    if (desconhecido)
      return { ok: false, erro: 'Um dos itens não é deste pedido. Recarregue a tela.' }

    const idsDeProdutos = [
      ...new Set(dados.itens.map((i) => i.produtoId).filter((id): id is string => !!id)),
    ]
    const produtos = await db.produto.findMany({
      where: { id: { in: idsDeProdutos } },
      select: {
        id: true,
        nome: true,
        valor: true,
        ativo: true,
        exigeAcompanhamento: true,
        serveComoAcompanhamento: true,
      },
    })
    const porId = new Map(produtos.map((p) => [p.id, p]))

    type ItemCorrigido = Omit<(typeof dados.itens)[number], 'valorUnitario'> & {
      produto: (typeof produtos)[number] | null
      valorUnitario: Prisma.Decimal
    }
    const itens: ItemCorrigido[] = []
    for (const item of dados.itens) {
      const anterior = item.id ? existentes.get(item.id) : undefined
      if (item.produtoId) {
        const produto = porId.get(item.produtoId)
        // O produto que já estava no pedido pode ter saído do catálogo depois;
        // trocar para um produto inativo, não.
        if (!produto || (!produto.ativo && anterior?.produtoId !== item.produtoId)) {
          return { ok: false, erro: 'Um dos produtos saiu do catálogo. Revise os itens.' }
        }
        const valor =
          anterior?.produtoId === item.produtoId
            ? anterior.valorUnitario
            : (produto.valor ?? new Prisma.Decimal(0))
        itens.push({
          ...item,
          produto,
          descricaoLivre: null,
          urlExterna: null,
          doEstoque: false,
          valorUnitario: valor,
        })
      } else {
        itens.push({
          ...item,
          produto: null,
          valorUnitario: new Prisma.Decimal(item.valorUnitario),
        })
      }
    }

    const pendencias = mensagemDePendencia(
      acompanhamentosFaltando(itens.map((i) => ({ produtoId: i.produtoId, produto: i.produto }))),
    )
    if (pendencias) return { ok: false, erro: pendencias, campo: 'itens' }

    const comparavel = (i: {
      id: string | null
      produtoId: string | null
      descricaoLivre: string | null
      urlExterna: string | null
      valorUnitario: Prisma.Decimal.Value
      quantidade: number
      doEstoque: boolean
      produto: { nome: string } | null
    }): ItemComparavel => ({
      id: i.id,
      nome: i.produto?.nome ?? i.descricaoLivre ?? 'Presente',
      produtoId: i.produtoId,
      urlExterna: i.urlExterna,
      valorUnitario: new Prisma.Decimal(i.valorUnitario).toFixed(2),
      quantidade: i.quantidade,
      doEstoque: i.doEstoque,
    })
    const antesDosItens = atual.itens.map(comparavel)
    const depoisDosItens = itens.map(comparavel)

    // O que foi comprado é o que vai.
    for (const comprado of atual.itens.filter((i) => i.compradoEm)) {
      const depois = depoisDosItens.find((i) => i.id === comprado.id)
      if (!compradoIntacto(comparavel(comprado), depois)) {
        return { ok: false, erro: 'Item já comprado não muda nem sai do pedido.' }
      }
    }

    const motivoEmTexto = (motivo: typeof dados.motivo, outro: string | null) =>
      motivo === 'outro' ? (outro ?? 'Outro') : ROTULO_MOTIVO[motivo]
    const alteracoes = alteracoesDaCorrecao(
      {
        entregaDestinatario: atual.entregaDestinatario,
        entregaCep: atual.entregaCep,
        entregaLogradouro: atual.entregaLogradouro,
        entregaNumero: atual.entregaNumero,
        entregaComplemento: atual.entregaComplemento,
        entregaBairro: atual.entregaBairro,
        entregaCidade: atual.entregaCidade,
        entregaUf: atual.entregaUf,
        motivo: motivoEmTexto(atual.motivo, atual.motivoOutro),
        saudacaoCarta: atual.saudacaoCarta ?? '',
        mensagemCarta: atual.mensagemCarta,
        observacoes: atual.observacoes,
        itens: antesDosItens,
      },
      {
        entregaDestinatario: dados.entregaDestinatario,
        entregaCep: dados.entregaCep,
        entregaLogradouro: dados.entregaLogradouro,
        entregaNumero: dados.entregaNumero,
        entregaComplemento: dados.entregaComplemento,
        entregaBairro: dados.entregaBairro,
        entregaCidade: dados.entregaCidade,
        entregaUf: dados.entregaUf,
        motivo: motivoEmTexto(dados.motivo, dados.motivoOutro),
        saudacaoCarta: dados.saudacaoCarta,
        mensagemCarta: dados.mensagemCarta,
        observacoes: dados.observacoes,
        itens: depoisDosItens,
      },
    )
    if (alteracoes.length === 0) return { ok: true, dados: { alteracoes: 0 } }

    const ficam = new Set(itens.map((i) => i.id).filter(Boolean))
    await db.$transaction(async (tx) => {
      // Só sai item que ninguém comprou: o comprado foi conferido acima.
      await tx.solicitacaoItem.deleteMany({
        where: { solicitacaoId: atual.id, compradoEm: null, id: { notIn: [...ficam] as string[] } },
      })
      for (const item of itens) {
        const campos = {
          produtoId: item.produtoId,
          descricaoLivre: item.produtoId ? null : item.descricaoLivre,
          urlExterna: item.produtoId ? null : item.urlExterna,
          valorUnitario: item.valorUnitario,
          quantidade: item.quantidade,
          doEstoque: item.produtoId ? false : item.doEstoque,
        }
        if (item.id) {
          // O comprado ficou intacto; reescrevê-lo não muda nada, mas pulá-lo é mais claro.
          if (existentes.get(item.id)?.compradoEm) continue
          await tx.solicitacaoItem.update({ where: { id: item.id }, data: campos })
        } else {
          await tx.solicitacaoItem.create({ data: { ...campos, solicitacaoId: atual.id } })
        }
      }

      await tx.solicitacao.update({
        where: { id: atual.id },
        data: {
          entregaDestinatario: dados.entregaDestinatario,
          entregaCep: dados.entregaCep,
          entregaLogradouro: dados.entregaLogradouro,
          entregaNumero: dados.entregaNumero,
          entregaComplemento: dados.entregaComplemento,
          entregaBairro: dados.entregaBairro,
          entregaCidade: dados.entregaCidade,
          entregaUf: dados.entregaUf,
          motivo: dados.motivo,
          motivoOutro: dados.motivo === 'outro' ? dados.motivoOutro : null,
          saudacaoCarta: dados.saudacaoCarta,
          mensagemCarta: dados.mensagemCarta,
          observacoes: dados.observacoes,
          valorTotal: totalDosItens(itens),
        },
      })
      await tx.solicitacaoAlteracao.createMany({
        data: alteracoes.map((a) => ({ ...a, solicitacaoId: atual.id, usuarioId: usuario.id })),
      })

      // A trilha da Logística mostra os itens do presente: acompanha a correção.
      await tx.demandaLogistica.updateMany({
        where: { solicitacaoId: atual.id },
        data: {
          itens: depoisDosItens.map((i) =>
            i.quantidade > 1 ? `${i.quantidade}× ${i.nome}` : i.nome,
          ),
        },
      })

      // Se a correção tirou o último item que faltava comprar (ou o marcou como do
      // estoque), a compra está completa: segue para "Comprado", como na fila.
      if (
        atual.status === StatusSolicitacao.aguardando_compra &&
        compraCompleta(await itensParaCompra(tx, atual.id))
      ) {
        await tx.solicitacao.update({
          where: { id: atual.id },
          data: { status: StatusSolicitacao.comprado },
        })
        await tx.solicitacaoHistorico.create({
          data: {
            solicitacaoId: atual.id,
            statusAnterior: StatusSolicitacao.aguardando_compra,
            statusNovo: StatusSolicitacao.comprado,
            usuarioId: usuario.id,
            motivo: 'Nada mais a comprar depois da correção do pedido.',
          },
        })
        await sincronizarDemandaDoPresente(tx, atual.id, StatusSolicitacao.comprado, {
          registradoPor: usuario.id,
        })
      }
    })

    revalidatePath(`/admin/solicitacoes/${atual.id}`)
    revalidatePath(`/solicitacoes/${atual.id}`)
    revalidatePath('/admin/solicitacoes')
    revalidatePath('/financeiro/compras')
    revalidatePath('/expedicao')
    revalidatePath('/logistica')
    return { ok: true, dados: { alteracoes: alteracoes.length } }
  } catch (e) {
    return comoErro(e)
  }
}

/**
 * Grava o código de rastreio.
 *
 * É o que o consultor pergunta: "já foi?". Sem isso ele volta a perguntar por
 * mensagem, que é o que a ferramenta deveria ter tirado do caminho.
 *
 * Não mexe no status: pôr o rastreio é dizer que saiu, e "entregue" é outra
 * coisa, decidida por quem acompanha. Quando a integração com o sistema da
 * expedição existir, ela escreve nestes mesmos campos.
 */
export async function registrarRastreio(entrada: unknown): Promise<ResultadoDaAction> {
  try {
    await autorizarAction('expedicao.registrarRastreio')

    const validado = rastreioSchema.safeParse(entrada)
    if (!validado.success) return primeiroErro(validado.error)

    const { solicitacaoId, rastreio, transportadora } = validado.data

    await db.solicitacao.update({
      where: { id: solicitacaoId },
      data: { rastreio, transportadora },
    })

    revalidatePath('/expedicao')
    revalidatePath('/solicitacoes')
    revalidatePath(`/solicitacoes/${solicitacaoId}`)
    revalidatePath(`/admin/solicitacoes/${solicitacaoId}`)
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}
