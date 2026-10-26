import type { Route } from 'next'
import { X } from 'lucide-react'
import { LinkDeFiltro } from '@/components/filtro-sem-piscar'
import { cn } from '@/lib/utils'

/**
 * O grupo de uma linha da tabela (status, categoria, etiqueta...) como filtro.
 * Envolve o selo que a tela já usa, em vez de refazê-lo: o visual de cada
 * coluna continua o mesmo, e só ganha o clique.
 *
 * O endereço vem pronto de `hrefDoGrupo` (src/lib/filtro-por-grupo.ts), que
 * decide entre ligar, trocar e tirar o filtro.
 */
export function FiltroDoGrupo({
  href,
  ativo,
  rotulo,
  texto = false,
  children,
  className,
}: {
  href: string
  ativo: boolean
  /** "status Aprovado": entra no título e no nome acessível. */
  rotulo: string
  /** Valor em texto corrido (nome, cidade), e não um selo. */
  texto?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <LinkDeFiltro
      href={href as Route}
      aria-current={ativo ? 'true' : undefined}
      title={ativo ? `Tirar o filtro de ${rotulo}` : `Filtrar por ${rotulo}`}
      className={cn(
        'focus-visible:ring-ring outline-none focus-visible:ring-2',
        texto
          ? 'decoration-muted-foreground/60 rounded-sm underline-offset-4 hover:underline hover:decoration-dotted'
          : 'inline-flex rounded-full transition-opacity hover:opacity-80',
        ativo &&
          (texto
            ? 'font-semibold underline'
            : 'ring-foreground/40 ring-offset-background ring-2 ring-offset-1'),
        className,
      )}
    >
      {children}
    </LinkDeFiltro>
  )
}

export type FiltroAtivo = {
  /** O nome da coluna: "Status". */
  coluna: string
  /** Como o valor aparece na tabela: "Aprovado". */
  valor: string
  /** O endereço sem este filtro (`hrefSemFiltro`). */
  semEle: string
}

/** "Filtrando por: Status Aprovado ×": o que o clique ligou, e como desligar. */
export function FiltrosAtivos({
  filtros,
  limpar,
  className,
}: {
  filtros: readonly FiltroAtivo[]
  /** Endereço sem nenhum filtro, quando há mais de um ligado. */
  limpar?: string
  className?: string
}) {
  if (!filtros.length) return null
  return (
    <div
      className={cn('mb-3 flex flex-wrap items-center gap-2 text-sm', className)}
      aria-label="Filtros ligados"
    >
      <span className="text-muted-foreground">Filtrando por</span>
      {filtros.map((f) => (
        <LinkDeFiltro
          key={f.coluna}
          href={f.semEle as Route}
          title={`Tirar o filtro de ${f.coluna.toLowerCase()}`}
          className="bg-muted hover:bg-muted/70 focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-full py-0.5 pr-1.5 pl-2.5 text-xs outline-none focus-visible:ring-2"
        >
          <span className="text-muted-foreground">{f.coluna}</span>
          <span className="font-semibold">{f.valor}</span>
          <X className="size-3.5" aria-hidden="true" />
          <span className="sr-only">tirar</span>
        </LinkDeFiltro>
      ))}
      {limpar && filtros.length > 1 ? (
        <LinkDeFiltro
          href={limpar as Route}
          className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
        >
          Tirar todos
        </LinkDeFiltro>
      ) : null}
    </div>
  )
}
