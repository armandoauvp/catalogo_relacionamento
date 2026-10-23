import { EsqueletoDeCabecalho, EsqueletoDeTabela } from '@/components/esqueletos'
import { Skeleton } from '@/components/ui/skeleton'

export default function Carregando() {
  return (
    <>
      <EsqueletoDeCabecalho />
      <Skeleton className="mb-6 h-[66px] rounded-lg" />
      {/* Uma página tem 50; a primeira tela mostra a parte de cima. */}
      <EsqueletoDeTabela linhas={13} />
    </>
  )
}
