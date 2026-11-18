'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Copy, ExternalLink, Loader2, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialogo } from '@/components/ui/dialogo'
import { marcarItensComprados } from '@/lib/actions/solicitacoes'
import { cn } from '@/lib/utils'

export type ItemDoFornecedor = {
  itemId: string
  solicitacaoId: string
  codigo: string
  data: string
  produto: string
  quantidade: number
  valor: string
  link: string | null
  consultor: string
  cliente: string
  /** Itens da mesma solicitação que ainda faltam em outras lojas. */
  emOutrasLojas: number
}

export type GrupoNaTela = {
  chave: string
  nome: string
  site: string | null
  solicitacoes: number
  valor: string
  itens: ItemDoFornecedor[]
}

/**
 * A fila de compras agrupada por fornecedor (pedido da Dani, do Financeiro):
 * tudo o que falta comprar de cada loja, para comprar de uma vez e juntar o
 * frete. A seleção marca item a item; a solicitação vai a "Comprado" sozinha
 * quando o último item dela é marcado.
 */
export function PorFornecedor({ grupos, opera }: { grupos: GrupoNaTela[]; opera: boolean }) {
  const router = useRouter()
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()

  const todos = useMemo(() => grupos.flatMap((g) => g.itens), [grupos])
  const escolhidos = todos.filter((i) => selecionados.has(i.itemId))

  function alternar(ids: string[], ligar: boolean) {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      for (const id of ids) {
        if (ligar) novo.add(id)
        else novo.delete(id)
      }
      return novo
    })
  }

  async function copiar(grupo: GrupoNaTela) {
    const texto = [
      `${grupo.nome}: ${grupo.itens.length} ${grupo.itens.length === 1 ? 'item' : 'itens'}`,
      ...grupo.itens.map(
        (i) => `- ${i.quantidade}x ${i.produto} (${i.codigo})${i.link ? ` ${i.link}` : ''}`,
      ),
    ].join('\n')
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(grupo.chave)
      setTimeout(() => setCopiado((c) => (c === grupo.chave ? null : c)), 2000)
    } catch {
      setErro('Não deu para copiar. Selecione a lista e copie à mão.')
    }
  }

  function marcar() {
    setErro(null)
    iniciar(async () => {
      const r = await marcarItensComprados(escolhidos.map((i) => i.itemId))
      if (!r.ok) return setErro(r.erro)
      setConfirmando(false)
      setSelecionados(new Set())
      const { itensMarcados, completas } = r.dados
      setAviso(
        `${itensMarcados} ${itensMarcados === 1 ? 'item marcado' : 'itens marcados'} como comprado.` +
          (completas.length
            ? ` ${completas.length === 1 ? 'A solicitação' : 'As solicitações'} ${completas.join(', ')} ${completas.length === 1 ? 'ficou completa e foi' : 'ficaram completas e foram'} para "Comprado".`
            : ''),
      )
      router.refresh()
    })
  }

  if (grupos.length === 0) {
    return (
      <Card className="text-muted-foreground p-8 text-center text-sm text-pretty">
        Nada falta comprar agora. Os itens aparecem aqui assim que o Relacionamento aprova uma
        solicitação sob pedido.
      </Card>
    )
  }

  return (
    <div className="space-y-6" data-tour="lista-compras">
      {/* O resumo: quantas solicitações e quanto em cada loja, antes de rolar. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {grupos.map((g) => (
          <a
            key={g.chave}
            href={`#fornecedor-${g.chave}`}
            className="bg-card hover:border-primary rounded-lg border p-4 transition-colors"
          >
            <p className="font-display truncate font-semibold">{g.nome}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {g.solicitacoes} {g.solicitacoes === 1 ? 'solicitação' : 'solicitações'} ·{' '}
              {g.itens.length} {g.itens.length === 1 ? 'item' : 'itens'}
            </p>
            <p className="mt-1 text-sm font-medium tabular-nums">{g.valor}</p>
          </a>
        ))}
      </div>

      {aviso ? (
        <p role="status" className="bg-success/10 text-foreground rounded-md px-4 py-3 text-sm">
          {aviso}
        </p>
      ) : null}

      {grupos.map((g, indice) => {
        const ids = g.itens.map((i) => i.itemId)
        const todosMarcados = ids.every((id) => selecionados.has(id))
        return (
          <section
            key={g.chave}
            id={`fornecedor-${g.chave}`}
            aria-labelledby={`titulo-${g.chave}`}
            className="scroll-mt-24"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id={`titulo-${g.chave}`} className="font-display text-lg font-semibold">
                  {g.nome}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {g.solicitacoes} {g.solicitacoes === 1 ? 'solicitação' : 'solicitações'} ·{' '}
                  {g.itens.length} {g.itens.length === 1 ? 'item' : 'itens'} · {g.valor}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {g.site ? (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={g.site} target="_blank" rel="noreferrer">
                      <ExternalLink aria-hidden="true" />
                      Abrir a loja
                    </a>
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" onClick={() => copiar(g)}>
                  {copiado === g.chave ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  {copiado === g.chave ? 'Copiada' : 'Copiar lista'}
                </Button>
              </div>
            </div>

            <Card className="divide-y overflow-hidden">
              {opera ? (
                <label
                  // O tour aponta para a seleção do primeiro fornecedor.
                  data-tour={indice === 0 ? 'passo-fila' : undefined}
                  className="bg-muted/40 flex items-center gap-3 px-4 py-2 text-sm font-medium"
                >
                  <input
                    type="checkbox"
                    className="accent-primary size-4"
                    checked={todosMarcados}
                    onChange={(e) => alternar(ids, e.target.checked)}
                  />
                  Selecionar tudo de {g.nome}
                </label>
              ) : null}
              {g.itens.map((i) => (
                <div
                  key={i.itemId}
                  className={cn(
                    'flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4',
                    selecionados.has(i.itemId) && 'bg-primary/5',
                  )}
                >
                  <div className="flex min-w-0 items-start gap-3 sm:flex-1">
                    {opera ? (
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${i.produto}, ${i.codigo}`}
                        className="accent-primary mt-1 size-4 shrink-0"
                        checked={selecionados.has(i.itemId)}
                        onChange={(e) => alternar([i.itemId], e.target.checked)}
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        <span className="tabular-nums">{i.quantidade}×</span> {i.produto}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        <Link
                          href={`/admin/solicitacoes/${i.solicitacaoId}`}
                          className="hover:text-foreground underline-offset-4 hover:underline"
                        >
                          {i.codigo}
                        </Link>{' '}
                        · {i.data} · {i.consultor} · para {i.cliente}
                        {i.emOutrasLojas > 0
                          ? ` · +${i.emOutrasLojas} ${i.emOutrasLojas === 1 ? 'item' : 'itens'} em outra loja`
                          : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 pl-7 sm:pl-0">
                    {i.link ? (
                      <a
                        href={i.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary-emphasis inline-flex items-center gap-1 text-xs font-medium hover:underline"
                      >
                        Abrir o item <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                    ) : null}
                    <span className="w-24 text-right text-sm font-medium tabular-nums">
                      {i.valor}
                    </span>
                  </div>
                </div>
              ))}
            </Card>
          </section>
        )
      })}

      {/* A barra da seleção: fixa embaixo, só com algo marcado, acima do botão
          da Caixinha, que ocupa o canto inferior direito. */}
      {opera && escolhidos.length > 0 ? (
        <div className="bg-card fixed inset-x-3 bottom-28 z-40 mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 shadow-[0_18px_40px_-18px_rgba(11,41,5,0.45)] sm:inset-x-6">
          <p className="text-sm font-medium">
            {escolhidos.length}{' '}
            {escolhidos.length === 1 ? 'item selecionado' : 'itens selecionados'}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelecionados(new Set())}>
              Limpar
            </Button>
            <Button size="sm" onClick={() => setConfirmando(true)}>
              <ShoppingCart aria-hidden="true" />
              Marcar como comprados
            </Button>
          </div>
        </div>
      ) : null}

      <Dialogo
        aberto={confirmando}
        aoFechar={() => setConfirmando(false)}
        titulo="Marcar como comprados?"
        descricao={`${escolhidos.length} ${escolhidos.length === 1 ? 'item' : 'itens'}`}
      >
        <div className="text-left whitespace-normal">
          <p className="text-sm leading-relaxed">
            Cada item fica registrado como comprado por você. A solicitação que tiver todos os itens
            comprados vai para &quot;Comprado&quot; e espera a Logística confirmar a chegada.
          </p>
          {erro ? (
            <p role="alert" className="text-destructive mt-3 text-sm">
              {erro}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmando(false)}>
              Voltar
            </Button>
            <Button disabled={salvando} onClick={marcar}>
              {salvando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Marcar como comprados
            </Button>
          </div>
        </div>
      </Dialogo>

      {erro && !confirmando ? (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      ) : null}
    </div>
  )
}
