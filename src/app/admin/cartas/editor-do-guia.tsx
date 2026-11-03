'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialogo } from '@/components/ui/dialogo'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { salvarGuia } from '@/lib/actions/cartas'
import { LIMITE_DO_GUIA, problemaDoGuia } from '@/lib/carta'
import { cn } from '@/lib/utils'

/**
 * O guia de como escrever a carta, onde a área o escreve.
 *
 * Mora aqui porque é quem cuida dos modelos que cuida do guia, mas quem precisa
 * dele é o consultor, que não entra nesta tela: ele lê na etapa da carta. Texto
 * corrido, com as quebras de linha respeitadas.
 */
export function EditorDoGuia({ texto }: { texto: string }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [rascunho, setRascunho] = useState(texto)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()

  function abrir() {
    setRascunho(texto)
    setErro(null)
    setAberto(true)
  }

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErro(null)
    iniciar(async () => {
      const r = await salvarGuia(rascunho)
      if (!r.ok) return setErro(r.erro)
      setAberto(false)
      router.refresh()
    })
  }

  const problema = problemaDoGuia(rascunho)
  const usados = rascunho.trim().length

  return (
    <Card className="mb-6" data-tour="guia-carta-admin">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Guia de escrita</h2>
            <p className="text-muted-foreground text-xs">
              Como escrever a carta. O consultor lê na etapa da carta, antes da mensagem.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={abrir}>
            <Pencil aria-hidden="true" />
            {texto ? 'Editar guia' : 'Escrever guia'}
          </Button>
        </div>

        {texto ? (
          <p className="mt-4 border-t pt-4 text-sm leading-relaxed whitespace-pre-wrap">{texto}</p>
        ) : (
          <p className="text-muted-foreground mt-2 text-sm">
            Ainda sem guia: o consultor não vê este bloco.
          </p>
        )}

        <Dialogo
          aberto={aberto}
          aoFechar={() => setAberto(false)}
          titulo="Guia de escrita"
          descricao="Deixe em branco para tirar o guia do ar."
        >
          <form onSubmit={enviar} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="guia-texto">Texto</Label>
              <Textarea
                id="guia-texto"
                rows={12}
                value={rascunho}
                onChange={(e) => {
                  setRascunho(e.target.value)
                  setErro(null)
                }}
                aria-invalid={Boolean(problema)}
              />
              <p
                className={cn(
                  'text-right text-xs tabular-nums',
                  problema ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {usados} de {LIMITE_DO_GUIA}
              </p>
            </div>

            {erro || problema ? (
              <p role="alert" className="text-destructive text-sm">
                {erro ?? problema}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando}>
                {salvando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                {salvando ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </form>
        </Dialogo>
      </CardContent>
    </Card>
  )
}
