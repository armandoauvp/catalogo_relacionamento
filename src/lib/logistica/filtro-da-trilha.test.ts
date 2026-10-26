import { describe, expect, it } from 'vitest'
import {
  filtroDaTrilhaSchema,
  queryDoRecorte,
  temRecorte,
  whereDoRecorte,
} from './filtro-da-trilha'

const filtro = (bruto: Record<string, string>) => filtroDaTrilhaSchema.parse(bruto)

describe('recorte da trilha', () => {
  it('o período não entra no recorte', () => {
    const f = filtro({ periodo: 'semana', ref: '2026-W43' })
    expect(temRecorte(f)).toBe(false)
    expect(whereDoRecorte(f)).toEqual({})
  })

  it('fase, departamento e recorrência viram o where', () => {
    expect(
      whereDoRecorte(filtro({ fase: 'em_execucao', departamento: 'RH', recorrente: 'sim' })),
    ).toEqual({ fase: 'em_execucao', departamento: 'RH', recorrente: true })
  })

  it('valor que não existe é ignorado', () => {
    const f = filtro({ fase: 'voando', prioridade: 'altissima', origem: 'presente' })
    expect(temRecorte(f)).toBe(false)
  })

  it('a exportação leva o mesmo recorte', () => {
    expect(queryDoRecorte(filtro({ prioridade: 'urgente', origem: 'solicitacao' }))).toBe(
      'prioridade=urgente&origem=solicitacao',
    )
  })
})
