import { describe, expect, it } from 'vitest'
import { StatusSolicitacao } from '@prisma/client'
import { ATALHOS_DA_GESTAO, atalhoAtivo, contagemDoAtalho, hrefDoAtalho } from './atalhos-da-gestao'

const atalho = (chave: string) => ATALHOS_DA_GESTAO.find((a) => a.chave === chave)!
const caminho = '/admin/solicitacoes'

describe('atalhos da gestão', () => {
  it('troca o recorte de status e mantém os outros filtros', () => {
    const params = { consultorId: 'c1', status: 'cancelado', pagina: '3' }
    expect(hrefDoAtalho(caminho, params, atalho('deu_problema'))).toBe(
      '/admin/solicitacoes?consultorId=c1&status=deu_problema',
    )
  })

  it('"Para aprovar" usa a fila, e "Todas" só tira o recorte', () => {
    const params = { status: 'comprado', busca: 'Maria' }
    expect(hrefDoAtalho(caminho, params, atalho('aprovar'))).toBe(
      '/admin/solicitacoes?busca=Maria&fila=aprovar',
    )
    expect(hrefDoAtalho(caminho, { fila: 'aprovar' }, null)).toBe(caminho)
  })

  it('reconhece o atalho ligado pela URL', () => {
    expect(atalhoAtivo({ fila: 'aprovar' })).toBe('aprovar')
    expect(atalhoAtivo({ status: [StatusSolicitacao.comprado] })).toBe('comprado')
    expect(atalhoAtivo({ status: [StatusSolicitacao.cancelado] })).toBeNull()
    expect(atalhoAtivo({})).toBeNull()
  })

  it('"Para aprovar" soma pendente e aguardando aprovação', () => {
    const porStatus = { pendente: 5, aguardando_aprovacao: 2, deu_problema: 4 }
    expect(contagemDoAtalho(porStatus, atalho('aprovar'))).toBe(7)
    expect(contagemDoAtalho(porStatus, atalho('organizando_envio'))).toBe(0)
  })
})
