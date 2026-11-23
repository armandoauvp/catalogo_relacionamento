import Link from 'next/link'
import type { Route } from 'next'
import { AlertTriangle, CheckCircle2, Truck } from 'lucide-react'
import { exigirUsuario } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { formatarDataHora } from '@/lib/datas'
import { pode } from '@/lib/permissions'
import { CabecalhoDaPagina, EstadoVazio } from '@/components/pagina'
import { cn } from '@/lib/utils'
import { MarcarLidos } from './marcar-lidos'

/**
 * Os avisos de quem está logado, do mais novo para o mais antigo. Hoje vêm do
 * rastreio dos Correios: cada movimento do presente que a pessoa pediu.
 */
export default async function AvisosPage() {
  const usuario = await exigirUsuario()
  const avisos = await db.notificacao.findMany({
    where: { usuarioId: usuario.id },
    orderBy: { criadoEm: 'desc' },
    take: 80,
    include: { solicitacao: { select: { id: true } } },
  })
  // Abrir a tela marca como lido na hora; o destaque fica um pouco, para quem
  // acabou de abrir ainda ver o que era novo.
  const desde = new Date().getTime() - 10 * 60_000
  const novo = (a: { lidaEm: Date | null }) => !a.lidaEm || a.lidaEm.getTime() > desde
  // Quem vê todas as solicitações abre pela gestão; o consultor, pela dele.
  const base = pode(usuario.perfil, 'solicitacao.verTodas')
    ? '/admin/solicitacoes'
    : '/solicitacoes'

  return (
    <>
      <MarcarLidos haNovos={avisos.some((a) => !a.lidaEm)} />
      <CabecalhoDaPagina
        titulo="Avisos"
        descricao="Cada movimento dos presentes que você pediu, como os Correios contam: postado, a caminho, entregue, aguardando retirada ou com problema."
      />

      {avisos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum aviso ainda"
          descricao="Quando um presente seu for postado, cada movimento dele nos Correios aparece aqui."
        />
      ) : (
        <ul className="bg-card divide-border divide-y rounded-lg border">
          {avisos.map((a) => {
            const Icone =
              a.tom === 'entrega' ? CheckCircle2 : a.tom === 'alerta' ? AlertTriangle : Truck
            const conteudo = (
              <>
                <Icone
                  className={cn(
                    'mt-0.5 size-5 shrink-0',
                    a.tom === 'entrega' && 'text-success',
                    a.tom === 'alerta' && 'text-warning',
                    a.tom === 'comum' && 'text-muted-foreground',
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block text-sm',
                      novo(a) ? 'text-foreground font-semibold' : 'text-foreground',
                    )}
                  >
                    {a.titulo}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">{a.texto}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <time
                    dateTime={a.criadoEm.toISOString()}
                    className="text-muted-foreground text-xs tabular-nums"
                  >
                    {formatarDataHora(a.criadoEm)}
                  </time>
                  {novo(a) ? (
                    <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-px text-[10px] font-bold">
                      novo
                    </span>
                  ) : null}
                </span>
              </>
            )
            return (
              <li key={a.id}>
                {a.solicitacao ? (
                  <Link
                    href={`${base}/${a.solicitacao.id}` as Route}
                    className={cn(
                      'hover:bg-muted/50 flex gap-3 px-4 py-3 transition-colors',
                      a.tom === 'alerta' && novo(a) && 'bg-warning/5',
                    )}
                  >
                    {conteudo}
                  </Link>
                ) : (
                  <div className="flex gap-3 px-4 py-3">{conteudo}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
