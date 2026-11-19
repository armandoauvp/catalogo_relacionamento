import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { catalogoProvider } from '@/lib/providers'
import { correcaoCabe } from '@/lib/correcao'
import { ROTULO_STATUS } from '@/lib/status'
import { CabecalhoDaPagina } from '@/components/pagina'
import { Card, CardContent } from '@/components/ui/card'
import { FormularioDeCorrecao, type ProdutoParaCorrecao } from './formulario'

/**
 * Correção do pedido pelo Admin, até a compra. A regra mora em
 * `src/lib/correcao.ts`, e a action confere tudo de novo.
 */
export default async function CorrigirSolicitacaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await exigirPermissao('solicitacao.editar')
  const { id } = await params

  const solicitacao = await db.solicitacao.findUnique({
    where: { id },
    include: {
      cliente: { select: { nome: true } },
      itens: { include: { produto: { select: { nome: true, valor: true } } } },
      pedidoTiny: { select: { id: true } },
    },
  })
  if (!solicitacao) notFound()

  const voltar = (
    <Link
      href={`/admin/solicitacoes/${id}`}
      className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
    >
      <span aria-hidden="true">←</span> Voltar para {solicitacao.codigo}
    </Link>
  )

  if (!correcaoCabe(solicitacao.status, solicitacao.pedidoTiny !== null)) {
    return (
      <>
        {voltar}
        <CabecalhoDaPagina titulo={`Corrigir ${solicitacao.codigo}`} />
        <Card>
          <CardContent className="text-muted-foreground pt-6 text-sm">
            O pedido está em &ldquo;{ROTULO_STATUS[solicitacao.status]}&rdquo;.{' '}
            {solicitacao.pedidoTiny
              ? 'Ele já foi ao Tiny: corrija lá, para os dois não divergirem.'
              : 'Depois de comprado, ele não muda mais: o que foi comprado é o que vai.'}
          </CardContent>
        </Card>
      </>
    )
  }

  const catalogo = await catalogoProvider.listar({ apenasAtivos: true, porPagina: 500 })
  const produtos: ProdutoParaCorrecao[] = catalogo.itens.map((p) => ({
    id: p.id,
    nome: p.nome,
    valor: p.valor?.toFixed(2) ?? null,
  }))
  // O produto que já está no pedido aparece mesmo se saiu do catálogo depois.
  for (const item of solicitacao.itens) {
    if (item.produtoId && item.produto && !produtos.some((p) => p.id === item.produtoId)) {
      produtos.push({
        id: item.produtoId,
        nome: `${item.produto.nome} (pausado no catálogo)`,
        valor: null,
      })
    }
  }

  return (
    <>
      {voltar}
      <CabecalhoDaPagina
        sobrancelha={`Para ${solicitacao.cliente.nome}`}
        titulo={`Corrigir ${solicitacao.codigo}`}
        descricao="Itens, entrega e carta. Cada mudança fica registrada no pedido, com o que era antes."
      />
      <FormularioDeCorrecao
        produtos={produtos}
        inicial={{
          solicitacaoId: solicitacao.id,
          itens: solicitacao.itens.map((i) => ({
            id: i.id,
            produtoId: i.produtoId,
            descricaoLivre: i.descricaoLivre ?? '',
            urlExterna: i.urlExterna ?? '',
            valorUnitario: i.valorUnitario.toFixed(2),
            quantidade: i.quantidade,
            doEstoque: i.doEstoque,
            comprado: i.compradoEm !== null,
          })),
          entregaDestinatario: solicitacao.entregaDestinatario,
          entregaCep: solicitacao.entregaCep,
          entregaLogradouro: solicitacao.entregaLogradouro,
          entregaNumero: solicitacao.entregaNumero,
          entregaComplemento: solicitacao.entregaComplemento ?? '',
          entregaBairro: solicitacao.entregaBairro,
          entregaCidade: solicitacao.entregaCidade,
          entregaUf: solicitacao.entregaUf,
          motivo: solicitacao.motivo,
          motivoOutro: solicitacao.motivoOutro ?? '',
          saudacaoCarta: solicitacao.saudacaoCarta ?? '',
          mensagemCarta: solicitacao.mensagemCarta,
          observacoes: solicitacao.observacoes ?? '',
        }}
      />
    </>
  )
}
