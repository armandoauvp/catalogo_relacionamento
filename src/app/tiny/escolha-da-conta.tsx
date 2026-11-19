import type { Route } from 'next'
import { ArrowRight } from 'lucide-react'
import { LinkDeFiltro } from '@/components/filtro-sem-piscar'
import { contasLigadas } from '@/lib/env'
import { CONTAS_TINY, NOME_DA_CONTA, VARIAVEL_DO_TOKEN } from '@/lib/tiny/contas'

/**
 * O primeiro passo de quem vai mandar pedido: para qual Tiny. Não há conta
 * suposta aqui, porque o lote que foi para a Consultoria sem ninguém escolher
 * foi o que motivou as três contas.
 */
export function EscolhaDaConta({
  caminho,
  params = {},
  oQue,
}: {
  caminho: '/tiny/importar' | '/tiny/nova-venda'
  /** O que a URL já trazia, como os clientes escolhidos na base. */
  params?: Record<string, string | undefined>
  oQue: string
}) {
  const ligadas = contasLigadas()
  const href = (conta: string) => {
    const q = new URLSearchParams()
    for (const [chave, valor] of Object.entries(params)) if (valor) q.set(chave, valor)
    q.set('conta', conta)
    return `${caminho}?${q.toString()}` as Route
  }

  return (
    <section className="bg-card rounded-lg border p-5" aria-labelledby="escolha-da-conta">
      <h2 id="escolha-da-conta" className="font-display text-lg font-semibold">
        Para qual Tiny {oQue}?
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Cada empresa tem a sua conta, com produtos e SKUs próprios. Os pedidos vão para a conta
        escolhida aqui.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {CONTAS_TINY.map((conta) => {
          const ligada = ligadas.includes(conta)
          return (
            <li key={conta}>
              {ligada ? (
                <LinkDeFiltro
                  href={href(conta)}
                  className="hover:border-foreground/40 group flex h-full items-center justify-between gap-3 rounded-lg border p-4 transition-colors"
                >
                  <span className="font-display font-semibold">{NOME_DA_CONTA[conta]}</span>
                  <ArrowRight
                    className="text-muted-foreground group-hover:text-foreground size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </LinkDeFiltro>
              ) : (
                <div className="text-muted-foreground flex h-full flex-col gap-1 rounded-lg border border-dashed p-4">
                  <span className="font-display font-semibold">{NOME_DA_CONTA[conta]}</span>
                  <span className="text-xs">
                    Sem token: falta <code>{VARIAVEL_DO_TOKEN[conta]}</code> na Vercel.
                  </span>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
