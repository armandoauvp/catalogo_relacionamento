import {
  Prisma,
  type ComplexidadeDemanda,
  type FaseOperacional,
  type Periodicidade,
  type PrioridadeDemanda,
  type PrismaClient,
} from '@prisma/client'
import { fimDoDiaLocal, formatarISO, instanteLocal, partesLocais } from '../src/lib/datas'
import { proximaOcorrencia } from '../src/lib/logistica/demandas'
import { intervaloDaSemana, semanaIso } from '../src/lib/periodo'

/**
 * Demandas de exemplo para o Dashboard Logístico.
 *
 * **Fictício.** Departamentos, subsidiárias, pessoas e tarefas são
 * inventados para o painel abrir com conteúdo plausível. Os nomes de produto
 * vêm da proposta da Logística; o resto não deve ser lido como dado da AUVP.
 *
 * Duas famílias, como na operação real:
 *
 * - **pontuais**, cadastradas uma a uma, com prazo, prioridade e atraso
 *   sorteados;
 * - **recorrentes**, em séries: cada ocorrência concluída gerou a próxima,
 *   ligada pela `ocorrenciaAnteriorId`, do mesmo jeito que a trilha faz. É a
 *   rotina que a Logística diz ser metade do trabalho.
 *
 * Os presentes aprovados entram na trilha por `exemplo-presentes.ts`.
 *
 * As datas são relativas a hoje, então o painel sempre tem a semana atual
 * cheia, e um gerador pseudoaleatório com semente fixa mantém o conjunto
 * igual a cada execução. Idempotente: casa pela chave do exemplo, guardada em
 * `clickupId` (`exemplo-001`, `exemplo-rec-malote-07`...). O que sobrou de uma
 * carga anterior e esta não tocou é arquivado, nunca apagado.
 */

const DIA = 86_400_000
const HORA = 3_600_000

/** Quantas semanas para trás: dá o semestre do filtro anual e a média do status. */
const SEMANAS = 26

/** Gerador congruente linear: o mesmo conjunto em toda execução. */
export function gerador(semente: number) {
  let estado = semente
  return () => {
    estado = (estado * 1_664_525 + 1_013_904_223) % 2 ** 32
    return estado / 2 ** 32
  }
}

const DNS = 'Do Not Scare Soluções Interativas LTDA'

type Estrutura = {
  subsidiaria: string
  departamento: string
  produto: string
  peso: number
  custo: readonly [number, number]
}

const ESTRUTURA = {
  produtoCx: {
    subsidiaria: DNS,
    departamento: 'Produto & CX',
    produto: 'AUVP Escola',
    peso: 5,
    custo: [18, 60],
  },
  conteudo: {
    subsidiaria: DNS,
    departamento: 'Conteúdo',
    produto: 'AUVP Escola',
    peso: 1,
    custo: [12, 35],
  },
  marketing: {
    subsidiaria: DNS,
    departamento: 'Marketing',
    produto: 'AUVP Escola',
    peso: 2,
    custo: [20, 80],
  },
  consultoria: {
    subsidiaria: 'AUVP Consultoria',
    departamento: 'Consultoria',
    produto: 'Consultoria',
    peso: 3,
    custo: [25, 90],
  },
  comercial: {
    subsidiaria: 'AUVP Consultoria',
    departamento: 'Comercial',
    produto: 'Consultoria',
    peso: 2,
    custo: [20, 70],
  },
  administrativo: {
    subsidiaria: 'AUVP Holding',
    departamento: 'Administrativo',
    produto: 'Holding',
    peso: 2,
    custo: [40, 150],
  },
  pessoas: {
    subsidiaria: 'AUVP Holding',
    departamento: 'Pessoas',
    produto: 'Holding',
    peso: 1,
    custo: [15, 45],
  },
  eventos: {
    subsidiaria: DNS,
    departamento: 'Eventos',
    produto: 'The Brain',
    peso: 1,
    custo: [30, 110],
  },
} as const satisfies Record<string, Estrutura>

type Envio = { titulo: string; itens: string[] }

