'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, PackageCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialogo } from '@/components/ui/dialogo'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatarData, formatarDataHora, formatarISO } from '@/lib/datas'
import { anularEnvio, registrarEnvio } from '@/lib/actions/logistica'
import type { LancamentoDeEnvio } from '@/lib/logistica/painel'
import { cn } from '@/lib/utils'

const numero = (n: number) => n.toLocaleString('pt-BR')

/**
 * Envios lançados numa demanda (relatório de 29/10).
 *
 * A tarefa que dura semanas recebe o que saiu em cada uma: "500 cartas, dia
 * 29". O total vai na linha da trilha; aqui ficam o lançamento e o histórico,
 * que é o que permite fechar o mês por subsidiária e departamento depois.
 *
 * Quem só lê o painel vê o histórico; lançar e anular é da Logística.
 */
export function EnviosDaDemanda({
  demandaId,
  titulo,
  total,
  historico,
  podeLancar,
}: {
  demandaId: string
  titulo: string
  total: number
  historico: LancamentoDeEnvio[]
  /** Quem gerencia a trilha e a demanda está aberta. */
  podeLancar: boolean
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()
  const [anulando, setAnulando] = useState<string | null>(null)

  // Sem lançamento e sem poder lançar, não há o que abrir.
  if (!podeLancar && historico.length === 0) return null

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const formulario = evento.currentTarget
    const dados = new FormData(formulario)
    setErro(null)
    iniciar(async () => {
      const r = await registrarEnvio(dados)
      if (!r.ok) return setErro(r.erro)
      formulario.reset()
      router.refresh()
    })
  }

  function anular(id: string) {
    setErro(null)
    setAnulando(id)
    iniciar(async () => {
      const r = await anularEnvio(id)
      setAnulando(null)
      if (!r.ok) return setErro(r.erro)
      router.refresh()
    })
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setAberto(true)}>
        <PackageCheck aria-hidden="true" />
        {podeLancar ? 'Envios' : 'Ver envios'}
      </Button>

      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Envios da demanda"
        descricao={titulo}
      >
        <p className="text-sm">
          <span className="font-display text-2xl font-semibold tabular-nums">{numero(total)}</span>{' '}
          <span className="text-muted-foreground">
            {total === 1 ? 'item despachado' : 'itens despachados'} até agora
          </span>
        </p>

        {podeLancar ? (
          <form onSubmit={enviar} className="mt-5 space-y-3 rounded-lg border p-4">
            <input type="hidden" name="demandaId" value={demandaId} />
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor={`envio-qtd-${demandaId}`}>Quantos saíram</Label>
                <Input
                  id={`envio-qtd-${demandaId}`}
                  name="quantidade"
                  inputMode="numeric"
                  placeholder="Ex.: 500"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`envio-dia-${demandaId}`}>Dia do envio</Label>
                <Input
                  id={`envio-dia-${demandaId}`}
                  name="enviadoEm"
                  type="date"
                  defaultValue={formatarISO(new Date())}
                  max={formatarISO(new Date())}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`envio-obs-${demandaId}`}>Observação</Label>
              <Input
                id={`envio-obs-${demandaId}`}
                name="observacao"
                placeholder="Opcional. Ex.: lote da semana 44"
                maxLength={200}
              />
            </div>
            {erro ? (
              <p role="alert" className="text-destructive text-sm">
                {erro}
              </p>
            ) : null}
            <div className="flex justify-end">
              <Button type="submit" disabled={salvando}>
                {salvando && !anulando ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : null}
                Registrar envio
              </Button>
            </div>
          </form>
        ) : null}

        <div className="mt-5">
          <p className="font-ui text-muted-foreground mb-2 text-xs font-semibold tracking-[0.14em] uppercase">
            Histórico
          </p>
          {historico.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum envio lançado ainda.</p>
          ) : (
            <ul className="max-h-72 divide-y overflow-y-auto border-y">
              {historico.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                  <div className={cn('min-w-0', e.anuladoEm && 'text-muted-foreground')}>
                    <p>
                      <span
                        className={cn('font-semibold tabular-nums', e.anuladoEm && 'line-through')}
                      >
                        {numero(e.quantidade)}
                      </span>{' '}
                      em {formatarData(e.enviadoEm)}
                      {e.observacao ? (
                        <span className="text-muted-foreground"> · {e.observacao}</span>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Lançado por {e.registradoPor} em {formatarDataHora(e.criadoEm)}
                      {e.anuladoEm
                        ? ` · anulado por ${e.anuladoPor ?? 'alguém'} em ${formatarDataHora(e.anuladoEm)}`
                        : ''}
                    </p>
                  </div>
                  {podeLancar && !e.anuladoEm ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={salvando}
                      onClick={() => anular(e.id)}
                    >
                      {anulando === e.id ? (
                        <Loader2 className="animate-spin" aria-hidden="true" />
                      ) : null}
                      Anular
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Dialogo>
    </>
  )
}
