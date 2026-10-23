import { z } from 'zod'

/**
 * Validação das variáveis de ambiente no boot.
 *
 * A intenção é falhar cedo e com mensagem legível: uma env faltando derruba o
 * processo na subida, e não no meio de um fluxo do consultor.
 *
 * O que é obrigatório muda por ambiente. Em desenvolvimento só o banco é
 * exigido, para que alguém consiga clonar, subir o Postgres e rodar sem ter
 * credencial de SSO em mãos. Em produção o SSO passa a ser obrigatório.
 */

const booleano = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true')

const listaDeEmails = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  )

const listaDeDominios = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean),
  )

/** Onde a TI publicaria a produção por Docker. Ver docs/10-entrega-ti.md. */
const ENDERECO_DA_PRODUCAO = 'catalogo-relacionamento.prod.auvp.net'

/**
 * Quais logins de verdade estão completos, e quais estão pela metade. Metade
 * configurada é erro de quem preencheu o painel, e não deve passar calada.
 */
function loginsDeVerdade(env: Record<string, unknown>) {
  const estado = (nomes: string[]) => {
    const faltam = nomes.filter((n) => !env[n])
    return { completo: faltam.length === 0, iniciado: faltam.length < nomes.length, faltam }
  }
  return {
    keycloak: estado(['AUTH_OIDC_ISSUER', 'AUTH_OIDC_CLIENT_ID', 'AUTH_OIDC_CLIENT_SECRET']),
    google: estado(['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET']),
  }
}

/** A fase em que o Next roda o `next build`. */
const FASE_DE_BUILD = 'phase-production-build'

const schema = (durandoBuild: boolean) =>
  z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    // O build não abre conexão: o Next só importa as rotas para coletar
    // metadados. Exigir o banco ali obrigaria todo lugar que compila, CI,
    // imagem Docker, Vercel, a ter um endereço em mãos, mesmo que falso.
    DATABASE_URL: durandoBuild
      ? z.string().default('')
      : z.string().min(1, 'DATABASE_URL é obrigatória'),

    AUTH_SECRET: z.string().default(''),
    AUTH_URL: z.string().url().optional(),
    AUTH_OIDC_ISSUER: z.string().default(''),
    AUTH_OIDC_CLIENT_ID: z.string().default(''),
    AUTH_OIDC_CLIENT_SECRET: z.string().default(''),
    AUTH_OIDC_NAME: z.string().default('AUVP SSO'),
    AUTH_OIDC_GROUPS_CLAIM: z.string().default(''),
    // Login com o Google da AUVP: a porta de entrada enquanto o client do
    // Keycloak não existe. Os dois podem conviver na mesma tela.
    AUTH_GOOGLE_ID: z.string().default(''),
    AUTH_GOOGLE_SECRET: z.string().default(''),
    AUTH_DEV_BYPASS: booleano,
    // Aplicação real com dados fictícios e login por perfil, sem SSO. Ver
    // src/lib/demonstracao.ts e as travas em `carregarEnv`.
    MODO_DEMONSTRACAO: booleano,
    // Fase de testes: quem entra escolhe, no menu da conta, o perfil com que vê
    // a ferramenta. Desligar quando os perfis forem delimitados. Ver
    // `perfilEmVigor` em src/lib/permissions.ts.
    PERFIL_LIVRE: booleano,
    // A própria Vercel define `VERCEL=1` em build e runtime; a imagem Docker da
    // TI nunca tem.
    VERCEL: z.string().optional(),
    AUTH_ALLOWED_EMAIL_DOMAINS: listaDeDominios,

    BOOTSTRAP_ADMIN_EMAILS: listaDeEmails,

    STORAGE_ENDPOINT: z.string().default(''),
    STORAGE_REGION: z.string().default('us-east-1'),
    STORAGE_BUCKET: z.string().default(''),
    STORAGE_ACCESS_KEY_ID: z.string().default(''),
    STORAGE_SECRET_ACCESS_KEY: z.string().default(''),

    CATALOG_PROVIDER: z.enum(['local', 'tiny']).default('local'),
    CLIENT_PROVIDER: z.enum(['local', 'salesforce']).default('local'),

    TINY_API_TOKEN: z.string().default(''),
    TINY_API_BASE_URL: z.string().default('https://api.tiny.com.br/api2'),
    // Protege a rota que o agendador chama para esvaziar a fila do Tiny. Sem
    // ele, a rota responde 503: aberta, qualquer um mandaria pedidos.
    CRON_SECRET: z.string().default(''),
    SALESFORCE_INSTANCE_URL: z.string().default(''),
    SALESFORCE_CLIENT_ID: z.string().default(''),
    SALESFORCE_CLIENT_SECRET: z.string().default(''),

    VIACEP_BASE_URL: z.string().default('https://viacep.com.br/ws'),
  })

/**
 * Variável vazia é variável ausente.
 *
 * Painel de plataforma (Vercel, Railway) e `.env` copiado do exemplo costumam
 * criar a chave sem valor. Sem esta limpeza, `AUTH_URL=""` falha como URL
 * inválida e `CATALOG_PROVIDER=""` como opção desconhecida, em vez de cair no
 * valor padrão que vale quando a variável não existe.
 */
