'use server'

import { revalidatePath } from 'next/cache'
import { Prisma, StatusSolicitacao } from '@prisma/client'
import { db } from '@/lib/db'
import { autorizarAction } from '@/lib/auth-guards'
import { filtroDeSolicitacoes } from '@/lib/permissions'
import { proximoCodigo } from '@/lib/codigo'
import { totalDosItens } from '@/lib/money'
import { normalizarCpf } from '@/lib/cpf'
import { acompanhamentosFaltando, mensagemDePendencia } from '@/lib/acompanhamentos'
import {
  ROTULO_STATUS,
  caminhoDeEncaminhamento,
  validarMudancaDeStatus,
  type Encaminhamento,
} from '@/lib/status'
import {
  solicitacaoSchema,
  mudancaDeStatusSchema,
  rastreioSchema,
} from '@/lib/validators/solicitacao'
import { clienteSchema } from '@/lib/validators/cliente'
import { sincronizarDemandaDoPresente } from '@/lib/logistica/ponte'
import { comoErro, primeiroErro, type ResultadoDaAction } from './comuns'

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

    const cliente = await db.cliente.findUnique({
      where: { cpf: limpo },
      select: { id: true, nome: true, cpf: true, telefone: true, email: true },
    })

    return { ok: true, dados: cliente }
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

    await db.$transaction(async (tx) => {
      await tx.solicitacao.update({ where: { id: solicitacao.id }, data: { status: statusNovo } })
      await tx.solicitacaoHistorico.create({
        data: {
          solicitacaoId: solicitacao.id,
          statusAnterior: solicitacao.status,
          statusNovo,
          usuarioId: usuario.id,
          motivo,
        },
      })
      // Aprovado, o presente entra na trilha da Logística; os status seguintes
      // movem a fase. Na mesma transação: ou anda tudo, ou nada.
      await sincronizarDemandaDoPresente(tx, solicitacao.id, statusNovo)
    })

    revalidatePath(`/admin/solicitacoes/${solicitacao.id}`)
    revalidatePath('/admin/solicitacoes')
    revalidatePath('/financeiro/compras')
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
            produto: { select: { origem: true, controlaEstoque: true, estoque: true } },
          },
        },
      },
      orderBy: { codigo: 'asc' },
    })

    const resumo: ResumoDoLote = { movidas: [], ignoradas: [] }

    for (const solicitacao of solicitacoes) {
      const caminho = caminhoDeEncaminhamento(solicitacao.status, destino, solicitacao.itens)

      if (!caminho.ok) {
        resumo.ignoradas.push({ codigo: solicitacao.codigo, motivo: caminho.erro })
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

        await sincronizarDemandaDoPresente(tx, solicitacao.id, anterior)
      })

      const ultimo = caminho.passos[caminho.passos.length - 1]!
      resumo.movidas.push({ codigo: solicitacao.codigo, para: ROTULO_STATUS[ultimo] })
    }

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
