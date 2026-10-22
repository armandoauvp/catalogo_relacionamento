import { EsqueletoDeCabecalho, EsqueletoDeTabela } from '@/components/esqueletos'
import { Skeleton } from '@/components/ui/skeleton'

export default function Carregando() {
  return (
    <>
      <EsqueletoDeCabecalho comAcoes acoes={3} />
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[142px] rounded-lg" />
        ))}
      </div>
      <Skeleton className="mb-3 h-6 w-40" />
      <div className="mb-8">
        <EsqueletoDeTabela linhas={3} />
      </div>
      <Skeleton className="mb-3 h-6 w-28" />
      <EsqueletoDeTabela linhas={6} />
    </>
  )
}
