import Link from 'next/link'
import { notFound } from 'next/navigation'
import { StatusSolicitacao } from '@prisma/client'
import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { pode } from '@/lib/permissions'
import { formatarData } from '@/lib/datas'
import {
  ROTULO_STATUS,
  transicoesPermitidas,
  proximoDepoisDaAprovacao,
  precisaDeCompra,
} from '@/lib/status'
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

  // Solicitação com tudo em estoque não passa pelo Financeiro: aprovar já
  // libera o envio. A aprovação continua acontecendo, o atalho começa nela,
  // não a substitui. A tela só sugere.
  const sugerido =
    solicitacao.status === StatusSolicitacao.aguardando_aprovacao
      ? proximoDepoisDaAprovacao(solicitacao.itens)
      : undefined
  // Pendente ou à espera de aprovação: o Admin aprova e encaminha num clique.
  const aprovarPara =
    solicitacao.status === StatusSolicitacao.pendente ||
    solicitacao.status === StatusSolicitacao.aguardando_aprovacao
      ? proximoDepoisDaAprovacao(solicitacao.itens)
      : undefined
  const explicacaoDoAtalho =
    sugerido === StatusSolicitacao.organizando_envio
      ? 'Todos os itens estão em estoque, então não há o que o Financeiro compre: ao aprovar, você já libera para envio.'
      : sugerido === StatusSolicitacao.aguardando_compra && precisaDeCompra(solicitacao.itens)
        ? 'Há item sem estoque ou presente específico, então a solicitação passa pelo Financeiro antes da expedição.'
        : undefined

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
                <AlterarStatus
                  solicitacaoId={solicitacao.id}
                  opcoes={proximos}
                  sugerido={sugerido}
                  explicacaoDoAtalho={explicacaoDoAtalho}
                  aprovarPara={aprovarPara}
                />
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
