'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialogo } from '@/components/ui/dialogo'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { arquivarDemanda, salvarDemanda } from '@/lib/actions/logistica'
import { formatarISO } from '@/lib/datas'
import {
  FASES,
  ROTULO_COMPLEXIDADE,
  ROTULO_FASE,
  ROTULO_PERIODICIDADE,
  ROTULO_PRIORIDADE,
} from '@/lib/logistica/demandas'
import type { DemandaNaTrilha } from '@/lib/logistica/painel'
import { cn } from '@/lib/utils'
import type { Sugestoes } from './trilha'

const CLASSE_DO_SELECT =
  'border-input bg-background text-foreground focus-visible:ring-ring focus-visible:ring-offset-background flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'

const dia = (d: Date | null | undefined) => (d ? formatarISO(new Date(d)) : '')

/** "12.5" vira "12,50": o campo aceita os dois, e a área escreve com vírgula. */
const reais = (v: string | null | undefined) =>
  v ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''

function Campo({
  rotulo,
  dica,
  children,
  className,
}: {
  rotulo: string
  dica?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn('grid content-start gap-1.5 text-sm font-medium', className)}>
      {rotulo}
      {children}
      {dica ? <span className="text-muted-foreground text-xs font-normal">{dica}</span> : null}
    </label>
  )
}

/**
 * Cadastro e edição de demanda da trilha.
 *
 * Os campos são os que a Logística listou (proposta, item 4, e os áudios de
 * 09/10/2026). Subsidiária, departamento, produto e responsável sugerem o que
 * já foi usado, para a mesma subsidiária não aparecer com três grafias no
 * gráfico. Nada é apagado: o que entrou por engano é arquivado.
 */
