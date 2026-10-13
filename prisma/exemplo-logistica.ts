import {
  Prisma,
  type ComplexidadeDemanda,
  type FaseOperacional,
  type Periodicidade,
  type PrioridadeDemanda,
  type PrismaClient,
} from '@prisma/client'
import { intervaloDaSemana, semanaIso } from '../src/lib/periodo'

/**
 * Demandas de exemplo para o Dashboard Logístico.
 *
 * **Fictício.** Departamentos, subsidiárias, pessoas e tarefas são
 * inventados para o painel abrir com conteúdo plausível enquanto o ClickUp
 * não está ligado. Os nomes de produto vêm da proposta da Logística; o resto
 * não deve ser lido como dado da AUVP.
 *
 * As datas são relativas a hoje, então o painel sempre tem a semana atual
 * cheia, e um gerador pseudoaleatório com semente fixa mantém o conjunto
 * igual a cada execução. Idempotente: casa pela chave do exemplo, guardada em
 * `clickupId` (`exemplo-001`...), o que também evita duplicar o que já está lá.
 */

const DIA = 86_400_000

/** Gerador congruente linear: o mesmo conjunto em toda execução. */
function gerador(semente: number) {
  let estado = semente
  return () => {
    estado = (estado * 1_664_525 + 1_013_904_223) % 2 ** 32
    return estado / 2 ** 32
  }
}

const ESTRUTURA = [
  {
    subsidiaria: 'Do Not Scare Soluções Interativas LTDA',
    departamento: 'Produto & CX',
    produto: 'AUVP Escola',
    peso: 5,
    custo: [18, 60],
  },
  {
    subsidiaria: 'Do Not Scare Soluções Interativas LTDA',
    departamento: 'Conteúdo',
    produto: 'AUVP Escola',
    peso: 1,
    custo: [12, 35],
  },
  {
    subsidiaria: 'AUVP Consultoria',
    departamento: 'Consultoria',
    produto: 'Consultoria',
    peso: 3,
    custo: [25, 90],
  },
  {
    subsidiaria: 'AUVP Holding',
    departamento: 'Administrativo',
    produto: 'Holding',
    peso: 2,
    custo: [40, 150],
  },
  {
    subsidiaria: 'Do Not Scare Soluções Interativas LTDA',
    departamento: 'Eventos',
    produto: 'The Brain',
    peso: 1,
    custo: [30, 110],
  },
] as const

type Envio = { titulo: string; itens: string[]; periodicidade?: Periodicidade }

/**
 * Os envios de cada produto. Os que têm periodicidade são as tarefas
 * recorrentes que a Logística diz serem metade do trabalho.
 */
const ENVIOS: Record<string, Envio[]> = {
  'AUVP Escola': [
    { titulo: 'Kit boas-vindas da turma', itens: ['Camiseta', 'Caneca', 'Caderno'] },
    { titulo: 'Livros para alunos da Imersão', itens: ['Livro AUVP'] },
    { titulo: 'Camisetas BR para o encontro', itens: ['Camiseta BR'] },
    {
      titulo: 'Reposição de material da Escola',
      itens: ['Apostilas', 'Crachás'],
      periodicidade: 'quinzenal',
    },
  ],
  Consultoria: [
    { titulo: 'Material de apoio para consultores', itens: ['Pasta de apresentação'] },
    { titulo: 'Kit de reunião com cliente', itens: ['Caderno', 'Caneta'] },
    { titulo: 'Malote para os escritórios', itens: ['Malote'], periodicidade: 'semanal' },
  ],
  Holding: [
    { titulo: 'Documentos para cartório', itens: ['Documentos'] },
    { titulo: 'Contratos para assinatura', itens: [] },
    { titulo: 'Correspondência da Holding', itens: ['Correspondência'], periodicidade: 'semanal' },
  ],
  'The Brain': [{ titulo: 'Brindes do evento The Brain', itens: ['Garrafa', 'Ecobag', 'Caneta'] }],
}

const RESPONSAVEIS = ['Ana Souza', 'Bruno Lima', 'Carla Mendes']

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

