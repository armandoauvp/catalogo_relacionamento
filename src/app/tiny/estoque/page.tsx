import Link from 'next/link'
import type { Route } from 'next'
import { AlertTriangle } from 'lucide-react'
import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { tinyConfigurado } from '@/lib/env'
import { formatarBRL } from '@/lib/money'
import { pesquisarProdutosPorPagina } from '@/lib/tiny/api'
import { ErroDoTiny } from '@/lib/tiny/erros'
import type { PaginaDeProdutos } from '@/lib/tiny/leitura'
import { BotaoDeFiltro, FormDeFiltro, LinkDeFiltro } from '@/components/filtro-sem-piscar'
import { BarraDeFiltros, CabecalhoDaPagina, EstadoVazio } from '@/components/pagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/**
 * Estoque do Tiny: busca o produto pelo nome ou pelo SKU e abre o saldo de
 * cada um. O saldo não vem na busca do Tiny, só no detalhe, e buscá-lo linha a
 * linha estouraria o limite de chamadas por minuto.
 */

type Params = { busca?: string; pagina?: string }

export default async function EstoqueDoTinyPage({
  searchParams,
}: {
  searchParams: Promise<Params>
}) {
  await exigirPermissao('tiny.operar')
  const params = await searchParams
  const busca = (params.busca ?? '').trim()
  const pagina = Math.max(1, Number(params.pagina) || 1)

  let resultado: PaginaDeProdutos | null = null
  let erro: string | null = null
  if (tinyConfigurado && busca.length >= 2) {
    try {
      resultado = await pesquisarProdutosPorPagina(busca, pagina)
    } catch (e) {
      if (!(e instanceof ErroDoTiny)) throw e
      erro = e.message
    }
  }

  // Quem do catálogo daqui aponta para cada SKU, para comparar os dois estoques.
  const skus = resultado?.produtos.map((p) => p.codigo).filter(Boolean) ?? []
  const doCatalogo = skus.length
    ? await db.produto.findMany({
        where: { skuTiny: { in: skus } },
        select: { id: true, nome: true, skuTiny: true },
      })
    : []
  const porSku = new Map(doCatalogo.map((p) => [p.skuTiny, p]))

  const linkDaPagina = (n: number) =>
    `/tiny/estoque?busca=${encodeURIComponent(busca)}${n > 1 ? `&pagina=${n}` : ''}` as Route

  return (
    <>
      <CabecalhoDaPagina
        titulo="Estoque no Tiny"
        descricao="Saldo de cada produto no Tiny: geral, reservado e por depósito. Busque pelo nome ou pelo SKU."
      />

      <BarraDeFiltros>
        <FormDeFiltro acao="/tiny/estoque" className="flex flex-1 flex-wrap items-center gap-2">
          <Input
            name="busca"
            defaultValue={busca}
            placeholder="Nome ou SKU do produto"
            aria-label="Buscar produto no Tiny"
            className="w-72"
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
            {erro ?? (
              <>
                <span className="font-semibold">O Tiny ainda não está ligado.</span> Falta o token
                em <code>TINY_API_TOKEN</code>, na Vercel.
              </>
            )}
          </p>
        </div>
      ) : null}

      {!resultado && tinyConfigurado && !erro ? (
        <EstadoVazio
          titulo="Busque um produto"
          descricao="Digite ao menos duas letras do nome ou o SKU para ver o saldo no Tiny."
        />
      ) : null}

      {resultado && resultado.produtos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum produto encontrado"
          descricao="Confira o nome ou o SKU. A busca é a mesma da tela de produtos do Tiny."
        />
      ) : null}

      {resultado && resultado.produtos.length > 0 ? (
        <>
          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead>No catálogo daqui</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultado.produtos.map((p) => {
                  const local = p.codigo ? porSku.get(p.codigo) : undefined
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {p.codigo || '-'}
                      </TableCell>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatarBRL(p.preco)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {local ? local.nome : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/tiny/estoque/${p.id}` as Route}>Ver saldo</Link>
                        </Button>
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
