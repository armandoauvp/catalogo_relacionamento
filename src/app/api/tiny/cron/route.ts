import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { bearerConfere } from '@/lib/segredo'
import { processarFila, sincronizarPedidos } from '@/lib/tiny/fila'

/**
 * O agendador do Tiny: esvazia a fila e traz situação e rastreio de volta.
 *
 * Chamado pelo cron da Vercel (uma vez por dia no plano Hobby) e pelo GitHub
 * Actions a cada poucos minutos (.github/workflows/tiny.yml). Os dois mandam
 * `Authorization: Bearer <CRON_SECRET>`. Sem o segredo configurado a rota não
 * roda: aberta, qualquer um com o endereço dispararia pedidos.
 */

// A rodada respeita o intervalo entre chamadas do Tiny; 60 s é o teto do Hobby.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

async function rodar(req: Request) {
  if (!env.CRON_SECRET) {
    return NextResponse.json({ erro: 'CRON_SECRET não configurado.' }, { status: 503 })
  }
  if (!bearerConfere(req.headers.get('authorization'), env.CRON_SECRET)) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  const fila = await processarFila({ prazoMs: 30_000 })
  const sincronizacao = await sincronizarPedidos({ prazoMs: 20_000 })
  return NextResponse.json({ fila, sincronizacao })
}

export const GET = rodar
export const POST = rodar
