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

const valorEmTexto = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, 'Valor inválido.')

/**
 * "Nova venda": um pedido montado à mão. O destinatário vem cru e passa pelo
 * mesmo `validarLinha` do lote; a chave é gerada pela tela quando ela abre,
 * para dois cliques no enviar não virarem dois pedidos.
 */
export const pedidoAvulsoSchema = z.object({
  chave: z.string().uuid('Abra a tela de novo para enviar.'),
  destinatario: z.record(z.string(), z.string().max(300)),
  itens: z
    .array(
      z.object({
        // Pauta de 22/10/2026: sem SKU o Tiny não liga o item ao estoque.
        codigo: z.string().trim().min(1, 'Item sem SKU no Tiny.').max(60),
        descricao: textoCurto('a descrição do item', 120),
        quantidade: z.number().int().min(1, 'Quantidade mínima é 1.').max(999),
        valorUnitario: valorEmTexto,
      }),
    )
    .min(1, 'Ponha ao menos um item no pedido.')
    .max(50, 'Um pedido vai até 50 itens.'),
  transportadora: z.string().trim().max(100).nullable().default(null),
  formaFrete: z.string().trim().max(30).nullable().default(null),
  marcador: z.string().trim().max(50).nullable().default(null),
  observacao: z.string().trim().max(300).nullable().default(null),
})

export const configuracaoTinySchema = z.object({
  enviarPresentes: z.preprocess((v) => v === 'on' || v === true || v === 'true', z.boolean()),
  transportadora: textoOpcional,
  formaFrete: textoOpcional,
  marcadorPresentes: textoCurto('o marcador dos presentes', 50),
})
