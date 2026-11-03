import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { pode } from '@/lib/permissions'
import { formatarData } from '@/lib/datas'
import { ROTULO_STATUS, transicoesPermitidas, proximoPasso } from '@/lib/status'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/status-badge'
import { CabecalhoDaPagina } from '@/components/pagina'
import { DetalheDaSolicitacao } from '@/components/detalhe-da-solicitacao'
import { Badge } from '@/components/ui/badge'
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
            select: { nome: true, origem: true, controlaEstoque: true, estoque: true },
          },
        },
      },
      historico: {
        include: { usuario: { select: { nome: true } } },
        orderBy: { criadoEm: 'desc' },
      },
    },
  })

  if (!solicitacao) notFound()

  const proximos = transicoesPermitidas(solicitacao.status)
  const podeAlterar = pode(usuario.perfil, 'solicitacao.alterarStatus')

  const proximo = proximoPasso(solicitacao.status, solicitacao.itens)

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
          </>
        }
      />

      <DetalheDaSolicitacao
        solicitacao={solicitacao}
        verDadosSensiveis={pode(usuario.perfil, 'cliente.verDadosSensiveis')}
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
