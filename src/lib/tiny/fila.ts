import type { PedidoTiny, Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { contasLigadas, tinyLigado } from '@/lib/env'
import { CONTA_PADRAO, NOME_DA_CONTA, type ContaTiny } from './contas'
import {
  alterarSituacao,
  gravarContato,
  incluirPedido,
  obterPedido,
  pesquisarContatos,
  pesquisarProdutos,
} from './api'
import { conferirSku } from './skus'
import { montarContato } from './contato'
import {
  cancelamentoCabe,
  jaChegou,
  passoPermitido,
  ROTULO_DO_PASSO,
  SITUACAO_DO_PASSO,
  situacaoVigente,
  type PassoDaExpedicao,
} from './ciclo'
import { rotuloDaSituacao } from './rotulos'
import {
  classificarErro,
  ErroDoTiny,
  MAX_TENTATIVAS,
  PRODUTO_FORA_DO_CADASTRO,
  proximaTentativa,
} from './erros'
import {
  chaveDoCodigo,
  chaveDoPresente,
  codigosSemId,
  corte,
  ligarAoCadastro,
  montarPedido,
  resumoDosItens,
  type Destinatario,
  type PedidoParaOTiny,
  type ProdutoLigado,
} from './pedido'

/**
 * A fila de pedidos para o Tiny (ADR 0009).
 *
 * Quem cria o pedido (a aprovação do presente, a importação do lote) só grava
 * uma linha em `pedidos_tiny`, na própria transação, e segue. Quem fala com o
 * Tiny é `processarFila`, chamada logo depois em segundo plano, pelo
 * agendador a cada poucos minutos e pelo botão da tela do Tiny. Assim a
 * aprovação nunca espera o Tiny, e nada se perde se ele estiver fora.
 */

type Banco = Prisma.TransactionClient

/** Entre uma chamada e outra: o Tiny bloqueia por um minuto quem passa do limite. */
const INTERVALO_ENTRE_CHAMADAS_MS = 2_100

/** Pedido em "processando" há mais que isto teve a função interrompida no meio. */
const PROCESSANDO_PRESO_MS = 10 * 60_000

/** O Tiny para de mudar a situação depois disto. */
const SITUACOES_FINAIS = ['entregue', 'cancelado']

/** Sincronizar de novo o mesmo pedido só depois disto, e só até tantos dias. */
const INTERVALO_DE_SINCRONIZACAO_MS = 30 * 60_000
const DIAS_DE_ACOMPANHAMENTO = 90

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms))

export async function registrarEvento(
  banco: Banco,
  pedidoId: string | null,
  tipo: string,
  mensagem: string,
  /** Quem fez; sem ele, foi a própria fila. */
  usuarioId: string | null = null,
) {
  await banco.eventoTiny.create({
    data: { pedidoId, tipo, mensagem: mensagem.slice(0, 500), usuarioId },
  })
}

/** Pedidos criados no Tiny nos últimos sete dias, para o número da tela. */
export async function enviadosNaSemana(agora = new Date()) {
  return db.pedidoTiny.count({
    where: { envio: 'enviado', enviadoEm: { gte: new Date(agora.getTime() - 7 * 86_400_000) } },
  })
}

export async function configuracaoTiny(banco: Banco = db) {
  return banco.configuracaoTiny.upsert({ where: { id: 'unica' }, create: {}, update: {} })
}

// ---------------------------------------------------------------------------
// Presente aprovado
// ---------------------------------------------------------------------------

async function pedidoDoPresente(banco: Banco, solicitacaoId: string) {
  const [s, config] = await Promise.all([
    banco.solicitacao.findUniqueOrThrow({
      where: { id: solicitacaoId },
      include: {
        cliente: true,
        itens: { include: { produto: { select: { nome: true, skuTiny: true } } } },
      },
    }),
    configuracaoTiny(banco),
  ])

  const itens = s.itens.map((i) => ({
    codigo: i.produto?.skuTiny ?? null,
    descricao: i.produto?.nome ?? i.descricaoLivre ?? 'Presente',
    quantidade: i.quantidade,
    valorUnitario: i.valorUnitario.toFixed(2),
  }))

  const payload = montarPedido({
    destinatario: {
      nome: s.cliente.nome,
      cpfCnpj: s.cliente.cpf,
      email: s.cliente.email,
      telefone: s.cliente.telefone,
      cep: s.entregaCep,
      endereco: s.entregaLogradouro,
      numero: s.entregaNumero,
      complemento: s.entregaComplemento,
      bairro: s.entregaBairro,
      cidade: s.entregaCidade,
      uf: s.entregaUf,
    },
    nomeDoDestinatario: s.entregaDestinatario,
    itens,
    transportadora: config.transportadora,
    formaFrete: config.formaFrete,
    marcador: config.marcadorPresentes,
    numeroNoSistema: s.codigo,
    // O teste vai ao Tiny como os outros, para homologar, mas quem olha lá sabe.
    observacao: `${s.teste ? 'TESTE · ' : ''}Catálogo de Presentes · ${s.codigo}`,
  })

  // A pauta de 22/10/2026 exige SKU em todo produto do catálogo: sem ele o
  // Tiny não liga o item ao estoque. Presente específico não tem SKU por
  // natureza (é comprado fora) e vai pela descrição.
  const semSku = s.itens
    .filter((i) => i.produto && !i.produto.skuTiny?.trim())
    .map((i) => i.produto!.nome)

  return { s, payload, resumo: resumoDosItens(itens), semSku }
}

