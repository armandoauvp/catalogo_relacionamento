'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Route } from 'next'
import { usePathname, useRouter } from 'next/navigation'
import type { Perfil } from '@prisma/client'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { marcarTourVisto } from '@/lib/actions/tour'
import { abreSozinho, passosDoTour, rotaDoPasso } from '@/lib/tour'

/** O menu da conta abre o tour por este evento: os dois vivem no layout, sem pai comum. */
export const EVENTO_ABRIR_TOUR = 'abrir-tour'

/** Quanto esperar o alvo aparecer depois de trocar de tela. */
const ESPERA_DO_ALVO_MS = 2500
const FOLGA = 8
const LARGURA_DO_BALAO = 320
const ALTURA_DO_BALAO = 190
const ALTURA_DO_DESTAQUE = 360
/** O menu fixo no topo, com folga: 64 px de altura mais 32. */
const ABAIXO_DO_MENU = 96

type Caixa = { top: number; left: number; width: number; height: number }

function caixaDoAlvo(alvo: string): Caixa | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${alvo}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  // No celular o menu fica recolhido: o elemento existe, mas não aparece.
  if (r.width === 0 || r.height === 0) return null
  // Uma tabela longa acenderia a tela inteira, e aí nada estaria em destaque.
  return {
    top: r.top,
    left: r.left,
    width: r.width,
    height: Math.min(r.height, ALTURA_DO_DESTAQUE),
  }
}

/** Alvo alto vai para o topo, para se ver o começo dele, e não o meio de uma lista. */
function levarAteOAlvo(alvo: string) {
  const el = document.querySelector<HTMLElement>(`[data-tour="${alvo}"]`)
  if (!el) return
  const r = el.getBoundingClientRect()
  if (r.height > ALTURA_DO_DESTAQUE) {
    window.scrollTo({ top: r.top + window.scrollY - ABAIXO_DO_MENU })
  } else {
    el.scrollIntoView({ block: 'center' })
  }
}

/**
 * Onde pôr o balão: embaixo do alvo, ou em cima se não couber. Alvo maior que a
 * tela, como uma tabela longa, deixa o balão dentro dele.
 */
function posicaoDoBalao(caixa: Caixa): { top: number; left: number } {
  const larguraUtil = window.innerWidth - LARGURA_DO_BALAO - FOLGA * 2
  const left = Math.max(FOLGA, Math.min(caixa.left, larguraUtil))
  const embaixo = caixa.top + caixa.height + 12
  if (embaixo + ALTURA_DO_BALAO < window.innerHeight) return { top: embaixo, left }
  const emCima = caixa.top - ALTURA_DO_BALAO - 12
  if (emCima > FOLGA) return { top: emCima, left }
  return { top: Math.max(FOLGA, window.innerHeight - ALTURA_DO_BALAO - FOLGA * 2), left }
}

/**
 * Tour guiado do perfil, a partir do `Tour` do Design System: fundo escuro,
 * destaque no elemento, balão com "1 de N", Próximo e Concluir.
 *
 * O da Central vive dentro de uma caixa; este cobre a tela e leva a pessoa de uma
 * página para a outra. Tudo é `position: fixed`, que não empurra nada, e o
 * destaque anda por `transform`: abrir o tour não causa layout shift.
 *
 * Enquanto está aberto, nada embaixo responde a clique: o tour mostra, não opera.
 */
