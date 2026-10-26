import Link from 'next/link'
import { redirect } from 'next/navigation'
import { StatusSolicitacao, type Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { exigirUsuario } from '@/lib/auth-guards'
import { filtroDeSolicitacoes, pode } from '@/lib/permissions'
import { saldoDoMes } from '@/lib/saldo'
import { formatarBRL } from '@/lib/money'
import { formatarData } from '@/lib/datas'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/status-badge'
import { Stat } from '@/components/stat'
import { CabecalhoDaPagina, EstadoVazio } from '@/components/pagina'
import { FiltroDoGrupo, FiltrosAtivos, type FiltroAtivo } from '@/components/filtro-por-grupo'
import { hrefDoGrupo, hrefSemFiltro, valorDoFiltro } from '@/lib/filtro-por-grupo'
import { ROTULO_STATUS } from '@/lib/status'

/**
 * Lista das solicitações do consultor, com o saldo do mês em destaque.
 *
 * O `where` vem de `filtroDeSolicitacoes`, e não de um filtro escrito à mão,
 * para que o critério "o consultor só enxerga as próprias" não dependa de quem
 * escreveu a query.
 */
export default async function SolicitacoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const usuario = await exigirUsuario()

  const filtro = filtroDeSolicitacoes(usuario.perfil, usuario.id)
  // Quem não acompanha solicitação, a Logística, não tem lista aqui.
  if (!filtro) redirect('/')

  // O clique no status ou no cliente recorta dentro do escopo, nunca fora dele.
  const params = await searchParams
  const caminho = '/solicitacoes'
  const status = Object.values(StatusSolicitacao).find((s) => s === params.status)
  const clienteId = params.clienteId || undefined
  const recorte: Prisma.SolicitacaoWhereInput = {
    AND: [filtro, status ? { status } : {}, clienteId ? { clienteId } : {}],
  }
  const grupo = (chave: string, valor: string) => ({
    href: hrefDoGrupo(caminho, params, chave, valor),
    ativo: valorDoFiltro(params, chave) === valor,
  })

  const [solicitacoes, total, entregues, saldo] = await Promise.all([
    db.solicitacao.findMany({
      where: recorte,
      include: {
        cliente: { select: { id: true, nome: true } },
        _count: { select: { itens: true } },
      },
      orderBy: { dataSolicitacao: 'desc' },
      take: 100,
    }),
    db.solicitacao.count({ where: filtro }),
    db.solicitacao.count({
      where: { AND: [filtro, { status: { in: ['entregue', 'cliente_confirmou'] } }] },
    }),
    saldoDoMes(usuario.id),
  ])

  const clienteFiltrado = clienteId
    ? solicitacoes.find((s) => s.cliente.id === clienteId)?.cliente.nome
    : undefined
  const filtrosAtivos: FiltroAtivo[] = [
    status && {
      coluna: 'Status',
      valor: ROTULO_STATUS[status],
      semEle: hrefSemFiltro(caminho, params, 'status'),
    },
    clienteId && {
      coluna: 'Cliente',
      valor: clienteFiltrado ?? 'escolhido',
      semEle: hrefSemFiltro(caminho, params, 'clienteId'),
    },
  ].filter((f): f is FiltroAtivo => Boolean(f))

  const mes = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date())

  const podeCriar = pode(usuario.perfil, 'solicitacao.criar')

  return (
    <>
      <CabecalhoDaPagina
        titulo="Minhas solicitações"
        descricao="Os presentes que você pediu, com o status e o rastreio de cada envio."
        acoes={
          podeCriar ? (
            <Button asChild>
              <Link href="/solicitacoes/nova">Nova solicitação</Link>
            </Button>
          ) : null
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          destaque
          rotulo={`Gasto em ${mes}`}
          valor={formatarBRL(saldo.gasto)}
          className="sm:col-span-2 lg:col-span-1"
          apoio={
            saldo.limite ? (
              <div className="space-y-2">
                <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className={saldo.estourou ? 'bg-error h-full' : 'bg-success h-full'}
                    style={{ width: `${Math.min(100, saldo.percentual ?? 0)}%` }}
                  />
                </div>
                <p>
                  de {formatarBRL(saldo.limite)}
                  {saldo.estourou ? ': limite do mês ultrapassado.' : ' no limite do mês.'}
                </p>
              </div>
            ) : (
              'Sem limite mensal definido. Tudo o que você solicitou no mês entra na conta.'
            )
          }
        />
        <Stat rotulo="Solicitações" valor={total} apoio="Total já criado por você." />
        <Stat rotulo="Entregues" valor={entregues} apoio="Chegaram ao cliente." />
      </div>

      <FiltrosAtivos filtros={filtrosAtivos} limpar={caminho} />

      {total > 0 && solicitacoes.length === 0 ? (
        <EstadoVazio
          titulo="Nada neste filtro"
          descricao="Tire o filtro acima para ver todas as suas solicitações."
        />
      ) : solicitacoes.length === 0 ? (
        <EstadoVazio
          titulo="Você ainda não fez nenhuma solicitação"
          descricao="Escolha um presente no catálogo, informe o cliente e escreva a carta que acompanha o envio."
          acao={
            podeCriar ? (
              <Button asChild>
                <Link href="/solicitacoes/nova">Criar a primeira</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Itens</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rastreio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {solicitacoes.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium whitespace-nowrap tabular-nums">
                    <Link
                      href={`/solicitacoes/${s.id}`}
                      className="hover:text-primary-emphasis underline-offset-4 hover:underline"
                    >
                      {s.codigo}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
                    {formatarData(s.dataSolicitacao)}
                  </TableCell>
                  <TableCell>
                    <FiltroDoGrupo
                      {...grupo('clienteId', s.cliente.id)}
                      rotulo={`cliente ${s.cliente.nome}`}
                      texto
                    >
                      {s.cliente.nome}
                    </FiltroDoGrupo>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s._count.itens}</TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                    {formatarBRL(s.valorTotal)}
                  </TableCell>
                  <TableCell>
                    <FiltroDoGrupo
                      {...grupo('status', s.status)}
                      rotulo={`status ${ROTULO_STATUS[s.status]}`}
                    >
                      <StatusBadge status={s.status} />
                    </FiltroDoGrupo>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.rastreio ? (
                      // `select-all`: o código é copiado para o site da
                      // transportadora, e não digitado de novo.
                      <span className="text-sm tabular-nums select-all">{s.rastreio}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  )
}
