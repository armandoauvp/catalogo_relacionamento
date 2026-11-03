import { z } from 'zod'
import { MotivoEnvio, StatusSolicitacao } from '@prisma/client'
import { cepSchema, textoOpcional, ufSchema, urlOpcional, valorSchema } from './comuns'
import { LIMITE_DA_SAUDACAO } from '@/lib/carta'

/**
 * Um item é de catálogo ou é específico, nunca os dois nem nenhum.
 * A mesma regra existe como CHECK constraint no banco; aqui ela existe para
 * que o consultor receba uma mensagem em vez de um erro de constraint.
 */
export const itemSchema = z
  .object({
    produtoId: z.preprocess(
      (v) => (typeof v === 'string' && v.trim().length > 0 ? v.trim() : null),
      z.string().nullable(),
    ),
    descricaoLivre: textoOpcional,
    urlExterna: urlOpcional,
    valorUnitario: valorSchema,
    quantidade: z.coerce.number().int().min(1, 'Quantidade mínima é 1.').default(1),
  })
  .superRefine((item, ctx) => {
    const deCatalogo = Boolean(item.produtoId)
    const especifico = Boolean(item.descricaoLivre)

    if (deCatalogo && especifico) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Um item é do catálogo ou é específico, não os dois.',
        path: ['produtoId'],
      })
      return
    }

    if (!deCatalogo && !especifico) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Escolha um produto do catálogo ou descreva o presente específico.',
        path: ['descricaoLivre'],
      })
      return
    }

    if (especifico && !item.urlExterna) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Presente específico exige o link onde comprar.',
        path: ['urlExterna'],
      })
    }
  })

export const enderecoEntregaSchema = z.object({
  entregaCep: cepSchema,
  entregaLogradouro: z.string().trim().min(2, 'Informe o logradouro.'),
  entregaNumero: z.string().trim().min(1, 'Informe o número.'),
  entregaComplemento: textoOpcional,
  entregaBairro: z.string().trim().min(2, 'Informe o bairro.'),
  entregaCidade: z.string().trim().min(2, 'Informe a cidade.'),
  entregaUf: ufSchema,
  entregaDestinatario: z.string().trim().min(2, 'Informe quem recebe o presente.'),
})

export const solicitacaoSchema = enderecoEntregaSchema
  .extend({
    clienteId: z.string().min(1, 'Selecione o cliente.'),
    motivo: z.nativeEnum(MotivoEnvio),
    motivoOutro: textoOpcional,
    mensagemCarta: z.string().trim().min(1, 'Escreva a mensagem da carta.').max(5000),
    // Vazia vale: é carta sem saudação.
    saudacaoCarta: z
      .string()
      .trim()
      .max(LIMITE_DA_SAUDACAO, `Use até ${LIMITE_DA_SAUDACAO} caracteres na saudação.`)
      .default(''),
    observacoes: textoOpcional,
    itens: z.array(itemSchema).min(1, 'Adicione pelo menos um item.'),
  })
  .refine((d) => d.motivo !== MotivoEnvio.outro || Boolean(d.motivoOutro), {
    message: 'Descreva o motivo quando escolher "outro".',
    path: ['motivoOutro'],
  })

export type SolicitacaoInput = z.input<typeof solicitacaoSchema>
export type SolicitacaoValidada = z.output<typeof solicitacaoSchema>

/**
 * Mudança de status. A checagem de motivo obrigatório também vive em
 * `validarMudancaDeStatus`, que conhece o status atual; aqui garante-se apenas
 * que o campo chegou em formato utilizável.
 */
export const mudancaDeStatusSchema = z.object({
  solicitacaoId: z.string().min(1),
  statusNovo: z.nativeEnum(StatusSolicitacao),
  motivo: textoOpcional,
})

/**
 * Código de rastreio e transportadora.
 *
 * Os dois são opcionais porque apagar também é uma operação: rastreio digitado
 * errado precisa poder ser limpo, e não corrigido para outro número errado.
 */
export const rastreioSchema = z.object({
  solicitacaoId: z.string().min(1),
  rastreio: textoOpcional,
  transportadora: textoOpcional,
})

export const ROTULO_MOTIVO: Record<MotivoEnvio, string> = {
  aniversario: 'Aniversário',
  casamento: 'Casamento',
  nascimento: 'Nascimento',
  reforco_relacionamento: 'Reforço de relacionamento',
  primeiro_milhao: 'Primeiro milhão',
  outro: 'Outro',
}
