import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { bearerConfere } from '@/lib/segredo'
import { conferirFornecedores } from '@/lib/conferencia-do-fornecedor'

/**
 * A conferência diária do fornecedor (pedido da Lilian, 25/11/2026).
 *
 * Chamada pelo GitHub Actions de manhã (.github/workflows/fornecedores.yml),
 * com o mesmo `Authorization: Bearer <CRON_SECRET>` do agendador do Tiny.
 */
export const maxDuration = 60
export const dynamic = 'force-dynamic'

async function rodar(req: Request) {
  if (!env.CRON_SECRET) {
    return NextResponse.json({ erro: 'CRON_SECRET não configurado.' }, { status: 503 })
  }
  if (!bearerConfere(req.headers.get('authorization'), env.CRON_SECRET)) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }
  return NextResponse.json(await conferirFornecedores({ prazoMs: 50_000 }))
}

export const GET = rodar
export const POST = rodar
