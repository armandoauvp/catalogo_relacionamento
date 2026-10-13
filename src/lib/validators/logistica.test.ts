import { describe, expect, it } from 'vitest'
import { demandaSchema, membroSchema, perguntaSchema, statusDaSemanaSchema } from './logistica'

describe('status da semana', () => {
  it('aceita a definição manual com observação', () => {
    const r = statusDaSemanaSchema.parse({
      ano: '2026',
      semana: '34',
      situacao: 'alto_volume',
      observacao: ' Evento da Escola ',
    })
    expect(r).toEqual({
      ano: 2026,
      semana: 34,
      situacao: 'alto_volume',
      observacao: 'Evento da Escola',
    })
  })

  it('"automatico" vira situação nula, e observação vazia vira nula', () => {
    const r = statusDaSemanaSchema.parse({
      ano: 2026,
      semana: 34,
      situacao: 'automatico',
      observacao: '',
    })
    expect(r.situacao).toBeNull()
    expect(r.observacao).toBeNull()
  })

  it('recusa semana fora da ISO e situação desconhecida', () => {
    expect(
      statusDaSemanaSchema.safeParse({ ano: 2026, semana: 54, situacao: 'normal' }).success,
    ).toBe(false)
    expect(
      statusDaSemanaSchema.safeParse({ ano: 2026, semana: 3, situacao: 'otima' }).success,
    ).toBe(false)
    expect(
      statusDaSemanaSchema.safeParse({ ano: 2025, semana: 53, situacao: 'normal' }).success,
    ).toBe(false)
    expect(
      statusDaSemanaSchema.safeParse({ ano: 2026, semana: 53, situacao: 'normal' }).success,
    ).toBe(true)
  })
})

describe('membro da equipe', () => {
  it('exige nome e função; o resto é opcional', () => {
    expect(membroSchema.safeParse({ nome: 'Ana', funcao: '' }).success).toBe(false)
    const r = membroSchema.parse({ nome: 'Ana', funcao: 'Coordenação', descricao: '', email: '' })
    expect(r).toEqual({
      nome: 'Ana',
      funcao: 'Coordenação',
      descricao: null,
      email: null,
      ordem: 0,
    })
  })
})

describe('pergunta frequente', () => {
  it('exige pergunta e resposta', () => {
    expect(perguntaSchema.safeParse({ pergunta: 'Prazo?', resposta: '' }).success).toBe(false)
    expect(
      perguntaSchema.parse({ pergunta: 'Qual o prazo?', resposta: '5 dias úteis.' }).ordem,
    ).toBe(0)
  })
})

describe('demanda', () => {
  const valida = {
    titulo: 'Camisetas BR para o encontro',
    itens: 'Camiseta P\nCamiseta M\n\n  ',
    subsidiaria: 'Do Not Scare Soluções Interativas LTDA',
    departamento: 'Produto & CX',
    produto: 'AUVP Escola',
    fase: 'recebido',
    prioridade: 'alta',
    complexidade: 'media',
    previsaoConclusao: '2026-10-15',
    custoEnvio: '1.234,50',
  }

  it('aceita o cadastro completo, com itens por linha e custo em reais', () => {
    const d = demandaSchema.parse(valida)
    expect(d.itens).toEqual(['Camiseta P', 'Camiseta M'])
    expect(d.custoEnvio).toBe(1234.5)
    expect(d.previsaoConclusao.toISOString()).toBe('2026-10-16T02:59:59.999Z')
    expect(d.previsaoInicio).toBeNull()
    expect(d.recorrente).toBe(false)
  })

  it('previsão de conclusão é obrigatória', () => {
    const r = demandaSchema.safeParse({ ...valida, previsaoConclusao: '' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.path).toEqual(['previsaoConclusao'])
  })

  it('subsidiária e departamento são obrigatórios: alimentam o gráfico', () => {
    expect(demandaSchema.safeParse({ ...valida, subsidiaria: '' }).success).toBe(false)
    expect(demandaSchema.safeParse({ ...valida, departamento: ' ' }).success).toBe(false)
  })

  it('recorrente exige periodicidade', () => {
    const r = demandaSchema.safeParse({ ...valida, recorrente: 'on' })
    expect(r.error?.issues[0]?.path).toEqual(['periodicidade'])
    expect(
      demandaSchema.parse({ ...valida, recorrente: 'on', periodicidade: 'semanal' }).recorrente,
    ).toBe(true)
  })

  it('início não pode vir depois da conclusão', () => {
    const r = demandaSchema.safeParse({ ...valida, previsaoInicio: '2026-10-20' })
    expect(r.error?.issues[0]?.path).toEqual(['previsaoInicio'])
  })

  it('link do ClickUp, quando vem, precisa ser link', () => {
    expect(demandaSchema.safeParse({ ...valida, clickupUrl: 'tarefa 123' }).success).toBe(false)
    expect(
      demandaSchema.parse({ ...valida, clickupUrl: 'https://app.clickup.com/t/abc' }).clickupUrl,
    ).toBe('https://app.clickup.com/t/abc')
  })
})
