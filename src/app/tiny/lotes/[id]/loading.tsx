import { EsqueletoDeCabecalho, EsqueletoDeTabela } from '@/components/esqueletos'
import { Skeleton } from '@/components/ui/skeleton'

export default function Carregando() {
  return (
    <>
      <Skeleton className="mb-4 h-5 w-14" />
      <EsqueletoDeCabecalho comAcoes comSobrancelha acoes={2} />
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[142px] rounded-lg" />
        ))}
      </div>
      <EsqueletoDeTabela linhas={8} />
    </>
  )
}
