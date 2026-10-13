import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight } from 'lucide-react'
import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { pode } from '@/lib/permissions'
import { formatarBRL } from '@/lib/money'
import { lerPeriodo, queryDoPeriodo } from '@/lib/periodo'
import { painelLogistico, sugestoesDoCadastro } from '@/lib/logistica/painel'
import { CabecalhoDaPagina } from '@/components/pagina'
import { Stat } from '@/components/stat'
import { SeletorDePeriodo } from './seletor-de-periodo'
import { StatusDaSemana } from './status-da-semana'
import { VolumePorDepartamento, type Medida } from './volume-por-departamento'
import { Evolucao } from './evolucao'
import { Trilha } from './trilha'

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
 * está tudo bem? quanto chegou e quanto custou? o que falta entregar? Ver
 * docs/11-logistica.md.
 */
export default async function LogisticaPage({
  searchParams,
}: {
  searchParams: Promise<{
    periodo?: string
    ref?: string
    de?: string
    ate?: string
    ver?: string
  }>
}) {
  const usuario = await exigirPermissao('logistica.ver')
  const params = await searchParams
  const periodo = lerPeriodo(params)
  const medida: Medida = params.ver === 'valor' ? 'valor' : 'quantidade'
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

  return (
    <>
      <CabecalhoDaPagina
        titulo="Dashboard Logístico"
        descricao="Status da operação, volume e custo dos envios e a trilha de demandas do período."
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
          rotulo="Custo dos envios"
          valor={formatarBRL(volume.custo)}
          apoio={
            volume.semCusto
              ? `${plural(volume.semCusto, 'pedido', 'pedidos')} sem custo informado.`
              : volume.total
                ? 'Todos os pedidos com custo informado.'
                : 'Nenhum pedido no período.'
          }
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <VolumePorDepartamento
          linhas={volume.porDepartamento}
          total={volume.total}
          medida={medida}
          queryDoPeriodo={queryDoFiltro}
        />
        <Evolucao pontos={painel.evolucao} apoio={APOIO_DA_EVOLUCAO[periodo.tipo]} />
      </div>

      <div className="mb-6">
        <Trilha
          demandas={painel.trilha.demandas}
          total={painel.trilha.total}
          exportar={queryDoFiltro}
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
