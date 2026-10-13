import { EsqueletoDeCabecalho, EsqueletoDeStats, EsqueletoDeTabela } from '@/components/esqueletos'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// Os cinco atalhos do Admin, em 3 + 2: o caso mais comum de quem abre o início.
const ATALHOS = [
  'lg:col-span-2',
  'lg:col-span-2',
  'lg:col-span-2',
  'lg:col-span-3',
  'lg:col-span-3',
]

export default function Carregando() {
  return (
    <>
      <EsqueletoDeCabecalho />
      <EsqueletoDeStats />
      <div className="space-y-10">
        <div>
          <Skeleton className="mb-3 h-3 w-40" />
          <EsqueletoDeTabela linhas={5} />
        </div>
        <div>
          <Skeleton className="mb-3 h-3 w-20" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {ATALHOS.map((largura, i) => (
              <Skeleton key={i} className={cn('h-[112px] rounded-lg lg:h-[92px]', largura)} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
