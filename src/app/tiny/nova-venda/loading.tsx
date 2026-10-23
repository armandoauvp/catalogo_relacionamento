import { EsqueletoDeCabecalho } from '@/components/esqueletos'
import { Skeleton } from '@/components/ui/skeleton'

export default function Carregando() {
  return (
    <>
      <EsqueletoDeCabecalho />
      <div className="space-y-6">
        {[392, 162, 268].map((altura) => (
          <Skeleton key={altura} className="rounded-lg" style={{ height: altura }} />
        ))}
      </div>
    </>
  )
}
