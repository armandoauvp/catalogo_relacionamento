'use client'

import { useState } from 'react'
import Image from 'next/image'
import { RotateCw } from 'lucide-react'
import { ilustracaoDoProduto } from '@/lib/ilustracoes'
import { cn } from '@/lib/utils'

/**
 * Foto do produto no card do catálogo.
 *
 * Proporção 3:4, a nativa dos mockups tratados da Central, a foto preenche o
 * quadro inteiro, sem faixa de fundo sobrando.
 *
 * Sobre layout shift: a moldura tem `aspect-[3/4]` e a `Image` recebe as
 * dimensões reais (900×1200). O espaço é reservado antes de qualquer byte da
 * imagem chegar, então nada se move quando ela carrega, nem na primeira
 * visita, nem com a rede lenta.
 *
 * Sem foto cadastrada, entra a ilustração da categoria: estado de repouso, não
 * aviso de erro.
 */

const LARGURA = 900
const ALTURA = 1200

/**
 * Foto guardada no nosso banco não passa pelo otimizador do Next.
 *
 * `/api/arquivos/...` fica atrás da sessão, e o otimizador busca a origem do
 * servidor, sem cookie: a resposta seria 401 e a imagem, um quadro quebrado.
 * O upload já é limitado a 4 MB e a foto de catálogo é pequena, então o custo
 * de servir o original é menor que o de abrir essa rota para fora.
 */
const semOtimizador = (url: string) => url.startsWith('/api/arquivos/')

export function ProdutoImagem({
  fotoUrl,
  fotoVersoUrl,
  nome,
  categoria,
  prioridade = false,
  className,
  children,
}: {
  fotoUrl?: string | null
  /** Quando existe, o card vira a foto: frente em repouso, verso no hover. */
  fotoVersoUrl?: string | null
  nome: string
  categoria?: string | null
  /** Primeira dobra: carrega sem lazy, para a foto não pintar depois. */
  prioridade?: boolean
  className?: string
  /** O que vai por cima da foto, fora do giro do verso: os selos do catálogo. */
  children?: React.ReactNode
}) {
  const temVerso = Boolean(fotoUrl && fotoVersoUrl)
  const [virado, setVirado] = useState(false)

  /**
   * Foto que não carrega vira a ilustração da categoria.
   *
   * O catálogo da área aponta para o Drive dela, e link externo quebra: some,
   * muda de permissão, passa a exigir login. Sem isto o card mostraria o ícone
   * de imagem quebrada: que parece defeito do sistema, e não link vencido.
   * A moldura tem proporção fixa, então a troca não desloca nada.
   */
  const [falhou, setFalhou] = useState(false)
  const semFoto = !fotoUrl || falhou

  // Só o mouse vira a foto ao passar por cima: no toque o `pointerenter`
  // dispara junto do toque e brigaria com o clique, que também vira.
  const viraNoMouse = (proximo: boolean) => (e: React.PointerEvent) => {
    if (temVerso && e.pointerType === 'mouse') setVirado(proximo)
  }

  return (
    <div
      onPointerEnter={viraNoMouse(true)}
      onPointerLeave={viraNoMouse(false)}
      className={cn(
        'bg-muted/50 relative aspect-3/4 overflow-hidden border-b [perspective:1200px]',
        className,
      )}
    >
      {semFoto ? (
        <svg
          viewBox="0 0 200 150"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="text-primary/40 ease-apple h-full w-full transition-transform duration-500 group-hover:scale-105"
          dangerouslySetInnerHTML={{ __html: ilustracaoDoProduto(nome, categoria) }}
        />
      ) : temVerso ? (
        <>
          {/* Produto com os dois lados desenhados (a caneca AUPO11): a foto
              gira em 3D. No toque e no teclado quem vira é o botão que a cobre. */}
          <div
            className={cn(
              'ease-apple absolute inset-0 transition-transform duration-700 [transform-style:preserve-3d] motion-reduce:transition-none',
              virado && '[transform:rotateY(180deg)]',
            )}
          >
            <Image
              src={fotoUrl}
              alt={nome}
              width={LARGURA}
              height={ALTURA}
              priority={prioridade}
              unoptimized={semOtimizador(fotoUrl)}
              onError={() => setFalhou(true)}
              sizes="(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 90vw"
              className="absolute inset-0 h-full w-full object-cover [backface-visibility:hidden]"
            />
            <Image
              src={fotoVersoUrl!}
              alt={`${nome}: verso`}
              width={LARGURA}
              height={ALTURA}
              unoptimized={semOtimizador(fotoVersoUrl!)}
              onError={() => setFalhou(true)}
              sizes="(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 90vw"
              className="absolute inset-0 h-full w-full [transform:rotateY(180deg)] object-cover [backface-visibility:hidden]"
            />
          </div>

          <button
            type="button"
            aria-pressed={virado}
            aria-label={virado ? `Ver a frente de ${nome}` : `Ver o verso de ${nome}`}
            onClick={() => setVirado((v) => !v)}
            onFocus={() => setVirado(true)}
            onBlur={() => setVirado(false)}
            className="focus-visible:ring-primary absolute inset-0 z-10 cursor-pointer focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
          >
            <span className="bg-background/85 text-foreground font-roboto absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold tracking-wider uppercase shadow-sm backdrop-blur-sm">
              <RotateCw className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden="true" />
              {virado ? 'Verso' : 'Frente'}
            </span>
          </button>
        </>
      ) : (
        <Image
          src={fotoUrl}
          alt={nome}
          width={LARGURA}
          height={ALTURA}
          priority={prioridade}
          unoptimized={semOtimizador(fotoUrl)}
          onError={() => setFalhou(true)}
          sizes="(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 90vw"
          className="ease-apple h-full w-full object-cover transition-transform duration-500 sm:group-hover:scale-105"
        />
      )}
      {children}
    </div>
  )
}
