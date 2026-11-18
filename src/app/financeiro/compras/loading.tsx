import {
  EsqueletoDeCabecalho,
  EsqueletoDeFornecedores,
  EsqueletoDeStats,
} from '@/components/esqueletos'

export default function Carregando() {
  return (
    <>
      <EsqueletoDeCabecalho />
      <EsqueletoDeStats />
      {/* A linha dos botões de visão (por fornecedor / por item). */}
      <div className="mb-6 h-10" aria-hidden="true" />
      {/* A visão que abre é por fornecedor, não a tabela por item. */}
      <EsqueletoDeFornecedores />
    </>
  )
}
