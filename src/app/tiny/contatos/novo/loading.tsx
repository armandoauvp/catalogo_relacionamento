import { EsqueletoDeCabecalho } from '@/components/esqueletos'
import { Skeleton } from '@/components/ui/skeleton'

export default function Carregando() {
  return (
    <>
      <Skeleton className="mb-4 h-5 w-36" />
      <EsqueletoDeCabecalho />
      {/* O formulário: quatro linhas de campos, a nota e os botões. */}
      <Skeleton className="h-[420px] rounded-lg" />
    </>
  )
}
