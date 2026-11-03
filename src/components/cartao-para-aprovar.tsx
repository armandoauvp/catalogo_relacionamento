import type { Route } from 'next'
import { ArrowRight } from 'lucide-react'
import { LinkDeFiltro } from '@/components/filtro-sem-piscar'
import { Stat } from '@/components/stat'
import { cn } from '@/lib/utils'

/**
 * O que está esperando o OK do Admin, com o caminho até lá.
 *
 * Existe porque aprovar é o passo do qual todo o resto depende, e nada na tela
 * dizia isso: "como eu aprovo?" foi a primeira pergunta de quem usou. O cartão
 * leva à gestão já recortada, e lá se aprova um a um ou em lote.
 */
export function CartaoParaAprovar({ quantidade }: { quantidade: number }) {
  return (
    <LinkDeFiltro
      href={'/admin/solicitacoes?fila=aprovar' as Route}
      className="group focus-visible:ring-ring rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      data-tour="para-aprovar"
    >
      <Stat
        rotulo="Para aprovar"
        valor={quantidade}
        className={cn(
          'h-full transition-colors duration-200',
          quantidade > 0 ? 'border-primary group-hover:bg-muted/40' : 'group-hover:bg-muted/40',
        )}
        apoio={
          <span className="inline-flex items-center gap-1">
            {quantidade === 0 ? 'Nada esperando o seu OK.' : 'Esperando o seu OK. Abrir a lista'}
            {quantidade > 0 ? (
              <ArrowRight
                className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            ) : null}
          </span>
        }
      />
    </LinkDeFiltro>
  )
}
