/**
 * O pedido no formato de `pedido.incluir.php` (API v2 do Tiny), montado igual
 * para o presente aprovado e para a linha da planilha.
 *
 * Os tamanhos máximos vêm da documentação: campo maior que o limite faz o
 * Tiny recusar o pedido inteiro, então aqui ele é cortado antes.
 */

export type Destinatario = {
  nome: string
  /** Só dígitos: 11 é CPF, 14 é CNPJ. */
  cpfCnpj: string
  email?: string | null
  telefone?: string | null
  cep: string
  endereco: string
  numero: string
  complemento?: string | null
  bairro: string
  cidade: string
  uf: string
}

export type ItemDoPedido = {
  /** SKU no Tiny. Sem ele, o item entra só pela descrição. */
  codigo?: string | null
  descricao: string
  quantidade: number
  /** Decimal com ponto: "35.00". */
  valorUnitario: string
}

export type DadosDoPedido = {
  destinatario: Destinatario
  /** Quem recebe, quando não é o próprio cliente; vai no endereço de entrega. */
  nomeDoDestinatario?: string | null
  itens: ItemDoPedido[]
  transportadora?: string | null
  formaFrete?: string | null
  marcador?: string | null
  /** O código desta ferramenta (SOL-2026-0012), para achar o pedido no Tiny. */
  numeroNoSistema?: string | null
  observacao?: string | null
}

type ItemNoTiny = {
  item: {
    codigo?: string
    descricao: string
    unidade: string
    quantidade: string
    valor_unitario: string
  }
}

export type PedidoParaOTiny = {
  cliente: Record<string, string>
  endereco_entrega: Record<string, string>
  itens: ItemNoTiny[]
  marcadores?: { marcador: { descricao: string } }[]
  nome_transportador?: string
  forma_frete?: string
  frete_por_conta: 'R' | 'D'
  numero_pedido_ecommerce?: string
  obs?: string
}

const corte = (valor: string | null | undefined, maximo: number) =>
  (valor ?? '').replace(/\s+/g, ' ').trim().slice(0, maximo)

const digitos = (valor: string | null | undefined) => (valor ?? '').replace(/\D/g, '')

/** CEP como o Tiny guarda: 00000-000. */
const cepFormatado = (cep: string) => {
  const d = digitos(cep)
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

export function tipoDePessoa(cpfCnpj: string): 'F' | 'J' {
  return digitos(cpfCnpj).length === 14 ? 'J' : 'F'
}

export function montarPedido(dados: DadosDoPedido): PedidoParaOTiny {
  const d = dados.destinatario
  const endereco = {
    endereco: corte(d.endereco, 50),
    numero: corte(d.numero, 10),
    complemento: corte(d.complemento, 50),
    bairro: corte(d.bairro, 30),
    cep: cepFormatado(d.cep),
    cidade: corte(d.cidade, 30),
    uf: corte(d.uf, 2).toUpperCase(),
  }

  const pedido: PedidoParaOTiny = {
    cliente: {
      // A documentação diz 30 caracteres, mas o Tiny guarda nomes maiores; o
      // corte em 60 só evita nome absurdo de planilha.
      nome: corte(d.nome, 60),
      tipo_pessoa: tipoDePessoa(d.cpfCnpj),
      cpf_cnpj: digitos(d.cpfCnpj),
      email: corte(d.email, 50),
      fone: digitos(d.telefone).slice(0, 40),
      ...endereco,
      // O pedido cria o cliente que não existe e atualiza o que existe, pelo
      // CPF: não é preciso chamar o cadastro de contatos antes.
      atualizar_cliente: 'S',
    },
    endereco_entrega: {
      ...endereco,
      tipo_pessoa: tipoDePessoa(d.cpfCnpj),
      cpf_cnpj: digitos(d.cpfCnpj),
      fone: digitos(d.telefone).slice(0, 40),
      nome_destinatario: corte(dados.nomeDoDestinatario || d.nome, 60),
    },
    itens: dados.itens.map((i) => ({
      item: {
        ...(i.codigo ? { codigo: corte(i.codigo, 60) } : {}),
        descricao: corte(i.descricao, 120),
        unidade: 'UN',
        quantidade: String(i.quantidade),
        valor_unitario: i.valorUnitario,
      },
    })),
    // "R" é por conta do remetente, a AUVP. O AUVP-Eventos mandava "E", que não
    // está entre os valores que a documentação aceita (R ou D).
    frete_por_conta: 'R',
  }

  if (dados.marcador?.trim()) {
    pedido.marcadores = [{ marcador: { descricao: corte(dados.marcador, 50) } }]
  }
  if (dados.transportadora?.trim()) pedido.nome_transportador = corte(dados.transportadora, 100)
  if (dados.formaFrete?.trim()) pedido.forma_frete = corte(dados.formaFrete, 30)
  if (dados.numeroNoSistema?.trim()) {
    pedido.numero_pedido_ecommerce = corte(dados.numeroNoSistema, 50)
  }
  if (dados.observacao?.trim()) pedido.obs = corte(dados.observacao, 100)

  return pedido
}

/** "2× Livro AUVP, 1× Caneca": o que vai, numa linha, para as telas. */
export function resumoDosItens(itens: readonly Pick<ItemDoPedido, 'descricao' | 'quantidade'>[]) {
  return itens.map((i) => `${i.quantidade}× ${i.descricao}`).join(', ')
}

/**
 * Os serviços de cada transportadora, como no AUVP-Eventos: o Tiny lista as
 * transportadoras, mas o nome do serviço é o do contrato da AUVP.
 */
export function servicosDaTransportadora(nome: string): string[] {
  const n = nome.toLowerCase()
  if (n.includes('correios')) return ['PAC CONTRATO', 'SEDEX CONTRATO', 'CARTA']
  if (n.includes('total')) return ['Serviço Expresso']
  return ['Padrao']
}

/** Chaves de idempotência: o que não pode virar dois pedidos. */
export const chaveDoPresente = (solicitacaoId: string) => `presente:${solicitacaoId}`

export function chaveDoLote(marcador: string, cpfCnpj: string, sku: string | null | undefined) {
  return `lote:${marcador.trim().toLowerCase()}:${digitos(cpfCnpj)}:${(sku ?? '').trim().toLowerCase()}`
}
