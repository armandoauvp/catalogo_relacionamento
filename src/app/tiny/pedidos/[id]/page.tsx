import Link from 'next/link'
import type { Route } from 'next'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { tinyConfigurado } from '@/lib/env'
import { formatarCpf } from '@/lib/cpf'
import { formatarBRL, subtotal } from '@/lib/money'
import { detalharPedido } from '@/lib/tiny/api'
import { ErroDoTiny } from '@/lib/tiny/erros'
import { corDoMarcador, enderecoEmUmaLinha, type DetalheDoPedido } from '@/lib/tiny/leitura'
import { rotuloDoServico } from '@/lib/tiny/rotulos'
import { CabecalhoDaPagina } from '@/components/pagina'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SeloDaSituacao } from '../../selo-do-pedido'

/** Um pedido do Tiny por inteiro: cliente, entrega, itens, transporte e marcadores. */
export default async function PedidoNoTinyPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermissao('tiny.operar')
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()

  let pedido: DetalheDoPedido | null = null
  let erro: string | null = tinyConfigurado ? null : 'O Tiny ainda não está ligado.'
  if (tinyConfigurado) {
    try {
      pedido = await detalharPedido(id)
    } catch (e) {
      if (!(e instanceof ErroDoTiny)) throw e
      if (e.codigo === 20 || e.codigo === 32) notFound()
      erro = e.message
    }
  }

  const local = await db.pedidoTiny.findFirst({
    where: { tinyId: id },
    select: {
      solicitacao: { select: { id: true, codigo: true } },
      lote: { select: { id: true, marcador: true } },
    },
  })

  return (
    <>
      <Link
        href="/tiny/pedidos"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Pedidos no Tiny
      </Link>

      {!pedido ? (
        <div
          role="alert"
          className="border-warning/40 bg-warning/10 flex gap-3 rounded-lg border p-4 text-sm"
        >
          <AlertTriangle className="text-warning mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>{erro}</p>
        </div>
      ) : (
        <Detalhe pedido={pedido} local={local} />
      )}
    </>
  )
}

