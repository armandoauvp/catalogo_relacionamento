import type { Route } from 'next'
import type { LinhaDeVolume } from '@/lib/logistica/demandas'
import { formatarBRL, paraNumero } from '@/lib/money'
import { LinkDeFiltro } from '@/components/filtro-sem-piscar'
import { Button } from '@/components/ui/button'
import { TituloDoBloco } from './pecas'

export type Medida = 'quantidade' | 'valor'

const porcento = (n: number) =>
  `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

/**
 * "Volume de Pedidos por Departamento" (relatório, item 2), em quantidade ou
 * em custo: a Logística quer saber "quanto a gente está gastando de envio por
 * empresa ou por departamento".
 *
 * Barras horizontais em vez da rosca do protótipo: comparar fatias é
 * adivinhação, comprimento de barra se lê. Cada barra traz o número na ponta,
 * então a tabela separada deixou de ser necessária, e o valor nunca depende
 * de cor nem de hover. Uma cor só, porque o que se compara é tamanho.
 *
 * Em valor, demanda sem custo informado não entra na soma; a ponta da barra
 * diz quantas faltam, para um departamento com metade dos custos em branco
 * não parecer barato.
 */
export function VolumePorDepartamento({
  linhas,
  total,
  medida,
  queryDoPeriodo,
}: {
  linhas: LinhaDeVolume[]
  total: number
  medida: Medida
  /** Para a troca de medida manter o período na URL. */
  queryDoPeriodo: string
}) {
  const valorDe = (l: LinhaDeVolume) => (medida === 'valor' ? paraNumero(l.custo) : l.quantidade)
  const maior = Math.max(0.01, ...linhas.map(valorDe))

  // Grupos na ordem do maior total, e departamentos na ordem da medida.
  const grupos = new Map<string, { total: number; linhas: LinhaDeVolume[] }>()
  for (const l of [...linhas].sort((a, b) => valorDe(b) - valorDe(a))) {
    const g = grupos.get(l.subsidiaria) ?? { total: 0, linhas: [] }
    g.total += valorDe(l)
    g.linhas.push(l)
    grupos.set(l.subsidiaria, g)
  }
  const ordenados = [...grupos.entries()].sort((a, b) => b[1].total - a[1].total)

  const href = (m: Medida) =>
    `/logistica?${queryDoPeriodo}${m === 'valor' ? '&ver=valor' : ''}` as Route

  return (
    <section aria-labelledby="volume-por-departamento" className="bg-card rounded-lg border p-5">
      <div id="volume-por-departamento">
        <TituloDoBloco
          titulo="Volume de Pedidos por Departamento"
          apoio={`${total} ${total === 1 ? 'pedido' : 'pedidos'} no período, por subsidiária e departamento.`}
          acoes={
            <nav aria-label="Medida do gráfico" className="bg-muted flex rounded-md p-0.5">
              {(['quantidade', 'valor'] as const).map((m) => (
                <Button key={m} size="sm" variant={medida === m ? 'secondary' : 'ghost'} asChild>
                  <LinkDeFiltro href={href(m)} aria-current={medida === m ? 'true' : undefined}>
                    {m === 'quantidade' ? 'Quantidade' : 'Custo'}
                  </LinkDeFiltro>
                </Button>
              ))}
            </nav>
          }
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
                <span className="tabular-nums">
                  {medida === 'valor' ? formatarBRL(grupo.total) : grupo.total}
                </span>
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
                        style={{ width: `${(valorDe(l) / maior) * 100}%` }}
                      />
                    </span>
                    <span className="text-right tabular-nums">
                      {medida === 'valor' ? (
                        <>
                          <span className="font-semibold">{formatarBRL(l.custo)}</span>
                          {l.semCusto ? (
                            <span className="text-muted-foreground ml-2 text-xs">
                              {l.semCusto} sem custo
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <span className="font-semibold">{l.quantidade}</span>
                          <span className="text-muted-foreground ml-2 inline-block w-14">
                            {porcento(l.percentual)}
                          </span>
                        </>
                      )}
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
