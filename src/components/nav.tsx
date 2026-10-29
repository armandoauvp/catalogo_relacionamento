'use client'

import { forwardRef, useState, useTransition } from 'react'
import Link, { useLinkStatus } from 'next/link'
import type { Route } from 'next'
import { usePathname } from 'next/navigation'
import type { Perfil } from '@prisma/client'
import {
  Check,
  ChevronDown,
  Gift,
  ListChecks,
  LogOut,
  MailOpen,
  Package,
  Send,
  Settings2,
  ShoppingCart,
  Truck,
  Users,
  UserSquare,
  Table2,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { Olho } from '@/components/marca/olho'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { sair, verComoPerfil } from '@/lib/actions/sessao'
import { pode, ROTULO_PERFIL, type Acao } from '@/lib/permissions'
import { cn } from '@/lib/utils'

/**
 * Navegação superior, no padrão do `GlobalNav` da Central: barra clara com
 * blur, o olho solto sobre ela, itens em Anek e o ativo marcado por um
 * sublinhado fino.
 *
 * A barra **não rola**. Duas decisões sustentam isso:
 *
 * - os três CRUDs de administração ficam sob um único item "Administração",
 *   o que mantém a barra enxuta, como a da Central;
 * - não existe `overflow-x-auto` aqui. Além de a barra de rolagem horizontal
 *   ficar feia, `overflow-x: auto` obriga o `overflow-y` a virar `auto`
 *   também: o que criava uma segunda barra, vertical, e ainda cortava os
 *   balões de hover, que são filhos posicionados do item.
 *
 * O menu é montado a partir da matriz de permissões, mas **não é controle de
 * acesso**: cada rota tem a própria guarda de servidor.
 */

type ItemDeMenu = {
  id: string
  href: Route
  rotulo: string
  descricao: string
  icone: LucideIcon
  acao: Acao
}

/** Itens de primeiro nível. */
const PRINCIPAIS: readonly ItemDeMenu[] = [
  {
    id: 'catalogo',
    href: '/catalogo',
    rotulo: 'Catálogo',
    descricao: 'Os presentes disponíveis, com valor e estoque',
    icone: Gift,
    acao: 'catalogo.ver',
  },
  {
    id: 'minhas',
    href: '/solicitacoes',
    rotulo: 'Minhas solicitações',
    descricao: 'O que você pediu e o status de cada envio',
    icone: ListChecks,
    acao: 'solicitacao.verProprias',
  },
  {
    id: 'compras',
    href: '/financeiro/compras',
    rotulo: 'Fila de compras',
    descricao: 'Itens enviados para compra, com valor e site',
    icone: ShoppingCart,
    acao: 'compras.verFila',
  },
  {
    id: 'expedicao',
    href: '/expedicao',
    rotulo: 'Expedição',
    descricao: 'Pedidos prontos para separar, com endereço de envio',
    icone: Truck,
    acao: 'expedicao.verFila',
  },
  {
    id: 'logistica',
    href: '/logistica',
    rotulo: 'Logística',
    descricao: 'Status da operação, volume, demandas e equipe',
    icone: Warehouse,
    acao: 'logistica.ver',
  },
  {
    id: 'tiny',
    href: '/tiny',
    rotulo: 'Tiny',
    descricao: 'Pedidos no Tiny, importação em lote e rastreio',
    icone: Send,
    acao: 'tiny.operar',
  },
  {
    id: 'gestao',
    href: '/admin/solicitacoes',
    rotulo: 'Gestão',
    descricao: 'Fluxo completo, mudança de status e exportação',
    icone: Table2,
    acao: 'solicitacao.verTodas',
  },
] as const

/** Cadastros, agrupados sob "Administração" para a barra não crescer. */
const ADMINISTRACAO: readonly ItemDeMenu[] = [
  {
    id: 'produtos',
    href: '/admin/catalogo',
    rotulo: 'Produtos',
    descricao: 'Cadastro, edição e ativação do catálogo',
    icone: Package,
    acao: 'catalogo.gerenciar',
  },
  {
    id: 'cartas',
    href: '/admin/cartas' as Route,
    rotulo: 'Modelos de carta',
    descricao: 'Sugestões de texto por motivo',
    icone: MailOpen,
    acao: 'carta.gerenciarModelos',
  },
  {
    id: 'clientes',
    href: '/admin/clientes',
    rotulo: 'Clientes',
    descricao: 'Cadastro manual e importação por CSV',
    icone: UserSquare,
    acao: 'cliente.gerenciar',
  },
  {
    id: 'usuarios',
    href: '/admin/usuarios',
    rotulo: 'Usuários',
    descricao: 'Perfil de acesso e limite mensal',
    icone: Users,
    acao: 'usuario.gerenciar',
  },
] as const

/**
 * Ponto que pulsa dentro do item clicado enquanto a rota carrega.
 *
 * Precisa ser um componente separado: `useLinkStatus` só lê o estado do `Link`
 * que o contém. Ocupa largura fixa em todo estado, para que acender e apagar
 * não empurre os vizinhos.
 */
function Pendente() {
  const { pending } = useLinkStatus()

  return (
    <span
      aria-hidden="true"
      className={cn(
        // Fora do fluxo, no respiro à direita: ocupando largura, empurrava o
        // rótulo para a esquerda do sublinhado do item ativo.
        'ease-apple absolute top-1/2 right-1 flex -translate-y-1/2 transition-opacity duration-200',
        pending ? 'opacity-100' : 'opacity-0',
      )}
    >
      <span className="inline-block size-1 animate-pulse rounded-full bg-current align-middle" />
    </span>
  )
}

/** Caixa do ícone, igual na barra, no balão e no menu suspenso. */
function IconeDoItem({ Icone, ativo }: { Icone: LucideIcon; ativo: boolean }) {
  return (
    <span
      className={cn(
        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
        ativo ? 'bg-foreground text-background border-foreground' : 'bg-card text-foreground',
      )}
    >
      <Icone className="h-4 w-4" aria-hidden="true" />
    </span>
  )
}

/**
 * Linha do menu suspenso.
 *
 * Precisa encaminhar `className`, `ref` e o resto das props: o `asChild` do
 * Radix entrega os estilos e os handlers do item ao filho, e um componente que
 * os ignora perde o layout inteiro, foi assim que o ícone e o texto acabaram
 * empilhados em vez de lado a lado.
 */
const ItemDeLista = forwardRef<
  HTMLAnchorElement,
  { item: ItemDeMenu; ativo: boolean } & Omit<React.ComponentPropsWithoutRef<typeof Link>, 'href'>
>(function ItemDeLista({ item, ativo, ...props }, ref) {
  return (
    <Link {...props} ref={ref} href={item.href}>
      <IconeDoItem Icone={item.icone} ativo={ativo} />
      <span className="min-w-0 flex-1">
        <span className="font-display text-foreground block text-sm leading-tight font-bold">
          {item.rotulo}
        </span>
        <span className="text-muted-foreground font-roboto mt-0.5 block text-xs leading-snug">
          {item.descricao}
        </span>
      </span>
      {ativo ? (
        <span className="bg-background font-roboto mt-1 shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase">
          Atual
        </span>
      ) : null}
    </Link>
  )
})

const PERFIS: Perfil[] = ['admin', 'consultor', 'financeiro', 'logistica']

export function Nav({
  perfil,
  nome,
  perfilLivre = false,
}: {
  perfil: Perfil
  nome: string
  /** Fase de testes: o menu da conta troca o perfil com que se vê a ferramenta. */
  perfilLivre?: boolean
}) {
  const caminho = usePathname()
  const [emHover, setEmHover] = useState<string | null>(null)
  const [trocando, iniciarTroca] = useTransition()

  const ativo = (href: Route) => caminho === href || caminho.startsWith(`${href}/`)

  const principais = PRINCIPAIS.filter((item) => pode(perfil, item.acao))
  const administracao = ADMINISTRACAO.filter((item) => pode(perfil, item.acao))
  const todos = [...principais, ...administracao]

  const atual = todos.find((item) => ativo(item.href))
  const adminAtivo = administracao.some((item) => ativo(item.href))

  const iniciais = nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 md:h-16 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {/* O olho fica solto sobre o fundo, sem caixa. Como usa
              `currentColor`, acompanha o tema sozinho, escuro no claro, claro
              no escuro, que é a regra do Design System. */}
          <Link
            href="/"
            aria-label="Ir para a página inicial"
            className="focus-visible:ring-ring shrink-0 rounded-lg outline-none focus-visible:ring-2"
          >
            <Olho className="text-foreground w-8 md:w-10" />
          </Link>

          {/* Celular e tablet: o nome da seção atual vira o gatilho do menu. Com
              os itens do Admin, a barra horizontal só cabe a partir de 1024 px. */}
          <div className="lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger className="hover:bg-muted -mx-2 flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors outline-none">
                <span className="text-left">
                  <span className="font-display text-foreground block text-sm leading-tight font-bold">
                    {atual?.rotulo ?? 'Presentes'}
                  </span>
                  <span className="text-muted-foreground font-roboto block text-[10px] leading-tight tracking-wider uppercase">
                    AUVP
                  </span>
                </span>
                <ChevronDown
                  className="text-muted-foreground h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start" className="w-72">
                {todos.map((item) => (
                  <DropdownMenuItem key={item.id} asChild>
                    <ItemDeLista item={item} ativo={ativo(item.href)} />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Computador: navegação horizontal com balão de descrição no hover. */}
          <nav className="hidden items-center gap-0.5 lg:flex">
            {principais.map((item) => {
              const estaAtivo = ativo(item.href)
              const aberto = emHover === item.id

              return (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={() => setEmHover(item.id)}
                  onMouseLeave={() => setEmHover(null)}
                >
                  <Link
                    href={item.href}
                    aria-current={estaAtivo ? 'page' : undefined}
                    className={cn(
                      'font-display relative flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-normal whitespace-nowrap transition-colors duration-200',
                      estaAtivo
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {item.rotulo}
                    <Pendente />
                    {estaAtivo ? (
                      <span className="bg-foreground/30 absolute right-3 bottom-1 left-3 h-px rounded-full" />
                    ) : null}
                  </Link>

                  {/* O balão fica sempre no DOM e entra por opacidade e
                      deslocamento: montar e desmontar no hover causaria
                      recálculo de layout a cada passagem do mouse. */}
                  <div
                    aria-hidden={!aberto}
                    className="pointer-events-none absolute top-full left-1/2 z-50 mt-1.5 w-56"
                    style={{
                      transform: aberto
                        ? 'translateX(-50%) translateY(0)'
                        : 'translateX(-50%) translateY(-5px)',
                      opacity: aberto ? 1 : 0,
                      transition:
                        'opacity 200ms cubic-bezier(0.22,1,0.36,1), transform 200ms cubic-bezier(0.22,1,0.36,1)',
                    }}
                  >
                    <div className="bg-popover relative rounded-xl border p-3 shadow-lg">
                      <div className="bg-popover absolute -top-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 rounded-sm border-t border-l" />
                      <div className="flex items-start gap-3">
                        <IconeDoItem Icone={item.icone} ativo={estaAtivo} />
                        <div className="min-w-0">
                          <p className="font-display text-foreground text-sm leading-tight font-medium">
                            {item.rotulo}
                          </p>
                          <p className="text-muted-foreground font-roboto mt-0.5 text-xs leading-snug">
                            {item.descricao}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {administracao.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(
                    'font-display relative flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-normal whitespace-nowrap transition-colors duration-200 outline-none',
                    adminAtivo
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Settings2 className="h-4 w-4" aria-hidden="true" />
                  Administração
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {adminAtivo ? (
                    <span className="bg-foreground/30 absolute right-3 bottom-1 left-3 h-px rounded-full" />
                  ) : null}
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" className="w-72">
                  {administracao.map((item) => (
                    <DropdownMenuItem key={item.id} asChild>
                      <ItemDeLista item={item} ativo={ativo(item.href)} />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <div className="bg-border mx-0.5 hidden h-4 w-px lg:block" />

          {/* O form fica fora do menu: o conteúdo do dropdown desmonta ao
              fechar, e o envio não pode depender dele continuar na tela. */}
          <form id="form-sair" action={sair} className="hidden" />

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Conta de ${nome}`}
              className="hover:bg-muted -mr-1.5 flex items-center gap-2.5 rounded-xl py-1 pr-1.5 pl-2 transition-colors outline-none"
            >
              <span className="hidden text-right leading-tight sm:block">
                <span className="text-foreground block text-sm">{nome}</span>
                <span className="text-muted-foreground block text-xs">{ROTULO_PERFIL[perfil]}</span>
              </span>
              <span
                className="bg-muted text-foreground font-ui grid size-9 place-items-center rounded-full text-xs font-semibold"
                aria-hidden="true"
              >
                {iniciais}
              </span>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              {perfilLivre ? (
                <>
                  <p className="text-muted-foreground font-roboto px-2 pt-1.5 pb-1 text-[10px] font-bold tracking-wider uppercase">
                    Ver como
                  </p>
                  {PERFIS.map((opcao) => (
                    <DropdownMenuItem
                      key={opcao}
                      disabled={trocando}
                      onSelect={() => {
                        if (opcao !== perfil) iniciarTroca(() => verComoPerfil(opcao))
                      }}
                    >
                      <Check
                        className={cn('h-4 w-4', opcao === perfil ? 'opacity-100' : 'opacity-0')}
                        aria-hidden="true"
                      />
                      {ROTULO_PERFIL[opcao]}
                    </DropdownMenuItem>
                  ))}
                  <div className="bg-border -mx-1 my-1 h-px" role="separator" />
                </>
              ) : null}
              <DropdownMenuItem asChild>
                <button type="submit" form="form-sair" className="w-full items-center">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sair
                </button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