export function EditorDeDemanda({
  demanda,
  sugestoes,
}: {
  demanda?: DemandaNaTrilha
  sugestoes: Sugestoes
}) {
  const router = useRouter()
  const formulario = useRef<HTMLFormElement>(null)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()
  const [recorrente, setRecorrente] = useState(demanda?.recorrente ?? false)
  const prefixo = demanda ? `demanda-${demanda.id}` : 'demanda-nova'

  function enviar(dados: FormData) {
    setErro(null)
    iniciar(async () => {
      const r = await salvarDemanda(dados)
      if (!r.ok) {
        setErro(r.erro)
        // Leva o cursor ao campo que falhou, em vez de só dizer que algo falhou.
        if (r.campo) {
          const campo = formulario.current?.elements.namedItem(r.campo)
          if (campo instanceof HTMLElement) campo.focus()
        }
        return
      }
      setAberto(false)
      router.refresh()
    })
  }

  function arquivar() {
    if (!demanda) return
    setErro(null)
    iniciar(async () => {
      const r = await arquivarDemanda(demanda.id, true)
      if (!r.ok) return setErro(r.erro)
      setAberto(false)
      router.refresh()
    })
  }

  const lista = (id: string, valores: string[]) => (
    <datalist id={`${prefixo}-${id}`}>
      {valores.map((v) => (
        <option key={v} value={v} />
      ))}
    </datalist>
  )

  return (
    <>
      {demanda ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAberto(true)}
          aria-label={`Editar ${demanda.titulo}`}
        >
          <Pencil aria-hidden="true" />
          <span className="md:sr-only">Editar</span>
        </Button>
      ) : (
        <Button size="sm" onClick={() => setAberto(true)}>
          <Plus aria-hidden="true" />
          Nova demanda
        </Button>
      )}

      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={demanda ? 'Editar demanda' : 'Nova demanda'}
        descricao={
          demanda?.origem === 'solicitacao'
            ? 'Veio de um presente aprovado. A fase acompanha o status do presente; o resto pode ser ajustado aqui.'
            : 'Entra na trilha e nos números do dashboard assim que salvar.'
        }
        className="w-[min(46rem,calc(100vw-2rem))]"
      >
        <form ref={formulario} action={enviar} className="space-y-4">
          {demanda ? <input type="hidden" name="id" value={demanda.id} /> : null}

          <Campo rotulo="Título">
            <Input name="titulo" defaultValue={demanda?.titulo} required maxLength={160} />
          </Campo>

          <Campo rotulo="O que vai" dica="Um item por linha. Mais de um aparece como “Kit”.">
            <Textarea name="itens" defaultValue={demanda?.itens.join('\n')} rows={3} />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Subsidiária">
              <Input
                name="subsidiaria"
                list={`${prefixo}-subsidiarias`}
                defaultValue={demanda?.subsidiaria ?? ''}
                required
              />
              {lista('subsidiarias', sugestoes.subsidiarias)}
            </Campo>
            <Campo rotulo="Departamento">
              <Input
                name="departamento"
                list={`${prefixo}-departamentos`}
                defaultValue={demanda?.departamento ?? ''}
                required
              />
              {lista('departamentos', sugestoes.departamentos)}
            </Campo>
            <Campo rotulo="Produto (opcional)">
              <Input
                name="produto"
                list={`${prefixo}-produtos`}
                defaultValue={demanda?.produto ?? ''}
                placeholder="Ex.: Consultoria, AUVP Escola"
              />
              {lista('produtos', sugestoes.produtos)}
            </Campo>
            <Campo rotulo="Responsável (opcional)">
              <Input
                name="responsavel"
                list={`${prefixo}-responsaveis`}
                defaultValue={demanda?.responsavel ?? ''}
              />
              {lista('responsaveis', sugestoes.responsaveis)}
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Campo rotulo="Fase">
              <select
                name="fase"
                defaultValue={demanda?.fase ?? 'recebido'}
                className={CLASSE_DO_SELECT}
              >
                {FASES.map((f) => (
                  <option key={f} value={f}>
                    {ROTULO_FASE[f]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Prioridade">
              <select
                name="prioridade"
                defaultValue={demanda?.prioridade ?? 'normal'}
                className={CLASSE_DO_SELECT}
              >
                {(Object.keys(ROTULO_PRIORIDADE) as (keyof typeof ROTULO_PRIORIDADE)[]).map((p) => (
                  <option key={p} value={p}>
                    {ROTULO_PRIORIDADE[p]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Complexidade">
              <select
                name="complexidade"
                defaultValue={demanda?.complexidade ?? 'baixa'}
                className={CLASSE_DO_SELECT}
              >
                {(Object.keys(ROTULO_COMPLEXIDADE) as (keyof typeof ROTULO_COMPLEXIDADE)[]).map(
                  (c) => (
                    <option key={c} value={c}>
                      {ROTULO_COMPLEXIDADE[c]}
                    </option>
                  ),
                )}
              </select>
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Campo rotulo="Previsão de início" dica="Opcional. Some da trilha quando começa.">
              <Input
                type="date"
                name="previsaoInicio"
                defaultValue={dia(demanda?.previsaoInicio)}
              />
            </Campo>
            <Campo rotulo="Previsão de conclusão">
              <Input
                type="date"
                name="previsaoConclusao"
                defaultValue={dia(demanda?.previsaoConclusao)}
                required
              />
            </Campo>
            <Campo rotulo="Custo do envio (R$)" dica="Opcional. Soma no gráfico de custo.">
              <Input
                name="custoEnvio"
                inputMode="decimal"
                placeholder="0,00"
                defaultValue={reais(demanda?.custoEnvio)}
              />
            </Campo>
          </div>

          <div className="bg-muted/40 flex flex-wrap items-end gap-4 rounded-lg border p-3">
            <label className="flex items-center gap-2.5 text-sm font-medium">
              <input
                type="checkbox"
                name="recorrente"
                checked={recorrente}
                onChange={(e) => setRecorrente(e.target.checked)}
                className="accent-primary size-4"
              />
              Recorrente
            </label>
            {recorrente ? (
              <Campo rotulo="Volta a cada" className="min-w-40">
                <select
                  name="periodicidade"
                  defaultValue={demanda?.periodicidade ?? 'semanal'}
                  className={CLASSE_DO_SELECT}
                >
                  {(Object.keys(ROTULO_PERIODICIDADE) as (keyof typeof ROTULO_PERIODICIDADE)[]).map(
                    (p) => (
                      <option key={p} value={p}>
                        {ROTULO_PERIODICIDADE[p]}
                      </option>
                    ),
                  )}
                </select>
              </Campo>
            ) : null}
            <p className="text-muted-foreground basis-full text-xs">
              Ao concluir uma recorrente, a próxima ocorrência entra sozinha na trilha.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Link no ClickUp (opcional)">
              <Input name="clickupUrl" type="url" defaultValue={demanda?.clickupUrl ?? ''} />
            </Campo>
            <Campo rotulo="Link do formulário (opcional)">
              <Input
                name="linkFormulario"
                type="url"
                defaultValue={demanda?.linkFormulario ?? ''}
              />
            </Campo>
          </div>

          <Campo rotulo="Observações (opcional)" dica="Só Logística e Admin leem.">
            <Textarea
              name="observacoes"
              defaultValue={demanda?.observacoes ?? ''}
              rows={3}
              maxLength={2000}
            />
          </Campo>

          {erro ? (
            <p role="alert" className="text-destructive text-sm">
              {erro}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-between gap-2">
            {demanda ? (
              <Button type="button" variant="ghost" onClick={arquivar} disabled={salvando}>
                Arquivar
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando}>
                {salvando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                Salvar
              </Button>
            </div>
          </div>
        </form>
      </Dialogo>
    </>
  )
}
