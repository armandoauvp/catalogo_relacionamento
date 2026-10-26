import Link from 'next/link'
import type { Route } from 'next'
import { AlertTriangle, Upload } from 'lucide-react'
import type { EnvioTiny, OrigemPedidoTiny, Prisma } from '@prisma/client'
import { FiltroDoGrupo, FiltrosAtivos, type FiltroAtivo } from '@/components/filtro-por-grupo'
import { hrefDoGrupo, hrefSemFiltro, valorDoFiltro } from '@/lib/filtro-por-grupo'
import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { env, tinyConfigurado } from '@/lib/env'
import { formatarDataHora } from '@/lib/datas'
import { configuracaoTiny, enviadosNaSemana } from '@/lib/tiny/fila'
import { ROTULO_ENVIO } from '@/lib/tiny/rotulos'
import { CabecalhoDaPagina, EstadoVazio } from '@/components/pagina'
import { LinkDeFiltro } from '@/components/filtro-sem-piscar'
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
import { AtualizarEnquanto, BotaoReenviar, BotoesDaFila } from './acoes-da-fila'
import { SeloDoPedido } from './selo-do-pedido'
import { ConfiguracaoDosPresentes } from './configuracao'

/**
 * Integração com o Tiny: o que está na fila, o que foi, o que falhou e por
 * quê. Ver docs/13-tiny.md.
 */

const FILTROS: { valor: EnvioTiny | null; rotulo: string }[] = [
  { valor: null, rotulo: 'Todos' },
  { valor: 'falhou', rotulo: 'Falhas' },
  { valor: 'pendente', rotulo: 'Na fila' },
  { valor: 'enviado', rotulo: 'No Tiny' },
]

const ROTULO_DA_ORIGEM: Record<OrigemPedidoTiny, string> = {
  solicitacao: 'Presente',
  lote: 'Lote',
  avulso: 'Avulso',
}