export async function semearLogistica(db: PrismaClient, agora = new Date()) {
  const aleatorio = gerador(42)
  const semanaAtual = semanaIso(agora)
  const inicioDaSemanaAtual = intervaloDaSemana(semanaAtual).inicio

  // Quatorze semanas para trás: o suficiente para a média do status e para o
  // gráfico de um trimestre.
  const SEMANAS = 14
  let n = 0

  for (let s = SEMANAS - 1; s >= 0; s--) {
    const inicio = new Date(inicioDaSemanaAtual.getTime() - s * 7 * DIA)
    // A semana em curso só tem os dias que já passaram, e volume proporcional.
    const diasDaSemana = Math.min(7, (agora.getTime() - inicio.getTime()) / DIA)
    // A semana de duas atrás tem pico, para o histórico mostrar um "alto volume".
    const volumeCheio = s === 2 ? 17 : 6 + Math.floor(aleatorio() * 5)
    const volume = Math.max(1, Math.round((volumeCheio * diasDaSemana) / 7))

    for (let i = 0; i < volume; i++) {
      n++
      const estrutura = escolherPorPeso(ESTRUTURA, aleatorio())
      const opcoes = ENVIOS[estrutura.produto]!
      const envio = opcoes[Math.floor(aleatorio() * opcoes.length)]!
      const solicitadaEm = new Date(inicio.getTime() + aleatorio() * diasDaSemana * DIA)

      const prazoEmDias = 3 + Math.floor(aleatorio() * 8)
      // Duas em cada vinte chegam sem previsão, como acontece no ClickUp.
      const semPrevisao = aleatorio() < 0.1
      const previsaoConclusao = semPrevisao
        ? null
        : new Date(solicitadaEm.getTime() + prazoEmDias * DIA)

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

      // Aberta e vencida, quase sempre é replanejada no ClickUp; as que
      // sobram vencidas são o atraso que o status da semana aponta.
      const replanejada =
        !concluida && previsaoConclusao && previsaoConclusao < agora && aleatorio() < 0.7
      const previsaoFinal = replanejada
        ? new Date(agora.getTime() + (1 + Math.floor(aleatorio() * 5)) * DIA)
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

      const [minimo, maximo] = estrutura.custo
      // Um em cada sete chega sem custo informado, como vai acontecer de verdade.
      const custoEnvio =
        aleatorio() < 0.15
          ? null
          : new Prisma.Decimal((minimo + aleatorio() * (maximo - minimo)).toFixed(2))
      const id = `exemplo-${String(n).padStart(3, '0')}`
      const dados = {
        // Cadastrada na trilha; o `clickupId` só serve de chave para o seed não
        // duplicar, e o link do ClickUp, como na vida real, só às vezes existe.
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
        custoEnvio,
        recorrente: Boolean(envio.periodicidade),
        periodicidade: envio.periodicidade ?? null,
        ativa: true,
      }

      await db.demandaLogistica.upsert({
        where: { clickupId: id },
        create: { clickupId: id, ...dados },
        update: dados,
      })
    }
  }

  for (const m of MEMBROS_DE_EXEMPLO) {
    await db.membroEquipe.upsert({ where: { id: m.id }, create: m, update: m })
  }

  // Um status manual no histórico, para a tela mostrar os dois casos.
  const duasAtras = semanaIso(new Date(inicioDaSemanaAtual.getTime() - 14 * DIA + DIA))
  const logistica = await db.usuario.findUnique({ where: { email: 'logistica@auvp.com.br' } })
  const manual = {
    situacao: 'alto_volume' as const,
    observacao: 'Semana do evento de lançamento da Escola.',
    definidoPorId: logistica?.id ?? null,
  }
  await db.statusOperacionalSemana.upsert({
    where: { ano_semana: { ano: duasAtras.ano, semana: duasAtras.semana } },
    create: { ...duasAtras, ...manual },
    update: manual,
  })

  return { demandas: n, membros: MEMBROS_DE_EXEMPLO.length }
}
