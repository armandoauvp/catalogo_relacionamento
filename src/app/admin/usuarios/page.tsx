import { Perfil } from '@prisma/client'
import { db } from '@/lib/db'
import { hrefDoGrupo, hrefSemFiltro, valorDoFiltro } from '@/lib/filtro-por-grupo'
import { FiltroDoGrupo, FiltrosAtivos, type FiltroAtivo } from '@/components/filtro-por-grupo'
import { exigirPermissao } from '@/lib/auth-guards'
import { perfisAoAlcance, pode, ROTULO_PERFIL } from '@/lib/permissions'
import { formatarBRL } from '@/lib/money'
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
    'Usuários não são criados aqui: entram sozinhos no primeiro login pelo SSO, como consultor. Esta tela promove, define o teto mensal e desativa quem saiu do time.',
  ],
  relacionamento: [
    'Os consultores: limite mensal e quem está ativo.',
    'Consultores não são criados aqui: entram sozinhos no primeiro login pelo SSO. Esta tela define o teto mensal e desativa quem saiu do time.',
  ],
  logistica: [
    'Quem faz parte do time da Logística e quem está ativo.',
    'Ninguém é criado aqui: a pessoa entra sozinha no primeiro login pelo SSO, como consultor. Esta tela a coloca no time da Logística, a devolve a Consultor e desativa quem saiu.',
  ],
}

/**
 * CRUD de usuários: perfil e limite mensal.
 *
 * O usuário é criado no primeiro login pelo SSO, com perfil `consultor`. Esta
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

  const usuarios = await db.usuario.findMany({
    where: { perfil: { in: [...alcance] } },
    include: { _count: { select: { solicitacoes: true } } },
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
  })
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
        {defineLimite ? (
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
              {defineLimite ? <TableHead className="text-right">Limite mensal</TableHead> : null}
              <TableHead className="text-right">Solicitações</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listados.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={defineLimite ? 7 : 6}
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
                  {defineLimite ? (
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      {u.limiteMensal ? formatarBRL(u.limiteMensal) : '-'}
                    </TableCell>
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
