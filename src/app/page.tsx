import Link from 'next/link'
import { ArrowRight, Gift, Plus, ShoppingCart, Table2, Truck, type LucideIcon } from 'lucide-react'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { exigirUsuario } from '@/lib/auth-guards'
import { filtroDeSolicitacoes, pode, type Acao } from '@/lib/permissions'
import { saldoDoMes, saldoDoMesDoTime } from '@/lib/saldo'
import { formatarBRL } from '@/lib/money'
import { formatarData, intervaloDoMes } from '@/lib/datas'
import { STATUS_FORA_DO_SALDO } from '@/lib/status'
import { Card, CardContent } from '@/components/ui/card'
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
import { CabecalhoDaPagina } from '@/components/pagina'
import { cn } from '@/lib/utils'

type Atalho = {
  href: Route
  titulo: string
  texto: string
  acao: Acao
  icone: LucideIcon
  /** A ação que o perfil mais faz: cartão cheio, em vez de contorno. */
  principal?: boolean
}

/**
 * Um atalho. O ícone é o mesmo da barra de navegação, para o caminho ser
 * reconhecido nos dois lugares.
 */
function CartaoDeAtalho({ atalho }: { atalho: Atalho }) {
  const { icone: Icone, principal } = atalho
  return (
    <Link
      href={atalho.href}
      className={cn(
        'group focus-visible:ring-ring flex flex-col rounded-lg border p-5 outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'transition-[box-shadow,border-color,background-color] duration-200 hover:shadow-[0_8px_24px_-12px_rgba(11,41,5,0.28)]',
        principal
          ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/92'
          : 'bg-card hover:border-primary/30',
      )}
    >
      <span className="flex items-start justify-between">
        <span
          className={cn(
            'flex size-10 items-center justify-center rounded-lg border transition-colors duration-200',
            principal
              ? 'border-primary-foreground/25 bg-primary-foreground/10'
              : 'bg-muted/60 group-hover:bg-foreground group-hover:text-background group-hover:border-foreground',
          )}
        >
          <Icone className="size-5" aria-hidden="true" />
        </span>
        <ArrowRight
          aria-hidden="true"
          className={cn(
            'size-4 -translate-x-1 opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100',
            principal ? 'text-primary-foreground' : 'text-primary-emphasis',
          )}
        />
      </span>
      <span className="font-display mt-4 text-base leading-tight font-semibold">
        {atalho.titulo}
      </span>
      <span
        className={cn(
          'mt-1 text-sm text-pretty',
          principal ? 'text-primary-foreground/80' : 'text-muted-foreground',
        )}
      >
        {atalho.texto}
      </span>
    </Link>
  )
}

