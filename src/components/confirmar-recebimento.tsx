'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { confirmarRecebimento } from '@/lib/actions/solicitacoes'

/**
 * "Meu cliente recebeu", para quem pediu o presente.
 *
 * Pede um segundo clique porque encerra a solicitação, e status final não
 * volta: um toque sem querer na lista não pode fechar o pedido de ninguém.
 */
export function ConfirmarRecebimento({
  solicitacaoId,
  compacto = false,
}: {
  solicitacaoId: string
  /** Na linha da tabela: botão menor e sem a frase de apoio. */
  compacto?: boolean
}) {
  const router = useRouter()
  const [salvando, iniciar] = useTransition()
  const [perguntando, setPerguntando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function confirmar() {
    setErro(null)
    iniciar(async () => {
      const r = await confirmarRecebimento(solicitacaoId)
      if (!r.ok) return setErro(r.erro)
      setPerguntando(false)
      router.refresh()
    })
  }

  const tamanho = compacto ? 'sm' : 'default'

  return (
    <div className="space-y-2">
      {perguntando ? (
        <div className="flex flex-wrap items-center gap-2">
          {compacto ? null : (
            <span className="text-sm">O cliente confirmou? Isso encerra a solicitação.</span>
          )}
          <Button size={tamanho} onClick={confirmar} disabled={salvando}>
            {salvando ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Check aria-hidden="true" />
            )}
            Confirmar
          </Button>
          <Button
            size={tamanho}
            variant="outline"
            onClick={() => setPerguntando(false)}
            disabled={salvando}
          >
            Voltar
          </Button>
        </div>
      ) : (
        <Button size={tamanho} variant="outline" onClick={() => setPerguntando(true)}>
          <Check aria-hidden="true" />
          Meu cliente recebeu
        </Button>
      )}

      {erro ? (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      ) : null}
    </div>
  )
}
