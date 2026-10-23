import { z } from 'zod'
import { UFS } from '@/lib/tiny/lote'
import { cpfSchema, emailOpcional, telefoneOpcional, textoOpcional } from './comuns'

/**
 * Etiquetas como a tela, a planilha e o site mandam: lista ou texto separado
 * por vírgula ou ponto e vírgula. Sem repetição, ignorando maiúsculas, na
 * ordem em que chegaram.
 */
export function etiquetasDe(valor: unknown): string[] {
  const partes = Array.isArray(valor)
    ? valor.map(String)
    : typeof valor === 'string'
      ? valor.split(/[,;]/)
      : []
  const vistas = new Set<string>()
  const etiquetas: string[] = []
  for (const parte of partes) {
    const etiqueta = parte.replace(/\s+/g, ' ').trim().slice(0, 40)
    const chave = etiqueta.toLowerCase()
    if (etiqueta && !vistas.has(chave)) {
      vistas.add(chave)
      etiquetas.push(etiqueta)
    }
  }
  return etiquetas
}

/** Junta as etiquetas novas às que o cliente já tem: nada se perde ao reimportar. */
export function acumularEtiquetas(atuais: readonly string[], novas: readonly string[]) {
  return etiquetasDe([...atuais, ...novas])
}

const etiquetas = z.preprocess(
  etiquetasDe,
  z.array(z.string()).max(30, 'Até 30 etiquetas por cliente.'),
)

const cepOpcional = z.preprocess(
  (v) => {
    const digitos = typeof v === 'string' ? v.replace(/\D/g, '') : ''
    // O Excel come o zero da frente do CEP guardado como número.
    return digitos.length === 7 ? `0${digitos}` : digitos || null
  },
  z
    .string()
    .regex(/^\d{8}$/, 'CEP precisa ter 8 dígitos.')
    .nullable(),
)

const ufOpcional = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() ? v.trim().toUpperCase() : null),
  z.enum(UFS, { message: 'UF inválida.' }).nullable(),
)

/** O endereço padrão do cliente. Tudo opcional: ele só preenche formulários. */
const endereco = {
  cep: cepOpcional,
  logradouro: textoOpcional,
  numero: textoOpcional,
  complemento: textoOpcional,
  bairro: textoOpcional,
  cidade: textoOpcional,
  uf: ufOpcional,
}

export const clienteSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do cliente.').max(200),
  cpf: cpfSchema,
  telefone: telefoneOpcional,
  email: emailOpcional,
  salesforceId: textoOpcional,
  ...endereco,
  etiquetas,
})

export type ClienteInput = z.input<typeof clienteSchema>

/**
 * Linha do CSV de importação de clientes.
 *
 * A importação é um atalho, não uma integração: o arquivo pode vir de planilha
 * feita à mão, então os cabeçalhos são normalizados antes de chegar aqui.
 */
export const linhaImportacaoClienteSchema = z.object({
  nome: z.string().trim().min(2),
  cpf: cpfSchema,
  telefone: telefoneOpcional,
  email: emailOpcional,
  ...endereco,
  etiquetas,
})

export type LinhaImportacaoCliente = z.output<typeof linhaImportacaoClienteSchema>

/**
 * O cadastro que chega do site da AUVP. CPF é a chave: quem já existe tem o
 * cadastro completado, e as etiquetas se somam.
 */
export const cadastroDoSiteSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome.').max(200),
  cpf: cpfSchema,
  telefone: telefoneOpcional,
  email: emailOpcional,
  ...endereco,
  etiquetas,
})
