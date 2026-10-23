import { describe, expect, it } from 'vitest'
import { filtroDoHistoricoSchema, rotuloDoEvento, whereDoHistorico } from './historico'

const filtro = (bruto: Record<string, string>) => filtroDoHistoricoSchema.parse(bruto)

describe('histórico do Tiny', () => {
  it('sem filtro, traz tudo da primeira página', () => {
    const f = filtro({})
    expect(whereDoHistorico(f)).toEqual({})
    expect(f.pagina).toBe(1)
  })

  it('"fila" é o que aconteceu sem pessoa', () => {
    expect(whereDoHistorico(filtro({ pessoa: 'fila' }))).toEqual({ AND: [{ usuarioId: null }] })
    expect(whereDoHistorico(filtro({ pessoa: 'u1' }))).toEqual({ AND: [{ usuarioId: 'u1' }] })
  })

  it('tipo, busca e período se somam', () => {
    const where = whereDoHistorico(
      filtro({ tipo: 'falhou', busca: 'CEP', de: '2026-10-01', ate: '2026-10-01' }),
    )
    expect(where.AND).toHaveLength(4)
  })

  it('página estranha volta à primeira, e tipo desconhecido aparece como veio', () => {
    expect(filtro({ pagina: 'abc' }).pagina).toBe(1)
    expect(rotuloDoEvento('enviado')).toBe('Criado no Tiny')
    expect(rotuloDoEvento('novo-tipo')).toBe('novo-tipo')
  })
})
