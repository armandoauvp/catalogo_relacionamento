import { cnpjValido, cpfValido } from '@/lib/cpf'
import {
  lerLote,
  UFS,
  validarLinha,
  type CampoDoLote,
  type LeituraDoLote,
  type LinhaDoLote,
} from './lote'
import { cepFormatado, corte, digitos, tipoDePessoa, type Destinatario } from './pedido'

/**
 * O contato (cliente) do Tiny: validação daqui e o formato de
 * `contato.incluir.php` e `contato.alterar.php`.
 *
 * Mais solto que o pedido: para atualizar um cadastro bastam nome e CPF/CNPJ.
 * O que vier preenchido é conferido; o que vier vazio fica como está no Tiny.
 */

/** Mesmo formato da linha do lote, para a planilha de contatos usar o mesmo leitor. */
export function validarContato(
  bruto: Partial<Record<CampoDoLote, string>>,
): Omit<LinhaDoLote, 'linha'> {
  // A normalização (zeros do Excel, maiúsculas, espaços) é a mesma do lote.
  const { destinatario: d } = validarLinha({ ...bruto, quantidade: '1', valor: '' })
  const erros: string[] = []

  if (d.nome.length < 3) erros.push('Nome vazio ou curto demais.')
  if (d.cpfCnpj.length === 14 ? !cnpjValido(d.cpfCnpj) : !cpfValido(d.cpfCnpj)) {
    erros.push(d.cpfCnpj ? 'CPF/CNPJ inválido.' : 'CPF/CNPJ em branco.')
  }
  if (d.cep && d.cep.length !== 8) erros.push('CEP precisa ter 8 dígitos.')
  if (d.uf && !(UFS as readonly string[]).includes(d.uf)) erros.push('UF inválida.')
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) erros.push('E-mail inválido.')

  return { destinatario: d, quantidade: 1, valorUnitario: null, erros }
}

export type ContatoParaOTiny = Record<string, string>

/**
 * Na alteração, campo vazio apagaria no Tiny o dado que já está lá: só vai o
 * que foi preenchido. Sem `id`, é inclusão.
 */
export function montarContato(d: Destinatario, id?: string | null): ContatoParaOTiny {
  const campos: ContatoParaOTiny = {
    nome: corte(d.nome, 60),
    tipo_pessoa: tipoDePessoa(d.cpfCnpj),
    cpf_cnpj: digitos(d.cpfCnpj),
    email: corte(d.email, 50),
    fone: digitos(d.telefone).slice(0, 40),
    cep: cepFormatado(d.cep),
    endereco: corte(d.endereco, 50),
    numero: corte(d.numero, 10),
    complemento: corte(d.complemento, 50),
    bairro: corte(d.bairro, 30),
    cidade: corte(d.cidade, 30),
    uf: corte(d.uf, 2).toUpperCase(),
    situacao: 'A',
  }
  const preenchidos = Object.fromEntries(Object.entries(campos).filter(([, v]) => v))
  return id ? { id, ...preenchidos } : { sequencia: '1', ...preenchidos }
}

/** A planilha de atualização cadastral: só Nome e CPF/CNPJ são obrigatórios. */
export function lerContatos(tabela: readonly (readonly string[])[]): LeituraDoLote {
  return lerLote(tabela, { obrigatorias: ['nome', 'cpfCnpj'], validar: validarContato })
}
