import { describe, expect, it } from 'vitest'
import { lerLote, validarLinha } from './lote'

/** O modelo de planilha do AUVP-Eventos, na ordem dele. */
const CABECALHO_DO_AUVP_EVENTOS = [
  'Nome',
  'Código/Ref',
  'CPF/CNPJ',
  'Email',
  'Endereço',
  'Número',
  'Complemento',
  'Bairro',
  'Cidade',
  'UF',
  'CEP',
  'Telefone',
  'Tipo',
  'Preço',
  'Tag',
]

const linha = (sobrescrever: Partial<Record<string, string>> = {}) => {
  const base: Record<string, string> = {
    Nome: 'Marina Alves Pereira',
    'Código/Ref': '123',
    'CPF/CNPJ': '529.982.247-25',
    Email: 'marina@exemplo.com.br',
    Endereço: 'Avenida Paulista',
    Número: '1000',
    Complemento: '',
    Bairro: 'Bela Vista',
    Cidade: 'São Paulo',
    UF: 'sp',
    CEP: '01310-100',
    Telefone: '11987654321',
    Tipo: 'F',
    Preço: '35',
    Tag: 'X',
    ...sobrescrever,
  }
  return CABECALHO_DO_AUVP_EVENTOS.map((c) => base[c] ?? '')
}

describe('planilha do lote', () => {
  it('lê o modelo do AUVP-Eventos pelo nome das colunas', () => {
    const { linhas, faltando } = lerLote([CABECALHO_DO_AUVP_EVENTOS, linha()])
    expect(faltando).toEqual([])
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toMatchObject({
      linha: 2,
      quantidade: 1,
      erros: [],
      destinatario: { cpfCnpj: '52998224725', cep: '01310100', uf: 'SP' },
    })
  })

  it('aceita colunas em outra ordem e com outros nomes', () => {
    const { linhas } = lerLote([
      ['UF', 'Logradouro', 'Nº', 'Município', 'Bairro', 'CEP', 'CPF', 'Destinatário', 'Qtd'],
      ['RJ', 'Rua X', '10', 'Niterói', 'Icaraí', '24220031', '52998224725', 'Ana Souza', '2'],
    ])
    expect(linhas[0]).toMatchObject({
      quantidade: 2,
      erros: [],
      destinatario: { nome: 'Ana Souza' },
    })
  })

  it('diz quais colunas obrigatórias faltam', () => {
    expect(
      lerLote([
        ['Nome', 'CPF'],
        ['Ana', '52998224725'],
      ]).faltando,
    ).toEqual(['CEP', 'Endereço', 'Número', 'Bairro', 'Cidade', 'UF'])
  })

  it('aponta erro na linha e acusa CPF repetido', () => {
    const { linhas } = lerLote([
      CABECALHO_DO_AUVP_EVENTOS,
      linha(),
      linha({ 'CPF/CNPJ': '111.111.111-11', CEP: '123', UF: 'XX' }),
      linha({ Nome: 'Outra Pessoa' }),
    ])
    expect(linhas[1]!.erros).toEqual(
      expect.arrayContaining(['CPF/CNPJ inválido.', 'CEP precisa ter 8 dígitos.', 'UF inválida.']),
    )
    expect(linhas[2]!.erros).toEqual(['CPF/CNPJ repetido: já está na linha 2.'])
  })

  it('pula linhas vazias e acha o cabeçalho abaixo de um título', () => {
    const { linhas } = lerLote([
      ['Envio de fim de ano'],
      [],
      CABECALHO_DO_AUVP_EVENTOS,
      linha(),
      [],
    ])
    expect(linhas).toHaveLength(1)
    expect(linhas[0]!.linha).toBe(4)
  })
})

describe('uma linha', () => {
  it('devolve os zeros que o Excel comeu do CPF e do CEP', () => {
    const { destinatario, erros } = validarLinha({
      nome: 'Ana Souza',
      cpfCnpj: '369258100', // 00369258100 sem os zeros
      cep: '1310100',
      endereco: 'Rua',
      numero: '1',
      bairro: 'Centro',
      cidade: 'São Paulo',
      uf: 'SP',
    })
    expect(destinatario.cpfCnpj).toBe('00369258100')
    expect(destinatario.cep).toBe('01310100')
    expect(erros).toEqual([])
  })

  it('aceita CNPJ válido e recusa quantidade quebrada', () => {
    const r = validarLinha({
      nome: 'Empresa LTDA',
      cpfCnpj: '11.222.333/0001-81',
      cep: '01310100',
      endereco: 'Rua',
      numero: 'S/N',
      bairro: 'Centro',
      cidade: 'São Paulo',
      uf: 'SP',
      quantidade: '1,5',
    })
    expect(r.erros).toEqual(['Quantidade precisa ser um número inteiro de 1 a 99.'])
  })
})
