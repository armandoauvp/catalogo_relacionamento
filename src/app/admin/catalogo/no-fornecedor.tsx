'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  conferirNoFornecedor,
  conferirTodosNoFornecedor,
  usarPrecoDoFornecedor,
} from '@/lib/actions/catalogo'
import type { SituacaoNoFornecedor } from '@prisma/client'

const ROTULO: Record<
  SituacaoNoFornecedor,
  { texto: string; variante: 'warning' | 'outline' | 'muted' }
> = {
  esgotado: { texto: 'esgotado na loja', variante: 'warning' },
  limitado: { texto: 'pouco estoque na loja', variante: 'outline' },
  disponivel: { texto: 'disponível na loja', variante: 'muted' },
  nao_conferido: { texto: 'loja não conferida', variante: 'muted' },
}

const brl = (v: string) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })

/**
 * O que a loja dizia na última conferência, na linha do produto: o Admin vê o
 * esgotado e a diferença de preço onde já pausa e edita.
 */
export function NoFornecedor({
  id,
  situacao,
  preco,
  valor,
  conferidoEm,
  erro,
}: {
  id: string
  situacao: SituacaoNoFornecedor | null
  /** Decimal com ponto, como a loja mostrou. */
  preco: string | null
  /** O preço do catálogo, decimal com ponto. */
  valor: string | null
  conferidoEm: string | null
  erro: string | null
}) {
  const router = useRouter()
  const [ocupado, iniciar] = useTransition()
  const [falha, setFalha] = useState<string | null>(null)

  function rodar(acao: () => Promise<{ ok: boolean; erro?: string }>) {
    setFalha(null)
    iniciar(async () => {
      const r = await acao()
      if (!r.ok) return setFalha(r.erro ?? 'Não deu certo. Tente de novo.')
      router.refresh()
    })
  }

  const precoDiferente = preco !== null && (valor === null || Number(preco) !== Number(valor))
  const rotulo = situacao ? ROTULO[situacao] : null

  return (
    <div className="flex flex-col items-start gap-1 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        {rotulo ? (
          <Badge variant={rotulo.variante} title={erro ?? undefined}>
            {rotulo.texto}
          </Badge>
        ) : (
          <span className="text-muted-foreground">loja ainda não conferida</span>
        )}
        {precoDiferente ? (
          <span className="text-muted-foreground tabular-nums">loja: {brl(preco)}</span>
        ) : null}
      </div>
      {erro && situacao === 'nao_conferido' ? (
        <span className="text-muted-foreground max-w-72">{erro}</span>
      ) : null}
      <div className="flex flex-wrap items-center gap-1">
        {precoDiferente ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={ocupado}
            onClick={() => rodar(() => usarPrecoDoFornecedor(id))}
          >
            Usar {brl(preco)}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-7 px-2 text-xs"
          disabled={ocupado}
          onClick={() => rodar(() => conferirNoFornecedor(id))}
          title={conferidoEm ? `Conferido em ${quando(conferidoEm)}` : undefined}
        >
          {ocupado ? (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-3" aria-hidden="true" />
          )}
          {conferidoEm ? `Conferido ${quando(conferidoEm)}` : 'Conferir agora'}
        </Button>
      </div>
      {falha ? <span className="text-destructive">{falha}</span> : null}
    </div>
  )
}

/**
 * Confere de uma vez, na loja, todos os produtos com link, pausados inclusive.
 * O servidor tem um minuto por chamada; o que não couber fica para o próximo
 * clique, e a frase diz quantos.
 */
export function ConferirTodos() {
  const router = useRouter()
  const [ocupado, iniciar] = useTransition()
  const [frase, setFrase] = useState<string | null>(null)

  function rodar() {
    setFrase(null)
    iniciar(async () => {
      const r = await conferirTodosNoFornecedor()
      if (!r.ok) return setFrase(r.erro)
      const { conferidos, esgotados, restantes } = r.dados
      setFrase(
        conferidos === 0 && restantes === 0
          ? 'Tudo já tinha sido conferido nos últimos minutos.'
          : `${conferidos} conferidos, ${esgotados} esgotados na loja.` +
              (restantes ? ` Faltaram ${restantes}: clique de novo para continuar.` : ''),
      )
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" disabled={ocupado} onClick={rodar}>
        {ocupado ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCw aria-hidden="true" />
        )}
        {ocupado ? 'Conferindo na loja…' : 'Conferir todos na loja'}
      </Button>
      {frase ? (
        <span className="text-muted-foreground max-w-72 text-right text-xs" role="status">
          {frase}
        </span>
      ) : null}
    </div>
  )
}
