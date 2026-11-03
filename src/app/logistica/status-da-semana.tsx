import type { SituacaoOperacional } from '@prisma/client'
import {
  AlertTriangle,
  CheckCircle2,
  OctagonAlert,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { formatarDataHora } from '@/lib/datas'
import type { PainelLogistico } from '@/lib/logistica/painel'
import { ROTULO_SITUACAO } from '@/lib/logistica/status-operacional'
import { cn } from '@/lib/utils'
import { DefinirStatus } from './definir-status'

/**
 * O status da operação na semana, em destaque (relatório, item 1).
 *
 * O primeiro bloco da tela e o maior texto dela: quem abre o painel precisa
 * saber em um segundo se a Logística está bem. A cor nunca vem sozinha, cada
 * situação tem ícone e nome, e o texto fica nas cores de texto; a cor de
 * status marca a faixa lateral, o fundo suave e o ícone.
 */
const ESTILO: Record<
  SituacaoOperacional,
  { icone: LucideIcon; faixa: string; fundo: string; corDoIcone: string }
> = {
  normal: {
    icone: CheckCircle2,
    faixa: 'bg-success',
    fundo: 'bg-success/8',
    corDoIcone: 'text-success',
  },
  alto_volume: {
    icone: TrendingUp,
    faixa: 'bg-info',
    fundo: 'bg-info/8',
    corDoIcone: 'text-info',
  },
  risco_de_atraso: {
    icone: AlertTriangle,
    faixa: 'bg-warning',
    fundo: 'bg-warning/10',
    corDoIcone: 'text-warning',
  },
  critica: {
    icone: OctagonAlert,
    faixa: 'bg-error',
    fundo: 'bg-error/8',
    corDoIcone: 'text-error',
  },
}

export function StatusDaSemana({
  status,
  podeDefinir,
}: {
  status: PainelLogistico['status']
  podeDefinir: boolean
}) {
  const { atual } = status
  const estilo = ESTILO[atual.situacao]
  const Icone = estilo.icone
  const discordaDosNumeros = atual.origem === 'manual' && atual.sugestao.situacao !== atual.situacao

  return (
    <section
      aria-labelledby="status-da-semana"
      data-tour="status-semana"
      className="bg-card relative mb-6 overflow-hidden rounded-lg border"
    >
      <span className={cn('absolute inset-y-0 left-0 w-1.5', estilo.faixa)} aria-hidden="true" />
      {/* O tom de status vai numa camada própria, sobre o fundo do cartão. */}
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-x-8 gap-y-4 py-5 pr-5 pl-7',
          estilo.fundo,
        )}
      >
        <div className="flex items-center gap-4">
          <Icone className={cn('size-10 shrink-0', estilo.corDoIcone)} aria-hidden="true" />
          <div>
            <p className="text-muted-foreground font-ui text-xs font-semibold tracking-[0.12em] uppercase">
              Status da operação · {status.ehSemanaAtual ? 'semana atual' : 'semana'}{' '}
              {status.rotulo}
            </p>
            <h2
              id="status-da-semana"
              className="font-display mt-1 text-3xl font-semibold tracking-tight"
            >
              {ROTULO_SITUACAO[atual.situacao]}
            </h2>
            <p className="text-muted-foreground mt-1 max-w-prose text-sm">{atual.motivo}</p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 text-sm sm:items-end">
          <p className="text-muted-foreground">
            {atual.origem === 'manual'
              ? `Definido manualmente${atual.definidoPor ? ` por ${atual.definidoPor}` : ''}${atual.definidoEm ? ` em ${formatarDataHora(atual.definidoEm)}` : ''}`
              : 'Sugerido pelos números da semana'}
          </p>
          {discordaDosNumeros ? (
            <p className="text-muted-foreground text-xs">
              Os números sugerem: {ROTULO_SITUACAO[atual.sugestao.situacao]}.{' '}
              {atual.sugestao.motivo}
            </p>
          ) : null}
          {podeDefinir ? (
            <DefinirStatus
              ano={status.semana.ano}
              semana={status.semana.semana}
              rotuloDaSemana={status.rotulo}
              situacaoAtual={atual.origem === 'manual' ? atual.situacao : null}
              observacaoAtual={atual.observacao}
              sugestao={ROTULO_SITUACAO[atual.sugestao.situacao]}
            />
          ) : null}
        </div>
      </div>
    </section>
  )
}
