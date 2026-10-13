import { EsqueletoDeCabecalho, EsqueletoDeStats, EsqueletoDeTabela } from '@/components/esqueletos'
import { Skeleton } from '@/components/ui/skeleton'

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
          {/* A mesma grade dos atalhos, com os cinco do Admin. */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(13.5rem,1fr))] gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[162px] rounded-lg sm:h-[182px]" />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
