import { describe, expect, it } from 'vitest'
import { Perfil } from '@prisma/client'
import { pode } from '@/lib/permissions'
import { FAQ, faqDoPerfil } from './faq'
import { buscarNaFaq, normalizar, palavrasDaBusca } from './busca'

const PERFIS = Object.values(Perfil)
const ids = (perfil: Perfil) => faqDoPerfil(perfil).map((i) => i.id)

describe('FAQ da Caixinha: quem vê o quê', () => {
  it('todo perfil tem perguntas, e destaques para a primeira abertura', () => {
    for (const perfil of PERFIS) {
      const itens = faqDoPerfil(perfil)
      expect(itens.length, perfil).toBeGreaterThanOrEqual(5)
      expect(itens.filter((i) => i.destaque).length, perfil).toBeGreaterThanOrEqual(2)
    }
  })

  it('ninguém lê como fazer o que o perfil não pode fazer', () => {
    for (const perfil of PERFIS) {
      for (const item of faqDoPerfil(perfil)) {
        if (!item.exige) continue
        const exige = Array.isArray(item.exige) ? item.exige : [item.exige]
        expect(
          exige.some((a) => pode(perfil, a)),
          `${perfil}: ${item.id}`,
        ).toBe(true)
      }
    }
  })

  it('o Colaborador vê a Logística e a explicação do perfil, e nada de presente', () => {
    const c = ids(Perfil.colaborador)
    expect(c).toContain('pedir-logistica')
    expect(c).toContain('por-que-colaborador')
    expect(c).not.toContain('nova-solicitacao')
    expect(c).not.toContain('aprovar-lote')
  })

  it('o Consultor vê o caminho do presente e não o da aprovação', () => {
    const c = ids(Perfil.consultor)
    expect(c).toEqual(
      expect.arrayContaining(['nova-solicitacao', 'carta', 'confirmar-recebimento', 'quem-aprova']),
    )
    expect(c).not.toContain('aprovar-lote')
    expect(c).not.toContain('por-que-colaborador')
  })

  it('quem gerencia a Logística não recebe "como peço à Logística"', () => {
    expect(ids(Perfil.logistica)).not.toContain('pedir-logistica')
    expect(ids(Perfil.logistica)).toContain('trilha')
    expect(ids(Perfil.admin_logistica)).not.toContain('pedir-logistica')
  })

  it('"preciso cancelar" é para quem pede, não para quem já pode cancelar', () => {
    expect(ids(Perfil.consultor)).toContain('cancelar')
    expect(ids(Perfil.admin)).not.toContain('cancelar')
  })

  it('os ids são únicos e os links são caminhos do app', () => {
    expect(new Set(FAQ.map((i) => i.id)).size).toBe(FAQ.length)
    for (const item of FAQ) {
      if (item.href) expect(item.href.startsWith('/'), item.id).toBe(true)
      expect(Boolean(item.href) || item.abreTour || !item.rotuloDoLink, item.id).toBe(true)
    }
  })
})

describe('busca da FAQ', () => {
  it('normaliza acento, maiúscula e pontuação', () => {
    expect(normalizar('Solicitação, RASTREIO!')).toBe('solicitacao rastreio')
    expect(palavrasDaBusca('Como eu faço o pedido?')).toEqual(['pedido'])
  })

  it('sem termo, os destaques vêm primeiro', () => {
    const r = buscarNaFaq(faqDoPerfil(Perfil.consultor), '')
    const primeiroComum = r.findIndex((i) => !i.destaque)
    expect(r.slice(primeiroComum).every((i) => !i.destaque)).toBe(true)
  })

  it('acha pela palavra sem acento e pelo começo da palavra', () => {
    const itens = faqDoPerfil(Perfil.consultor)
    expect(buscarNaFaq(itens, 'rastreio')[0]?.id).toBe('rastreio')
    expect(buscarNaFaq(itens, 'rastre')[0]?.id).toBe('rastreio')
    expect(buscarNaFaq(itens, 'cartão')[0]?.id).toBe('carta')
  })

  it('entende sinônimos do jeito que a área fala', () => {
    const itens = faqDoPerfil(Perfil.consultor)
    // "chegou" é sinônimo de recebeu/entregue.
    expect(buscarNaFaq(itens, 'cliente chegou').map((i) => i.id)).toContain('confirmar-recebimento')
    // "saldo" acha a pergunta do limite.
    expect(buscarNaFaq(itens, 'saldo')[0]?.id).toBe('limite-mes')
  })

  it('quem casa com todas as palavras vem antes', () => {
    const itens = faqDoPerfil(Perfil.admin)
    expect(buscarNaFaq(itens, 'aprovar lote')[0]?.id).toBe('aprovar-lote')
  })

  it('não acha nada quando nada casa', () => {
    expect(buscarNaFaq(faqDoPerfil(Perfil.consultor), 'xyzw')).toEqual([])
  })
})
