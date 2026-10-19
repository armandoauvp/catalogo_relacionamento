import { describe, expect, it } from 'vitest'
import { carregarEnv, semVazias } from './env'

const BANCO = 'postgresql://teste:teste@localhost:5432/teste?schema=public'

const PRODUCAO_COMPLETA = {
  NODE_ENV: 'production',
  DATABASE_URL: BANCO,
  AUTH_SECRET: 'segredo',
  AUTH_OIDC_ISSUER: 'https://sso.auvp.com.br/realms/master',
  AUTH_OIDC_CLIENT_ID: 'catalogo_relacionamento',
  AUTH_OIDC_CLIENT_SECRET: 'segredo-do-client',
  AUTH_ALLOWED_EMAIL_DOMAINS: 'auvp.com.br',
}

describe('variável vazia é variável ausente', () => {
  it('tira chave vazia ou só com espaço', () => {
    expect(semVazias({ A: '', B: '  ', C: 'x', D: undefined })).toEqual({ C: 'x' })
  })

  it('o painel da plataforma com chaves vazias cai nos valores padrão', () => {
    // O que a Vercel mandou: chaves criadas, sem valor.
    const env = carregarEnv({
      NODE_ENV: 'development',
      DATABASE_URL: BANCO,
      AUTH_URL: '',
      AUTH_DEV_BYPASS: '',
      CATALOG_PROVIDER: '',
      CLIENT_PROVIDER: '',
    })
    expect(env.AUTH_URL).toBeUndefined()
    expect(env.AUTH_DEV_BYPASS).toBe(false)
    expect(env.CATALOG_PROVIDER).toBe('local')
    expect(env.CLIENT_PROVIDER).toBe('local')
  })

  it('valor de verdade continua sendo validado', () => {
    expect(() =>
      carregarEnv({ NODE_ENV: 'development', DATABASE_URL: BANCO, AUTH_URL: 'não é url' }),
    ).toThrow(/AUTH_URL/)
  })
})

describe('o banco no build e fora dele', () => {
  it('o build compila sem banco nem segredos', () => {
    expect(() =>
      carregarEnv({ NODE_ENV: 'production', DATABASE_URL: '' }, 'phase-production-build'),
    ).not.toThrow()
  })

  it('o processo que serve a aplicação exige o banco', () => {
    expect(() => carregarEnv({ NODE_ENV: 'development' })).toThrow(/DATABASE_URL/)
  })

  it('produção continua exigindo o SSO inteiro e a lista de domínios', () => {
    expect(() => carregarEnv({ ...PRODUCAO_COMPLETA, AUTH_ALLOWED_EMAIL_DOMAINS: '' })).toThrow(
      /AUTH_ALLOWED_EMAIL_DOMAINS/,
    )
    expect(() => carregarEnv(PRODUCAO_COMPLETA)).not.toThrow()
  })

  it('produção recusa o login sem SSO', () => {
    expect(() => carregarEnv({ ...PRODUCAO_COMPLETA, AUTH_DEV_BYPASS: 'true' })).toThrow(
      /AUTH_DEV_BYPASS/,
    )
  })
})

describe('login com o Google', () => {
  const {
    AUTH_OIDC_ISSUER: _i,
    AUTH_OIDC_CLIENT_ID: _c,
    AUTH_OIDC_CLIENT_SECRET: _s,
    ...semKeycloak
  } = PRODUCAO_COMPLETA
  const GOOGLE = { AUTH_GOOGLE_ID: 'id.apps.googleusercontent.com', AUTH_GOOGLE_SECRET: 'segredo' }

  it('a produção sobe só com o Google, sem o Keycloak', () => {
    expect(() => carregarEnv({ ...semKeycloak, ...GOOGLE })).not.toThrow()
  })

  it('sem nenhum login de verdade, a produção não sobe', () => {
    expect(() => carregarEnv(semKeycloak)).toThrow(/AUTH_GOOGLE_ID/)
  })

  it('login pela metade é recusado, mesmo com o outro completo', () => {
    expect(() =>
      carregarEnv({ ...PRODUCAO_COMPLETA, AUTH_GOOGLE_ID: GOOGLE.AUTH_GOOGLE_ID }),
    ).toThrow(/AUTH_GOOGLE_SECRET/)
    expect(() =>
      carregarEnv({ ...semKeycloak, ...GOOGLE, AUTH_OIDC_CLIENT_ID: 'catalogo' }),
    ).toThrow(/AUTH_OIDC_ISSUER/)
  })

  it('o Google continua exigindo a lista de domínios', () => {
    expect(() =>
      carregarEnv({ ...semKeycloak, ...GOOGLE, AUTH_ALLOWED_EMAIL_DOMAINS: '' }),
    ).toThrow(/AUTH_ALLOWED_EMAIL_DOMAINS/)
  })
})

describe('modo demonstração', () => {
  const DEMONSTRACAO = {
    NODE_ENV: 'production',
    DATABASE_URL: BANCO,
    AUTH_SECRET: 'segredo',
    MODO_DEMONSTRACAO: 'true',
    VERCEL: '1',
  }

  it('na Vercel, sobe sem SSO e sem lista de domínios', () => {
    const env = carregarEnv(DEMONSTRACAO)
    expect(env.MODO_DEMONSTRACAO).toBe(true)
  })

  it('continua exigindo o segredo da sessão', () => {
    expect(() => carregarEnv({ ...DEMONSTRACAO, AUTH_SECRET: '' })).toThrow(/AUTH_SECRET/)
  })

  it('fora da Vercel, recusa subir: a imagem da TI nunca tem VERCEL=1', () => {
    const { VERCEL: _vercel, ...semVercel } = DEMONSTRACAO
    expect(() => carregarEnv(semVercel)).toThrow(/só roda na Vercel/)
    expect(() => carregarEnv({ ...DEMONSTRACAO, NODE_ENV: 'development', VERCEL: '' })).toThrow(
      /só roda na Vercel/,
    )
  })

  it('recusa o endereço da produção, mesmo na Vercel', () => {
    expect(() =>
      carregarEnv({
        ...DEMONSTRACAO,
        AUTH_URL: 'https://catalogo-relacionamento.prod.auvp.net',
      }),
    ).toThrow(/endereço da produção/)
  })

  it('recusa subir junto de um login de verdade: a virada exige desligar', () => {
    expect(() =>
      carregarEnv({ ...DEMONSTRACAO, AUTH_GOOGLE_ID: 'id', AUTH_GOOGLE_SECRET: 'segredo' }),
    ).toThrow(/apague MODO_DEMONSTRACAO/)
    expect(() => carregarEnv({ ...DEMONSTRACAO, AUTH_OIDC_CLIENT_ID: 'catalogo' })).toThrow(
      /apague MODO_DEMONSTRACAO/,
    )
  })

  it('desligado, a produção volta a exigir o SSO', () => {
    expect(() => carregarEnv({ ...DEMONSTRACAO, MODO_DEMONSTRACAO: 'false' })).toThrow(
      /SSO é obrigatório/,
    )
  })
})
