import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { exigirPermissao } from '@/lib/auth-guards'
import { CabecalhoDaPagina } from '@/components/pagina'
import { ImportarContatos } from './importar-contatos'

export default async function ImportarContatosPage() {
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
        titulo="Atualizar contatos por planilha"
        descricao="A atualização cadastral em massa do AUVP-Eventos: muda o cadastro no Tiny sem gerar pedido."
      />
      <ImportarContatos />
    </>
  )
}
