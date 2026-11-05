import { z } from 'zod'
import { cpfValido, normalizarCpf } from '@/lib/cpf'
import { cepValido, normalizarCep } from '@/lib/cep'

/**
 * Blocos reutilizados pelos schemas de formulário.
 *
 * Campos opcionais usam `preprocess` em vez de `.optional().nullable()` porque
 * formulário HTML manda string vazia, e não `undefined`. Sem a normalização, o
 * banco acumularia `""` ao lado de `NULL` no mesmo campo e toda consulta
 * passaria a testar as duas coisas.
 */

/** Ausente, vazio ou só espaços viram `null`. */
const vazioViraNulo = (v: unknown) =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : null

export const cpfSchema = z
  .string()
  .transform(normalizarCpf)
  .refine(cpfValido, { message: 'CPF inválido.' })

export const cepSchema = z
  .string()
  .transform(normalizarCep)
  .refine(cepValido, { message: 'CEP deve ter 8 dígitos.' })

export const ufSchema = z.string().trim().toUpperCase().length(2, 'UF deve ter 2 letras.')

/** Texto livre opcional. */
export const textoOpcional = z.preprocess(vazioViraNulo, z.string().nullable())

/**
 * Rótulo de acompanhamento, como `vinho`.
 *
 * Minúsculo e sem espaço nas pontas porque o pareamento entre o kit e a
 * garrafa é comparação de texto exata: "Vinho" cadastrado num e "vinho" no
 * outro deixaria a trava passar sem ninguém entender por quê.
 */
export const rotuloOpcional = z.preprocess(
  vazioViraNulo,
  z
    .string()
    .max(40, 'Use um rótulo curto, como "vinho".')
    .transform((v) => v.toLowerCase())
    .nullable(),
)

/** Link opcional, validado só quando preenchido. */
export const urlOpcional = z.preprocess(
  vazioViraNulo,
  z.string().url('Informe um link válido.').nullable(),
)

/** E-mail opcional, validado só quando preenchido. */
export const emailOpcional = z.preprocess(
  vazioViraNulo,
  z.string().email('E-mail inválido.').nullable(),
)

/** Telefone só com dígitos: 10 (fixo) ou 11 (celular). Opcional. */
export const telefoneOpcional = z.preprocess(
  (v) => {
    if (typeof v !== 'string') return null
    const digitos = v.replace(/\D/g, '')
    return digitos.length > 0 ? digitos : null
  },
  z
    .string()
    .refine((v) => v.length === 10 || v.length === 11, {
      message: 'Telefone deve ter 10 ou 11 dígitos.',
    })
    .nullable(),
)

/** Valor monetário aceito como "1.234,56" ou "1234.56". */
export const valorSchema = z
  .union([z.string(), z.number()])
  .transform((v) => {
    if (typeof v === 'number') return v
    const limpo = v.trim().replace(/\s/g, '')
    if (limpo.includes(',')) return Number(limpo.replace(/\./g, '').replace(',', '.'))
    // Sem vírgula, ponto com um ou dois dígitos no fim é centavo; com três, é
    // milhar: "1234.56" não pode virar 123456, nem "1.250" virar 1,25.
    return Number(/\.\d{1,2}$/.test(limpo) ? limpo : limpo.replace(/\./g, ''))
  })
  .refine((v) => Number.isFinite(v) && v >= 0, { message: 'Valor inválido.' })

/**
 * Valor monetário opcional. Vazio vira `null`, e nulo não é zero: parte do
 * catálogo chegou da área sem preço, e "R$ 0,00" se leria como grátis.
 */
export const valorOpcional = z.preprocess((v) => {
  if (v === null || v === undefined) return null
  if (typeof v === 'string' && v.trim() === '') return null
  return v
}, valorSchema.nullable())

/** Inteiro não negativo opcional, usado no estoque. */
export const inteiroOpcional = z.preprocess((v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : v
}, z.number().int().min(0, 'Não pode ser negativo.').nullable())