export default async function TinyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await exigirPermissao('tiny.operar')
  const params = await searchParams
  const caminho = '/tiny'
  const filtro = FILTROS.find((f) => f.valor === params.envio)?.valor ?? null
  const origem = (Object.keys(ROTULO_DA_ORIGEM) as OrigemPedidoTiny[]).find(
    (o) => o === params.origem,
  )
  const grupo = (chave: string, valor: string) => ({
    href: hrefDoGrupo(caminho, params, chave, valor),
    ativo: valorDoFiltro(params, chave) === valor,
  })

  const onde: Prisma.PedidoTinyWhereInput = {
    ...(filtro === 'pendente'
      ? { envio: { in: ['pendente', 'processando'] } }
      : filtro
        ? { envio: filtro }
        : {}),
    ...(origem ? { origem } : {}),
  }
  const filtrosAtivos: FiltroAtivo[] = origem
    ? [
        {
          coluna: 'Origem',
          valor: ROTULO_DA_ORIGEM[origem],
          semEle: hrefSemFiltro(caminho, params, 'origem'),
        },
      ]
    : []

  const [configuracao, porEnvio, enviadosNaUltimaSemana, lotes, pedidos, eventos] =
    await Promise.all([
      configuracaoTiny(),
      db.pedidoTiny.groupBy({ by: ['envio'], _count: { _all: true } }),
      enviadosNaSemana(),
      db.loteTiny.findMany({
        orderBy: { criadoEm: 'desc' },
        take: 8,
        include: {
          criadoPor: { select: { nome: true } },
          pedidos: { select: { envio: true } },
        },
      }),
      db.pedidoTiny.findMany({
        where: onde,
        orderBy: [{ criadoEm: 'desc' }],
        take: 60,
        include: {
          solicitacao: { select: { id: true, codigo: true } },
          lote: { select: { id: true, marcador: true } },
          criadoPor: { select: { nome: true } },
        },
      }),
      db.eventoTiny.findMany({
        orderBy: { criadoEm: 'desc' },
        take: 12,
        include: { usuario: { select: { nome: true } } },
      }),
    ])

  const contagem = (e: EnvioTiny) => porEnvio.find((p) => p.envio === e)?._count._all ?? 0
  const naFila = contagem('pendente') + contagem('processando')
  const falhas = contagem('falhou')

  return (
    <>
      <AtualizarEnquanto ativo={naFila > 0} intervaloMs={8000} />
      <CabecalhoDaPagina
        titulo="Tiny"
        descricao="Os pedidos que a ferramenta manda ao Tiny: presentes aprovados e envios em lote, com a situação e o rastreio que voltam de lá."
        acoes={
          <>
            <Button variant="outline" asChild>
              <Link href="/tiny/importar">
                <Upload aria-hidden="true" />
                Importar lote
              </Link>
            </Button>
            <BotoesDaFila />
          </>
        }
      />

      {!tinyConfigurado || !env.CRON_SECRET ? (
        <div
          role="alert"
          className="border-warning/40 bg-warning/10 mb-6 flex gap-3 rounded-lg border p-4 text-sm"
        >
          <AlertTriangle className="text-warning mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            {!tinyConfigurado ? (
              <p>
                <span className="font-semibold">O Tiny ainda não está ligado.</span> Falta o token
                em <code>TINY_API_TOKEN</code>, na Vercel. Até lá nenhum pedido entra na fila.
              </p>
            ) : null}
            {!env.CRON_SECRET ? (
              <p>
                <span className="font-semibold">O agendador não está ligado.</span> Sem{' '}
                <code>CRON_SECRET</code>, a fila só anda logo depois de cada envio e pelo botão
                &quot;Processar fila agora&quot;, e o rastreio só volta pelo botão.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat
          destaque
          rotulo="Na fila"
          valor={naFila}
          apoio="Esperando a vez ou uma nova tentativa."
        />
        <Stat
          rotulo="Falhas"
          valor={falhas}
          apoio={falhas ? 'Precisam de correção e reenvio.' : 'Nenhuma pendente.'}
        />
        <Stat
          rotulo="No Tiny na última semana"
          valor={enviadosNaUltimaSemana}
          apoio="Pedidos criados lá."
        />
      </div>

      <section aria-labelledby="lotes" className="mb-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 id="lotes" className="font-display text-lg font-semibold">
            Lotes importados
          </h2>
          <Link
            href="/tiny/importar"
            className="text-primary-emphasis text-sm underline-offset-4 hover:underline"
          >
            Importar planilha
          </Link>
        </div>
        {lotes.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum lote ainda"
            descricao="Uma planilha com uma linha por destinatário vira um pedido no Tiny para cada um."
          />
        ) : (
          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Marcador</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead>Andamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotes.map((l) => {
                  const enviados = l.pedidos.filter((p) => p.envio === 'enviado').length
                  const falhasDoLote = l.pedidos.filter((p) => p.envio === 'falhou').length
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
                        {formatarDataHora(l.criadoEm)}
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link
                          href={`/tiny/lotes/${l.id}` as Route}
                          className="hover:text-primary-emphasis underline-offset-4 hover:underline"
                        >
                          {l.marcador}
                        </Link>
                      </TableCell>
                      <TableCell>{l.produto}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.pedidos.length}</TableCell>
                      <TableCell className="text-sm">
                        {enviados} no Tiny
                        {falhasDoLote ? (
                          <span className="text-destructive"> · {falhasDoLote} com falha</span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section aria-labelledby="pedidos" className="mb-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 id="pedidos" className="font-display text-lg font-semibold">
            Pedidos
          </h2>
          <nav aria-label="Filtrar pedidos" className="bg-muted flex rounded-md p-0.5">
            {FILTROS.map((f) => (
              <Button
                key={f.rotulo}
                size="sm"
                variant={filtro === f.valor ? 'secondary' : 'ghost'}
                asChild
              >
                <LinkDeFiltro
                  href={
                    (f.valor
                      ? hrefDoGrupo(caminho, { ...params, envio: undefined }, 'envio', f.valor)
                      : hrefSemFiltro(caminho, params, 'envio')) as Route
                  }
                  aria-current={filtro === f.valor ? 'true' : undefined}
                >
                  {f.rotulo}
                </LinkDeFiltro>
              </Button>
            ))}
          </nav>
        </div>
        <FiltrosAtivos filtros={filtrosAtivos} />
        {pedidos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum pedido aqui"
            descricao="Os presentes aprovados e as linhas dos lotes aparecem aqui assim que entram na fila."
          />
        ) : (
          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>O que vai</TableHead>
                  <TableHead>Andamento</TableHead>
                  <TableHead>Rastreio</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <span className="font-medium">{p.destinatario}</span>
                      <span className="text-muted-foreground block text-xs tabular-nums">
                        {formatarDataHora(p.criadoEm)}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <FiltroDoGrupo
                        {...grupo('origem', p.origem)}
                        rotulo={`origem ${ROTULO_DA_ORIGEM[p.origem]}`}
                        texto
                        className="text-muted-foreground mr-1.5 text-xs"
                      >
                        {ROTULO_DA_ORIGEM[p.origem]}
                      </FiltroDoGrupo>
                      {p.solicitacao ? (
                        <Link
                          href={`/admin/solicitacoes/${p.solicitacao.id}` as Route}
                          className="hover:text-primary-emphasis tabular-nums underline-offset-4 hover:underline"
                        >
                          {p.solicitacao.codigo}
                        </Link>
                      ) : p.lote ? (
                        <Link
                          href={`/tiny/lotes/${p.lote.id}` as Route}
                          className="hover:text-primary-emphasis underline-offset-4 hover:underline"
                        >
                          Lote {p.lote.marcador}
                          {p.linha ? (
                            <span className="text-muted-foreground"> · linha {p.linha}</span>
                          ) : null}
                        </Link>
                      ) : p.criadoPor ? (
                        <span className="text-muted-foreground">{p.criadoPor.nome}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-sm" title={p.resumo}>
                      {p.resumo}
                    </TableCell>
                    <TableCell>
                      {/* "Enviando" é a fila no meio do envio: entra no mesmo grupo da fila. */}
                      <FiltroDoGrupo
                        {...grupo('envio', p.envio === 'processando' ? 'pendente' : p.envio)}
                        rotulo={`andamento ${ROTULO_ENVIO[p.envio]}`}
                      >
                        <SeloDoPedido pedido={p} />
                      </FiltroDoGrupo>
                      {p.erro ? (
                        <p className="text-destructive mt-1 max-w-72 text-xs">{p.erro}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {p.rastreio ? (
                        p.urlRastreio ? (
                          <a
                            href={p.urlRastreio}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary-emphasis tabular-nums underline-offset-4 hover:underline"
                          >
                            {p.rastreio}
                          </a>
                        ) : (
                          <span className="tabular-nums">{p.rastreio}</span>
                        )
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.envio === 'falhou' || (p.envio === 'pendente' && p.erro) ? (
                        <BotaoReenviar id={p.id} />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="configuracao" className="bg-card rounded-lg border p-5">
          <h2 id="configuracao" className="font-display mb-1 text-lg font-semibold">
            Presentes aprovados
          </h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Como a solicitação de presente vira pedido no Tiny.
          </p>
          <ConfiguracaoDosPresentes configuracao={configuracao} />
        </section>

        <section aria-labelledby="eventos" className="bg-card rounded-lg border p-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 id="eventos" className="font-display text-lg font-semibold">
              Últimos acontecimentos
            </h2>
            <Link
              href="/tiny/historico"
              className="text-primary-emphasis text-sm underline-offset-4 hover:underline"
            >
              Histórico completo
            </Link>
          </div>
          {eventos.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nada ainda.</p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {eventos.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="text-muted-foreground w-28 shrink-0 text-xs tabular-nums">
                    {formatarDataHora(e.criadoEm)}
                  </span>
                  <span className={e.tipo === 'falhou' ? 'text-destructive' : undefined}>
                    {e.mensagem}
                    {e.usuario ? (
                      <span className="text-muted-foreground"> · {e.usuario.nome}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
