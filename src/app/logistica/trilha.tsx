import {
  AlertTriangle,
  CalendarX2,
  ExternalLink,
  FileText,
  Flame,
  Gift,
  Info,
  Repeat,
} from 'lucide-react'
import { formatarData } from '@/lib/datas'
import {
  ROTULO_COMPLEXIDADE,
  ROTULO_PERIODICIDADE,
  ROTULO_PRIORIDADE,
} from '@/lib/logistica/demandas'
import type { DemandaNaTrilha, sugestoesDoCadastro } from '@/lib/logistica/painel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { EditorDeDemanda } from './editor-de-demanda'
import { Dica, FaseBadge, TituloDoBloco } from './pecas'

export type Sugestoes = Awaited<ReturnType<typeof sugestoesDoCadastro>>

/**
 * Trilha de demandas (relatório, itens 4 e 5).
 *
 * Cadastrada aqui mesmo pela Logística: a trilha não espelha o ClickUp, e a
 * tarefa lá, quando existe, é o link do título. O presente aprovado entra
 * sozinho, com o selo "Presente".
 *
 * A "Esteira prioritária" e a trilha viraram um quadro só, como o relatório
 * propôs: o que é urgente ou de alta prioridade sobe para o topo com uma
 * faixa e um selo, junto da previsão de entrega. Cada linha responde, sem
 * clique:
 *
 * - em que fase está e quão complexa é;
 * - o que está sendo enviado, "Kit" quando é mais de um item;
 * - quando começa, enquanto não começou, e quando fica pronta, ou que está
 *   atrasada, ou que falta a previsão.
 */
export function Trilha({
  demandas,
  total,
  exportar,
  verObservacoes,
  sugestoes,
}: {
  demandas: DemandaNaTrilha[]
  total: number
  /** Query do período, para a exportação levar o mesmo recorte da tela. */
  exportar: string
  verObservacoes: boolean
  /** Presente só para quem pode cadastrar: é o que liga a edição. */
  sugestoes: Sugestoes | null
}) {
  const abertas = demandas.filter((d) => d.fase !== 'concluido')
  const prioritarias = abertas.filter((d) => d.prioritaria).length
  const atrasadas = abertas.filter((d) => d.atrasada).length

  return (
    <section aria-labelledby="trilha" className="bg-card rounded-lg border">
      <div id="trilha" className="px-5 pt-5">
        <TituloDoBloco
          titulo="Trilha de demandas"
          apoio={`${total} ${total === 1 ? 'demanda' : 'demandas'} em andamento no período · ${prioritarias} ${prioritarias === 1 ? 'prioritária' : 'prioritárias'} · ${atrasadas} ${atrasadas === 1 ? 'atrasada' : 'atrasadas'}`}
          acoes={
            <>
              {sugestoes ? <EditorDeDemanda sugestoes={sugestoes} /> : null}
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/logistica/export?${exportar}&formato=csv`} download>
                  Exportar CSV
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/logistica/export?${exportar}&formato=xlsx`} download>
                  Exportar planilha
                </a>
              </Button>
            </>
          }
        />
      </div>

      {demandas.length === 0 ? (
        <p className="text-muted-foreground px-5 pt-4 pb-10 text-center text-sm">
          Nenhuma demanda em andamento no período.
        </p>
      ) : (
        <ul className="border-t">
          {demandas.map((d) => (
            <LinhaDaTrilha
              key={d.id}
              demanda={d}
              verObservacoes={verObservacoes}
              sugestoes={sugestoes}
            />
          ))}
        </ul>
      )}

      {total > demandas.length ? (
        <p className="text-muted-foreground border-t px-5 py-3 text-xs">
          Mostrando as {demandas.length} primeiras de {total}, na ordem da trilha. A exportação leva
          todas.
        </p>
      ) : null}
    </section>
  )
}

