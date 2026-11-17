'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, ChevronDown, Search, X } from 'lucide-react'
import { Caixinha } from '@/components/marca/caixinha'
import { EVENTO_ABRIR_TOUR } from '@/components/tour'
import type { ItemDaFaq } from '@/lib/assistente/faq'
import { buscarNaFaq } from '@/lib/assistente/busca'
import { cn } from '@/lib/utils'

/**
 * A Caixinha: o botão fixo no canto da tela e o painel de perguntas.
 *
 * Recebe só as perguntas do perfil, já filtradas no servidor (`faqDoPerfil`).
 * Camada 55: acima do menu (z-50), para o painel não ficar embaixo dele em
 * janela baixa, e abaixo do tour (z-60), que precisa cobrir tudo. A altura
 * cabe na tela que sobra acima do botão.
 *
 * Tudo é `position: fixed`, que não empurra nada: abrir e fechar não causa
 * layout shift. Nada é guardado; a busca roda no navegador.
 */
export function Assistente({ itens }: { itens: ItemDaFaq[] }) {
  const [aberto, setAberto] = useState(false)
  const [termo, setTermo] = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)
  const campo = useRef<HTMLInputElement>(null)
  const botao = useRef<HTMLButtonElement>(null)
  const idPainel = useId()

  const resultados = useMemo(() => buscarNaFaq(itens, termo), [itens, termo])
  const sugestoes = termo.trim() === ''

  useEffect(() => {
    if (aberto) campo.current?.focus()
  }, [aberto])

  // Esc fecha e devolve o foco ao botão, como num menu.
  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAberto(false)
        botao.current?.focus()
      }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aberto])

  function abrirTour() {
    setAberto(false)
    window.dispatchEvent(new Event(EVENTO_ABRIR_TOUR))
  }

  return (
    <>
      {aberto ? (
        <section
          id={idPainel}
          role="dialog"
          aria-label="Caixinha, perguntas sobre a plataforma"
          className="bg-card text-card-foreground fixed inset-x-3 bottom-24 z-[55] flex max-h-[min(70vh,calc(100dvh-7rem))] flex-col overflow-hidden rounded-lg border shadow-[0_24px_60px_-24px_rgba(11,41,5,0.45)] sm:inset-x-auto sm:right-6 sm:w-[400px]"
        >
          <header className="flex items-start gap-3 border-b p-4">
            <Caixinha className="w-11 shrink-0" piscando />
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg leading-tight font-semibold">
                Oi! Sou a Caixinha.
              </p>
              <p className="text-muted-foreground text-sm">
                Pesquise uma dúvida sobre a plataforma.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="text-muted-foreground hover:text-foreground rounded-md p-1"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="border-b p-3">
            <label className="relative block">
              <span className="sr-only">Pesquisar</span>
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <input
                ref={campo}
                type="search"
                value={termo}
                onChange={(e) => {
                  setTermo(e.target.value)
                  setExpandido(null)
                }}
                placeholder="Ex.: rastreio, limite do mês, carta"
                className="border-input bg-background focus-visible:ring-ring h-10 w-full rounded-md border pr-3 pl-9 text-sm focus-visible:ring-2 focus-visible:outline-none"
              />
            </label>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            <p className="text-muted-foreground px-2 pt-1 pb-2 text-xs font-semibold tracking-wide uppercase">
              {sugestoes
                ? 'Perguntas comuns'
                : `${resultados.length} ${resultados.length === 1 ? 'resultado' : 'resultados'}`}
            </p>
            {resultados.length === 0 ? (
              <p className="text-muted-foreground px-2 py-6 text-center text-sm text-pretty">
                Não achei nada com isso. Tente outra palavra, ou fale com o admin da sua área.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {(sugestoes ? resultados.slice(0, 6) : resultados).map((item) => {
                  const estaAberto = expandido === item.id
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-expanded={estaAberto}
                        onClick={() => setExpandido(estaAberto ? null : item.id)}
                        className={cn(
                          'hover:bg-muted flex w-full items-start justify-between gap-3 rounded-md px-2 py-2 text-left text-sm font-medium text-pretty',
                          estaAberto && 'bg-muted',
                        )}
                      >
                        {item.pergunta}
                        <ChevronDown
                          className={cn(
                            'text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform',
                            estaAberto && 'rotate-180',
                          )}
                        />
                      </button>
                      {estaAberto ? (
                        <div className="px-2 pt-1 pb-3">
                          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                            {item.resposta}
                          </p>
                          {item.abreTour ? (
                            <button
                              type="button"
                              onClick={abrirTour}
                              className="text-primary-emphasis mt-2 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
                            >
                              {item.rotuloDoLink ?? 'Abrir o tour'}{' '}
                              <ArrowRight className="size-4" />
                            </button>
                          ) : item.href ? (
                            <Link
                              href={item.href as Route}
                              onClick={() => setAberto(false)}
                              className="text-primary-emphasis mt-2 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
                            >
                              {item.rotuloDoLink ?? 'Ir para a tela'}{' '}
                              <ArrowRight className="size-4" />
                            </Link>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      <button
        ref={botao}
        type="button"
        data-tour="caixinha"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls={aberto ? idPainel : undefined}
        aria-label={aberto ? 'Fechar a Caixinha' : 'Abrir a Caixinha: dúvidas sobre a plataforma'}
        title="Dúvidas? Pergunte à Caixinha"
        className="bg-card hover:border-primary focus-visible:ring-ring fixed right-4 bottom-4 z-[55] grid size-16 place-items-center rounded-full border shadow-[0_12px_30px_-12px_rgba(11,41,5,0.45)] transition-colors focus-visible:ring-2 focus-visible:outline-none sm:right-6 sm:bottom-6"
      >
        <Caixinha className="w-10" piscando={!aberto} />
      </button>
    </>
  )
}
