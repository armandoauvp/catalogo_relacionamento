import { describe, expect, it } from 'vitest'
import { jaChegou, passoPermitido, situacaoVigente, SITUACAO_DO_PASSO } from './ciclo'

describe('ciclo de vida do pedido no Tiny', () => {
  it('fechar leva a "Preparando envio" e concluir a "Pronto para envio", como na pauta', () => {
    expect(SITUACAO_DO_PASSO.fechar).toBe('preparando_envio')
    expect(SITUACAO_DO_PASSO.concluir).toBe('pronto_envio')
  })

  it('só anda para a frente', () => {
    expect(passoPermitido('aberto', 'fechar')).toBe(true)
    expect(passoPermitido('aprovado', 'concluir')).toBe(true)
    expect(passoPermitido('preparando_envio', 'concluir')).toBe(true)
    expect(passoPermitido('preparando_envio', 'fechar')).toBe(false)
    expect(passoPermitido('pronto_envio', 'fechar')).toBe(false)
    expect(passoPermitido('enviado', 'concluir')).toBe(false)
  })

  it('cancelado ou não entregue não recebem passo', () => {
    expect(passoPermitido('cancelado', 'fechar')).toBe(false)
    expect(passoPermitido('nao_entregue', 'concluir')).toBe(false)
  })

  it('pedido ainda na fila pode receber o passo: ele segue depois de criado', () => {
    expect(passoPermitido(null, 'fechar')).toBe(true)
  })

  it('o passo pedido aqui perde o sentido se o Tiny já andou além dele', () => {
    expect(jaChegou('pronto_envio', 'preparando_envio')).toBe(true)
    expect(jaChegou('preparando_envio', 'preparando_envio')).toBe(true)
    expect(jaChegou('aberto', 'preparando_envio')).toBe(false)
    expect(jaChegou('cancelado', 'pronto_envio')).toBe(true)
    expect(jaChegou(null, 'pronto_envio')).toBe(false)
  })

  it('o que a expedição pediu vale antes do que o Tiny ainda mostra', () => {
    expect(situacaoVigente({ situacao: 'aberto', situacaoPendente: 'preparando_envio' })).toBe(
      'preparando_envio',
    )
    expect(situacaoVigente({ situacao: 'aberto', situacaoPendente: null })).toBe('aberto')
  })
})
