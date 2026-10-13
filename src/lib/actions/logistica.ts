'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { autorizarAction } from '@/lib/auth-guards'
import { fotoDoFormulario } from '@/lib/arquivos'
import { Prisma } from '@prisma/client'
import { dinheiro } from '@/lib/money'
import { concluidaEmParaFase, proximaOcorrencia } from '@/lib/logistica/demandas'
import {
  demandaSchema,
  membroSchema,
  perguntaSchema,
  statusDaSemanaSchema,
} from '@/lib/validators/logistica'
import { comoErro, primeiroErro, type ResultadoDaAction } from './comuns'

/**
 * O que a Logística mantém à mão no dashboard: as demandas da trilha, o
 * status da semana, a equipe e o FAQ. Nada aqui apaga: demanda é arquivada,
 * membro e pergunta são desativados, e o status manual volta ao automático
 * anulando a situação.
 */

function revalidarLogistica() {
  revalidatePath('/logistica', 'layout')
}

export async function definirStatusDaSemana(dados: FormData): Promise<ResultadoDaAction> {
  try {
    const usuario = await autorizarAction('logistica.gerenciar')

    const validado = statusDaSemanaSchema.safeParse({
      ano: dados.get('ano'),
      semana: dados.get('semana'),
      situacao: dados.get('situacao'),
      observacao: dados.get('observacao'),
    })
    if (!validado.success) return primeiroErro(validado.error)

    const { ano, semana, situacao, observacao } = validado.data
    // Voltar ao automático não leva observação: ela explicava a escolha manual.
    const registro = {
      situacao,
      observacao: situacao ? observacao : null,
      definidoPorId: usuario.id,
      definidoEm: new Date(),
    }

    await db.statusOperacionalSemana.upsert({
      where: { ano_semana: { ano, semana } },
      create: { ano, semana, ...registro },
      update: registro,
    })

    revalidarLogistica()
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}

export async function salvarMembro(dados: FormData): Promise<ResultadoDaAction> {
  try {
    const usuario = await autorizarAction('logistica.gerenciar')

    const foto = await fotoDoFormulario(dados, usuario.id)
    if (!foto.ok) return { ok: false, erro: foto.erro, campo: 'foto' }

    const validado = membroSchema.safeParse({
      nome: dados.get('nome'),
      funcao: dados.get('funcao'),
      descricao: dados.get('descricao'),
      email: dados.get('email'),
      ordem: dados.get('ordem'),
    })
    if (!validado.success) return primeiroErro(validado.error)

    const id = String(dados.get('id') ?? '')
    const registro = { ...validado.data, fotoUrl: foto.url }
    if (id) {
      await db.membroEquipe.update({ where: { id }, data: registro })
    } else {
      await db.membroEquipe.create({ data: registro })
    }

    revalidarLogistica()
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}

export async function alternarMembro(id: string, ativo: boolean): Promise<ResultadoDaAction> {
  try {
    await autorizarAction('logistica.gerenciar')
    await db.membroEquipe.update({ where: { id }, data: { ativo } })
    revalidarLogistica()
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}

export async function salvarPergunta(dados: FormData): Promise<ResultadoDaAction> {
  try {
    await autorizarAction('logistica.gerenciar')

    const validado = perguntaSchema.safeParse({
      pergunta: dados.get('pergunta'),
      resposta: dados.get('resposta'),
      ordem: dados.get('ordem'),
    })
    if (!validado.success) return primeiroErro(validado.error)

    const id = String(dados.get('id') ?? '')
    if (id) {
      await db.perguntaFrequente.update({ where: { id }, data: validado.data })
    } else {
      await db.perguntaFrequente.create({ data: validado.data })
    }

    revalidarLogistica()
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}

export async function alternarPergunta(id: string, ativo: boolean): Promise<ResultadoDaAction> {
  try {
    await autorizarAction('logistica.gerenciar')
    await db.perguntaFrequente.update({ where: { id }, data: { ativo } })
    revalidarLogistica()
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}

/**
 * Cria a próxima ocorrência de uma recorrente que acabou de ser concluída.
 *
 * `ocorrenciaAnteriorId` é único no banco: salvar de novo uma conclusão, ou
 * dois cliques ao mesmo tempo, não geram duas próximas.
 */
async function gerarProximaSeConcluida(
  tx: Prisma.TransactionClient,
  demandaId: string,
  agora: Date,
) {
  const d = await tx.demandaLogistica.findUniqueOrThrow({
    where: { id: demandaId },
    include: { proximaOcorrencia: { select: { id: true } } },
  })
  if (d.fase !== 'concluido' || !d.recorrente || !d.periodicidade || d.proximaOcorrencia) return
  if (!d.previsaoConclusao) return

  const datas = proximaOcorrencia(
    {
      periodicidade: d.periodicidade,
      previsaoInicio: d.previsaoInicio,
      previsaoConclusao: d.previsaoConclusao,
    },
    agora,
  )

  await tx.demandaLogistica.create({
    data: {
      origem: 'manual',
      titulo: d.titulo,
      subsidiaria: d.subsidiaria,
      departamento: d.departamento,
      produto: d.produto,
      itens: d.itens,
      prioridade: d.prioridade,
      complexidade: d.complexidade,
      responsavel: d.responsavel,
      observacoes: d.observacoes,
      linkFormulario: d.linkFormulario,
      clickupUrl: d.clickupUrl,
      recorrente: true,
      periodicidade: d.periodicidade,
      fase: 'recebido',
      ocorrenciaAnteriorId: d.id,
      ...datas,
    },
  })
}

export async function salvarDemanda(dados: FormData): Promise<ResultadoDaAction> {
  try {
    await autorizarAction('logistica.gerenciar')

    const validado = demandaSchema.safeParse(Object.fromEntries(dados.entries()))
    if (!validado.success) return primeiroErro(validado.error)
    const { custoEnvio, periodicidade, recorrente, ...campos } = validado.data

    const registro = {
      ...campos,
      recorrente,
      // Desmarcar "recorrente" apaga a periodicidade: a regra do banco exige
      // as duas juntas, e uma periodicidade órfã confundiria a próxima edição.
      periodicidade: recorrente ? periodicidade : null,
      custoEnvio: custoEnvio === null ? null : dinheiro(custoEnvio),
    }
    const agora = new Date()
    const id = String(dados.get('id') ?? '')

    await db.$transaction(async (tx) => {
      let salvaId = id
      if (id) {
        const atual = await tx.demandaLogistica.findUniqueOrThrow({
          where: { id },
          select: { concluidaEm: true },
        })
        await tx.demandaLogistica.update({
          where: { id },
          data: {
            ...registro,
            concluidaEm: concluidaEmParaFase(registro.fase, atual.concluidaEm, agora),
          },
        })
      } else {
        const criada = await tx.demandaLogistica.create({
          data: {
            ...registro,
            origem: 'manual',
            solicitadaEm: agora,
            concluidaEm: concluidaEmParaFase(registro.fase, null, agora),
          },
          select: { id: true },
        })
        salvaId = criada.id
      }
      await gerarProximaSeConcluida(tx, salvaId, agora)
    })

    revalidarLogistica()
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}

/** Arquivar tira a demanda do dashboard sem apagar; desarquivar devolve. */
export async function arquivarDemanda(id: string, arquivar: boolean): Promise<ResultadoDaAction> {
  try {
    await autorizarAction('logistica.gerenciar')
    await db.demandaLogistica.update({ where: { id }, data: { ativa: !arquivar } })
    revalidarLogistica()
    return { ok: true, dados: undefined }
  } catch (e) {
    return comoErro(e)
  }
}
