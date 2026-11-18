// Roda fora do Next: o `.env` só vale se a variável não vier do ambiente.
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { Perfil, Prisma, PrismaClient, StatusSolicitacao } from '@prisma/client'
import { proximoCodigo } from '../src/lib/codigo'
import { cpfValido, normalizarCpf } from '../src/lib/cpf'
import {
  cepDoTexto,
  complementoDoTexto,
  logradouroDoTexto,
  marcaDoClickUp,
  motivoDoTexto,
  numeroDoTexto,
  primeiroLink,
  separarSaudacao,
  valorDoTexto,
  valoresDosItens,
} from '../src/lib/importacao-clickup'
import { acompanhamentosFaltando, mensagemDePendencia } from '../src/lib/acompanhamentos'
import { sincronizarDemandaDoPresente } from '../src/lib/logistica/ponte'

/**
 * Importação, de uma vez, das solicitações que ainda estavam no ClickUp.
 *
 * Entra o que a área pediu: "aguardando" (ainda não liberado) vira Pendente, e
 * "aguardando pagamento" (já liberado pela Lilian) vira Aguardando compra, com
 * a passagem pela aprovação no histórico e a demanda aberta na trilha. Nada
 * vai ao Tiny aqui: daqui em diante elas seguem o fluxo normal.
 *
 * Por padrão só **simula**: confere tudo contra o banco e escreve a planilha de
 * conferência ao lado do arquivo de entrada. Grava apenas com `--gravar`.
 *
 * ```
 * npx tsx scripts/importar-clickup.ts <tarefas.json>
 * DATABASE_URL="postgres://..." npx tsx scripts/importar-clickup.ts <tarefas.json> --gravar
 * ```
 *
 * O arquivo de entrada tem dados pessoais de clientes (CPF, endereço, carta) e
 * nunca entra no repositório.
 *
 * - Rodar de novo não duplica: a tarefa já importada é pulada pela marca na
 *   observação (`marcaDoClickUp`).
 * - Cliente casa pelo CPF; o que já existe só ganha o que estava vazio.
 * - Consultor casa pelo e-mail; quem ainda não entrou é criado como Consultor.
 *   Quem já existe fica com o perfil que tem.
 */

type Tarefa = {
  id: string
  nome: string
  status: string
  url: string
  criadoEm: string
  motivo: string | null
  clienteNome: string
  cpf: string
  endereco: string
  telefone: string | null
  link: string | null
  valorBrinde: string | null
  valorFrete: string | null
  salesforceId: string | null
  carta: string
  consultorEmail: string | null
  consultorNome: string | null
  pendencia: string | null
  /**
   * A quebra do pedido em itens, quando ele junta vários. `produto` é o nome
   * exato no catálogo (preço e SKU vêm do banco); sem ele o item é específico,
   * com `descricao` e o link da tarefa. Ausente, o pedido vira um item só.
   */
  itens?: { produto?: string; descricao?: string; valor?: string; url?: string }[]
}

type ItemPronto = {
  produtoId: string | null
  descricaoLivre: string | null
  urlExterna: string | null
  valorUnitario: string
  rotulo: string
}

type Endereco = {
  cep: string
  logradouro: string
  numero: string
  complemento: string | null
  bairro: string
  cidade: string
  uf: string
}

type Linha = {
  tarefa: Tarefa
  situacao: 'importar' | 'importada' | 'já existia' | 'pulada'
  motivoDaSituacao: string
  status?: StatusSolicitacao
  endereco?: Endereco
  valor?: string
  itens?: ItemPronto[]
  consultor?: string
  cliente?: string
  codigo?: string
}

const STATUS_DO_CLICKUP: Record<string, StatusSolicitacao> = {
  aguardando: StatusSolicitacao.pendente,
  'aguardando pagamento': StatusSolicitacao.aguardando_compra,
}

const db = new PrismaClient()

async function enderecoDaTarefa(texto: string): Promise<Endereco | string> {
  const cep = cepDoTexto(texto)
  if (!cep) return 'Endereço sem CEP.'
  const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
  const dados = (await resposta.json()) as Record<string, string | boolean>
  if (!resposta.ok || dados.erro) return `CEP ${cep} não encontrado.`
  return {
    cep,
    // CEP de cidade pequena não traz rua nem bairro: aí vale o que foi escrito.
    logradouro: String(dados.logradouro || '') || logradouroDoTexto(texto),
    numero: numeroDoTexto(texto),
    complemento: complementoDoTexto(texto),
    bairro: String(dados.bairro || '') || 'Não informado',
    cidade: String(dados.localidade),
    uf: String(dados.uf),
  }
}

