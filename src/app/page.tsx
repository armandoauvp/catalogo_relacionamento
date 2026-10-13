import Link from 'next/link'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { exigirUsuario } from '@/lib/auth-guards'
import { filtroDeSolicitacoes, pode, type Acao } from '@/lib/permissions'
import { saldoDoMes, saldoDoMesDoTime } from '@/lib/saldo'
import { formatarBRL } from '@/lib/money'
import { formatarData, intervaloDoMes } from '@/lib/datas'
import { STATUS_FORA_DO_SALDO } from '@/lib/status'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

type Atalho = { href: Route; titulo: string; texto: string; acao: Acao }

/**
 * Os atalhos ficam em linhas de três e de dois numa grade de seis colunas, sem
 * sobrar cartão sozinho: cinco viram 3 + 2, quatro viram 2 + 2. Cada perfil
 * vê uma quantidade diferente, então a largura depende do total.
 */
const LARGURA_DO_ATALHO = {
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  6: 'lg:col-span-6',
} as const

function larguraDosAtalhos(total: number): (keyof typeof LARGURA_DO_ATALHO)[] {
  const linhas = total <= 3 ? [total] : total === 4 ? [2, 2] : [3, total - 3]
  return linhas.flatMap((porLinha) =>
    Array.from({ length: porLinha }, () => (6 / porLinha) as keyof typeof LARGURA_DO_ATALHO),
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
    },
    {
      href: '/catalogo',
      titulo: 'Catálogo',
      texto: 'Ver os presentes disponíveis e o que há em estoque.',
      acao: 'catalogo.ver',
    },
    {
      href: '/financeiro/compras',
      titulo: 'Fila de compras',
      texto: 'Itens enviados para compra, com valor e site.',
      acao: 'compras.verFila',
    },
    {
      href: '/expedicao',
      titulo: 'Expedição',
      texto: 'Pedidos prontos para separar, com o endereço de envio.',
      acao: 'expedicao.verFila',
    },
    {
      href: '/admin/solicitacoes',
      titulo: 'Gestão',
      texto: 'Acompanhar o fluxo, alterar status e exportar.',
      acao: 'solicitacao.verTodas',
    },
  ]

  const atalhos = todos.filter((a) => pode(usuario.perfil, a.acao))
  const larguras = larguraDosAtalhos(atalhos.length)

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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {atalhos.map((a, i) => (
              <Link
                key={a.href}
                href={a.href}
                className={cn('group', LARGURA_DO_ATALHO[larguras[i]!])}
              >
                <Card className="hover:border-primary/30 h-full transition-[box-shadow,border-color] duration-200 hover:shadow-[0_8px_24px_-12px_rgba(11,41,5,0.28)]">
                  <CardHeader className="p-5">
                    <CardTitle className="group-hover:text-primary-emphasis flex items-center gap-2 text-base transition-colors">
                      {a.titulo}
                      <span
                        aria-hidden="true"
                        className="transition-transform duration-200 group-hover:translate-x-1"
                      >
                        →
                      </span>
                    </CardTitle>
                    <CardDescription className="text-pretty">{a.texto}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
