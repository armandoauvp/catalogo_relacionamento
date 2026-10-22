/**
 * CPF é a chave de deduplicação de cliente, então ele é sempre gravado
 * normalizado (só dígitos). A máscara é assunto de exibição.
 */

export function normalizarCpf(valor: string): string {
  return valor.replace(/\D/g, '')
}

export function formatarCpf(valor: string): string {
  const d = normalizarCpf(valor)
  if (d.length !== 11) return valor
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/**
 * Máscara progressiva, para o campo que está sendo digitado.
 *
 * Diferente de `formatarCpf`, que só formata CPF completo: aqui o valor é
 * parcial por definição, e pontuar enquanto se digita é o que faz a pessoa
 * perceber que pulou um número antes de terminar.
 */
export function mascaraDeCpf(valor: string): string {
  const d = normalizarCpf(valor).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** Mascara para exibição a quem não tem permissão de ver o dado completo. */
export function mascararCpf(valor: string): string {
  const d = normalizarCpf(valor)
  if (d.length !== 11) return '***'
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`
}

/** Validação pelos dois dígitos verificadores. */
export function cpfValido(valor: string): boolean {
  const d = normalizarCpf(valor)
  if (d.length !== 11) return false
  // Sequências repetidas passam no cálculo do dígito, mas não são CPFs válidos.
  if (/^(\d)\1{10}$/.test(d)) return false

  const digito = (ate: number): number => {
    let soma = 0
    let peso = ate + 1
    for (let i = 0; i < ate; i++) {
      soma += Number(d[i]) * peso
      peso--
    }
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }

  return digito(9) === Number(d[9]) && digito(10) === Number(d[10])
}

/**
 * CNPJ pelos dois dígitos verificadores. A importação em lote do Tiny aceita
 * empresa como destinatário, como o AUVP-Eventos aceitava.
 */
export function cnpjValido(valor: string): boolean {
  const d = valor.replace(/\D/g, '')
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false

  const digito = (ate: number): number => {
    const pesos =
      ate === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const soma = pesos.reduce((s, peso, i) => s + Number(d[i]) * peso, 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  return digito(12) === Number(d[12]) && digito(13) === Number(d[13])
}

/**
 * Telefone brasileiro para exibição.
 *
 * Gravado só com dígitos, como o CPF: a máscara é assunto de tela.
 */
export function formatarTelefone(valor: string | null | undefined): string {
  const d = (valor ?? '').replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return valor ?? ''
}
