import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { exigirPermissao } from '@/lib/auth-guards'
import { tinyConfigurado } from '@/lib/env'
import { sugestoesDoCadastro } from '@/lib/logistica/painel'
import { CabecalhoDaPagina, EstadoVazio } from '@/components/pagina'
import { ImportarLote } from './importar-lote'

export default async function ImportarLotePage() {
  await exigirPermissao('tiny.operar')
  const sugestoes = tinyConfigurado ? await sugestoesDoCadastro() : null

  return (
    <>
      <Link
        href="/tiny"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Tiny
      </Link>
      <CabecalhoDaPagina
        titulo="Importar lote"
        descricao="Uma planilha, um produto e uma transportadora: cada linha vira um pedido no Tiny."
      />
      {sugestoes ? (
        <ImportarLote
          subsidiarias={sugestoes.subsidiarias}
          departamentos={sugestoes.departamentos}
        />
      ) : (
        <EstadoVazio
          titulo="O Tiny ainda não está ligado"
          descricao="Falta o token do Tiny na Vercel (TINY_API_TOKEN). Sem ele não dá para buscar produtos nem criar pedidos."
        />
      )}
    </>
  )
}
