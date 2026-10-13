import { describe, expect, it } from 'vitest'
import { anoCorrente, fimDoDiaLocal, formatarISO, intervaloDoMes } from './datas'

describe('intervalo do mês', () => {
  it('cobre o mês inteiro no fuso de São Paulo', () => {
    // 15/03/2026 12:00 UTC → março de 2026 em São Paulo.
    const { inicio, fim } = intervaloDoMes(new Date('2026-03-15T12:00:00Z'))

    // 1º de março 00:00 em São Paulo (UTC-3) = 03:00 UTC.
    expect(inicio.toISOString()).toBe('2026-03-01T03:00:00.000Z')
    expect(fim.toISOString()).toBe('2026-04-01T03:00:00.000Z')
  })

  it('vira o ano corretamente em dezembro', () => {
    const { fim } = intervaloDoMes(new Date('2026-12-10T12:00:00Z'))
    expect(fim.toISOString()).toBe('2027-01-01T03:00:00.000Z')
  })

  it('mantém no mês certo uma solicitação criada tarde do último dia', () => {
    // 31/03/2026 às 22h em São Paulo = 01/04 01:00 UTC.
    // Sem conversão de fuso, cairia em abril.
    const instante = new Date('2026-04-01T01:00:00Z')
    const { inicio, fim } = intervaloDoMes(instante)

    expect(inicio.toISOString()).toBe('2026-03-01T03:00:00.000Z')
    expect(instante >= inicio && instante < fim).toBe(true)
  })
})

describe('ano corrente', () => {
  it('usa o ano local, não o UTC', () => {
    // 01/01/2027 00:30 UTC ainda é 31/12/2026 em São Paulo.
    expect(anoCorrente(new Date('2027-01-01T00:30:00Z'))).toBe(2026)
  })
})

describe('formatação ISO', () => {
  it('usa a data local', () => {
    expect(formatarISO(new Date('2026-04-01T01:00:00Z'))).toBe('2026-03-31')
  })
})

describe('fim do dia local', () => {
  it('é o último milissegundo do dia em São Paulo', () => {
    // 15/10/2026 23:59:59.999 em São Paulo = 16/10 02:59:59.999 UTC.
    expect(fimDoDiaLocal('2026-10-15')?.toISOString()).toBe('2026-10-16T02:59:59.999Z')
  })

  it('volta para o mesmo dia ao formatar, sem escorregar para o seguinte', () => {
    expect(formatarISO(fimDoDiaLocal('2026-12-31')!)).toBe('2026-12-31')
  })

  it('recusa data vazia ou impossível', () => {
    expect(fimDoDiaLocal('')).toBeNull()
    expect(fimDoDiaLocal('2026-02-30')).toBeNull()
    expect(fimDoDiaLocal(undefined)).toBeNull()
  })
})