/**
 * Os itens da solicitação. O produto do catálogo é procurado pelo nome, ativo,
 * no banco em que o script roda: em produção é lá que estão o preço corrigido
 * pelo CRUD e o SKU do Tiny. A trava do kit que exige vinho vale aqui também.
 */
async function itensDaTarefa(tarefa: Tarefa, aprovado: string): Promise<ItemPronto[] | string> {
  const link = primeiroLink(tarefa.link)!
  const pedidos: NonNullable<Tarefa['itens']> = tarefa.itens?.length
    ? tarefa.itens
    : [{ descricao: tarefa.nome.trim() }]
  const produtos: ({
    id: string
    nome: string
    valor: Prisma.Decimal | null
    exigeAcompanhamento: string | null
    serveComoAcompanhamento: string | null
  } | null)[] = []
  for (const pedido of pedidos) {
    if (!pedido.produto) {
      produtos.push(null)
      continue
    }
    const produto = await db.produto.findFirst({
      where: { nome: pedido.produto, ativo: true },
      select: {
        id: true,
        nome: true,
        valor: true,
        exigeAcompanhamento: true,
        serveComoAcompanhamento: true,
      },
    })
    if (!produto) return `"${pedido.produto}" não está ativo no catálogo.`
    produtos.push(produto)
  }

  const faltando = mensagemDePendencia(
    acompanhamentosFaltando(produtos.map((p) => ({ produtoId: p?.id ?? null, produto: p }))),
  )
  if (faltando) return faltando

  const valores = valoresDosItens(
    aprovado,
    pedidos.map(
      (pedido, i) => pedido.valor ?? produtos[i]?.valor?.toFixed(2) ?? (produtos[i] ? '0' : null),
    ),
  )
  if (typeof valores === 'string') return valores

  return pedidos.map((pedido, i) => {
    const produto = produtos[i]
    return produto
      ? {
          produtoId: produto.id,
          descricaoLivre: null,
          urlExterna: null,
          valorUnitario: valores[i]!,
          rotulo: `${produto.nome} (catálogo)`,
        }
      : {
          produtoId: null,
          descricaoLivre: pedido.descricao ?? tarefa.nome.trim(),
          urlExterna: pedido.url ?? link,
          valorUnitario: valores[i]!,
          rotulo: pedido.descricao ?? tarefa.nome.trim(),
        }
  })
}

/** Confere o que dá para conferir sem gravar. */
async function avaliar(tarefa: Tarefa): Promise<Linha> {
  const pular = (motivoDaSituacao: string): Linha => ({
    tarefa,
    situacao: 'pulada',
    motivoDaSituacao,
  })

  if (tarefa.pendencia) return pular(tarefa.pendencia)
  const status = STATUS_DO_CLICKUP[tarefa.status]
  if (!status) return pular(`Status "${tarefa.status}" fora da importação.`)
  if (!tarefa.consultorEmail) return pular('Sem consultor na lista.')
  if (!cpfValido(tarefa.cpf)) return pular('CPF inválido.')
  const valor = valorDoTexto(tarefa.valorBrinde)
  if (!valor) return pular('Sem valor do brinde.')
  if (!primeiroLink(tarefa.link)) return pular('Sem link do produto.')
  if (!tarefa.carta.trim()) return pular('Sem carta.')

  const endereco = await enderecoDaTarefa(tarefa.endereco)
  if (typeof endereco === 'string') return pular(endereco)
  const itens = await itensDaTarefa(tarefa, valor)
  if (typeof itens === 'string') return pular(itens)
  const total = itens
    .reduce((acc, i) => acc.plus(i.valorUnitario), new Prisma.Decimal(0))
    .toFixed(2)

  const ja = await db.solicitacao.findFirst({
    where: { observacoes: { contains: marcaDoClickUp(tarefa.id) } },
    select: { codigo: true },
  })
  const consultor = await db.usuario.findUnique({
    where: { email: tarefa.consultorEmail.toLowerCase() },
    select: { perfil: true },
  })
  const cliente = await db.cliente.findUnique({
    where: { cpf: normalizarCpf(tarefa.cpf) },
    select: { id: true },
  })

  return {
    tarefa,
    situacao: ja ? 'já existia' : 'importar',
    motivoDaSituacao: ja ? `Já importada como ${ja.codigo}.` : '',
    codigo: ja?.codigo,
    status,
    endereco,
    valor: total,
    itens,
    consultor: consultor ? `existe (${consultor.perfil})` : `será criado como Consultor`,
    cliente: cliente ? 'existe' : 'será criado',
  }
}

