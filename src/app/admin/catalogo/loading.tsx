import { EsqueletoDeCabecalho, EsqueletoDeStats, EsqueletoDeTabela } from '@/components/esqueletos'

export default function Carregando() {
  return (
    <>
      <EsqueletoDeCabecalho comAcoes acoes={3} />
      <EsqueletoDeStats />
      {/* O catálogo tem dezenas de produtos e cresce devagar. */}
      <EsqueletoDeTabela linhas={13} />
    </>
  )
}
