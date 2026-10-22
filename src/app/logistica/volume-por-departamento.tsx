import type { LinhaDeVolume } from '@/lib/logistica/demandas'
import { TituloDoBloco } from './pecas'

const porcento = (n: number) =>
  `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

/**
 * "Volume de Pedidos por Departamento" (relatório, item 2).
 *
 * Barras horizontais em vez da rosca do protótipo: comparar fatias é
 * adivinhação, comprimento de barra se lê. Cada barra traz o número na ponta,
 * então a tabela separada deixou de ser necessária, e o valor nunca depende
 * de cor nem de hover. Uma cor só, porque o que se compara é tamanho.
 */
export function VolumePorDepartamento({
  linhas,
  total,
}: {
  linhas: LinhaDeVolume[]
  total: number
}) {
  const maior = Math.max(1, ...linhas.map((l) => l.quantidade))

  // Grupos na ordem do maior total, e departamentos na ordem da quantidade.
  const grupos = new Map<string, { total: number; linhas: LinhaDeVolume[] }>()
  for (const l of [...linhas].sort((a, b) => b.quantidade - a.quantidade)) {
    const g = grupos.get(l.subsidiaria) ?? { total: 0, linhas: [] }
    g.total += l.quantidade
    g.linhas.push(l)
    grupos.set(l.subsidiaria, g)
  }
  const ordenados = [...grupos.entries()].sort((a, b) => b[1].total - a[1].total)

  return (
    <section aria-labelledby="volume-por-departamento" className="bg-card rounded-lg border p-5">
      <div id="volume-por-departamento">
        <TituloDoBloco
          titulo="Volume de Pedidos por Departamento"
          apoio={`${total} ${total === 1 ? 'pedido' : 'pedidos'} no período, por subsidiária e departamento.`}
        />
      </div>

      {linhas.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">Nenhum pedido no período.</p>
      ) : (
        <div className="space-y-5">
          {ordenados.map(([subsidiaria, grupo]) => (
            <div key={subsidiaria}>
              <p className="text-muted-foreground font-ui mb-2 flex justify-between gap-3 text-xs font-semibold tracking-[0.08em] uppercase">
                <span>{subsidiaria}</span>
                <span className="tabular-nums">{grupo.total}</span>
              </p>
              <ul className="space-y-2.5">
                {grupo.linhas.map((l) => (
                  <li
                    key={`${l.subsidiaria}-${l.departamento}`}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(6rem,11rem)_1fr_auto]"
                  >
                    <span className="col-span-2 truncate sm:col-span-1" title={l.departamento}>
                      {l.departamento}
                    </span>
                    {/* Barra de no máximo 12px de espessura, ponta arredondada e
                        base reta, crescendo de uma linha de base comum. */}
                    <span className="relative h-3" aria-hidden="true">
                      <span
                        className="bg-serie absolute inset-y-0 left-0 rounded-r-[4px]"
                        style={{ width: `${(l.quantidade / maior) * 100}%` }}
                      />
                    </span>
                    <span className="text-right tabular-nums">
                      <span className="font-semibold">{l.quantidade}</span>
                      <span className="text-muted-foreground ml-2 inline-block w-14">
                        {porcento(l.percentual)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
