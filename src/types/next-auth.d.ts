import type { Perfil } from '@prisma/client'
import type { DefaultSession } from 'next-auth'

/**
 * Perfil e id do usuário viajam na sessão para que a UI decida o que mostrar
 * sem uma consulta extra a cada render. A autorização de verdade continua
 * sendo feita no servidor, em `auth-guards.ts`.
 *
 * O JWT é aumentado em `@auth/core/jwt`, e não em `next-auth/jwt`: no NextAuth
 * v5 a interface mora no core, e augmentar só o reexport não chega ao tipo que
 * os callbacks recebem.
 */

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      perfil: Perfil
      ativo: boolean
    } & DefaultSession['user']
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    usuarioId?: string
    perfil?: Perfil
    /** Escolhido no menu da conta; só vale com `PERFIL_LIVRE`. */
    perfilEscolhido?: Perfil
    ativo?: boolean
    /** Só de quem entrou pelo SSO; ver `src/lib/sessao-sso.ts`. */
    idToken?: string
  }
}

export {}
