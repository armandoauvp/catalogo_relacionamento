import Link from 'next/link'
import type { Route } from 'next'
import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { pode } from '@/lib/permissions'
import { catalogoProvider } from '@/lib/providers'
import { versoDaFoto } from '@/lib/fotos'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProdutoImagem } from '@/components/produto-imagem'
import { CategoriaBadge } from '@/components/categoria-badge'
import { ValorDoProduto } from '@/components/valor-do-produto'
import { LinkDoProduto } from '@/components/link-do-produto'
import { FiltroCategorias } from '@/components/filtro-categorias'
import { BotaoDeFiltro, FormDeFiltro, LinkDeFiltro } from '@/components/filtro-sem-piscar'
import { CabecalhoDaPagina, EstadoVazio } from '@/components/pagina'

/**
 * Catálogo do consultor.
 *
 * Lê pelo `catalogoProvider`, nunca pelo Prisma diretamente: quando o Tiny
 * entrar na fase 2, esta tela não muda. A contagem por categoria é a exceção,
 * é agregação de tela, não leitura de catálogo.
 */
export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; categoria?: string; origem?: string }>
}) {
  const usuario = await exigirPermissao('catalogo.ver')
  const { busca, categoria, origem: origemNaUrl } = await searchParams
  // "Só o que temos em estoque": o atalho do Dashboard Logístico chega aqui.
  const soEstoque = origemNaUrl === 'estoque_interno'
  const origem = soEstoque ? ('estoque_interno' as const) : undefined

  const [pagina, categorias, contagem] = await Promise.all([
    // O catálogo tem dezenas de itens e cresce devagar: cabe numa página, e
    // uma paginação de duas páginas atrapalha mais do que ajuda a escolher.
    // O provider limita em 100, se um dia passar disso, entra paginação.
    catalogoProvider.listar({
      busca,
      categoriaId: categoria,
      origem,
      apenasAtivos: true,
      porPagina: 100,
    }),
    db.categoria.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } }),
    db.produto.groupBy({
      by: ['categoriaId'],
      where: { ativo: true, ...(origem ? { origem } : {}) },
      _count: { _all: true },
    }),
  ])

  const porCategoria = new Map(contagem.map((c) => [c.categoriaId, c._count._all]))
  const totalAtivos = contagem.reduce((acc, c) => acc + c._count._all, 0)

  const opcoes = categorias
    .map((c) => ({ id: c.id, nome: c.nome, total: porCategoria.get(c.id) ?? 0 }))
    .filter((c) => c.total > 0)

  // Preserva a busca ao trocar de categoria: o filtro é composto, não exclusivo.
  const hrefCom = (mudancas: { categoria?: string | null; soEstoque?: boolean }): Route => {
    const params = new URLSearchParams()
    if (busca) params.set('busca', busca)
    const cat = mudancas.categoria === undefined ? categoria : mudancas.categoria
    if (cat) params.set('categoria', cat)
    if (mudancas.soEstoque ?? soEstoque) params.set('origem', 'estoque_interno')
    const query = params.toString()
    return (query ? `/catalogo?${query}` : '/catalogo') as Route
  }
  const hrefDaCategoria = (categoriaId?: string): Route =>
    hrefCom({ categoria: categoriaId ?? null })

  const filtrando = Boolean(busca || categoria || soEstoque)

  return (
    <>
      <CabecalhoDaPagina
        titulo="Catálogo"
        descricao="Escolha o presente e siga para a solicitação. Produtos desativados não aparecem aqui."
        acoes={
          pode(usuario.perfil, 'solicitacao.criar') ? (
            <Button asChild>
              <Link href="/solicitacoes/nova">Nova solicitação</Link>
            </Button>
          ) : null
        }
      />

      {/* Buscar mantém a grade na tela: sem o `onSubmit` do FormDeFiltro, o
          `method="get"` recarregaria o documento inteiro. */}
      <FormDeFiltro
        acao="/catalogo"
        className="bg-card mb-4 flex flex-wrap items-center gap-2 rounded-lg border p-3"
      >
        {/* A categoria viaja escondida para que buscar não descarte o filtro. */}
        {categoria ? <input type="hidden" name="categoria" value={categoria} /> : null}
        {soEstoque ? <input type="hidden" name="origem" value="estoque_interno" /> : null}
        <Input
          name="busca"
          defaultValue={busca}
          placeholder="Buscar por nome ou descrição"
          aria-label="Buscar no catálogo"
          className="w-full max-w-xs flex-1"
        />
        <BotaoDeFiltro>Buscar</BotaoDeFiltro>
        <Button variant={soEstoque ? 'secondary' : 'outline'} asChild>
          <LinkDeFiltro
            href={hrefCom({ soEstoque: !soEstoque })}
            aria-pressed={soEstoque}
            title="Os presentes que a AUVP tem fisicamente, sem compra"
          >
            Só em estoque
          </LinkDeFiltro>
        </Button>
        {filtrando ? (
          <Button variant="ghost" asChild>
            <LinkDeFiltro href="/catalogo">Limpar</LinkDeFiltro>
          </Button>
        ) : null}
        <p className="text-muted-foreground ml-auto pr-1 text-sm">
          {pagina.total} {pagina.total === 1 ? 'presente' : 'presentes'}
        </p>
      </FormDeFiltro>

      <FiltroCategorias
        opcoes={opcoes}
        selecionada={categoria}
        total={totalAtivos}
        href={hrefDaCategoria}
      />

      {pagina.itens.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum presente encontrado"
          descricao={
            filtrando
              ? 'Nenhum produto ativo bate com esses filtros. Tente outra busca ou volte para “Todos”.'
              : 'O catálogo ainda não tem produtos ativos. O Admin cadastra em Catálogo (admin).'
          }
          acao={
            filtrando ? (
              <Button variant="outline" asChild>
                <LinkDeFiltro href="/catalogo">Limpar filtros</LinkDeFiltro>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pagina.itens.map((produto, indice) => {
            const semEstoque = produto.controlaEstoque && !produto.estoque

            return (
              <article
                key={produto.id}
                className="group bg-card ease-apple sm:hover:border-primary/30 flex flex-col overflow-hidden rounded-2xl border transition-[transform,box-shadow,border-color] duration-300 sm:hover:-translate-y-1 sm:hover:shadow-xl"
              >
                <ProdutoImagem
                  fotoUrl={produto.fotoUrl}
                  fotoVersoUrl={versoDaFoto(produto.fotoUrl)}
                  nome={produto.nome}
                  categoria={produto.categoriaNome}
                  // A primeira fileira carrega sem lazy: são as fotos que a
                  // pessoa vê antes de rolar.
                  prioridade={indice < 4}
                />

                <div className="flex flex-1 flex-col items-start gap-1.5 p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <CategoriaBadge categoria={produto.categoriaNome} />
                    {/* Kit que embala bebida não sai sozinho, e quem olha o
                        catálogo precisa saber disso antes de pedir. */}
                    {produto.exigeAcompanhamento ? (
                      <Badge variant="outline">vai com {produto.exigeAcompanhamento}</Badge>
                    ) : null}
                  </div>
                  <h2 className="font-display leading-snug font-semibold text-balance">
                    {produto.nome}
                  </h2>
                  {produto.descricao ? (
                    <p className="text-muted-foreground font-roboto line-clamp-2 text-xs leading-relaxed">
                      {produto.descricao}
                    </p>
                  ) : null}

                  {/* A loja onde o presente é comprado. A foto mostra o
                      presente; o link mostra medida, sabor e o resto. */}
                  <LinkDoProduto url={produto.urlCompra} />

                  <div className="mt-auto flex w-full items-end justify-between gap-3 pt-3">
                    <ValorDoProduto
                      valor={produto.valor}
                      tipoValor={produto.tipoValor}
                      className="leading-tight"
                      classeDoValor="text-lg font-semibold"
                    />

                    {/*
                      O que o consultor quer saber aqui é quanto tempo demora,
                      e não quantas peças existem: "pronta entrega" sai assim
                      que o Admin aprovar; "sob encomenda" espera a compra.
                      A contagem, quando a área a mantém, entra junto.
                    */}
                    {produto.controlaEstoque && semEstoque ? (
                      <Badge variant="muted">sem estoque</Badge>
                    ) : produto.origem === 'estoque_interno' ? (
                      <Badge variant="outline">
                        pronta entrega
                        {produto.controlaEstoque ? ` · ${produto.estoque} un.` : ''}
                      </Badge>
                    ) : (
                      <Badge variant="muted">sob encomenda</Badge>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
