import { NextResponse } from 'next/server'
import { autorizarAction, SemPermissaoError } from '@/lib/auth-guards'
import { clientesDoFiltro } from '@/lib/clientes'
import { filtroDeClientesSchema } from '@/lib/filtro-de-clientes'
import { gerarXlsx } from '@/lib/export'
import { COLUNAS_DE_CLIENTES, linhaDoCliente } from '@/lib/export/clientes'

/** A base de clientes em Excel, com o mesmo recorte da tela. */
export async function GET(req: Request) {
  try {
    await autorizarAction('cliente.gerenciar')
  } catch (erro) {
    if (erro instanceof SemPermissaoError) {
      return NextResponse.json({ erro: erro.message }, { status: 403 })
    }
    throw erro
  }

  const filtro = filtroDeClientesSchema.parse(Object.fromEntries(new URL(req.url).searchParams))
  const clientes = await clientesDoFiltro(filtro)
  const arquivo = await gerarXlsx(clientes.map(linhaDoCliente), {
    colunas: COLUNAS_DE_CLIENTES,
    aba: 'Clientes',
  })

  const data = new Date().toISOString().slice(0, 10)
  return new NextResponse(new Uint8Array(arquivo), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="clientes-${data}.xlsx"`,
    },
  })
}
