'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * As telas do Tiny, lado a lado. Ficam no layout para não piscar ao trocar de
 * aba: só o conteúdo abaixo delas é trocado.
 */
const ABAS: { href: Route; rotulo: string; tambem?: string[] }[] = [
  { href: '/tiny', rotulo: 'Fila', tambem: ['/tiny/lotes'] },
  { href: '/tiny/pedidos', rotulo: 'Pedidos no Tiny' },
  { href: '/tiny/estoque', rotulo: 'Estoque' },
  { href: '/tiny/nova-venda', rotulo: 'Nova venda' },
  { href: '/tiny/importar', rotulo: 'Importar lote' },
]

export function AbasDoTiny() {
  const caminho = usePathname()
  const ativa = (aba: (typeof ABAS)[number]) =>
    aba.href === '/tiny'
      ? caminho === '/tiny' || (aba.tambem ?? []).some((p) => caminho.startsWith(p))
      : caminho === aba.href || caminho.startsWith(`${aba.href}/`)

  return (
    <nav aria-label="Telas do Tiny" className="-mx-4 mb-8 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1 border-b">
        {ABAS.map((aba) => {
          const atual = ativa(aba)
          return (
            <li key={aba.href}>
              <Link
                href={aba.href}
                aria-current={atual ? 'page' : undefined}
                className={cn(
                  'font-display -mb-px block border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors',
                  atual
                    ? 'border-foreground text-foreground'
                    : 'text-muted-foreground hover:text-foreground border-transparent',
                )}
              >
                {aba.rotulo}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
