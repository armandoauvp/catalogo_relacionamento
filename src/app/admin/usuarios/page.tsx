import { Perfil } from '@prisma/client'
import { db } from '@/lib/db'
import { hrefDoGrupo, hrefSemFiltro, valorDoFiltro } from '@/lib/filtro-por-grupo'
import { FiltroDoGrupo, FiltrosAtivos, type FiltroAtivo } from '@/components/filtro-por-grupo'
import { exigirPermissao } from '@/lib/auth-guards'
import { perfisAoAlcance, pode, ROTULO_PERFIL } from '@/lib/permissions'
import { formatarBRL, type Dinheiro } from '@/lib/money'
import { mesAnterior, saldoDoMesPorConsultor } from '@/lib/saldo'
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
import { Stat } from '@/components/stat'
import { CabecalhoDaPagina } from '@/components/pagina'
import { EditorDeUsuario } from './editor-de-usuario'

const TEXTOS: Record<'geral' | 'relacionamento' | 'logistica', [string, string]> = {
  geral: [
    'Perfil e limite mensal são geridos aqui, dentro da ferramenta, sem passar por TI.',
    'Usuários não são criados aqui: entram sozinhos no primeiro login pelo SSO, como Colaborador AUVP. Esta tela promove, define o teto mensal e desativa quem saiu do time.',
  ],
  relacionamento: [
    'Os consultores: limite mensal e quem está ativo.',
    'Ninguém é criado aqui: a pessoa entra sozinha no primeiro login pelo SSO, como Colaborador AUVP. Esta tela faz Consultor quem é do time, define o teto mensal e desativa quem saiu.',
  ],
  logistica: [
    'Quem faz parte do time da Logística e quem está ativo.',
    'Ninguém é criado aqui: a pessoa entra sozinha no primeiro login pelo SSO, como Colaborador AUVP. Esta tela a coloca no time da Logística e desativa quem saiu.',
  ],
}

/**
 * CRUD de usuários: perfil e limite mensal.
 *
 * O usuário é criado no primeiro login pelo SSO, com perfil `colaborador`. Esta
 * tela é onde o Admin promove e define limite, sem passar por TI. Cada admin só
 * recebe quem está ao seu alcance: o recorte é na consulta, não na tela.
 */
