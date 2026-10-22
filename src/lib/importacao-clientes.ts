import { linhaImportacaoClienteSchema, type LinhaImportacaoCliente } from './validators/cliente'

/**
 * Leitura do CSV de clientes.
 *
 * A importação é um atalho, não uma integração: o arquivo costuma ser um
 * "salvar como CSV" de planilha feita à mão. Três consequências no desenho:
 *
 * - o separador é detectado, porque o Excel pt-BR salva com `;` e o Sheets
 *   com `,`;
 * - o cabeçalho é normalizado (sem acento, sem caixa), então "Nome", "nome" e
 *   "NOME COMPLETO" chegam no mesmo lugar;
 * - uma linha inválida não derruba o arquivo. Ela volta numerada, com o
 *   motivo, para quem exportou corrigir e reenviar.
 */

export type ErroDeLinha = { linha: number; motivo: string }

export type LeituraDoCsv = {
  /** Linhas de dados encontradas, válidas ou não. */
  total: number
  validas: LinhaImportacaoCliente[]
  erros: ErroDeLinha[]
}

export type ResumoDaImportacao = {
  total: number
  novas: number
  atualizadas: number
  erros: ErroDeLinha[]
}

const SEM_ACENTO = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

/** Sinônimos aceitos em cada coluna. O primeiro é o nome canônico. */
const COLUNAS: Record<keyof LinhaImportacaoCliente, readonly string[]> = {
  nome: ['nome', 'nome completo', 'cliente', 'nome do cliente'],
  cpf: ['cpf', 'documento', 'cpf/cnpj'],
  telefone: ['telefone', 'celular', 'fone', 'whatsapp'],
  email: ['email', 'e-mail', 'e mail'],
}

function detectarSeparador(cabecalho: string): string {
  const candidatos = [';', ',', '\t']
  // O separador certo é o que mais divide a linha de cabeçalho.
  return candidatos.reduce((melhor, atual) =>
    cabecalho.split(atual).length > cabecalho.split(melhor).length ? atual : melhor,
  )
}

/**
 * Divide uma linha respeitando aspas.
 *
 * Endereço e nome com vírgula são comuns o bastante para que um `split` puro
 * corrompa a planilha em silêncio.
 */
function dividir(linha: string, separador: string): string[] {
  const campos: string[] = []
  let atual = ''
  let dentroDeAspas = false

  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]

    if (c === '"') {
      if (dentroDeAspas && linha[i + 1] === '"') {
        atual += '"'
        i++
      } else {
        dentroDeAspas = !dentroDeAspas
      }
      continue
    }

    if (c === separador && !dentroDeAspas) {
      campos.push(atual)
      atual = ''
      continue
    }

    atual += c
  }

  campos.push(atual)
  return campos.map((campo) => campo.trim())
}

/**
 * O CSV como tabela de células, com o mesmo cuidado de aspas e separador.
 * A importação em lote do Tiny lê a planilha por aqui quando ela vem em .csv.
 */
export function tabelaDoCsv(conteudo: string): string[][] {
  const linhas = conteudo.replace(/^﻿/, '').split(/\r?\n/)
  const separador = detectarSeparador(linhas.find((l) => l.trim()) ?? '')
  return linhas.map((linha) => (linha.trim() ? dividir(linha, separador) : []))
}

export function lerCsvDeClientes(conteudo: string): LeituraDoCsv {
  // O BOM que o Excel escreve gruda no primeiro cabeçalho e o torna
  // irreconhecível.
  const linhas = conteudo
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((linha) => linha.trim().length > 0)

  const cabecalho = linhas[0]
  if (!cabecalho) return { total: 0, validas: [], erros: [] }

  const separador = detectarSeparador(cabecalho)
  const titulos = dividir(cabecalho, separador).map(SEM_ACENTO)

  const indice = (campo: keyof LinhaImportacaoCliente) =>
    titulos.findIndex((titulo) => COLUNAS[campo].includes(titulo))

  const posicoes = {
    nome: indice('nome'),
    cpf: indice('cpf'),
    telefone: indice('telefone'),
    email: indice('email'),
  }

  if (posicoes.nome < 0 || posicoes.cpf < 0) {
    return {
      total: 0,
      validas: [],
      erros: [{ linha: 1, motivo: 'O arquivo precisa ter as colunas "nome" e "cpf".' }],
    }
  }

  const validas: LinhaImportacaoCliente[] = []
  const erros: ErroDeLinha[] = []

  for (const [posicao, linha] of linhas.slice(1).entries()) {
    // +2: a primeira linha é o cabeçalho, e a contagem é a que a pessoa vê na
    // planilha, começando em 1.
    const numero = posicao + 2
    const campos = dividir(linha, separador)
    const em = (i: number) => (i >= 0 ? (campos[i] ?? '') : '')

    const validado = linhaImportacaoClienteSchema.safeParse({
      nome: em(posicoes.nome),
      cpf: em(posicoes.cpf),
      telefone: em(posicoes.telefone),
      email: em(posicoes.email),
    })

    if (!validado.success) {
      erros.push({ linha: numero, motivo: validado.error.issues[0]?.message ?? 'Linha inválida.' })
      continue
    }

    validas.push(validado.data)
  }

  // CPF repetido dentro do próprio arquivo: vale a última ocorrência, que é o
  // que aconteceria de qualquer forma ao gravar linha a linha, mas assim a
  // pessoa fica sabendo.
  const porCpf = new Map<string, LinhaImportacaoCliente>()
  for (const linha of validas) {
    if (porCpf.has(linha.cpf)) {
      erros.push({
        linha: 0,
        motivo: `CPF ${linha.cpf} aparece mais de uma vez no arquivo; valeu a última linha.`,
      })
    }
    porCpf.set(linha.cpf, linha)
  }

  return { total: linhas.length - 1, validas: [...porCpf.values()], erros }
}
