import NextAuth, { type NextAuthConfig } from 'next-auth'
import type { Provider } from 'next-auth/providers'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { Perfil } from '@prisma/client'
import { emailPodeEntrar } from './acesso-sso'
import { db } from './db'
import { usuarioDaDemonstracao } from './demonstracao'
import {
  devBypassHabilitado,
  env,
  googleConfigurado,
  modoDemonstracao,
  perfilLivre,
  ssoConfigurado,
} from './env'
import { perfilEmVigor } from './permissions'

/**
 * Autenticação por SSO da AUVP (OIDC). Não existe senha própria.
 *
 * Duas decisões de desenho:
 *
 * 1. Sessão em JWT, sem adapter de banco. O provedor de identidade é a
 *    autoridade sobre quem é a pessoa; o banco é a autoridade sobre perfil e
 *    limite mensal. Misturar os dois num adapter faria a área depender de TI
 *    para mudar um perfil, que é exatamente o que a spec quer evitar.
 *
 * 2. O perfil é relido do banco a cada renovação do token, e não fixado no
 *    login. Assim, promover alguém a Admin passa a valer na próxima navegação,
 *    sem exigir que a pessoa saia e entre de novo.
 *
 * Dois provedores podem conviver: o Google da AUVP, que destravou a produção
 * na Vercel, e o Keycloak, realm `master`, quando a TI entregar o client. O
 * usuário é casado pelo e-mail, então quem entrou por um entra pelo outro com
 * o mesmo perfil. Ver docs/12-producao-vercel.md.
 */

function montarProviders(): Provider[] {
  const providers: Provider[] = []

  if (ssoConfigurado) {
    providers.push({
      id: 'auvp',
      name: env.AUTH_OIDC_NAME,
      type: 'oidc',
      issuer: env.AUTH_OIDC_ISSUER,
      clientId: env.AUTH_OIDC_CLIENT_ID,
      clientSecret: env.AUTH_OIDC_CLIENT_SECRET,
      authorization: { params: { scope: 'openid profile email' } },
      checks: ['pkce', 'state'],
    })
  }

  if (googleConfigurado) {
    // Com um domínio só, o Google já abre na conta da AUVP e esconde as
    // pessoais. É conforto, não trava: quem barra conta de fora é o `signIn`.
    const dominio =
      env.AUTH_ALLOWED_EMAIL_DOMAINS.length === 1 ? env.AUTH_ALLOWED_EMAIL_DOMAINS[0] : undefined
    providers.push(
      Google({
        clientId: env.AUTH_GOOGLE_ID,
        clientSecret: env.AUTH_GOOGLE_SECRET,
        authorization: {
          params: { prompt: 'select_account', ...(dominio ? { hd: dominio } : {}) },
        },
      }),
    )
  }

  // Atalho de desenvolvimento: entrar informando um e-mail, sem SSO.
  // `devBypassHabilitado` já exige NODE_ENV=development, e `env.ts` derruba o
  // boot se alguém tentar ligar a flag em produção.
  if (devBypassHabilitado) {
    providers.push(
      Credentials({
        id: 'dev',
        name: 'Desenvolvimento (sem SSO)',
        credentials: {
          email: { label: 'E-mail', type: 'email' },
          nome: { label: 'Nome', type: 'text' },
        },
        authorize: async (credenciais) => {
          const email = String(credenciais?.email ?? '')
            .trim()
            .toLowerCase()
          if (!email) return null

          return {
            id: email,
            email,
            name: String(credenciais?.nome ?? '') || email.split('@')[0]!,
          }
        },
      }),
    )
  }

  // Demonstração: entra quem escolhe um dos perfis fictícios na tela de login.
  // Nenhum e-mail fora de `USUARIOS_DA_DEMONSTRACAO` passa, e o modo só liga
  // na Vercel (ver as travas em env.ts).
  if (modoDemonstracao) {
    providers.push(
      Credentials({
        id: 'demonstracao',
        name: 'Demonstração',
        credentials: { email: { label: 'E-mail', type: 'email' } },
        authorize: async (credenciais) => {
          const usuario = usuarioDaDemonstracao(credenciais?.email)
          if (!usuario) return null
          return { id: usuario.email, email: usuario.email, name: usuario.nome }
        },
      }),
    )
  }

  return providers
}

