import { EsqueletoDeCabecalho, EsqueletoDeTabela } from '@/components/esqueletos'

export default function Carregando() {
  return (
    <>
      <EsqueletoDeCabecalho comAcoes acoes={2} />
      <EsqueletoDeTabela linhas={5} />
    </>
  )
}