export function semVazias(
  fonte: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(fonte).filter(([, valor]) => valor !== undefined && valor.trim() !== ''),
  )
}

/**
 * Lê e valida a configuração. Recebe a fonte e a fase como parâmetros para
 * poder ser testada sem mexer no `process.env` do próprio teste.
 */
export function carregarEnv(
  fonte: Record<string, string | undefined>,
  fase: string | undefined = undefined,
) {
  // Durante `next build` o Next importa cada rota para coletar metadados, com
  // NODE_ENV=production. Exigir credencial de runtime aí obrigaria o build a
  // ter os segredos em mãos, o que quebraria CI e imagem Docker. As exigências
  // de produção valem no processo que serve a aplicação, não no que a compila.
  const durandoBuild = fase === FASE_DE_BUILD
  const parsed = schema(durandoBuild).safeParse(semVazias(fonte))

  if (!parsed.success) {
    const detalhes = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Variáveis de ambiente inválidas:\n${detalhes}`)
  }

  const env = parsed.data

  const logins = loginsDeVerdade(env)

  // O modo demonstração deixa qualquer um com o endereço entrar como Admin de
  // dados fictícios. Por isso travas que não dependem de ninguém lembrar de
  // desligar: só roda na Vercel, nunca no endereço da produção da TI, e nunca
  // junto de um login de verdade. A virada para o uso real é configurar o
  // Google ou o Keycloak; se a demonstração ficar ligada, a aplicação para em
  // vez de abrir as duas portas.
  if (env.MODO_DEMONSTRACAO) {
    if (env.VERCEL !== '1') {
      throw new Error('MODO_DEMONSTRACAO só roda na Vercel. Ver docs/12-producao-vercel.md.')
    }
    if (env.AUTH_URL?.includes(ENDERECO_DA_PRODUCAO)) {
      throw new Error('MODO_DEMONSTRACAO não pode ser ligado no endereço da produção.')
    }
    if (logins.keycloak.iniciado || logins.google.iniciado) {
      throw new Error(
        'MODO_DEMONSTRACAO está ligado junto com um login de verdade. Para o uso real, ' +
          'apague MODO_DEMONSTRACAO. Ver docs/12-producao-vercel.md.',
      )
    }
  }

  if (env.NODE_ENV === 'production' && !durandoBuild) {
    const faltando: string[] = []
    if (!env.AUTH_SECRET) faltando.push('AUTH_SECRET')
    // Na demonstração não há SSO: o login é por perfil fictício.
    if (!env.MODO_DEMONSTRACAO) {
      // Basta um login completo, Google ou Keycloak. O que foi começado precisa
      // ser terminado: client sem secret é botão que não funciona.
      const { keycloak, google } = logins
      if (!keycloak.iniciado && !google.iniciado) {
        faltando.push('AUTH_GOOGLE_ID e AUTH_GOOGLE_SECRET, ou AUTH_OIDC_*')
      }
      if (keycloak.iniciado) faltando.push(...keycloak.faltam)
      if (google.iniciado) faltando.push(...google.faltam)
      // Sem a lista, quem entra depende só de o client estar bem configurado
      // no provedor. Ver src/lib/acesso-sso.ts.
      if (env.AUTH_ALLOWED_EMAIL_DOMAINS.length === 0) faltando.push('AUTH_ALLOWED_EMAIL_DOMAINS')
    }

    if (faltando.length > 0) {
      throw new Error(
        `Em produção o SSO é obrigatório. Faltam: ${faltando.join(', ')}. ` +
          'Ver docs/12-producao-vercel.md.',
      )
    }

    if (env.AUTH_DEV_BYPASS) {
      throw new Error('AUTH_DEV_BYPASS não pode ser habilitado em produção.')
    }
  }

  return env
}

export const env = carregarEnv(process.env, process.env.NEXT_PHASE)

/** Dados fictícios e login por perfil; já passou pelas travas de `carregarEnv`. */
export const modoDemonstracao = env.MODO_DEMONSTRACAO

/**
 * O SSO só está utilizável quando o client OIDC inteiro foi configurado. Na
 * demonstração ele fica de fora mesmo configurado: duas portas de entrada na
 * mesma tela confundiriam quem está testando.
 */
export const ssoConfigurado =
  !env.MODO_DEMONSTRACAO &&
  Boolean(env.AUTH_OIDC_ISSUER) &&
  Boolean(env.AUTH_OIDC_CLIENT_ID) &&
  Boolean(env.AUTH_OIDC_CLIENT_SECRET)

/** Login com o Google da AUVP, quando o client OAuth está inteiro. */
export const googleConfigurado =
  !env.MODO_DEMONSTRACAO && Boolean(env.AUTH_GOOGLE_ID) && Boolean(env.AUTH_GOOGLE_SECRET)

/** Fase de testes em que qualquer conta escolhe o perfil; ver `perfilEmVigor`. */
export const perfilLivre = env.PERFIL_LIVRE

/** O Tiny só é chamado com o token em mãos; sem ele, nada entra na fila. */
export const tinyConfigurado = Boolean(env.TINY_API_TOKEN)

/** Login sem SSO, apenas em desenvolvimento e apenas se explicitamente ligado. */
export const devBypassHabilitado = env.AUTH_DEV_BYPASS && env.NODE_ENV === 'development'