/** Os envios pontuais de cada departamento. */
const PONTUAIS: Record<keyof typeof ESTRUTURA, Envio[]> = {
  produtoCx: [
    { titulo: 'Kit boas-vindas da turma', itens: ['Camiseta', 'Caneca', 'Caderno'] },
    { titulo: 'Livros para alunos da Imersão', itens: ['Livro AUVP'] },
    { titulo: 'Camisetas BR para o encontro', itens: ['Camiseta BR'] },
    { titulo: 'Troca de camiseta com tamanho errado', itens: ['Camiseta'] },
  ],
  conteudo: [
    { titulo: 'Equipamento para gravação externa', itens: ['Microfone', 'Tripé'] },
    { titulo: 'Cenário para o estúdio', itens: ['Painel', 'Luminária'] },
  ],
  marketing: [
    { titulo: 'Brindes para sorteio nas redes', itens: ['Boné', 'Garrafa'] },
    { titulo: 'Material para ação com parceiro', itens: ['Banner', 'Folders'] },
    { titulo: 'Kit para influenciador', itens: ['Camiseta', 'Livro AUVP', 'Caneca'] },
  ],
  consultoria: [
    { titulo: 'Material de apoio para consultores', itens: ['Pasta de apresentação'] },
    { titulo: 'Kit de reunião com cliente', itens: ['Caderno', 'Caneta'] },
  ],
  comercial: [
    { titulo: 'Material para evento comercial', itens: ['Banner', 'Display'] },
    { titulo: 'Amostras para parceiro', itens: ['Livro AUVP'] },
  ],
  administrativo: [
    { titulo: 'Documentos para cartório', itens: ['Documentos'] },
    { titulo: 'Contratos para assinatura', itens: [] },
  ],
  pessoas: [
    { titulo: 'Equipamento para home office', itens: ['Notebook', 'Monitor'] },
    { titulo: 'Recolher equipamento de desligamento', itens: ['Notebook'] },
  ],
  eventos: [
    { titulo: 'Brindes do evento The Brain', itens: ['Garrafa', 'Ecobag', 'Caneta'] },
    { titulo: 'Credenciais e crachás do evento', itens: ['Crachás'] },
  ],
}

type Serie = {
  chave: string
  titulo: string
  itens: string[]
  periodicidade: Periodicidade
  estrutura: keyof typeof ESTRUTURA
  responsavel: string
  /** Semanal e quinzenal: dia da semana (1 = segunda). Mensal: dia do mês. */
  dia: number
  /** Dias entre o início previsto e a conclusão prevista. */
  prazo: number
}

/** A rotina da Logística: cerca de quatro envios e meio por semana. */
const RECORRENTES: readonly Serie[] = [
  {
    chave: 'malote',
    titulo: 'Malote para os escritórios',
    itens: ['Malote'],
    periodicidade: 'semanal',
    estrutura: 'consultoria',
    responsavel: 'Diego Rocha',
    dia: 1,
    prazo: 1,
  },
  {
    chave: 'correspondencia',
    titulo: 'Correspondência da Holding',
    itens: ['Correspondência'],
    periodicidade: 'semanal',
    estrutura: 'administrativo',
    responsavel: 'Diego Rocha',
    dia: 3,
    prazo: 1,
  },
  {
    chave: 'caixa-postal',
    titulo: 'Retirada na caixa postal',
    itens: ['Correspondência'],
    periodicidade: 'semanal',
    estrutura: 'administrativo',
    responsavel: 'Diego Rocha',
    dia: 5,
    prazo: 0,
  },
  {
    chave: 'reposicao-escola',
    titulo: 'Reposição de material da Escola',
    itens: ['Apostilas', 'Crachás'],
    periodicidade: 'quinzenal',
    estrutura: 'produtoCx',
    responsavel: 'Carla Mendes',
    dia: 2,
    prazo: 3,
  },
  {
    chave: 'boas-vindas',
    titulo: 'Kits de boas-vindas dos novos colaboradores',
    itens: ['Mochila', 'Garrafa', 'Caderno'],
    periodicidade: 'quinzenal',
    estrutura: 'pessoas',
    responsavel: 'Carla Mendes',
    dia: 4,
    prazo: 4,
  },
  {
    chave: 'contabilidade',
    titulo: 'Documentos para a contabilidade',
    itens: ['Documentos'],
    periodicidade: 'mensal',
    estrutura: 'administrativo',
    responsavel: 'Ana Souza',
    dia: 5,
    prazo: 2,
  },
  {
    chave: 'pdv',
    titulo: 'Material de PDV para a equipe comercial',
    itens: ['Folders', 'Display'],
    periodicidade: 'mensal',
    estrutura: 'comercial',
    responsavel: 'Bruno Lima',
    dia: 15,
    prazo: 5,
  },
]

const RESPONSAVEIS = ['Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Diego Rocha']

/** Fase de uma demanda aberta, mais avançada quanto mais antiga ela é. */
const FASES_ABERTAS: readonly FaseOperacional[] = [
  'recebido',
  'em_analise',
  'aguardando_documentacao',
  'aguardando_suprimentos',
  'em_execucao',
  'revisao',
  'finalizacao',
]

