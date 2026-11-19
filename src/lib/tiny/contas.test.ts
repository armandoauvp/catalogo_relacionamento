import { describe, expect, it } from 'vitest'
import {
  comConta,
  CONTA_PADRAO,
  CONTAS_TINY,
  contaDoParametro,
  ehContaTiny,
  NOME_DA_CONTA,
  VARIAVEL_DO_TOKEN,
} from './contas'

describe('contas do Tiny', () => {
  it('são três, cada uma com nome e variável próprios', () => {
    expect(CONTAS_TINY).toEqual(['consultoria', 'dns', 'supernova'])
    expect(new Set(CONTAS_TINY.map((c) => VARIAVEL_DO_TOKEN[c])).size).toBe(3)
    expect(NOME_DA_CONTA.dns).toBe('Do Not Scare')
  })

  it('o token não mora no código: só o nome da variável da Vercel', () => {
    for (const c of CONTAS_TINY) expect(VARIAVEL_DO_TOKEN[c]).toMatch(/^TINY_API_TOKEN(_[A-Z]+)?$/)
  })

  it('a conta da URL só vale se for uma das três; o resto cai na Consultoria', () => {
    expect(contaDoParametro('dns')).toBe('dns')
    expect(contaDoParametro(['supernova', 'dns'])).toBe('supernova')
    expect(contaDoParametro('outra')).toBe(CONTA_PADRAO)
    expect(contaDoParametro(undefined)).toBe('consultoria')
    expect(ehContaTiny('DNS')).toBe(false)
  })

  it('o link leva a conta junto, com ou sem query', () => {
    expect(comConta('/tiny/pedidos/12', 'dns')).toBe('/tiny/pedidos/12?conta=dns')
    expect(comConta('/tiny/estoque?busca=x', 'supernova')).toBe(
      '/tiny/estoque?busca=x&conta=supernova',
    )
  })
})
