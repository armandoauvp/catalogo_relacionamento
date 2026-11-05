import { describe, expect, it } from 'vitest'
import { Perfil } from '@prisma/client'
import {
  comecaNaLogistica,
  escopoDeDadosSensiveis,
  escopoDeSolicitacoes,
  filtroDeSolicitacoes,
  perfilEmVigor,
  perfisAoAlcance,
  pode,
  problemaAoMudarPerfil,
} from './permissions'

describe('consultor', () => {
  it('vê o catálogo e cria solicitação', () => {
    expect(pode(Perfil.consultor, 'catalogo.ver')).toBe(true)
    expect(pode(Perfil.consultor, 'solicitacao.criar')).toBe(true)
  })

  it('só enxerga as próprias solicitações, critério de aceite da spec', () => {
    expect(escopoDeSolicitacoes(Perfil.consultor)).toBe('proprias')
    expect(filtroDeSolicitacoes(Perfil.consultor, 'u1')).toEqual({ consultorId: 'u1' })
  })

  it('não altera status, não gerencia catálogo e não exporta', () => {
    expect(pode(Perfil.consultor, 'solicitacao.alterarStatus')).toBe(false)
    expect(pode(Perfil.consultor, 'catalogo.gerenciar')).toBe(false)
    expect(pode(Perfil.consultor, 'carta.gerenciarModelos')).toBe(false)
    expect(pode(Perfil.consultor, 'usuario.gerenciar')).toBe(false)
    expect(pode(Perfil.consultor, 'exportar')).toBe(false)
  })

  it('vê dados sensíveis apenas dos próprios clientes', () => {
    expect(escopoDeDadosSensiveis(Perfil.consultor)).toBe('proprias')
  })
})

describe('admin', () => {
  it('pode tudo', () => {
    for (const acao of [
      'catalogo.gerenciar',
      'carta.gerenciarModelos',
      'solicitacao.alterarStatus',
      'solicitacao.editar',
      'usuario.gerenciar',
      'cliente.gerenciar',
      'exportar',
      'saldo.verTodos',
    ] as const) {
      expect(pode(Perfil.admin, acao)).toBe(true)
    }
  })

  it('enxerga todas as solicitações, sem filtro de consultor', () => {
    expect(escopoDeSolicitacoes(Perfil.admin)).toBe('todas')
    expect(filtroDeSolicitacoes(Perfil.admin, 'u1')).toEqual({})
  })
})

describe('financeiro: definição da área', () => {
  it('recebe a fila de compras', () => {
    expect(pode(Perfil.financeiro, 'compras.verFila')).toBe(true)
  })

  it('enxerga a fila de expedição, para exportar o pedido', () => {
    expect(pode(Perfil.financeiro, 'expedicao.verFila')).toBe(true)
    expect(pode(Perfil.admin, 'expedicao.verFila')).toBe(true)
    expect(pode(Perfil.consultor, 'expedicao.verFila')).toBe(false)
  })

  it('o consultor lê o rastreio, mas quem escreve é quem opera a expedição', () => {
    expect(pode(Perfil.admin, 'expedicao.registrarRastreio')).toBe(true)
    expect(pode(Perfil.financeiro, 'expedicao.registrarRastreio')).toBe(true)
    expect(pode(Perfil.consultor, 'expedicao.registrarRastreio')).toBe(false)
  })

  it('altera o status do pedido', () => {
    expect(pode(Perfil.financeiro, 'solicitacao.alterarStatus')).toBe(true)
  })

  it('vê todas as solicitações e exporta', () => {
    expect(escopoDeSolicitacoes(Perfil.financeiro)).toBe('todas')
    expect(pode(Perfil.financeiro, 'exportar')).toBe(true)
  })

  it('não cria solicitação nem gerencia catálogo e usuários', () => {
    expect(pode(Perfil.financeiro, 'solicitacao.criar')).toBe(false)
    expect(pode(Perfil.financeiro, 'catalogo.gerenciar')).toBe(false)
    expect(pode(Perfil.financeiro, 'usuario.gerenciar')).toBe(false)
    expect(pode(Perfil.financeiro, 'solicitacao.editar')).toBe(false)
  })
})

