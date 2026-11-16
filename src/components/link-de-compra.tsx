'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { trocarLinkDeCompra } from '@/lib/actions/solicitacoes'

/**
 * Link de compra de um item, com a troca para quem aprova.
 *
 * O consultor pede um item que esgotou, ou que não serve: quem aprova troca o
 * link ali mesmo, em vez de devolver o pedido. Vazio volta ao link original.
 */
export function LinkDeCompra({
  itemId,
  site,
  trocado,
  editavel,
}: {
  itemId: string
  /** O link em vigor: o trocado, ou o original. */
  site: string | null
  trocado: boolean
  editavel: boolean
}) {
  const router = useRouter()
  const [salvando, iniciar] = useTransition()
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(trocado ? (site ?? '') : '')
  const [erro, setErro] = useState<string | null>(null)

  function salvar(link: string) {
    setErro(null)
    iniciar(async () => {
      const r = await trocarLinkDeCompra({ itemId, link })
      if (!r.ok) return setErro(r.erro)
      setEditando(false)
      router.refresh()
    })
  }

  if (editando) {
    return (
      <form
        className="mt-1.5 space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          salvar(valor)
        }}
      >
        <Input
          type="url"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder={site ?? 'https://'}
          aria-label="Novo link de compra"
          autoFocus
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={salvando}>
            {salvando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Salvar link
          </Button>
          {trocado ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={salvando}
              onClick={() => salvar('')}
            >
              Voltar ao original
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={salvando}
            onClick={() => {
              setEditando(false)
              setErro(null)
            }}
          >
            Cancelar
          </Button>
        </div>
        {erro ? (
          <p role="alert" className="text-destructive text-xs">
            {erro}
          </p>
        ) : null}
      </form>
    )
  }

  return (
    <span className="mt-0.5 flex min-w-0 items-center gap-2 text-xs">
      {site ? (
        <a
          href={site}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary-emphasis truncate underline-offset-4 hover:underline"
        >
          {site.replace(/^https?:\/\//, '')}
        </a>
      ) : (
        <span className="text-muted-foreground">sem link</span>
      )}
      {trocado ? <span className="text-muted-foreground shrink-0">(trocado)</span> : null}
      {editavel ? (
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="text-primary-emphasis inline-flex shrink-0 items-center gap-1 underline-offset-4 hover:underline"
        >
          <Pencil className="size-3" aria-hidden="true" />
          Trocar link
        </button>
      ) : null}
    </span>
  )
}
