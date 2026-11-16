import { describe, expect, it } from 'vitest'
import { intervaloDoMes } from './datas'
import { mesAnterior } from './saldo'

/** O mês de uma data no calendário de São Paulo, como "2026-11". */
const mesLocal = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).format(d)

describe('mês anterior', () => {
  it('volta um mês no calendário de São Paulo', () => {
    expect(mesLocal(mesAnterior(new Date('2026-11-16T15:00:00Z')))).toBe('2026-10')
  })

  it('janeiro volta para dezembro do ano anterior', () => {
    expect(mesLocal(mesAnterior(new Date('2027-01-10T15:00:00Z')))).toBe('2026-12')
  })

  it('no primeiro instante do mês já conta o mês certo, e não o fuso UTC', () => {
    // 1º de novembro, 00:30 em São Paulo: o mês anterior a ele é outubro.
    const inicioDeNovembro = intervaloDoMes(new Date('2026-11-16T15:00:00Z')).inicio
    expect(mesLocal(mesAnterior(new Date(inicioDeNovembro.getTime() + 30 * 60_000)))).toBe(
      '2026-10',
    )
    // Um instante antes de novembro começar ainda é outubro, e o anterior é setembro.
    expect(mesLocal(mesAnterior(new Date(inicioDeNovembro.getTime() - 1)))).toBe('2026-09')
  })
})
