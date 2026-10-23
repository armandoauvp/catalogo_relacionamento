import Link from 'next/link'
import type { Route } from 'next'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { formatarCpf, formatarTelefone } from '@/lib/cpf'
import { formatarData, formatarDataHora } from '@/lib/datas'
import { formatarBRL, somar } from '@/lib/money'
import { pode } from '@/lib/permissions'
import { CabecalhoDaPagina, EstadoVazio } from '@/components/pagina'
import { Stat } from '@/components/stat'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SeloDoPedido } from '@/app/tiny/selo-do-pedido'
import { EditorDeCliente } from '../editor-de-cliente'

/**
 * Um cliente e tudo o que foi mandado para ele: as solicitações de presente e
 * os pedidos do Tiny com o mesmo CPF (lotes e vendas avulsas), com o total.
 */
export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirPermissao('cliente.gerenciar')
  const { id } = await params

  const cliente = await db.cliente.findUnique({ where: { id } })
  if (!cliente) notFound()

  const [solicitacoes, pedidosTiny] = await Promise.all([
    db.solicitacao.findMany({
      where: { clienteId: id },
      orderBy: { dataSolicitacao: 'desc' },
      select: {
        id: true,
        codigo: true,
        dataSolicitacao: true,
        status: true,
        valorTotal: true,
        consultor: { select: { nome: true } },
        itens: {
          select: { quantidade: true, descricaoLivre: true, produto: { select: { nome: true } } },
        },
      },
    }),
    // Lote e venda avulsa não têm cliente daqui: o elo é o documento.
    pode(usuario.perfil, 'tiny.operar')
      ? db.pedidoTiny.findMany({
          where: { cpfCnpj: cliente.cpf, origem: { not: 'solicitacao' } },
          orderBy: { criadoEm: 'desc' },
          include: { lote: { select: { id: true, marcador: true } } },
        })
      : Promise.resolve([]),
  ])

  const total = somar(solicitacoes.map((s) => s.valorTotal))
  const endereco = [
    [cliente.logradouro, cliente.numero].filter(Boolean).join(', '),
    cliente.complemento,
    cliente.bairro,
    [cliente.cidade, cliente.uf].filter(Boolean).join('/'),
    cliente.cep,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      <Link
        href="/admin/clientes"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Clientes
      </Link>
      <CabecalhoDaPagina
        sobrancelha={`CPF ${formatarCpf(cliente.cpf)} · desde ${formatarData(cliente.criadoEm)}`}
        titulo={cliente.nome}
        acoes={<EditorDeCliente cliente={cliente} />}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat destaque rotulo="Total enviado" valor={formatarBRL(total)} />
        <Stat rotulo="Solicitações" valor={solicitacoes.length} />
        <Stat
          rotulo="Último envio"
          valor={solicitacoes[0] ? formatarData(solicitacoes[0].dataSolicitacao) : '-'}
          apoio={
            pedidosTiny.length ? `${pedidosTiny.length} pedido(s) por lote ou venda` : undefined
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="solicitacoes">
            <h2 id="solicitacoes" className="font-display mb-3 text-lg font-semibold">
              Presentes
            </h2>
            {solicitacoes.length === 0 ? (
              <EstadoVazio titulo="Nenhum presente ainda" />
            ) : (
              <div className="bg-card overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Solicitação</TableHead>
                      <TableHead>O que foi</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {solicitacoes.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="whitespace-nowrap">
                          <Link
                            href={`/admin/solicitacoes/${s.id}` as Route}
                            className="hover:text-primary-emphasis font-medium tabular-nums underline-offset-4 hover:underline"
                          >
                            {s.codigo}
                          </Link>
                          <span className="text-muted-foreground block text-xs">
                            {formatarData(s.dataSolicitacao)} · {s.consultor.nome}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-72 text-sm">
                          {s.itens
                            .map(
                              (i) =>
                                `${i.quantidade}× ${i.produto?.nome ?? i.descricaoLivre ?? 'item'}`,
                            )
                            .join(', ')}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={s.status} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatarBRL(s.valorTotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          {pedidosTiny.length ? (
            <section aria-labelledby="pedidos-tiny">
              <h2 id="pedidos-tiny" className="font-display mb-3 text-lg font-semibold">
                Lotes e vendas no Tiny
              </h2>
              <div className="bg-card overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Origem</TableHead>
                      <TableHead>O que vai</TableHead>
                      <TableHead>Andamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pedidosTiny.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {p.lote ? (
                            <Link
                              href={`/tiny/lotes/${p.lote.id}` as Route}
                              className="hover:text-primary-emphasis underline-offset-4 hover:underline"
                            >
                              Lote {p.lote.marcador}
                            </Link>
                          ) : (
                            'Venda avulsa'
                          )}
                          <span className="text-muted-foreground block text-xs">
                            {formatarDataHora(p.criadoEm)}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-72 text-sm">{p.resumo}</TableCell>
                        <TableCell>
                          <SeloDoPedido pedido={p} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          ) : null}
        </div>

        <section className="bg-card h-fit space-y-4 rounded-lg border p-5 text-sm">
          <div>
            <h2 className="font-display mb-2 text-lg font-semibold">Contato</h2>
            <p>{cliente.email ?? <span className="text-muted-foreground">Sem e-mail</span>}</p>
            <p className="tabular-nums">
              {cliente.telefone ? formatarTelefone(cliente.telefone) : null}
            </p>
          </div>
          <div>
            <h3 className="text-muted-foreground mb-1 text-xs font-semibold tracking-wider uppercase">
              Endereço padrão
            </h3>
            <p>{endereco || <span className="text-muted-foreground">Sem endereço</span>}</p>
          </div>
          <div>
            <h3 className="text-muted-foreground mb-1 text-xs font-semibold tracking-wider uppercase">
              Etiquetas
            </h3>
            {cliente.etiquetas.length ? (
              <span className="flex flex-wrap gap-1">
                {cliente.etiquetas.map((e) => (
                  <Badge key={e} variant="muted">
                    {e}
                  </Badge>
                ))}
              </span>
            ) : (
              <p className="text-muted-foreground">Nenhuma</p>
            )}
          </div>
          <p className="text-muted-foreground border-t pt-3 text-xs">
            Origem: {cliente.origem}. O total soma todas as solicitações, canceladas inclusive, como
            o saldo do mês.
          </p>
        </section>
      </div>
    </>
  )
}
