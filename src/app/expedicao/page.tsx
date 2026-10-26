import { exigirPermissao } from '@/lib/auth-guards'
import { pode } from '@/lib/permissions'
import { filaDeExpedicao, pecasASeparar, STATUS_DA_EXPEDICAO } from '@/lib/expedicao'
import { formatarBRL } from '@/lib/money'
import { formatarData } from '@/lib/datas'
import { ROTULO_STATUS } from '@/lib/status'
import type { Route } from 'next'
import { LinkDeFiltro } from '@/components/filtro-sem-piscar'
import { FiltroDoGrupo, FiltrosAtivos, type FiltroAtivo } from '@/components/filtro-por-grupo'
import { hrefDoGrupo, hrefSemFiltro, valorDoFiltro } from '@/lib/filtro-por-grupo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/status-badge'
import { Stat } from '@/components/stat'
import { CabecalhoDaPagina, EstadoVazio } from '@/components/pagina'
import type { EnvioTiny } from '@prisma/client'
import { db } from '@/lib/db'
import { passoPermitido, situacaoVigente } from '@/lib/tiny/ciclo'
import { BotaoConcluir, BotaoFecharExpedicao } from '@/app/tiny/acoes-da-fila'
import { SeloDoPedido } from '@/app/tiny/selo-do-pedido'
import { Rastreio } from './rastreio'

/**
 * Fila de expedição: a planilha que a área monta à mão hoje.
 *
 * Duas portas levam uma solicitação até aqui: o caminho normal, depois que o
 * Financeiro compra; e o atalho, quando os itens já estão em estoque e não há o
 * que comprar. Por isso a coluna "origem" existe em cada item: quem separa
 * precisa saber o que vem da prateleira e o que chegou de uma compra.
 *
 * O endereço aparece inteiro, e não atrás de um clique: a tela é usada com o
 * pacote na mão, e um dado de envio escondido é um dado redigitado errado.
 */
type PedidoNoTiny = {
  id: string
  envio: EnvioTiny
  situacao: string | null
  situacaoPendente: string | null
  tinyNumero: string | null
  erro: string | null
}

/** A situação do presente no Tiny e o "Concluir" da expedição, no topo do cartão. */
function NoTiny({ tiny, operaTiny }: { tiny: PedidoNoTiny | undefined; operaTiny: boolean }) {
  if (!tiny) return null
  const podeConcluir =
    operaTiny && tiny.envio !== 'falhou' && passoPermitido(situacaoVigente(tiny), 'concluir')
  return (
    <>
      <span className="flex flex-wrap items-center justify-end gap-2 text-xs">
        <span className="text-muted-foreground">Tiny</span>
        <SeloDoPedido pedido={tiny} />
      </span>
      {tiny.erro ? (
        <p className="text-destructive max-w-72 text-right text-xs">{tiny.erro}</p>
      ) : null}
      {podeConcluir ? <BotaoConcluir pedidoTinyId={tiny.id} /> : null}
    </>
  )
}

