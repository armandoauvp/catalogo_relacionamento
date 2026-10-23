import type { Prisma } from '@prisma/client'
import { formatarCpf } from '@/lib/cpf'
import { formatarISO } from '@/lib/datas'
import type { ColunaExport, LinhaExport } from './linhas'

/**
 * Exportação da base de clientes em Excel. As primeiras colunas têm os nomes
 * que a importação de clientes reconhece: a planilha baixada volta como está,
 * depois de editada.
 */

export const COLUNAS_DE_CLIENTES = [
  { chave: 'nome', titulo: 'Nome', largura: 32, tipo: 'texto' },
  { chave: 'cpf', titulo: 'CPF', largura: 16, tipo: 'texto' },
  { chave: 'telefone', titulo: 'Telefone', largura: 15, tipo: 'texto' },
  { chave: 'email', titulo: 'Email', largura: 30, tipo: 'texto' },
  { chave: 'cep', titulo: 'CEP', largura: 11, tipo: 'texto' },
  { chave: 'logradouro', titulo: 'Endereço', largura: 32, tipo: 'texto' },
  { chave: 'numero', titulo: 'Número', largura: 9, tipo: 'texto' },
  { chave: 'complemento', titulo: 'Complemento', largura: 18, tipo: 'texto' },
  { chave: 'bairro', titulo: 'Bairro', largura: 20, tipo: 'texto' },
  { chave: 'cidade', titulo: 'Cidade', largura: 20, tipo: 'texto' },
  { chave: 'uf', titulo: 'UF', largura: 5, tipo: 'texto' },
  { chave: 'etiquetas', titulo: 'Etiquetas', largura: 30, tipo: 'texto' },
  { chave: 'origem', titulo: 'Origem', largura: 12, tipo: 'texto' },
  { chave: 'cadastro', titulo: 'Cadastro', largura: 12, tipo: 'data' },
  { chave: 'solicitacoes', titulo: 'Solicitações', largura: 12, tipo: 'numero' },
  { chave: 'valorEnviado', titulo: 'Total enviado', largura: 14, tipo: 'numero' },
] as const satisfies readonly ColunaExport[]

export type ClienteParaExportar = {
  nome: string
  cpf: string
  telefone: string | null
  email: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  etiquetas: string[]
  origem: string
  criadoEm: Date
  solicitacoes: number
  total: Prisma.Decimal | null
}

export function linhaDoCliente(c: ClienteParaExportar): LinhaExport {
  return {
    nome: c.nome,
    cpf: formatarCpf(c.cpf),
    telefone: c.telefone,
    email: c.email,
    cep: c.cep,
    logradouro: c.logradouro,
    numero: c.numero,
    complemento: c.complemento,
    bairro: c.bairro,
    cidade: c.cidade,
    uf: c.uf,
    // Vírgula, que é o que a importação separa.
    etiquetas: c.etiquetas.join(', '),
    origem: c.origem,
    cadastro: formatarISO(c.criadoEm),
    solicitacoes: c.solicitacoes,
    valorEnviado: c.total ? Number(c.total) : 0,
  }
}
