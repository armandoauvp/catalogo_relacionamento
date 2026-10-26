import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { pode } from '@/lib/permissions'
import { formatarBRL, totalDosItens } from '@/lib/money'
import { formatarData } from '@/lib/datas'
import { filtroSolicitacoesSchema } from '@/lib/validators/filtros'
import { whereDaGestao } from '@/lib/solicitacoes-filtradas'
import { hrefSemFiltro } from '@/lib/filtro-por-grupo'
import { FiltrosAtivos, type FiltroAtivo } from '@/components/filtro-por-grupo'
import { ROTULO_STATUS, STATUS_FORA_DO_SALDO, precisaDeCompra } from '@/lib/status'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Stat } from '@/components/stat'
import { BotaoDeFiltro, FormDeFiltro, LinkDeFiltro } from '@/components/filtro-sem-piscar'
import { BarraDeFiltros, CabecalhoDaPagina, EstadoVazio } from '@/components/pagina'
import { TabelaDaGestao, type LinhaDaGestao } from './tabela'

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

  const [solicitacoes, total, consultores, comProblema, soma] = await Promise.all([
    db.solicitacao.findMany({
      where,
      include: {
        cliente: { select: { id: true, nome: true } },
        consultor: { select: { id: true, nome: true } },
        _count: { select: { itens: true } },
        // Só para a coluna "rota": ela é o que evita abrir vinte telas para
        // saber quais pedidos têm algo a comprar.
        itens: {
          select: {
            produtoId: true,
            quantidade: true,
            produto: { select: { origem: true, controlaEstoque: true, estoque: true } },
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
    db.solicitacao.aggregate({
      where: { ...where, status: { notIn: [...STATUS_FORA_DO_SALDO] } },
      _sum: { valorTotal: true },
    }),
  ])

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
    params.rota,
  )

  // O que o clique nos grupos da tabela ligou, com o "×" de cada um.
  const caminho = '/admin/solicitacoes'
  const clienteFiltrado = filtro.clienteId
    ? await db.cliente.findUnique({ where: { id: filtro.clienteId }, select: { nome: true } })
    : null
  const filtrosAtivos: FiltroAtivo[] = [
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
    data: formatarData(s.dataSolicitacao),
    consultor: s.consultor.nome,
    consultorId: s.consultor.id,
    cliente: s.cliente.nome,
    clienteId: s.cliente.id,
    itens: s._count.itens,
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
        descricao="Acompanhe o fluxo inteiro, corrija dados e exporte o resultado filtrado."
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

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
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

      {solicitacoes.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma solicitação encontrada"
          descricao={
            filtrando
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