function LinhaDaTrilha({
  demanda: d,
  verObservacoes,
  sugestoes,
}: {
  demanda: DemandaNaTrilha
  verObservacoes: boolean
  sugestoes: Sugestoes | null
}) {
  const concluida = d.fase === 'concluido'
  const contexto = [
    // Departamento e produto às vezes têm o mesmo nome; uma vez basta.
    ...new Set([d.departamento, d.produto, d.responsavel]),
    d.complexidade ? `Complexidade ${ROTULO_COMPLEXIDADE[d.complexidade].toLowerCase()}` : null,
  ].filter(Boolean)

  return (
    <li
      className={cn(
        'relative grid gap-x-6 gap-y-2 border-b px-5 py-3.5 last:border-0 md:grid-cols-[1fr_auto_13rem_auto] md:items-center',
        d.prioritaria && !concluida && 'bg-warning/5',
        concluida && 'text-muted-foreground',
      )}
    >
      {d.prioritaria && !concluida ? (
        <span className="bg-warning absolute inset-y-0 left-0 w-1" aria-hidden="true" />
      ) : null}

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {d.prioritaria && !concluida ? (
            <Badge variant={d.prioridade === 'urgente' ? 'error' : 'warning'} className="gap-1">
              <Flame className="size-3" aria-hidden="true" />
              {ROTULO_PRIORIDADE[d.prioridade]}
            </Badge>
          ) : null}
          {d.origem === 'solicitacao' ? (
            <Badge variant="outline" className="gap-1">
              <Gift className="size-3" aria-hidden="true" />
              Presente
            </Badge>
          ) : null}
          {d.recorrente ? (
            <Badge variant="outline" className="gap-1">
              <Repeat className="size-3" aria-hidden="true" />
              {d.periodicidade ? ROTULO_PERIODICIDADE[d.periodicidade] : 'Recorrente'}
            </Badge>
          ) : null}

          {d.clickupUrl ? (
            <a
              href={d.clickupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary-emphasis inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
            >
              {d.titulo}
              <ExternalLink className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
              <span className="sr-only">(abre no ClickUp)</span>
            </a>
          ) : (
            <span className="font-medium">{d.titulo}</span>
          )}

          {verObservacoes && d.observacoes ? (
            <Dica
              id={`obs-${d.id}`}
              rotulo="Observações"
              gatilho={<Info className="size-4" aria-hidden="true" />}
            >
              {d.observacoes}
            </Dica>
          ) : null}

          {d.linkFormulario ? (
            <a
              href={d.linkFormulario}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground inline-flex"
              title="Formulário do pedido"
            >
              <FileText className="size-4" aria-hidden="true" />
              <span className="sr-only">Formulário do pedido</span>
            </a>
          ) : null}
        </div>

        <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1.5 text-sm">
          <span className="text-foreground">
            {d.enviado.itens.length > 1 ? (
              <Dica
                id={`kit-${d.id}`}
                rotulo={`Kit com ${d.enviado.itens.length} itens`}
                gatilho={
                  <span className="text-foreground underline decoration-dotted underline-offset-4">
                    Kit · {d.enviado.itens.length} itens
                  </span>
                }
              >
                {d.enviado.itens.join('\n')}
              </Dica>
            ) : (
              d.enviado.rotulo
            )}
          </span>
          {contexto.map((t) => (
            <span key={t}>· {t}</span>
          ))}
        </p>
      </div>

      <div>
        <FaseBadge fase={d.fase} />
      </div>

      <Previsao demanda={d} />

      <div className="md:justify-self-end">
        {sugestoes ? <EditorDeDemanda demanda={d} sugestoes={sugestoes} /> : null}
      </div>
    </li>
  )
}

function Previsao({ demanda: d }: { demanda: DemandaNaTrilha }) {
  if (d.fase === 'concluido') {
    return (
      <p className="text-sm md:text-right">
        Concluída {d.concluidaEm ? `em ${formatarData(d.concluidaEm)}` : ''}
      </p>
    )
  }

  const inicio =
    d.mostrarInicio && d.previsaoInicio ? (
      <span className="text-muted-foreground block text-xs">
        Começa {formatarData(d.previsaoInicio)}
      </span>
    ) : null

  if (!d.previsaoConclusao) {
    return (
      // Âmbar só no ícone: como texto pequeno, ele não passa no contraste.
      <p className="text-sm font-medium md:text-right">
        {inicio}
        <span className="inline-flex items-center gap-1.5">
          <CalendarX2 className="text-warning size-4" aria-hidden="true" />
          Sem previsão
        </span>
      </p>
    )
  }

  if (d.atrasada) {
    return (
      <p className="text-error text-sm font-medium md:text-right">
        <span className="inline-flex items-center gap-1.5">
          <AlertTriangle className="size-4" aria-hidden="true" />
          Atrasada desde {formatarData(d.previsaoConclusao)}
        </span>
      </p>
    )
  }

  return (
    <p className="text-sm md:text-right">
      {inicio}
      <span className="text-muted-foreground">Previsão </span>
      <span className="tabular-nums">{formatarData(d.previsaoConclusao)}</span>
    </p>
  )
}
