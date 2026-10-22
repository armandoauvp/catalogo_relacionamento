/**
 * O que fazer com cada erro do Tiny. Função pura, para a fila e os testes
 * decidirem do mesmo jeito.
 *
 * Códigos da tabela "Códigos de erros" da API v2 (docs/13-tiny.md).
 */

export class ErroDoTiny extends Error {
  constructor(
    mensagem: string,
    /** `codigo_erro` do Tiny; nulo quando o erro foi de rede ou de HTTP. */
    readonly codigo: number | null,
  ) {
    super(mensagem)
    this.name = 'ErroDoTiny'
  }
}

/**
 * - `temporario`: excesso de acessos, rede, manutenção. Tenta de novo depois.
 * - `configuracao`: token ausente ou inválido, conta bloqueada. Não adianta
 *   insistir com os outros pedidos: a rodada para e eles esperam.
 * - `duplicidade`: o Tiny já tem esse registro. Provável pedido criado numa
 *   tentativa que caiu antes da resposta.
 * - `recusado`: validação. Repetir dá o mesmo erro; alguém precisa corrigir.
 */
export type TipoDeErro = 'temporario' | 'configuracao' | 'duplicidade' | 'recusado'

const TEMPORARIOS = new Set([6, 11, 35, 99])
const DE_CONFIGURACAO = new Set([1, 2, 5, 7, 8])
const DE_DUPLICIDADE = new Set([9, 30, 33])

export function classificarErro(erro: unknown): TipoDeErro {
  if (!(erro instanceof ErroDoTiny)) return 'temporario'
  if (erro.codigo === null || TEMPORARIOS.has(erro.codigo)) return 'temporario'
  if (DE_CONFIGURACAO.has(erro.codigo)) return 'configuracao'
  if (DE_DUPLICIDADE.has(erro.codigo) || /duplicidade|j[áa] cadastrad/i.test(erro.message)) {
    return 'duplicidade'
  }
  return 'recusado'
}

/** Depois disto, o pedido para de tentar sozinho e espera alguém reenviar. */
export const MAX_TENTATIVAS = 6

/** 1, 5, 15, 30 e 60 minutos: o bloqueio por excesso de acessos dura um minuto. */
const ESPERAS_EM_MINUTOS = [1, 5, 15, 30, 60]

export function proximaTentativa(tentativasFeitas: number, agora: Date): Date {
  const minutos = ESPERAS_EM_MINUTOS[Math.min(tentativasFeitas, ESPERAS_EM_MINUTOS.length) - 1] ?? 1
  return new Date(agora.getTime() + minutos * 60_000)
}

/** Junta as mensagens de erro do retorno, de onde quer que o Tiny as ponha. */
export function coletarErros(retorno: Record<string, unknown>): string {
  const mensagens: string[] = []
  const coletar = (erros: unknown) => {
    for (const e of Array.isArray(erros) ? erros : erros ? [erros] : []) {
      const texto = typeof e === 'string' ? e : (e as { erro?: unknown })?.erro
      if (texto) mensagens.push(String(texto))
    }
  }
  coletar(retorno.erros)
  const registros = Array.isArray(retorno.registros)
    ? retorno.registros
    : retorno.registros
      ? [retorno.registros]
      : []
  for (const r of registros) {
    const registro = (r as { registro?: { erros?: unknown } })?.registro ?? r
    coletar((registro as { erros?: unknown }).erros)
  }
  return [...new Set(mensagens)].join(' ')
}
