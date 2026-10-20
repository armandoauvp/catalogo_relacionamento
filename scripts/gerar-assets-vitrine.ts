/**
 * Emite os assets que a vitrine estática precisa e que vivem fora dela:
 * `demo/ilustracoes.js`, `demo/icones.js` e as fotos de produto.
 *
 * A vitrine é HTML servido sem bundler, então não consegue importar
 * `src/lib/ilustracoes.ts` nem `lucide-react`. Copiar à mão criaria duas fontes
 * que divergem na primeira alteração; gerar no build mantém uma só.
 *
 * Roda como parte de `npm run demo:build`.
 */
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ILUSTRACOES } from '../src/lib/ilustracoes'
import { CATALOGO_AUVP, CATEGORIAS_AUVP, slugDoProduto } from '../prisma/catalogo-auvp'

// --- ilustrações -----------------------------------------------------------
writeFileSync(
  'demo/ilustracoes.js',
  `/* Gerado por scripts/gerar-assets-vitrine.ts: não editar à mão.
   A fonte é src/lib/ilustracoes.ts. */
const ILUSTRACOES = ${JSON.stringify(
    Object.fromEntries(Object.entries(ILUSTRACOES).map(([k, v]) => [k, v.path])),
    null,
    2,
  )}
`,
)

// --- ícones ----------------------------------------------------------------
/**
 * Extrai o traçado dos ícones do lucide direto do pacote instalado, para que a
 * vitrine use exatamente os mesmos desenhos da aplicação e da Central.
 */
const ICONES: Record<string, string> = {
  'layout-grid': 'todos',
  'cup-soda': 'canecas e garrafas',
  shirt: 'vestuário',
  'notebook-pen': 'papelaria',
  gem: 'acessórios',
  wine: 'bebidas',
  // Categorias da planilha da área, com os mesmos ícones de
  // `visualDaCategoria` em `src/lib/categorias.ts`.
  baby: 'bebês e crianças',
  'book-open': 'livro',
  sparkles: 'beleza e bem estar',
  house: 'casa & mesa',
  boxes: 'sacolas & caixas',
  package: 'padrao',
  'rotate-cw': 'girar',

  // Selos do catálogo, os mesmos de `src/components/selos-do-produto.tsx`.
  'link-2': 'selo:acompanhamento',
  'package-check': 'selo:pronta',
  clock: 'selo:encomenda',

  // Ícones do menu superior, os mesmos de `src/components/nav.tsx`.
  gift: 'tela:catalogo',
  'square-pen': 'tela:nova',
  'list-checks': 'tela:minhas',
  'shopping-cart': 'tela:compras',
  truck: 'tela:expedicao',
  warehouse: 'tela:logistica',
  'table-2': 'tela:gestao',
  'user-square': 'tela:clientes',
  users: 'tela:usuarios',
  'settings-2': 'tela:administracao',
}

const svgs: Record<string, string> = {}

/**
 * Lê o traçado de um ícone do lucide.
 *
 * Alguns nomes são apenas apelidos, `user-square.js` só reexporta
 * `square-user.js`, então a leitura segue a indireção antes de tentar
 * extrair as formas.
 */
function lerIcone(arquivo: string, saltos = 0): string {
  if (saltos > 3) throw new Error(`Cadeia de apelidos longa demais: ${arquivo}`)

  const fonte = readFileSync(`node_modules/lucide-react/dist/esm/icons/${arquivo}.js`, 'utf8')
  const apelido = fonte.match(/export \{ default \} from '\.\/([\w-]+)\.js'/)
  if (apelido) return lerIcone(apelido[1]!, saltos + 1)

  return fonte
}

for (const [arquivo, chave] of Object.entries(ICONES)) {
  const fonte = lerIcone(arquivo)
  // Traçado longo vem quebrado em várias linhas no pacote, então o casamento
  // precisa atravessar quebras de linha.
  const nos = [...fonte.matchAll(/\[\s*"(\w+)",\s*\{([\s\S]*?)\}\s*\]/g)]

  const markup = nos
    .map(([, tag, atributos]) => {
      const pares = [...atributos!.matchAll(/(\w[\w-]*):\s*"([^"]*)"/g)]
        .filter(([, nome]) => nome !== 'key')
        .map(([, nome, valor]) => `${nome}="${valor}"`)
        .join(' ')
      return `<${tag} ${pares} />`
    })
    .join('')

  if (!markup) throw new Error(`Ícone sem traçado: ${arquivo}`)
  svgs[chave] = markup
}

