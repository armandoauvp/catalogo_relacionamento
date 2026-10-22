import { z } from 'zod'
import { textoOpcional } from './comuns'

/**
 * Formulários da integração com o Tiny: o lote importado e a configuração dos
 * pedidos de presente.
 */

const textoCurto = (rotulo: string, maximo = 80) =>
  z
    .string({ message: `Informe ${rotulo}.` })
    .trim()
    .min(2, `Informe ${rotulo}.`)
    .max(maximo)

/**
 * O lote como a tela de importação manda: as linhas vêm cruas, como saíram da
 * planilha, e o servidor valida cada uma de novo com `validarLinha`. O que a
 * prévia aprovou não é aceito de olhos fechados.
 */
export const loteSchema = z.object({
  arquivo: z.string().trim().max(200).nullable().default(null),
  marcador: textoCurto('o marcador', 50),
  subsidiaria: textoCurto('a subsidiária'),
  departamento: textoCurto('o departamento'),
  produto: z.object({
    codigo: z.string().trim().max(60).nullable(),
    nome: textoCurto('o produto', 120),
    preco: z
      .string()
      .trim()
      .regex(/^\d+(\.\d+)?$/, 'Preço do produto inválido.'),
  }),
  transportadora: z.string().trim().max(100).nullable().default(null),
  formaFrete: z.string().trim().max(30).nullable().default(null),
  linhas: z
    .array(
      z.object({
        linha: z.number().int().positive(),
        campos: z.record(z.string(), z.string().max(300)),
      }),
    )
    .min(1, 'A planilha não tem nenhuma linha válida.')
    .max(1000, 'Um lote vai até 1.000 linhas; divida a planilha.'),
})

export type DadosDoLote = z.infer<typeof loteSchema>

export const configuracaoTinySchema = z.object({
  enviarPresentes: z.preprocess((v) => v === 'on' || v === true || v === 'true', z.boolean()),
  transportadora: textoOpcional,
  formaFrete: textoOpcional,
  marcadorPresentes: textoCurto('o marcador dos presentes', 50),
})
