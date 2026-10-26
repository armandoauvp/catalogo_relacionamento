import { describe, expect, it } from 'vitest'
import { hrefDoGrupo, hrefSemFiltro, valorDoFiltro } from './filtro-por-grupo'

describe('filtro por clique no grupo', () => {
  it('liga o filtro e mantém os outros', () => {
    expect(hrefDoGrupo('/admin/solicitacoes', { busca: 'ana' }, 'status', 'aprovado')).toBe(
      '/admin/solicitacoes?busca=ana&status=aprovado',
    )
  })

  it('outro grupo da mesma coluna troca o filtro', () => {
    expect(hrefDoGrupo('/x', { status: 'aprovado' }, 'status', 'comprado')).toBe(
      '/x?status=comprado',
    )
  })

  it('clicar no grupo já filtrado tira o filtro', () => {
    expect(hrefDoGrupo('/x', { status: 'aprovado', de: '2026-10-01' }, 'status', 'aprovado')).toBe(
      '/x?de=2026-10-01',
    )
    expect(hrefDoGrupo('/x', { status: 'aprovado' }, 'status', 'aprovado')).toBe('/x')
  })

  it('volta para a primeira página e ignora vazios', () => {
    expect(hrefDoGrupo('/x', { pagina: '3', busca: '' }, 'tipo', 'falhou')).toBe('/x?tipo=falhou')
  })

  it('o × tira só aquele filtro', () => {
    expect(hrefSemFiltro('/x', { status: 'a', consultorId: 'u1', pagina: '2' }, 'status')).toBe(
      '/x?consultorId=u1',
    )
  })

  it('lê o valor mesmo quando a URL repete a chave', () => {
    expect(valorDoFiltro({ status: ['a', 'b'] }, 'status')).toBe('a')
    expect(valorDoFiltro({ status: '' }, 'status')).toBeUndefined()
  })
})
