import { EsqueletoDeCabecalho } from '@/components/esqueletos'
import { Skeleton } from '@/components/ui/skeleton'

export default function Carregando() {
  return (
    <>
      <Skeleton className="mb-4 h-5 w-36" />
      <EsqueletoDeCabecalho comSobrancelha />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[142px] rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-[196px] rounded-lg" />
        </div>
        <Skeleton className="h-[150px] rounded-lg" />
      </div>
    </>
  )
}
