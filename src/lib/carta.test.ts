import { describe, expect, it } from 'vitest'
import { MotivoEnvio } from '@prisma/client'
import {
  LIMITE_DA_MENSAGEM,
  aplicarModelo,
  espacoRestante,
  ocasiaoDaCarta,
  previaDaCarta,
  primeiroNome,
  problemaDoModelo,
} from './carta'

describe('primeiro nome', () => {
  it('pega a primeira palavra', () => {
    expect(primeiroNome('Marina Alves Pereira')).toBe('Marina')
  })

  it('aguenta espaço sobrando, que vem de cadastro colado à mão', () => {
    expect(primeiroNome('  Roberto   Cardoso ')).toBe('Roberto')
  })

  it('pula a partícula quando o cadastro veio invertido', () => {
    expect(primeiroNome('de Souza Ana')).toBe('Souza')
  })

  it('devolve vazio para nome vazio, em vez de estourar', () => {
    expect(primeiroNome('   ')).toBe('')
  })
})

describe('modelos de carta', () => {
  it('aceita o modelo com {nome}, e o sem marcador nenhum', () => {
    expect(problemaDoModelo('Feliz aniversário, {nome}! Um brinde.')).toBeNull()
    expect(problemaDoModelo('Um brinde a mais um ano.')).toBeNull()
  })

  it('recusa modelo vazio, que viraria uma sugestão em branco', () => {
    expect(problemaDoModelo('   ')).toMatch(/Escreva/)
  })

  it('recusa modelo maior do que cabe na carta', () => {
    expect(problemaDoModelo('a'.repeat(LIMITE_DA_MENSAGEM + 1))).toMatch(/passa de 600/)
  })

  it('aponta o marcador escrito errado, que chegaria cru na folha', () => {
    expect(problemaDoModelo('Oi, {Nome}!')).toMatch(/"\{Nome\}"/)
    expect(problemaDoModelo('Oi, {nome}! Parabéns, {cliente}.')).toMatch(/"\{cliente\}"/)
    expect(problemaDoModelo('Oi, {nome!')).toMatch(/"\{nome!"/)
    expect(problemaDoModelo('Oi, nome}!')).toMatch(/"\}"/)
  })

  it('troca o nome do cliente no modelo', () => {
    const texto = aplicarModelo('Feliz aniversário, {nome}! Um brinde.', 'Marina Alves')
    expect(texto).toBe('Feliz aniversário, Marina! Um brinde.')
  })

  it('sem nome, corta a saudação em vez de deixar "Oi, !"', () => {
    const texto = aplicarModelo('Oi, {nome}! Obrigado pela confiança.', '')
    expect(texto).toBe('Obrigado pela confiança.')
  })
})

describe('prévia da carta', () => {
  const base = {
    destinatario: 'Marina Alves Pereira',
    motivo: MotivoEnvio.aniversario,
    motivoOutro: '',
    mensagem: 'Que este ano venha com muitas conquistas.',
    remetente: 'Carlos Consultor',
  }

  it('monta saudação, corpo e assinatura', () => {
    const p = previaDaCarta(base)
    expect(p.saudacao).toBe('Olá, Marina,')
    expect(p.corpo).toBe('Que este ano venha com muitas conquistas.')
    expect(p.assinatura).toBe('Carlos Consultor')
    expect(p.ocasiao).toBe('Aniversário')
  })

  it('não repete a saudação quando a mensagem já cumprimenta', () => {
    const p = previaDaCarta({ ...base, mensagem: 'Oi, Marina! Parabéns pelo seu dia.' })
    expect(p.saudacao).toBe('')
  })

  it('reconhece o cumprimento sem vírgula e sem "oi"', () => {
    const p = previaDaCarta({ ...base, mensagem: 'Marina, que dia especial!' })
    expect(p.saudacao).toBe('')
  })

  it('reconhece o nome no meio da primeira frase', () => {
    const p = previaDaCarta({ ...base, mensagem: 'Feliz aniversário, Marina! Um brinde.' })
    expect(p.saudacao).toBe('')
  })

  it('cumprimenta quando o nome só aparece lá adiante', () => {
    const p = previaDaCarta({
      ...base,
      mensagem: 'Que este ano seja ótimo. Conte com a gente, Marina.',
    })
    expect(p.saudacao).toBe('Olá, Marina,')
  })

  it('cumprimenta quando a mensagem cita outro nome', () => {
    const p = previaDaCarta({ ...base, mensagem: 'Oi, Roberto! Parabéns.' })
    expect(p.saudacao).toBe('Olá, Marina,')
  })

  it('sem destinatário, não inventa saudação', () => {
    const p = previaDaCarta({ ...base, destinatario: '' })
    expect(p.saudacao).toBe('')
  })

  it('“Outro” usa o que a pessoa escreveu', () => {
    expect(ocasiaoDaCarta(MotivoEnvio.outro, 'Formatura')).toBe('Formatura')
  })

  it('“Outro” em branco ainda tem cabeçalho', () => {
    expect(ocasiaoDaCarta(MotivoEnvio.outro, '   ')).toBe('Uma lembrança')
  })
})

describe('espaço da mensagem', () => {
  it('conta o que ainda cabe', () => {
    expect(espacoRestante('abc')).toEqual({ restam: LIMITE_DA_MENSAGEM - 3, excedeu: false })
  })

  it('acusa quando passou da folha', () => {
    const r = espacoRestante('x'.repeat(LIMITE_DA_MENSAGEM + 10))
    expect(r.excedeu).toBe(true)
    expect(r.restam).toBe(-10)
  })
})