describe('logística: dashboard e expedição', () => {
  it('todo perfil lê o Dashboard Logístico, como pede a proposta', () => {
    for (const perfil of Object.values(Perfil)) {
      expect(pode(perfil, 'logistica.ver')).toBe(true)
    }
  })

  it('só Logística e Admin definem o status da semana e cuidam de equipe e FAQ', () => {
    expect(pode(Perfil.logistica, 'logistica.gerenciar')).toBe(true)
    expect(pode(Perfil.admin, 'logistica.gerenciar')).toBe(true)
    expect(pode(Perfil.consultor, 'logistica.gerenciar')).toBe(false)
    expect(pode(Perfil.financeiro, 'logistica.gerenciar')).toBe(false)
  })

  it('só Logística e Admin importam lotes e operam o Tiny', () => {
    expect(pode(Perfil.logistica, 'tiny.operar')).toBe(true)
    expect(pode(Perfil.admin, 'tiny.operar')).toBe(true)
    expect(pode(Perfil.consultor, 'tiny.operar')).toBe(false)
    expect(pode(Perfil.financeiro, 'tiny.operar')).toBe(false)
  })

  it('as observações, onde aparece dado de cliente, ficam com Logística e Admin', () => {
    expect(pode(Perfil.logistica, 'logistica.verObservacoes')).toBe(true)
    expect(pode(Perfil.admin, 'logistica.verObservacoes')).toBe(true)
    expect(pode(Perfil.consultor, 'logistica.verObservacoes')).toBe(false)
    expect(pode(Perfil.financeiro, 'logistica.verObservacoes')).toBe(false)
  })

  it('opera a expedição: vê a fila, o endereço e registra o rastreio', () => {
    expect(pode(Perfil.logistica, 'expedicao.verFila')).toBe(true)
    expect(pode(Perfil.logistica, 'expedicao.registrarRastreio')).toBe(true)
    expect(escopoDeDadosSensiveis(Perfil.logistica)).toBe('todas')
  })

  it('não acompanha solicitação de presente: escopo nenhum, e não "todas"', () => {
    expect(pode(Perfil.logistica, 'solicitacao.criar')).toBe(false)
    expect(escopoDeSolicitacoes(Perfil.logistica)).toBe('nenhum')
    expect(filtroDeSolicitacoes(Perfil.logistica, 'u1')).toBeNull()
  })

  it('não mexe em catálogo, cliente, usuário nem status', () => {
    expect(pode(Perfil.logistica, 'catalogo.gerenciar')).toBe(false)
    expect(pode(Perfil.logistica, 'cliente.gerenciar')).toBe(false)
    expect(pode(Perfil.logistica, 'usuario.gerenciar')).toBe(false)
    expect(pode(Perfil.logistica, 'solicitacao.alterarStatus')).toBe(false)
  })
})

describe('admin de Relacionamento', () => {
  const perfil = Perfil.admin_relacionamento

  it('aprova e cuida do que é da área', () => {
    for (const acao of [
      'solicitacao.aprovar',
      'solicitacao.alterarStatus',
      'catalogo.gerenciar',
      'carta.gerenciarModelos',
      'cliente.gerenciar',
      'saldo.verTodos',
      'exportar',
    ] as const) {
      expect(pode(perfil, acao), acao).toBe(true)
    }
  })

  it('acompanha a compra e a expedição, sem marcar por quem compra e posta', () => {
    expect(pode(perfil, 'compras.verFila')).toBe(true)
    expect(pode(perfil, 'compras.operar')).toBe(false)
    expect(pode(perfil, 'expedicao.verFila')).toBe(true)
    expect(pode(perfil, 'expedicao.registrarRastreio')).toBe(false)
  })

  it('lê o painel da Logística, sem operar nem ler as observações', () => {
    expect(pode(perfil, 'logistica.ver')).toBe(true)
    expect(pode(perfil, 'logistica.gerenciar')).toBe(false)
    expect(pode(perfil, 'logistica.verObservacoes')).toBe(false)
    expect(pode(perfil, 'tiny.operar')).toBe(false)
  })
})

describe('admin de Logística', () => {
  const perfil = Perfil.admin_logistica

  it('opera como o time', () => {
    for (const acao of [
      'logistica.gerenciar',
      'logistica.verObservacoes',
      'expedicao.registrarRastreio',
      'tiny.operar',
    ] as const) {
      expect(pode(perfil, acao), acao).toBe(true)
    }
  })

  it('lê as solicitações, sem aprovar nem mudar status', () => {
    expect(escopoDeSolicitacoes(perfil)).toBe('todas')
    expect(pode(perfil, 'solicitacao.aprovar')).toBe(false)
    expect(pode(perfil, 'solicitacao.alterarStatus')).toBe(false)
    expect(pode(perfil, 'solicitacao.criar')).toBe(false)
  })

  it('não mexe no catálogo, nos clientes nem no saldo', () => {
    expect(pode(perfil, 'catalogo.gerenciar')).toBe(false)
    expect(pode(perfil, 'cliente.gerenciar')).toBe(false)
    expect(pode(perfil, 'saldo.verTodos')).toBe(false)
  })
})

describe('custo dos envios', () => {
  it('fica fora do alcance do consultor, que também lê o dashboard', () => {
    expect(pode(Perfil.consultor, 'logistica.ver')).toBe(true)
    expect(pode(Perfil.consultor, 'logistica.verCustos')).toBe(false)
  })

  it('os demais perfis veem', () => {
    for (const perfil of Object.values(Perfil).filter((p) => p !== Perfil.consultor)) {
      expect(pode(perfil, 'logistica.verCustos'), perfil).toBe(true)
    }
  })

  it('quem lança o envio vê o custo que lançou', () => {
    for (const perfil of Object.values(Perfil)) {
      if (pode(perfil, 'logistica.gerenciar')) {
        expect(pode(perfil, 'logistica.verCustos'), perfil).toBe(true)
      }
    }
  })
})

