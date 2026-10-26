import { NextResponse } from 'next/server'
import { autorizarAction, SemPermissaoError } from '@/lib/auth-guards'
import { pode } from '@/lib/permissions'
import { lerPeriodo } from '@/lib/periodo'
import { trilhaDoPeriodo } from '@/lib/logistica/painel'
import { filtroDaTrilhaSchema } from '@/lib/logistica/filtro-da-trilha'
import { gerarCsv, gerarXlsx } from '@/lib/export'
import { colunasDaTrilha, linhasDaTrilha, nomeDoArquivoDaTrilha } from '@/lib/export/demandas'

/**
 * Exportação da trilha de demandas, no período que está na tela.
 *
 * Lê os mesmos parâmetros da URL do dashboard e passa pela mesma função da
 * trilha, sem o teto da tela: a planilha leva todas as demandas do período.
 */
export async function GET(req: Request) {
  let usuario
  try {
    usuario = await autorizarAction('logistica.ver')
  } catch (erro) {
    if (erro instanceof SemPermissaoError) {
      return NextResponse.json({ erro: erro.message }, { status: 403 })
    }
    throw erro
  }

  const params = new URL(req.url).searchParams
  const formato = params.get('formato') === 'xlsx' ? 'xlsx' : 'csv'
  const periodo = lerPeriodo({
    periodo: params.get('periodo') ?? undefined,
    ref: params.get('ref') ?? undefined,
    de: params.get('de') ?? undefined,
    ate: params.get('ate') ?? undefined,
  })

  const verObservacoes = pode(usuario.perfil, 'logistica.verObservacoes')
  // O mesmo recorte que o clique nos grupos fez na tela.
  const recorte = filtroDaTrilhaSchema.parse(Object.fromEntries(params))
  const { demandas } = await trilhaDoPeriodo(periodo, { verObservacoes, recorte })
  const linhas = linhasDaTrilha(demandas)
  const colunas = colunasDaTrilha(verObservacoes)
  const nome = nomeDoArquivoDaTrilha(periodo.rotulo, formato)

  if (formato === 'xlsx') {
    const arquivo = await gerarXlsx(linhas, { colunas, aba: 'Demandas' })
    return new NextResponse(new Uint8Array(arquivo), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nome}"`,
      },
    })
  }

  return new NextResponse(gerarCsv(linhas, colunas), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nome}"`,
    },
  })
}