export default async function Home() {
  const usuario = await exigirUsuario()
  const { inicio, fim } = intervaloDoMes()

  // O escopo vem da matriz de permissões: o consultor conta só as próprias.
  // Nulo é "nenhuma", e não "todas": quem não acompanha solicitação, o time de
  // Logística, começa pelo painel dele em vez de um resumo que não lhe cabe.
  const escopo = filtroDeSolicitacoes(usuario.perfil, usuario.id)
  if (!escopo) redirect('/logistica')

  // Admin e Financeiro não criam solicitações, então o gasto pessoal deles
  // seria sempre zero. Para esses perfis o número que interessa é o do time.
  const veTudo = pode(usuario.perfil, 'saldo.verTodos')

  const [saldoProprio, saldoTime, noMes, emAndamento, recentes] = await Promise.all([
    pode(usuario.perfil, 'saldo.verProprio') ? saldoDoMes(usuario.id) : null,
    veTudo ? saldoDoMesDoTime() : null,
    db.solicitacao.count({ where: { ...escopo, dataSolicitacao: { gte: inicio, lt: fim } } }),
    db.solicitacao.count({
      where: { ...escopo, status: { notIn: [...STATUS_FORA_DO_SALDO, 'cliente_confirmou'] } },
    }),
    db.solicitacao.findMany({
      where: escopo,
      include: { cliente: { select: { nome: true } }, consultor: { select: { nome: true } } },
      orderBy: { dataSolicitacao: 'desc' },
      take: 5,
    }),
  ])

  const mes = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date())

  const gasto = veTudo ? (saldoTime?.gasto ?? null) : (saldoProprio?.gasto ?? null)

  // `Route` é exigido por `typedRoutes`: o href é validado em compilação.
  // A anotação fica no literal, e não no resultado do filtro, porque a tipagem
  // contextual não atravessa o `.filter()`.
  const todos: Atalho[] = [
    {
      href: '/solicitacoes/nova',
      titulo: 'Nova solicitação',
      texto: 'Cliente, itens, entrega e a carta que acompanha o envio.',
      acao: 'solicitacao.criar',
      icone: Plus,
      principal: true,
    },
    {
      href: '/catalogo',
      titulo: 'Catálogo',
      texto: 'Ver os presentes disponíveis e o que há em estoque.',
      acao: 'catalogo.ver',
      icone: Gift,
    },
    {
      href: '/financeiro/compras',
      titulo: 'Fila de compras',
      texto: 'Itens enviados para compra, com valor e site.',
      acao: 'compras.verFila',
      icone: ShoppingCart,
    },
    {
      href: '/expedicao',
      titulo: 'Expedição',
      texto: 'Pedidos prontos para separar, com o endereço de envio.',
      acao: 'expedicao.verFila',
      icone: Truck,
    },
    {
      href: '/admin/solicitacoes',
      titulo: 'Gestão',
      texto: 'Acompanhar o fluxo, alterar status e exportar.',
      acao: 'solicitacao.verTodas',
      icone: Table2,
    },
  ]

  const atalhos = todos.filter((a) => pode(usuario.perfil, a.acao))

  return (
    <>
      <CabecalhoDaPagina
        titulo={`Olá, ${usuario.nome.split(' ')[0]}`}
        descricao="Presentes para clientes: solicitação, acompanhamento e custo por consultor."
      />

      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {gasto ? (
          // Número principal da tela, o único em tamanho de destaque.
          <Stat
            destaque
            rotulo={veTudo ? `Gasto do time em ${mes}` : `Seu gasto em ${mes}`}
            valor={formatarBRL(gasto)}
            apoio={
              !veTudo && saldoProprio?.limite ? (
                <div className="space-y-2">
                  <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className={saldoProprio.estourou ? 'bg-error h-full' : 'bg-success h-full'}
                      style={{ width: `${Math.min(100, saldoProprio.percentual ?? 0)}%` }}
                    />
                  </div>
                  <p>
                    de {formatarBRL(saldoProprio.limite)}
                    {/* O V1 apenas sinaliza. O bloqueio depende de decisão da área. */}
                    {saldoProprio.estourou ? ': limite ultrapassado.' : ' no limite do mês.'}
                  </p>
                </div>
              ) : (
                'Tudo o que foi solicitado no mês entra na conta.'
              )
            }
          />
        ) : null}

        <Stat
          rotulo={`Solicitações em ${mes}`}
          valor={noMes}
          apoio={noMes === 0 ? 'Nenhuma ainda neste mês.' : 'Criadas no mês corrente.'}
        />
        <Stat
          rotulo="Em andamento"
          valor={emAndamento}
          apoio="Ainda não confirmadas pelo cliente."
        />
      </div>

      {/* Bloco, e não grade: item de grade cresce até a largura mínima da
          tabela e abriria rolagem lateral no celular. */}
      <div className="space-y-10">
        <div>
          <h2 className="font-ui text-muted-foreground mb-3 text-xs font-semibold tracking-[0.14em] uppercase">
            Últimas solicitações
          </h2>

          {recentes.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground py-10 text-center text-sm">
                Nenhuma solicitação ainda.
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>{veTudo ? 'Consultor' : 'Cliente'}</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentes.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium whitespace-nowrap tabular-nums">
                        {/* Cada perfil vai para o detalhe que enxerga: o Admin
                            para a gestão, o consultor para a própria. */}
                        <Link
                          href={
                            pode(usuario.perfil, 'solicitacao.verTodas')
                              ? `/admin/solicitacoes/${s.id}`
                              : `/solicitacoes/${s.id}`
                          }
                          className="hover:text-primary-emphasis underline-offset-4 hover:underline"
                        >
                          {s.codigo}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
                        {formatarData(s.dataSolicitacao)}
                      </TableCell>
                      <TableCell>{veTudo ? s.consultor.nome : s.cliente.nome}</TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                        {formatarBRL(s.valorTotal)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={s.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>

        <div>
          <h2 className="font-ui text-muted-foreground mb-3 text-xs font-semibold tracking-[0.14em] uppercase">
            Atalhos
          </h2>
          {/* Grade fluida: cada perfil tem um número diferente de atalhos, e
              eles dividem a largura que houver, numa linha só no computador. */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(13.5rem,1fr))] gap-3">
            {atalhos.map((a) => (
              <CartaoDeAtalho key={a.href} atalho={a} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
