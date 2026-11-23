'use server'

import { revalidatePath } from 'next/cache'
import { usuarioAtual } from '@/lib/auth-guards'
import { db } from '@/lib/db'

/**
 * Marca como lidos os avisos de quem está logado. Só os dele: o `where` leva o
 * id da sessão, nunca um que venha do navegador.
 */
export async function marcarAvisosComoLidos(): Promise<void> {
  const usuario = await usuarioAtual()
  if (!usuario) return
  const { count } = await db.notificacao.updateMany({
    where: { usuarioId: usuario.id, lidaEm: null },
    data: { lidaEm: new Date() },
  })
  // O número do sininho mora no layout: só cai se a casca for refeita.
  if (count) revalidatePath('/', 'layout')
}
