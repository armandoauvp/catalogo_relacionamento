import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { exigirPermissao } from '@/lib/auth-guards'
import { tinyConfigurado } from '@/lib/env'
import { obterContato } from '@/lib/tiny/api'
import { ErroDoTiny } from '@/lib/tiny/erros'
import type { ContatoDoTiny } from '@/lib/tiny/leitura'
import { CabecalhoDaPagina } from '@/components/pagina'
import { FormularioDeContato } from '../formulario-de-contato'

/** Edita um contato do Tiny, aberto com os dados de lá. */
export default async function EditarContatoPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermissao('tiny.operar')
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()

  let contato: ContatoDoTiny | null = null
  let erro: string | null = tinyConfigurado ? null : 'O Tiny ainda não está ligado.'
  if (tinyConfigurado) {
    try {
      contato = await obterContato(id)
    } catch (e) {
      if (!(e instanceof ErroDoTiny)) throw e
      if (e.codigo === 20 || e.codigo === 32) notFound()
      erro = e.message
    }
  }

  return (
    <>
      <Link
        href="/tiny/contatos"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Contatos no Tiny
      </Link>
      {!contato ? (
        <div
          role="alert"
          className="border-warning/40 bg-warning/10 flex gap-3 rounded-lg border p-4 text-sm"
        >
          <AlertTriangle className="text-warning mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>{erro}</p>
        </div>
      ) : (
        <>
          <CabecalhoDaPagina
            sobrancelha={contato.codigo ? `Código ${contato.codigo}` : undefined}
            titulo={contato.nome}
            descricao="A alteração vai ao Tiny pela fila, em seguida."
          />
          <FormularioDeContato
            tinyId={contato.id}
            inicial={{
              nome: contato.nome,
              cpfCnpj: contato.cpfCnpj,
              email: contato.email ?? '',
              telefone: contato.fone ?? '',
              ...contato.endereco,
            }}
          />
        </>
      )}
    </>
  )
}
