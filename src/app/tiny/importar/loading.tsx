import { EsqueletoDeCabecalho } from '@/components/esqueletos'
import { Skeleton } from '@/components/ui/skeleton'

export default function Carregando() {
  return (
    <>
      <Skeleton className="mb-4 h-5 w-14" />
      <EsqueletoDeCabecalho />
      <div className="space-y-6">
        <Skeleton className="h-[170px] rounded-lg" />
        <Skeleton className="h-[150px] rounded-lg" />
        <Skeleton className="h-[290px] rounded-lg" />
      </div>
    </>
  )
}
