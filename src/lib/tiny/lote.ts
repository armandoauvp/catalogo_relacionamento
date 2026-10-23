import { cnpjValido, cpfValido } from '@/lib/cpf'
import type { Destinatario } from './pedido'

/**
 * Leitura da planilha de envio em lote: uma linha por destinatário.
 *
 * As colunas são achadas pelo nome do cabeçalho, com sinônimos, e não pela
 * posição. A planilha modelo do AUVP-Eventos (Nome, Código/Ref, CPF/CNPJ,
 * Email, Endereço, Número, Complemento, Bairro, Cidade, UF, CEP, Telefone,
 * Tipo, Preço, Tag) é lida sem mudança; as colunas que não servem ao pedido
 * são ignoradas.
 *
 * Pura: recebe a tabela já lida, de .xlsx ou .csv, e devolve cada linha com
 * os erros dela. A tela mostra a prévia com isso, e o servidor valida de novo
 * com a mesma função antes de gravar.
 */

export const UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const

export type CampoDoLote = keyof Destinatario | 'quantidade' | 'valor'

const COLUNAS: Record<CampoDoLote, readonly string[]> = {
  nome: ['nome', 'nome completo', 'destinatario', 'cliente', 'nome do cliente'],
  cpfCnpj: ['cpf/cnpj', 'cpf', 'cnpj', 'cpf cnpj', 'cpfcnpj', 'documento'],
  email: ['email', 'e-mail', 'e mail'],
  telefone: ['telefone', 'fone', 'celular', 'whatsapp'],
  cep: ['cep'],
  endereco: ['endereco', 'logradouro', 'rua'],
  numero: ['numero', 'n', 'no', 'num', 'nº', 'n°'],
  complemento: ['complemento'],
  bairro: ['bairro'],
  cidade: ['cidade', 'municipio'],
  uf: ['uf', 'estado'],
  quantidade: ['quantidade', 'qtd', 'qtde'],
  // Opcional: sem ela, vale o preço do lote. É a coluna "Preço" do AUVP-Eventos.
  valor: ['valor', 'preco', 'valor unitario', 'preco unitario'],
}

const OBRIGATORIAS: readonly CampoDoLote[] = [
  'nome',
  'cpfCnpj',
  'cep',
  'endereco',
  'numero',
  'bairro',
  'cidade',
  'uf',
]

export const ROTULO_DA_COLUNA: Record<CampoDoLote, string> = {
  nome: 'Nome',
  cpfCnpj: 'CPF/CNPJ',
  email: 'Email',
  telefone: 'Telefone',
  cep: 'CEP',
  endereco: 'Endereço',
  numero: 'Número',
  complemento: 'Complemento',
  bairro: 'Bairro',
  cidade: 'Cidade',
  uf: 'UF',
  quantidade: 'Quantidade',
  valor: 'Valor',
}

const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.:]/g, '').trim()

const digitos = (texto: string) => texto.replace(/\D/g, '')

export type LinhaDoLote = {
  /** Número da linha na planilha, contando o cabeçalho, como o Excel mostra. */
  linha: number
  destinatario: Destinatario
  quantidade: number
  /** Valor unitário desta linha, "35.00"; nulo usa o preço do lote. */
  valorUnitario: string | null
  erros: string[]
}

export type LeituraDoLote = {
  linhas: LinhaDoLote[]
  /** Colunas obrigatórias que o cabeçalho não tem. Com alguma faltando, nada é lido. */
  faltando: string[]
}

