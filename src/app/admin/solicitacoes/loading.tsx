import { EsqueletoDeCabecalho, EsqueletoDeTabela } from '@/components/esqueletos'
import { Skeleton } from '@/components/ui/skeleton'

export default function Carregando() {
  return (
    <>
      <EsqueletoDeCabecalho comAcoes acoes={2} />
      {/* Os quatro cartões do Admin, com o "Para aprovar". */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[150px] rounded-lg" />
        ))}
      </div>
      <div className="bg-card mb-6 flex flex-wrap items-center gap-2 rounded-lg border p-3">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-48" />
      </div>
      {/* A gestão lista o mês inteiro: oito linhas é o tamanho típico, e é o
          que mantém o rodapé do mesmo lado da dobra antes e depois. */}
      <EsqueletoDeTabela linhas={8} />
    </>
  )
}
