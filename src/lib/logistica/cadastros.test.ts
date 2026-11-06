import { describe, expect, it } from 'vitest'
import { DEPARTAMENTOS, opcoesDoCampo, problemaDaClassificacao, SUBSIDIARIAS } from './cadastros'

describe('empresas e departamentos da demanda', () => {
  it('trazem as opções do formulário do Financeiro, sem repetir', () => {
    expect(SUBSIDIARIAS).toHaveLength(7)
    expect(DEPARTAMENTOS).toHaveLength(19)
    expect(new Set(SUBSIDIARIAS).size).toBe(SUBSIDIARIAS.length)
    expect(new Set(DEPARTAMENTOS).size).toBe(DEPARTAMENTOS.length)
  })

  it('a demanda nova só grava o que está na lista', () => {
    expect(
      problemaDaClassificacao({ subsidiaria: 'AUVP Consultoria', departamento: 'Produto' }, null),
    ).toBeNull()
    expect(
      problemaDaClassificacao({ subsidiaria: 'AUVP consultoria', departamento: 'Produto' }, null)
        ?.campo,
    ).toBe('subsidiaria')
    expect(
      problemaDaClassificacao({ subsidiaria: 'DNS', departamento: 'Marketing' }, null)?.campo,
    ).toBe('departamento')
  })

  it('a demanda antiga mantém o valor que tem, mas não troca para outro de fora', () => {
    const atual = { subsidiaria: 'AUVP Holding', departamento: 'Relacionamento' }
    expect(problemaDaClassificacao(atual, atual)).toBeNull()
    expect(
      problemaDaClassificacao({ subsidiaria: 'AUVP Holding', departamento: 'Marketing' }, atual)
        ?.campo,
    ).toBe('departamento')
    expect(
      problemaDaClassificacao(
        { subsidiaria: 'Holding: Supernova', departamento: 'Diretoria' },
        atual,
      ),
    ).toBeNull()
  })

  it('o valor de fora aparece primeiro nas opções, marcado', () => {
    const opcoes = opcoesDoCampo(DEPARTAMENTOS, 'Relacionamento')
    expect(opcoes[0]).toEqual({ valor: 'Relacionamento', foraDaLista: true })
    expect(opcoes).toHaveLength(DEPARTAMENTOS.length + 1)
    expect(opcoesDoCampo(DEPARTAMENTOS, 'Produto')).toHaveLength(DEPARTAMENTOS.length)
    expect(opcoesDoCampo(DEPARTAMENTOS, null)).toHaveLength(DEPARTAMENTOS.length)
  })
})
