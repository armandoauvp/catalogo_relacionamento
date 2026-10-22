import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { formatarDataHora } from '@/lib/datas'
import { formatarBRL } from '@/lib/money'
import { formatarCpf } from '@/lib/cpf'
import { CabecalhoDaPagina } from '@/components/pagina'
import { Stat } from '@/components/stat'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { passoPermitido, situacaoVigente } from '@/lib/tiny/ciclo'
import {
  AtualizarEnquanto,
  BotaoConcluir,
  BotaoFecharLote,
  BotaoReenviar,
  BotaoReenviarFalhas,
  BotoesDaFila,
} from '../../acoes-da-fila'
import { SeloDoPedido } from '../../selo-do-pedido'

/**
 * Um lote importado, linha a linha: o que já é pedido no Tiny, o que ainda
 * está na fila e o que falhou, com o motivo. Enquanto houver fila, a tela se
 * atualiza sozinha.
 */
export default async function LotePage({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermissao('tiny.operar')
  const { id } = await params

  const lote = await db.loteTiny.findUnique({
    where: { id },
    include: {
      criadoPor: { select: { nome: true } },
      pedidos: { orderBy: { linha: 'asc' } },
    },
  })
  if (!lote) notFound()

  const pedidos = lote.pedidos
  const conta = (f: (p: (typeof pedidos)[number]) => boolean) => pedidos.filter(f).length
  const naFila = conta((p) => p.envio === 'pendente' || p.envio === 'processando')
  const enviados = conta((p) => p.envio === 'enviado')
  const falhas = conta((p) => p.envio === 'falhou')

  return (
    <>
      <AtualizarEnquanto ativo={naFila > 0} />
      <Link
        href="/tiny"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Tiny
      </Link>
      <CabecalhoDaPagina
        sobrancelha={`${formatarDataHora(lote.criadoEm)}${lote.criadoPor ? ` · ${lote.criadoPor.nome}` : ''}`}
        titulo={`Lote ${lote.marcador}`}
        descricao={[
          `${lote.produto}${lote.sku ? ` (${lote.sku})` : ''}, ${formatarBRL(lote.valorUnitario)} cada`,
          lote.transportadora
            ? `${lote.transportadora}${lote.formaFrete ? ` · ${lote.formaFrete}` : ''}`
            : null,
          lote.arquivo ? `planilha ${lote.arquivo}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        acoes={
          <>
            <BotaoReenviarFalhas loteId={lote.id} falhas={falhas} />
            {pedidos.some(
              (p) => p.envio !== 'falhou' && passoPermitido(situacaoVigente(p), 'fechar'),
            ) ? (
              <BotaoFecharLote loteId={lote.id} />
            ) : null}
            <BotoesDaFila />
          </>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat
          destaque
          rotulo="No Tiny"
          valor={enviados}
          apoio={`de ${lote.pedidos.length} pedidos.`}
        />
        <Stat
          rotulo="Na fila"
          valor={naFila}
          apoio={naFila ? 'A tela se atualiza sozinha.' : 'Nada esperando.'}
        />
        <Stat
          rotulo="Falhas"
          valor={falhas}
          apoio={falhas ? 'O motivo está em cada linha.' : 'Nenhuma.'}
        />
      </div>

      <div className="bg-card overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-0">Linha</TableHead>
              <TableHead>Destinatário</TableHead>
              <TableHead>O que vai</TableHead>
              <TableHead>Andamento</TableHead>
              <TableHead>Rastreio</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lote.pedidos.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-muted-foreground tabular-nums">{p.linha}</TableCell>
                <TableCell>
                  <span className="font-medium">{p.destinatario}</span>
                  <span className="text-muted-foreground block text-xs tabular-nums">
                    {formatarCpf(p.cpfCnpj)}
                  </span>
                </TableCell>
                <TableCell className="text-sm">{p.resumo}</TableCell>
                <TableCell>
                  <SeloDoPedido pedido={p} />
                  {p.erro ? (
                    <p className="text-destructive mt-1 max-w-80 text-xs">{p.erro}</p>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap tabular-nums">
                  {p.rastreio ? (
                    p.urlRastreio ? (
                      <a
                        href={p.urlRastreio}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary-emphasis underline-offset-4 hover:underline"
                      >
                        {p.rastreio}
                      </a>
                    ) : (
                      p.rastreio
                    )
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {p.envio === 'falhou' || (p.envio === 'pendente' && p.erro) ? (
                    <BotaoReenviar id={p.id} />
                  ) : passoPermitido(situacaoVigente(p), 'concluir') ? (
                    <BotaoConcluir pedidoTinyId={p.id} />
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {lote.demandaId ? (
        <p className="text-muted-foreground mt-4 text-sm">
          O lote aparece na trilha do{' '}
          <Button variant="link" className="h-auto p-0" asChild>
            <Link href="/logistica">Dashboard Logístico</Link>
          </Button>{' '}
          e conclui sozinho quando todos os pedidos forem entregues no Tiny.
        </p>
      ) : null}
    </>
  )
}