const avisoDeSemSku = (nomes: string[]) =>
  `Sem SKU no Tiny: ${nomes.join(', ')}. Preencha em Administração → Produtos e reenvie.`

/**
 * Põe o presente na fila do Tiny. Recebe a transação de quem mudou o status:
 * o pedido entra junto com o histórico, ou nada acontece. Um presente gera um
 * pedido só; voltar a "Organizando envio" depois de um problema não cria outro
 * (o reenvio é pela tela do Tiny), a não ser que o pedido tenha sido cancelado
 * por uma volta (`reabrirPresente`).
 */
export async function enfileirarPresente(
  tx: Banco,
  solicitacaoId: string,
  usuarioId: string | null = null,
): Promise<boolean> {
  // Presente vai sempre à Consultoria; uma CHECK no banco garante.
  if (!tinyLigado(CONTA_PADRAO)) return false
  const config = await configuracaoTiny(tx)
  if (!config.enviarPresentes) return false

  const chave = chaveDoPresente(solicitacaoId)
  const existente = await tx.pedidoTiny.findUnique({ where: { chave } })
  if (existente) return reabrirPresente(tx, existente, usuarioId)

  const { s, payload, resumo, semSku } = await pedidoDoPresente(tx, solicitacaoId)
  // Sem SKU o pedido não vai, mas fica registrado, com o aviso, para alguém
  // corrigir o cadastro e reenviar: a aprovação não pode falhar por isso.
  const pedido = await tx.pedidoTiny.create({
    data: {
      origem: 'solicitacao',
      conta: CONTA_PADRAO,
      chave,
      solicitacaoId,
      destinatario: s.cliente.nome,
      cpfCnpj: s.cliente.cpf,
      resumo,
      payload: payload as unknown as Prisma.InputJsonValue,
      ...(semSku.length ? { envio: 'falhou' as const, erro: avisoDeSemSku(semSku) } : {}),
    },
  })
  await registrarEvento(
    tx,
    pedido.id,
    semSku.length ? 'falhou' : 'enfileirado',
    semSku.length
      ? `Presente ${s.codigo} parado: ${avisoDeSemSku(semSku)}`
      : `Presente ${s.codigo} entrou na fila.`,
    usuarioId,
  )
  return !semSku.length
}

/**
 * O presente volta à expedição e já tem pedido. Só muda algo quando o Admin o
 * tinha voltado para antes do envio, o que cancelou o pedido:
 *
 * - o cancelamento ainda não chegou ao Tiny: desiste dele, o pedido segue lá;
 * - nunca foi ao Tiny, ou já foi cancelado lá: vai de novo, com os itens e o
 *   endereço de agora. O número do sistema ganha "-2", "-3"... para o Tiny não
 *   confundir com o pedido cancelado.
 *
 * Fora isso, um presente é um pedido só, e o reenvio é pela tela do Tiny.
 */
async function reabrirPresente(
  tx: Banco,
  pedido: PedidoTiny,
  usuarioId: string | null,
): Promise<boolean> {
  const canceladoLa = pedido.situacao === 'cancelado'
  if (pedido.situacaoPendente === 'cancelado' && !canceladoLa) {
    await tx.pedidoTiny.update({ where: { id: pedido.id }, data: { situacaoPendente: null } })
    await registrarEvento(
      tx,
      pedido.id,
      'reaberto',
      `${pedido.destinatario}: voltou à expedição antes de o cancelamento chegar ao Tiny; o pedido segue lá.`,
      usuarioId,
    )
    return false
  }
  if (pedido.envio !== 'cancelado' && !canceladoLa) return false

  const { s, payload, resumo, semSku } = await pedidoDoPresente(tx, pedido.solicitacaoId!)
  const vezes = await tx.eventoTiny.count({ where: { pedidoId: pedido.id, tipo: 'reaberto' } })
  if (canceladoLa) payload.numero_pedido_ecommerce = corte(`${s.codigo}-${vezes + 2}`, 50)
  await tx.pedidoTiny.update({
    where: { id: pedido.id },
    data: {
      payload: payload as unknown as Prisma.InputJsonValue,
      resumo,
      destinatario: s.cliente.nome,
      cpfCnpj: s.cliente.cpf,
      envio: semSku.length ? 'falhou' : 'pendente',
      erro: semSku.length ? avisoDeSemSku(semSku) : null,
      tentativas: 0,
      proximaTentativaEm: new Date(),
      tinyId: null,
      tinyNumero: null,
      situacao: null,
      situacaoPendente: null,
      rastreio: null,
      urlRastreio: null,
      notaFiscalId: null,
      enviadoEm: null,
      sincronizadoEm: null,
    },
  })
  await registrarEvento(
    tx,
    pedido.id,
    'reaberto',
    canceladoLa
      ? `Presente ${s.codigo} voltou à expedição; o pedido ${pedido.tinyNumero ?? ''} foi cancelado no Tiny, e um novo entra na fila.`
      : `Presente ${s.codigo} voltou à expedição e entrou na fila de novo.`,
    usuarioId,
  )
  return !semSku.length
}

