import { exigirPermissao } from '@/lib/auth-guards'
import { ehContaTiny, NOME_DA_CONTA } from '@/lib/tiny/contas'
import { CabecalhoDaPagina } from '@/components/pagina'
import { EscolhaDaConta } from '../escolha-da-conta'
import { NovaVenda } from './nova-venda'

export default async function NovaVendaPage({
  searchParams,
}: {
  searchParams: Promise<{ conta?: string }>
}) {
  await exigirPermissao('tiny.operar')
  // Sem conta na URL, a tela pergunta antes de mostrar o pedido.
  const { conta } = await searchParams
  const escolhida = ehContaTiny(conta) ? conta : null
  return (
    <>
      <CabecalhoDaPagina
        titulo="Nova venda"
        descricao={
          escolhida
            ? `Um pedido avulso para o Tiny da ${NOME_DA_CONTA[escolhida]}, com um ou mais produtos, sem passar por solicitação nem planilha.`
            : 'Um pedido avulso para o Tiny, com um ou mais produtos, sem passar por solicitação nem planilha.'
        }
      />
      {escolhida ? (
        <NovaVenda key={escolhida} conta={escolhida} />
      ) : (
        <EscolhaDaConta caminho="/tiny/nova-venda" oQue="vai este pedido" />
      )}
    </>
  )
}
