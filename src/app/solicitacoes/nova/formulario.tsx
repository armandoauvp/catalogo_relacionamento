'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MotivoEnvio } from '@prisma/client'
import { AlertCircle, Check, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { CategoriaBadge } from '@/components/categoria-badge'
import { LinkDoProduto } from '@/components/link-do-produto'
import { ProdutoImagem } from '@/components/produto-imagem'
import { FolhaDaCarta } from '@/components/folha-da-carta'
import { StatusBadge } from '@/components/status-badge'
import { cpfValido, formatarCpf, formatarTelefone, mascaraDeCpf } from '@/lib/cpf'
import { cepValido, formatarCep, mascaraDeCep } from '@/lib/cep'
import { formatarData } from '@/lib/datas'
import { precisaDeCompra } from '@/lib/status'
import {
  LIMITE_DA_MENSAGEM,
  MODELOS_DE_CARTA,
  aplicarModelo,
  espacoRestante,
  previaDaCarta,
} from '@/lib/carta'
import { ROTULO_MOTIVO } from '@/lib/validators/solicitacao'
import { acompanhamentosFaltando, mensagemDePendencia } from '@/lib/acompanhamentos'
import { cn } from '@/lib/utils'
import {
  buscarClientePorCpf,
  criarCliente,
  criarSolicitacao,
  presentesJaEnviados,
  type ClienteEncontrado,
  type PresenteJaEnviado,
} from '@/lib/actions/solicitacoes'

/**
 * Formulário de nova solicitação, em cinco etapas.
 *
 * A validação de verdade acontece no servidor, em `solicitacaoSchema`. As
 * checagens daqui existem só para não deixar a pessoa avançar para uma etapa
 * que depende da anterior, e para ela ver o erro sem ida e volta.
 *
 * O estado vive todo neste componente, e não na URL: um rascunho pela metade
 * não deveria ser compartilhável nem sobreviver a um refresh acidental sem
 * aviso. Sair da página perde o rascunho, e o navegador avisa.
 */

export type ProdutoDoCatalogo = {
  id: string
  nome: string
  descricao: string | null
  categoriaNome: string
  fotoUrl: string | null
  /** Nulo quando a área ainda não informou o preço. Nulo não é zero. */
  valor: number | null
  tipoValor: 'exato' | 'medio'
  origem: 'estoque_interno' | 'mediante_pedido'
  controlaEstoque: boolean
  estoque: number | null
  /** A loja onde o presente é comprado, quando o cadastro tem o link. */
  urlCompra: string | null
  /** O que este presente precisa levar junto para poder ir, como `vinho`. */
  exigeAcompanhamento: string | null
  /** O que este presente satisfaz quando entra junto de um kit. */
  serveComoAcompanhamento: string | null
}

type ItemEscolhido =
  | { tipo: 'catalogo'; produto: ProdutoDoCatalogo; quantidade: number }
  | { tipo: 'especifico'; descricao: string; url: string; valor: string; quantidade: number }

type Endereco = {
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  destinatario: string
}

type Carta = {
  motivo: MotivoEnvio
  motivoOutro: string
  mensagem: string
  observacoes: string
}

const ETAPAS = ['Cliente', 'Itens', 'Entrega', 'Carta', 'Revisão'] as const
type Etapa = 0 | 1 | 2 | 3 | 4

/**
 * O limite do mês com esta solicitação contada dentro.
 *
 * Null quando o consultor não tem limite definido: aí não há o que sinalizar,
 * e uma barra vazia só ocuparia espaço.
 */
type Saldo = {
  limite: number
  antes: number
  depois: number
  restante: number
  estoura: boolean
  percentual: number
}

/** As 27 unidades da federação, para o endereço não aceitar "XX". */
const UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Produto sem preço informado entra no total como zero, e o resumo diz isso.
 *
 * O alternativo seria impedir a escolha, o que travaria o consultor por um dado
 * que só a área preenche, e o brinde personalizado sem preço é justamente o
 * mais pedido.
 */
const valorOuZero = (v: number | null) => v ?? 0

export function FormularioDeSolicitacao({
  produtos,
  consultor,
  gastoNoMes,
  limiteMensal,
}: {
  produtos: ProdutoDoCatalogo[]
  /** Quem assina a carta. */
  consultor: string
  gastoNoMes: number
  limiteMensal: number | null
}) {
  const router = useRouter()
  const [enviando, iniciarEnvio] = useTransition()

  const [etapa, setEtapa] = useState<Etapa>(0)
  // A mais longe que a pessoa já chegou. A trilha navega até ela.
  const [maiorEtapa, setMaiorEtapa] = useState<Etapa>(0)
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  /**
   * Erro de campo só aparece depois de a pessoa tentar avançar.
   *
   * Marcar em vermelho um campo que ela ainda não teve chance de preencher é
   * ruído; marcar depois que ela pediu para continuar é resposta.
   */
  const [conferir, setConferir] = useState(false)

  // --- cliente ---
  const [cpf, setCpf] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [cliente, setCliente] = useState<ClienteEncontrado | null>(null)
  const [novoCliente, setNovoCliente] = useState({ nome: '', telefone: '', email: '' })
  const [cpfBuscado, setCpfBuscado] = useState<string | null>(null)
  // O que este consultor já mandou para este cliente, para não repetir presente.
  // Guarda de quem é a lista: assim trocar de cliente já mostra "carregando"
  // sem precisar de um efeito para limpar o que era do cliente anterior.
  const [historico, setHistorico] = useState<{
    clienteId: string
    lista: PresenteJaEnviado[]
  } | null>(null)

  // --- itens ---
  const [itens, setItens] = useState<ItemEscolhido[]>([])
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [especifico, setEspecifico] = useState({ descricao: '', url: '', valor: '', quantidade: 1 })
  // Rótulo que o atalho do aviso está pedindo, como `vinho`. Nulo é a grade inteira.
  const [filtroAcompanhamento, setFiltroAcompanhamento] = useState<string | null>(null)

  // --- entrega ---
  const [entrega, setEntrega] = useState<Endereco>({
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    destinatario: '',
  })
  const [buscandoCep, setBuscandoCep] = useState(false)

  // --- carta ---
  const [carta, setCarta] = useState<Carta>({
    motivo: MotivoEnvio.aniversario,
    motivoOutro: '',
    mensagem: '',
    observacoes: '',
  })

  const total = itens.reduce((acc, i) => {
    const valor =
      i.tipo === 'catalogo' ? valorOuZero(i.produto.valor) : Number(i.valor.replace(',', '.')) || 0
    return acc + valor * i.quantidade
  }, 0)

  /**
   * O limite do mês, contado com esta solicitação dentro.
   *
   * A regra mora em `src/lib/saldo.ts`, e estourar apenas sinaliza: o veto
   * depende de decisão da área, registrada em `docs/05-perguntas-em-aberto.md`.
   * Sinalizar aqui, e não na lista depois, é o que dá chance de trocar o
   * presente enquanto ainda se está escolhendo.
   */
  const gastoComEsta = gastoNoMes + total
  const saldo =
    limiteMensal === null
      ? null
      : {
          limite: limiteMensal,
          antes: gastoNoMes,
          depois: gastoComEsta,
          restante: limiteMensal - gastoComEsta,
          estoura: gastoComEsta > limiteMensal,
          percentual: limiteMensal > 0 ? Math.min(100, (gastoComEsta / limiteMensal) * 100) : 0,
        }

  /**
   * Por onde o pedido vai passar depois da aprovação.
   *
   * Mesma função que o Admin usa para encaminhar, em `src/lib/status.ts`: item
   * de prateleira é liberado para envio na própria aprovação, o resto passa
   * pelo Financeiro. Dizer isso antes de enviar responde a pergunta que o
   * consultor faria depois ("quando isso chega?").
   */
  const passaPeloFinanceiro = precisaDeCompra(
    itens.map((i) =>
      i.tipo === 'catalogo'
        ? { produtoId: i.produto.id, quantidade: i.quantidade, produto: i.produto }
        : { produtoId: null, quantidade: i.quantidade, produto: null },
    ),
  )

  /**
   * Kit que embala bebida não sai sozinho.
   *
   * A regra mora em `src/lib/acompanhamentos.ts` e a mesma função roda de novo
   * em `criarSolicitacao`: aqui ela existe para a pessoa ver o que falta
   * enquanto escolhe, e não depois de preencher endereço e carta.
   */
  const pendencias = acompanhamentosFaltando(
    itens.map((i) =>
      i.tipo === 'catalogo'
        ? { produtoId: i.produto.id, produto: i.produto }
        : // Presente específico é texto livre: não dá para afirmar que
          // "uma garrafa de tinto" é o vinho que o kit pede.
          { produtoId: null, produto: null },
    ),
  )
  const bloqueio = mensagemDePendencia(pendencias)

  // O recorte vale enquanto a falta existe. Escolhido o vinho, a grade volta
  // inteira sozinha, sem um efeito para desfazer o que a própria conta já diz.
  const filtroAtivo =
    filtroAcompanhamento && pendencias.some((p) => p.exigencia === filtroAcompanhamento)
      ? filtroAcompanhamento
      : null

  // Quando o aviso de acompanhamento manda escolher um vinho, a grade encolhe
  // para o que serve de vinho. Vem antes de busca e categoria porque é o corte
  // mais forte: não adianta oferecer a categoria "acessórios" nesse momento.
  const elegiveis = filtroAtivo
    ? produtos.filter((p) => p.serveComoAcompanhamento === filtroAtivo)
    : produtos

  // Busca e categoria se compõem, como no catálogo: filtrar por bebida e
  // depois digitar "whisky" precisa restringir, não recomeçar.
  const termo = busca.trim().toLowerCase()
  const combinaBusca = (p: ProdutoDoCatalogo) =>
    !termo || `${p.nome} ${p.descricao ?? ''}`.toLowerCase().includes(termo)

  const visiveis = elegiveis.filter(
    (p) => (!categoria || p.categoriaNome === categoria) && combinaBusca(p),
  )

  // A contagem de cada pílula respeita a busca, e não a categoria escolhida:
  // é o que permite ver quantos "whisky" existem em cada categoria.
  const porBusca = elegiveis.filter(combinaBusca)
  const categorias = [...new Set(elegiveis.map((p) => p.categoriaNome))]
    .map((nome) => ({ nome, total: porBusca.filter((p) => p.categoriaNome === nome).length }))
    .filter((c) => c.total > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  const quantidadeDe = (id: string) =>
    itens.reduce(
      (soma, i) => soma + (i.tipo === 'catalogo' && i.produto.id === id ? i.quantidade : 0),
      0,
    )

  async function procurarCpf() {
    setErro(null)

    // CPF inválido não vale uma ida ao servidor: o dígito verificador é
    // conferido aqui e a resposta é imediata.
    if (!cpfValido(cpf)) {
      setConferir(true)
      return
    }

    setBuscando(true)
    try {
      const r = await buscarClientePorCpf(cpf)
      setCpfBuscado(cpf)
      if (!r.ok) return setErro(r.erro)
      setCliente(r.dados)
      if (!r.dados) setNovoCliente((n) => ({ ...n, nome: '' }))
      else preencherQuemRecebe(r.dados.nome)
      // O endereço padrão do cadastro adianta a entrega, sem passar por cima
      // do que a pessoa já digitou; a solicitação guarda a própria cópia.
      const encontrado = r.dados
      if (encontrado?.endereco) {
        setEntrega((e) =>
          e.cep.trim()
            ? e
            : {
                ...e,
                ...encontrado.endereco,
                cep: mascaraDeCep(encontrado.endereco!.cep),
                destinatario: e.destinatario || encontrado.nome,
              },
        )
      }
    } finally {
      setBuscando(false)
    }
  }

  /**
   * Carrega o que já foi mandado para este cliente.
   *
   * Roda quando o cliente muda, e não a cada tecla: é uma consulta por cliente
   * escolhido. Cliente recém-cadastrado nunca tem histórico, e a lista vazia
   * já é a resposta certa.
   */
  useEffect(() => {
    if (!cliente) return

    let valeAinda = true
    const id = cliente.id
    presentesJaEnviados(id).then((r) => {
      if (valeAinda) setHistorico({ clienteId: id, lista: r.ok ? r.dados : [] })
    })
    return () => {
      valeAinda = false
    }
  }, [cliente])

  /** Null enquanto a consulta não voltou, ou quando é de outro cliente. */
  const jaEnviados = cliente && historico?.clienteId === cliente.id ? historico.lista : null

  // Quase sempre quem recebe é o próprio cliente: o campo já vem com o nome,
  // em vez de mostrar o nome só como dica num campo vazio. Ao trocar de
  // cliente, o nome do anterior sai; o que a pessoa digitou à mão fica.
  function preencherQuemRecebe(nome: string) {
    setEntrega((e) => (e.destinatario.trim() ? e : { ...e, destinatario: nome }))
  }
  function esquecerQuemRecebe() {
    setEntrega((e) => (cliente && e.destinatario === cliente.nome ? { ...e, destinatario: '' } : e))
  }

  async function cadastrarCliente() {
    setErro(null)
    const r = await criarCliente({ ...novoCliente, cpf })
    if (!r.ok) return setErro(r.erro)
    preencherQuemRecebe(novoCliente.nome)

    setCliente({
      id: r.dados.id,
      nome: novoCliente.nome,
      cpf,
      telefone: novoCliente.telefone || null,
      email: novoCliente.email || null,
      endereco: null,
    })
  }

  async function procurarCep() {
    setErro(null)
    setBuscandoCep(true)
    try {
      const resposta = await fetch(`/api/cep/${entrega.cep.replace(/\D/g, '')}`)
      if (!resposta.ok) {
        // Falha de CEP não trava a solicitação: a pessoa preenche à mão.
        setErro('CEP não encontrado. Preencha o endereço manualmente.')
        return
      }
      const dados = await resposta.json()
      setEntrega((e) => ({
        ...e,
        logradouro: dados.logradouro || e.logradouro,
        bairro: dados.bairro || e.bairro,
        cidade: dados.cidade || e.cidade,
        uf: dados.uf || e.uf,
      }))
    } catch {
      setErro('Não foi possível consultar o CEP agora.')
    } finally {
      setBuscandoCep(false)
    }
  }

  function adicionarDoCatalogo(produto: ProdutoDoCatalogo) {
    setItens((atuais) => {
      const existente = atuais.findIndex(
        (i) => i.tipo === 'catalogo' && i.produto.id === produto.id,
      )
      if (existente >= 0) {
        const copia = [...atuais]
        const item = copia[existente]!
        copia[existente] = { ...item, quantidade: item.quantidade + 1 }
        return copia
      }
      return [...atuais, { tipo: 'catalogo', produto, quantidade: 1 }]
    })
  }

  function adicionarEspecifico() {
    setErro(null)
    if (!especifico.descricao.trim()) return setErro('Descreva o presente específico.')
    if (!especifico.url.trim()) return setErro('Informe o link onde comprar.')
    if (!especifico.valor.trim()) return setErro('Informe o valor do presente específico.')

    setItens((a) => [
      ...a,
      {
        tipo: 'especifico',
        descricao: especifico.descricao,
        url: especifico.url,
        valor: especifico.valor,
        quantidade: especifico.quantidade,
      },
    ])
    setEspecifico({ descricao: '', url: '', valor: '', quantidade: 1 })
  }

  function enviar() {
    setErro(null)
    iniciarEnvio(async () => {
      const r = await criarSolicitacao({
        clienteId: cliente?.id,
        motivo: carta.motivo,
        motivoOutro: carta.motivoOutro,
        mensagemCarta: carta.mensagem,
        observacoes: carta.observacoes,
        entregaCep: entrega.cep,
        entregaLogradouro: entrega.logradouro,
        entregaNumero: entrega.numero,
        entregaComplemento: entrega.complemento,
        entregaBairro: entrega.bairro,
        entregaCidade: entrega.cidade,
        entregaUf: entrega.uf,
        entregaDestinatario: entrega.destinatario,
        itens: itens.map((i) =>
          i.tipo === 'catalogo'
            ? // O valor que vale é o relido do banco em `criarSolicitacao`;
              // este vai junto só para o schema aceitar a forma do item.
              {
                produtoId: i.produto.id,
                valorUnitario: valorOuZero(i.produto.valor),
                quantidade: i.quantidade,
              }
            : {
                descricaoLivre: i.descricao,
                urlExterna: i.url,
                valorUnitario: i.valor,
                quantidade: i.quantidade,
              },
        ),
      })

      if (!r.ok) return setErro(r.erro)

      // Vai para a solicitação criada, e não para a lista: quem acabou de
      // pedir quer ver o código e conferir o que foi gravado. Da lista, a
      // pessoa teria de procurar o próprio pedido entre os outros.
      setEnviado(true)
      router.push(`/solicitacoes/${r.dados.id}`)
      router.refresh()
    })
  }

  /** Muda de etapa e sobe a página: a trilha some do campo de visão em telas baixas. */
  function irPara(proxima: Etapa) {
    setEtapa(proxima)
    setMaiorEtapa((maior) => (proxima > maior ? proxima : maior))
    setErro(null)
    setConferir(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /**
   * Continuar com etapa incompleta não avança, mas responde.
   *
   * O botão desligado era a versão anterior, e ela não explicava nada: a
   * pessoa clicava, nada acontecia, e o que faltava continuava invisível.
   * Agora o clique acende o que falta, no campo em que falta.
   */
  function tentarAvancar() {
    const faltando = Object.keys(problemas)
    if (faltando.length === 0 && !bloqueio) {
      irPara((etapa + 1) as Etapa)
      return
    }

    setConferir(true)

    // Leva o cursor ao primeiro campo que falta. Sem isso, num endereço com
    // três buracos, a pessoa precisa caçar o vermelho na tela. As chaves de
    // `problemasDaEtapa` são os `id` dos campos justamente para isto.
    const primeiro = faltando[0]
    if (primeiro) {
      requestAnimationFrame(() => {
        const campo = document.getElementById(primeiro)
        campo?.focus()
        campo?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
    }
  }

  /**
   * Vazado enquanto falta algo, cheio quando a etapa está pronta. O clique
   * funciona nos dois casos: com etapa incompleta ele acende o que falta, que
   * é mais do que um botão desligado faria. Aparece no fim da etapa e embaixo
   * do resumo, que acompanha a rolagem: a lista de itens é longa.
   */
  function avancar(className?: string) {
    return etapa < 4 ? (
      <Button
        onClick={tentarAvancar}
        variant={podeAvancar ? 'default' : 'outline'}
        className={className}
      >
        Continuar
      </Button>
    ) : (
      <Button onClick={enviar} disabled={enviando || Boolean(bloqueio)} className={className}>
        {enviando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {enviando ? 'Enviando…' : 'Enviar solicitação'}
      </Button>
    )
  }

  /** Atalho do aviso: volta para os itens já filtrado no que resolve a falta. */
  function escolherAcompanhamento(rotulo: string) {
    setBusca('')
    setCategoria('')
    setFiltroAcompanhamento(rotulo)
    irPara(1)
  }

  /**
   * Aviso do navegador ao sair com rascunho pela metade.
   *
   * O rascunho vive só na memória desta tela: fechar a aba perde o que foi
   * digitado, e uma solicitação tem cliente, itens, endereço e carta. O aviso
   * nativo é o único que funciona em fechar aba, voltar e recarregar ao mesmo
   * tempo.
   *
   * Some depois do envio, senão a própria navegação para a solicitação criada
   * dispararia o aviso.
   */
  const temRascunho = Boolean(cliente || itens.length > 0 || carta.mensagem.trim())
  useEffect(() => {
    if (!temRascunho || enviado) return

    const avisar = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [temRascunho, enviado])

  /**
   * O que falta nesta etapa, por campo.
   *
   * A validação que vale continua sendo a do servidor, em `solicitacaoSchema`.
   * Esta existe para a pessoa saber o que corrigir sem ida e volta, e para a
   * trilha poder dizer quais etapas ainda estão incompletas.
   */
  const problemasDaEtapa = (qual: Etapa): Record<string, string> => {
    const p: Record<string, string> = {}

    if (qual === 0 && !cliente) {
      p['cpf'] = cpf.trim()
        ? 'Busque o CPF e escolha ou cadastre o cliente.'
        : 'Informe o CPF do cliente.'
    }

    if (qual === 1) {
      if (itens.length === 0) p['itens'] = 'Escolha ao menos um presente.'
      else if (bloqueio) p['itens'] = bloqueio
    }

    if (qual === 2) {
      if (!cepValido(entrega.cep)) p['cep'] = 'CEP deve ter 8 dígitos.'
      if (!entrega.logradouro.trim()) p['logradouro'] = 'Informe a rua ou avenida.'
      if (!entrega.numero.trim()) p['numero'] = 'Informe o número, ou "s/n".'
      if (!entrega.bairro.trim()) p['bairro'] = 'Informe o bairro.'
      if (!entrega.cidade.trim()) p['cidade'] = 'Informe a cidade.'
      if (entrega.uf.trim().length !== 2) p['uf'] = 'Escolha o estado.'
      if (!entrega.destinatario.trim()) p['destinatario'] = 'Informe quem recebe o presente.'
    }

    if (qual === 3) {
      if (!carta.mensagem.trim()) p['mensagem'] = 'Escreva a mensagem da carta.'
      else if (espacoRestante(carta.mensagem).excedeu)
        p['mensagem'] = `A mensagem passou de ${LIMITE_DA_MENSAGEM} caracteres e não cabe na folha.`
      if (carta.motivo === MotivoEnvio.outro && !carta.motivoOutro.trim())
        p['motivoOutro'] = 'Diga qual é o motivo.'
    }

    return p
  }

  const problemas = problemasDaEtapa(etapa)
  const podeAvancar = Object.keys(problemas).length === 0 && !bloqueio

  // Quais etapas anteriores ficaram pela metade, para a trilha marcar.
  const etapasIncompletas = ([0, 1, 2, 3] as Etapa[]).filter(
    (i) => i <= maiorEtapa && Object.keys(problemasDaEtapa(i)).length > 0,
  )

  /** Erros a mostrar agora: só depois de a pessoa ter pedido para continuar. */
  const erros = conferir ? problemas : {}

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0">
        <Trilha
          etapa={etapa}
          maiorEtapa={maiorEtapa}
          incompletas={etapasIncompletas}
          aoIr={(i) => i <= maiorEtapa && irPara(i as Etapa)}
        />

        {erro ? (
          <p
            role="alert"
            className="border-error/30 bg-error/10 text-error mb-4 rounded-lg border px-4 py-3 text-sm"
          >
            {erro}
          </p>
        ) : null}

        {/* Fica fora da etapa de itens de propósito: tirar o vinho depois de
            preencher o endereço também trava, e o aviso precisa aparecer onde
            a pessoa estiver. */}
        {bloqueio ? (
          <div
            role="alert"
            className="border-warning/40 bg-warning/10 mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-3"
          >
            <p className="min-w-0 flex-1 text-sm">{bloqueio}</p>
            {pendencias.map((p) => (
              <Button
                key={p.exigencia}
                size="sm"
                variant="outline"
                onClick={() => escolherAcompanhamento(p.exigencia)}
              >
                Escolher o {p.exigencia}
              </Button>
            ))}
          </div>
        ) : null}

        <Card>
          <CardContent className="p-6">
            {etapa === 0 ? (
              <EtapaCliente
                cpf={cpf}
                erros={erros}
                jaEnviados={jaEnviados}
                setCpf={(v) => {
                  setCpf(v)
                  esquecerQuemRecebe()
                  setCliente(null)
                  setCpfBuscado(null)
                }}
                buscando={buscando}
                procurar={procurarCpf}
                cliente={cliente}
                cpfBuscado={cpfBuscado}
                novo={novoCliente}
                setNovo={setNovoCliente}
                cadastrar={cadastrarCliente}
                limpar={() => {
                  esquecerQuemRecebe()
                  setCliente(null)
                  setCpfBuscado(null)
                }}
              />
            ) : null}

            {etapa === 1 ? (
              <EtapaItens
                produtos={visiveis}
                categorias={categorias}
                busca={busca}
                setBusca={setBusca}
                categoria={categoria}
                setCategoria={setCategoria}
                quantidadeDe={quantidadeDe}
                adicionar={adicionarDoCatalogo}
                itensEscolhidos={itens.length}
                total={total}
                saldo={saldo}
                filtroAcompanhamento={filtroAtivo}
                limparAcompanhamento={() => setFiltroAcompanhamento(null)}
                especifico={especifico}
                setEspecifico={setEspecifico}
                adicionarEspecifico={adicionarEspecifico}
              />
            ) : null}

            {etapa === 2 ? (
              <EtapaEntrega
                entrega={entrega}
                setEntrega={setEntrega}
                buscando={buscandoCep}
                procurar={procurarCep}
                erros={erros}
                sugestao={cliente?.nome ?? ''}
              />
            ) : null}

            {etapa === 3 ? (
              <EtapaCarta
                carta={carta}
                setCarta={setCarta}
                erros={erros}
                destinatario={entrega.destinatario || cliente?.nome || ''}
                consultor={consultor}
              />
            ) : null}

            {etapa === 4 ? (
              <EtapaRevisao
                cliente={cliente}
                itens={itens}
                entrega={entrega}
                carta={carta}
                total={total}
                consultor={consultor}
                passaPeloFinanceiro={passaPeloFinanceiro}
                saldo={saldo}
                aoEditar={irPara}
              />
            ) : null}
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => irPara(Math.max(0, etapa - 1) as Etapa)}
            disabled={etapa === 0 || enviando}
          >
            Voltar
          </Button>

          {avancar()}
        </div>
      </div>

      <Resumo
        acao={avancar('w-full')}
        cliente={cliente}
        itens={itens}
        total={total}
        saldo={saldo}
        passaPeloFinanceiro={passaPeloFinanceiro}
        remover={(i) => setItens((a) => a.filter((_, indice) => indice !== i))}
        mudarQuantidade={(i, q) =>
          setItens((a) =>
            a.map((item, indice) =>
              indice === i ? { ...item, quantidade: Math.max(1, q) } : item,
            ),
          )
        }
      />
    </div>
  )
}

/**
 * Trilha das etapas, que também navega.
 *
 * `maiorEtapa` é a mais longe que a pessoa já chegou, e não a atual: voltar
 * para conferir o cliente e depois pular direto para a revisão é o movimento
 * natural de quem revisa. Antes disso a trilha só voltava, e o caminho de
 * volta era clicar "Continuar" três vezes.
 *
 * O que não muda é a ordem de destravar: só se chega à etapa 4 tendo passado
 * pelas outras, porque `podeAvancar` continua mandando na primeira visita.
 */
function Trilha({
  etapa,
  maiorEtapa,
  incompletas,
  aoIr,
}: {
  etapa: Etapa
  maiorEtapa: Etapa
  /** Etapas já visitadas que ficaram pela metade. */
  incompletas: Etapa[]
  aoIr: (i: number) => void
}) {
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-x-1 gap-y-2">
      {ETAPAS.map((nome, i) => {
        const pendente = incompletas.includes(i as Etapa)
        // Visitada e resolvida. Uma etapa incompleta não ganha o certo verde,
        // senão a trilha diria que está tudo pronto enquanto falta um campo.
        const concluida = i < maiorEtapa && !pendente
        const atual = i === etapa
        const alcancavel = i <= maiorEtapa

        return (
          <li key={nome} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => aoIr(i)}
              disabled={!alcancavel || atual}
              aria-current={atual ? 'step' : undefined}
              title={pendente && !atual ? `${nome}: falta preencher` : undefined}
              className={cn(
                'ease-apple flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors duration-200',
                atual && 'bg-primary/10 text-primary-emphasis font-medium',
                !atual &&
                  alcancavel &&
                  'text-muted-foreground hover:bg-muted hover:text-foreground',
                !alcancavel && 'text-muted-foreground/60',
              )}
            >
              <span
                className={cn(
                  'font-ui grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold',
                  atual && 'bg-primary text-primary-foreground',
                  concluida && 'bg-success text-success-foreground',
                  !atual && pendente && 'bg-warning text-warning-foreground',
                  !atual && !concluida && !pendente && 'bg-muted text-muted-foreground',
                )}
              >
                {concluida && !atual ? <Check className="size-3" aria-hidden="true" /> : i + 1}
              </span>
              {nome}
              {pendente && !atual ? <span className="sr-only">, falta preencher</span> : null}
            </button>
            {i < ETAPAS.length - 1 ? (
              <span className="bg-border h-px w-4 shrink-0" aria-hidden="true" />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

/** Mensagem de erro logo abaixo do campo que a causou. */
function ErroDoCampo({ mensagem }: { mensagem?: string }) {
  if (!mensagem) return null
  return (
    <p role="alert" className="text-error flex items-start gap-1.5 text-xs">
      <AlertCircle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
      {mensagem}
    </p>
  )
}

function EtapaCliente({
  cpf,
  setCpf,
  buscando,
  procurar,
  cliente,
  cpfBuscado,
  novo,
  setNovo,
  cadastrar,
  limpar,
  erros,
  jaEnviados,
}: {
  cpf: string
  setCpf: (v: string) => void
  buscando: boolean
  procurar: () => void
  cliente: ClienteEncontrado | null
  cpfBuscado: string | null
  novo: { nome: string; telefone: string; email: string }
  setNovo: (v: { nome: string; telefone: string; email: string }) => void
  cadastrar: () => void
  limpar: () => void
  erros: Record<string, string>
  /** Null enquanto carrega; lista vazia quando não há histórico. */
  jaEnviados: PresenteJaEnviado[] | null
}) {
  // Buscou, não achou e ainda não cadastrou: é a hora de oferecer o cadastro.
  const cadastrando = cpfBuscado !== null && !cliente
  const digitos = cpf.replace(/\D/g, '').length

  // O dígito verificador é conferido aqui: errar o CPF é o erro mais comum
  // desta etapa, e descobrir isso no servidor custa uma ida e volta.
  const cpfErrado = digitos === 11 && !cpfValido(cpf)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold">Para quem é o presente?</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          O CPF identifica o cliente. Se já existir, usamos o cadastro que está lá.
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="cpf">CPF do cliente</Label>
          <Input
            id="cpf"
            value={cpf}
            inputMode="numeric"
            placeholder="000.000.000-00"
            aria-invalid={cpfErrado || Boolean(erros['cpf'])}
            aria-describedby={cpfErrado || erros['cpf'] ? 'cpf-erro' : undefined}
            onChange={(e) => setCpf(mascaraDeCpf(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                procurar()
              }
            }}
          />
          <div id="cpf-erro">
            <ErroDoCampo
              mensagem={cpfErrado ? 'CPF inválido. Confira os números.' : erros['cpf']}
            />
          </div>
          {!cpfErrado && !erros['cpf'] ? (
            <p className="text-muted-foreground text-xs">
              {digitos === 0
                ? 'Digite os 11 números e busque.'
                : digitos < 11
                  ? `Faltam ${11 - digitos} ${11 - digitos === 1 ? 'número' : 'números'}.`
                  : 'Pode buscar.'}
            </p>
          ) : null}
        </div>
        <Button
          className="mt-[1.6rem]"
          onClick={procurar}
          disabled={buscando || digitos !== 11 || cpfErrado}
        >
          {buscando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Buscar
        </Button>
      </div>

      {cliente ? (
        <div className="border-success/30 bg-success/10 space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-ui text-success text-xs font-semibold tracking-wider uppercase">
                Cliente encontrado
              </p>
              <p className="mt-1.5 font-medium">{cliente.nome}</p>
              <p className="text-muted-foreground text-sm tabular-nums">
                {formatarCpf(cliente.cpf)}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={limpar}>
              Trocar de cliente
            </Button>
          </div>

          {/* Telefone e e-mail não vão para a etiqueta, mas são o que a
              expedição usa quando a entrega dá problema. */}
          {cliente.telefone || cliente.email ? (
            <dl className="text-muted-foreground grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {cliente.telefone ? (
                <div className="flex gap-2">
                  <dt>Telefone</dt>
                  <dd className="text-foreground tabular-nums">
                    {formatarTelefone(cliente.telefone)}
                  </dd>
                </div>
              ) : null}
              {cliente.email ? (
                <div className="flex min-w-0 gap-2">
                  <dt>E-mail</dt>
                  <dd className="text-foreground truncate">{cliente.email}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <HistoricoDoCliente lista={jaEnviados} />
        </div>
      ) : null}

      {cadastrando ? (
        <div className="space-y-4 rounded-lg border border-dashed p-4">
          <p className="text-sm">Nenhum cliente com esse CPF. Preencha os dados para cadastrar.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input
                id="nome"
                value={novo.nome}
                autoFocus
                onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
              />
              <p className="text-muted-foreground text-xs">
                É o nome que vai na saudação da carta e na etiqueta de entrega.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={novo.telefone}
                inputMode="numeric"
                placeholder="(11) 90000-0000"
                onChange={(e) => setNovo({ ...novo, telefone: formatarTelefone(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={novo.email}
                onChange={(e) => setNovo({ ...novo, email: e.target.value })}
              />
            </div>
          </div>
          <Button onClick={cadastrar} disabled={novo.nome.trim().length < 2}>
            Cadastrar cliente
          </Button>
        </div>
      ) : null}
    </div>
  )
}

/**
 * O que este consultor já mandou para este cliente.
 *
 * Serve a uma decisão concreta: não repetir o presente do ano passado. Por
 * isso mostra o que foi, e não só quando foi.
 */
function HistoricoDoCliente({ lista }: { lista: PresenteJaEnviado[] | null }) {
  if (lista === null) {
    return (
      <p className="text-muted-foreground border-t pt-3 text-xs">
        Conferindo o que já foi enviado…
      </p>
    )
  }

  if (lista.length === 0) {
    return (
      <p className="text-muted-foreground border-t pt-3 text-xs">
        Primeiro presente que você manda para este cliente.
      </p>
    )
  }

  return (
    <div className="space-y-2 border-t pt-3">
      <p className="font-ui text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
        Você já mandou
      </p>
      <ul className="space-y-1.5">
        {lista.map((s) => (
          <li key={s.codigo} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="text-muted-foreground tabular-nums">{formatarData(s.data)}</span>
            <span className="min-w-0 flex-1">{s.itens.join(', ')}</span>
            <StatusBadge status={s.status} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Escolha dos itens.
 *
 * O catálogo tem quase cinquenta presentes, então a etapa é uma tela de
 * escolha de verdade: busca, filtro por categoria e a grade inteira na página.
 * A versão anterior punha tudo numa caixa de rolagem de três cards, o que
 * obrigava a rolar dentro de uma caixa dentro da página para conhecer o que
 * existe.
 *
 * Cada card diz o que o consultor precisa para decidir: a foto, o preço, se
 * sai da prateleira ou espera compra, e o link da loja para ver medida e sabor
 * antes de escolher.
 */
function EtapaItens({
  produtos,
  categorias,
  busca,
  setBusca,
  categoria,
  setCategoria,
  quantidadeDe,
  adicionar,
  filtroAcompanhamento,
  limparAcompanhamento,
  especifico,
  setEspecifico,
  adicionarEspecifico,
  itensEscolhidos,
  total,
  saldo,
}: {
  produtos: ProdutoDoCatalogo[]
  categorias: { nome: string; total: number }[]
  busca: string
  setBusca: (v: string) => void
  categoria: string
  setCategoria: (v: string) => void
  /** Quantas unidades deste produto já estão na solicitação. */
  quantidadeDe: (id: string) => number
  adicionar: (p: ProdutoDoCatalogo) => void
  /** Rótulo pedido pelo aviso, quando a grade está recortada nele. */
  filtroAcompanhamento: string | null
  limparAcompanhamento: () => void
  especifico: { descricao: string; url: string; valor: string; quantidade: number }
  setEspecifico: (v: { descricao: string; url: string; valor: string; quantidade: number }) => void
  adicionarEspecifico: () => void
  itensEscolhidos: number
  total: number
  saldo: Saldo | null
}) {
  const filtrando = Boolean(busca.trim() || categoria)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <h2 className="font-display text-lg font-semibold">O que vai no envio?</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Escolha do catálogo ou descreva um presente específico com o link onde comprar.
          </p>
        </div>

        {itensEscolhidos > 0 ? (
          <p className="text-right text-sm">
            <span className="text-muted-foreground">
              {itensEscolhidos} {itensEscolhidos === 1 ? 'item' : 'itens'}
            </span>
            <span className="block font-semibold tabular-nums">{brl(total)}</span>
          </p>
        ) : null}
      </div>

      {/* Estourar o limite não impede o pedido, sinaliza. O veto depende de
          decisão da área, ver docs/05-perguntas-em-aberto.md. */}
      {saldo?.estoura ? (
        <p className="border-warning/40 bg-warning/10 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Com este pedido, o mês fecha em {brl(saldo.depois)}, acima do limite de{' '}
            {brl(saldo.limite)}. Dá para seguir assim, mas o Admin vai ver o estouro.
          </span>
        </p>
      ) : null}

      {/* O recorte é forte o bastante para esconder o catálogo inteiro, então
          ele se anuncia, e sai com um clique. */}
      {filtroAcompanhamento ? (
        <div className="bg-muted/40 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2">
          <p className="min-w-0 flex-1 text-sm">
            Mostrando só o que serve como <strong>{filtroAcompanhamento}</strong>.
          </p>
          <Button variant="ghost" size="sm" onClick={limparAcompanhamento}>
            Ver o catálogo inteiro
          </Button>
        </div>
      ) : null}

      <div className="space-y-3">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar no catálogo"
          aria-label="Buscar no catálogo"
        />

        {/* As mesmas pílulas do catálogo: com quase cinquenta presentes, a
            categoria é o primeiro corte que a pessoa faz. */}
        <div
          role="group"
          aria-label="Filtrar por categoria"
          className="-mx-1 flex flex-wrap gap-2 px-1"
        >
          <PilulaDeCategoria
            rotulo="Todos"
            total={produtos.length}
            ativa={!categoria}
            aoClicar={() => setCategoria('')}
          />
          {categorias.map((c) => (
            <PilulaDeCategoria
              key={c.nome}
              rotulo={c.nome}
              total={c.total}
              ativa={categoria === c.nome}
              aoClicar={() => setCategoria(categoria === c.nome ? '' : c.nome)}
            />
          ))}
        </div>
      </div>

      {produtos.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center">
          <p className="text-sm font-medium">Nenhum presente com esse filtro</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Tente outra busca, ou descreva um presente específico aqui embaixo.
          </p>
          {filtrando ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => {
                setBusca('')
                setCategoria('')
              }}
            >
              Limpar filtros
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {produtos.map((p) => (
            <CardDeProduto
              key={p.id}
              produto={p}
              quantidade={quantidadeDe(p.id)}
              adicionar={() => adicionar(p)}
            />
          ))}
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-dashed p-4">
        <p className="font-display font-semibold">Presente específico</p>
        <p className="text-muted-foreground -mt-3 text-sm">
          Fora do catálogo. O link é obrigatório: é por ele que o Financeiro compra.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="desc-livre">O que é</Label>
            <Input
              id="desc-livre"
              value={especifico.descricao}
              onChange={(e) => setEspecifico({ ...especifico, descricao: e.target.value })}
              placeholder="Ex.: enxoval de berço bordado"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="url-livre">Link onde comprar</Label>
            <Input
              id="url-livre"
              type="url"
              value={especifico.url}
              onChange={(e) => setEspecifico({ ...especifico, url: e.target.value })}
              placeholder="https://"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="valor-livre">Valor unitário</Label>
            <Input
              id="valor-livre"
              value={especifico.valor}
              inputMode="decimal"
              onChange={(e) => setEspecifico({ ...especifico, valor: e.target.value })}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qtd-livre">Quantidade</Label>
            <Input
              id="qtd-livre"
              type="number"
              min={1}
              value={especifico.quantidade}
              onChange={(e) =>
                setEspecifico({ ...especifico, quantidade: Number(e.target.value) || 1 })
              }
            />
          </div>
        </div>
        <Button variant="outline" onClick={adicionarEspecifico}>
          <Plus aria-hidden="true" />
          Adicionar item específico
        </Button>
      </div>
    </div>
  )
}

function EtapaEntrega({
  entrega,
  setEntrega,
  buscando,
  procurar,
  erros,
  sugestao,
}: {
  entrega: Endereco
  setEntrega: React.Dispatch<React.SetStateAction<Endereco>>
  buscando: boolean
  procurar: () => void
  erros: Record<string, string>
  sugestao: string
}) {
  const campo = (k: keyof Endereco) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEntrega((atual) => ({ ...atual, [k]: e.target.value }))

  // Depois que o CEP preenche rua, bairro e cidade, o que falta digitar é o
  // número. O foco vai para lá sozinho, que é o próximo movimento de quem
  // preenche endereço.
  const numeroRef = useRef<HTMLInputElement>(null)
  const jaFocou = useRef(false)
  useEffect(() => {
    if (!entrega.logradouro || entrega.numero || jaFocou.current) return
    jaFocou.current = true
    numeroRef.current?.focus()
  }, [entrega.logradouro, entrega.numero])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold">Para onde enviar?</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          O endereço fica gravado nesta solicitação. Se o cliente se mudar, o histórico continua
          mostrando para onde o presente foi.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-6">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cep">CEP</Label>
          <div className="flex gap-2">
            <Input
              id="cep"
              value={entrega.cep}
              inputMode="numeric"
              placeholder="00000-000"
              aria-invalid={Boolean(erros['cep'])}
              onChange={(e) => setEntrega((a) => ({ ...a, cep: mascaraDeCep(e.target.value) }))}
              onBlur={() => cepValido(entrega.cep) && procurar()}
            />
            <Button
              variant="outline"
              onClick={procurar}
              disabled={buscando || !cepValido(entrega.cep)}
            >
              {buscando ? <Loader2 className="animate-spin" aria-hidden="true" /> : 'Buscar'}
            </Button>
          </div>
          <ErroDoCampo mensagem={erros['cep']} />
        </div>

        <div className="space-y-1.5 sm:col-span-4">
          <Label htmlFor="logradouro">Logradouro</Label>
          <Input
            id="logradouro"
            value={entrega.logradouro}
            aria-invalid={Boolean(erros['logradouro'])}
            onChange={campo('logradouro')}
          />
          <ErroDoCampo mensagem={erros['logradouro']} />
        </div>

        <div className="space-y-1.5 sm:col-span-1">
          <Label htmlFor="numero">Número</Label>
          <Input
            id="numero"
            ref={numeroRef}
            value={entrega.numero}
            aria-invalid={Boolean(erros['numero'])}
            onChange={campo('numero')}
          />
          <ErroDoCampo mensagem={erros['numero']} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="complemento">Complemento</Label>
          <Input id="complemento" value={entrega.complemento} onChange={campo('complemento')} />
          <p className="text-muted-foreground text-xs">Opcional: apartamento, bloco, sala.</p>
        </div>

        <div className="space-y-1.5 sm:col-span-3">
          <Label htmlFor="bairro">Bairro</Label>
          <Input
            id="bairro"
            value={entrega.bairro}
            aria-invalid={Boolean(erros['bairro'])}
            onChange={campo('bairro')}
          />
          <ErroDoCampo mensagem={erros['bairro']} />
        </div>

        <div className="space-y-1.5 sm:col-span-4">
          <Label htmlFor="cidade">Cidade</Label>
          <Input
            id="cidade"
            value={entrega.cidade}
            aria-invalid={Boolean(erros['cidade'])}
            onChange={campo('cidade')}
          />
          <ErroDoCampo mensagem={erros['cidade']} />
        </div>

        {/* Lista fechada: o CEP preenche sozinho, e quem digita à mão não
            inventa uma sigla que a transportadora não reconhece. */}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="uf">Estado</Label>
          <Select
            id="uf"
            value={entrega.uf.toUpperCase()}
            aria-invalid={Boolean(erros['uf'])}
            onChange={(e) => setEntrega((a) => ({ ...a, uf: e.target.value }))}
          >
            <option value="">UF</option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </Select>
          <ErroDoCampo mensagem={erros['uf']} />
        </div>

        <div className="space-y-1.5 sm:col-span-6">
          <Label htmlFor="destinatario">Quem recebe</Label>
          <Input
            id="destinatario"
            value={entrega.destinatario}
            aria-invalid={Boolean(erros['destinatario'])}
            onChange={campo('destinatario')}
            placeholder={sugestao}
          />
          <ErroDoCampo mensagem={erros['destinatario']} />
          {sugestao && !entrega.destinatario ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEntrega((a) => ({ ...a, destinatario: sugestao }))}
            >
              Usar “{sugestao}”
            </Button>
          ) : (
            <p className="text-muted-foreground text-xs">
              Vai na etiqueta e na saudação da carta. Pode ser outra pessoa, quando o presente é
              entregue no trabalho ou na casa de alguém.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * A carta.
 *
 * Tem prévia ao lado do campo porque é a única etapa cujo resultado é um
 * texto que alguém vai ler em papel: o que importa não é o que está no
 * `textarea`, é como a folha fica. E tem modelos porque a área escreve a
 * mesma carta dezenas de vezes por mês, mudando o nome.
 */
function EtapaCarta({
  carta,
  setCarta,
  erros,
  destinatario,
  consultor,
}: {
  carta: Carta
  setCarta: React.Dispatch<React.SetStateAction<Carta>>
  erros: Record<string, string>
  destinatario: string
  consultor: string
}) {
  const modelos = MODELOS_DE_CARTA[carta.motivo]
  const { restam, excedeu } = espacoRestante(carta.mensagem)
  const previa = previaDaCarta({
    destinatario,
    motivo: carta.motivo,
    motivoOutro: carta.motivoOutro,
    mensagem: carta.mensagem,
    remetente: consultor,
  })

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold">A carta que vai junto</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          A mensagem acompanha o presente. A impressão continua sendo feita fora do sistema.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="motivo">Motivo do envio</Label>
              <Select
                id="motivo"
                value={carta.motivo}
                onChange={(e) => setCarta({ ...carta, motivo: e.target.value as MotivoEnvio })}
              >
                {Object.entries(ROTULO_MOTIVO).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </Select>
            </div>

            {carta.motivo === MotivoEnvio.outro ? (
              <div className="space-y-1.5">
                <Label htmlFor="motivo-outro">Qual?</Label>
                <Input
                  id="motivo-outro"
                  value={carta.motivoOutro}
                  aria-invalid={Boolean(erros['motivoOutro'])}
                  placeholder="Formatura, mudança de casa…"
                  onChange={(e) => setCarta({ ...carta, motivoOutro: e.target.value })}
                />
                <ErroDoCampo mensagem={erros['motivoOutro']} />
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Label htmlFor="mensagem">Mensagem</Label>
              <span
                className={cn(
                  'text-xs tabular-nums',
                  excedeu ? 'text-error font-medium' : 'text-muted-foreground',
                )}
              >
                {excedeu ? `${-restam} a mais do que cabe` : `${restam} caracteres restantes`}
              </span>
            </div>
            <Textarea
              id="mensagem"
              rows={6}
              value={carta.mensagem}
              aria-invalid={Boolean(erros['mensagem'])}
              onChange={(e) => setCarta({ ...carta, mensagem: e.target.value })}
              placeholder="Escreva a mensagem que vai na carta."
            />
            <ErroDoCampo mensagem={erros['mensagem']} />

            {/* Ponto de partida, não texto final: o consultor escolhe e edita.
                As frases moram em src/lib/carta.ts. */}
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs">
                {carta.mensagem.trim() ? 'Trocar por um modelo:' : 'Começar de um modelo:'}
              </p>
              <div className="flex flex-wrap gap-2">
                {modelos.map((modelo, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      setCarta((c) => ({ ...c, mensagem: aplicarModelo(modelo, destinatario) }))
                    }
                    className="ease-apple hover:border-primary/40 max-w-full rounded-lg border px-3 py-2 text-left text-xs leading-snug transition-colors duration-200 hover:shadow-sm"
                  >
                    <span className="line-clamp-2">{aplicarModelo(modelo, destinatario)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs">Observações internas</Label>
            <Textarea
              id="obs"
              rows={2}
              value={carta.observacoes}
              onChange={(e) => setCarta({ ...carta, observacoes: e.target.value })}
              placeholder="Não vai na carta. Fica para quem processa o envio."
            />
            <p className="text-muted-foreground text-xs">
              Para quem separa e envia: “entregar depois do dia 10”, “embrulhar junto com o outro
              pedido”.
            </p>
          </div>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="font-ui text-muted-foreground mb-2 text-[10px] font-semibold tracking-[0.14em] uppercase">
            Como vai ficar
          </p>
          <FolhaDaCarta previa={previa} className="min-h-64" />
          {!destinatario ? (
            <p className="text-muted-foreground mt-2 text-xs">
              A saudação usa o nome de quem recebe, preenchido na etapa de entrega.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/**
 * Revisão.
 *
 * Cada bloco volta para a etapa que o preencheu: quem encontra um erro aqui
 * quer corrigir aquilo, não recomeçar o caminho. E a tela diz por onde o
 * pedido vai passar depois da aprovação, que é a pergunta seguinte de quem
 * acabou de enviar.
 */
function EtapaRevisao({
  cliente,
  itens,
  entrega,
  carta,
  total,
  consultor,
  passaPeloFinanceiro,
  saldo,
  aoEditar,
}: {
  cliente: ClienteEncontrado | null
  itens: ItemEscolhido[]
  entrega: Endereco
  carta: Carta
  total: number
  consultor: string
  passaPeloFinanceiro: boolean
  saldo: Saldo | null
  aoEditar: (etapa: Etapa) => void
}) {
  const previa = previaDaCarta({
    destinatario: entrega.destinatario,
    motivo: carta.motivo,
    motivoOutro: carta.motivoOutro,
    mensagem: carta.mensagem,
    remetente: consultor,
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold">Confira antes de enviar</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Nada foi criado ainda. A solicitação nasce ao enviar, com o código e o histórico.
        </p>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <Bloco titulo="Cliente" aoEditar={() => aoEditar(0)}>
          <p className="font-medium">{cliente?.nome}</p>
          <p className="text-muted-foreground tabular-nums">
            {cliente ? formatarCpf(cliente.cpf) : null}
          </p>
        </Bloco>

        <Bloco titulo="Entrega" aoEditar={() => aoEditar(2)}>
          <p className="font-medium">{entrega.destinatario}</p>
          <p className="text-muted-foreground">
            {entrega.logradouro}, {entrega.numero}
            {entrega.complemento ? `, ${entrega.complemento}` : ''}
          </p>
          <p className="text-muted-foreground">
            {entrega.bairro} · {entrega.cidade}/{entrega.uf.toUpperCase()} ·{' '}
            <span className="tabular-nums">{formatarCep(entrega.cep)}</span>
          </p>
        </Bloco>
      </dl>

      {/* A lista inteira, e não só a contagem: é a última chance de ver que
          foram dois vinhos em vez de um. */}
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="font-ui text-muted-foreground text-xs font-semibold tracking-[0.1em] uppercase">
            Itens
          </p>
          <BotaoEditar aoEditar={() => aoEditar(1)} rotulo="Editar itens" />
        </div>

        <ul className="divide-y rounded-lg border">
          {itens.map((item, i) => {
            const nome = item.tipo === 'catalogo' ? item.produto.nome : item.descricao
            const semPreco = item.tipo === 'catalogo' && item.produto.valor === null
            const unitario =
              item.tipo === 'catalogo'
                ? valorOuZero(item.produto.valor)
                : Number(item.valor.replace(',', '.')) || 0

            return (
              <li key={i} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{nome}</span>
                  <span className="text-muted-foreground block text-xs tabular-nums">
                    {item.quantidade} × {semPreco ? 'valor a definir' : brl(unitario)}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">{brl(unitario * item.quantidade)}</span>
              </li>
            )
          })}

          <li className="flex items-baseline justify-between gap-3 px-4 py-3">
            <span className="text-muted-foreground text-sm">Total</span>
            <span className="text-lg font-semibold tabular-nums">{brl(total)}</span>
          </li>
        </ul>

        {saldo?.estoura ? (
          <p className="text-muted-foreground mt-2 text-xs">
            O mês fecha em {brl(saldo.depois)}, acima do limite de {brl(saldo.limite)}.
          </p>
        ) : null}
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="font-ui text-muted-foreground text-xs font-semibold tracking-[0.1em] uppercase">
            Carta · {previa.ocasiao}
          </p>
          <BotaoEditar aoEditar={() => aoEditar(3)} rotulo="Editar a carta" />
        </div>
        <FolhaDaCarta previa={previa} />

        {carta.observacoes.trim() ? (
          <p className="text-muted-foreground mt-3 text-xs">
            <span className="font-medium">Observação interna:</span> {carta.observacoes}
          </p>
        ) : null}
      </div>

      {/*
        Mesma decisão que `proximoDepoisDaAprovacao` toma em src/lib/status.ts.
        Nada sai daqui sem o OK do Admin: o que muda é o que vem logo depois.
      */}
      <div className="bg-muted/40 rounded-lg p-4 text-sm">
        <p className="font-ui text-muted-foreground mb-1.5 text-xs font-semibold tracking-[0.1em] uppercase">
          O que acontece ao enviar
        </p>
        <p>
          O pedido entra como <strong>pendente</strong> e espera a aprovação do Admin.{' '}
          {passaPeloFinanceiro
            ? 'Depois dela, passa pelo Financeiro, porque há item que precisa ser comprado.'
            : 'Depois dela, vai direto para a expedição separar: está tudo em estoque.'}
        </p>
      </div>
    </div>
  )
}

function BotaoEditar({ aoEditar, rotulo }: { aoEditar: () => void; rotulo: string }) {
  return (
    <button
      type="button"
      onClick={aoEditar}
      className="text-muted-foreground hover:text-primary-emphasis inline-flex items-center gap-1 text-xs underline-offset-4 transition-colors hover:underline"
    >
      <Pencil className="size-3" aria-hidden="true" />
      {rotulo}
    </button>
  )
}

function Bloco({
  titulo,
  children,
  aoEditar,
}: {
  titulo: string
  children: React.ReactNode
  aoEditar?: () => void
}) {
  return (
    <div className="bg-muted/40 rounded-lg p-4 text-sm">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <dt className="font-ui text-muted-foreground text-xs font-semibold tracking-[0.1em] uppercase">
          {titulo}
        </dt>
        {aoEditar ? <BotaoEditar aoEditar={aoEditar} rotulo="Editar" /> : null}
      </div>
      <dd className="space-y-0.5">{children}</dd>
    </div>
  )
}

/** Coluna lateral com o que já foi escolhido, visível em todas as etapas. */
function Resumo({
  acao,
  cliente,
  itens,
  total,
  saldo,
  passaPeloFinanceiro,
  remover,
  mudarQuantidade,
}: {
  acao: React.ReactNode
  cliente: ClienteEncontrado | null
  itens: ItemEscolhido[]
  total: number
  saldo: Saldo | null
  passaPeloFinanceiro: boolean
  remover: (i: number) => void
  mudarQuantidade: (i: number, q: number) => void
}) {
  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <Card>
        <CardContent className="space-y-4 p-5">
          <p className="font-ui text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
            Resumo
          </p>

          {cliente ? (
            <div className="text-sm">
              <p className="font-medium">{cliente.nome}</p>
              <p className="text-muted-foreground tabular-nums">{formatarCpf(cliente.cpf)}</p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhum cliente escolhido ainda.</p>
          )}

          <div className="space-y-3 border-t pt-4">
            {itens.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum item adicionado.</p>
            ) : (
              itens.map((item, i) => {
                const nome = item.tipo === 'catalogo' ? item.produto.nome : item.descricao
                const semPreco = item.tipo === 'catalogo' && item.produto.valor === null
                const valor =
                  item.tipo === 'catalogo'
                    ? valorOuZero(item.produto.valor)
                    : Number(item.valor.replace(',', '.')) || 0

                return (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="leading-snug font-medium">{nome}</p>
                      <p className="text-muted-foreground tabular-nums">
                        {item.quantidade} × {semPreco ? 'valor a definir' : brl(valor)}
                      </p>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={item.quantidade}
                      aria-label={`Quantidade de ${nome}`}
                      onChange={(e) => mudarQuantidade(i, Number(e.target.value))}
                      className="border-input h-8 w-14 rounded-md border px-2 text-sm tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => remover(i)}
                      aria-label={`Remover ${nome}`}
                      className="text-muted-foreground hover:text-error mt-1 transition-colors"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                )
              })
            )}
          </div>

          <div className="space-y-1 border-t pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground text-sm">Total</span>
              <span className="font-body text-xl font-semibold tabular-nums">{brl(total)}</span>
            </div>

            {/* A rota depois da aprovação muda o prazo, e o consultor decide
                com ela em mente: trocar um item sob encomenda por um de
                prateleira é a diferença entre semanas e dias. */}
            {itens.length > 0 ? (
              <p className="text-muted-foreground text-xs">
                {passaPeloFinanceiro
                  ? 'Depois da aprovação, passa pelo Financeiro comprar.'
                  : 'Depois da aprovação, vai direto para a expedição.'}
              </p>
            ) : null}
          </div>

          {saldo ? <BarraDeSaldo saldo={saldo} /> : null}
        </CardContent>
      </Card>

      {/* No celular o resumo vem depois do botão do fim da etapa: repetir
          seria o mesmo botão duas vezes, um embaixo do outro. */}
      <div className="mt-4 hidden lg:block">{acao}</div>
    </aside>
  )
}

/**
 * Quanto do mês já foi, com este pedido contado dentro.
 *
 * A conta é a de `src/lib/saldo.ts`: tudo conta, cancelado e devolvido
 * inclusive, porque a área reenvia. Estourar sinaliza e não impede, ver
 * `docs/05-perguntas-em-aberto.md`.
 */
function BarraDeSaldo({ saldo }: { saldo: Saldo }) {
  return (
    <div className="space-y-1.5 border-t pt-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-ui text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
          Seu mês
        </span>
        <span
          className={cn(
            'text-xs tabular-nums',
            saldo.estoura ? 'text-warning font-medium' : 'text-muted-foreground',
          )}
        >
          {brl(saldo.depois)} de {brl(saldo.limite)}
        </span>
      </div>

      <div
        className="bg-muted h-1.5 overflow-hidden rounded-full"
        role="img"
        aria-label={`${Math.round(saldo.percentual)}% do limite do mês`}
      >
        <div
          className={cn(
            'ease-apple h-full rounded-full transition-[width] duration-500',
            saldo.estoura ? 'bg-warning' : 'bg-primary',
          )}
          style={{ width: `${Math.max(2, saldo.percentual)}%` }}
        />
      </div>

      <p className="text-muted-foreground text-xs">
        {saldo.estoura
          ? `Passa ${brl(-saldo.restante)} do limite. Não impede o pedido.`
          : `Restam ${brl(saldo.restante)} neste mês.`}
      </p>
    </div>
  )
}

/** Pílula de categoria, no padrão do catálogo. */
function PilulaDeCategoria({
  rotulo,
  total,
  ativa,
  aoClicar,
}: {
  rotulo: string
  total: number
  ativa: boolean
  aoClicar: () => void
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativa}
      className={cn(
        'ease-apple rounded-xl border px-3 py-1.5 text-left transition-[border-color,background-color,box-shadow] duration-200',
        ativa
          ? 'border-primary bg-primary/5 ring-primary/25 ring-2'
          : 'hover:border-primary/40 hover:shadow-sm',
      )}
    >
      <span className="font-display block text-xs leading-tight font-bold whitespace-nowrap">
        {rotulo}
      </span>
      <span className="font-roboto text-muted-foreground mt-0.5 block text-[10px] leading-tight">
        {total} {total === 1 ? 'item' : 'itens'}
      </span>
    </button>
  )
}

/**
 * Card de produto na escolha.
 *
 * O card inteiro adiciona, e o link da loja abre numa aba nova sem adicionar
 * nada. Por isso o card é uma `div` com um botão que a cobre, e não um
 * `<button>` com o link dentro: âncora dentro de botão é HTML inválido, e o
 * navegador desmonta a estrutura de um jeito que ninguém consegue prever.
 */
function CardDeProduto({
  produto,
  quantidade,
  adicionar,
}: {
  produto: ProdutoDoCatalogo
  quantidade: number
  adicionar: () => void
}) {
  const semEstoque = produto.controlaEstoque && !produto.estoque

  return (
    <div
      className={cn(
        'group bg-card ease-apple relative flex flex-col overflow-hidden rounded-xl border transition-[border-color,box-shadow] duration-200',
        quantidade > 0 ? 'border-primary ring-primary/20 ring-2' : 'hover:border-primary/40',
      )}
    >
      <ProdutoImagem
        fotoUrl={produto.fotoUrl}
        nome={produto.nome}
        categoria={produto.categoriaNome}
      />

      {quantidade > 0 ? (
        <span className="bg-primary text-primary-foreground font-ui absolute top-2 right-2 z-20 grid size-7 place-items-center rounded-full text-xs font-bold tabular-nums">
          {quantidade}
        </span>
      ) : null}

      <div className="flex flex-1 flex-col items-start gap-1.5 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <CategoriaBadge categoria={produto.categoriaNome} />
          {/* Dito antes de escolher, e não só no aviso que trava depois. */}
          {produto.exigeAcompanhamento ? (
            <Badge variant="outline">vai com {produto.exigeAcompanhamento}</Badge>
          ) : null}
        </div>
        <p className="font-display text-sm leading-snug font-semibold text-balance">
          {produto.nome}
        </p>

        <LinkDoProduto url={produto.urlCompra} className="relative z-20" />

        <div className="mt-auto flex w-full items-end justify-between gap-2 pt-2">
          <span className="text-sm font-medium">
            {produto.valor === null ? (
              <span className="text-muted-foreground font-normal">valor a definir</span>
            ) : (
              <>
                {produto.tipoValor === 'medio' ? (
                  <span className="text-muted-foreground text-xs">a partir de </span>
                ) : null}
                {brl(produto.valor)}
              </>
            )}
          </span>

          {semEstoque ? (
            <Badge variant="muted">sem estoque</Badge>
          ) : produto.origem === 'estoque_interno' ? (
            <Badge variant="outline">pronta entrega</Badge>
          ) : (
            <Badge variant="muted">sob encomenda</Badge>
          )}
        </div>
      </div>

      {/* Cobre o card sem envolver o link, que tem z-index maior. */}
      <button
        type="button"
        onClick={adicionar}
        aria-label={
          quantidade > 0 ? `Adicionar outro ${produto.nome}` : `Adicionar ${produto.nome}`
        }
        className="focus-visible:ring-primary absolute inset-0 z-10 cursor-pointer rounded-xl focus-visible:ring-2 focus-visible:outline-none"
      />
    </div>
  )
}