/** Uma linha já mapeada para os campos, com a validação de cada um. */
export function validarLinha(
  bruto: Partial<Record<CampoDoLote, string>>,
): Omit<LinhaDoLote, 'linha'> {
  const valor = (campo: CampoDoLote) => (bruto[campo] ?? '').replace(/\s+/g, ' ').trim()
  const erros: string[] = []

  // O Excel guarda CPF e CEP como número e come os zeros da frente.
  let documento = digitos(valor('cpfCnpj'))
  if (documento.length === 9 || documento.length === 10) documento = documento.padStart(11, '0')
  let cep = digitos(valor('cep'))
  if (cep.length === 7) cep = cep.padStart(8, '0')

  const destinatario: Destinatario = {
    nome: valor('nome'),
    cpfCnpj: documento,
    email: valor('email').toLowerCase() || null,
    telefone: digitos(valor('telefone')) || null,
    cep,
    endereco: valor('endereco'),
    numero: valor('numero'),
    complemento: valor('complemento') || null,
    bairro: valor('bairro'),
    cidade: valor('cidade'),
    uf: valor('uf').toUpperCase(),
  }

  if (destinatario.nome.length < 3) erros.push('Nome vazio ou curto demais.')
  if (documento.length === 14 ? !cnpjValido(documento) : !cpfValido(documento)) {
    erros.push(documento ? 'CPF/CNPJ inválido.' : 'CPF/CNPJ em branco.')
  }
  if (cep.length !== 8) erros.push('CEP precisa ter 8 dígitos.')
  if (!destinatario.endereco) erros.push('Endereço em branco.')
  if (!destinatario.numero) erros.push('Número em branco (use "S/N" se não houver).')
  if (!destinatario.bairro) erros.push('Bairro em branco.')
  if (!destinatario.cidade) erros.push('Cidade em branco.')
  if (!(UFS as readonly string[]).includes(destinatario.uf)) erros.push('UF inválida.')
  if (destinatario.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinatario.email)) {
    erros.push('E-mail inválido.')
  }

  const textoQtd = valor('quantidade')
  const quantidade = textoQtd ? Number(textoQtd.replace(',', '.')) : 1
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 99) {
    erros.push('Quantidade precisa ser um número inteiro de 1 a 99.')
  }

  const valorUnitario = valorDaCelula(valor('valor'))
  if (valorUnitario === undefined) erros.push('Valor inválido: use só o número, como 35,00.')

  return {
    destinatario,
    quantidade: Number.isInteger(quantidade) ? quantidade : 1,
    valorUnitario: valorUnitario ?? null,
    erros,
  }
}

/**
 * "R$ 1.234,56", "35,5" e "35.00" viram "1234.56", "35.50" e "35.00". Vazio é
 * nulo (vale o preço do lote); o que não é dinheiro é `undefined`, um erro.
 */
export function valorDaCelula(texto: string): string | null | undefined {
  const limpo = texto.replace(/R\$|\s/g, '')
  if (!limpo) return null
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return undefined
  return Number(normal).toFixed(2)
}

const AVISO_DE_REPETIDO = 'CPF/CNPJ repetido'

/**
 * Marca a segunda linha de um mesmo CPF/CNPJ. Refeita a cada correção na
 * prévia: mudar o documento de uma linha pode resolver ou criar a repetição.
 */
export function conferirRepetidos<
  T extends { linha: number; destinatario: Destinatario; erros: string[] },
>(linhas: readonly T[]): T[] {
  const vistos = new Map<string, number>()
  return linhas.map((l) => {
    const erros = l.erros.filter((e) => !e.startsWith(AVISO_DE_REPETIDO))
    const doc = l.destinatario.cpfCnpj
    if (doc && vistos.has(doc)) {
      erros.push(`${AVISO_DE_REPETIDO}: já está na linha ${vistos.get(doc)}.`)
    } else if (doc) {
      vistos.set(doc, l.linha)
    }
    return { ...l, erros }
  })
}

/**
 * A planilha de contatos usa o mesmo leitor com outras colunas obrigatórias e
 * outra validação; ver `lerContatos`.
 */
export type OpcoesDeLeitura = {
  obrigatorias?: readonly CampoDoLote[]
  validar?: (bruto: Partial<Record<CampoDoLote, string>>) => Omit<LinhaDoLote, 'linha'>
}

export function lerLote(
  tabela: readonly (readonly string[])[],
  { obrigatorias = OBRIGATORIAS, validar = validarLinha }: OpcoesDeLeitura = {},
): LeituraDoLote {
  // O cabeçalho é a primeira linha que tem uma coluna de nome.
  const inicio = tabela.findIndex((linha) =>
    linha.some((celula) => COLUNAS.nome.includes(normalizar(celula))),
  )
  if (inicio < 0) {
    return { linhas: [], faltando: obrigatorias.map((c) => ROTULO_DA_COLUNA[c]) }
  }

  const titulos = tabela[inicio]!.map(normalizar)
  const posicao = Object.fromEntries(
    (Object.keys(COLUNAS) as CampoDoLote[]).map((campo) => [
      campo,
      titulos.findIndex((t) => COLUNAS[campo].includes(t)),
    ]),
  ) as Record<CampoDoLote, number>

  const faltando = obrigatorias.filter((c) => posicao[c] < 0).map((c) => ROTULO_DA_COLUNA[c])
  if (faltando.length) return { linhas: [], faltando }

  const linhas: LinhaDoLote[] = []

  tabela.slice(inicio + 1).forEach((celulas, i) => {
    if (celulas.every((c) => !String(c ?? '').trim())) return
    const numero = inicio + i + 2
    const bruto = Object.fromEntries(
      (Object.keys(COLUNAS) as CampoDoLote[]).map((campo) => [
        campo,
        posicao[campo] >= 0 ? String(celulas[posicao[campo]] ?? '') : '',
      ]),
    )
    linhas.push({ linha: numero, ...validar(bruto) })
  })

  return { linhas: conferirRepetidos(linhas), faltando: [] }
}
