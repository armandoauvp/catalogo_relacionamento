import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { pode } from '@/lib/permissions'
import { formatarBRL, totalDosItens } from '@/lib/money'
import { formatarData } from '@/lib/datas'
import { filtroSolicitacoesSchema } from '@/lib/validators/filtros'
import { whereDaGestao } from '@/lib/solicitacoes-filtradas'
import { hrefSemFiltro } from '@/lib/filtro-por-grupo'
import { FiltrosAtivos, type FiltroAtivo } from '@/components/filtro-por-grupo'
import {
  ROTULO_STATUS,
  STATUS_FORA_DO_SALDO,
  STATUS_PARA_APROVAR,
  precisaDeCompra,
} from '@/lib/status'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Stat } from '@/components/stat'
import { BotaoDeFiltro, FormDeFiltro, LinkDeFiltro } from '@/components/filtro-sem-piscar'
import { BarraDeFiltros, CabecalhoDaPagina, EstadoVazio } from '@/components/pagina'
import { CartaoParaAprovar } from '@/components/cartao-para-aprovar'
import { cn } from '@/lib/utils'
import { TabelaDaGestao, type LinhaDaGestao } from './tabela'
import type { Route } from 'next'
import {
  ATALHOS_DA_GESTAO,
  atalhoAtivo,
  contagemDoAtalho,
  hrefDoAtalho,
} from '@/lib/atalhos-da-gestao'

/**
 * Painel de gestão.
 *
 * Os filtros da tela e os da exportação leem o mesmo schema e produzem o mesmo
 * `where`. É isso que sustenta o critério "a exportação respeita os filtros".
 */
