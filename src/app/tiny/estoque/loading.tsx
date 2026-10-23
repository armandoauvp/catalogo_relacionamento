import { EsqueletoDeCabecalho, EsqueletoDeTabela } from '@/components/esqueletos'
import { Skeleton } from '@/components/ui/skeleton'

export default function Carregando() {
  return (
    <>
      <EsqueletoDeCabecalho />
      <Skeleton className="mb-6 h-[66px] rounded-lg" />
      <EsqueletoDeTabela linhas={6} />
    </>
  )
}
