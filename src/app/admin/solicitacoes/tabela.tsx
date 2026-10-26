'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { StatusSolicitacao } from '@prisma/client'
import { Loader2, PackageCheck, ShoppingCart, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { FiltroDoGrupo } from '@/components/filtro-por-grupo'
import { hrefDoGrupo, valorDoFiltro, type ParametrosDaUrl } from '@/lib/filtro-por-grupo'
import { ROTULO_STATUS } from '@/lib/status'
import { encaminharEmLote, type ResumoDoLote } from '@/lib/actions/solicitacoes'
import type { Encaminhamento } from '@/lib/status'
import { cn } from '@/lib/utils'

/**
 * Lista da gestão, com encaminhamento em lote.
 *
 * O Admin trabalha por pilha: chegam vinte pedidos e ele decide de uma vez
 * quais vão para a compra e quais já podem ser separados. Abrir vinte telas
 * para isso é justamente o que a planilha fazia melhor que um sistema.
 *
 * A coluna "rota" existe para que a decisão não dependa de abrir cada pedido:
 * ela diz, antes do clique, se aquela solicitação tem o que comprar. Quem
 * decide continua sendo o Admin, o botão de mandar para o Financeiro fica
 * disponível mesmo quando há estoque.
 */

export type LinhaDaGestao = {
  id: string
  codigo: string
  data: string
  consultor: string
  consultorId: string
  cliente: string
  clienteId: string
  itens: number
  valor: string
  status: StatusSolicitacao
  /** Nulo quando a solicitação já passou do ponto em que a rota importa. */
  precisaDeCompra: boolean | null
  rastreio: string | null
}

/** Status em que o encaminhamento em lote faz sentido. */
const ENCAMINHAVEIS: readonly StatusSolicitacao[] = [
  StatusSolicitacao.pendente,
  StatusSolicitacao.aguardando_aprovacao,
]

export function TabelaDaGestao({
  linhas,
  podeEncaminhar,
  filtroDaUrl,
}: {
  linhas: LinhaDaGestao[]
  podeEncaminhar: boolean
  /** A query da tela, para os grupos da linha virarem filtro. */
  filtroDaUrl: ParametrosDaUrl
}) {
  const grupo = (chave: string, valor: string) => ({
    href: hrefDoGrupo('/admin/solicitacoes', filtroDaUrl, chave, valor),
    ativo: valorDoFiltro(filtroDaUrl, chave) === valor,
  })

  const router = useRouter()
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [enviando, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [resumo, setResumo] = useState<ResumoDoLote | null>(null)

  const encaminhaveis = linhas.filter((l) => ENCAMINHAVEIS.includes(l.status))
  const todasMarcadas =
    encaminhaveis.length > 0 && encaminhaveis.every((l) => selecionadas.has(l.id))

  function alternar(id: string) {
    setSelecionadas((atuais) => {
      const proximas = new Set(atuais)
      if (proximas.has(id)) proximas.delete(id)
      else proximas.add(id)
      return proximas
    })
  }

  function encaminhar(destino: Encaminhamento) {
    setErro(null)
    setResumo(null)
    iniciar(async () => {
      const r = await encaminharEmLote([...selecionadas], destino)
      if (!r.ok) return setErro(r.erro)
      setResumo(r.dados)
      setSelecionadas(new Set())
      router.refresh()
    })
  }

  return (
    <>
      {podeEncaminhar ? (
        <BarraDeLote
          quantidade={selecionadas.size}
          enviando={enviando}
          encaminhar={encaminhar}
          limpar={() => setSelecionadas(new Set())}
        />
      ) : null}

      {erro ? (
        <p
          role="alert"
          className="border-error/30 bg-error/10 text-error mb-4 rounded-lg border px-4 py-3 text-sm"
        >
          {erro}
        </p>
      ) : null}

      {resumo ? <ResumoDoEncaminhamento resumo={resumo} aoFechar={() => setResumo(null)} /> : null}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {podeEncaminhar ? (
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="accent-primary size-4 align-middle"
                    aria-label="Selecionar todas as encaminháveis"
                    checked={todasMarcadas}
                    disabled={encaminhaveis.length === 0}
                    onChange={(e) =>
                      setSelecionadas(
                        e.target.checked ? new Set(encaminhaveis.map((l) => l.id)) : new Set(),
                      )
                    }
                  />
                </TableHead>
              ) : null}
              <TableHead>Código</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Consultor</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Itens</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Rota</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l) => {
              const selecionavel = podeEncaminhar && ENCAMINHAVEIS.includes(l.status)
              const marcada = selecionadas.has(l.id)

              return (
                <TableRow key={l.id} className={cn(marcada && 'bg-primary/5')}>
                  {podeEncaminhar ? (
                    <TableCell>
                      <input
                        type="checkbox"
                        className="accent-primary size-4 align-middle"
                        aria-label={`Selecionar ${l.codigo}`}
                        checked={marcada}
                        disabled={!selecionavel}
                        onChange={() => alternar(l.id)}
                      />
                    </TableCell>
                  ) : null}

                  <TableCell className="font-medium whitespace-nowrap tabular-nums">
                    <Link
                      href={`/admin/solicitacoes/${l.id}`}
                      className="hover:text-primary-emphasis underline-offset-4 hover:underline"
                    >
                      {l.codigo}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
                    {l.data}
                  </TableCell>
                  <TableCell>
                    <FiltroDoGrupo
                      {...grupo('consultorId', l.consultorId)}
                      rotulo={`consultor ${l.consultor}`}
                      texto
                    >
                      {l.consultor}
                    </FiltroDoGrupo>
                  </TableCell>
                  <TableCell>
                    <FiltroDoGrupo
                      {...grupo('clienteId', l.clienteId)}
                      rotulo={`cliente ${l.cliente}`}
                      texto
                    >
                      {l.cliente}
                    </FiltroDoGrupo>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{l.itens}</TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                    {l.valor}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {/* A rota é informação de apoio, não status: fica em tom
                        neutro para não competir com a coluna ao lado. */}
                    {l.precisaDeCompra === null ? (
                      <span className="text-muted-foreground">-</span>
                    ) : l.precisaDeCompra ? (
                      <FiltroDoGrupo {...grupo('rota', 'compra')} rotulo="rota compra">
                        <Badge variant="outline">compra</Badge>
                      </FiltroDoGrupo>
                    ) : (
                      <FiltroDoGrupo {...grupo('rota', 'estoque')} rotulo="rota estoque">
                        <Badge variant="muted">estoque</Badge>
                      </FiltroDoGrupo>
                    )}
                  </TableCell>
                  <TableCell>
                    <FiltroDoGrupo
                      {...grupo('status', l.status)}
                      rotulo={`status ${ROTULO_STATUS[l.status]}`}
                    >
                      <StatusBadge status={l.status} />
                    </FiltroDoGrupo>
                    {l.rastreio ? (
                      <span className="text-muted-foreground mt-0.5 block text-xs tabular-nums">
                        {l.rastreio}
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}

/**
 * Barra de ações do lote.
 *
 * Ocupa altura fixa mesmo vazia: se ela aparecesse ao marcar a primeira linha,
 * a tabela inteira desceria sob o cursor e o segundo clique cairia na linha
 * errada.
 */
function BarraDeLote({
  quantidade,
  enviando,
  encaminhar,
  limpar,
}: {
  quantidade: number
  enviando: boolean
  encaminhar: (destino: Encaminhamento) => void
  limpar: () => void
}) {
  const vazia = quantidade === 0

  return (
    <div
      className={cn(
        'ease-apple mb-4 flex min-h-14 flex-wrap items-center gap-2 rounded-lg border px-3 py-2 transition-colors duration-200',
        vazia ? 'bg-muted/30' : 'border-primary/30 bg-primary/5',
      )}
    >
      {vazia ? (
        <p className="text-muted-foreground text-sm">
          Marque as solicitações pendentes para aprovar e encaminhar em lote.
        </p>
      ) : (
        <>
          <p className="text-sm font-medium">
            {quantidade} {quantidade === 1 ? 'selecionada' : 'selecionadas'}
          </p>

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Button size="sm" disabled={enviando} onClick={() => encaminhar('automatico')}>
              {enviando ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Check aria-hidden="true" />
              )}
              Aprovar e encaminhar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={enviando}
              onClick={() => encaminhar(StatusSolicitacao.aguardando_compra)}
            >
              <ShoppingCart aria-hidden="true" />
              Mandar comprar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={enviando}
              onClick={() => encaminhar(StatusSolicitacao.organizando_envio)}
            >
              <PackageCheck aria-hidden="true" />
              Liberar para envio
            </Button>
            <Button size="sm" variant="ghost" disabled={enviando} onClick={limpar}>
              Limpar
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

/** O que andou e o que ficou parado, com o motivo de cada uma que ficou. */
function ResumoDoEncaminhamento({
  resumo,
  aoFechar,
}: {
  resumo: ResumoDoLote
  aoFechar: () => void
}) {
  return (
    <div className="mb-4 space-y-3">
      {resumo.movidas.length > 0 ? (
        <div className="border-success/30 bg-success/10 rounded-lg border px-4 py-3 text-sm">
          <p className="font-medium">
            {resumo.movidas.length}{' '}
            {resumo.movidas.length === 1 ? 'solicitação encaminhada' : 'solicitações encaminhadas'}
          </p>
          <ul className="text-muted-foreground mt-1.5 space-y-0.5 text-xs">
            {resumo.movidas.map((m) => (
              <li key={m.codigo}>
                <span className="tabular-nums">{m.codigo}</span> → {m.para}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {resumo.ignoradas.length > 0 ? (
        <div className="border-warning/40 bg-warning/10 rounded-lg border px-4 py-3 text-sm">
          <p className="font-medium">
            {resumo.ignoradas.length}{' '}
            {resumo.ignoradas.length === 1 ? 'ficou parada' : 'ficaram paradas'}
          </p>
          <ul className="text-muted-foreground mt-1.5 space-y-0.5 text-xs">
            {resumo.ignoradas.map((i) => (
              <li key={i.codigo}>
                <span className="tabular-nums">{i.codigo}</span>: {i.motivo}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Button variant="ghost" size="sm" onClick={aoFechar}>
        Fechar
      </Button>
    </div>
  )
}