export default async function ExpedicaoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const usuario = await exigirPermissao('expedicao.verFila')
  const podeRegistrarRastreio = pode(usuario.perfil, 'expedicao.registrarRastreio')
  const operaTiny = pode(usuario.perfil, 'tiny.operar')
  const params = await searchParams
  const incluirEnviadas = params.enviadas === '1'
  const caminho = '/expedicao'

  // O clique no status, no consultor ou na origem do item recorta os cartões;
  // os números de cima e o "Fechar expedição" continuam valendo para a fila toda.
  const status = STATUS_DA_EXPEDICAO.find((s) => s === params.status)
  const consultor = params.consultor || undefined
  const item = (['estoque', 'compra'] as const).find((i) => i === params.item)
  const grupo = (chave: string, valor: string) => ({
    href: hrefDoGrupo(caminho, params, chave, valor),
    ativo: valorDoFiltro(params, chave) === valor,
  })

  const pedidos = await filaDeExpedicao({ incluirEnviadas })
  const aSeparar = pedidos.filter((p) => p.status !== 'entregue')
  const pecas = pecasASeparar(aSeparar)
  const doEstoque = aSeparar.reduce(
    (acc, p) => acc + p.itens.filter((i) => i.jaEmEstoque).reduce((s, i) => s + i.quantidade, 0),
    0,
  )

  // O pedido de cada presente no Tiny: a situação de lá e os passos da
  // expedição (pauta de 22/10/2026): fechar a lista e concluir o pacote.
  const noTiny = new Map(
    (
      await db.pedidoTiny.findMany({
        where: { solicitacaoId: { in: pedidos.map((p) => p.id) } },
        select: {
          id: true,
          solicitacaoId: true,
          envio: true,
          situacao: true,
          situacaoPendente: true,
          tinyNumero: true,
          erro: true,
        },
      })
    ).map((t) => [t.solicitacaoId!, t]),
  )
  const fechaveis = aSeparar
    .filter((p) => {
      const t = noTiny.get(p.id)
      return t && t.envio !== 'falhou' && passoPermitido(situacaoVigente(t), 'fechar')
    })
    .map((p) => p.id)

  const query = incluirEnviadas ? '?enviadas=1' : ''

  const listados = pedidos.filter(
    (p) =>
      (!status || p.status === status) &&
      (!consultor || p.consultor === consultor) &&
      (!item || p.itens.some((i) => i.jaEmEstoque === (item === 'estoque'))),
  )
  const filtrosAtivos: FiltroAtivo[] = [
    status && {
      coluna: 'Status',
      valor: ROTULO_STATUS[status],
      semEle: hrefSemFiltro(caminho, params, 'status'),
    },
    consultor && {
      coluna: 'Consultor',
      valor: consultor,
      semEle: hrefSemFiltro(caminho, params, 'consultor'),
    },
    item && {
      coluna: 'Tem item de',
      valor: item,
      semEle: hrefSemFiltro(caminho, params, 'item'),
    },
  ].filter((f): f is FiltroAtivo => Boolean(f))

  return (
    <>
      <CabecalhoDaPagina
        titulo="Pedidos para separar"
        descricao="Tudo o que a expedição precisa para embalar e postar, em ordem de chegada. A carta continua sendo escrita fora daqui."
        acoes={
          <>
            {operaTiny ? <BotaoFecharExpedicao solicitacaoIds={fechaveis} /> : null}
            <Button variant="outline" asChild>
              <a href={`/api/expedicao/export${query ? `${query}&` : '?'}formato=csv`} download>
                Baixar CSV
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`/api/expedicao/export${query ? `${query}&` : '?'}formato=xlsx`} download>
                Baixar planilha
              </a>
            </Button>
          </>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          destaque
          rotulo="Peças a separar"
          valor={pecas}
          apoio={`Em ${aSeparar.length} ${aSeparar.length === 1 ? 'pedido' : 'pedidos'}.`}
        />
        <Stat rotulo="Direto do estoque" valor={doEstoque} apoio="Não passaram pelo Financeiro." />
        <Stat
          rotulo="Compradas"
          valor={pecas - doEstoque}
          apoio="Chegaram por uma compra do Financeiro."
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {/* Âncora crua recarregava o documento inteiro a cada troca, e a fila
            piscava em branco. É filtro da mesma tela, não navegação. */}
        <Button variant={incluirEnviadas ? 'outline' : 'secondary'} asChild>
          <LinkDeFiltro href={hrefSemFiltro(caminho, params, 'enviadas') as Route}>
            Só o que falta enviar
          </LinkDeFiltro>
        </Button>
        <Button variant={incluirEnviadas ? 'secondary' : 'outline'} asChild>
          <LinkDeFiltro
            href={
              hrefDoGrupo(caminho, { ...params, enviadas: undefined }, 'enviadas', '1') as Route
            }
          >
            Incluir já enviados
          </LinkDeFiltro>
        </Button>
      </div>

      <FiltrosAtivos
        filtros={filtrosAtivos}
        limpar={incluirEnviadas ? '/expedicao?enviadas=1' : caminho}
      />

      {pedidos.length === 0 ? (
        <EstadoVazio
          titulo="Nada para separar agora"
          descricao="Os pedidos aparecem aqui quando o Admin move a solicitação para organizando envio, seja depois da compra, seja direto da aprovação quando já há estoque."
        />
      ) : listados.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum pedido neste filtro"
          descricao="Tire um dos filtros acima para ver os outros pedidos."
        />
      ) : (
        <div className="space-y-4">
          {listados.map((pedido) => (
            <Card key={pedido.id}>
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-4">
                <div>
                  <CardTitle className="text-base tabular-nums">{pedido.codigo}</CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {formatarData(pedido.data)} ·{' '}
                    <FiltroDoGrupo
                      {...grupo('consultor', pedido.consultor)}
                      rotulo={`consultor ${pedido.consultor}`}
                      texto
                    >
                      {pedido.consultor}
                    </FiltroDoGrupo>{' '}
                    · {pedido.motivo}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <FiltroDoGrupo
                    {...grupo('status', pedido.status)}
                    rotulo={`status ${ROTULO_STATUS[pedido.status]}`}
                  >
                    <StatusBadge status={pedido.status} />
                  </FiltroDoGrupo>
                  <NoTiny tiny={noTiny.get(pedido.id)} operaTiny={operaTiny} />
                </div>
              </CardHeader>

              <CardContent className="grid gap-6 md:grid-cols-2">
                <div>
                  <p className="text-muted-foreground font-ui mb-2 text-xs font-semibold tracking-[0.1em] uppercase">
                    Separar
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    {pedido.itens.map((item, indice) => (
                      <li
                        key={`${pedido.id}-${indice}`}
                        className="flex items-baseline justify-between gap-3"
                      >
                        <span>
                          <span className="tabular-nums">{item.quantidade}×</span> {item.produto}
                        </span>
                        <FiltroDoGrupo
                          {...grupo('item', item.jaEmEstoque ? 'estoque' : 'compra')}
                          rotulo={
                            item.jaEmEstoque
                              ? 'pedidos com item do estoque'
                              : 'pedidos com item comprado'
                          }
                        >
                          <Badge variant={item.jaEmEstoque ? 'secondary' : 'outline'}>
                            {item.jaEmEstoque ? 'estoque' : 'compra'}
                          </Badge>
                        </FiltroDoGrupo>
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted-foreground mt-3 border-t pt-3 text-xs">
                    Valor da solicitação: {formatarBRL(pedido.valorTotal)}
                  </p>
                </div>

                <div>
                  <p className="text-muted-foreground font-ui mb-2 text-xs font-semibold tracking-[0.1em] uppercase">
                    Enviar para
                  </p>
                  {/* `select-all` porque enquanto a integração não existe estes
                      dados são copiados para o sistema da transportadora. */}
                  <address className="text-sm leading-relaxed not-italic select-all">
                    <span className="font-medium">{pedido.destinatario}</span>
                    <br />
                    {pedido.logradouro}, {pedido.numero}
                    {pedido.complemento ? `, ${pedido.complemento}` : ''}
                    <br />
                    {pedido.bairro}
                    <br />
                    {pedido.cidade}/{pedido.uf} · <span className="tabular-nums">{pedido.cep}</span>
                    {pedido.clienteTelefone ? (
                      <>
                        <br />
                        <span className="tabular-nums">{pedido.clienteTelefone}</span>
                      </>
                    ) : null}
                  </address>

                  {pedido.observacoes ? (
                    <p className="text-muted-foreground mt-3 border-t pt-3 text-xs whitespace-pre-wrap">
                      {pedido.observacoes}
                    </p>
                  ) : null}
                </div>

                {podeRegistrarRastreio ? (
                  <div className="md:col-span-2">
                    <Rastreio
                      solicitacaoId={pedido.id}
                      status={pedido.status}
                      rastreio={pedido.rastreio}
                      transportadora={pedido.transportadora}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-muted-foreground mt-6 text-xs">
        A fila mostra as solicitações em{' '}
        {STATUS_DA_EXPEDICAO.map((s) => ROTULO_STATUS[s].toLowerCase()).join(' e ')}. A carta que
        acompanha o presente é escrita fora do sistema.
      </p>
    </>
  )
}