function observacaoDa(tarefa: Tarefa): string {
  const partes = [
    `${marcaDoClickUp(tarefa.id)} Importada do ClickUp: ${tarefa.url}`,
    valorDoTexto(tarefa.valorFrete) && Number(valorDoTexto(tarefa.valorFrete)) > 0
      ? `Frete informado: R$ ${valorDoTexto(tarefa.valorFrete)}`
      : null,
    tarefa.salesforceId ? `Salesforce: ${tarefa.salesforceId.trim()}` : null,
    tarefa.link && tarefa.link.trim() !== primeiroLink(tarefa.link)
      ? `Links: ${tarefa.link.trim()}`
      : null,
    `Endereço como veio: ${tarefa.endereco.replace(/\s*\n\s*/g, ' / ')}`,
  ]
  return partes.filter(Boolean).join('\n')
}

async function gravar(linha: Linha): Promise<string> {
  const { tarefa, endereco, status, valor, itens } = linha
  if (!endereco || !status || !valor || !itens || !tarefa.consultorEmail) {
    throw new Error('Linha incompleta.')
  }
  const email = tarefa.consultorEmail.toLowerCase()
  const cpf = normalizarCpf(tarefa.cpf)
  const nomeDoCliente = tarefa.clienteNome.trim()
  const dataSolicitacao = new Date(tarefa.criadoEm)

  return db.$transaction(async (tx) => {
    const consultor =
      (await tx.usuario.findUnique({ where: { email }, select: { id: true } })) ??
      (await tx.usuario.create({
        data: { email, nome: tarefa.consultorNome ?? email, perfil: Perfil.consultor },
        select: { id: true },
      }))

    // O Id do Salesforce é único: se outro cliente já o tem, fica só na observação.
    const salesforceId = tarefa.salesforceId?.trim() || null
    const salesforceLivre =
      salesforceId &&
      !(await tx.cliente.findUnique({ where: { salesforceId }, select: { cpf: true } }))
    const doFormulario = {
      nome: nomeDoCliente,
      telefone: tarefa.telefone?.trim() || null,
      salesforceId: salesforceLivre ? salesforceId : null,
      cep: endereco.cep,
      logradouro: endereco.logradouro,
      numero: endereco.numero,
      complemento: endereco.complemento,
      bairro: endereco.bairro,
      cidade: endereco.cidade,
      uf: endereco.uf,
    }
    const existente = await tx.cliente.findUnique({ where: { cpf } })
    let clienteId: string
    if (existente) {
      // Importar não apaga: só preenche o que estava vazio.
      const vazios = Object.fromEntries(
        Object.entries(doFormulario).filter(
          ([campo, valor]) => valor && !existente[campo as keyof typeof existente],
        ),
      )
      await tx.cliente.update({
        where: { id: existente.id },
        data: {
          ...vazios,
          etiquetas: existente.etiquetas.includes('clickup')
            ? existente.etiquetas
            : [...existente.etiquetas, 'clickup'],
        },
      })
      clienteId = existente.id
    } else {
      const novo = await tx.cliente.create({
        data: { ...doFormulario, cpf, origem: 'importacao', etiquetas: ['clickup'] },
        select: { id: true },
      })
      clienteId = novo.id
    }

    const { motivo, motivoOutro } = motivoDoTexto(tarefa.motivo)
    const { saudacao, corpo } = separarSaudacao(tarefa.carta)
    const codigo = await proximoCodigo(tx, dataSolicitacao)
    const solicitacao = await tx.solicitacao.create({
      data: {
        codigo,
        consultorId: consultor.id,
        clienteId,
        motivo,
        motivoOutro,
        mensagemCarta: corpo,
        saudacaoCarta: saudacao,
        observacoes: observacaoDa(tarefa),
        status,
        valorTotal: new Prisma.Decimal(valor),
        entregaCep: endereco.cep,
        entregaLogradouro: endereco.logradouro,
        entregaNumero: endereco.numero,
        entregaComplemento: endereco.complemento,
        entregaBairro: endereco.bairro,
        entregaCidade: endereco.cidade,
        entregaUf: endereco.uf,
        entregaDestinatario: nomeDoCliente,
        dataSolicitacao,
        itens: {
          create: itens.map(({ rotulo: _rotulo, valorUnitario, ...item }) => ({
            ...item,
            valorUnitario: new Prisma.Decimal(valorUnitario),
            quantidade: 1,
            criadoEm: dataSolicitacao,
          })),
        },
      },
      select: { id: true },
    })

    // O histórico conta o caminho que a tarefa fez no ClickUp, um passo por linha.
    const caminho: StatusSolicitacao[] =
      status === StatusSolicitacao.pendente
        ? [StatusSolicitacao.pendente]
        : [
            StatusSolicitacao.pendente,
            StatusSolicitacao.aguardando_aprovacao,
            StatusSolicitacao.aguardando_compra,
          ]
    for (const [i, statusNovo] of caminho.entries()) {
      await tx.solicitacaoHistorico.create({
        data: {
          solicitacaoId: solicitacao.id,
          statusAnterior: i === 0 ? null : caminho[i - 1],
          statusNovo,
          motivo: i === 0 ? 'Importada do ClickUp.' : 'Liberada no ClickUp antes da importação.',
          criadoEm: i === 0 ? dataSolicitacao : new Date(),
        },
      })
    }
    await sincronizarDemandaDoPresente(tx, solicitacao.id, status)
    return codigo
  })
}

