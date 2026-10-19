import { Perfil } from '@prisma/client'

/**
 * Os usuários fictícios: os do seed e os únicos que entram no modo
 * demonstração.
 *
 * Um lugar só para os dois porque o login da demonstração não aceita e-mail
 * digitado, só um destes. Se a lista do seed e a do login divergissem, ou o
 * cartão levaria a um usuário que não existe, ou o seed criaria alguém que
 * ninguém consegue usar.
 *
 * O modo demonstração em si é ligado por `MODO_DEMONSTRACAO` e travado em
 * `env.ts`. Ver docs/12-producao-vercel.md.
 */

export type UsuarioDaDemonstracao = {
  nome: string
  email: string
  perfil: Perfil
  limiteMensal?: string
  /** O que este perfil mostra, para o cartão do login. */
  oQueVe: string
}

export const USUARIOS_DA_DEMONSTRACAO: readonly UsuarioDaDemonstracao[] = [
  {
    nome: 'Bia Relacionamento',
    email: 'bia@auvp.com.br',
    perfil: Perfil.admin,
    oQueVe: 'Tudo: gestão, aprovação, cadastros e o dashboard.',
  },
  {
    nome: 'Carlos Consultor',
    email: 'carlos@auvp.com.br',
    perfil: Perfil.consultor,
    limiteMensal: '5000.00',
    oQueVe: 'Pede presentes e acompanha só as próprias solicitações.',
  },
  {
    nome: 'Fernanda Consultora',
    email: 'fernanda@auvp.com.br',
    perfil: Perfil.consultor,
    limiteMensal: '3000.00',
    oQueVe: 'Outra consultora, com limite mensal menor.',
  },
  {
    nome: 'Financeiro AUVP',
    email: 'financeiro@auvp.com.br',
    perfil: Perfil.financeiro,
    oQueVe: 'A fila de compras e a mudança de status.',
  },
  {
    nome: 'Logística AUVP',
    email: 'logistica@auvp.com.br',
    perfil: Perfil.logistica,
    oQueVe: 'O Dashboard Logístico e a expedição.',
  },
]

/** O usuário da demonstração com este e-mail, ou nulo. Nada fora da lista entra. */
export function usuarioDaDemonstracao(email: unknown): UsuarioDaDemonstracao | null {
  const normalizado = String(email ?? '')
    .trim()
    .toLowerCase()
  return USUARIOS_DA_DEMONSTRACAO.find((u) => u.email === normalizado) ?? null
}
