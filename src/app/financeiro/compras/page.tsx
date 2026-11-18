import Link from 'next/link'
import { exigirPermissao } from '@/lib/auth-guards'
import { pode } from '@/lib/permissions'
import type { Route } from 'next'
import {
  agruparPorFornecedor,
  falta,
  filaDeCompras,
  totalDaFila,
  STATUS_DA_FILA_DE_COMPRAS,
} from '@/lib/compras'
import { Button } from '@/components/ui/button'
import { LinkDeFiltro } from '@/components/filtro-sem-piscar'
import { PorFornecedor, type GrupoNaTela } from './por-fornecedor'
import { siteDeCompra } from '@/lib/fornecedores'
import { formatarBRL } from '@/lib/money'
import { formatarData } from '@/lib/datas'
import { ROTULO_STATUS, ehPassoDeCompra, proximoPasso } from '@/lib/status'
import { Badge } from '@/components/ui/badge'
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
import { Stat } from '@/components/stat'
import { CabecalhoDaPagina, EstadoVazio } from '@/components/pagina'
import { FiltroDoGrupo, FiltrosAtivos, type FiltroAtivo } from '@/components/filtro-por-grupo'
import { hrefDoGrupo, hrefSemFiltro, valorDoFiltro } from '@/lib/filtro-por-grupo'
import { CancelarNaFila, PassoDaFila } from './passo-da-fila'

/**
 * Fila de compras: tela do perfil Financeiro.
 *
 * A área definiu o conteúdo: as solicitações enviadas para compra, com data,
 * produto, valor e site. É uma lista por item, e não por solicitação, porque a
 * compra acontece item a item: um pedido com três presentes pode ter três
 * origens diferentes.
 */
/**
 * Na fila, o Financeiro só marca como comprado. Comprado não é chegado: quem
 * dá o item como recebido, e manda para o Tiny, é a Logística, na Expedição.
 */
function passoDoFinanceiro(status: Parameters<typeof proximoPasso>[0], operaCompra: boolean) {
  const passo = proximoPasso(status, [])
  return operaCompra && passo && ehPassoDeCompra(status, passo.destino) ? passo : null
}

