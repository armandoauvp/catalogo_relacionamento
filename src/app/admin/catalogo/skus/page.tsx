import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { CabecalhoDaPagina } from '@/components/pagina'
import { ImportarSkus } from './importar-skus'

export default async function ImportarSkusPage() {
  await exigirPermissao('catalogo.gerenciar')
  const catalogo = await db.produto.findMany({
    where: { ativo: true },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, skuTiny: true },
  })
  return (
    <>
      <Link
        href="/admin/catalogo"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Gerenciar catálogo
      </Link>
      <CabecalhoDaPagina
        titulo="SKUs do Tiny por planilha"
        descricao="Liga cada presente ao produto do Tiny de uma vez, em vez de editar um por um."
      />
      <ImportarSkus catalogo={catalogo} />
    </>
  )
}
