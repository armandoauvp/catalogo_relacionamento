import { describe, expect, it } from 'vitest'
import {
  filtroDeClientesSchema,
  ordemDeClientes,
  queryDoFiltro,
  whereDeClientes,
} from './filtro-de-clientes'

const filtro = (bruto: Record<string, string>) => filtroDeClientesSchema.parse(bruto)

describe('filtro da base de clientes', () => {
  it('sem nada, traz todos em ordem de nome', () => {
    const f = filtro({})
    expect(whereDeClientes(f)).toEqual({})
    expect(ordemDeClientes(f.ordem)).toEqual([{ nome: 'asc' }])
  })

  it('dígitos buscam o CPF; texto, nome e e-mail', () => {
    expect(whereDeClientes(filtro({ busca: '529.982' }))).toEqual({
      AND: [{ cpf: { startsWith: '529982' } }],
    })
    expect(JSON.stringify(whereDeClientes(filtro({ busca: 'marina' })))).toContain('email')
  })

  it('etiqueta e período entram juntos', () => {
    const where = whereDeClientes(
      filtro({ etiqueta: 'Evento X', de: '2026-10-01', ate: '2026-10-31' }),
    )
    expect(where.AND).toHaveLength(3)
    // Outubro em São Paulo começa às 03:00 UTC do dia 1.
    expect((where.AND as { criadoEm?: { gte?: Date } }[])[1]!.criadoEm!.gte!.toISOString()).toBe(
      '2026-10-01T03:00:00.000Z',
    )
  })

  it('valor estranho na URL vira o padrão, não erro', () => {
    const f = filtro({ ordem: 'qualquer', de: 'ontem' })
    expect(f.ordem).toBe('nome')
    expect(f.de).toBeUndefined()
  })

  it('a exportação leva o mesmo recorte, sem a ordem padrão', () => {
    expect(queryDoFiltro(filtro({ etiqueta: 'Evento X', ordem: 'nome' }))).toBe('etiqueta=Evento+X')
  })
})
