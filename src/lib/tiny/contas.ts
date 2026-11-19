import type { ContaTiny } from '@prisma/client'

export type { ContaTiny }

/**
 * As contas do Tiny da AUVP. Cada empresa tem a sua, com produtos, contatos e
 * pedidos próprios: o mesmo SKU pode existir numa e não na outra. Cada pedido
 * guarda a conta para onde vai, e a fila usa o token daquela conta.
 *
 * Os tokens moram só no servidor (`tokenDoTiny`, em `env.ts`); aqui ficam o
 * nome e a ordem, que a tela também usa.
 */
export const CONTAS_TINY = [
  'consultoria',
  'dns',
  'supernova',
] as const satisfies readonly ContaTiny[]

/** Onde os presentes do Relacionamento sempre foram, e o que vale sem escolha. */
export const CONTA_PADRAO: ContaTiny = 'consultoria'

export const NOME_DA_CONTA: Record<ContaTiny, string> = {
  consultoria: 'AUVP Consultoria',
  dns: 'Do Not Scare',
  supernova: 'Super Nova',
}

/** A variável da Vercel de cada conta, para a tela dizer o que falta. */
export const VARIAVEL_DO_TOKEN: Record<ContaTiny, string> = {
  consultoria: 'TINY_API_TOKEN',
  dns: 'TINY_API_TOKEN_DNS',
  supernova: 'TINY_API_TOKEN_SUPERNOVA',
}

export function ehContaTiny(valor: unknown): valor is ContaTiny {
  return typeof valor === 'string' && (CONTAS_TINY as readonly string[]).includes(valor)
}

/** A conta da URL (`?conta=dns`); o que não for uma delas vale a padrão. */
export function contaDoParametro(valor: string | string[] | null | undefined): ContaTiny {
  const v = Array.isArray(valor) ? valor[0] : valor
  return ehContaTiny(v) ? v : CONTA_PADRAO
}

/** O endereço levando a conta junto, para a tela seguinte ler a mesma conta. */
export function comConta<T extends string>(caminho: T, conta: ContaTiny): T {
  return `${caminho}${caminho.includes('?') ? '&' : '?'}conta=${conta}` as T
}
