import { describe, expect, it } from 'vitest'
import { lerContatos, montarContato, validarContato } from './contato'

describe('contato do Tiny', () => {
  it('para atualizar, bastam nome e CPF/CNPJ', () => {
    expect(validarContato({ nome: 'Marina Alves', cpfCnpj: '529.982.247-25' }).erros).toEqual([])
  })

  it('o que vier preenchido é conferido', () => {
    const { erros } = validarContato({
      nome: 'Marina Alves',
      cpfCnpj: '529.982.247-25',
      cep: '0131',
      uf: 'XX',
      email: 'sem-arroba',
    })
    expect(erros).toEqual(['CEP precisa ter 8 dígitos.', 'UF inválida.', 'E-mail inválido.'])
  })

  it('na alteração, campo vazio não vai, para não apagar o que está no Tiny', () => {
    const d = validarContato({ nome: 'Marina Alves', cpfCnpj: '52998224725', cep: '1310100' })
    const alteracao = montarContato(d.destinatario, '900')
    expect(alteracao).toEqual({
      id: '900',
      nome: 'Marina Alves',
      tipo_pessoa: 'F',
      cpf_cnpj: '52998224725',
      cep: '01310-100',
      situacao: 'A',
    })
    expect(montarContato(d.destinatario)).toMatchObject({ sequencia: '1', nome: 'Marina Alves' })
  })

  it('a planilha de contatos não exige endereço', () => {
    const { linhas, faltando } = lerContatos([
      ['Nome', 'CPF', 'Telefone'],
      ['Marina Alves', '52998224725', '(11) 98765-4321'],
    ])
    expect(faltando).toEqual([])
    expect(linhas[0]).toMatchObject({ linha: 2, erros: [] })
    expect(linhas[0]!.destinatario.telefone).toBe('11987654321')
  })

  it('CNPJ vira pessoa jurídica', () => {
    const d = validarContato({ nome: 'AUVP Ltda', cpfCnpj: '11.222.333/0001-81' })
    expect(montarContato(d.destinatario).tipo_pessoa).toBe('J')
  })
})