export default async function FilaDeComprasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const usuario = await exigirPermissao('compras.verFila')
  const operaCompra = pode(usuario.perfil, 'compras.operar')
  // Cancelar é mudança de status como qualquer outra: quem pode mudar, cancela.
  const cancela = pode(usuario.perfil, 'solicitacao.alterarStatus')
  const params = await searchParams
  const caminho = '/financeiro/compras'
  const status = STATUS_DA_FILA_DE_COMPRAS.find((s) => s === params.status)

  // Por fornecedor é a visão de trabalho do Financeiro: comprar de uma loja de
  // uma vez e juntar o frete. Por item é a lista completa, com o que já foi.
  const porItem = params.visao === 'item'

  const itens = await filaDeCompras()
  const total = totalDaFila(itens)
  const pendentes = itens.filter(falta)
  const grupos: GrupoNaTela[] = agruparPorFornecedor(itens).map((g) => ({
    chave: g.fornecedor.chave.replace(/[^a-z0-9-]/gi, '-'),
    nome: g.fornecedor.nome,
    site: g.fornecedor.site,
    solicitacoes: g.solicitacoes,
    valor: formatarBRL(g.valor),
    itens: g.itens.map((i) => ({
      itemId: i.itemId,
      solicitacaoId: i.solicitacaoId,
      codigo: i.codigo,
      data: formatarData(i.data),
      produto: i.produto,
      quantidade: i.quantidade,
      valor: formatarBRL(i.valor),
      link: siteDeCompra(i.site, i.categoria)?.url ?? null,
      consultor: i.consultorNome,
      cliente: i.clienteNome,
      emOutrasLojas: pendentes.filter(
        (o) => o.solicitacaoId === i.solicitacaoId && o.fornecedor.chave !== i.fornecedor.chave,
      ).length,
    })),
  }))
  const aguardando = itens.filter((i) => i.status === 'aguardando_compra')
  // Os números de cima são da fila inteira; o clique no status recorta a lista.
  const listados = status ? itens.filter((i) => i.status === status) : itens
  // A fila é por item, mas o status é da solicitação inteira: o botão precisa
  // avisar quando marca mais de uma linha.
  const itensPorPedido = new Map<string, number>()
  for (const i of itens) {
    itensPorPedido.set(i.solicitacaoId, (itensPorPedido.get(i.solicitacaoId) ?? 0) + 1)
  }
  const grupo = (chave: string, valor: string) => ({
    href: hrefDoGrupo(caminho, params, chave, valor),
    ativo: valorDoFiltro(params, chave) === valor,
  })
  const filtrosAtivos: FiltroAtivo[] = status
    ? [
        {
          coluna: 'Status',
          valor: ROTULO_STATUS[status],
          semEle: hrefSemFiltro(caminho, params, 'status'),
        },
      ]
    : []

  return (
    <>
      <CabecalhoDaPagina
        titulo="Fila de compras"
        descricao="Itens das solicitações enviadas para compra, em ordem de chegada."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          destaque
          rotulo="Valor total da fila"
          valor={formatarBRL(total)}
          apoio={`${itens.length} ${itens.length === 1 ? 'item' : 'itens'} no total.`}
        />
        <Stat
          rotulo="Falta comprar"
          valor={pendentes.length}
          apoio={`${pendentes.length === 1 ? 'Item' : 'Itens'} em ${grupos.length} ${grupos.length === 1 ? 'fornecedor' : 'fornecedores'}.`}
        />
        <Stat
          rotulo="Solicitações na compra"
          valor={aguardando.length === 0 ? 0 : new Set(aguardando.map((i) => i.solicitacaoId)).size}
          apoio="Vão a Comprado quando o último item delas é comprado."
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {/* Troca de visão é filtro da mesma tela: sem recarregar a aplicação. */}
        <Button variant={porItem ? 'outline' : 'secondary'} asChild>
          <LinkDeFiltro href={hrefSemFiltro(caminho, params, 'visao') as Route}>
            Por fornecedor
          </LinkDeFiltro>
        </Button>
        <Button variant={porItem ? 'secondary' : 'outline'} asChild>
          <LinkDeFiltro
            href={hrefDoGrupo(caminho, { ...params, visao: undefined }, 'visao', 'item') as Route}
          >
            Por item
          </LinkDeFiltro>
        </Button>
      </div>

      {itens.length === 0 ? (
        <EstadoVazio
          titulo="Nada para comprar agora"
          descricao="As solicitações aparecem aqui assim que o Relacionamento as aprova."
        />
      ) : !porItem ? (
        <PorFornecedor grupos={grupos} opera={operaCompra} />
      ) : (
        <>
          <FiltrosAtivos filtros={filtrosAtivos} />
          <Card className="overflow-hidden" data-tour="lista-compras">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Próximo passo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listados.map((item) => (
                  <TableRow key={item.itemId}>
                    <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
                      {formatarData(item.data)}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap tabular-nums">
                      <Link
                        href={`/admin/solicitacoes/${item.solicitacaoId}`}
                        className="hover:text-primary-emphasis underline-offset-4 hover:underline"
                      >
                        {item.codigo}
                      </Link>
                    </TableCell>
                    <TableCell className="min-w-44">
                      <div className="font-medium">{item.produto}</div>
                      <div className="text-muted-foreground mt-0.5 text-xs">
                        {item.consultorNome} · para {item.clienteNome}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-44">
                      <SiteDeCompra
                        site={item.site}
                        nota={item.notaDeCompra}
                        categoria={item.categoria}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.quantidade}</TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                      {formatarBRL(item.valor)}
                    </TableCell>
                    <TableCell>
                      <FiltroDoGrupo
                        {...grupo('status', item.status)}
                        rotulo={`status ${ROTULO_STATUS[item.status]}`}
                      >
                        <StatusBadge status={item.status} />
                      </FiltroDoGrupo>
                      {item.compradoEm && item.status === 'aguardando_compra' ? (
                        <p className="text-muted-foreground mt-1 text-xs">
                          Item comprado em {formatarData(item.compradoEm)}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        <PassoDaFila
                          solicitacaoId={item.solicitacaoId}
                          codigo={item.codigo}
                          itensDoPedido={itensPorPedido.get(item.solicitacaoId) ?? 1}
                          passo={passoDoFinanceiro(item.status, operaCompra)}
                        />
                        {item.status === 'comprado' ? (
                          <span className="text-muted-foreground w-28 text-right text-xs leading-snug">
                            Aguarda chegar à Logística
                          </span>
                        ) : null}
                        {cancela ? (
                          <CancelarNaFila
                            solicitacaoId={item.solicitacaoId}
                            codigo={item.codigo}
                            itensDoPedido={itensPorPedido.get(item.solicitacaoId) ?? 1}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      <p className="text-muted-foreground mt-4 text-xs">
        A fila mostra as solicitações em{' '}
        {STATUS_DA_FILA_DE_COMPRAS.map((s) => ROTULO_STATUS[s].toLowerCase()).join(' e ')}. Cancelar
        não apaga: o pedido fica no histórico com o motivo. Para registrar um problema, abra a
        solicitação pelo código.
      </p>
    </>
  )
}

/**
 * Onde comprar o item.
 *
 * Três fontes, nesta ordem: o link do item (do presente específico ou do
 * cadastro do produto), o fornecedor padrão da categoria e, por fim, a nota de
 * compra: "Pedido direto ao fornecedor", que não é link mas é instrução.
 *
 * Sobrando tudo, mostra-se a categoria: informa mais que um traço.
 */
function SiteDeCompra({
  site,
  nota,
  categoria,
}: {
  site: string | null
  nota: string | null
  categoria: string | null
}) {
  const destino = siteDeCompra(site, categoria)

  if (!destino) {
    return nota ? (
      <span className="text-sm">{nota}</span>
    ) : (
      <Badge variant="outline">{categoria ?? 'catálogo'}</Badge>
    )
  }

  return (
    <>
      <a
        href={destino.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary-emphasis block truncate text-sm underline-offset-4 hover:underline"
      >
        {destino.url.replace(/^https?:\/\//, '')}
      </a>
      {/* A nota convive com o link: há kit em que parte vem de cada lugar. */}
      {nota ? <span className="text-muted-foreground block text-xs">{nota}</span> : null}
      {destino.origem === 'categoria' ? (
        <span className="text-muted-foreground text-xs">fornecedor padrão de {categoria}</span>
      ) : null}
    </>
  )
}
