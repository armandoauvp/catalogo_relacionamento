'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw, RotateCcw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  processarAgora,
  reenviar,
  reenviarFalhasDoLote,
  sincronizarAgora,
} from '@/lib/actions/tiny'

/** Mensagem de resultado ao lado do botão, que some sozinha. */
function useAviso() {
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null)
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 8000)
    return () => clearTimeout(t)
  }, [aviso])
  return [aviso, setAviso] as const
}

function Aviso({ aviso }: { aviso: { texto: string; erro: boolean } | null }) {
  if (!aviso) return null
  return (
    <p
      role="status"
      className={aviso.erro ? 'text-destructive text-sm' : 'text-muted-foreground text-sm'}
    >
      {aviso.texto}
    </p>
  )
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** "Processar agora" e "Atualizar rastreios", do cabeçalho da tela do Tiny. */
export function BotoesDaFila() {
  const router = useRouter()
  const [processando, iniciarProcesso] = useTransition()
  const [sincronizando, iniciarSincronia] = useTransition()
  const [aviso, setAviso] = useAviso()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Aviso aviso={aviso} />
      <Button
        variant="outline"
        disabled={sincronizando}
        onClick={() =>
          iniciarSincronia(async () => {
            const r = await sincronizarAgora()
            setAviso(
              r.ok
                ? {
                    texto: `${plural(r.dados.atualizados, 'pedido atualizado', 'pedidos atualizados')}.`,
                    erro: false,
                  }
                : { texto: r.erro, erro: true },
            )
            router.refresh()
          })
        }
      >
        {sincronizando ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCw aria-hidden="true" />
        )}
        Atualizar rastreios
      </Button>
      <Button
        disabled={processando}
        onClick={() =>
          iniciarProcesso(async () => {
            const r = await processarAgora()
            if (!r.ok) setAviso({ texto: r.erro, erro: true })
            else if (r.dados.interrompida) setAviso({ texto: r.dados.interrompida, erro: true })
            else {
              const { enviados, falhas, adiados } = r.dados
              setAviso({
                texto:
                  enviados + falhas + adiados === 0
                    ? 'A fila já estava vazia.'
                    : `${plural(enviados, 'enviado', 'enviados')}, ${plural(falhas, 'falha', 'falhas')}` +
                      (adiados ? `, ${plural(adiados, 'adiado', 'adiados')}` : '') +
                      '.',
                erro: falhas > 0,
              })
            }
            router.refresh()
          })
        }
      >
        {processando ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Send aria-hidden="true" />
        )}
        Processar fila agora
      </Button>
    </div>
  )
}

export function BotaoReenviar({ id }: { id: string }) {
  const router = useRouter()
  const [enviando, iniciar] = useTransition()
  const [aviso, setAviso] = useAviso()
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        size="sm"
        variant="ghost"
        disabled={enviando}
        onClick={() =>
          iniciar(async () => {
            const r = await reenviar(id)
            if (!r.ok) setAviso({ texto: r.erro, erro: true })
            router.refresh()
          })
        }
      >
        {enviando ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <RotateCcw aria-hidden="true" />
        )}
        Reenviar
      </Button>
      <Aviso aviso={aviso} />
    </span>
  )
}

export function BotaoReenviarFalhas({ loteId, falhas }: { loteId: string; falhas: number }) {
  const router = useRouter()
  const [enviando, iniciar] = useTransition()
  const [aviso, setAviso] = useAviso()
  if (falhas === 0) return null
  return (
    <span className="inline-flex items-center gap-2">
      <Aviso aviso={aviso} />
      <Button
        variant="outline"
        disabled={enviando}
        onClick={() =>
          iniciar(async () => {
            const r = await reenviarFalhasDoLote(loteId)
            setAviso(
              r.ok
                ? {
                    texto: `${plural(r.dados.reenviados, 'pedido voltou', 'pedidos voltaram')} para a fila.`,
                    erro: false,
                  }
                : { texto: r.erro, erro: true },
            )
            router.refresh()
          })
        }
      >
        {enviando ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <RotateCcw aria-hidden="true" />
        )}
        Reenviar {plural(falhas, 'falha', 'falhas')}
      </Button>
    </span>
  )
}

/**
 * Enquanto houver pedido na fila, a tela se atualiza sozinha: quem importou
 * o lote vê cada linha virar pedido sem apertar F5. `router.refresh` troca só
 * os dados, a tela não recarrega.
 */
export function AtualizarEnquanto({
  ativo,
  intervaloMs = 5000,
}: {
  ativo: boolean
  intervaloMs?: number
}) {
  const router = useRouter()
  useEffect(() => {
    if (!ativo) return
    const t = setInterval(() => router.refresh(), intervaloMs)
    return () => clearInterval(t)
  }, [ativo, intervaloMs, router])
  return null
}
