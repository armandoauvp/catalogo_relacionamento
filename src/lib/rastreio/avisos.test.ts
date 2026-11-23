import { describe, expect, it } from 'vitest'
import { chaveDoEvento, eventosParaAvisar, textoDoAviso, tomDoEvento } from './avisos'

const agora = new Date('2026-11-23T15:00:00Z')
const diasAtras = (d: number) => new Date(agora.getTime() - d * 86_400_000)
const evento = (descricao: string, extra: Partial<{ codigo: string; tipo: string }> = {}) => ({
  codigo: 'RO',
  tipo: '01',
  descricao,
  ...extra,
})

describe('tom do aviso do rastreio', () => {
  it('entrega em verde, pelo código ou pela descrição', () => {
    expect(tomDoEvento(evento('Objeto entregue ao destinatário'))).toBe('entrega')
    expect(tomDoEvento(evento('x', { codigo: 'BDE', tipo: '01' }))).toBe('entrega')
  })

  it('o que pede ação vem em destaque', () => {
    for (const d of [
      'Objeto aguardando retirada no endereço indicado',
      'Objeto não entregue - destinatário ausente',
      'Objeto não entregue - endereço incorreto',
      'Objeto extraviado',
      'Objeto devolvido ao remetente',
      'Tentativa de entrega não efetuada',
      'Objeto roubado',
    ]) {
      expect(tomDoEvento(evento(d)), d).toBe('alerta')
    }
  })

  it('postado e transferência são aviso comum', () => {
    expect(tomDoEvento(evento('Objeto postado'))).toBe('comum')
    expect(tomDoEvento(evento('Objeto em transferência - por favor aguarde'))).toBe('comum')
    expect(tomDoEvento(evento('Objeto saiu para entrega ao destinatário'))).toBe('comum')
  })
})

describe('quais eventos avisam', () => {
  const e = (d: number) => ({ ocorridoEm: diasAtras(d) })

  it('na primeira consulta, só o mais recente', () => {
    expect(eventosParaAvisar([e(3), e(1), e(2)], true, agora)).toEqual([e(1)])
  })

  it('depois, cada evento novo', () => {
    expect(eventosParaAvisar([e(1), e(0)], false, agora)).toEqual([e(1), e(0)])
  })

  it('evento de mais de uma semana é história, não aviso', () => {
    expect(eventosParaAvisar([e(10), e(8)], false, agora)).toEqual([])
    expect(eventosParaAvisar([e(30)], true, agora)).toEqual([])
  })
})

describe('texto e chave do aviso', () => {
  const entregue = {
    codigo: 'BDE',
    tipo: '01',
    descricao: 'Objeto entregue ao destinatário',
    local: 'Unidade de Distribuição - NOVA IGUACU - RJ',
    ocorridoEm: new Date('2026-10-28T15:51:35Z'),
  }

  it('a entrega diz para quem foi', () => {
    expect(textoDoAviso('SOL-2026-0177', 'Paulo', entregue)).toEqual({
      tom: 'entrega',
      titulo: 'SOL-2026-0177 foi entregue a Paulo',
      texto:
        'Objeto entregue ao destinatário · Unidade de Distribuição - NOVA IGUACU - RJ · 28/10/2026, 12:51',
    })
  })

  it('o resto diz o que aconteceu, para quem é o presente e onde', () => {
    const r = textoDoAviso('SOL-2026-0169', 'Gabriel', {
      ...entregue,
      codigo: 'LDI',
      descricao: 'Objeto aguardando retirada no endereço indicado',
    })
    expect(r.tom).toBe('alerta')
    expect(r.titulo).toBe('SOL-2026-0169: Objeto aguardando retirada no endereço indicado')
    expect(r.texto).toMatch(/^Presente para Gabriel · Unidade de Distribuição/)
  })

  it('a chave é a mesma para o mesmo evento', () => {
    expect(chaveDoEvento('QB1BR', entregue)).toBe(chaveDoEvento('QB1BR', { ...entregue }))
    expect(chaveDoEvento('QB1BR', entregue)).not.toBe(chaveDoEvento('QB2BR', entregue))
  })
})
