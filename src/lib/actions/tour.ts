'use server'

import { db } from '@/lib/db'
import { usuarioAtual } from '@/lib/auth-guards'

/**
 * Guarda que a pessoa já viu o tour deste perfil, inclusive quando ela fecha no
 * meio: reabrir sozinho a cada visita seria insistência. O tour continua no menu
 * da conta. Fica no usuário, e não no navegador, para não voltar em outro
 * computador.
 *
 * Falhar aqui não atrapalha ninguém: no pior caso, o tour abre de novo. Por isso
 * não devolve erro.
 */
export async function marcarTourVisto(): Promise<void> {
  const usuario = await usuarioAtual()
  if (!usuario) return
  try {
    const { toursVistos } = await db.usuario.findUniqueOrThrow({
      where: { id: usuario.id },
      select: { toursVistos: true },
    })
    if (toursVistos.includes(usuario.perfil)) return
    await db.usuario.update({
      where: { id: usuario.id },
      data: { toursVistos: { push: usuario.perfil } },
    })
  } catch (e) {
    console.error(e)
  }
}
