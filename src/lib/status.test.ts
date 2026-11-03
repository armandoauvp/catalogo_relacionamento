import { describe, expect, it } from 'vitest'
import { OrigemProduto, StatusSolicitacao } from '@prisma/client'
import {
  FLUXO_LINEAR,
  STATUS_PARA_APROVAR,
  caminhoDeEncaminhamento,
  contaNoSaldo,
  ehTerminal,
  oQueAconteceAgora,
  precisaDeCompra,
  proximoDepoisDaAprovacao,
  proximoPasso,
  transicaoPermitida,
  transicoesPermitidas,
  validarMudancaDeStatus,
} from './status'

describe('fluxo linear', () => {
  it('avança uma etapa por vez', () => {
    for (let i = 0; i < FLUXO_LINEAR.length - 1; i++) {
      const atual = FLUXO_LINEAR[i]!
      const proximo = FLUXO_LINEAR[i + 1]!
      expect(transicaoPermitida(atual, proximo)).toBe(true)
    }
  })

  it('não deixa pular etapas, fora o atalho declarado para a expedição', () => {
    expect(transicaoPermitida(StatusSolicitacao.pendente, StatusSolicitacao.comprado)).toBe(false)
    expect(
      transicaoPermitida(StatusSolicitacao.aguardando_compra, StatusSolicitacao.entregue),
    ).toBe(false)
  })

  it('não deixa voltar pelo fluxo linear', () => {
    expect(
      transicaoPermitida(StatusSolicitacao.comprado, StatusSolicitacao.aguardando_compra),
    ).toBe(false)
  })
})

describe('deu problema', () => {
  it('é acionável de qualquer status vivo', () => {
    for (const status of FLUXO_LINEAR) {
      if (ehTerminal(status)) continue
      expect(transicaoPermitida(status, StatusSolicitacao.deu_problema)).toBe(true)
    }
  })

  it('permite voltar para qualquer status anterior do fluxo', () => {
    const destinos = transicoesPermitidas(StatusSolicitacao.deu_problema)
    for (const status of FLUXO_LINEAR) {
      expect(destinos).toContain(status)
    }
  })

  it('permite cancelar', () => {
    expect(transicaoPermitida(StatusSolicitacao.deu_problema, StatusSolicitacao.cancelado)).toBe(
      true,
    )
  })

  it('é recusado sem motivo, critério de aceite da spec', () => {
    const semMotivo = validarMudancaDeStatus(
      StatusSolicitacao.comprado,
      StatusSolicitacao.deu_problema,
    )
    expect(semMotivo.ok).toBe(false)

    const soEspacos = validarMudancaDeStatus(
      StatusSolicitacao.comprado,
      StatusSolicitacao.deu_problema,
      '   ',
    )
    expect(soEspacos.ok).toBe(false)

    const comMotivo = validarMudancaDeStatus(
      StatusSolicitacao.comprado,
      StatusSolicitacao.deu_problema,
      'Fornecedor cancelou o pedido.',
    )
    expect(comMotivo.ok).toBe(true)
  })
})

describe('devolvido', () => {
  it('só é acionável de entregue em diante', () => {
    expect(transicaoPermitida(StatusSolicitacao.entregue, StatusSolicitacao.devolvido)).toBe(true)
    expect(
      transicaoPermitida(StatusSolicitacao.cliente_confirmou, StatusSolicitacao.devolvido),
    ).toBe(false) // cliente_confirmou é terminal
    expect(transicaoPermitida(StatusSolicitacao.comprado, StatusSolicitacao.devolvido)).toBe(false)
    expect(transicaoPermitida(StatusSolicitacao.pendente, StatusSolicitacao.devolvido)).toBe(false)
  })

  it('exige motivo', () => {
    expect(validarMudancaDeStatus(StatusSolicitacao.entregue, StatusSolicitacao.devolvido).ok).toBe(
      false,
    )
  })
})

describe('status terminais', () => {
  it('não admitem nenhuma transição', () => {
    for (const status of [
      StatusSolicitacao.cliente_confirmou,
      StatusSolicitacao.devolvido,
      StatusSolicitacao.cancelado,
    ]) {
      expect(transicoesPermitidas(status)).toEqual([])
      expect(validarMudancaDeStatus(status, StatusSolicitacao.pendente).ok).toBe(false)
    }
  })
})

describe('mudança para o mesmo status', () => {
  it('é recusada', () => {
    expect(validarMudancaDeStatus(StatusSolicitacao.pendente, StatusSolicitacao.pendente).ok).toBe(
      false,
    )
  })
})

