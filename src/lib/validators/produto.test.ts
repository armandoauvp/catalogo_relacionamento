import { describe, expect, it } from 'vitest'
import { produtoSchema } from './produto'

/**
 * O que se testa aqui é o cadastro do acompanhamento, que é por onde a área
 * liga um kit à bebida que ele embala. A regra de checagem em si vive em
 * `src/lib/acompanhamentos.test.ts`.
 */

const base = {
  nome: 'Kit Queijos com Vinho',
  categoriaId: 'c1',
  valor: '165,00',
  skuTiny: 'KIT-QUEIJO',
}

describe('SKU no Tiny', () => {
  it('é obrigatório: sem ele o presente para na fila do Tiny', () => {
    const { skuTiny: _sku, ...semSku } = base
    expect(produtoSchema.safeParse(semSku).success).toBe(false)
    expect(produtoSchema.safeParse({ ...base, skuTiny: '   ' }).success).toBe(false)
  })

  it('tira os espaços das pontas', () => {
    const r = produtoSchema.safeParse({ ...base, skuTiny: ' KIT-QUEIJO ' })
    expect(r.success && r.data.skuTiny).toBe('KIT-QUEIJO')
  })
})

describe('acompanhamento no cadastro de produto', () => {
  it('aceita produto sem acompanhamento nenhum', () => {
    const r = produtoSchema.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.exigeAcompanhamento).toBeNull()
      expect(r.data.serveComoAcompanhamento).toBeNull()
    }
  })

  it('normaliza o rótulo para minúsculo, senão o pareamento não acontece', () => {
    const r = produtoSchema.safeParse({ ...base, exigeAcompanhamento: '  Vinho ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.exigeAcompanhamento).toBe('vinho')
  })

  it('recusa produto que seria o próprio acompanhamento que exige', () => {
    const r = produtoSchema.safeParse({
      ...base,
      exigeAcompanhamento: 'vinho',
      serveComoAcompanhamento: 'Vinho',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.message).toContain('próprio acompanhamento')
    }
  })

  it('deixa o kit exigir um rótulo e servir como outro', () => {
    const r = produtoSchema.safeParse({
      ...base,
      exigeAcompanhamento: 'vinho',
      serveComoAcompanhamento: 'taca',
    })
    expect(r.success).toBe(true)
  })
})