// Produtos usa o mesmo traçado de `padrao` (o pacote), como no menu da aplicação.
svgs['tela:produtos'] = svgs.padrao!

// Dois nomes para o mesmo desenho: a planilha da área usa "Bebida" no
// singular, e "Personalizado AUVP" reaproveita o ícone de acessórios, como a
// aplicação faz em `visualDaCategoria`.
const APELIDOS: Record<string, string> = {
  bebida: 'bebidas',
  'personalizado auvp': 'acessórios',
}
for (const [apelido, original] of Object.entries(APELIDOS)) {
  svgs[apelido] = svgs[original]!
}

writeFileSync(
  'demo/icones.js',
  `/* Gerado por scripts/gerar-assets-vitrine.ts: não editar à mão.
   Os traçados vêm do pacote lucide-react instalado. */
const ICONES = ${JSON.stringify(svgs, null, 2)}
`,
)

console.log(
  `demo/ilustracoes.js: ${Object.keys(ILUSTRACOES).length} ilustrações · demo/icones.js: ${Object.keys(svgs).length} ícones`,
)

// --- fotos de produto ------------------------------------------------------
// Copiadas de `public/produtos`, e não versionadas duas vezes: são ~750 KB que
// não devem existir em dois lugares do repositório para divergirem depois.
cpSync('public/produtos', 'demo/produtos', { recursive: true })

console.log('demo/produtos: fotos copiadas de public/produtos')

// ---------------------------------------------------------------------------
// Catálogo da vitrine
// ---------------------------------------------------------------------------

/**
 * A vitrine mostra o catálogo de verdade, gerado da mesma fonte do seed.
 *
 * Antes ela tinha a própria cópia dos produtos, em `demo/dados.js`. Duas
 * cópias da mesma lista divergem no primeiro produto que a área acrescenta,
 * e quem aprova o V1 olha justamente a vitrine.
 */
const produtosDaVitrine = CATALOGO_AUVP.map((p) => ({
  slug: slugDoProduto(p.nome),
  nome: p.nome,
  categoria: p.categoria,
  valor: p.valor === null ? null : Number(p.valor),
  origem: p.origem,
  // Tudo o que está na planilha está ativo. A vitrine mantém o campo porque a
  // tela filtra por ele, como a aplicação.
  ativo: true,
  urlCompra: p.urlCompra ?? null,
  notaDeCompra: p.notaDeCompra ?? null,
  // Kit que embala bebida não sai sozinho: a vitrine mostra o mesmo selo e o
  // mesmo aviso da aplicação.
  exigeAcompanhamento: p.exigeAcompanhamento ?? null,
  serveComoAcompanhamento: p.serveComoAcompanhamento ?? null,
  // Sem o arquivo em `public/produtos/`, o card desenha a ilustração da
  // categoria: o mesmo que a aplicação faz.
  semFoto: !existsSync(join('public/produtos', `${slugDoProduto(p.nome)}.webp`)),
}))

writeFileSync(
  'demo/produtos.js',
  `/* Gerado por scripts/gerar-assets-vitrine.ts: não editar à mão.
   O catálogo vem de prisma/catalogo-auvp.ts, a mesma fonte do seed. */
const CATEGORIAS = ${JSON.stringify([...CATEGORIAS_AUVP], null, 2)}
const PRODUTOS = ${JSON.stringify(produtosDaVitrine, null, 2)}
`,
)

const semFoto = produtosDaVitrine.filter((p) => p.semFoto).length
console.log(
  `demo/produtos.js: ${produtosDaVitrine.length} produtos` +
    (semFoto > 0 ? ` (${semFoto} sem foto, com ilustração)` : ''),
)
