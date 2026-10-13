import { z } from 'zod'
import {
  ComplexidadeDemanda,
  FaseOperacional,
  Periodicidade,
  PrioridadeDemanda,
  SituacaoOperacional,
} from '@prisma/client'
import { fimDoDiaLocal } from '@/lib/datas'
import { semanasNoAno } from '@/lib/periodo'
import { emailOpcional, urlOpcional, valorOpcional } from './comuns'

/**
 * Formulários do módulo de Logística: demanda, status da semana, equipe e FAQ.
 */

/** Campo ausente ou em branco é nulo, e não string vazia. */
const vazioViraNulo = (v: unknown) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ? null : v

const inteiro = (v: unknown) => (v === '' || v === null || v === undefined ? undefined : Number(v))

export const statusDaSemanaSchema = z
  .object({
    ano: z.preprocess(inteiro, z.number().int().min(2000).max(2100)),
    semana: z.preprocess(
      inteiro,
      z.number().int().min(1, 'Semana inválida.').max(53, 'Semana inválida.'),
    ),
    /** `automatico` devolve a semana para a sugestão dos números. */
    situacao: z
      .union([z.nativeEnum(SituacaoOperacional), z.literal('automatico')])
      .transform((v) => (v === 'automatico' ? null : v)),
    observacao: z.preprocess(
      vazioViraNulo,
      z.string().trim().max(280, 'Use até 280 caracteres.').nullable(),
    ),
  })
  // A semana 53 só existe em alguns anos; 2025 tem 52.
  .refine((d) => d.semana <= semanasNoAno(d.ano), { message: 'Semana inválida.', path: ['semana'] })

export const membroSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome.').max(80),
  funcao: z.string().trim().min(2, 'Informe a função.').max(80),
  descricao: z.preprocess(
    vazioViraNulo,
    z.string().trim().max(400, 'Use até 400 caracteres.').nullable(),
  ),
  email: emailOpcional,
  ordem: z.preprocess(inteiro, z.number().int().min(0).max(999).default(0)),
})

export const perguntaSchema = z.object({
  pergunta: z.string().trim().min(5, 'Escreva a pergunta.').max(200, 'Use até 200 caracteres.'),
  resposta: z.string().trim().min(2, 'Escreva a resposta.').max(4000),
  ordem: z.preprocess(inteiro, z.number().int().min(0).max(999).default(0)),
})

/** Data do `<input type="date">`, guardada como o fim daquele dia em São Paulo. */
const diaObrigatorio = (mensagem: string) =>
  z.preprocess(
    (v) => fimDoDiaLocal(typeof v === 'string' ? v : null),
    z.date({ message: mensagem }),
  )

const diaOpcional = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() ? fimDoDiaLocal(v) : null),
  z.date({ message: 'Data inválida.' }).nullable(),
)

const textoCurto = (rotulo: string) =>
  z
    .string({ message: `Informe ${rotulo}.` })
    .trim()
    .min(2, `Informe ${rotulo}.`)
    .max(80)

/**
 * Cadastro de demanda na trilha. A Logística cadastra à mão (os áudios de
 * 09/10/2026): subsidiária e departamento alimentam o gráfico, complexidade
 * pesa no prazo, e a previsão de conclusão é obrigatória pelo relatório.
 */
export const demandaSchema = z
  .object({
    titulo: z.string().trim().min(3, 'Escreva o título da demanda.').max(160),
    /** Um item por linha; mais de um vira "Kit" na trilha. */
    itens: z.preprocess(
      (v) =>
        String(v ?? '')
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
      z.array(z.string().max(120, 'Item com mais de 120 caracteres.')).max(30),
    ),
    subsidiaria: textoCurto('a subsidiária'),
    departamento: textoCurto('o departamento'),
    produto: z.preprocess(vazioViraNulo, z.string().trim().max(80).nullable()),
    responsavel: z.preprocess(vazioViraNulo, z.string().trim().max(80).nullable()),
    fase: z.nativeEnum(FaseOperacional, { message: 'Escolha a fase.' }),
    prioridade: z.nativeEnum(PrioridadeDemanda, { message: 'Escolha a prioridade.' }),
    complexidade: z.nativeEnum(ComplexidadeDemanda, { message: 'Escolha a complexidade.' }),
    previsaoInicio: diaOpcional,
    previsaoConclusao: diaObrigatorio('Informe a previsão de conclusão.'),
    clickupUrl: urlOpcional,
    linkFormulario: urlOpcional,
    observacoes: z.preprocess(vazioViraNulo, z.string().trim().max(2000).nullable()),
    custoEnvio: valorOpcional,
    recorrente: z.preprocess((v) => v === 'on' || v === true || v === 'true', z.boolean()),
    periodicidade: z.preprocess(
      vazioViraNulo,
      z.nativeEnum(Periodicidade, { message: 'Periodicidade inválida.' }).nullable(),
    ),
  })
  .refine((d) => !d.recorrente || d.periodicidade !== null, {
    message: 'Diga de quanto em quanto tempo a demanda volta.',
    path: ['periodicidade'],
  })
  .refine((d) => !d.previsaoInicio || d.previsaoInicio <= d.previsaoConclusao, {
    message: 'O início previsto vem depois da conclusão.',
    path: ['previsaoInicio'],
  })
