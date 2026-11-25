'use client'

import { useState } from 'react'
import { Check, ChevronDown, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FolhaDaCarta } from '@/components/folha-da-carta'
import { textoDaCarta, type PreviaDaCarta } from '@/lib/carta'

/**
 * A carta que vai na caixa, recolhida para não alongar a fila: quem embala
 * abre a do pedido que tem na mão.
 */
export function CartaDoPedido({ carta }: { carta: PreviaDaCarta }) {
  const [copiada, setCopiada] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function copiar() {
    setErro(null)
    try {
      await navigator.clipboard.writeText(textoDaCarta(carta))
      setCopiada(true)
      setTimeout(() => setCopiada(false), 2000)
    } catch {
      setErro('Não deu para copiar. Selecione o texto e copie à mão.')
    }
  }

  return (
    <details className="group border-t pt-4">
      <summary className="text-muted-foreground hover:text-foreground font-ui flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold tracking-[0.1em] uppercase">
        <ChevronDown
          className="size-3.5 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
        Carta
      </summary>
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,32rem)_auto] md:items-start">
        <FolhaDaCarta previa={carta} vazioEm="O consultor não escreveu mensagem." />
        <div className="flex flex-col items-start gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copiar}>
            {copiada ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <Copy className="size-4" aria-hidden="true" />
            )}
            {copiada ? 'Copiada' : 'Copiar o texto'}
          </Button>
          {erro ? <p className="text-destructive text-xs">{erro}</p> : null}
        </div>
      </div>
    </details>
  )
}
