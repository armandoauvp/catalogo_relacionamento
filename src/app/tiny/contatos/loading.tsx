import { EsqueletoDeCabecalho, EsqueletoDeTabela } from '@/components/esqueletos'
import { Skeleton } from '@/components/ui/skeleton'

export default function Carregando() {
  return (
    <>
      <EsqueletoDeCabecalho comAcoes acoes={2} />
      <Skeleton className="mb-6 h-[66px] rounded-lg" />
      <Skeleton className="mb-3 h-7 w-48" />
      <EsqueletoDeTabela linhas={8} />
    </>
  )
}
