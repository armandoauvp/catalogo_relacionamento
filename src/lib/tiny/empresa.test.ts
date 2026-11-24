import { describe, expect, it } from 'vitest'
import { contaDaEmpresa, lerEmpresa, problemaDaEmpresa } from './empresa'

const empresa = (razaoSocial: string, fantasia = '') => ({ razaoSocial, fantasia })

describe('empresa de cada token do Tiny', () => {
  it('lê a razão social e a fantasia do info.php', () => {
    expect(
      lerEmpresa({ conta: { razao_social: ' HOLDING SUPERNOVA ', fantasia: '', cnpj_cpf: '1' } }),
    ).toEqual({ razaoSocial: 'HOLDING SUPERNOVA', fantasia: '' })
    expect(lerEmpresa({})).toEqual({ razaoSocial: '', fantasia: '' })
  })

  it('reconhece as três empresas pelo nome', () => {
    expect(contaDaEmpresa(empresa('AUVP CONSULTORIA FINANCEIRA DE INVESTIMENTOS'))).toBe(
      'consultoria',
    )
    expect(contaDaEmpresa(empresa('Investidor Sardinha', 'Investidor Sardinha'))).toBe('dns')
    expect(contaDaEmpresa(empresa('X LTDA', 'Do Not Scare'))).toBe('dns')
    expect(contaDaEmpresa(empresa('HOLDING SUPERNOVA '))).toBe('supernova')
    expect(contaDaEmpresa(empresa('Padaria do Zé'))).toBeNull()
  })

  it('acusa o token trocado, como aconteceu entre Consultoria e DNS', () => {
    const sardinha = empresa('Investidor Sardinha', 'Investidor Sardinha')
    expect(problemaDaEmpresa('dns', sardinha)).toBeNull()
    const problema = problemaDaEmpresa('consultoria', sardinha)
    expect(problema).toContain('TINY_API_TOKEN ')
    expect(problema).toContain('Investidor Sardinha')
    expect(problema).toContain('AUVP Consultoria')
  })

  it('empresa desconhecida também trava', () => {
    expect(problemaDaEmpresa('supernova', empresa(''))).toContain('outra empresa')
  })
})
