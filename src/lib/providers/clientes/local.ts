import { db } from '@/lib/db'
import { normalizarCpf } from '@/lib/cpf'
import type { ClienteEncontrado, ClienteProvider, EnderecoDoCliente } from '../types'

/** Implementação do V1: clientes cadastrados e importados no próprio Postgres. */

const CAMPOS = {
  id: true,
  nome: true,
  cpf: true,
  telefone: true,
  email: true,
  salesforceId: true,
  origem: true,
  cep: true,
  logradouro: true,
  numero: true,
  complemento: true,
  bairro: true,
  cidade: true,
  uf: true,
  etiquetas: true,
} as const

type Linha = {
  id: string
  nome: string
  cpf: string
  telefone: string | null
  email: string | null
  salesforceId: string | null
  origem: ClienteEncontrado['origem']
  etiquetas: string[]
} & { [K in keyof EnderecoDoCliente]: string | null }

/** O endereço só conta quando tem ao menos o CEP; pedaço solto não preenche nada. */
export function comoEncontrado(c: Linha): ClienteEncontrado {
  const { cep, logradouro, numero, complemento, bairro, cidade, uf, ...resto } = c
  return {
    ...resto,
    endereco: cep
      ? {
          cep,
          logradouro: logradouro ?? '',
          numero: numero ?? '',
          complemento: complemento ?? '',
          bairro: bairro ?? '',
          cidade: cidade ?? '',
          uf: uf ?? '',
        }
      : null,
  }
}

export const clientesLocal: ClienteProvider = {
  nome: 'local',

  async buscarPorCpf(cpf: string): Promise<ClienteEncontrado | null> {
    const limpo = normalizarCpf(cpf)
    if (limpo.length !== 11) return null

    const c = await db.cliente.findUnique({ where: { cpf: limpo }, select: CAMPOS })
    return c ? comoEncontrado(c) : null
  },

  async buscarPorTexto(termo: string, limite = 10): Promise<ClienteEncontrado[]> {
    const busca = termo.trim()
    if (busca.length < 3) return []

    // Um termo só de dígitos é tratado como CPF parcial; o resto, como nome.
    const somenteDigitos = normalizarCpf(busca)
    const where =
      somenteDigitos.length >= 3 && somenteDigitos.length === busca.replace(/[.\-\s]/g, '').length
        ? { cpf: { startsWith: somenteDigitos } }
        : { nome: { contains: busca, mode: 'insensitive' as const } }

    const clientes = await db.cliente.findMany({
      where,
      select: CAMPOS,
      orderBy: { nome: 'asc' },
      take: limite,
    })
    return clientes.map(comoEncontrado)
  },

  async obter(id: string): Promise<ClienteEncontrado | null> {
    const c = await db.cliente.findUnique({ where: { id }, select: CAMPOS })
    return c ? comoEncontrado(c) : null
  },
}
