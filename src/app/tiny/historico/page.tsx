import Link from 'next/link'
import type { Route } from 'next'
import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { formatarDataHora } from '@/lib/datas'
import {
  filtroDoHistoricoSchema,
  PESSOA_DA_FILA,
  POR_PAGINA,
  ROTULO_DO_EVENTO,
  rotuloDoEvento,
  whereDoHistorico,
} from '@/lib/tiny/historico'
import { BotaoDeFiltro, FormDeFiltro, LinkDeFiltro } from '@/components/filtro-sem-piscar'
import { BarraDeFiltros, CabecalhoDaPagina, EstadoVazio } from '@/components/pagina'
import { Badge } from '@/components/ui/badge'
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

/** O tom do selo: o que deu errado salta, o que deu certo acalma, o resto some. */
function tomDoEvento(tipo: string) {
  if (tipo === 'falhou' || tipo === 'duplicidade') return 'error' as const
  if (tipo === 'enviado') return 'success' as const
  if (tipo === 'adiado') return 'warning' as const
  return 'muted' as const
}

/**
 * Histórico da integração com o Tiny: cada pedido criado, recusado, reenviado,
 * cada passo da expedição, lote e contato, com quem fez. Filtra por período,
 * tipo, pessoa e texto.
 */
export default async function HistoricoDoTinyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await exigirPermissao('tiny.operar')
  const params = await searchParams
  const filtro = filtroDoHistoricoSchema.parse(params)
  const where = whereDoHistorico(filtro)

  const [eventos, total, pessoas] = await Promise.all([
    db.eventoTiny.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      skip: (filtro.pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: {
        usuario: { select: { nome: true } },
        pedido: {
          select: {
            tinyId: true,
            solicitacao: { select: { id: true, codigo: true } },
            lote: { select: { id: true, marcador: true } },
          },
        },
      },
    }),
    db.eventoTiny.count({ where }),
    db.usuario.findMany({
      where: { eventosTiny: { some: {} } },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const linkDaPagina = (n: number) => {
    const q = new URLSearchParams()
    for (const [chave, valor] of Object.entries(params)) {
      if (valor && chave !== 'pagina') q.set(chave, valor)
    }
    if (n > 1) q.set('pagina', String(n))
    const s = q.toString()
    return (s ? `/tiny/historico?${s}` : '/tiny/historico') as Route
  }

  return (
    <>
      <CabecalhoDaPagina
        titulo="Histórico do Tiny"
        descricao="Tudo o que a integração fez, e quem pediu: pedidos, lotes, passos da expedição, contatos e recusas do Tiny."
      />

      <BarraDeFiltros>
        <FormDeFiltro acao="/tiny/historico" className="flex flex-1 flex-wrap items-center gap-2">
          <Input
            name="busca"
            defaultValue={filtro.busca}
            placeholder="Nome, código, marcador"
            aria-label="Buscar no histórico"
            className="w-56"
          />
          <Select name="tipo" defaultValue={filtro.tipo ?? ''} aria-label="Tipo" className="w-44">
            <option value="">Todos os tipos</option>
            {Object.entries(ROTULO_DO_EVENTO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Select>
          <Select
            name="pessoa"
            defaultValue={filtro.pessoa ?? ''}
            aria-label="Quem"
            className="w-44"
          >
            <option value="">Todas as pessoas</option>
            <option value={PESSOA_DA_FILA}>Automático</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Select>
          <Input
            name="de"
            type="date"
            defaultValue={filtro.de}
            aria-label="Desde"
            className="w-40"
          />
          <Input
            name="ate"
            type="date"
            defaultValue={filtro.ate}
            aria-label="Até"
            className="w-40"
          />
          <BotaoDeFiltro>Filtrar</BotaoDeFiltro>
        </FormDeFiltro>
      </BarraDeFiltros>

      {eventos.length === 0 ? (
        <EstadoVazio
          titulo="Nada neste recorte"
          descricao="Tire um dos filtros ou aumente o período."
        />
      ) : (
        <>
          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>O que aconteceu</TableHead>
                  <TableHead>Quem</TableHead>
                  <TableHead>Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventos.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
                      {formatarDataHora(e.criadoEm)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tomDoEvento(e.tipo)}>{rotuloDoEvento(e.tipo)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md text-sm">{e.mensagem}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {e.usuario?.nome ?? <span className="text-muted-foreground">automático</span>}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {e.pedido?.solicitacao ? (
                        <Link
                          href={`/admin/solicitacoes/${e.pedido.solicitacao.id}` as Route}
                          className="hover:text-primary-emphasis tabular-nums underline-offset-4 hover:underline"
                        >
                          {e.pedido.solicitacao.codigo}
                        </Link>
                      ) : e.pedido?.lote ? (
                        <Link
                          href={`/tiny/lotes/${e.pedido.lote.id}` as Route}
                          className="hover:text-primary-emphasis underline-offset-4 hover:underline"
                        >
                          Lote {e.pedido.lote.marcador}
                        </Link>
                      ) : e.pedido?.tinyId ? (
                        <Link
                          href={`/tiny/pedidos/${e.pedido.tinyId}` as Route}
                          className="hover:text-primary-emphasis underline-offset-4 hover:underline"
                        >
                          Pedido no Tiny
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <nav
            aria-label="Páginas"
            className="mt-4 flex items-center justify-between gap-3 text-sm"
          >
            <span className="text-muted-foreground tabular-nums">
              {total} {total === 1 ? 'acontecimento' : 'acontecimentos'} · página {filtro.pagina} de{' '}
              {paginas}
            </span>
            <span className="flex gap-2">
              {filtro.pagina > 1 ? (
                <Button variant="outline" size="sm" asChild>
                  <LinkDeFiltro href={linkDaPagina(filtro.pagina - 1)}>Anterior</LinkDeFiltro>
                </Button>
              ) : null}
              {filtro.pagina < paginas ? (
                <Button variant="outline" size="sm" asChild>
                  <LinkDeFiltro href={linkDaPagina(filtro.pagina + 1)}>Próxima</LinkDeFiltro>
                </Button>
              ) : null}
            </span>
          </nav>
        </>
      )}
    </>
  )
}
