import { Skeleton } from '@/components/ui/skeleton'
import { EsqueletoDeCabecalho } from '@/components/esqueletos'
import { cn } from '@/lib/utils'

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
        {/* No celular só o primeiro tem duas linhas de apoio. */}
        {[154, 130, 130].map((altura, i) => (
          <Skeleton
            key={i}
            className={cn('rounded-lg sm:h-[162px]', altura === 154 ? 'h-[154px]' : 'h-[130px]')}
          />
        ))}
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[630px] rounded-lg lg:h-[356px]" />
        <Skeleton className="h-[376px] rounded-lg lg:h-[356px]" />
      </div>
    </>
  )
}
