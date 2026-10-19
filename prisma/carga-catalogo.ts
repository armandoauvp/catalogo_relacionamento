// Roda fora do Next e da CLI do Prisma, que são quem lê o `.env` sozinhos.
// Sem isto, `npm run db:seed` numa máquina nova para em "DATABASE_URL não
// encontrada". Variável já definida no ambiente continua valendo, então a
// carga em produção com `DATABASE_URL=... npm run db:catalogo` não muda.
import 'dotenv/config'
import { existsSync, readdirSync } from 'node:fs'
import { PrismaClient, TipoValor } from '@prisma/client'
import { CATALOGO_AUVP, CATEGORIAS_AUVP, slugDoProduto } from './catalogo-auvp'

/**
 * Carga do catálogo real em um banco de produção.
 *
 * O `seed` não serve aqui: ele carrega usuários, clientes e solicitações
 * fictícias junto, e sobrescreve o produto que já existe. Num banco de verdade
 * as duas coisas são estragos, a segunda pior que a primeira: desfaria o preço
 * que a área corrigiu pelo CRUD.
 *
 * Então esta carga faz uma coisa só, e faz do jeito conservador:
 *
 * - cria as categorias que faltam;
 * - cria os produtos que faltam, casando pelo nome;
 * - **nunca toca em produto que já existe**, nem para corrigir. Depois que a
 *   ferramenta sobe, quem manda é o CRUD, e este arquivo é só o ponto de
 *   partida.
 *
 * Roda uma vez, logo depois do primeiro deploy, com o `DATABASE_URL` apontando
 * para o Postgres de produção:
 *
 * ```
 * DATABASE_URL="postgres://..." npm run db:catalogo
 * ```
 *
 * Rodar de novo é inofensivo: o que já está lá é listado e deixado em paz.
 *
 * Com `--so-se-vazio`, que é como o deploy da Vercel chama, só carrega um
 * banco sem nenhum produto. Rodar a cada deploy recriaria, pelo nome antigo,
 * um produto que a área renomeou no CRUD.
 */

const db = new PrismaClient()

async function main() {
  const [total, produtosNoBanco] = await Promise.all([
    db.produto.count(),
    db.produto.findMany({ select: { nome: true } }),
  ])

  if (process.argv.includes('--so-se-vazio') && total > 0) {
    console.log(`Catálogo já carregado (${total} produtos): nada a fazer.`)
    await db.$disconnect()
    return
  }

  console.log(`Catálogo da área: ${CATALOGO_AUVP.length} presentes em prisma/catalogo-auvp.ts`)
  console.log(`Banco de destino: ${total} ${total === 1 ? 'produto' : 'produtos'} hoje\n`)

  const jaExiste = new Set(produtosNoBanco.map((p) => p.nome))

  // Categorias primeiro: o produto aponta para uma, e `nome` é único.
  const categorias = new Map<string, string>()
  let categoriasCriadas = 0
  for (const nome of CATEGORIAS_AUVP) {
    const antes = await db.categoria.findUnique({ where: { nome }, select: { id: true } })
    const c = antes ?? (await db.categoria.create({ data: { nome }, select: { id: true } }))
    if (!antes) categoriasCriadas++
    categorias.set(nome, c.id)
  }
  console.log(
    `Categorias: ${categoriasCriadas} criadas, ${CATEGORIAS_AUVP.length - categoriasCriadas} já existiam`,
  )

  // Quais fotos existem de fato, para não gravar caminho de arquivo ausente.
  // São servidas de `public/produtos/`, que vai dentro da imagem.
  const fotos = new Set(
    existsSync('public/produtos')
      ? readdirSync('public/produtos')
          .filter((f) => f.endsWith('.webp'))
          .map((f) => f.replace(/\.webp$/, ''))
      : [],
  )
  if (fotos.size === 0) {
    console.log(
      '\nAviso: nenhuma foto em public/produtos/. Rode `npm run fotos:preparar` antes,\n' +
        'senão os produtos entram sem foto e o catálogo desenha a ilustração da categoria.',
    )
  }

  const criados: string[] = []
  const pulados: string[] = []
  const semFoto: string[] = []

  for (const p of CATALOGO_AUVP) {
    if (jaExiste.has(p.nome)) {
      pulados.push(p.nome)
      continue
    }

    const slug = slugDoProduto(p.nome)
    if (!fotos.has(slug)) semFoto.push(p.nome)

    await db.produto.create({
      data: {
        nome: p.nome,
        categoriaId: categorias.get(p.categoria)!,
        fotoUrl: fotos.has(slug) ? `/produtos/${slug}.webp` : null,
        valor: p.valor,
        tipoValor: p.tipoValor ?? TipoValor.exato,
        origem: p.origem,
        // A planilha da área não conta peças: é a origem que decide se passa
        // pelo Financeiro. A contagem é refinamento opcional do CRUD.
        controlaEstoque: false,
        estoque: null,
        urlCompra: p.urlCompra ?? null,
        notaDeCompra: p.notaDeCompra ?? null,
        exigeAcompanhamento: p.exigeAcompanhamento ?? null,
        serveComoAcompanhamento: p.serveComoAcompanhamento ?? null,
        ativo: true,
      },
    })
    criados.push(p.nome)
  }

  console.log(`Produtos:   ${criados.length} criados, ${pulados.length} já existiam\n`)

  if (criados.length > 0) {
    console.log('Criados:')
    for (const nome of criados) console.log(`  + ${nome}`)
  }

  if (pulados.length > 0) {
    console.log(`\nJá estavam no banco, e foram deixados como estão (${pulados.length}):`)
    for (const nome of pulados) console.log(`  · ${nome}`)
    console.log('\nPara corrigir qualquer um deles, use o CRUD em /admin/catalogo.')
  }

  if (semFoto.length > 0) {
    console.log(`\nEntraram sem foto (${semFoto.length}):`)
    for (const nome of semFoto) console.log(`  · ${nome}`)
    console.log('A tela desenha a ilustração da categoria, que é um estado previsto.')
  }

  const sobrando = produtosNoBanco.filter(
    (p) => !CATALOGO_AUVP.some((c) => c.nome === p.nome),
  ).length
  if (sobrando > 0) {
    console.log(
      `\n${sobrando} ${sobrando === 1 ? 'produto no banco não está' : 'produtos no banco não estão'} nesta lista.` +
        '\nNada foi removido: produto não é excluído, é desativado pelo CRUD.',
    )
  }

  await db.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await db.$disconnect()
  process.exit(1)
})
