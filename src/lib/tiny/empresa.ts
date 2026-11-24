import { NOME_DA_CONTA, VARIAVEL_DO_TOKEN, type ContaTiny } from './contas'

/**
 * A trava contra token trocado. Em novembro de 2026 o token da Do Not Scare
 * foi cadastrado na variável da Consultoria e o inverso: a tela "Consultoria"
 * listava pedidos da DNS, e presente aprovado iria para o Tiny errado. Antes de
 * falar com uma conta, a API pergunta ao Tiny de quem é o token (`info.php`) e
 * confere com o nome esperado aqui.
 *
 * Pelo nome, porque o CNPJ de cada empresa não está registrado no projeto. O
 * Tiny da Do Not Scare está em nome da Investidor Sardinha.
 */
const EMPRESA_ESPERADA: Record<ContaTiny, RegExp> = {
  consultoria: /auvp\s+consultoria/i,
  dns: /do\s*not\s*scare|investidor\s+sardinha/i,
  supernova: /super\s*nova/i,
}

export type EmpresaDoTiny = { razaoSocial: string; fantasia: string }

/** A empresa de `retorno.conta`, como o `info.php` devolve. */
export function lerEmpresa(retorno: Record<string, unknown>): EmpresaDoTiny {
  const conta = (retorno.conta ?? {}) as Record<string, unknown>
  const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  return { razaoSocial: texto(conta.razao_social), fantasia: texto(conta.fantasia) }
}

/** Para qual das contas o nome aponta; nula quando não é nenhuma delas. */
export function contaDaEmpresa(empresa: EmpresaDoTiny): ContaTiny | null {
  const nomes = `${empresa.razaoSocial} ${empresa.fantasia}`
  const contas = Object.keys(EMPRESA_ESPERADA) as ContaTiny[]
  return contas.find((c) => EMPRESA_ESPERADA[c].test(nomes)) ?? null
}

/**
 * Nulo quando o token é mesmo da conta; senão, o que dizer a quem cadastrou.
 * A Do Not Scare em nome da Investidor Sardinha conta como DNS.
 */
export function problemaDaEmpresa(conta: ContaTiny, empresa: EmpresaDoTiny): string | null {
  if (contaDaEmpresa(empresa) === conta) return null
  const nome = empresa.fantasia || empresa.razaoSocial || 'outra empresa'
  return (
    `O token em ${VARIAVEL_DO_TOKEN[conta]} é do Tiny de ${nome}, não da ${NOME_DA_CONTA[conta]}. ` +
    'Nada foi lido nem enviado por ele. Corrija o valor na Vercel e faça um novo deploy.'
  )
}
