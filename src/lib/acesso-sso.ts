import { Perfil } from '@prisma/client'

/**
 * Quem pode entrar pelo SSO, antes de qualquer perfil.
 *
 * O provedor de identidade diz quem a pessoa é; ele não diz se ela é da AUVP.
 * Um client OIDC criado como "externo" por engano, erro comum no Google,
 * aceitaria qualquer conta, e o primeiro login cria o usuário como consultor.
 * Esta trava não depende de o provedor estar bem configurado.
 */

/** Separa o domínio do e-mail, em minúsculas. Sem "@", não há domínio. */
export function dominioDoEmail(email: string): string | null {
  const arroba = email.lastIndexOf('@')
  if (arroba < 1 || arroba === email.length - 1) return null
  return email
    .slice(arroba + 1)
    .trim()
    .toLowerCase()
}

/**
 * O e-mail pode entrar?
 *
 * Lista vazia libera qualquer domínio: é o caso do desenvolvimento, e
 * `env.ts` recusa produção sem a lista. O domínio casa inteiro, então
 * `auvp.com.br` não deixa passar `falsoauvp.com.br`.
 *
 * `emailVerificado` só barra quando o provedor diz explicitamente que não
 * verificou. Provedor que não manda o claim não é tratado como recusa, senão
 * a trava dependeria de um detalhe de cada provedor.
 */
export function emailPodeEntrar(
  email: string,
  dominiosPermitidos: readonly string[],
  emailVerificado?: boolean | null,
): boolean {
  if (emailVerificado === false) return false
  if (dominiosPermitidos.length === 0) return true

  const dominio = dominioDoEmail(email)
  if (!dominio) return false
  return dominiosPermitidos.includes(dominio)
}

/**
 * Quem é da consultoria entra como Consultor (pedido de 27/11/2026): o
 * domínio já diz a área, e o Admin não precisa promover um por um. O resto
 * entra como Colaborador AUVP, o perfil de menos acesso.
 */
export const DOMINIO_DOS_CONSULTORES = 'auvpconsultoria.com.br'

export function perfilDeEntrada(email: string): Perfil {
  return dominioDoEmail(email) === DOMINIO_DOS_CONSULTORES ? Perfil.consultor : Perfil.colaborador
}
