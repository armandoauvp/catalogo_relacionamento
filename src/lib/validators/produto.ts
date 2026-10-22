import { z } from 'zod'
import { OrigemProduto, TipoValor } from '@prisma/client'
import {
  inteiroOpcional,
  rotuloOpcional,
  textoOpcional,
  urlOpcional,
  valorOpcional,
} from './comuns'

/**
 * O CRUD de catálogo é operado pela própria área de Relacionamento, sem apoio
 * técnico. As mensagens de erro são escritas para essa leitora.
 */

export const produtoSchema = z
  .object({
    nome: z.string().trim().min(2, 'Informe o nome do produto.').max(200),
    descricao: textoOpcional,
    categoriaId: z.string().min(1, 'Escolha uma categoria.'),
    fotoUrl: urlOpcional,
    /** Vazio é permitido: parte do catálogo veio da área sem preço. */
    valor: valorOpcional,
    tipoValor: z.nativeEnum(TipoValor).default(TipoValor.exato),
    origem: z.nativeEnum(OrigemProduto).default(OrigemProduto.mediante_pedido),
    controlaEstoque: z.boolean().default(false),
    estoque: inteiroOpcional,
    urlCompra: urlOpcional,
    notaDeCompra: textoOpcional,
    /** O que este presente precisa levar junto, como `vinho`. */
    exigeAcompanhamento: rotuloOpcional,
    /** O que este presente satisfaz quando entra junto de um kit. */
    serveComoAcompanhamento: rotuloOpcional,
    ativo: z.boolean().default(true),
    // Obrigatório desde a pauta de 22/10/2026: sem SKU o pedido no Tiny não
    // liga o item ao estoque, e o presente fica parado na fila.
    skuTiny: z
      .string({ message: 'Informe o SKU do produto no Tiny.' })
      .trim()
      .min(1, 'Informe o SKU do produto no Tiny.')
      .max(60, 'SKU com mais de 60 caracteres.'),
  })
  .refine((d) => !d.controlaEstoque || d.estoque !== null, {
    message: 'Produto que controla estoque precisa da quantidade em estoque.',
    path: ['estoque'],
  })
  // O banco tem a mesma trava como CHECK. Aqui ela vira frase, porque quem
  // erra isso é a área cadastrando, e não um script.
  .refine(
    (d) =>
      !d.exigeAcompanhamento ||
      !d.serveComoAcompanhamento ||
      d.exigeAcompanhamento !== d.serveComoAcompanhamento,
    {
      message: 'Um presente não pode ser o próprio acompanhamento que exige.',
      path: ['serveComoAcompanhamento'],
    },
  )

export type ProdutoInput = z.input<typeof produtoSchema>
export type ProdutoValidado = z.output<typeof produtoSchema>

export const categoriaSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome da categoria.').max(100),
  ativo: z.boolean().default(true),
})
