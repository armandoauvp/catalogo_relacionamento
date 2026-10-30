'use client'

import { useTransition } from 'react'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { ArrowDownUp } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { ORDENS_DA_TRILHA, ROTULO_DA_ORDEM, type OrdemDaTrilha } from '@/lib/logistica/demandas'

/**
 * Em que ordem a trilha aparece (relatório de 29/10, item 2).
 *
 * Trocar a ordem é mudar a mesma tela, então a navegação vai numa transição,
 * como `LinkDeFiltro`: a trilha atual fica até a nova chegar, sem esqueleto.
 */
export function SeletorDeOrdem({
  atual,
  hrefs,
}: {
  atual: OrdemDaTrilha
  hrefs: Record<OrdemDaTrilha, string>
}) {
  const router = useRouter()
  const [, iniciar] = useTransition()

  return (
    <label className="text-muted-foreground flex items-center gap-2 text-sm">
      <ArrowDownUp className="size-4" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">Ordenar por</span>
      <Select
        value={atual}
        onChange={(e) => {
          const href = hrefs[e.target.value as OrdemDaTrilha] as Route
          iniciar(() => router.push(href, { scroll: false }))
        }}
        className="text-foreground h-9 w-auto"
      >
        {ORDENS_DA_TRILHA.map((o) => (
          <option key={o} value={o}>
            {ROTULO_DA_ORDEM[o]}
          </option>
        ))}
      </Select>
    </label>
  )
}
