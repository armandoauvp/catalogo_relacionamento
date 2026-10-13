import { Skeleton } from '@/components/ui/skeleton'
import { EsqueletoDeCabecalho } from '@/components/esqueletos'

/**
 * Esqueleto do Dashboard Logístico, nas medidas do conteúdo real, medidas no
 * navegador em 1280 px e em 375 px: seletor, status, números e os dois
 * gráficos. A trilha fica abaixo da dobra e não entra na conta.
 */
export default function Carregando() {
  return (
    <>
      <EsqueletoDeCabecalho />
      <Skeleton className="mb-6 h-[202px] rounded-lg sm:h-[66px]" />
      <Skeleton className="mb-6 h-[238px] rounded-lg sm:h-[122px]" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[138px] rounded-lg sm:h-[162px]" />
        ))}
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[630px] rounded-lg lg:h-[370px]" />
        <Skeleton className="h-[376px] rounded-lg lg:h-[370px]" />
      </div>
    </>
  )
}
