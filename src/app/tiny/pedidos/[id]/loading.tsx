import { EsqueletoDeCabecalho } from '@/components/esqueletos'
import { Skeleton } from '@/components/ui/skeleton'

export default function Carregando() {
  return (
    <>
      {/* O link de voltar: text-sm com ícone de 16 px. */}
      <Skeleton className="mb-4 h-5 w-36" />
      <EsqueletoDeCabecalho comSobrancelha />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-[290px] rounded-lg" />
        </div>
        <div className="space-y-6">
          {[190, 120, 210].map((altura) => (
            <Skeleton key={altura} className="rounded-lg" style={{ height: altura }} />
          ))}
        </div>
      </div>
    </>
  )
}