// ---------------------------------------------------------------------------
// Expedição: fechar e concluir
// ---------------------------------------------------------------------------

/**
 * Marca o passo da expedição nos pedidos. O pedido guarda a situação pedida,
 * e a fila a leva ao Tiny: quem clica não espera o Tiny, e nada se perde se
 * ele estiver fora. Pedido que ainda vai nascer no Tiny recebe o passo também
 * e o leva logo depois de criado.
 */
export async function marcarPassoDaExpedicao(
  ids: string[],
  passo: PassoDaExpedicao,
  quem: { id: string; nome: string },
): Promise<{ marcados: number; ignorados: number }> {
  const pedidos = await db.pedidoTiny.findMany({
    where: { id: { in: ids }, envio: { not: 'falhou' } },
    select: { id: true, situacao: true, situacaoPendente: true },
  })
  const marcaveis = pedidos.filter((p) => passoPermitido(situacaoVigente(p), passo))
  const destino = SITUACAO_DO_PASSO[passo]

  await db.$transaction(async (tx) => {
    for (const p of marcaveis) {
      await tx.pedidoTiny.update({ where: { id: p.id }, data: { situacaoPendente: destino } })
      await registrarEvento(
        tx,
        p.id,
        'expedicao',
        `${ROTULO_DO_PASSO[passo]} (${quem.nome}): vai a "${rotuloDaSituacao(destino)}" no Tiny.`,
        quem.id,
      )
    }
  })
  return { marcados: marcaveis.length, ignorados: ids.length - marcaveis.length }
}

// ---------------------------------------------------------------------------
// Solicitação cancelada
// ---------------------------------------------------------------------------

/**
 * A solicitação cancelada não pode seguir viva no Tiny, onde a expedição
 * continuaria vendo o pedido para despachar. Recebe a transação de quem mudou
 * o status, como a aprovação.
 *
 * - Ainda na fila ou parado em Falhou: não vai mais.
 * - Já no Tiny e ainda na AUVP: vai a "Cancelado" pela fila.
 * - Já despachado: fica como está, com o aviso no histórico.
 *
 * Devolve se há algo para a fila levar ao Tiny.
 */
