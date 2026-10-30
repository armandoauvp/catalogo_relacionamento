import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight } from 'lucide-react'
import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { pode } from '@/lib/permissions'
import { lerPeriodo, queryDoPeriodo } from '@/lib/periodo'
import { painelLogistico, sugestoesDoCadastro } from '@/lib/logistica/painel'
import { CabecalhoDaPagina } from '@/components/pagina'
import { Stat } from '@/components/stat'
import { SeletorDePeriodo } from './seletor-de-periodo'
import { StatusDaSemana } from './status-da-semana'
import { VolumePorDepartamento, type VistaDoVolume } from './volume-por-departamento'
import { Evolucao } from './evolucao'
import { Trilha } from './trilha'
import { filtroDaTrilhaSchema, queryDoRecorte, temRecorte } from '@/lib/logistica/filtro-da-trilha'
import { LIMITE_DA_TRILHA_NA_TELA, trilhaDoPeriodo } from '@/lib/logistica/painel'
import { ROTULO_FASE, ROTULO_PRIORIDADE } from '@/lib/logistica/demandas'
import { hrefSemFiltro } from '@/lib/filtro-por-grupo'
import type { FiltroAtivo } from '@/components/filtro-por-grupo'

/** Já com a preposição: "à semana", "ao mês". */
const EM_RELACAO_AO_ANTERIOR = {
  semana: 'à semana anterior',
  mes: 'ao mês anterior',
  ano: 'ao ano anterior',
  personalizado: 'ao período anterior',
} as const

const APOIO_DA_EVOLUCAO = {
  semana: 'Pedidos por semana, nas oito semanas até a selecionada.',
  mes: 'Pedidos por semana dentro do mês.',
  ano: 'Pedidos por mês no ano.',
  personalizado: 'Pedidos ao longo do período escolhido.',
} as const

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/**
 * Dashboard Logístico.
 *
 * Leitura rápida da operação para a empresa inteira, da operação à diretoria.
 * A trilha é cadastrada aqui mesmo pela Logística; a tarefa no ClickUp, quando
 * existe, é um link. A ordem dos blocos é a da pergunta que cada um responde:
 * está tudo bem? quanto chegou e de onde? o que falta entregar? Ver
 * docs/11-logistica.md.
 */
