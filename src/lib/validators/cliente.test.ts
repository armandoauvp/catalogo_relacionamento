import { describe, expect, it } from 'vitest'
import { acumularEtiquetas, etiquetasDe } from './cliente'

describe('etiquetas do cliente', () => {
  it('aceita texto com vírgula ou ponto e vírgula, sem repetir', () => {
    expect(etiquetasDe('Evento X; turma 3 , evento x,, ')).toEqual(['Evento X', 'turma 3'])
    expect(etiquetasDe(['a', 'A', ' b '])).toEqual(['a', 'b'])
    expect(etiquetasDe(undefined)).toEqual([])
  })

  it('reimportar soma às que já existem, sem perder nenhuma', () => {
    expect(acumularEtiquetas(['Evento X'], ['evento x', 'Site'])).toEqual(['Evento X', 'Site'])
  })
})