export const MEMBROS_DE_EXEMPLO = [
  {
    id: 'exemplo-membro-1',
    nome: 'Ana Souza',
    funcao: 'Coordenação de Logística',
    descricao: 'Prioriza a esteira da semana e fala com os departamentos sobre prazos.',
    ordem: 1,
  },
  {
    id: 'exemplo-membro-2',
    nome: 'Bruno Lima',
    funcao: 'Expedição',
    descricao: 'Separa, embala e posta. É quem registra o rastreio.',
    ordem: 2,
  },
  {
    id: 'exemplo-membro-3',
    nome: 'Carla Mendes',
    funcao: 'Suprimentos',
    descricao: 'Compra e recebe o que não está em estoque.',
    ordem: 3,
  },
  {
    id: 'exemplo-membro-4',
    nome: 'Diego Rocha',
    funcao: 'Coletas e entregas',
    descricao: 'Faz as retiradas e as entregas na cidade, malotes inclusive.',
    ordem: 4,
  },
]

/** Status definidos à mão em semanas passadas, para a tela mostrar os dois casos. */
const STATUS_MANUAIS = [
  {
    semanasAtras: 2,
    situacao: 'alto_volume' as const,
    observacao: 'Semana do evento de lançamento da Escola.',
  },
  {
    semanasAtras: 9,
    situacao: 'risco_de_atraso' as const,
    observacao: 'Greve dos Correios atrasou as coletas da semana.',
  },
]

function escolherPorPeso<T extends { peso: number }>(lista: readonly T[], sorteio: number): T {
  const total = lista.reduce((s, i) => s + i.peso, 0)
  let alvo = sorteio * total
  for (const item of lista) {
    alvo -= item.peso
    if (alvo < 0) return item
  }
  return lista.at(-1)!
}

function sortearCusto(estrutura: Estrutura, aleatorio: () => number) {
  const [minimo, maximo] = estrutura.custo
  // Um em cada sete chega sem custo informado, como vai acontecer de verdade.
  return aleatorio() < 0.15
    ? null
    : new Prisma.Decimal((minimo + aleatorio() * (maximo - minimo)).toFixed(2))
}

const fimDoDia = (instante: Date) => fimDoDiaLocal(formatarISO(instante))!

/** Em lotes pequenos: rápido no banco remoto da Vercel, sem esgotar o pool. */
async function emLotes(tarefas: (() => Promise<unknown>)[], tamanho = 8) {
  for (let i = 0; i < tarefas.length; i += tamanho) {
    await Promise.all(tarefas.slice(i, i + tamanho).map((t) => t()))
  }
}

