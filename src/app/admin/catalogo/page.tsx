import Link from 'next/link'
import type { Route } from 'next'
import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { FileSpreadsheet } from 'lucide-react'
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
import { Stat } from '@/components/stat'
import { LinkDeFiltro } from '@/components/filtro-sem-piscar'
import { FiltroDoGrupo, FiltrosAtivos, type FiltroAtivo } from '@/components/filtro-por-grupo'
import { hrefDoGrupo, hrefSemFiltro, valorDoFiltro } from '@/lib/filtro-por-grupo'
import {
  filtroDeProdutosSchema,
  produtosDoFiltro,
  ROTULO_DA_ORIGEM,
  temSku,
} from '@/lib/filtro-de-produtos'
import { ValorDoProduto } from '@/components/valor-do-produto'
import { CabecalhoDaPagina, EstadoVazio } from '@/components/pagina'
import { EditorDeProduto, BotaoAtivar } from './editor-de-produto'
import { EditorDeCategorias } from './editor-de-categorias'

/**
 * CRUD do catálogo: operado pela própria área de Relacionamento.
 *
 * Requisito de primeira ordem da spec: cadastrar, editar, ativar e desativar
 * produto sem passar pelo time técnico.
 */
export default async function AdminCatalogoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await exigirPermissao('catalogo.gerenciar')
  const params = await searchParams
  const filtro = filtroDeProdutosSchema.parse(params)
  const caminho = '/admin/catalogo'
  const grupo = (chave: string, valor: string) => ({
    href: hrefDoGrupo(caminho, params, chave, valor),
    ativo: valorDoFiltro(params, chave) === valor,
  })

  const [produtos, categorias] = await Promise.all([
    db.produto.findMany({
      include: { categoria: { select: { nome: true } }, _count: { select: { itens: true } } },
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    }),
    db.categoria.findMany({ orderBy: { nome: 'asc' } }),
  ])

  const ativos = produtos.filter((p) => p.ativo).length
  const semSku = produtos.filter((p) => p.ativo && !temSku(p)).length
  const listados = produtosDoFiltro(produtos, filtro)

  const filtrosAtivos: FiltroAtivo[] = [
    filtro.categoria && {
      coluna: 'Categoria',
      valor: categorias.find((c) => c.id === filtro.categoria)?.nome ?? 'escolhida',
      semEle: hrefSemFiltro(caminho, params, 'categoria'),
    },
    filtro.origem && {
      coluna: 'De onde sai',
      valor: ROTULO_DA_ORIGEM[filtro.origem],
      semEle: hrefSemFiltro(caminho, params, 'origem'),
    },
    filtro.situacao && {
      coluna: 'Situação',
      valor: filtro.situacao === 'ativo' ? 'no catálogo' : 'fora do catálogo',
      semEle: hrefSemFiltro(caminho, params, 'situacao'),
    },
    filtro.sku && {
      coluna: 'SKU',
      valor: 'sem SKU no Tiny',
      semEle: hrefSemFiltro(caminho, params, 'sku'),
    },
  ].filter((f): f is FiltroAtivo => Boolean(f))

  // Rótulos de acompanhamento que já existem, para o cadastro sugerir em vez
  // de deixar a área digitar "vinhos" e a trava deixar de parear.
  const rotulos = [
    ...new Set(
      produtos
        .flatMap((p) => [p.exigeAcompanhamento, p.serveComoAcompanhamento])
        .filter((r): r is string => Boolean(r)),
    ),
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'))

  // `Prisma.Decimal` não atravessa a fronteira do servidor: o valor vai como
  // texto no formato que o formulário edita.
  const opcoesDeCategoria = categorias.map((c) => ({ id: c.id, nome: c.nome, ativo: c.ativo }))

  return (
    <>
      <CabecalhoDaPagina
        titulo="Gerenciar catálogo"
        descricao="Cadastro, edição e ativação de produtos, feitos pela própria área, sem depender do time técnico."
        acoes={
          <>
            <EditorDeCategorias categorias={opcoesDeCategoria} />
            <Button variant="outline" asChild>
              <Link href={'/admin/catalogo/skus' as Route}>
                <FileSpreadsheet aria-hidden="true" />
                SKUs por planilha
              </Link>
            </Button>
            <EditorDeProduto categorias={opcoesDeCategoria} rotulos={rotulos} />
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat rotulo="Produtos ativos" valor={ativos} apoio="Visíveis para o consultor." />
        <Stat
          rotulo="Fora do catálogo"
          valor={produtos.length - ativos}
          apoio="Removidos: somem para o consultor, ficam no histórico."
        />
        <Stat
          rotulo="Sem SKU no Tiny"
          valor={semSku}
          apoio={
            semSku ? (
              <LinkDeFiltro
                href={grupo('sku', 'falta').href as Route}
                className="text-primary-emphasis underline-offset-4 hover:underline"
              >
                {filtro.sku ? 'Mostrar todos' : 'Mostrar só estes'}
              </LinkDeFiltro>
            ) : (
              'Todos os ativos têm SKU.'
            )
          }
        />
        <Stat rotulo="Categorias" valor={categorias.length} />
      </div>

      {produtos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum produto cadastrado"
          descricao="Cadastre o primeiro produto no botão acima, ou rode npm run db:seed para carregar exemplos."
          acao={<EditorDeProduto categorias={opcoesDeCategoria} rotulos={rotulos} />}
        />
      ) : (
        <>
          <FiltrosAtivos filtros={filtrosAtivos} limpar={caminho} />
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>De onde sai</TableHead>
                  <TableHead className="text-right">Usos</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listados.map((p) => (
                  <TableRow key={p.id} className={p.ativo ? undefined : 'text-muted-foreground'}>
                    <TableCell>
                      {/* Nome e SKU empilhados: a etiqueta inline colava no nome. */}
                      <div className="flex flex-col items-start gap-1.5">
                        <span className="font-medium">{p.nome}</span>
                        {temSku(p) ? (
                          <Link
                            href={`/tiny/estoque?busca=${encodeURIComponent(p.skuTiny!)}` as Route}
                            className="text-muted-foreground hover:text-foreground text-xs tabular-nums underline-offset-4 hover:underline"
                            title="Ver o saldo no Tiny"
                          >
                            SKU {p.skuTiny} · saldo no Tiny
                          </Link>
                        ) : p.ativo ? (
                          <FiltroDoGrupo {...grupo('sku', 'falta')} rotulo="produtos sem SKU">
                            <Badge variant="warning">sem SKU no Tiny</Badge>
                          </FiltroDoGrupo>
                        ) : (
                          <Badge variant="warning">sem SKU no Tiny</Badge>
                        )}
                        {temSku(p) && p.nomeNoTiny ? (
                          <span className="text-muted-foreground text-xs">
                            No Olist: {p.nomeNoTiny}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <FiltroDoGrupo
                        {...grupo('categoria', p.categoriaId)}
                        rotulo={`categoria ${p.categoria.nome}`}
                        texto
                      >
                        {p.categoria.nome}
                      </FiltroDoGrupo>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      <ValorDoProduto valor={p.valor} tipoValor={p.tipoValor} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <FiltroDoGrupo
                        {...grupo('origem', p.origem)}
                        rotulo={`origem ${ROTULO_DA_ORIGEM[p.origem]}`}
                      >
                        <Badge variant={p.origem === 'estoque_interno' ? 'muted' : 'outline'}>
                          {ROTULO_DA_ORIGEM[p.origem]}
                        </Badge>
                      </FiltroDoGrupo>
                      {p.controlaEstoque ? (
                        <span className="text-muted-foreground ml-2 text-xs tabular-nums">
                          {p.estoque ?? 0} un.
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p._count.itens}</TableCell>
                    <TableCell>
                      <FiltroDoGrupo
                        {...grupo('situacao', p.ativo ? 'ativo' : 'desativado')}
                        rotulo={p.ativo ? 'produtos no catálogo' : 'produtos fora do catálogo'}
                      >
                        <Badge
                          variant={p.ativo ? 'outline' : 'muted'}
                          className="whitespace-nowrap"
                        >
                          {p.ativo ? 'no catálogo' : 'fora do catálogo'}
                        </Badge>
                      </FiltroDoGrupo>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <EditorDeProduto
                        categorias={opcoesDeCategoria}
                        rotulos={rotulos}
                        produto={{
                          id: p.id,
                          nome: p.nome,
                          descricao: p.descricao,
                          categoriaId: p.categoriaId,
                          fotoUrl: p.fotoUrl,
                          valor: p.valor ? p.valor.toFixed(2).replace('.', ',') : '',
                          tipoValor: p.tipoValor,
                          origem: p.origem,
                          controlaEstoque: p.controlaEstoque,
                          estoque: p.estoque,
                          urlCompra: p.urlCompra,
                          notaDeCompra: p.notaDeCompra,
                          exigeAcompanhamento: p.exigeAcompanhamento,
                          serveComoAcompanhamento: p.serveComoAcompanhamento,
                          ativo: p.ativo,
                          skuTiny: p.skuTiny,
                        }}
                      />
                      <BotaoAtivar id={p.id} ativo={p.ativo} nome={p.nome} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </>
  )
}