/**
 * Cria ou atualiza o espelho local do usuário do SSO.
 *
 * O primeiro login cria com perfil `consultor`. A exceção é
 * `BOOTSTRAP_ADMIN_EMAILS`: sem ela o primeiro usuário do ambiente entraria
 * como consultor e não haveria ninguém com poder de promover ninguém.
 */
export async function sincronizarUsuario(dados: {
  email: string
  nome: string
  ssoSubject?: string | null
  /** Perfil de quem ainda não existe. Só a demonstração usa: o perfil do cartão. */
  perfilInicial?: Perfil
}) {
  const email = dados.email.trim().toLowerCase()
  const ehBootstrapAdmin = env.BOOTSTRAP_ADMIN_EMAILS.includes(email)

  return db.usuario.upsert({
    where: { email },
    create: {
      email,
      nome: dados.nome || email,
      ssoSubject: dados.ssoSubject ?? null,
      perfil: ehBootstrapAdmin ? Perfil.admin : (dados.perfilInicial ?? Perfil.consultor),
    },
    update: {
      // O nome acompanha o provedor de identidade. Perfil e limite mensal, não:
      // são geridos pelo Admin dentro da ferramenta.
      nome: dados.nome || undefined,
      ssoSubject: dados.ssoSubject ?? undefined,
      ...(ehBootstrapAdmin ? { perfil: Perfil.admin } : {}),
    },
    select: { id: true, perfil: true, ativo: true, nome: true, email: true },
  })
}

export const authConfig: NextAuthConfig = {
  providers: montarProviders(),
  session: { strategy: 'jwt' },
  // Recusa de acesso volta para a tela de login, que explica o motivo, em vez
  // da página de erro padrão do NextAuth, em inglês e sem a marca.
  pages: { signIn: '/login', error: '/login' },
  trustHost: true,
  callbacks: {
    async signIn({ user, profile, account }) {
      const email = (user.email ?? profile?.email)?.toLowerCase()
      if (!email) return false

      // Antes de criar o usuário: conta de fora não chega a existir no banco.
      const verificado = profile?.email_verified as boolean | null | undefined
      if (!emailPodeEntrar(email, env.AUTH_ALLOWED_EMAIL_DOMAINS, verificado)) return false

      const registro = await sincronizarUsuario({
        email,
        nome: user.name ?? profile?.name ?? '',
        ssoSubject: profile?.sub ?? null,
        perfilInicial:
          account?.provider === 'demonstracao' ? usuarioDaDemonstracao(email)?.perfil : undefined,
      })

      // Usuário desativado pelo Admin não entra, mesmo com SSO válido.
      return registro.ativo
    },

    async jwt({ token, account, trigger, session }) {
      // Guardado só para o "Sair" encerrar também a sessão do Keycloak. Fica
      // no JWT, que é cifrado no cookie, e não vai para a sessão do navegador.
      if (account?.provider === 'auvp' && account.id_token) token.idToken = account.id_token

      // Só `verComoPerfil` dispara o update. O valor fica como veio e é
      // conferido por `perfilEmVigor` logo abaixo, a cada renovação.
      if (trigger === 'update' && perfilLivre) {
        const escolhido = (session as { user?: { perfil?: Perfil } } | undefined)?.user?.perfil
        token.perfilEscolhido = escolhido
      }

      if (!token.email) return token

      const usuario = await db.usuario.findUnique({
        where: { email: token.email.toLowerCase() },
        select: { id: true, perfil: true, ativo: true, nome: true },
      })

      if (usuario) {
        token.usuarioId = usuario.id
        token.perfil = perfilEmVigor(usuario.perfil, token.perfilEscolhido, perfilLivre)
        token.ativo = usuario.ativo
        token.name = usuario.nome
      }

      return token
    },

    async session({ session, token }) {
      if (token.usuarioId) {
        session.user.id = token.usuarioId
        session.user.perfil = token.perfil ?? Perfil.consultor
        session.user.ativo = token.ativo ?? true
      }
      return session
    },
  },
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth(authConfig)
