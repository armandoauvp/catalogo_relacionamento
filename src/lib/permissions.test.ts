import { describe, expect, it } from 'vitest'
import { Perfil } from '@prisma/client'
import {
  escopoDeDadosSensiveis,
  escopoDeSolicitacoes,
  filtroDeSolicitacoes,
  pode,
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
