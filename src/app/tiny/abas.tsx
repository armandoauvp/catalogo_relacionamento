'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { usePathname, useSearchParams } from 'next/navigation'
import { LinkDeFiltro } from '@/components/filtro-sem-piscar'
import {
  CONTA_PADRAO,
  CONTAS_TINY,
  ehContaTiny,
  NOME_DA_CONTA,
  type ContaTiny,
} from '@/lib/tiny/contas'
import { cn } from '@/lib/utils'

/**
 * As telas do Tiny, lado a lado. Ficam no layout para não piscar ao trocar de
 * aba: só o conteúdo abaixo delas é trocado.
 */
const ABAS: { href: Route; rotulo: string; tambem?: string[] }[] = [
  { href: '/tiny', rotulo: 'Fila', tambem: ['/tiny/lotes'] },
  { href: '/tiny/pedidos', rotulo: 'Pedidos no Tiny' },
  { href: '/tiny/estoque', rotulo: 'Estoque' },
  { href: '/tiny/nova-venda', rotulo: 'Nova venda' },
  { href: '/tiny/contatos', rotulo: 'Contatos' },
  { href: '/tiny/historico', rotulo: 'Histórico' },
  { href: '/tiny/importar', rotulo: 'Importar lote' },
]

/**
 * Telas que leem ou gravam numa conta só. A Fila e o Histórico mostram as três
 * juntas, e o detalhe de um pedido já é de uma conta.
 */
const TELAS_DA_CONTA = [
  '/tiny/pedidos',
  '/tiny/estoque',
  '/tiny/contatos',
  '/tiny/nova-venda',
  '/tiny/importar',
]

/** Onde a conta precisa ser escolhida, e não suposta: o que sai daqui vira pedido. */
const TELAS_QUE_ENVIAM = ['/tiny/nova-venda', '/tiny/importar']

const detalhe = /^\/tiny\/(pedidos|estoque|contatos)\/(?!novo$|importar$)[^/]+$/

export function AbasDoTiny({ ligadas }: { ligadas: ContaTiny[] }) {
  const caminho = usePathname()
  const params = useSearchParams()
  const daUrl = params.get('conta')
  const conta = ehContaTiny(daUrl) ? daUrl : null

  const ativa = (aba: (typeof ABAS)[number]) =>
    aba.href === '/tiny'
      ? caminho === '/tiny' || (aba.tambem ?? []).some((p) => caminho.startsWith(p))
      : caminho === aba.href || caminho.startsWith(`${aba.href}/`)

  const envia = TELAS_QUE_ENVIAM.includes(caminho)
  // Onde se envia sem conta escolhida, a página já mostra os cartões da escolha.
  const mostraConta =
    TELAS_DA_CONTA.some((t) => caminho === t || caminho.startsWith(`${t}/`)) &&
    !detalhe.test(caminho) &&
    !(envia && !conta)
  // Onde só se lê, sem escolha vale a Consultoria.
  const selecionada = conta ?? CONTA_PADRAO

  const hrefDaConta = (c: ContaTiny) => {
    const novos = new URLSearchParams(params)
    novos.set('conta', c)
    // A página e o item aberto são da conta anterior.
    novos.delete('pagina')
    return `${caminho}?${novos.toString()}` as Route
  }

  return (
    <div className="mb-8 space-y-4">
      <nav aria-label="Telas do Tiny" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex min-w-max gap-1 border-b">
          {ABAS.map((aba) => {
            const atual = ativa(aba)
            return (
              <li key={aba.href}>
                <Link
                  href={(conta ? `${aba.href}?conta=${conta}` : aba.href) as Route}
                  aria-current={atual ? 'page' : undefined}
                  className={cn(
                    'font-display -mb-px block border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors',
                    atual
                      ? 'border-foreground text-foreground'
                      : 'text-muted-foreground hover:text-foreground border-transparent',
                  )}
                >
                  {aba.rotulo}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {mostraConta ? (
        <div className="flex flex-wrap items-center gap-2" data-tour="conta-do-tiny">
          <span className="text-muted-foreground text-sm">Tiny:</span>
          <ul className="flex flex-wrap gap-1.5" aria-label="Conta do Tiny">
            {CONTAS_TINY.map((c) => {
              const atual = selecionada === c
              const ligada = ligadas.includes(c)
              return (
                <li key={c}>
                  <LinkDeFiltro
                    href={hrefDaConta(c)}
                    aria-current={atual ? 'true' : undefined}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
                      atual
                        ? 'border-foreground bg-foreground text-background'
                        : 'text-muted-foreground hover:text-foreground hover:border-foreground/40',
                    )}
                  >
                    {NOME_DA_CONTA[c]}
                    {ligada ? null : <span className="text-xs opacity-70">· sem token</span>}
                  </LinkDeFiltro>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