describe('tela inicial', () => {
  it('quem opera a Logística e não pede presente começa pelo painel', () => {
    expect(comecaNaLogistica(Perfil.logistica)).toBe(true)
    expect(comecaNaLogistica(Perfil.admin_logistica)).toBe(true)
  })

  it('os demais começam pelo resumo', () => {
    for (const perfil of [
      Perfil.admin,
      Perfil.admin_relacionamento,
      Perfil.consultor,
      Perfil.financeiro,
    ]) {
      expect(comecaNaLogistica(perfil), perfil).toBe(false)
    }
  })
})

describe('quem cada admin alcança em Usuários', () => {
  it('só os admins gerenciam usuários, e cada perfil que gerencia tem alcance', () => {
    for (const perfil of Object.values(Perfil)) {
      expect(perfisAoAlcance(perfil).length > 0, perfil).toBe(pode(perfil, 'usuario.gerenciar'))
    }
  })

  it('o Admin geral alcança todos', () => {
    expect(perfisAoAlcance(Perfil.admin)).toEqual(Object.values(Perfil))
    expect(problemaAoMudarPerfil(Perfil.admin, Perfil.consultor, Perfil.admin)).toBeNull()
    expect(problemaAoMudarPerfil(Perfil.admin, Perfil.admin, Perfil.financeiro)).toBeNull()
  })

  it('o de Relacionamento gerencia consultores, sem trocar o perfil deles', () => {
    expect(perfisAoAlcance(Perfil.admin_relacionamento)).toEqual([Perfil.consultor])
    expect(
      problemaAoMudarPerfil(Perfil.admin_relacionamento, Perfil.consultor, Perfil.consultor),
    ).toBeNull()
    expect(
      problemaAoMudarPerfil(Perfil.admin_relacionamento, Perfil.consultor, Perfil.logistica),
    ).not.toBeNull()
    expect(
      problemaAoMudarPerfil(Perfil.admin_relacionamento, Perfil.logistica, Perfil.logistica),
    ).not.toBeNull()
  })

  it('o de Logística só transforma em Consultor ou Logística', () => {
    expect(
      problemaAoMudarPerfil(Perfil.admin_logistica, Perfil.consultor, Perfil.logistica),
    ).toBeNull()
    expect(
      problemaAoMudarPerfil(Perfil.admin_logistica, Perfil.logistica, Perfil.consultor),
    ).toBeNull()
    for (const novo of [
      Perfil.admin,
      Perfil.admin_relacionamento,
      Perfil.admin_logistica,
      Perfil.financeiro,
    ]) {
      expect(problemaAoMudarPerfil(Perfil.admin_logistica, Perfil.consultor, novo), novo).toMatch(
        /transformar/,
      )
    }
  })

  it('o de Logística não rebaixa admin nem tira ninguém do Financeiro', () => {
    for (const atual of [
      Perfil.admin,
      Perfil.admin_relacionamento,
      Perfil.admin_logistica,
      Perfil.financeiro,
    ]) {
      expect(problemaAoMudarPerfil(Perfil.admin_logistica, atual, Perfil.consultor), atual).toMatch(
        /não gerencia/,
      )
    }
  })

  it('o limite mensal fica com o Admin geral e o de Relacionamento', () => {
    expect(pode(Perfil.admin, 'usuario.definirLimite')).toBe(true)
    expect(pode(Perfil.admin_relacionamento, 'usuario.definirLimite')).toBe(true)
    expect(pode(Perfil.admin_logistica, 'usuario.definirLimite')).toBe(false)
  })
})

describe('perfil livre, fase de testes', () => {
  it('vale o escolhido enquanto a fase está ligada', () => {
    expect(perfilEmVigor(Perfil.consultor, Perfil.admin, true)).toBe(Perfil.admin)
  })

  it('desligada a fase, volta o cadastrado mesmo com escolha no token', () => {
    expect(perfilEmVigor(Perfil.consultor, Perfil.admin, false)).toBe(Perfil.consultor)
  })

  it('escolha que não é perfil é ignorada', () => {
    expect(perfilEmVigor(Perfil.financeiro, 'root', true)).toBe(Perfil.financeiro)
    expect(perfilEmVigor(Perfil.financeiro, undefined, true)).toBe(Perfil.financeiro)
  })
})

describe('fila de aprovação', () => {
  it('é do Admin: o Financeiro compra o que já foi aprovado', () => {
    expect(pode(Perfil.admin, 'solicitacao.aprovar')).toBe(true)
    expect(pode(Perfil.financeiro, 'solicitacao.aprovar')).toBe(false)
    expect(pode(Perfil.consultor, 'solicitacao.aprovar')).toBe(false)
    expect(pode(Perfil.logistica, 'solicitacao.aprovar')).toBe(false)
  })
})

describe('modelos de carta', () => {
  it('só o Admin muda as sugestões, que valem para todos os consultores', () => {
    expect(pode(Perfil.admin, 'carta.gerenciarModelos')).toBe(true)
    expect(pode(Perfil.consultor, 'carta.gerenciarModelos')).toBe(false)
    expect(pode(Perfil.financeiro, 'carta.gerenciarModelos')).toBe(false)
    expect(pode(Perfil.logistica, 'carta.gerenciarModelos')).toBe(false)
  })
})
