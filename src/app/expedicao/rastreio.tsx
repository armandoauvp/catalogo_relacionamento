'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { StatusSolicitacao } from '@prisma/client'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { marcarEntregue, registrarRastreio } from '@/lib/actions/solicitacoes'
import { podeMarcarEntregue } from '@/lib/status'

/**
 * Rastreio do pedido.
 *
 * É a pergunta que o consultor faz por mensagem hoje, "já foi?", e a razão
 * de ela existir é não ter onde olhar. Preenchido aqui, aparece na tela dele.
 *
 * Salvar o rastreio **não** muda o status: pôr o código é dizer que saiu, e
 * "entregue" é outra coisa, decidida por quem acompanha. Por isso são dois
 * botões, e o de entregue só aparece depois que há o que acompanhar.
 *
 * Quando a integração com o sistema da expedição existir, ela escreve nestes
 * mesmos campos e este formulário vira o caminho manual de exceção.
 */
export function Rastreio({
  solicitacaoId,
  status,
  rastreio,
  transportadora,
}: {
  solicitacaoId: string
  status: StatusSolicitacao
  rastreio: string | null
  transportadora: string | null
}) {
  const router = useRouter()
  const [salvando, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)

  const [codigo, setCodigo] = useState(rastreio ?? '')
  const [transporte, setTransporte] = useState(transportadora ?? '')

  const mudou = codigo !== (rastreio ?? '') || transporte !== (transportadora ?? '')
  const podeEntregar = podeMarcarEntregue(status, rastreio)

  function salvar() {
    setErro(null)
    iniciar(async () => {
      const r = await registrarRastreio({
        solicitacaoId,
        rastreio: codigo,
        transportadora: transporte,
      })
      if (!r.ok) return setErro(r.erro)
      setSalvo(true)
      router.refresh()
    })
  }

  function entregar() {
    setErro(null)
    iniciar(async () => {
      const r = await marcarEntregue(solicitacaoId)
      if (!r.ok) return setErro(r.erro)
      router.refresh()
    })
  }

  return (
    <div className="mt-4 border-t pt-4">
      <p className="text-muted-foreground font-ui mb-2 text-xs font-semibold tracking-[0.1em] uppercase">
        Rastreio
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-44 flex-1 space-y-1.5">
          <Label htmlFor={`rastreio-${solicitacaoId}`}>Código</Label>
          <Input
            id={`rastreio-${solicitacaoId}`}
            value={codigo}
            onChange={(e) => {
              setCodigo(e.target.value)
              setSalvo(false)
            }}
            placeholder="AA123456789BR"
            className="tabular-nums"
          />
        </div>

        <div className="min-w-36 flex-1 space-y-1.5">
          <Label htmlFor={`transportadora-${solicitacaoId}`}>Transportadora</Label>
          <Input
            id={`transportadora-${solicitacaoId}`}
            value={transporte}
            onChange={(e) => {
              setTransporte(e.target.value)
              setSalvo(false)
            }}
            placeholder="Correios"
          />
        </div>

        <Button variant="outline" onClick={salvar} disabled={salvando || !mudou}>
          {salvando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {salvo && !mudou ? 'Salvo' : 'Salvar'}
        </Button>

        {podeEntregar ? (
          <Button onClick={entregar} disabled={salvando}>
            <Check aria-hidden="true" />
            Marcar como entregue
          </Button>
        ) : null}
      </div>

      {erro ? (
        <p role="alert" className="text-destructive mt-2 text-sm">
          {erro}
        </p>
      ) : null}

      <p className="text-muted-foreground mt-2 text-xs">
        {rastreio
          ? 'O consultor já vê este código na tela dele.'
          : 'Sem código, o consultor não tem como acompanhar o envio sozinho.'}
      </p>
    </div>
  )
}
