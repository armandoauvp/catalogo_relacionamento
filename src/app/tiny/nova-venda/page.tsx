import { exigirPermissao } from '@/lib/auth-guards'
import { CabecalhoDaPagina } from '@/components/pagina'
import { NovaVenda } from './nova-venda'

export default async function NovaVendaPage() {
  await exigirPermissao('tiny.operar')
  return (
    <>
      <CabecalhoDaPagina
        titulo="Nova venda"
        descricao="Um pedido avulso para o Tiny, com um ou mais produtos, sem passar por solicitação nem planilha."
      />
      <NovaVenda />
    </>
  )
}
