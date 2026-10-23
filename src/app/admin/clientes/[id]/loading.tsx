import { EsqueletoDeCabecalho, EsqueletoDeTabela } from '@/components/esqueletos'
import { Skeleton } from '@/components/ui/skeleton'

export default function Carregando() {
  return (
    <>
      <Skeleton className="mb-4 h-5 w-24" />
      <EsqueletoDeCabecalho comSobrancelha comAcoes />
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[142px] rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Skeleton className="mb-3 h-7 w-28" />
          <EsqueletoDeTabela linhas={3} />
        </div>
        <Skeleton className="h-[260px] rounded-lg" />
      </div>
    </>
  )
}
