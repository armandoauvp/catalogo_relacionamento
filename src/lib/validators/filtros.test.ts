import { describe, expect, it } from 'vitest'
import { filtroSolicitacoesSchema, whereDeSolicitacoes } from './filtros'

describe('filtro da gestão', () => {
  it('status em texto, como a exportação lê a URL, vira lista', () => {
    const f = filtroSolicitacoesSchema.parse({ status: 'comprado' })
    expect(f.status).toEqual(['comprado'])
    expect(whereDeSolicitacoes(f)).toEqual({ status: { in: ['comprado'] } })
  })

  it('status repetido na URL continua lista, e vazio é sem filtro', () => {
    expect(filtroSolicitacoesSchema.parse({ status: ['pendente', 'comprado'] }).status).toEqual([
      'pendente',
      'comprado',
    ])
    expect(filtroSolicitacoesSchema.parse({ status: '' }).status).toBeUndefined()
  })

  it('rota desconhecida é ignorada, e não erro', () => {
    expect(filtroSolicitacoesSchema.parse({ rota: 'compra' }).rota).toBe('compra')
    expect(filtroSolicitacoesSchema.parse({ rota: 'qualquer' }).rota).toBeUndefined()
  })
})
