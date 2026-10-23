import { describe, expect, it } from 'vitest'
import { lerCsvDeClientes } from './importacao-clientes'

const CPF_A = '529.982.247-25'
const CPF_B = '111.444.777-35'

describe('leitura do CSV de clientes', () => {
  it('aceita o ponto e vírgula do Excel pt-BR', () => {
    const leitura = lerCsvDeClientes(`nome;cpf;telefone\nMarina;${CPF_A};11988887777`)
    expect(leitura.erros).toEqual([])
    expect(leitura.validas).toMatchObject([
      { nome: 'Marina', cpf: '52998224725', telefone: '11988887777', email: null },
    ])
  })

  it('aceita a vírgula do Google Sheets', () => {
    const leitura = lerCsvDeClientes(`nome,cpf\nMarina,${CPF_A}`)
    expect(leitura.validas).toHaveLength(1)
  })

  it('ignora acento e caixa no cabeçalho, e aceita sinônimos', () => {
    const leitura = lerCsvDeClientes(`Nome Completo;Documento;Celular;E-mail
Marina Alves;${CPF_A};(11) 98888-7777;marina@exemplo.com`)
    expect(leitura.validas[0]).toMatchObject({
      nome: 'Marina Alves',
      cpf: '52998224725',
      telefone: '11988887777',
      email: 'marina@exemplo.com',
    })
  })

  it('engole o BOM que o Excel escreve antes do primeiro cabeçalho', () => {
    const leitura = lerCsvDeClientes(`﻿nome;cpf\nMarina;${CPF_A}`)
    expect(leitura.validas).toHaveLength(1)
  })

  it('respeita aspas: nome com vírgula não vira duas colunas', () => {
    const leitura = lerCsvDeClientes(`nome,cpf\n"Alves, Marina",${CPF_A}`)
    expect(leitura.validas[0]?.nome).toBe('Alves, Marina')
  })

  it('linha inválida não derruba o arquivo, e volta numerada como na planilha', () => {
    const leitura = lerCsvDeClientes(`nome;cpf
Marina;${CPF_A}
Sem CPF;123
Roberto;${CPF_B}`)

    expect(leitura.total).toBe(3)
    expect(leitura.validas.map((l) => l.nome)).toEqual(['Marina', 'Roberto'])
    expect(leitura.erros).toEqual([{ linha: 3, motivo: 'CPF inválido.' }])
  })

  it('recusa o arquivo sem as colunas obrigatórias, em vez de importar vazio', () => {
    const leitura = lerCsvDeClientes(`apelido;telefone\nMari;11988887777`)
    expect(leitura.validas).toEqual([])
    expect(leitura.erros[0]?.motivo).toMatch(/nome.*cpf/i)
  })

  it('CPF repetido no arquivo grava uma vez só, valendo a última linha', () => {
    const leitura = lerCsvDeClientes(`nome;cpf
Marina;${CPF_A}
Marina Alves Pereira;${CPF_A}`)

    expect(leitura.validas).toHaveLength(1)
    expect(leitura.validas[0]?.nome).toBe('Marina Alves Pereira')
    expect(leitura.erros[0]?.motivo).toMatch(/mais de uma vez/)
  })

  it('arquivo vazio não quebra', () => {
    expect(lerCsvDeClientes('')).toEqual({ total: 0, validas: [], erros: [] })
  })
})

describe('endereço e etiquetas no CSV de clientes', () => {
  it('lê o endereço padrão e as etiquetas, e devolve o zero do CEP', () => {
    const leitura = lerCsvDeClientes(
      `nome;cpf;cep;endereço;número;bairro;cidade;uf;tags\nMarina;${CPF_A};1310100;Av Paulista;1000;Bela Vista;São Paulo;sp;Evento X, turma 3; evento x`,
    )
    expect(leitura.erros).toEqual([])
    expect(leitura.validas[0]).toMatchObject({
      cep: '01310100',
      logradouro: 'Av Paulista',
      uf: 'SP',
      etiquetas: ['Evento X', 'turma 3'],
    })
  })

  it('UF que não existe é erro da linha', () => {
    const leitura = lerCsvDeClientes(`nome;cpf;uf\nMarina;${CPF_A};XX`)
    expect(leitura.erros).toEqual([{ linha: 2, motivo: 'UF inválida.' }])
  })
})
