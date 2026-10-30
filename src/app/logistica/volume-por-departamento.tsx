import type { Route } from 'next'
import type { LinhaDeVolume } from '@/lib/logistica/demandas'
import { LinkDeFiltro } from '@/components/filtro-sem-piscar'
import { Button } from '@/components/ui/button'
import { TituloDoBloco } from './pecas'

const porcento = (n: number) =>
  `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
const numero = (n: number) => n.toLocaleString('pt-BR')

export type VistaDoVolume = 'pedidos' | 'despachados'

const TEXTO: Record<
  VistaDoVolume,
  { titulo: string; apoio: (total: number) => string; vazio: string }
> = {
  pedidos: {
    titulo: 'Volume de Pedidos por Departamento',
    apoio: (t) =>
      `${numero(t)} ${t === 1 ? 'pedido' : 'pedidos'} no período, por subsidiária e departamento.`,
    vazio: 'Nenhum pedido no período.',
  },
  despachados: {
    titulo: 'Itens Despachados por Departamento',
    apoio: (t) =>
      `${numero(t)} ${t === 1 ? 'item despachado' : 'itens despachados'} no período, lançados nas tarefas, por subsidiária e departamento.`,
    vazio: 'Nenhum envio lançado nas tarefas no período.',
  },
}

/**
 * "Volume de Pedidos por Departamento" (relatório, item 2), e o mesmo recorte
 * para os itens despachados (relatório de 29/10): quantas demandas chegaram e
 * quanto saiu, pela data de cada lançamento. As duas vistas dividem o cartão,
 * e a escolha mora na URL, para o fechamento do mês poder ser compartilhado
 * por link.
 *
 * Barras horizontais em vez da rosca do protótipo: comparar fatias é
 * adivinhação, comprimento de barra se lê. Cada barra traz o número na ponta,
 * então a tabela separada deixou de ser necessária, e o valor nunca depende
 * de cor nem de hover. Uma cor só, porque o que se compara é tamanho.
 */
export function VolumePorDepartamento({
  linhas,
  total,
  vista,
  hrefs,
}: {
  linhas: LinhaDeVolume[]
  total: number
  vista: VistaDoVolume
  hrefs: Record<VistaDoVolume, string>
}) {
  const maior = Math.max(1, ...linhas.map((l) => l.quantidade))
  const texto = TEXTO[vista]

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
          titulo={texto.titulo}
          apoio={texto.apoio(total)}
          acoes={
            <nav aria-label="O que contar" className="bg-muted flex rounded-md p-0.5">
              {(['pedidos', 'despachados'] as const).map((v) => (
                <Button key={v} size="sm" variant={vista === v ? 'secondary' : 'ghost'} asChild>
                  <LinkDeFiltro
                    href={hrefs[v] as Route}
                    scroll={false}
                    aria-current={vista === v ? 'true' : undefined}
                  >
                    {v === 'pedidos' ? 'Pedidos' : 'Despachados'}
                  </LinkDeFiltro>
                </Button>
              ))}
            </nav>
          }
        />
      </div>

      {linhas.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">{texto.vazio}</p>
      ) : (
        <div className="space-y-5">
          {ordenados.map(([subsidiaria, grupo]) => (
            <div key={subsidiaria}>
              <p className="text-muted-foreground font-ui mb-2 flex justify-between gap-3 text-xs font-semibold tracking-[0.08em] uppercase">
                <span>{subsidiaria}</span>
                <span className="tabular-nums">{numero(grupo.total)}</span>
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
                      <span className="font-semibold">{numero(l.quantidade)}</span>
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