export default async function LogisticaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const usuario = await exigirPermissao('logistica.ver')
  const params = await searchParams
  const periodo = lerPeriodo(params)
  const verObservacoes = pode(usuario.perfil, 'logistica.verObservacoes')
  const podeGerenciar = pode(usuario.perfil, 'logistica.gerenciar')

  const [painel, equipe, perguntas, sugestoes, emEstoque] = await Promise.all([
    painelLogistico(periodo, { verObservacoes }),
    db.membroEquipe.findMany({
      where: { ativo: true },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
      select: { id: true, nome: true, funcao: true },
    }),
    db.perguntaFrequente.count({ where: { ativo: true } }),
    podeGerenciar ? sugestoesDoCadastro() : null,
    db.produto.count({ where: { ativo: true, origem: 'estoque_interno' } }),
  ])

  const { volume } = painel
  const abertas = painel.trilha.demandas.filter((d) => d.fase !== 'concluido')
  const semPrevisao = abertas.filter((d) => !d.previsaoConclusao).length
  const atrasadas = abertas.filter((d) => d.atrasada).length
  const sinal = volume.variacao.diferenca > 0 ? '+' : ''
  const queryDoFiltro = queryDoPeriodo(periodo.params)

  // O clique nos grupos da trilha recorta só a trilha e a exportação dela; os
  // números e gráficos acima continuam do período inteiro.
  const recorte = filtroDaTrilhaSchema.parse(params)
  const trilha =
    temRecorte(recorte) || recorte.ordem
      ? await trilhaDoPeriodo(periodo, {
          verObservacoes,
          limite: LIMITE_DA_TRILHA_NA_TELA,
          recorte,
        })
      : painel.trilha
  const caminho = '/logistica'
  const filtrosDaTrilha: FiltroAtivo[] = [
    recorte.fase && {
      coluna: 'Fase',
      valor: ROTULO_FASE[recorte.fase],
      semEle: hrefSemFiltro(caminho, params, 'fase'),
    },
    recorte.prioridade && {
      coluna: 'Prioridade',
      valor: ROTULO_PRIORIDADE[recorte.prioridade],
      semEle: hrefSemFiltro(caminho, params, 'prioridade'),
    },
    recorte.subsidiaria && {
      coluna: 'Subsidiária',
      valor: recorte.subsidiaria,
      semEle: hrefSemFiltro(caminho, params, 'subsidiaria'),
    },
    recorte.departamento && {
      coluna: 'Departamento',
      valor: recorte.departamento,
      semEle: hrefSemFiltro(caminho, params, 'departamento'),
    },
    recorte.origem && {
      coluna: 'Origem',
      valor: recorte.origem === 'solicitacao' ? 'Presente' : recorte.origem,
      semEle: hrefSemFiltro(caminho, params, 'origem'),
    },
    recorte.recorrente && {
      coluna: 'Recorrência',
      valor: 'recorrentes',
      semEle: hrefSemFiltro(caminho, params, 'recorrente'),
    },
  ].filter((f): f is FiltroAtivo => Boolean(f))

  // O cartão por departamento conta pedidos ou itens despachados; a escolha
  // mora na URL, junto do período, para o fechamento ir por link.
  const vista: VistaDoVolume = params.volume === 'despachados' ? 'despachados' : 'pedidos'
  const semVista = hrefSemFiltro(caminho, params, 'volume')
  const hrefsDoVolume = {
    pedidos: semVista,
    despachados: `${semVista}${semVista.includes('?') ? '&' : '?'}volume=despachados`,
  }

  return (
    <>
      <CabecalhoDaPagina
        titulo="Dashboard Logístico"
        descricao="Status da operação, volume dos envios e a trilha de demandas do período."
      />

      <SeletorDePeriodo periodo={periodo} />

      {periodo.aviso ? (
        <p role="status" className="text-muted-foreground -mt-3 mb-6 text-sm">
          {periodo.aviso} Mostrando a semana atual.
        </p>
      ) : null}

      <StatusDaSemana status={painel.status} podeDefinir={podeGerenciar} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          destaque
          rotulo="Pedidos no período"
          valor={volume.total}
          apoio={
            <>
              {volume.variacao.diferenca === 0
                ? `Igual ${EM_RELACAO_AO_ANTERIOR[periodo.tipo]}.`
                : `${sinal}${volume.variacao.diferenca}${
                    volume.variacao.percentual === null
                      ? ''
                      : ` (${sinal}${Math.round(volume.variacao.percentual)}%)`
                  } em relação ${EM_RELACAO_AO_ANTERIOR[periodo.tipo]}.`}
              <br />
              {plural(volume.recorrentes, 'recorrente', 'recorrentes')} ·{' '}
              {plural(volume.pontuais, 'pontual', 'pontuais')}
            </>
          }
        />
        <Stat
          rotulo="Em andamento"
          valor={abertas.length}
          apoio={`${plural(atrasadas, 'atrasada', 'atrasadas')} · ${semPrevisao} sem previsão`}
        />
        <Stat
          rotulo="Itens despachados"
          valor={painel.despachados.total.toLocaleString('pt-BR')}
          apoio="Lançados nas tarefas, pela data do envio."
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <VolumePorDepartamento
          vista={vista}
          hrefs={hrefsDoVolume}
          {...(vista === 'pedidos'
            ? { linhas: volume.porDepartamento, total: volume.total }
            : {
                linhas: painel.despachados.porDepartamento,
                total: painel.despachados.total,
              })}
        />
        <Evolucao pontos={painel.evolucao} apoio={APOIO_DA_EVOLUCAO[periodo.tipo]} />
      </div>

      <div className="mb-6">
        <Trilha
          demandas={trilha.demandas}
          total={trilha.total}
          exportar={[queryDoFiltro, queryDoRecorte(recorte)].filter(Boolean).join('&')}
          filtroDaUrl={params}
          filtrosAtivos={filtrosDaTrilha}
          ordem={recorte.ordem ?? 'prioridade'}
          verObservacoes={verObservacoes}
          sugestoes={sugestoes}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* "Uma coisa leva a outra": quem acompanha os envios quer ver o que
            a AUVP tem para mandar. */}
        <CartaoDeAtalho
          href={'/catalogo?origem=estoque_interno' as Route}
          titulo="Produtos em estoque"
          texto={`${plural(emEstoque, 'presente', 'presentes')} que a AUVP tem fisicamente, no catálogo.`}
        />
        <CartaoDeAtalho
          href="/logistica/equipe"
          titulo="Equipe de Logística"
          texto={
            equipe.length
              ? equipe.map((m) => `${m.nome.split(' ')[0]} (${m.funcao})`).join(' · ')
              : 'Quem faz a operação acontecer.'
          }
        />
        <CartaoDeAtalho
          href="/logistica/faq"
          titulo="Perguntas frequentes"
          texto={
            perguntas
              ? `${plural(perguntas, 'pergunta respondida', 'perguntas respondidas')} pela Logística.`
              : 'Em elaboração pela equipe de Logística.'
          }
        />
      </div>
    </>
  )
}

function CartaoDeAtalho({ href, titulo, texto }: { href: Route; titulo: string; texto: string }) {
  return (
    <Link
      href={href}
      className="bg-card hover:border-foreground/20 group rounded-lg border p-5 transition-colors"
    >
      <p className="font-display flex items-center gap-1.5 text-lg font-semibold">
        {titulo}
        <ArrowRight
          className="size-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </p>
      <p className="text-muted-foreground mt-1 text-sm">{texto}</p>
    </Link>
  )
}
