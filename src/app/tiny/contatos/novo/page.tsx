import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { exigirPermissao } from '@/lib/auth-guards'
import { comConta, contaDoParametro, NOME_DA_CONTA } from '@/lib/tiny/contas'
import { CabecalhoDaPagina } from '@/components/pagina'
import { CONTATO_VAZIO, FormularioDeContato } from '../formulario-de-contato'

export default async function NovoContatoPage({
  searchParams,
}: {
  searchParams: Promise<{ conta?: string }>
}) {
  await exigirPermissao('tiny.operar')
  const conta = contaDoParametro((await searchParams).conta)
  return (
    <>
      <Link
        href={comConta('/tiny/contatos', conta)}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Contatos no Tiny
      </Link>
      <CabecalhoDaPagina
        titulo="Novo contato"
        descricao={`Grava no Tiny da ${NOME_DA_CONTA[conta]}. Se o CPF/CNPJ já estiver lá, o cadastro é atualizado em vez de duplicado.`}
      />
      <FormularioDeContato conta={conta} tinyId={null} inicial={CONTATO_VAZIO} />
    </>
  )
}
