'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { marcarAvisosComoLidos } from '@/lib/actions/notificacoes'

/**
 * Abrir a tela é ler: os avisos novos continuam destacados nesta visita, que
 * veio do servidor antes da marcação, e o número do sininho cai em seguida.
 */
export function MarcarLidos({ haNovos }: { haNovos: boolean }) {
  const router = useRouter()
  const feito = useRef(false)

  useEffect(() => {
    if (!haNovos || feito.current) return
    feito.current = true
    marcarAvisosComoLidos().then(() => router.refresh())
  }, [haNovos, router])

  return null
}
