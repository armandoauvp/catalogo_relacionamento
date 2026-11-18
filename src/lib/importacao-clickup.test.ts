import { describe, expect, it } from 'vitest'
import { MotivoEnvio } from '@prisma/client'
import {
  cepDoTexto,
  complementoDoTexto,
  logradouroDoTexto,
  motivoDoTexto,
  numeroDoTexto,
  primeiroLink,
  separarSaudacao,
  valorDoTexto,
  valoresDosItens,
} from './importacao-clickup'

describe('endereço em texto livre', () => {
  const emLinhas =
    'Rua Fritz Koegler, 668, Apartamento 904\nBairro Fortaleza - Blumenau / Santa Catarina\nCEP: 89056-098'
  const corrido =
    'RUA JOAO DE CASTRO FERNANDES, 245 - 102 CIDADE JARDIM HORIZONTE - SAO DOMINGOS DO PRATA - MG Brasil Cep 35995000'

  it('acha o CEP com ou sem hífen e ponto', () => {
    expect(cepDoTexto(emLinhas)).toBe('89056098')
    expect(cepDoTexto(corrido)).toBe('35995000')
    expect(cepDoTexto('Av. Brasil, 10 - CEP 89.056-098')).toBe('89056098')
    expect(cepDoTexto('CEP:  Botucatu - SP')).toBeNull()
  })

  it('acha o número depois da vírgula, sem confundir com o CEP', () => {
    expect(numeroDoTexto(emLinhas)).toBe('668')
    expect(numeroDoTexto(corrido)).toBe('245')
    expect(numeroDoTexto('Rua X nº 12, centro')).toBe('12')
    expect(numeroDoTexto('Estrada da Serra, CEP 89056-098')).toBe('S/N')
  })

  it('lê o número escrito sem vírgula, com "Nr." ou com hífen', () => {
    expect(numeroDoTexto('Rua Antônio Bolfe 316, apto 61 - CEP: 95032-030')).toBe('316')
    expect(numeroDoTexto('AVENIDA PADRE JULIO, Nr. 3010, SANTA RITA')).toBe('3010')
    expect(numeroDoTexto('Avenida das Tipuanas, 1-75, Quadra B')).toBe('1-75')
    expect(numeroDoTexto('Ribeirão Preto, quadra 11, lote 12, S/N, Setor Planalto')).toBe('S/N')
  })

  it('separa o complemento quando ele está escrito', () => {
    expect(complementoDoTexto(emLinhas)).toBe('Apartamento 904')
    expect(complementoDoTexto('Rua Y, 30, apto 12 bloco B')).toBe('apto 12 bloco B')
    expect(complementoDoTexto(corrido)).toBeNull()
    expect(complementoDoTexto('Rua Coronel Durval Matos, 417, apt 802.')).toBe('apt 802')
  })

  it('não confunde a sigla do Amapá com apartamento', () => {
    expect(complementoDoTexto('SANTA RITA - MACAPA - AP - CEP: 68901-283')).toBeNull()
    expect(complementoDoTexto('Rua Clodoaldo José, 312 . Casa - CEP')).toBeNull()
  })

  it('lê o logradouro até a primeira vírgula', () => {
    expect(logradouroDoTexto(corrido)).toBe('RUA JOAO DE CASTRO FERNANDES')
  })
})

describe('motivo', () => {
  it('traduz a linha do consultor', () => {
    expect(motivoDoTexto('Aniversário').motivo).toBe(MotivoEnvio.aniversario)
    expect(motivoDoTexto('Nascimento do filho').motivo).toBe(MotivoEnvio.nascimento)
    expect(motivoDoTexto('Reforço de relacionamento após o Private Day').motivo).toBe(
      MotivoEnvio.reforco_relacionamento,
    )
  })

  it('o que não casa vira "outro" com o texto dele', () => {
    expect(motivoDoTexto('Indicação de amigo')).toEqual({
      motivo: MotivoEnvio.outro,
      motivoOutro: 'Indicação de amigo',
    })
    expect(motivoDoTexto(null).motivoOutro).toBe('Importada do ClickUp')
  })
})

describe('carta', () => {
  it('tira a saudação da primeira linha', () => {
    expect(separarSaudacao('Adriel,\nLá no Private Day...\nUm abraço')).toEqual({
      saudacao: 'Adriel,',
      corpo: 'Lá no Private Day...\nUm abraço',
    })
  })

  it('carta sem saudação fica inteira no corpo', () => {
    const carta = 'Nas nossas conversas, uma coisa me chamou a atenção.\nAbraço'
    expect(separarSaudacao(carta)).toEqual({ saudacao: '', corpo: carta })
  })
})

describe('valor de cada item do pedido quebrado', () => {
  it('o item sem preço fica com o que sobra do aprovado', () => {
    expect(valoresDosItens('130', ['35.00', null])).toEqual(['35.00', '95.00'])
  })

  it('tudo do catálogo vale o preço do catálogo, mesmo diferente do aprovado', () => {
    expect(valoresDosItens('250', ['165.00', '100.00'])).toEqual(['165.00', '100.00'])
  })

  it('recusa dividir entre dois itens sem preço', () => {
    expect(valoresDosItens('337', [null, null])).toMatch(/Mais de um item/)
  })

  it('recusa quando o catálogo passa do aprovado e sobra item sem preço', () => {
    expect(valoresDosItens('100', ['165.00', null])).toMatch(/mais que/)
  })
})

describe('valor e link', () => {
  it('aceita ponto ou vírgula como decimal', () => {
    expect(valorDoTexto('113.21')).toBe('113.21')
    expect(valorDoTexto('1.234,56')).toBe('1234.56')
    expect(valorDoTexto('R$ 120')).toBe('120')
    expect(valorDoTexto('')).toBeNull()
  })

  it('fica com o primeiro de dois links', () => {
    expect(primeiroLink('https://a.com/x / https://b.com/y')).toBe('https://a.com/x')
    expect(primeiroLink('sem link')).toBeNull()
  })
})
