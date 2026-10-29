import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EsqueletoDeCabecalho } from '@/components/esqueletos'

/** Um cartão por motivo, com os dois modelos que cada um costuma ter. */
export default function Carregando() {
  return (
    <>
      <EsqueletoDeCabecalho />
      <div className="space-y-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <Skeleton className="h-7 w-40" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="h-9 w-44" />
              </div>
              <div className="divide-y border-t">
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className="flex items-start justify-between gap-4 py-3">
                    <Skeleton className="h-9 flex-1" />
                    <Skeleton className="h-9 w-64" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