export default async function AdminSolicitacoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const usuario = await exigirPermissao('solicitacao.verTodas')

  const params = await searchParams
  const filtro = filtroSolicitacoesSchema.parse(params)
  const where = await whereDaGestao(filtro)

  const aprova = pode(usuario.perfil, 'solicitacao.aprovar')

  const [solicitacoes, total, consultores, comProblema, paraAprovar, soma, porStatus] =
    await Promise.all([
      db.solicitacao.findMany({
        where,
        include: {
          cliente: { select: { id: true, nome: true } },
          consultor: { select: { id: true, nome: true } },
          // As colunas "presente" e "rota" são o que evita abrir vinte telas
          // para aprovar: o que vai e se há algo a comprar.
          itens: {
            select: {
              produtoId: true,
              quantidade: true,
              doEstoque: true,
              descricaoLivre: true,
              produto: {
                select: { nome: true, origem: true, controlaEstoque: true, estoque: true },
              },
            },
          },
        },
        orderBy: { dataSolicitacao: 'desc' },
        skip: (filtro.pagina - 1) * filtro.porPagina,
        take: filtro.porPagina,
      }),
      db.solicitacao.count({ where }),
      db.usuario.findMany({
        where: { ativo: true },
        select: { id: true, nome: true },
        orderBy: { nome: 'asc' },
      }),
      db.solicitacao.count({ where: { ...where, status: 'deu_problema' } }),
      // A fila inteira, e não o recorte: é o aviso de que há algo esperando.
      db.solicitacao.count({ where: { status: { in: [...STATUS_PARA_APROVAR] } } }),
      db.solicitacao.aggregate({
        where: { ...where, status: { notIn: [...STATUS_FORA_DO_SALDO] } },
        _sum: { valorTotal: true },
      }),
      // As pilhas inteiras, como o "Para aprovar": o atalho diz quanto espera ali.
      db.solicitacao.groupBy({ by: ['status'], _count: { _all: true } }),
    ])
  const contagemPorStatus = Object.fromEntries(porStatus.map((g) => [g.status, g._count._all]))
  const atalhoLigado = atalhoAtivo(filtro)

  // A exportação recebe exatamente os mesmos parâmetros da tela.
  const queryAtual = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) =>
      v === undefined ? [] : [v].flat().map((valor) => [k, String(valor)] as [string, string]),
    ),
  ).toString()

  const filtrando = Boolean(
    params.busca ||
    params.de ||
    params.ate ||
    params.consultorId ||
    params.clienteId ||
    params.status ||
    params.fila ||
    params.rota,
  )

  // O que o clique nos grupos da tabela ligou, com o "×" de cada um.
  const caminho = '/admin/solicitacoes'
  const clienteFiltrado = filtro.clienteId
    ? await db.cliente.findUnique({ where: { id: filtro.clienteId }, select: { nome: true } })
    : null
  const filtrosAtivos: FiltroAtivo[] = [
    filtro.fila === 'aprovar' && {
      coluna: 'Fila',
      valor: 'para aprovar',
      semEle: hrefSemFiltro(caminho, params, 'fila'),
    },
    filtro.status?.length === 1 && {
      coluna: 'Status',
      valor: ROTULO_STATUS[filtro.status[0]!],
      semEle: hrefSemFiltro(caminho, params, 'status'),
    },
    filtro.consultorId && {
      coluna: 'Consultor',
      valor: consultores.find((c) => c.id === filtro.consultorId)?.nome ?? 'escolhido',
      semEle: hrefSemFiltro(caminho, params, 'consultorId'),
    },
    filtro.clienteId && {
      coluna: 'Cliente',
      valor: clienteFiltrado?.nome ?? 'escolhido',
      semEle: hrefSemFiltro(caminho, params, 'clienteId'),
    },
    filtro.rota && {
      coluna: 'Rota',
      valor: filtro.rota,
      semEle: hrefSemFiltro(caminho, params, 'rota'),
    },
  ].filter((f): f is FiltroAtivo => Boolean(f))

  // `Prisma.Decimal` não atravessa a fronteira do servidor, e a rota só importa
  // enquanto a solicitação ainda não foi encaminhada.
  const linhas: LinhaDaGestao[] = solicitacoes.map((s) => ({
    id: s.id,
    codigo: s.codigo,
    teste: s.teste,
    data: formatarData(s.dataSolicitacao),
    consultor: s.consultor.nome,
    consultorId: s.consultor.id,
    cliente: s.cliente.nome,
    clienteId: s.cliente.id,
    presentes: s.itens.map((i) => ({
      nome: i.produto?.nome ?? i.descricaoLivre ?? 'item',
      quantidade: i.quantidade,
    })),
    valor: formatarBRL(s.valorTotal),
    status: s.status,
    precisaDeCompra:
      s.status === 'pendente' || s.status === 'aguardando_aprovacao'
        ? precisaDeCompra(s.itens)
        : null,
    rastreio: s.rastreio,
  }))

  return (
    <>
      <CabecalhoDaPagina
        titulo="Solicitações"
        descricao="Aprove o que chegou, acompanhe o fluxo inteiro e exporte o resultado filtrado. Para aprovar, abra a solicitação ou marque várias na lista."
        acoes={
          pode(usuario.perfil, 'exportar') ? (
            <>
              <Button variant="outline" asChild>
                <a href={`/api/export/csv?${queryAtual}`}>Exportar CSV</a>
              </Button>
              <Button variant="outline" asChild>
                <a href={`/api/export/xlsx?${queryAtual}`}>Exportar XLSX</a>
              </Button>
            </>
          ) : null
        }
      />

      <div
        className={cn(
          'mb-6 grid gap-4',
          aprova ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3',
        )}
      >
        {aprova ? <CartaoParaAprovar quantidade={paraAprovar} /> : null}
        <Stat rotulo="Solicitações no filtro" valor={total} />
        <Stat
          rotulo="Valor somado"
          valor={formatarBRL(soma._sum.valorTotal ?? totalDosItens([]))}
          apoio="Todos os status entram na conta, cancelados e devolvidos inclusive."
        />
        <Stat
          rotulo="Precisando de atenção"
          valor={comProblema}
          apoio={comProblema === 0 ? 'Nenhuma com problema.' : 'Com status “deu problema”.'}
        />
      </div>

      <nav
        aria-label="Pilhas para atuar"
        className="mb-4 flex flex-wrap gap-2"
        data-tour="atalhos-gestao"
      >
        {[null, ...ATALHOS_DA_GESTAO].map((atalho) => {
          const ligado = atalho
            ? atalhoLigado === atalho.chave
            : atalhoLigado === null && !filtro.status?.length
          const quantos = atalho ? contagemDoAtalho(contagemPorStatus, atalho) : null
          return (
            <LinkDeFiltro
              key={atalho?.chave ?? 'todas'}
              href={hrefDoAtalho(caminho, params, atalho) as Route}
              aria-current={ligado ? 'page' : undefined}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                ligado
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background hover:bg-accent',
              )}
            >
              {atalho?.rotulo ?? 'Todas'}
              {quantos !== null ? (
                <span
                  className={cn(
                    'tabular-nums',
                    ligado ? 'text-primary-foreground/80' : 'text-muted-foreground',
                    atalho?.chave === 'deu_problema' &&
                      quantos > 0 &&
                      !ligado &&
                      'text-destructive',
                  )}
                >
                  {quantos}
                </span>
              ) : null}
            </LinkDeFiltro>
          )
        })}
      </nav>

      <div data-tour="filtros-gestao">
        <BarraDeFiltros>
          <FormDeFiltro
            acao="/admin/solicitacoes"
            className="flex flex-1 flex-wrap items-center gap-2"
          >
            <Input
              name="busca"
              defaultValue={filtro.busca}
              placeholder="Código, cliente ou consultor"
              aria-label="Buscar solicitações"
              className="w-56"
            />
            <Input
              name="de"
              type="date"
              defaultValue={params.de as string}
              aria-label="Data inicial"
              className="w-40"
            />
            <Input
              name="ate"
              type="date"
              defaultValue={params.ate as string}
              aria-label="Data final"
              className="w-40"
            />
            <Select
              name="consultorId"
              defaultValue={filtro.consultorId ?? ''}
              aria-label="Filtrar por consultor"
              className="w-auto min-w-48"
            >
              <option value="">Todos os consultores</option>
              {consultores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
            <Select
              name="status"
              defaultValue={(params.status as string) ?? ''}
              aria-label="Filtrar por status"
              className="w-auto min-w-48"
            >
              <option value="">Todos os status</option>
              {Object.entries(ROTULO_STATUS).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </Select>
            <BotaoDeFiltro>Filtrar</BotaoDeFiltro>
            {filtrando ? (
              <Button variant="ghost" asChild>
                <LinkDeFiltro href="/admin/solicitacoes">Limpar</LinkDeFiltro>
              </Button>
            ) : null}
          </FormDeFiltro>
        </BarraDeFiltros>
      </div>

      {solicitacoes.length === 0 ? (
        <EstadoVazio
          titulo={
            filtro.fila === 'aprovar' ? 'Nada para aprovar' : 'Nenhuma solicitação encontrada'
          }
          descricao={
            filtro.fila === 'aprovar'
              ? 'Quando um consultor pedir um presente, ele aparece aqui esperando o seu OK.'
              : filtrando
                ? 'Nenhuma solicitação bate com os filtros aplicados. Ajuste o período ou limpe os filtros.'
                : 'Assim que os consultores começarem a solicitar presentes, eles aparecem aqui.'
          }
          acao={
            filtrando ? (
              <Button variant="outline" asChild>
                <LinkDeFiltro href="/admin/solicitacoes">Limpar filtros</LinkDeFiltro>
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <FiltrosAtivos filtros={filtrosAtivos} limpar={caminho} />
          <TabelaDaGestao
            linhas={linhas}
            podeEncaminhar={pode(usuario.perfil, 'solicitacao.alterarStatus')}
            filtroDaUrl={params}
          />
        </>
      )}
    </>
  )
}
