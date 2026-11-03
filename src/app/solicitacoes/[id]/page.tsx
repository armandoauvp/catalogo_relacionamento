import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { exigirUsuario } from '@/lib/auth-guards'
import { filtroDeSolicitacoes, pode } from '@/lib/permissions'
import { formatarData } from '@/lib/datas'
import { oQueAconteceAgora } from '@/lib/status'
import { StatusBadge } from '@/components/status-badge'
import { CabecalhoDaPagina } from '@/components/pagina'
import { DetalheDaSolicitacao } from '@/components/detalhe-da-solicitacao'

/**
 * Detalhe da solicitação para quem a fez.
 *
 * Existe por uma pergunta só: "já foi?". Sem esta tela, o consultor volta a
 * perguntar por mensagem: que é o trabalho que a ferramenta deveria ter
 * tirado do caminho.
 *
 * O escopo vem de `filtroDeSolicitacoes` e entra no `where`, não numa
 * comparação depois da consulta: uma solicitação de outra pessoa não é
 * carregada e depois escondida, ela simplesmente não é encontrada.
 */
export default async function MinhaSolicitacaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const usuario = await exigirUsuario()
  const { id } = await params

  const escopo = filtroDeSolicitacoes(usuario.perfil, usuario.id)
  if (!escopo) notFound()

  const solicitacao = await db.solicitacao.findFirst({
    where: { id, ...escopo },
    include: {
      cliente: true,
      consultor: { select: { nome: true } },
      itens: { include: { produto: { select: { nome: true } } } },
      historico: {
        include: { usuario: { select: { nome: true } } },
        orderBy: { criadoEm: 'desc' },
      },
    },
  })

  if (!solicitacao) notFound()

  return (
    <>
      <Link
        href="/solicitacoes"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <span aria-hidden="true">←</span> Voltar para as minhas solicitações
      </Link>

      <CabecalhoDaPagina
        sobrancelha={`${formatarData(solicitacao.dataSolicitacao)} · para ${solicitacao.cliente.nome}`}
        titulo={solicitacao.codigo}
        acoes={<StatusBadge status={solicitacao.status} />}
      />

      {/* "Pendente" sozinho não diz nada a quem pediu: esta frase é a resposta
          ao "e agora, o que falta?". */}
      <p
        className="bg-muted/40 mb-6 rounded-lg border px-4 py-3 text-sm"
        data-tour="o-que-acontece"
      >
        {oQueAconteceAgora(solicitacao.status)}
      </p>

      <DetalheDaSolicitacao
        solicitacao={solicitacao}
        verDadosSensiveis={pode(usuario.perfil, 'cliente.verDadosSensiveis')}
      />
    </>
  )
}
