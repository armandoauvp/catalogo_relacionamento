import { after } from 'next/server'
import { ArrowDownCircle, CheckCircle2 } from 'lucide-react'
import { formatarData, formatarDataHora, formatarHora } from '@/lib/datas'
import { atualizarSeVelho, rastreamentoDe } from '@/lib/rastreio/sincronizar'
import { cn } from '@/lib/utils'

/**
 * O histórico do objeto nos Correios, como a tela de rastreio do Tiny mostra:
 * data e hora, o que aconteceu e onde. Lê o que está gravado; se a última
 * consulta estiver velha, consulta de novo depois da resposta, sem a tela
 * esperar os Correios.
 *
 * Código que não é dos Correios (Total Express, por exemplo) não tem histórico
 * aqui: o componente não mostra nada, e o código continua no cartão.
 */
export async function HistoricoDoRastreio({
  codigo,
  avisarEntrega = false,
}: {
  codigo: string | null | undefined
  /**
   * O pedido ainda não foi marcado como entregue aqui: a entrega dos Correios
   * vira um aviso, porque rastreio não muda status, quem marca é uma pessoa.
   */
  avisarEntrega?: boolean
}) {
  const r = await rastreamentoDe(codigo)
  if (!r) return null
  after(() => atualizarSeVelho(r))

  if (!r.eventos.length) {
    return (
      <p className="text-muted-foreground mt-3 border-t pt-3 text-xs">
        {r.erro
          ? `Os Correios ainda não têm histórico deste objeto (${r.erro}).`
          : 'O histórico dos Correios aparece aqui na próxima atualização.'}
      </p>
    )
  }

  return (
    <div className="mt-3 border-t pt-3">
      {avisarEntrega && r.entregueEm ? (
        <p
          role="status"
          className="border-success/40 bg-success/10 mb-3 rounded-md border px-3 py-2 text-sm"
        >
          <span className="font-medium">Os Correios registraram a entrega</span> em{' '}
          {formatarDataHora(r.entregueEm)}. O status muda quando a expedição marcar como entregue.
        </p>
      ) : null}
      <p className="text-muted-foreground font-ui mb-3 text-xs font-semibold tracking-[0.1em] uppercase">
        Histórico do objeto
      </p>
      <ol className="space-y-3" aria-label="Histórico do objeto nos Correios">
        {r.eventos.map((e) => (
          <li key={e.id} className="flex gap-3 text-sm">
            {e.entrega ? (
              <CheckCircle2 className="text-success mt-0.5 size-5 shrink-0" aria-hidden="true" />
            ) : (
              <ArrowDownCircle
                className="text-muted-foreground/60 mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
            )}
            <time
              dateTime={e.ocorridoEm.toISOString()}
              className="text-muted-foreground w-[4.75rem] shrink-0 text-right text-xs leading-5 tabular-nums"
            >
              {formatarData(e.ocorridoEm)}
              <br />
              {formatarHora(e.ocorridoEm)}
            </time>
            <div className="min-w-0">
              <p className={cn('font-medium', e.entrega && 'text-success')}>{e.descricao}</p>
              {e.local ? <p className="text-muted-foreground text-xs">{e.local}</p> : null}
              {e.destino ? <p className="text-muted-foreground text-xs">Para {e.destino}</p> : null}
            </div>
          </li>
        ))}
      </ol>
      <p className="text-muted-foreground mt-3 text-xs">
        Dados dos Correios
        {r.consultadoEm ? `, consultados em ${formatarDataHora(r.consultadoEm)}` : ''}.
      </p>
    </div>
  )
}
