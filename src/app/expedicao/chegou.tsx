'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, PackageCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialogo } from '@/components/ui/dialogo'
import { confirmarChegada } from '@/lib/actions/solicitacoes'

/**
 * "Chegou": a Logística confirma que o item comprado está com ela.
 *
 * Pede confirmação porque é aqui que o pedido vai para o Tiny, e daí não volta
 * pela lista de status.
 */
export function Chegou({ solicitacaoId, codigo }: { solicitacaoId: string; codigo: string }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()

  function confirmar() {
    setErro(null)
    iniciar(async () => {
      const r = await confirmarChegada(solicitacaoId)
      if (!r.ok) return setErro(r.erro)
      setAberto(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setAberto(true)}>
        <PackageCheck aria-hidden="true" />
        Chegou
      </Button>
      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="O item chegou?"
        descricao={codigo}
      >
        <div className="text-left whitespace-normal">
          <p className="text-sm leading-relaxed">
            O pedido vai para &quot;Pronto para processar&quot;, aqui na Expedição, e vira pedido no
            Tiny. Confirme só com o item na mão.
          </p>
          {erro ? (
            <p role="alert" className="text-destructive mt-3 text-sm">
              {erro}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAberto(false)}>
              Voltar
            </Button>
            <Button disabled={salvando} onClick={confirmar}>
              {salvando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Confirmar chegada
            </Button>
          </div>
        </div>
      </Dialogo>
    </>
  )
}