export async function cancelarPresenteNoTiny(
  tx: Banco,
  solicitacaoId: string,
  usuarioId: string | null = null,
  /** Cancelada aqui, ou voltada pelo Admin para antes do envio. */
  por: 'cancelamento' | 'volta' = 'cancelamento',
): Promise<boolean> {
  const pedido = await tx.pedidoTiny.findUnique({
    where: { chave: chaveDoPresente(solicitacaoId) },
  })
  // Já cancelado, aqui ou lá: uma segunda volta não tem o que desfazer.
  if (!pedido || pedido.envio === 'cancelado' || situacaoVigente(pedido) === 'cancelado') {
    return false
  }
  const oQue = por === 'volta' ? 'solicitação voltou a uma etapa anterior' : 'solicitação cancelada'

  // Condicionado ao envio: a fila pode ter reservado o pedido neste instante.
  const parado = await tx.pedidoTiny.updateMany({
    where: { id: pedido.id, envio: { in: ['pendente', 'falhou'] } },
    data: { envio: 'cancelado', erro: null },
  })
  if (parado.count) {
    await registrarEvento(
      tx,
      pedido.id,
      'cancelado',
      `${pedido.destinatario}: ${oQue}; o pedido ainda não tinha ido ao Tiny e não será criado.`,
      usuarioId,
    )
    return false
  }

  const numero = pedido.tinyNumero ? `O pedido ${pedido.tinyNumero}` : 'O pedido'
  const vigente = situacaoVigente(pedido)
  if (!cancelamentoCabe(vigente)) {
    await registrarEvento(
      tx,
      pedido.id,
      'cancelado',
      `${pedido.destinatario}: ${oQue}, mas ${numero.toLowerCase()} já está "${rotuloDaSituacao(vigente)}" no Tiny; nada foi mudado lá.`,
      usuarioId,
    )
    return false
  }

  // Também cobre o pedido que a fila está criando agora: ele nasce e, na
  // mesma rodada, recebe o cancelamento.
  await tx.pedidoTiny.update({ where: { id: pedido.id }, data: { situacaoPendente: 'cancelado' } })
  await registrarEvento(
    tx,
    pedido.id,
    'cancelado',
    `${pedido.destinatario}: ${oQue}; ${numero.toLowerCase()} vai a "Cancelado" no Tiny.`,
    usuarioId,
  )
  return true
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------

export type ResultadoDaRodada = {
  enviados: number
  falhas: number
  adiados: number
  /** Fechamentos e conclusões da expedição levados ao Tiny. */
  situacoes: number
  /** Contatos incluídos ou alterados no Tiny. */
  contatos: number
  /** A rodada parou porque o token ou a conta do Tiny estão com problema. */
  interrompida: string | null
}

/**
 * Esvazia a fila até o prazo acabar. Cada pedido é reservado com um
 * `updateMany` condicionado ao status: duas rodadas ao mesmo tempo (o
 * agendador e o botão) nunca mandam o mesmo pedido duas vezes.
 */
export async function processarFila({
  prazoMs = 45_000,
  agora = () => new Date(),
}: { prazoMs?: number; agora?: () => Date } = {}): Promise<ResultadoDaRodada> {
  const resultado: ResultadoDaRodada = {
    enviados: 0,
    falhas: 0,
    adiados: 0,
    situacoes: 0,
    contatos: 0,
    interrompida: null,
  }
  const contas = contasLigadas()
  if (!contas.length) {
    resultado.interrompida = 'O token do Tiny não está configurado.'
    return resultado
  }

  const fim = Date.now() + prazoMs
  const preso = {
    envio: 'processando' as const,
    atualizadoEm: { lt: new Date(agora().getTime() - PROCESSANDO_PRESO_MS) },
  }
  await db.pedidoTiny.updateMany({ where: preso, data: { envio: 'pendente' } })
  await db.contatoTiny.updateMany({ where: preso, data: { envio: 'pendente' } })

  // Uma chamada ao Tiny por vez, com intervalo entre todas, de qualquer tipo.
  let chamou = false
  const antesDeChamar = async () => {
    if (chamou) await esperar(INTERVALO_ENTRE_CHAMADAS_MS)
    chamou = true
  }

  // Token errado numa conta não segura as outras: cada uma roda a sua parte,
  // e a que parou fica registrada com o nome.
  const paradas: string[] = []
  for (const conta of contas) {
    if (Date.now() >= fim) break
    const daConta = { ...resultado, interrompida: null }
    await rodadaDaConta(conta, fim, antesDeChamar, daConta, agora)
    resultado.enviados = daConta.enviados
    resultado.falhas = daConta.falhas
    resultado.adiados = daConta.adiados
    resultado.situacoes = daConta.situacoes
    resultado.contatos = daConta.contatos
    if (daConta.interrompida) paradas.push(`${NOME_DA_CONTA[conta]}: ${daConta.interrompida}`)
  }
  resultado.interrompida = paradas.length ? paradas.join(' · ') : null
  return resultado
}

/**
 * Acha no cadastro do Tiny o produto de cada item que só tem o código e grava o
 * id no pedido, para a nova tentativa não buscar de novo. Lote e Nova venda já
 * chegam com o id da busca; o presente traz só o SKU do catálogo.
 */
async function ligarItensAoCadastro(
  conta: ContaTiny,
  pedido: PedidoTiny,
  antesDeChamar: () => Promise<void>,
): Promise<PedidoParaOTiny> {
  const payload = pedido.payload as unknown as PedidoParaOTiny
  const codigos = codigosSemId(payload)
  if (!codigos.length) return payload

  const achados = new Map<string, ProdutoLigado>()
  for (const codigo of codigos) {
    await antesDeChamar()
    const conferencia = conferirSku(codigo, await pesquisarProdutos(conta, codigo))
    if (!conferencia.ok) {
      throw new ErroDoTiny(
        `${conferencia.erro} O pedido não foi ao Tiny para não criar um produto repetido lá.`,
        PRODUTO_FORA_DO_CADASTRO,
      )
    }
    const p = conferencia.produto
    if (p?.id) achados.set(chaveDoCodigo(codigo), { id: p.id, codigo: p.codigo, nome: p.nome })
  }

  const ligado = ligarAoCadastro(payload, achados)
  await db.pedidoTiny.update({
    where: { id: pedido.id },
    data: { payload: ligado as unknown as Prisma.InputJsonValue },
  })
  return ligado
}

/** Pedidos, situações e contatos de uma conta, nesta ordem. */
async function rodadaDaConta(
  conta: ContaTiny,
  fim: number,
  antesDeChamar: () => Promise<void>,
  resultado: ResultadoDaRodada,
  agora: () => Date,
) {
  while (Date.now() < fim) {
    const proximo = await db.pedidoTiny.findFirst({
      where: { conta, envio: 'pendente', proximaTentativaEm: { lte: agora() } },
      orderBy: { criadoEm: 'asc' },
      select: { id: true },
    })
    if (!proximo) break

    const reservado = await db.pedidoTiny.updateMany({
      where: { id: proximo.id, envio: 'pendente' },
      data: { envio: 'processando', tentativas: { increment: 1 } },
    })
    if (reservado.count === 0) continue

    const pedido = await db.pedidoTiny.findUniqueOrThrow({ where: { id: proximo.id } })
    // Cancelado enquanto esperava uma nova tentativa: não nasce no Tiny.
    if (pedido.situacaoPendente === 'cancelado') {
      await db.pedidoTiny.update({
        where: { id: pedido.id },
        data: { envio: 'cancelado', situacaoPendente: null },
      })
      await registrarEvento(
        db,
        pedido.id,
        'cancelado',
        `${pedido.destinatario}: solicitação cancelada; o pedido não foi criado no Tiny.`,
      )
      continue
    }

    try {
      const payload = await ligarItensAoCadastro(conta, pedido, antesDeChamar)
      await antesDeChamar()
      const criado = await incluirPedido(conta, payload)
      await db.$transaction(async (tx) => {
        await tx.pedidoTiny.update({
          where: { id: pedido.id },
          data: {
            envio: 'enviado',
            enviadoEm: agora(),
            tinyId: criado.id,
            tinyNumero: criado.numero || null,
            situacao: 'aberto',
            erro: null,
          },
        })
        if (pedido.solicitacaoId) {
          await tx.solicitacao.update({
            where: { id: pedido.solicitacaoId },
            data: { tinyPedidoId: criado.id, tinyStatus: 'aberto' },
          })
        }
        await registrarEvento(
          tx,
          pedido.id,
          'enviado',
          `Pedido ${criado.numero || criado.id} criado no Tiny para ${pedido.destinatario}.`,
        )
      })
      resultado.enviados++
    } catch (erro) {
      const tipo = classificarErro(erro)
      const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido.'

      if (tipo === 'duplicidade') {
        // O Tiny já tem o pedido: provavelmente criado numa tentativa que caiu
        // antes da resposta. Tentar de novo duplicaria de verdade.
        await db.pedidoTiny.update({
          where: { id: pedido.id },
          data: {
            envio: 'enviado',
            enviadoEm: agora(),
            erro: `O Tiny acusou duplicidade; confira o pedido lá. (${mensagem})`,
          },
        })
        await registrarEvento(db, pedido.id, 'duplicidade', `${pedido.destinatario}: ${mensagem}`)
        resultado.enviados++
        continue
      }

      const desiste = tipo === 'recusado' || pedido.tentativas >= MAX_TENTATIVAS
      await db.pedidoTiny.update({
        where: { id: pedido.id },
        data: {
          envio: desiste ? 'falhou' : 'pendente',
          erro: mensagem,
          proximaTentativaEm: proximaTentativa(pedido.tentativas, agora()),
        },
      })
      await registrarEvento(
        db,
        pedido.id,
        desiste ? 'falhou' : 'adiado',
        `${pedido.destinatario}: ${mensagem}`,
      )
      if (desiste) resultado.falhas++
      else resultado.adiados++

      // Token errado ou conta bloqueada valem para todos: insistir só gastaria
      // as tentativas dos outros pedidos.
      if (tipo === 'configuracao') {
        resultado.interrompida = mensagem
        break
      }
    }
  }

  if (!resultado.interrompida) await levarSituacoesAoTiny(conta, fim, antesDeChamar, resultado)
  // Contatos por último: pedido e situação são o que a expedição espera.
  if (!resultado.interrompida) {
    await processarContatos(conta, fim, antesDeChamar, resultado, agora)
  }
}

// ---------------------------------------------------------------------------
// Contatos
// ---------------------------------------------------------------------------

export type ContatoParaEnfileirar = {
  destinatario: Destinatario
  linha?: number | null
  /** Conhecido quando a edição parte do contato aberto na tela. */
  tinyId?: string | null
}

/**
 * Põe contatos na fila. O CPF/CNPJ que já espera a vez é atualizado em vez de
 * duplicado: vale o dado mais novo, e o Tiny recebe uma chamada só.
 */
export async function enfileirarContatos(
  contatos: readonly ContatoParaEnfileirar[],
  origem: string,
  usuario: { id: string; nome: string },
  conta: ContaTiny,
): Promise<{ novos: number; atualizados: number }> {
  return db.$transaction(async (tx) => {
    const esperando = await tx.contatoTiny.findMany({
      where: {
        conta,
        envio: 'pendente',
        cpfCnpj: { in: contatos.map((c) => c.destinatario.cpfCnpj) },
      },
      select: { id: true, cpfCnpj: true },
    })
    const porDocumento = new Map(esperando.map((e) => [e.cpfCnpj, e.id]))
    const campos = (c: ContatoParaEnfileirar) => ({
      origem: origem.slice(0, 120),
      conta,
      linha: c.linha ?? null,
      nome: c.destinatario.nome,
      dados: c.destinatario as unknown as Prisma.InputJsonValue,
      tinyId: c.tinyId ?? null,
      criadoPorId: usuario.id,
    })

    const novos = contatos.filter((c) => !porDocumento.has(c.destinatario.cpfCnpj))
    for (const c of contatos.filter((c) => porDocumento.has(c.destinatario.cpfCnpj))) {
      await tx.contatoTiny.update({
        where: { id: porDocumento.get(c.destinatario.cpfCnpj)! },
        data: { ...campos(c), tentativas: 0, erro: null, proximaTentativaEm: new Date() },
      })
    }
    await tx.contatoTiny.createMany({
      data: novos.map((c) => ({ ...campos(c), cpfCnpj: c.destinatario.cpfCnpj })),
    })

    const total = contatos.length
    await registrarEvento(
      tx,
      null,
      'contatos',
      `${usuario.nome} mandou ${total} ${total === 1 ? 'contato' : 'contatos'} ao Tiny da ${NOME_DA_CONTA[conta]} (${origem}).`,
      usuario.id,
    )
    return { novos: novos.length, atualizados: total - novos.length }
  })
}

/**
 * Inclui ou altera cada contato. Sem o id do Tiny, procura antes pelo CPF/CNPJ:
 * achou, altera; não achou, inclui. São duas chamadas, e as duas respeitam o
 * intervalo da fila.
 */
async function processarContatos(
  conta: ContaTiny,
  fim: number,
  antesDeChamar: () => Promise<void>,
  resultado: ResultadoDaRodada,
  agora: () => Date,
) {
  while (Date.now() < fim) {
    const proximo = await db.contatoTiny.findFirst({
      where: { conta, envio: 'pendente', proximaTentativaEm: { lte: agora() } },
      orderBy: { criadoEm: 'asc' },
      select: { id: true },
    })
    if (!proximo) break

    const reservado = await db.contatoTiny.updateMany({
      where: { id: proximo.id, envio: 'pendente' },
      data: { envio: 'processando', tentativas: { increment: 1 } },
    })
    if (reservado.count === 0) continue

    const contato = await db.contatoTiny.findUniqueOrThrow({ where: { id: proximo.id } })
    const destinatario = contato.dados as unknown as Destinatario
    try {
      let id = contato.tinyId
      if (!id) {
        await antesDeChamar()
        const achados = await pesquisarContatos(conta, { cpfCnpj: contato.cpfCnpj })
        id = achados.contatos.find((c) => c.cpfCnpj === contato.cpfCnpj)?.id ?? null
      }
      await antesDeChamar()
      const gravado = await gravarContato(conta, montarContato(destinatario, id))
      const acao = id ? 'alterado' : 'incluido'
      await db.contatoTiny.update({
        where: { id: contato.id },
        data: {
          envio: 'enviado',
          resultado: acao,
          tinyId: gravado.id || id,
          enviadoEm: agora(),
          erro: null,
        },
      })
      resultado.contatos++
    } catch (erro) {
      const tipo = classificarErro(erro)
      const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido.'
      const desiste =
        tipo === 'recusado' || tipo === 'duplicidade' || contato.tentativas >= MAX_TENTATIVAS
      await db.contatoTiny.update({
        where: { id: contato.id },
        data: {
          envio: desiste ? 'falhou' : 'pendente',
          // Duplicidade na inclusão: a busca pelo documento não achou o
          // contato que o Tiny diz ter. Quem resolve é alguém, pela tela.
          erro:
            tipo === 'duplicidade'
              ? `O Tiny já tem um contato com este CPF/CNPJ que a busca não achou. (${mensagem})`
              : mensagem,
          proximaTentativaEm: proximaTentativa(contato.tentativas, agora()),
        },
      })
      if (desiste) {
        await registrarEvento(db, null, 'falhou', `Contato ${contato.nome}: ${mensagem}`)
        resultado.falhas++
      } else {
        resultado.adiados++
      }
      if (tipo === 'configuracao') {
        resultado.interrompida = mensagem
        break
      }
    }
  }
}

/** Devolve à fila um contato que falhou, do zero. */
export async function reenviarContato(id: string, usuarioId: string | null = null) {
  await db.$transaction(async (tx) => {
    const { count } = await tx.contatoTiny.updateMany({
      where: { id, envio: 'falhou' },
      data: { envio: 'pendente', tentativas: 0, proximaTentativaEm: new Date() },
    })
    if (!count) return
    const contato = await tx.contatoTiny.findUniqueOrThrow({
      where: { id },
      select: { nome: true },
    })
    await registrarEvento(
      tx,
      null,
      'reenviado',
      `Contato ${contato.nome} voltou para a fila.`,
      usuarioId,
    )
  })
}

/**
 * Leva ao Tiny o fechamento e a conclusão da expedição. Roda depois dos
 * pedidos novos na mesma rodada, para o pedido criado agora já receber a
 * situação que a expedição marcou antes de ele existir lá.
 */
async function levarSituacoesAoTiny(
  conta: ContaTiny,
  fim: number,
  antesDeChamar: () => Promise<void>,
  resultado: ResultadoDaRodada,
) {
  const pendentes = await db.pedidoTiny.findMany({
    where: { conta, envio: 'enviado', tinyId: { not: null }, situacaoPendente: { not: null } },
    orderBy: { atualizadoEm: 'asc' },
    take: 50,
  })

  for (const p of pendentes) {
    if (Date.now() >= fim) break
    await antesDeChamar()
    const destino = p.situacaoPendente!
    try {
      await alterarSituacao(conta, p.tinyId!, destino)
      await db.$transaction(async (tx) => {
        // Só limpa se ninguém pediu outro passo enquanto o Tiny respondia.
        await tx.pedidoTiny.updateMany({
          where: { id: p.id, situacaoPendente: destino },
          data: { situacao: destino, situacaoPendente: null, erro: null },
        })
        if (p.solicitacaoId) {
          await tx.solicitacao.update({
            where: { id: p.solicitacaoId },
            data: { tinyStatus: destino },
          })
        }
        await registrarEvento(
          tx,
          p.id,
          'situacao',
          `${p.destinatario}: "${rotuloDaSituacao(destino)}" no Tiny.`,
        )
      })
      resultado.situacoes++
    } catch (erro) {
      const tipo = classificarErro(erro)
      const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido.'
      // Temporário fica para a próxima rodada, com o pedido de mudança intacto.
      if (tipo === 'temporario') continue
      if (tipo === 'configuracao') {
        resultado.interrompida = mensagem
        break
      }
      // O Tiny recusou a mudança, quase sempre porque o pedido já andou lá
      // (faturado, cancelado). Insistir não adianta; a próxima sincronização
      // traz a situação de verdade.
      await db.pedidoTiny.update({
        where: { id: p.id },
        data: {
          situacaoPendente: null,
          erro: `O Tiny não aceitou "${rotuloDaSituacao(destino)}": ${mensagem}`,
        },
      })
      await registrarEvento(db, p.id, 'falhou', `${p.destinatario}: ${mensagem}`)
      resultado.falhas++
    }
  }
}

// ---------------------------------------------------------------------------
// Volta: situação e rastreio
// ---------------------------------------------------------------------------

/**
 * Traz do Tiny a situação, o rastreio e a nota dos pedidos que ainda andam.
 *
 * O rastreio vai para a solicitação do presente, onde o consultor lê. A regra
 * de sempre continua: rastreio não muda status; "entregue" é decisão de quem
 * acompanha. O rastreio digitado à mão é preservado quando o Tiny não traz
 * outro.
 */
export async function sincronizarPedidos({
  prazoMs = 30_000,
  agora = () => new Date(),
}: { prazoMs?: number; agora?: () => Date } = {}): Promise<{ atualizados: number }> {
  const contas = contasLigadas()
  if (!contas.length) return { atualizados: 0 }
  const fim = Date.now() + prazoMs
  const limiteDeIdade = new Date(agora().getTime() - DIAS_DE_ACOMPANHAMENTO * 86_400_000)

  const candidatos = await db.pedidoTiny.findMany({
    where: {
      conta: { in: contas },
      envio: 'enviado',
      tinyId: { not: null },
      enviadoEm: { gte: limiteDeIdade },
      OR: [{ situacao: null }, { situacao: { notIn: SITUACOES_FINAIS } }],
      AND: [
        {
          OR: [
            { sincronizadoEm: null },
            {
              sincronizadoEm: { lt: new Date(agora().getTime() - INTERVALO_DE_SINCRONIZACAO_MS) },
            },
          ],
        },
      ],
    },
    orderBy: [{ sincronizadoEm: { sort: 'asc', nulls: 'first' } }],
    take: 40,
  })

  let atualizados = 0
  const lotesTocados = new Set<string>()
  // Conta com token recusado: as outras seguem, as dela esperam a próxima vez.
  const recusadas = new Set<ContaTiny>()

  let chamou = false
  for (const pedido of candidatos) {
    if (Date.now() >= fim) break
    if (recusadas.has(pedido.conta)) continue
    if (chamou) await esperar(INTERVALO_ENTRE_CHAMADAS_MS)
    chamou = true
    try {
      const noTiny = await obterPedido(pedido.conta, pedido.tinyId!)
      await db.$transaction(async (tx) => {
        await tx.pedidoTiny.update({
          where: { id: pedido.id },
          data: {
            situacao: noTiny.situacao || pedido.situacao,
            // Alguém andou o pedido direto no Tiny além do passo pedido aqui:
            // mandá-lo agora faria o pedido voltar.
            ...(pedido.situacaoPendente && jaChegou(noTiny.situacao, pedido.situacaoPendente)
              ? { situacaoPendente: null }
              : {}),
            rastreio: noTiny.rastreio ?? pedido.rastreio,
            urlRastreio: noTiny.urlRastreio ?? pedido.urlRastreio,
            notaFiscalId: noTiny.notaFiscalId ?? pedido.notaFiscalId,
            sincronizadoEm: agora(),
          },
        })

        if (noTiny.rastreio && noTiny.rastreio !== pedido.rastreio) {
          await registrarEvento(tx, pedido.id, 'rastreio', `Rastreio ${noTiny.rastreio}.`)
        }

        if (pedido.solicitacaoId) {
          const s = await tx.solicitacao.findUniqueOrThrow({
            where: { id: pedido.solicitacaoId },
            select: { rastreio: true },
          })
          // Só substitui o rastreio que veio do próprio Tiny, ou o vazio.
          const podeTrocar = !s.rastreio || s.rastreio === pedido.rastreio
          await tx.solicitacao.update({
            where: { id: pedido.solicitacaoId },
            data: {
              tinyStatus: noTiny.situacao || undefined,
              ...(noTiny.rastreio && podeTrocar
                ? { rastreio: noTiny.rastreio, transportadora: noTiny.transportadora }
                : {}),
            },
          })
        }
      })
      if (pedido.loteId) lotesTocados.add(pedido.loteId)
      atualizados++
    } catch (erro) {
      await db.pedidoTiny.update({
        where: { id: pedido.id },
        data: { sincronizadoEm: agora() },
      })
      if (classificarErro(erro) === 'configuracao') recusadas.add(pedido.conta)
    }
  }

  for (const loteId of lotesTocados) await concluirLoteSeTerminou(loteId, agora())
  return { atualizados }
}

/** A demanda do lote na trilha conclui quando todos os pedidos dele terminaram. */
async function concluirLoteSeTerminou(loteId: string, agora: Date) {
  const lote = await db.loteTiny.findUnique({
    where: { id: loteId },
    select: { demandaId: true, pedidos: { select: { envio: true, situacao: true } } },
  })
  if (!lote?.demandaId) return
  const terminou = lote.pedidos.every(
    (p) =>
      p.envio === 'falhou' ||
      (p.envio === 'enviado' && SITUACOES_FINAIS.includes(p.situacao ?? '')),
  )
  if (!terminou) return
  await db.demandaLogistica.updateMany({
    where: { id: lote.demandaId, fase: { not: 'concluido' } },
    data: { fase: 'concluido', concluidaEm: agora },
  })
}

// ---------------------------------------------------------------------------
// Reenvio
// ---------------------------------------------------------------------------

/**
 * Volta o pedido para a fila. O presente é remontado com os dados de agora,
 * para o reenvio levar a correção que motivou o erro (um SKU preenchido, um
 * endereço acertado); a linha do lote vai igual.
 */
export async function reenviarPedido(
  id: string,
  usuarioId: string | null = null,
  agora = new Date(),
) {
  await db.$transaction(async (tx) => {
    const pedido = await tx.pedidoTiny.findUniqueOrThrow({ where: { id } })
    // Cancelado acompanha a solicitação: reenviar seria mandar um presente cancelado.
    if (pedido.envio !== 'falhou' && pedido.envio !== 'pendente') return

    const remontado = pedido.solicitacaoId ? await pedidoDoPresente(tx, pedido.solicitacaoId) : null

    if (remontado?.semSku.length) {
      const aviso = avisoDeSemSku(remontado.semSku)
      await tx.pedidoTiny.update({
        where: { id },
        data: {
          envio: 'falhou',
          erro: aviso,
          payload: remontado.payload as unknown as Prisma.InputJsonValue,
        },
      })
      await registrarEvento(tx, id, 'falhou', `${pedido.destinatario}: ${aviso}`, usuarioId)
      return
    }

    await tx.pedidoTiny.update({
      where: { id },
      data: {
        envio: 'pendente',
        tentativas: 0,
        proximaTentativaEm: agora,
        erro: null,
        ...(remontado
          ? {
              payload: remontado.payload as unknown as Prisma.InputJsonValue,
              resumo: remontado.resumo,
            }
          : {}),
      },
    })
    await registrarEvento(
      tx,
      id,
      'reenviado',
      `${pedido.destinatario}: voltou para a fila.`,
      usuarioId,
    )
  })
}