export function Tour({ perfil, jaViu }: { perfil: Perfil; jaViu: boolean }) {
  const caminho = usePathname()
  const router = useRouter()
  const passos = passosDoTour(perfil)
  const [indice, setIndice] = useState<number | null>(null)
  // O que se achou, e para qual passo: enquanto não for o passo atual, está procurando.
  const [achado, setAchado] = useState<{ indice: number; caixa: Caixa | null } | null>(null)
  // Só uma abertura sozinha por carregamento: fechar não pode reabrir ao navegar.
  const jaAbriu = useRef(jaViu)
  const botao = useRef<HTMLButtonElement>(null)
  const passo = indice === null ? null : passos[indice]
  const procurando = indice !== null && achado?.indice !== indice
  const caixa = !procurando ? (achado?.caixa ?? null) : null

  const fechar = useCallback(() => {
    setIndice(null)
    setAchado(null)
    void marcarTourVisto()
  }, [])

  useEffect(() => {
    if (jaAbriu.current || !abreSozinho(perfil, jaViu, caminho)) return
    jaAbriu.current = true
    setIndice(0)
  }, [perfil, jaViu, caminho])

  useEffect(() => {
    const abrir = () => {
      jaAbriu.current = true
      setIndice(0)
    }
    window.addEventListener(EVENTO_ABRIR_TOUR, abrir)
    return () => window.removeEventListener(EVENTO_ABRIR_TOUR, abrir)
  }, [])

  // Leva até a tela do passo, espera o alvo aparecer e o traz para a vista.
  useEffect(() => {
    if (!passo || indice === null) return
    const destino = rotaDoPasso(passo, caminho)
    if (destino) {
      router.push(destino as Route)
      return
    }

    const inicio = Date.now()
    let espera = 0
    const procurar = () => {
      if (caixaDoAlvo(passo.alvo)) {
        levarAteOAlvo(passo.alvo)
        setAchado({ indice, caixa: caixaDoAlvo(passo.alvo) })
      } else if (Date.now() - inicio > ESPERA_DO_ALVO_MS) {
        setAchado({ indice, caixa: null })
      } else {
        espera = window.setTimeout(procurar, 100)
      }
    }
    espera = window.setTimeout(procurar, 0)
    return () => window.clearTimeout(espera)
  }, [passo, indice, caminho, router])

  // Rolar ou redimensionar move o alvo: o destaque acompanha.
  useEffect(() => {
    if (!passo || indice === null) return
    const medir = () =>
      setAchado((a) => (a?.indice === indice ? { indice, caixa: caixaDoAlvo(passo.alvo) } : a))
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true)
    return () => {
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, true)
    }
  }, [passo, indice])

  useEffect(() => {
    if (indice === null) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [indice, fechar])

  useEffect(() => {
    if (!procurando) botao.current?.focus({ preventScroll: true })
  }, [procurando, indice])

  if (!passo || indice === null) return null

  const ultimo = indice === passos.length - 1
  const estreito = typeof window !== 'undefined' && window.innerWidth < 640
  const posicao = caixa && !estreito ? posicaoDoBalao(caixa) : null

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="tour-t">
      {caixa ? (
        // A sombra enorme é o fundo escuro, com o furo exatamente no alvo.
        <div
          aria-hidden="true"
          className="ring-primary pointer-events-none absolute top-0 left-0 rounded-lg ring-4 transition-transform duration-300 motion-reduce:transition-none"
          style={{
            width: caixa.width,
            height: caixa.height,
            transform: `translate(${caixa.left}px, ${caixa.top}px)`,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
          }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-black/60" />
      )}

      <div
        hidden={procurando}
        className={
          posicao
            ? 'bg-popover absolute rounded-lg border p-4 shadow-xl'
            : estreito
              ? 'bg-popover absolute inset-x-4 bottom-4 rounded-lg border p-4 shadow-xl'
              : 'bg-popover absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg border p-4 shadow-xl'
        }
        style={
          posicao
            ? { ...posicao, width: LARGURA_DO_BALAO }
            : estreito
              ? {}
              : { width: LARGURA_DO_BALAO }
        }
      >
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar o tour"
          className="text-muted-foreground hover:text-foreground absolute top-2.5 right-2.5"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
        <h2 id="tour-t" className="font-display pr-6 text-base font-semibold">
          {passo.titulo}
        </h2>
        <p className="text-muted-foreground mt-1 mb-3 text-sm leading-relaxed">{passo.texto}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="font-roboto text-muted-foreground text-xs tabular-nums">
            {indice + 1} de {passos.length}
          </span>
          <div className="flex gap-1">
            {indice > 0 ? (
              <Button size="sm" variant="ghost" onClick={() => setIndice(indice - 1)}>
                Voltar
              </Button>
            ) : null}
            <Button
              ref={botao}
              size="sm"
              onClick={() => (ultimo ? fechar() : setIndice(indice + 1))}
            >
              {ultimo ? 'Concluir' : 'Próximo'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
