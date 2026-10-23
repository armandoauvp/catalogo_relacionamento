import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { exigirPermissao } from '@/lib/auth-guards'
import { CabecalhoDaPagina } from '@/components/pagina'
import { CONTATO_VAZIO, FormularioDeContato } from '../formulario-de-contato'

export default async function NovoContatoPage() {
  await exigirPermissao('tiny.operar')
  return (
    <>
      <Link
        href="/tiny/contatos"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Contatos no Tiny
      </Link>
      <CabecalhoDaPagina
        titulo="Novo contato"
        descricao="Se o CPF/CNPJ já estiver no Tiny, o cadastro de lá é atualizado em vez de duplicado."
      />
      <FormularioDeContato tinyId={null} inicial={CONTATO_VAZIO} />
    </>
  )
}
