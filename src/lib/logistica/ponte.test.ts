import { describe, expect, it } from 'vitest'
import { StatusSolicitacao } from '@prisma/client'
import { demandaDoPresente, faseDoPresente, PONTE } from './ponte'

const AGORA = new Date('2026-10-09T15:00:00Z')

describe('fase da demanda para cada status do presente', () => {
  it('antes da aprovação, o presente não é da Logística', () => {
    expect(faseDoPresente('pendente')).toBeNull()
    expect(faseDoPresente('aguardando_aprovacao')).toBeNull()
  })

  it('aprovado entra na trilha: esperando compra, ou já em execução com estoque', () => {
    expect(faseDoPresente('aguardando_compra')).toBe('aguardando_suprimentos')
    expect(faseDoPresente('organizando_envio')).toBe('em_execucao')
  })

  it('entregue conclui; problema e devolução voltam para revisão; cancelado é arquivado', () => {
    expect(faseDoPresente('entregue')).toBe('concluido')
    expect(faseDoPresente('cliente_confirmou')).toBe('concluido')
    expect(faseDoPresente('deu_problema')).toBe('revisao')
    expect(faseDoPresente('devolvido')).toBe('revisao')
    expect(faseDoPresente('cancelado')).toBe('arquivar')
  })

  it('todo status tem destino definido', () => {
    for (const status of Object.values(StatusSolicitacao)) {
      expect(faseDoPresente(status)).not.toBeUndefined()
    }
  })
})

describe('a demanda que o presente abre', () => {
  const presente = {
    codigo: 'SOL-2026-0007',
    clienteNome: 'Marina Alves Pereira',
    itens: [
      { nome: 'Kit Café', quantidade: 1 },
      { nome: 'Caneca AUVP', quantidade: 2 },
    ],
  }

  it('leva o código e o cliente no título, e os itens com quantidade', () => {
    const d = demandaDoPresente(presente, 'organizando_envio', 'em_execucao', AGORA)
    expect(d.titulo).toBe('Presente para Marina Alves Pereira (SOL-2026-0007)')
    expect(d.itens).toEqual(['Kit Café', '2× Caneca AUVP'])
    expect(d.origem).toBe('solicitacao')
    expect(d.departamento).toBe(PONTE.departamento)
    expect(d.complexidade).toBe('media')
  })

  it('a previsão é mais longa quando ainda há compra, e vence no fim do dia', () => {
    const comEstoque = demandaDoPresente(presente, 'organizando_envio', 'em_execucao', AGORA)
    const comCompra = demandaDoPresente(
      presente,
      'aguardando_compra',
      'aguardando_suprimentos',
      AGORA,
    )
    // 09/10 + 7 dias = 16/10, até 23:59:59.999 em São Paulo.
    expect(comEstoque.previsaoConclusao?.toISOString()).toBe('2026-10-17T02:59:59.999Z')
    expect(comCompra.previsaoConclusao!.getTime()).toBeGreaterThan(
      comEstoque.previsaoConclusao!.getTime(),
    )
  })

  it('um item só é complexidade baixa', () => {
    const d = demandaDoPresente(
      { ...presente, itens: [{ nome: 'Livro AUVP', quantidade: 1 }] },
      'organizando_envio',
      'em_execucao',
      AGORA,
    )
    expect(d.complexidade).toBe('baixa')
    expect(d.concluidaEm).toBeNull()
  })
})