export async function semearLogistica(db: PrismaClient, agora = new Date()) {
  const aleatorio = gerador(42)
  const semanaAtual = semanaIso(agora)
  const inicioDaSemanaAtual = intervaloDaSemana(semanaAtual).inicio
  const inicioDoPeriodo = new Date(inicioDaSemanaAtual.getTime() - (SEMANAS - 1) * 7 * DIA)
  const tocadas: string[] = []

  // Uma ocorrência criada pela tela a partir de uma do exemplo perde o elo: a
  // série do exemplo é refeita e precisa da vaga de "próxima".
  await db.demandaLogistica.updateMany({
    where: {
      ocorrenciaAnterior: { clickupId: { startsWith: 'exemplo-' } },
      OR: [{ clickupId: null }, { NOT: { clickupId: { startsWith: 'exemplo-' } } }],
    },
    data: { ocorrenciaAnteriorId: null },
  })

  // Pontuais ------------------------------------------------------------------

  const estruturas = Object.entries(ESTRUTURA).map(([chave, e]) => ({
    ...e,
    chave: chave as keyof typeof ESTRUTURA,
  }))
  const pontuais: (() => Promise<unknown>)[] = []
  let n = 0

  for (let s = SEMANAS - 1; s >= 0; s--) {
    const inicio = new Date(inicioDaSemanaAtual.getTime() - s * 7 * DIA)
    // A semana em curso só tem os dias que já passaram, e volume proporcional.
    const diasDaSemana = Math.min(7, (agora.getTime() - inicio.getTime()) / DIA)
    // A semana de duas atrás tem pico, para o histórico mostrar um "alto volume".
    const volumeCheio = s === 2 ? 16 : 4 + Math.floor(aleatorio() * 4)
    const volume = Math.max(1, Math.round((volumeCheio * diasDaSemana) / 7))

    for (let i = 0; i < volume; i++) {
      n++
      const estrutura = escolherPorPeso(estruturas, aleatorio())
      const opcoes = PONTUAIS[estrutura.chave]
      const envio = opcoes[Math.floor(aleatorio() * opcoes.length)]!
      const solicitadaEm = new Date(inicio.getTime() + aleatorio() * diasDaSemana * DIA)

      const prazoEmDias = 3 + Math.floor(aleatorio() * 8)
      // Uma em cada dez chega sem previsão: as antigas, de antes da obrigatoriedade.
      const semPrevisao = aleatorio() < 0.1
      const previsaoConclusao = semPrevisao
        ? null
        : fimDoDia(new Date(solicitadaEm.getTime() + prazoEmDias * DIA))

      const idadeEmDias = (agora.getTime() - solicitadaEm.getTime()) / DIA
      // Quanto mais velha, mais provável que já tenha terminado.
      const concluida = idadeEmDias > 5 && aleatorio() < Math.min(0.97, idadeEmDias / 18)
      const concluidaEm = concluida
        ? new Date(
            Math.min(
              agora.getTime() - DIA / 4,
              solicitadaEm.getTime() + (prazoEmDias + (aleatorio() < 0.2 ? 2 : -1)) * DIA,
            ),
          )
        : null

      // Aberta e vencida, quase sempre é replanejada; as que sobram vencidas
      // são o atraso que o status da semana aponta.
      const replanejada =
        !concluida && previsaoConclusao && previsaoConclusao < agora && aleatorio() < 0.7
      const previsaoFinal = replanejada
        ? fimDoDia(new Date(agora.getTime() + (1 + Math.floor(aleatorio() * 5)) * DIA))
        : previsaoConclusao

      const fase: FaseOperacional = concluida
        ? 'concluido'
        : FASES_ABERTAS[Math.min(FASES_ABERTAS.length - 1, Math.floor(idadeEmDias / 1.5))]!

      const sorteioPrioridade = aleatorio()
      const prioridade: PrioridadeDemanda =
        sorteioPrioridade < 0.06
          ? 'urgente'
          : sorteioPrioridade < 0.22
            ? 'alta'
            : sorteioPrioridade < 0.85
              ? 'normal'
              : 'baixa'

      const complexidade: ComplexidadeDemanda =
        envio.itens.length > 1 ? 'media' : estrutura.produto === 'Holding' ? 'alta' : 'baixa'

      const id = `exemplo-${String(n).padStart(3, '0')}`
      const dados = {
        // O `clickupId` só serve de chave para o seed não duplicar; o link do
        // ClickUp, como na vida real, só às vezes existe.
        origem: 'manual' as const,
        clickupUrl: aleatorio() < 0.3 ? `https://app.clickup.com/t/${id}` : null,
        titulo: envio.titulo,
        subsidiaria: estrutura.subsidiaria,
        departamento: estrutura.departamento,
        produto: estrutura.produto,
        itens: envio.itens,
        fase,
        prioridade,
        complexidade,
        responsavel: RESPONSAVEIS[n % RESPONSAVEIS.length]!,
        observacoes:
          aleatorio() < 0.35
            ? 'Entregar na recepção do prédio, aos cuidados da equipe do departamento. Confirmar quantidade antes de embalar.'
            : null,
        linkFormulario: aleatorio() < 0.5 ? 'https://forms.example.com/pedido-logistica' : null,
        solicitadaEm,
        previsaoInicio: new Date(solicitadaEm.getTime() + DIA),
        previsaoConclusao: previsaoFinal,
        concluidaEm,
        custoEnvio: sortearCusto(estrutura, aleatorio),
        recorrente: false,
        periodicidade: null,
        ocorrenciaAnteriorId: null,
        // Algumas foram cadastradas por engano e arquivadas: não aparecem.
        ativa: n % 41 !== 0,
      }

      tocadas.push(id)
      pontuais.push(() =>
        db.demandaLogistica.upsert({
          where: { clickupId: id },
          create: { clickupId: id, ...dados },
          update: dados,
        }),
      )
    }
  }
  await emLotes(pontuais)

  // Recorrentes ---------------------------------------------------------------

  // Cada série tem o próprio gerador: acrescentar uma série nova não mexe nas
  // outras.
  const series = RECORRENTES.map((serie, indice) => async () => {
    const sorteio = gerador(1000 + indice)
    const estrutura = ESTRUTURA[serie.estrutura]
    let inicioPrevisto = primeiroDia(serie, inicioDoPeriodo)
    let previsao = {
      solicitadaEm: new Date(inicioPrevisto.getTime() - 3 * DIA),
      previsaoInicio: inicioPrevisto,
      previsaoConclusao: fimDoDia(new Date(inicioPrevisto.getTime() + serie.prazo * DIA)),
    }
    let anteriorId: string | null = null

    for (let k = 1; ; k++) {
      // Quase sempre no prazo; uma em oito atrasa um pouco.
      const atraso =
        sorteio() < 0.125 ? (0.5 + sorteio() * 1.5) * DIA : -(sorteio() * 0.6 + 0.1) * DIA
      const concluidaEm = new Date(previsao.previsaoConclusao.getTime() + atraso)
      const aberta = concluidaEm > agora
      const fase: FaseOperacional = !aberta
        ? 'concluido'
        : agora < previsao.previsaoInicio
          ? 'recebido'
          : 'em_execucao'

      const id = `exemplo-rec-${serie.chave}-${String(k).padStart(2, '0')}`
      const dados = {
        origem: 'manual' as const,
        clickupUrl: null,
        titulo: serie.titulo,
        subsidiaria: estrutura.subsidiaria,
        departamento: estrutura.departamento,
        produto: estrutura.produto,
        itens: serie.itens,
        fase,
        prioridade: 'normal' as const,
        complexidade: (serie.itens.length > 1 ? 'media' : 'baixa') as ComplexidadeDemanda,
        responsavel: serie.responsavel,
        observacoes: null,
        linkFormulario: null,
        ...previsao,
        concluidaEm: aberta ? null : concluidaEm,
        custoEnvio: sortearCusto(estrutura, sorteio),
        recorrente: true,
        periodicidade: serie.periodicidade,
        ocorrenciaAnteriorId: anteriorId,
        ativa: true,
      }
      tocadas.push(id)
      const salva: { id: string } = await db.demandaLogistica.upsert({
        where: { clickupId: id },
        create: { clickupId: id, ...dados },
        update: dados,
        select: { id: true },
      })
      if (aberta) break

      // A próxima nasce da conclusão desta, pela mesma regra da trilha.
      anteriorId = salva.id
      previsao = {
        ...proximaOcorrencia(
          {
            periodicidade: serie.periodicidade,
            previsaoInicio: previsao.previsaoInicio,
            previsaoConclusao: previsao.previsaoConclusao,
          },
          concluidaEm,
        ),
      } as typeof previsao
      inicioPrevisto = previsao.previsaoInicio
    }
  })
  await Promise.all(series.map((s) => s()))

  // O que uma carga anterior deixou e esta não refez sai do painel.
  await db.demandaLogistica.updateMany({
    where: { clickupId: { startsWith: 'exemplo-', notIn: tocadas } },
    data: { ativa: false, ocorrenciaAnteriorId: null },
  })

  for (const m of MEMBROS_DE_EXEMPLO) {
    await db.membroEquipe.upsert({ where: { id: m.id }, create: m, update: m })
  }

  const logistica = await db.usuario.findUnique({ where: { email: 'logistica@auvp.com.br' } })
  for (const s of STATUS_MANUAIS) {
    const semana = semanaIso(
      new Date(inicioDaSemanaAtual.getTime() - s.semanasAtras * 7 * DIA + DIA),
    )
    const manual = {
      situacao: s.situacao,
      observacao: s.observacao,
      definidoPorId: logistica?.id ?? null,
    }
    await db.statusOperacionalSemana.upsert({
      where: { ano_semana: { ano: semana.ano, semana: semana.semana } },
      create: { ...semana, ...manual },
      update: manual,
    })
  }

  return {
    pontuais: n,
    recorrentes: tocadas.length - n,
    membros: MEMBROS_DE_EXEMPLO.length,
  }
}

/** A primeira data da série dentro do período, às 9h de São Paulo. */
function primeiroDia(serie: Serie, inicioDoPeriodo: Date): Date {
  for (let d = 0; d < 45; d++) {
    const dia = new Date(inicioDoPeriodo.getTime() + d * DIA)
    const { ano, mes, dia: diaDoMes } = partesLocais(dia)
    const meiaNoite = instanteLocal(ano, mes, diaDoMes)
    const diaDaSemana = new Date(meiaNoite.getTime() + 12 * HORA).getUTCDay()
    const casa =
      serie.periodicidade === 'mensal' ? diaDoMes === serie.dia : diaDaSemana === serie.dia
    if (casa) return new Date(meiaNoite.getTime() + 9 * HORA)
  }
  throw new Error(`Série sem primeira data: ${serie.chave}`)
}
