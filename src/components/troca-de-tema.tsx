'use client'

import { Moon, Sun } from 'lucide-react'
import { escolherTema } from '@/lib/tema'
import { cn } from '@/lib/utils'

/**
 * Botão de claro/escuro do menu superior. O ícone troca por CSS (`dark:`), e
 * não por estado: o servidor não sabe o tema, e o que ele desenha precisa
 * bater com a hidratação.
 */
export function TrocaDeTema({ className }: { className?: string }) {
  return (
    <button
      type="button"
      aria-label="Trocar entre tema claro e escuro"
      title="Trocar entre claro e escuro"
      onClick={() =>
        escolherTema(document.documentElement.classList.contains('dark') ? 'claro' : 'escuro')
      }
      className={cn(
        'hover:bg-muted text-muted-foreground hover:text-foreground focus-visible:ring-ring grid size-9 place-items-center rounded-xl transition-colors outline-none focus-visible:ring-2',
        className,
      )}
    >
      <Moon className="size-[18px] dark:hidden" aria-hidden="true" />
      <Sun className="hidden size-[18px] dark:block" aria-hidden="true" />
    </button>
  )
}
