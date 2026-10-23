import { EsqueletoDeCabecalho, EsqueletoDeTabela } from '@/components/esqueletos'
import { Skeleton } from '@/components/ui/skeleton'

export default function Carregando() {
  return (
    <>
      <EsqueletoDeCabecalho />
      {/* A barra de filtros: campos h-10 dentro de p-3 com borda. */}
      <Skeleton className="mb-6 h-[66px] rounded-lg" />
      {/* O Tiny devolve até 100 pedidos por página; a tela típica tem muitos. */}
      <EsqueletoDeTabela linhas={13} />
    </>
  )
}
