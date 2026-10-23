import { timingSafeEqual } from 'node:crypto'

/**
 * Confere `Authorization: Bearer <segredo>` sem vazar, pelo tempo de resposta,
 * quantos caracteres batem. Segredo vazio nunca confere: rota sem segredo
 * configurado fica fechada, e não aberta.
 */
export function bearerConfere(cabecalho: string | null, segredo: string): boolean {
  if (!segredo) return false
  const recebido = Buffer.from(cabecalho ?? '')
  const esperado = Buffer.from(`Bearer ${segredo}`)
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado)
}
