import { describe, expect, it } from 'vitest'
import { bearerConfere } from './segredo'

describe('segredo no cabeçalho', () => {
  it('confere só o Bearer exato', () => {
    expect(bearerConfere('Bearer abc', 'abc')).toBe(true)
    expect(bearerConfere('Bearer abd', 'abc')).toBe(false)
    expect(bearerConfere('abc', 'abc')).toBe(false)
    expect(bearerConfere(null, 'abc')).toBe(false)
  })

  it('sem segredo configurado, nada passa', () => {
    expect(bearerConfere('Bearer ', '')).toBe(false)
  })
})
