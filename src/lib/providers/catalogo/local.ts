import { db } from '@/lib/db'
import type {
  CatalogoProvider,
  FiltroDeCatalogo,
  PaginaDeCatalogo,
  ProdutoDoCatalogo,
} from '../types'

/** Implementação do V1: o catálogo é a tabela `produtos` do próprio Postgres. */

type LinhaComCategoria = {
  id: string
  nome: string
  descricao: string | null
  categoriaId: string
  fotoUrl: string | null
  valor: ProdutoDoCatalogo['valor']
  tipoValor: ProdutoDoCatalogo['tipoValor']
  origem: ProdutoDoCatalogo['origem']
  controlaEstoque: boolean
  estoque: number | null
  urlCompra: string | null
  notaDeCompra: string | null
  exigeAcompanhamento: string | null
  serveComoAcompanhamento: string | null
  ativo: boolean
  skuTiny: string | null
  categoria: { nome: string }
}

function mapear(linha: LinhaComCategoria): ProdutoDoCatalogo {
  return {
    id: linha.id,
    nome: linha.nome,
    descricao: linha.descricao,
    categoriaId: linha.categoriaId,
    categoriaNome: linha.categoria.nome,
    fotoUrl: linha.fotoUrl,
    valor: linha.valor,
    tipoValor: linha.tipoValor,
    origem: linha.origem,
    controlaEstoque: linha.controlaEstoque,
    estoque: linha.controlaEstoque ? linha.estoque : null,
    urlCompra: linha.urlCompra,
    notaDeCompra: linha.notaDeCompra,
    exigeAcompanhamento: linha.exigeAcompanhamento,
    serveComoAcompanhamento: linha.serveComoAcompanhamento,
    ativo: linha.ativo,
    skuTiny: linha.skuTiny,
  }
}

export const catalogoLocal: CatalogoProvider = {
  nome: 'local',

  async listar(filtro: FiltroDeCatalogo): Promise<PaginaDeCatalogo> {
    const pagina = Math.max(1, filtro.pagina ?? 1)
    const porPagina = Math.min(100, Math.max(1, filtro.porPagina ?? 24))
    const apenasAtivos = filtro.apenasAtivos ?? true
    const busca = filtro.busca?.trim()

    const where = {
      ...(apenasAtivos ? { ativo: true } : {}),
      ...(filtro.categoriaId ? { categoriaId: filtro.categoriaId } : {}),
      ...(filtro.origem ? { origem: filtro.origem } : {}),
      // Critério de aceite: a busca encontra por nome e por descrição.
      ...(busca
        ? {
            OR: [
              { nome: { contains: busca, mode: 'insensitive' as const } },
              { descricao: { contains: busca, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [linhas, total] = await Promise.all([
      db.produto.findMany({
        where,
        include: { categoria: { select: { nome: true } } },
        orderBy: { nome: 'asc' },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
      db.produto.count({ where }),
    ])

    return { itens: linhas.map(mapear), total, pagina, porPagina }
  },

  async obter(id: string): Promise<ProdutoDoCatalogo | null> {
    const linha = await db.produto.findUnique({
      where: { id },
      include: { categoria: { select: { nome: true } } },
    })
    return linha ? mapear(linha) : null
  },

  async consultarEstoque(id: string): Promise<number | null> {
    const linha = await db.produto.findUnique({
      where: { id },
      select: { controlaEstoque: true, estoque: true },
    })
    if (!linha || !linha.controlaEstoque) return null
    return linha.estoque ?? 0
  },
}
