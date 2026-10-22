import { describe, expect, it } from 'vitest'
import { cnpjValido, cpfValido, formatarCpf, mascararCpf, normalizarCpf } from './cpf'

describe('normalização', () => {
  it('remove máscara para que a deduplicação não dependa de formatação', () => {
    expect(normalizarCpf('529.982.247-25')).toBe('52998224725')
    expect(normalizarCpf('529 982 247 25')).toBe('52998224725')
    expect(normalizarCpf('52998224725')).toBe('52998224725')
  })
})

describe('validação', () => {
  it('aceita CPF com dígitos verificadores corretos', () => {
    expect(cpfValido('529.982.247-25')).toBe(true)
    expect(cpfValido('111.444.777-35')).toBe(true)
  })

  it('recusa dígito verificador errado', () => {
    expect(cpfValido('529.982.247-26')).toBe(false)
  })

  it('recusa sequência repetida, que passa no cálculo mas não é CPF', () => {
    expect(cpfValido('111.111.111-11')).toBe(false)
    expect(cpfValido('000.000.000-00')).toBe(false)
  })

  it('recusa tamanho errado', () => {
    expect(cpfValido('5299822472')).toBe(false)
    expect(cpfValido('')).toBe(false)
  })
})

describe('exibição', () => {
  it('formata com máscara', () => {
    expect(formatarCpf('52998224725')).toBe('529.982.247-25')
  })

  it('mascara para quem não pode ver o dado completo', () => {
    expect(mascararCpf('52998224725')).toBe('***.982.247-**')
  })
})

describe('CNPJ', () => {
  it('aceita CNPJ válido, com ou sem máscara', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true)
    expect(cnpjValido('11222333000181')).toBe(true)
  })

  it('recusa dígito errado, tamanho errado e sequência repetida', () => {
    expect(cnpjValido('11.222.333/0001-82')).toBe(false)
    expect(cnpjValido('1122233300018')).toBe(false)
    expect(cnpjValido('00000000000000')).toBe(false)
  })
})
