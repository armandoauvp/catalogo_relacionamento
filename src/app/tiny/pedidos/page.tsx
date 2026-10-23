import Link from 'next/link'
import type { Route } from 'next'
import { AlertTriangle } from 'lucide-react'
import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { tinyConfigurado } from '@/lib/env'
import { formatarBRL } from '@/lib/money'
import { pesquisarPedidos } from '@/lib/tiny/api'
import { ErroDoTiny } from '@/lib/tiny/erros'
import {
  classificarBusca,
  dataParaOTiny,
  SITUACOES_DE_PEDIDO,
  type PaginaDePedidos,
} from '@/lib/tiny/leitura'
import { rotuloDaSituacao } from '@/lib/tiny/rotulos'
import { BotaoDeFiltro, FormDeFiltro, LinkDeFiltro } from '@/components/filtro-sem-piscar'
import { BarraDeFiltros, CabecalhoDaPagina, EstadoVazio } from '@/components/pagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SeloDaSituacao } from '../selo-do-pedido'

/**
 * Todos os pedidos do Tiny, inclusive os do e-commerce e os que nasceram lá:
 * a consulta que o AUVP-Eventos tinha. Só leitura, direto da API, sem guardar
 * nada aqui. Os que esta ferramenta criou ganham o link para a origem.
 */

type Params = { busca?: string; situacao?: string; de?: string; ate?: string; pagina?: string }

export default async function PedidosNoTinyPage({
  searchParams,
}: {
  searchParams: Promise<Params>
}) {
  await exigirPermissao('tiny.operar')
  const params = await searchParams
  const pagina = Math.max(1, Number(params.pagina) || 1)
  const situacao = SITUACOES_DE_PEDIDO.find((s) => s === params.situacao) ?? null

  let resultado: PaginaDePedidos | null = null
  let erro: string | null = null
  if (tinyConfigurado) {
    try {
      resultado = await pesquisarPedidos({
        pagina,
        busca: classificarBusca(params.busca ?? ''),
        situacao,
        dataInicial: dataParaOTiny(params.de),
        dataFinal: dataParaOTiny(params.ate),
      })
    } catch (e) {
      if (!(e instanceof ErroDoTiny)) throw e
      erro = e.message
    }
  }

  // Os que nasceram aqui, para levar à solicitação ou ao lote.
  const daqui = resultado?.pedidos.length
    ? await db.pedidoTiny.findMany({
        where: { tinyId: { in: resultado.pedidos.map((p) => p.id) } },
        select: {
          tinyId: true,
          solicitacao: { select: { id: true, codigo: true } },
          lote: { select: { id: true, marcador: true } },
        },
      })
    : []
  const origem = new Map(daqui.map((p) => [p.tinyId, p]))

  const linkDaPagina = (n: number) => {
    const q = new URLSearchParams()
    for (const [chave, valor] of Object.entries(params)) {
      if (valor && chave !== 'pagina') q.set(chave, valor)
    }
    if (n > 1) q.set('pagina', String(n))
    const s = q.toString()
    return (s ? `/tiny/pedidos?${s}` : '/tiny/pedidos') as Route
  }

  return (
    <>
      <CabecalhoDaPagina
        titulo="Pedidos no Tiny"
        descricao="Todos os pedidos da conta, inclusive os do e-commerce. Busque pelo número, pelo CPF/CNPJ ou pelo nome do cliente."
      />

      <BarraDeFiltros>
        <FormDeFiltro acao="/tiny/pedidos" className="flex flex-1 flex-wrap items-center gap-2">
          <Input
            name="busca"
            defaultValue={params.busca}
            placeholder="Número, CPF/CNPJ ou nome"
            aria-label="Buscar pedidos no Tiny"
            className="w-64"
          />
          <Select
            name="situacao"
            defaultValue={situacao ?? ''}
            aria-label="Situação"
            className="w-48"
          >
            <option value="">Todas as situações</option>
            {SITUACOES_DE_PEDIDO.map((s) => (
              <option key={s} value={s}>
                {rotuloDaSituacao(s)}
              </option>
            ))}
          </Select>
          <Input
            name="de"
            type="date"
            defaultValue={params.de}
            aria-label="Data inicial"
            className="w-40"
          />
          <Input
            name="ate"
            type="date"
            defaultValue={params.ate}
            aria-label="Data final"
            className="w-40"
          />
          <BotaoDeFiltro>Buscar</BotaoDeFiltro>
        </FormDeFiltro>
      </BarraDeFiltros>

      {!tinyConfigurado || erro ? (
        <div
          role="alert"
          className="border-warning/40 bg-warning/10 mb-6 flex gap-3 rounded-lg border p-4 text-sm"
        >
          <AlertTriangle className="text-warning mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>
            {erro ? (
              <>
                <span className="font-semibold">O Tiny não respondeu à busca.</span> {erro}
              </>
            ) : (
              <>
                <span className="font-semibold">O Tiny ainda não está ligado.</span> Falta o token
                em <code>TINY_API_TOKEN</code>, na Vercel.
              </>
            )}
          </p>
        </div>
      ) : null}

      {resultado && resultado.pedidos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum pedido encontrado"
          descricao="Confira o número ou o documento, ou tire um dos filtros."
        />
      ) : null}

      {resultado && resultado.pedidos.length > 0 ? (
        <>
          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Rastreio</TableHead>
                  <TableHead>Origem aqui</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultado.pedidos.map((p) => {
                  const local = origem.get(p.id)
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium whitespace-nowrap tabular-nums">
                        <Link
                          href={`/tiny/pedidos/${p.id}` as Route}
                          className="hover:text-primary-emphasis underline-offset-4 hover:underline"
                        >
                          {p.numero}
                        </Link>
                        {p.numeroEcommerce ? (
                          <span className="text-muted-foreground block text-xs">
                            e-commerce {p.numeroEcommerce}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">{p.data}</TableCell>
                      <TableCell>{p.cliente}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatarBRL(p.valor)}
                      </TableCell>
                      <TableCell>
                        <SeloDaSituacao situacao={p.situacao} />
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {p.rastreio ?? <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {local?.solicitacao ? (
                          <Link
                            href={`/admin/solicitacoes/${local.solicitacao.id}` as Route}
                            className="hover:text-primary-emphasis tabular-nums underline-offset-4 hover:underline"
                          >
                            {local.solicitacao.codigo}
                          </Link>
                        ) : local?.lote ? (
                          <Link
                            href={`/tiny/lotes/${local.lote.id}` as Route}
                            className="hover:text-primary-emphasis underline-offset-4 hover:underline"
                          >
                            Lote {local.lote.marcador}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {resultado.paginas > 1 ? (
            <nav
              aria-label="Páginas"
              className="mt-4 flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-muted-foreground tabular-nums">
                Página {resultado.pagina} de {resultado.paginas}
              </span>
              <span className="flex gap-2">
                {resultado.pagina > 1 ? (
                  <Button variant="outline" size="sm" asChild>
                    <LinkDeFiltro href={linkDaPagina(resultado.pagina - 1)}>Anterior</LinkDeFiltro>
                  </Button>
                ) : null}
                {resultado.pagina < resultado.paginas ? (
                  <Button variant="outline" size="sm" asChild>
                    <LinkDeFiltro href={linkDaPagina(resultado.pagina + 1)}>Próxima</LinkDeFiltro>
                  </Button>
                ) : null}
              </span>
            </nav>
          ) : null}
        </>
      ) : null}
    </>
  )
}
