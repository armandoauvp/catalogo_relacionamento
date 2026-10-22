import { describe, expect, it } from 'vitest'
import { classificarErro, coletarErros, ErroDoTiny, proximaTentativa } from './erros'

describe('o que fazer com cada erro do Tiny', () => {
  it('excesso de acessos, rede e manutenção são temporários', () => {
    expect(classificarErro(new ErroDoTiny('muitos acessos', 6))).toBe('temporario')
    expect(classificarErro(new ErroDoTiny('concorrentes', 11))).toBe('temporario')
    expect(classificarErro(new ErroDoTiny('HTTP 502', null))).toBe('temporario')
    expect(classificarErro(new TypeError('fetch failed'))).toBe('temporario')
  })

  it('token e conta bloqueada param a rodada', () => {
    expect(classificarErro(new ErroDoTiny('token inválido', 2))).toBe('configuracao')
    expect(classificarErro(new ErroDoTiny('empresa bloqueada', 8))).toBe('configuracao')
  })

  it('duplicidade, pelo código ou pela mensagem', () => {
    expect(classificarErro(new ErroDoTiny('dup', 30))).toBe('duplicidade')
    expect(classificarErro(new ErroDoTiny('Registro em duplicidade', 31))).toBe('duplicidade')
  })

  it('validação é recusa: repetir daria o mesmo erro', () => {
    expect(classificarErro(new ErroDoTiny('CEP inválido', 31))).toBe('recusado')
  })
})

describe('próxima tentativa', () => {
  const agora = new Date('2026-10-22T12:00:00Z')
  const minutos = (d: Date) => (d.getTime() - agora.getTime()) / 60_000

  it('espera cresce e para em uma hora', () => {
    expect(minutos(proximaTentativa(1, agora))).toBe(1)
    expect(minutos(proximaTentativa(2, agora))).toBe(5)
    expect(minutos(proximaTentativa(3, agora))).toBe(15)
    expect(minutos(proximaTentativa(9, agora))).toBe(60)
  })
})

describe('mensagens de erro do retorno', () => {
  it('junta as do retorno e as de cada registro, sem repetir', () => {
    expect(
      coletarErros({
        erros: [{ erro: 'Pedido inválido' }],
        registros: [
          { registro: { erros: [{ erro: 'CEP inválido' }, { erro: 'Pedido inválido' }] } },
        ],
      }),
    ).toBe('Pedido inválido CEP inválido')
  })
})
