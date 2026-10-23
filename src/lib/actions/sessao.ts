'use server'

import type { Route } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getToken } from 'next-auth/jwt'
import { Perfil } from '@prisma/client'
import { signOut, unstable_update } from '@/lib/auth'
import { usuarioAtual } from '@/lib/auth-guards'
import { env, perfilLivre } from '@/lib/env'
import { endSessionEndpoint, urlDeSaidaDoSso } from '@/lib/sessao-sso'

/**
 * "Sair": encerra a sessão da ferramenta e, para quem entrou pelo SSO, a do
 * Keycloak também. Ver `src/lib/sessao-sso.ts` para o porquê.
 */
export async function sair() {
  const cabecalhos = await headers()

  // O nome do cookie muda com HTTPS (`__Secure-`), e atrás do proxy da TI o
  // processo não sabe qual dos dois o navegador recebeu. Tenta os dois.
  const lerToken = (secureCookie: boolean) =>
    getToken({ req: { headers: cabecalhos }, secret: env.AUTH_SECRET, secureCookie })
  const token = (await lerToken(true)) ?? (await lerToken(false))

  const base =
    env.AUTH_URL ??
    `${cabecalhos.get('x-forwarded-proto') ?? 'http'}://${cabecalhos.get('host') ?? 'localhost:3000'}`
  const voltarPara = new URL('/login', base).toString()

  const destino = urlDeSaidaDoSso({
    endSessionEndpoint: token?.idToken ? await endSessionEndpoint(env.AUTH_OIDC_ISSUER) : null,
    idToken: token?.idToken,
    clientId: env.AUTH_OIDC_CLIENT_ID,
    voltarPara,
  })

  await signOut({ redirect: false })
  // Rotas tipadas só conhecem as internas; o endereço do Keycloak é externo.
  if (destino) redirect(destino as Route)
  redirect('/login')
}

/**
 * Fase de testes: troca o perfil com que a pessoa vê a ferramenta. Não mexe no
 * cadastro; ver `perfilEmVigor`. Volta para o início porque a tela atual pode
 * não existir para o perfil novo.
 */
export async function verComoPerfil(perfil: Perfil) {
  if (!perfilLivre) throw new Error('A troca de perfil está desligada.')
  if (!Object.values(Perfil).includes(perfil)) throw new Error('Perfil desconhecido.')
  if (!(await usuarioAtual())) redirect('/login')

  await unstable_update({ user: { perfil } })
  redirect('/')
}
