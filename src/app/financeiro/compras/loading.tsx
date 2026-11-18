import { EsqueletoDeCabecalho, EsqueletoDeStats, EsqueletoDeTabela } from '@/components/esqueletos'

export default function Carregando() {
  return (
    <>
      <EsqueletoDeCabecalho />
      <EsqueletoDeStats />
      {/* A linha dos botões de visão (por fornecedor / por item). */}
      <div className="mb-6 h-10" aria-hidden="true" />
      {/* A fila de compras é curta e drena; sete linhas é o tamanho comum. */}
      <EsqueletoDeTabela linhas={7} />
    </>
  )
}
