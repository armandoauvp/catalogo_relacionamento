import { EsqueletoDeCabecalho } from '@/components/esqueletos'
import { Skeleton } from '@/components/ui/skeleton'

export default function Carregando() {
  return (
    <>
      <Skeleton className="mb-4 h-5 w-36" />
      <EsqueletoDeCabecalho />
      {/* A caixa da planilha antes de escolher o arquivo, e o botão. */}
      <Skeleton className="h-[146px] rounded-lg" />
      <Skeleton className="mt-6 h-12 w-56 rounded-md" />
    </>
  )
}