export default async function AdminUsuariosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const logado = await exigirPermissao('usuario.gerenciar')
  const alcance = perfisAoAlcance(logado.perfil)
  const defineLimite = pode(logado.perfil, 'usuario.definirLimite')
  const [descricao, explicacao] =
    TEXTOS[
      alcance.length === Object.values(Perfil).length
        ? 'geral'
        : defineLimite
          ? 'relacionamento'
          : 'logistica'
    ]
  const params = await searchParams
  const caminho = '/admin/usuarios'
  // O time cabe numa tela: o recorte do clique é feito na memória.
  const perfil = alcance.find((p) => p === params.perfil)
  const situacao = ['ativo', 'desativado'].find((s) => s === params.situacao)
  const grupo = (chave: string, valor: string) => ({
    href: hrefDoGrupo(caminho, params, chave, valor),
    ativo: valorDoFiltro(params, chave) === valor,
  })

  // O gasto do mês contra o limite é de quem cuida do limite e vê o saldo de todos.
  const verGasto = defineLimite && pode(logado.perfil, 'saldo.verTodos')
  const agora = new Date()
  const anterior = mesAnterior(agora)

  const [usuarios, saldoAtual, saldoAnterior] = await Promise.all([
    db.usuario.findMany({
      where: { perfil: { in: [...alcance] } },
      include: { _count: { select: { solicitacoes: true } } },
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    }),
    verGasto ? saldoDoMesPorConsultor(agora) : [],
    verGasto ? saldoDoMesPorConsultor(anterior) : [],
  ])
  const gastoAtual = new Map(saldoAtual.map((s) => [s.usuarioId, s]))
  const gastoAnterior = new Map(saldoAnterior.map((s) => [s.usuarioId, s.gasto]))
  const acimaDoLimite = saldoAtual.filter((s) => s.estourou).length
  const nomeDoMes = (d: Date) =>
    new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' }).format(d)
  const listados = usuarios.filter(
    (u) => (!perfil || u.perfil === perfil) && (!situacao || u.ativo === (situacao === 'ativo')),
  )
  const filtrosAtivos: FiltroAtivo[] = [
    perfil && {
      coluna: 'Perfil',
      valor: ROTULO_PERFIL[perfil],
      semEle: hrefSemFiltro(caminho, params, 'perfil'),
    },
    situacao && {
      coluna: 'Situação',
      valor: situacao,
      semEle: hrefSemFiltro(caminho, params, 'situacao'),
    },
  ].filter((f): f is FiltroAtivo => Boolean(f))

  return (
    <>
      <CabecalhoDaPagina titulo="Usuários" descricao={descricao} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat rotulo="Ativos" valor={usuarios.filter((u) => u.ativo).length} />
        <Stat
          rotulo="Consultores"
          valor={usuarios.filter((u) => u.perfil === 'consultor').length}
        />
        {verGasto ? (
          <Stat
            rotulo={`Acima do limite em ${nomeDoMes(agora)}`}
            valor={acimaDoLimite}
            apoio="Só sinaliza: o pedido não é bloqueado, e o excesso pode ser compensado no mês seguinte."
          />
        ) : defineLimite ? (
          <Stat
            rotulo="Com limite definido"
            valor={usuarios.filter((u) => u.limiteMensal).length}
            apoio="Os demais não têm teto mensal."
          />
        ) : (
          <Stat
            rotulo="Na Logística"
            valor={usuarios.filter((u) => u.perfil === 'logistica').length}
          />
        )}
      </div>

      <p className="text-muted-foreground mb-6 text-sm">{explicacao}</p>

      <FiltrosAtivos filtros={filtrosAtivos} limpar={caminho} />
      <Card className="overflow-hidden" data-tour="lista-usuarios">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Perfil</TableHead>
              {defineLimite && !verGasto ? (
                <TableHead className="text-right">Limite mensal</TableHead>
              ) : null}
              {verGasto ? (
                <>
                  <TableHead className="min-w-44">Gasto em {nomeDoMes(agora)}</TableHead>
                  <TableHead className="text-right">Em {nomeDoMes(anterior)}</TableHead>
                </>
              ) : null}
              <TableHead className="text-right">Solicitações</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listados.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6 + (verGasto ? 2 : defineLimite ? 1 : 0)}
                  className="text-muted-foreground py-10 text-center"
                >
                  {usuarios.length ? 'Ninguém neste filtro.' : 'Nenhum usuário ainda.'}
                </TableCell>
              </TableRow>
            ) : (
              listados.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <FiltroDoGrupo
                      {...grupo('perfil', u.perfil)}
                      rotulo={`perfil ${ROTULO_PERFIL[u.perfil]}`}
                    >
                      <Badge variant="secondary">{ROTULO_PERFIL[u.perfil]}</Badge>
                    </FiltroDoGrupo>
                  </TableCell>
                  {defineLimite && !verGasto ? (
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      {u.limiteMensal ? formatarBRL(u.limiteMensal) : '-'}
                    </TableCell>
                  ) : null}
                  {verGasto ? (
                    <>
                      <TableCell>
                        <GastoDoMes saldo={gastoAtual.get(u.id)} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right whitespace-nowrap tabular-nums">
                        {gastoAnterior.get(u.id)?.isZero() === false
                          ? formatarBRL(gastoAnterior.get(u.id)!)
                          : '-'}
                      </TableCell>
                    </>
                  ) : null}
                  <TableCell className="text-right tabular-nums">{u._count.solicitacoes}</TableCell>
                  <TableCell>
                    <FiltroDoGrupo
                      {...grupo('situacao', u.ativo ? 'ativo' : 'desativado')}
                      rotulo={u.ativo ? 'usuários ativos' : 'usuários desativados'}
                    >
                      <Badge variant={u.ativo ? 'outline' : 'muted'}>
                        {u.ativo ? 'ativo' : 'desativado'}
                      </Badge>
                    </FiltroDoGrupo>
                  </TableCell>
                  <TableCell className="text-right">
                    <EditorDeUsuario
                      perfis={alcance}
                      defineLimite={defineLimite}
                      usuario={{
                        id: u.id,
                        nome: u.nome,
                        email: u.email,
                        perfil: u.perfil,
                        limiteMensal:
                          defineLimite && u.limiteMensal
                            ? u.limiteMensal.toFixed(2).replace('.', ',')
                            : null,
                        ativo: u.ativo,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}

/**
 * Gasto do mês contra o limite. Sem limite, só o valor: não há o que comparar.
 * Acima do limite fica em vermelho, mas é aviso, não bloqueio.
 */
function GastoDoMes({
  saldo,
}: {
  saldo: { gasto: Dinheiro; limite: Dinheiro | null; estourou: boolean } | undefined
}) {
  if (!saldo || (saldo.gasto.isZero() && !saldo.limite)) {
    return <span className="text-muted-foreground">-</span>
  }
  const { gasto, limite, estourou } = saldo
  const percentual =
    limite && !limite.isZero() ? Math.min(100, gasto.dividedBy(limite).times(100).toNumber()) : null

  return (
    <div className="space-y-1">
      <p
        className={
          estourou
            ? 'text-error text-sm font-medium whitespace-nowrap tabular-nums'
            : 'text-sm whitespace-nowrap tabular-nums'
        }
      >
        {formatarBRL(gasto)}
        {limite ? (
          <span className="text-muted-foreground font-normal"> de {formatarBRL(limite)}</span>
        ) : null}
      </p>
      {percentual !== null ? (
        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div
            className={estourou ? 'bg-error h-full' : 'bg-success h-full'}
            style={{ width: `${percentual}%` }}
          />
        </div>
      ) : null}
      {estourou && limite ? (
        <p className="text-error text-xs">{formatarBRL(gasto.minus(limite))} acima do limite</p>
      ) : null}
    </div>
  )
}
