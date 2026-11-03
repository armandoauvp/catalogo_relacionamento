import { describe, expect, it } from 'vitest'
import { Perfil } from '@prisma/client'
import { pode } from './permissions'
import { abreSozinho, passosDoTour, rotaDoPasso } from './tour'

const PERFIS = Object.values(Perfil)

describe('tour guiado', () => {
  it('todo perfil tem um tour, que termina dizendo onde rever', () => {
    for (const perfil of PERFIS) {
      const passos = passosDoTour(perfil)
      expect(passos.length, perfil).toBeGreaterThanOrEqual(4)
      expect(passos.at(-1)?.alvo, perfil).toBe('conta')
    }
  })

  it('nenhum passo some por falta de permissão: o tour descreve o que o perfil faz', () => {
    // Se a matriz mudar, o passo sai sozinho do tour; este teste avisa para
    // rever o texto, porque "Aprovar um ou vários" sem o passo anterior não lê bem.
    const contagem = Object.fromEntries(PERFIS.map((p) => [p, passosDoTour(p).length]))
    expect(contagem).toEqual({ admin: 7, consultor: 6, financeiro: 5, logistica: 6 })
    for (const perfil of PERFIS) {
      for (const passo of passosDoTour(perfil)) {
        expect(pode(perfil, passo.acao), `${perfil}: ${passo.alvo}`).toBe(true)
      }
    }
  })

  it('a primeira tela é a que o perfil já recebe ao entrar', () => {
    expect(passosDoTour(Perfil.admin)[0]?.rota).toBe('/')
    expect(passosDoTour(Perfil.consultor)[0]?.rota).toBe('/')
    expect(passosDoTour(Perfil.financeiro)[0]?.rota).toBe('/')
    // A Logística não tem resumo: a tela inicial a manda direto para o painel.
    expect(passosDoTour(Perfil.logistica)[0]?.rota).toBe('/logistica')
  })

  it('o Financeiro não recebe o passo de aprovar, que é do Admin', () => {
    expect(passosDoTour(Perfil.financeiro).map((p) => p.alvo)).not.toContain('para-aprovar')
  })

  it('abre sozinho só na primeira vez e só na primeira tela', () => {
    expect(abreSozinho(Perfil.admin, false, '/')).toBe(true)
    expect(abreSozinho(Perfil.admin, true, '/')).toBe(false)
    // Quem chegou por um link no meio do trabalho não é tirado de lá.
    expect(abreSozinho(Perfil.consultor, false, '/solicitacoes/nova')).toBe(false)
    expect(abreSozinho(Perfil.logistica, false, '/logistica')).toBe(true)
  })

  it('só troca de tela quando o passo pede', () => {
    const [primeiro] = passosDoTour(Perfil.admin)
    expect(rotaDoPasso(primeiro!, '/')).toBeNull()
    expect(rotaDoPasso(primeiro!, '/catalogo')).toBe('/')
    const conta = passosDoTour(Perfil.admin).at(-1)!
    expect(rotaDoPasso(conta, '/admin/usuarios')).toBeNull()
  })
})
