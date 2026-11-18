import { Skeleton } from '@/components/ui/skeleton'

/**
 * Esqueletos das telas, usados pelos `loading.tsx`.
 *
 * A regra que vale para todos: **mesmas medidas do conteúdo real**. Um
 * esqueleto mais baixo que a tabela que ele antecede produz exatamente o salto
 * que ele deveria evitar, e um mais alto também, porque o rodapé sobe quando
 * o conteúdo chega.
 *
 * A quantidade de linhas é a única medida que não dá para acertar sempre: ela
 * depende de quantos registros a consulta devolve. Por isso cada `loading.tsx`
 * passa o número que corresponde ao tamanho típico da sua lista, o catálogo
 * tem dezenas de produtos, a lista de usuários tem o time, em vez de todos
 * usarem o mesmo padrão. Errar esse número é a única fonte de deslocamento que
 * sobra, e ela cresce com a diferença: um esqueleto de 5 linhas antes de uma
 * tabela de 13 move o rodapé meia tela.
 */

export function EsqueletoDeCabecalho({
  comAcoes = false,
  acoes = 1,
  comSobrancelha = false,
}: {
  comAcoes?: boolean
  /** Só as telas de detalhe têm a linha de dado acima do título. */
  comSobrancelha?: boolean
  /** Quantos botões a tela põe no cabeçalho, dois reservam mais largura. */
  acoes?: number
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {comSobrancelha ? <Skeleton className="mb-2 h-3 w-24" /> : null}
        {/* h-9 = altura do <h1> em text-3xl */}
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      {comAcoes ? (
        <div className="flex gap-2">
          {Array.from({ length: acoes }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-40" />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function EsqueletoDeStats({ quantidade = 3 }: { quantidade?: number }) {
  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: quantidade }).map((_, i) => (
        // h-[132px] = padding do cartão + rótulo + número + linha de apoio
        <Skeleton key={i} className="h-[132px] rounded-lg" />
      ))}
    </div>
  )
}

export function EsqueletoDeTabela({ linhas = 6 }: { linhas?: number }) {
  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      <div className="bg-muted/40 h-11 border-b" />
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3.5 last:border-0">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-32 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function EsqueletoDeCatalogo({ cards = 8 }: { cards?: number }) {
  return (
    <>
      <div className="bg-card mb-4 flex flex-wrap items-center gap-2 rounded-lg border p-3">
        <Skeleton className="h-10 w-full max-w-xs flex-1" />
        <Skeleton className="h-10 w-24" />
      </div>

      <div className="mb-6 flex gap-2 overflow-hidden pb-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[52px] w-36 shrink-0 rounded-xl" />
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="bg-card overflow-hidden rounded-2xl border">
            {/* Mesma proporção da foto: a troca não muda a altura do card. */}
            <Skeleton className="aspect-3/4 rounded-none" />
            {/* Os selos ficam sobre a foto; aqui começa pelo nome. */}
            <div className="space-y-2 p-4">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="mt-3 h-6 w-24" />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

/**
 * Cartões de pedido da expedição.
 *
 * Altura fixa por cartão porque a coluna do endereço tem sempre as mesmas cinco
 * linhas: é o dado de envio, não texto livre.
 */
export function EsqueletoDePedidos({ cards = 1 }: { cards?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: cards }).map((_, i) => (
        // h-[421px] = cabeçalho do cartão + itens + o endereço (sempre as
        // mesmas cinco linhas, por ser dado de envio) + o campo de rastreio.
        <Skeleton key={i} className="h-[421px] rounded-lg" />
      ))}
    </div>
  )
}

/**
 * Detalhe de uma solicitação.
 *
 * As alturas são as do conteúdo real medido: itens, carta e histórico à
 * esquerda; rastreio, cliente e entrega à direita, mais o que a tela do Admin
 * acrescenta. Variam com o número de itens e o tamanho da carta, é o resíduo
 * conhecido desta tela, e ele é pequeno porque as três medidas maiores
 * (endereço, cliente, rastreio) são campos fixos.
 */
export function EsqueletoDeDetalhe({ acoes = false }: { acoes?: boolean }) {
  const esquerda = [212, 173, 252]
  const direita = acoes ? [187, 154, 223, 227] : [187, 154, 223]

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {esquerda.map((altura) => (
          <Skeleton key={altura} className="rounded-lg" style={{ height: altura }} />
        ))}
      </div>
      <div className="space-y-6">
        {direita.map((altura) => (
          <Skeleton key={altura} className="rounded-lg" style={{ height: altura }} />
        ))}
      </div>
    </div>
  )
}

/**
 * Fila de compras por fornecedor: o resumo das lojas e a lista de cada uma.
 *
 * Medidas da tela real (cartão do resumo 106 px, cabeçalho da loja 48 px,
 * "selecionar tudo" 37 px, item 63 px). Duas lojas já passam da dobra, e é
 * isso que importa: o rodapé começa fora da tela e não salta quando a fila,
 * que costuma ser mais longa, chega.
 */
export function EsqueletoDeFornecedores({
  lojas = 2,
  itens = 3,
}: {
  lojas?: number
  itens?: number
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[106px] rounded-lg" />
        ))}
      </div>
      {Array.from({ length: lojas }).map((_, i) => (
        <div key={i}>
          <div className="mb-3 flex h-12 items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
            <Skeleton className="h-9 w-36" />
          </div>
          <div className="bg-card divide-y overflow-hidden rounded-lg border">
            <div className="bg-muted/40 h-[37px]" />
            {Array.from({ length: itens }).map((_, j) => (
              <div key={j} className="flex h-[63px] items-center gap-4 px-4">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
