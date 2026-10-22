'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { salvarConfiguracaoTiny } from '@/lib/actions/tiny'

type Configuracao = {
  enviarPresentes: boolean
  transportadora: string | null
  formaFrete: string | null
  marcadorPresentes: string
}

/**
 * Como o presente aprovado vai ao Tiny. Uma configuração só, porque os
 * presentes saem todos pelo mesmo contrato de envio.
 */
export function ConfiguracaoDosPresentes({ configuracao }: { configuracao: Configuracao }) {
  const router = useRouter()
  const [salvando, iniciar] = useTransition()
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null)

  return (
    <form
      action={(dados) =>
        iniciar(async () => {
          const r = await salvarConfiguracaoTiny(dados)
          setAviso(
            r.ok ? { texto: 'Configuração salva.', erro: false } : { texto: r.erro, erro: true },
          )
          router.refresh()
        })
      }
      className="space-y-4"
    >
      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="enviarPresentes"
          defaultChecked={configuracao.enviarPresentes}
          className="accent-primary mt-0.5 size-4"
        />
        <span>
          <span className="font-medium">Mandar os presentes aprovados ao Tiny</span>
          <span className="text-muted-foreground block">
            O pedido nasce quando a solicitação chega a &quot;Organizando envio&quot;.
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="tiny-transportadora">Transportadora</Label>
          <Input
            id="tiny-transportadora"
            name="transportadora"
            defaultValue={configuracao.transportadora ?? ''}
            placeholder="Correios"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tiny-frete">Serviço de envio</Label>
          <Input
            id="tiny-frete"
            name="formaFrete"
            defaultValue={configuracao.formaFrete ?? ''}
            placeholder="PAC CONTRATO"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tiny-marcador">Marcador no Tiny</Label>
          <Input
            id="tiny-marcador"
            name="marcadorPresentes"
            defaultValue={configuracao.marcadorPresentes}
            required
            maxLength={50}
          />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Transportadora e serviço vazios deixam o pedido com o padrão da conta no Tiny. Mudança aqui
        vale para os próximos pedidos; os que já estão na fila seguem como entraram.
      </p>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={salvando}>
          {salvando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Salvar
        </Button>
        {aviso ? (
          <p
            role="status"
            className={aviso.erro ? 'text-destructive text-sm' : 'text-muted-foreground text-sm'}
          >
            {aviso.texto}
          </p>
        ) : null}
      </div>
    </form>
  )
}