describe('saldo do mês', () => {
  // A spec mandava excluir cancelados e devolvidos. A área corrigiu: devolução
  // normalmente vira reenvio, então o dinheiro segue comprometido.
  it('conta todos os status, inclusive cancelado e devolvido', () => {
    for (const status of Object.values(StatusSolicitacao)) {
      expect(contaNoSaldo(status)).toBe(true)
    }
  })
})

describe('atalho para a expedição', () => {
  it('permite ir da aprovação direto para organizando envio', () => {
    expect(
      transicaoPermitida(
        StatusSolicitacao.aguardando_aprovacao,
        StatusSolicitacao.organizando_envio,
      ),
    ).toBe(true)
  })

  it('mantém o caminho pelo Financeiro disponível', () => {
    expect(
      transicaoPermitida(
        StatusSolicitacao.aguardando_aprovacao,
        StatusSolicitacao.aguardando_compra,
      ),
    ).toBe(true)
  })

  it('não abre o atalho a partir de outros status', () => {
    expect(
      transicaoPermitida(StatusSolicitacao.pendente, StatusSolicitacao.organizando_envio),
    ).toBe(false)
  })
})

describe('precisa de compra', () => {
  const daPrateleira = {
    origem: OrigemProduto.estoque_interno,
    controlaEstoque: false,
    estoque: null,
  }
  const emEstoque = { origem: OrigemProduto.estoque_interno, controlaEstoque: true, estoque: 10 }
  const sobDemanda = {
    origem: OrigemProduto.mediante_pedido,
    controlaEstoque: false,
    estoque: null,
  }

  it('não precisa quando tudo é de catálogo e há estoque', () => {
    expect(precisaDeCompra([{ produtoId: 'p1', quantidade: 2, produto: emEstoque }])).toBe(false)
  })

  it('precisa quando o estoque não cobre a quantidade pedida', () => {
    expect(precisaDeCompra([{ produtoId: 'p1', quantidade: 20, produto: emEstoque }])).toBe(true)
  })

  it('precisa quando o produto é comprado sob demanda', () => {
    expect(precisaDeCompra([{ produtoId: 'p1', quantidade: 1, produto: sobDemanda }])).toBe(true)
  })

  it('precisa quando há presente específico', () => {
    expect(precisaDeCompra([{ produtoId: null, quantidade: 1 }])).toBe(true)
  })

  it('um único item sem estoque leva a solicitação inteira ao Financeiro', () => {
    expect(
      precisaDeCompra([
        { produtoId: 'p1', quantidade: 1, produto: emEstoque },
        { produtoId: null, quantidade: 1 },
      ]),
    ).toBe(true)
  })

  it('prateleira sem contagem de peças não vai ao Financeiro', () => {
    // O caso da maioria do catálogo: a área sabe que tem, mas não conta as
    // peças. Antes isso mandava tudo para a compra.
    expect(precisaDeCompra([{ produtoId: 'p1', quantidade: 3, produto: daPrateleira }])).toBe(false)
  })

  it('sugere o próximo status conforme a necessidade de compra', () => {
    expect(proximoDepoisDaAprovacao([{ produtoId: 'p1', quantidade: 1, produto: emEstoque }])).toBe(
      StatusSolicitacao.organizando_envio,
    )
    expect(proximoDepoisDaAprovacao([{ produtoId: null, quantidade: 1 }])).toBe(
      StatusSolicitacao.aguardando_compra,
    )
    expect(
      proximoDepoisDaAprovacao([{ produtoId: 'p1', quantidade: 1, produto: sobDemanda }]),
    ).toBe(StatusSolicitacao.aguardando_compra)
  })
})

