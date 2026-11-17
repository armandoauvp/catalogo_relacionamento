import type { ItemDaFaq } from './faq'

/**
 * Busca da FAQ da Caixinha: sem IA e sem servidor, roda no navegador a cada
 * letra digitada.
 *
 * Ignora acento, maiúscula e pontuação, e entende alguns sinônimos do jeito
 * que a área fala ("presente" e "solicitação" são a mesma coisa para quem
 * pergunta). Palavra encontrada na pergunta vale mais que nas palavras-chave,
 * que valem mais que na resposta. Quem encontra todas as palavras digitadas
 * vem antes de quem encontra só parte.
 */

/** Sem acento, minúsculo, só letras, números e espaço. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Palavras que não ajudam a achar nada.
const VAZIAS = new Set(
  (
    'a o as os um uma de da do das dos e em no na nos nas para pra por com que como onde ' +
    'qual quais eu meu minha meus minhas se ja ou me faco fazer posso esta ao aos mais ' +
    'muito quando porque agora'
  ).split(' '),
)

// Grupos de palavras que a pessoa usa no lugar umas das outras.
const SINONIMOS: string[][] = [
  ['presente', 'solicitacao', 'pedido', 'brinde'],
  ['entregue', 'recebeu', 'chegou', 'recebimento'],
  ['rastreio', 'rastreamento', 'codigo', 'correios'],
  ['comprar', 'compra', 'comprado', 'compras'],
  ['limite', 'saldo', 'gasto', 'orcamento', 'verba'],
  ['aprovar', 'aprovacao', 'aprovado', 'liberar'],
  ['carta', 'mensagem', 'cartao', 'bilhete'],
  ['cancelar', 'cancelamento', 'desistir'],
  ['perfil', 'acesso', 'permissao'],
  ['planilha', 'excel', 'csv', 'exportar'],
]

const GRUPO = new Map<string, string[]>()
for (const grupo of SINONIMOS) for (const palavra of grupo) GRUPO.set(palavra, grupo)

/** Palavras úteis da busca, já normalizadas. */
export function palavrasDaBusca(termo: string): string[] {
  return normalizar(termo)
    .split(' ')
    .filter((p) => p.length >= 2 && !VAZIAS.has(p))
}

/** A palavra digitada e os sinônimos dela. */
function variantes(palavra: string): string[] {
  return GRUPO.get(palavra) ?? [palavra]
}

/** Alguma palavra do texto começa com alguma das variantes ("rastre" acha "rastreio"). */
function contem(palavrasDoTexto: string[], alvo: string[]): boolean {
  return palavrasDoTexto.some((p) => alvo.some((a) => p.startsWith(a)))
}

const PESO = { pergunta: 3, termos: 2, resposta: 1 }

/**
 * As perguntas que casam com o termo, da mais à menos relevante. Sem termo,
 * devolve os destaques primeiro e depois o resto, na ordem da lista.
 */
export function buscarNaFaq(itens: ItemDaFaq[], termo: string): ItemDaFaq[] {
  const palavras = palavrasDaBusca(termo)
  if (palavras.length === 0) {
    return [...itens.filter((i) => i.destaque), ...itens.filter((i) => !i.destaque)]
  }
  const pontuados = itens.map((item, ordem) => {
    const pergunta = normalizar(item.pergunta).split(' ')
    const termos = normalizar((item.termos ?? []).join(' ')).split(' ')
    const resposta = normalizar(item.resposta).split(' ')
    let pontos = 0
    let achadas = 0
    for (const palavra of palavras) {
      const alvo = variantes(palavra)
      const nota = contem(pergunta, alvo)
        ? PESO.pergunta
        : contem(termos, alvo)
          ? PESO.termos
          : contem(resposta, alvo)
            ? PESO.resposta
            : 0
      pontos += nota
      if (nota > 0) achadas++
    }
    return { item, pontos, achadas, ordem }
  })
  return pontuados
    .filter((p) => p.pontos > 0)
    .sort((a, b) => b.achadas - a.achadas || b.pontos - a.pontos || a.ordem - b.ordem)
    .map((p) => p.item)
}
