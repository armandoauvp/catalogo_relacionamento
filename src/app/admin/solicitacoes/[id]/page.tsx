import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { StatusSolicitacao } from '@prisma/client'
import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { pode } from '@/lib/permissions'
import { formatarData } from '@/lib/datas'
import {
  ROTULO_STATUS,
  ehChegadaDoItem,
  ehPassoDeCompra,
  transicoesPermitidas,
  proximoPasso,
} from '@/lib/status'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/status-badge'
import { CabecalhoDaPagina } from '@/components/pagina'
import { DetalheDaSolicitacao } from '@/components/detalhe-da-solicitacao'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PencilLine } from 'lucide-react'
import { correcaoCabe } from '@/lib/correcao'
import { AlterarStatus, MarcarComoTeste } from './alterar-status'

/** Detalhe da solicitação: itens, entrega, carta, rastreio e histórico completo. */
export default async function DetalheSolicitacaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const usuario = await exigirPermissao('solicitacao.verTodas')
  const { id } = await params

  const solicitacao = await db.solicitacao.findUnique({
    where: { id },
    include: {
      cliente: true,
      consultor: { select: { nome: true } },
      itens: {
        include: {
          produto: {
            select: {
              nome: true,
              urlCompra: true,
              origem: true,
              controlaEstoque: true,
              estoque: true,
            },
          },
        },
      },
      historico: {
        include: { usuario: { select: { nome: true } } },
        orderBy: { criadoEm: 'desc' },
      },
      alteracoes: {
        include: { usuario: { select: { nome: true } } },
        orderBy: { criadoEm: 'desc' },
      },
      pedidoTiny: { select: { id: true } },
    },
  })

  if (!solicitacao) notFound()

  // O passo da compra é de quem compra, e a chegada do item é de quem recebe:
  // os outros perfis nem recebem a opção.
  const cabe = (destino: StatusSolicitacao) =>
    (pode(usuario.perfil, 'compras.operar') || !ehPassoDeCompra(solicitacao.status, destino)) &&
    (pode(usuario.perfil, 'expedicao.receberItem') || !ehChegadaDoItem(solicitacao.status, destino))
  const proximos = transicoesPermitidas(solicitacao.status).filter(cabe)
  const podeAlterar = pode(usuario.perfil, 'solicitacao.alterarStatus')

  const passo = proximoPasso(solicitacao.status, solicitacao.itens)
  const proximo = passo && cabe(passo.destino) ? passo : null
  const podeCorrigir =
    pode(usuario.perfil, 'solicitacao.editar') &&
    correcaoCabe(solicitacao.status, solicitacao.pedidoTiny !== null)

  return (
    <>
      <Link
        href="/admin/solicitacoes"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <span aria-hidden="true">←</span> Voltar para a gestão
      </Link>

      <CabecalhoDaPagina
        sobrancelha={`${formatarData(solicitacao.dataSolicitacao)} · ${solicitacao.consultor.nome}`}
        titulo={solicitacao.codigo}
        acoes={
          <>
            {solicitacao.teste ? <Badge variant="warning">teste</Badge> : null}
            <StatusBadge status={solicitacao.status} />
            {podeCorrigir ? (
              <Button asChild variant="outline" size="sm" data-tour="corrigir">
                <Link href={`/admin/solicitacoes/${solicitacao.id}/corrigir`}>
                  <PencilLine aria-hidden="true" /> Corrigir pedido
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <DetalheDaSolicitacao
        solicitacao={solicitacao}
        verDadosSensiveis={pode(usuario.perfil, 'cliente.verDadosSensiveis')}
        trocarLink={podeCorrigir}
        acoes={
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Alterar status</CardTitle>
            </CardHeader>
            <CardContent>
              {!podeAlterar ? (
                <p className="text-muted-foreground text-sm">
                  Seu perfil acompanha o status, mas não o altera.
                </p>
              ) : proximos.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {ROTULO_STATUS[solicitacao.status]} é um status final e não admite mudança.
                </p>
              ) : (
                <AlterarStatus solicitacaoId={solicitacao.id} opcoes={proximos} proximo={proximo} />
              )}
              {podeAlterar ? (
                <MarcarComoTeste solicitacaoId={solicitacao.id} teste={solicitacao.teste} />
              ) : null}
            </CardContent>
          </Card>
        }
      />
    </>
  )
}