function Detalhe({
  pedido: p,
  local,
}: {
  pedido: DetalheDoPedido
  local: {
    solicitacao: { id: string; codigo: string } | null
    lote: { id: string; marcador: string } | null
  } | null
}) {
  return (
    <>
      <CabecalhoDaPagina
        sobrancelha={[p.data, p.ecommerce ? `e-commerce ${p.ecommerce}` : null]
          .filter(Boolean)
          .join(' · ')}
        titulo={`Pedido ${p.numero}`}
        descricao={p.cliente}
        acoes={<SeloDaSituacao situacao={p.situacao} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="itens" className="bg-card rounded-lg border">
            <h2 id="itens" className="font-display px-5 pt-5 text-lg font-semibold">
              Itens
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Unitário</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {p.itens.map((i, n) => (
                  <TableRow key={n}>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {i.codigo || '-'}
                    </TableCell>
                    <TableCell>{i.descricao}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {i.quantidade} {i.unidade}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatarBRL(i.valorUnitario)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatarBRL(subtotal(i.valorUnitario, i.quantidade))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <dl className="grid gap-1 border-t px-5 py-4 text-sm sm:ml-auto sm:max-w-xs">
              <Linha rotulo="Produtos" valor={formatarBRL(p.totalProdutos)} />
              <Linha rotulo="Frete" valor={formatarBRL(p.valorFrete)} />
              {Number(p.valorDesconto) ? (
                <Linha rotulo="Desconto" valor={`- ${formatarBRL(p.valorDesconto)}`} />
              ) : null}
              <Linha rotulo="Total" valor={formatarBRL(p.valor)} forte />
            </dl>
          </section>

          {p.observacao || p.observacaoInterna ? (
            <section aria-labelledby="obs" className="bg-card rounded-lg border p-5">
              <h2 id="obs" className="font-display mb-3 text-lg font-semibold">
                Observações
              </h2>
              {p.observacao ? <p className="text-sm whitespace-pre-line">{p.observacao}</p> : null}
              {p.observacaoInterna ? (
                <p className="text-muted-foreground mt-2 text-sm whitespace-pre-line">
                  Interna: {p.observacaoInterna}
                </p>
              ) : null}
            </section>
          ) : null}
        </div>

        <div className="space-y-6">
          <Cartao titulo="Cliente">
            <p className="font-medium">{p.clienteDados.nome}</p>
            {p.clienteDados.cpfCnpj ? (
              <p className="text-muted-foreground tabular-nums">
                {p.clienteDados.cpfCnpj.length === 11
                  ? formatarCpf(p.clienteDados.cpfCnpj)
                  : p.clienteDados.cpfCnpj}
              </p>
            ) : null}
            {p.clienteDados.email ? <p>{p.clienteDados.email}</p> : null}
            {p.clienteDados.fone ? <p className="tabular-nums">{p.clienteDados.fone}</p> : null}
            <p className="text-muted-foreground mt-2">
              {enderecoEmUmaLinha(p.clienteDados.endereco) || 'Sem endereço'}
            </p>
          </Cartao>

          {p.entrega ? (
            <Cartao titulo="Entrega">
              <p className="font-medium">{p.entrega.nome}</p>
              <p className="text-muted-foreground">{enderecoEmUmaLinha(p.entrega.endereco)}</p>
            </Cartao>
          ) : null}

          <Cartao titulo="Transporte">
            <dl className="grid gap-1">
              <Linha rotulo="Transportadora" valor={p.transportadora ?? '-'} />
              <Linha rotulo="Serviço" valor={rotuloDoServico(p.formaFrete, p.formaEnvio)} />
              <Linha
                rotulo="Rastreio"
                valor={
                  p.rastreio ? (
                    p.urlRastreio ? (
                      <a
                        href={p.urlRastreio}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary-emphasis tabular-nums underline underline-offset-4"
                      >
                        {p.rastreio}
                      </a>
                    ) : (
                      p.rastreio
                    )
                  ) : (
                    '-'
                  )
                }
              />
              <Linha rotulo="Nota fiscal" valor={p.notaFiscalId ? 'emitida' : '-'} />
              {p.dataEnvio ? <Linha rotulo="Enviado em" valor={p.dataEnvio} /> : null}
              {p.dataEntrega ? <Linha rotulo="Entregue em" valor={p.dataEntrega} /> : null}
            </dl>
          </Cartao>

          {p.marcadores.length ? (
            <Cartao titulo="Marcadores">
              <ul className="flex flex-wrap gap-2">
                {p.marcadores.map((m) => (
                  <li
                    key={m.descricao}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs"
                  >
                    <span
                      aria-hidden="true"
                      className="bg-muted-foreground size-2 rounded-full"
                      style={corDoMarcador(m.cor) ? { background: corDoMarcador(m.cor)! } : {}}
                    />
                    {m.descricao}
                  </li>
                ))}
              </ul>
            </Cartao>
          ) : null}

          {local?.solicitacao || local?.lote ? (
            <Cartao titulo="Criado por esta ferramenta">
              {local.solicitacao ? (
                <Link
                  href={`/admin/solicitacoes/${local.solicitacao.id}` as Route}
                  className="hover:text-primary-emphasis underline underline-offset-4"
                >
                  Solicitação {local.solicitacao.codigo}
                </Link>
              ) : (
                <Link
                  href={`/tiny/lotes/${local.lote!.id}` as Route}
                  className="hover:text-primary-emphasis underline underline-offset-4"
                >
                  Lote {local.lote!.marcador}
                </Link>
              )}
            </Cartao>
          ) : null}
        </div>
      </div>
    </>
  )
}

function Cartao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="bg-card rounded-lg border p-5 text-sm">
      <h2 className="font-display mb-3 text-lg font-semibold">{titulo}</h2>
      {children}
    </section>
  )
}

function Linha({
  rotulo,
  valor,
  forte = false,
}: {
  rotulo: string
  valor: React.ReactNode
  forte?: boolean
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className={forte ? 'font-semibold tabular-nums' : 'text-right tabular-nums'}>{valor}</dd>
    </div>
  )
}
