import { Clock, Link2, PackageCheck, PackageX, type LucideIcon } from 'lucide-react'
import type { OrigemProduto } from '@prisma/client'
import { CLASSES_DE_TOM, visualDaCategoria } from '@/lib/categorias'
import { cn } from '@/lib/utils'

/**
 * Os selos do produto, sobre a foto: só o ícone, e o nome desliza para fora
 * dele no hover.
 *
 * O nome está no HTML desde o início, então o leitor de tela o lê sem
 * depender de hover. Cada selo recebe foco: no teclado e no toque do celular,
 * que foca o elemento tocado, o nome aparece do mesmo jeito. A entrada anima
 * só opacidade e deslocamento, e o rótulo é absoluto: nada no card se move.
 */

type Selo = { chave: string; rotulo: string; icone: LucideIcon; tom: string }

export type ProdutoParaSelos = {
  categoriaNome: string
  exigeAcompanhamento: string | null
  origem: OrigemProduto
  controlaEstoque: boolean
  estoque: number | null
}

/**
 * O que o consultor quer saber é quanto tempo demora, e não quantas peças
 * existem: "pronta entrega" sai assim que o Admin aprovar; "sob encomenda"
 * espera a compra. A contagem, quando a área a mantém, entra junto.
 */
function disponibilidade(p: ProdutoParaSelos): Selo {
  if (p.controlaEstoque && !p.estoque) {
    return {
      chave: 'disponibilidade',
      rotulo: 'Sem estoque',
      icone: PackageX,
      tom: 'bg-error/12 text-error',
    }
  }
  if (p.origem === 'estoque_interno') {
    return {
      chave: 'disponibilidade',
      rotulo: p.controlaEstoque ? `Pronta entrega · ${p.estoque} un.` : 'Pronta entrega',
      icone: PackageCheck,
      tom: 'bg-success/12 text-success',
    }
  }
  return {
    chave: 'disponibilidade',
    rotulo: 'Sob encomenda',
    icone: Clock,
    tom: CLASSES_DE_TOM.neutral,
  }
}

export function selosDoProduto(p: ProdutoParaSelos): Selo[] {
  const { tom, icone } = visualDaCategoria(p.categoriaNome)
  return [
    { chave: 'categoria', rotulo: p.categoriaNome, icone, tom: CLASSES_DE_TOM[tom] },
    // Kit que embala bebida não sai sozinho, e quem olha o catálogo precisa
    // saber disso antes de pedir.
    ...(p.exigeAcompanhamento
      ? [
          {
            chave: 'acompanhamento',
            rotulo: `Vai com ${p.exigeAcompanhamento}`,
            // Elo, e não taça: a categoria Bebida já usa a taça.
            icone: Link2,
            tom: CLASSES_DE_TOM.brick,
          },
        ]
      : []),
    disponibilidade(p),
  ]
}

export function SelosDoProduto({ produto }: { produto: ProdutoParaSelos }) {
  return (
    <ul className="absolute top-2.5 right-2.5 z-20 flex flex-col items-end gap-1.5">
      {selosDoProduto(produto).map(({ chave, rotulo, icone: Icone, tom }) => (
        <li key={chave}>
          <span
            tabIndex={0}
            className="group/selo focus-visible:ring-ring relative flex rounded-full outline-none focus-visible:ring-2"
          >
            {/* Fundo opaco por baixo do tom translúcido: o ícone precisa ser
                lido sobre qualquer foto, clara ou escura. */}
            <span className="bg-background/90 rounded-full shadow-sm backdrop-blur-sm">
              <span className={cn('flex size-8 items-center justify-center rounded-full', tom)}>
                <Icone className="size-4" strokeWidth={2.25} aria-hidden="true" />
              </span>
            </span>
            <span className="bg-foreground/90 text-background font-roboto pointer-events-none absolute top-1/2 right-full mr-1.5 translate-x-1 -translate-y-1/2 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap opacity-0 shadow-md transition-[opacity,transform] duration-200 ease-out group-hover/selo:translate-x-0 group-hover/selo:opacity-100 group-focus/selo:translate-x-0 group-focus/selo:opacity-100 motion-reduce:transition-none">
              {rotulo}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}