async function escreverPlanilha(linhas: Linha[], destino: string): Promise<void> {
  const livro = new ExcelJS.Workbook()
  const aba = livro.addWorksheet('Importação ClickUp')
  aba.columns = [
    { header: 'Situação', key: 'situacao', width: 12 },
    { header: 'Por quê', key: 'porque', width: 50 },
    { header: 'Código', key: 'codigo', width: 15 },
    { header: 'ClickUp', key: 'url', width: 32 },
    { header: 'Status no ClickUp', key: 'statusClickup', width: 20 },
    { header: 'Entra como', key: 'status', width: 18 },
    { header: 'Presente', key: 'presente', width: 45 },
    { header: 'Itens que entram', key: 'itens', width: 70 },
    { header: 'Aprovado no ClickUp', key: 'aprovado', width: 12 },
    { header: 'Valor', key: 'valor', width: 10 },
    { header: 'Consultor', key: 'consultor', width: 34 },
    { header: 'Situação do consultor', key: 'situacaoConsultor', width: 26 },
    { header: 'Cliente', key: 'cliente', width: 32 },
    { header: 'Cliente no programa', key: 'situacaoCliente', width: 18 },
    { header: 'Endereço lido', key: 'endereco', width: 60 },
    { header: 'Endereço como veio', key: 'original', width: 60 },
  ]
  for (const l of linhas) {
    const e = l.endereco
    aba.addRow({
      situacao: l.situacao,
      porque: l.motivoDaSituacao,
      codigo: l.codigo ?? '',
      url: l.tarefa.url,
      statusClickup: l.tarefa.status,
      status: l.status ?? '',
      presente: l.tarefa.nome.trim(),
      itens: (l.itens ?? []).map((i) => `${i.rotulo}: R$ ${i.valorUnitario}`).join(' + '),
      aprovado: Number(valorDoTexto(l.tarefa.valorBrinde) ?? 0),
      valor: l.valor ? Number(l.valor) : '',
      consultor: l.tarefa.consultorEmail ?? '',
      situacaoConsultor: l.consultor ?? '',
      cliente: l.tarefa.clienteNome.trim(),
      situacaoCliente: l.cliente ?? '',
      endereco: e
        ? `${e.logradouro}, ${e.numero}${e.complemento ? ` (${e.complemento})` : ''} - ${e.bairro}, ${e.cidade}/${e.uf} - ${e.cep}`
        : '',
      original: l.tarefa.endereco.replace(/\s*\n\s*/g, ' / '),
    })
  }
  aba.getRow(1).font = { bold: true }
  aba.views = [{ state: 'frozen', ySplit: 1 }]
  await livro.xlsx.writeFile(destino)
}

async function main() {
  const arquivo = process.argv[2]
  const gravando = process.argv.includes('--gravar')
  if (!arquivo) throw new Error('Informe o arquivo das tarefas: importar-clickup.ts <tarefas.json>')

  const tarefas = JSON.parse(readFileSync(arquivo, 'utf8')) as Tarefa[]
  const linhas: Linha[] = []
  for (const tarefa of tarefas) linhas.push(await avaliar(tarefa))

  if (gravando) {
    for (const linha of linhas.filter((l) => l.situacao === 'importar')) {
      linha.codigo = await gravar(linha)
      linha.situacao = 'importada'
    }
  }

  const destino = path.join(
    path.dirname(arquivo),
    gravando ? 'importacao-clickup-gravada.xlsx' : 'importacao-clickup-simulacao.xlsx',
  )
  await escreverPlanilha(linhas, destino)

  const conta = (s: Linha['situacao']) => linhas.filter((l) => l.situacao === s).length
  console.log(gravando ? 'Gravado.' : 'Simulação: nada foi gravado.')
  console.log(
    `importar: ${conta('importar')} | importadas: ${conta('importada')} | já existiam: ${conta('já existia')} | puladas: ${conta('pulada')}`,
  )
  for (const l of linhas.filter((x) => x.situacao === 'pulada')) {
    console.log(`  pulada ${l.tarefa.id}: ${l.motivoDaSituacao}`)
  }
  console.log(`Planilha: ${destino}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