describe('encaminhamento em lote', () => {
  const daPrateleira = {
    origem: OrigemProduto.estoque_interno,
    controlaEstoque: false,
    estoque: null,
  }
  const noCatalogo = [{ produtoId: 'p1', quantidade: 1, produto: daPrateleira }]
  const especifico = [{ produtoId: null, quantidade: 1 }]

  it('nada sai de pendente sem passar pela aprovação', () => {
    const caminho = caminhoDeEncaminhamento(
      StatusSolicitacao.pendente,
      StatusSolicitacao.organizando_envio,
      noCatalogo,
    )

    expect(caminho).toEqual({
      ok: true,
      passos: [StatusSolicitacao.aguardando_aprovacao, StatusSolicitacao.organizando_envio],
    })
  })

  it('o automático aprova e libera o envio quando está tudo em estoque', () => {
    expect(caminhoDeEncaminhamento(StatusSolicitacao.pendente, 'automatico', noCatalogo)).toEqual({
      ok: true,
      passos: [StatusSolicitacao.aguardando_aprovacao, StatusSolicitacao.organizando_envio],
    })
  })

  it('o automático manda ao Financeiro quando há o que comprar', () => {
    expect(caminhoDeEncaminhamento(StatusSolicitacao.pendente, 'automatico', especifico)).toEqual({
      ok: true,
      passos: [StatusSolicitacao.aguardando_aprovacao, StatusSolicitacao.aguardando_compra],
    })
  })

  it('já aprovada anda um passo só', () => {
    expect(
      caminhoDeEncaminhamento(StatusSolicitacao.aguardando_aprovacao, 'automatico', noCatalogo),
    ).toEqual({ ok: true, passos: [StatusSolicitacao.organizando_envio] })
  })

  it('o Admin pode contrariar a sugestão e mandar comprar mesmo com estoque', () => {
    expect(
      caminhoDeEncaminhamento(
        StatusSolicitacao.aguardando_aprovacao,
        StatusSolicitacao.aguardando_compra,
        noCatalogo,
      ),
    ).toEqual({ ok: true, passos: [StatusSolicitacao.aguardando_compra] })
  })

  it('não inventa transição: de comprado não se volta para a compra', () => {
    const caminho = caminhoDeEncaminhamento(
      StatusSolicitacao.comprado,
      StatusSolicitacao.aguardando_compra,
      especifico,
    )

    expect(caminho.ok).toBe(false)
  })

  it('recusa o automático a partir de status que não é de aprovação', () => {
    const caminho = caminhoDeEncaminhamento(StatusSolicitacao.comprado, 'automatico', especifico)

    expect(caminho).toEqual({
      ok: false,
      erro: '"Comprado" não tem encaminhamento automático: escolha o destino.',
    })
  })

  it('status final não anda', () => {
    expect(
      caminhoDeEncaminhamento(
        StatusSolicitacao.cancelado,
        StatusSolicitacao.organizando_envio,
        noCatalogo,
      ).ok,
    ).toBe(false)
  })

  it('não repete o que já está feito', () => {
    expect(
      caminhoDeEncaminhamento(
        StatusSolicitacao.organizando_envio,
        StatusSolicitacao.organizando_envio,
        noCatalogo,
      ),
    ).toEqual({ ok: false, erro: 'Já está em "Organizando envio".' })
  })
})

describe('próximo passo', () => {
  const emEstoque = [
    {
      produtoId: 'p1',
      quantidade: 1,
      produto: { origem: OrigemProduto.estoque_interno, controlaEstoque: false, estoque: null },
    },
  ]
  const sobPedido = [
    {
      produtoId: 'p2',
      quantidade: 1,
      produto: { origem: OrigemProduto.mediante_pedido, controlaEstoque: false, estoque: null },
    },
  ]

  it('aprovar manda para onde os itens pedem, nos dois status de espera', () => {
    for (const status of STATUS_PARA_APROVAR) {
      expect(proximoPasso(status, sobPedido)).toMatchObject({
        destino: StatusSolicitacao.aguardando_compra,
        rotulo: 'Aprovar e mandar para Aguardando compra',
        aprovacao: true,
      })
      expect(proximoPasso(status, emEstoque)?.destino).toBe(StatusSolicitacao.organizando_envio)
    }
  })

  it('todo passo é uma transição que o servidor aceita', () => {
    for (const status of Object.values(StatusSolicitacao)) {
      const passo = proximoPasso(status, sobPedido)
      if (!passo) continue
      // Aprovar de `pendente` anda dois status, pelo caminho do lote.
      const caminho = caminhoDeEncaminhamento(status, passo.destino, sobPedido)
      expect(caminho.ok, status).toBe(true)
    }
  })

  it('segue o fluxo depois da aprovação', () => {
    expect(proximoPasso(StatusSolicitacao.aguardando_compra, [])?.rotulo).toBe(
      'Marcar como comprado',
    )
    expect(proximoPasso(StatusSolicitacao.comprado, [])?.rotulo).toBe('Liberar para envio')
    expect(proximoPasso(StatusSolicitacao.organizando_envio, [])?.destino).toBe(
      StatusSolicitacao.entregue,
    )
    expect(proximoPasso(StatusSolicitacao.entregue, [])?.destino).toBe(
      StatusSolicitacao.cliente_confirmou,
    )
  })

  it('fora do fluxo feliz não sugere nada: é decisão de quem opera', () => {
    for (const status of [
      StatusSolicitacao.deu_problema,
      StatusSolicitacao.cancelado,
      StatusSolicitacao.devolvido,
      StatusSolicitacao.cliente_confirmou,
    ]) {
      expect(proximoPasso(status, [])).toBeNull()
    }
  })

  it('todo status tem a frase para quem pediu', () => {
    for (const status of Object.values(StatusSolicitacao)) {
      expect(oQueAconteceAgora(status).length).toBeGreaterThan(10)
    }
  })
})
