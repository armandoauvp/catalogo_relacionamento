'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Loader2, Minus, Plus, Search, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  buscarClientesParaPedido,
  buscarProdutosNoTiny,
  buscarTransportadoras,
  criarPedidoAvulso,
  type ClienteParaPedido,
} from '@/lib/actions/tiny'
import type { ProdutoDoTiny } from '@/lib/tiny/api'
import { formatarBRL, somar, subtotal } from '@/lib/money'
import {
  ROTULO_DA_COLUNA,
  UFS,
  validarLinha,
  valorDaCelula,
  type CampoDoLote,
} from '@/lib/tiny/lote'
import { servicosDaTransportadora } from '@/lib/tiny/pedido'
import { cn } from '@/lib/utils'

/**
 * "Nova venda" do AUVP-Eventos: um pedido avulso para o Tiny, com o cliente
 * achado lá ou na base daqui, vários produtos com preço e quantidade
 * ajustáveis, transportadora e marcador. Vai pela mesma fila dos outros.
 */

type CampoDoCliente = Exclude<CampoDoLote, 'quantidade' | 'valor'>

const VAZIO: Record<CampoDoCliente, string> = {
  nome: '',
  cpfCnpj: '',
  email: '',
  telefone: '',
  cep: '',
  endereco: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
}

const ORDEM: { campo: CampoDoCliente; largo?: boolean }[] = [
  { campo: 'nome', largo: true },
  { campo: 'cpfCnpj' },
  { campo: 'telefone' },
  { campo: 'email', largo: true },
  { campo: 'cep' },
  { campo: 'uf' },
  { campo: 'endereco', largo: true },
  { campo: 'numero' },
  { campo: 'complemento' },
  { campo: 'bairro' },
  { campo: 'cidade' },
]

type ItemNoCarrinho = { produto: ProdutoDoTiny; quantidade: number; valor: string }

function Campo({
  rotulo,
  dica,
  children,
  className,
}: {
  rotulo: string
  dica?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn('grid content-start gap-1.5 text-sm font-medium', className)}>
      {rotulo}
      {children}
      {dica ? <span className="text-muted-foreground text-xs font-normal">{dica}</span> : null}
    </label>
  )
}

const novaChave = () => crypto.randomUUID()

export function NovaVenda() {
  const [chave, setChave] = useState(novaChave)
  const [cliente, setCliente] = useState(VAZIO)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clientes, setClientes] = useState<ClienteParaPedido[] | null>(null)
  const [buscandoCliente, iniciarBuscaCliente] = useTransition()
  const [erroCliente, setErroCliente] = useState<string | null>(null)
  const [buscandoCep, setBuscandoCep] = useState(false)

  const [buscaProduto, setBuscaProduto] = useState('')
  const [produtos, setProdutos] = useState<ProdutoDoTiny[] | null>(null)
  const [buscandoProduto, iniciarBuscaProduto] = useTransition()
  const [erroProduto, setErroProduto] = useState<string | null>(null)
  const [carrinho, setCarrinho] = useState<ItemNoCarrinho[]>([])

  const [transportadoras, setTransportadoras] = useState<string[]>([])
  const [transportadora, setTransportadora] = useState('')
  const [servico, setServico] = useState('')
  const [marcador, setMarcador] = useState('')
  const [observacao, setObservacao] = useState('')

  const [enviando, iniciarEnvio] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [criado, setCriado] = useState<string | null>(null)

  useEffect(() => {
    buscarTransportadoras().then((r) => {
      if (r.ok) setTransportadoras(r.dados)
    })
  }, [])

  const servicos = useMemo(
    () => (transportadora ? servicosDaTransportadora(transportadora) : []),
    [transportadora],
  )
  const errosDoCliente = validarLinha({ ...cliente, quantidade: '1', valor: '' }).erros
  const valores = carrinho.map((i) => valorDaCelula(i.valor))
  const total = somar(
    carrinho.map((i, n) => (valores[n] ? subtotal(valores[n]!, i.quantidade) : 0)),
  )

  function procurarCliente() {
    setErroCliente(null)
    iniciarBuscaCliente(async () => {
      const r = await buscarClientesParaPedido(buscaCliente)
      if (!r.ok) return setErroCliente(r.erro)
      setClientes(r.dados)
      if (!r.dados.length) setErroCliente('Ninguém com esse nome ou documento. Preencha abaixo.')
    })
  }

  function escolherCliente(c: ClienteParaPedido) {
    setErro(null)
    setCliente({
      nome: c.nome,
      cpfCnpj: c.cpfCnpj,
      email: c.email ?? '',
      telefone: c.telefone ?? '',
      cep: c.cep,
      endereco: c.endereco,
      numero: c.numero,
      complemento: c.complemento,
      bairro: c.bairro,
      cidade: c.cidade,
      uf: c.uf,
    })
    setClientes(null)
  }

  async function procurarCep() {
    const cep = cliente.cep.replace(/\D/g, '')
    if (cep.length !== 8) return
    setBuscandoCep(true)
    try {
      const resposta = await fetch(`/api/cep/${cep}`)
      if (!resposta.ok) return
      const dados = await resposta.json()
      setCliente((c) => ({
        ...c,
        endereco: dados.logradouro || c.endereco,
        bairro: dados.bairro || c.bairro,
        cidade: dados.cidade || c.cidade,
        uf: dados.uf || c.uf,
      }))
    } finally {
      setBuscandoCep(false)
    }
  }

  function procurarProduto() {
    setErroProduto(null)
    iniciarBuscaProduto(async () => {
      const r = await buscarProdutosNoTiny(buscaProduto)
      if (!r.ok) return setErroProduto(r.erro)
      setProdutos(r.dados)
      if (!r.dados.length) setErroProduto('Nenhum produto com esse nome no Tiny.')
    })
  }

  function adicionar(p: ProdutoDoTiny) {
    setErro(null)
    setCarrinho((c) => {
      const ja = c.findIndex((i) => i.produto.id === p.id)
      if (ja >= 0) {
        return c.map((i, n) =>
          n === ja ? { ...i, quantidade: Math.min(999, i.quantidade + 1) } : i,
        )
      }
      return [
        ...c,
        { produto: p, quantidade: 1, valor: Number(p.preco).toFixed(2).replace('.', ',') },
      ]
    })
  }

  function mudarItem(n: number, mudanca: Partial<ItemNoCarrinho>) {
    setErro(null)
    setCarrinho((c) => c.map((i, k) => (k === n ? { ...i, ...mudanca } : i)))
  }

  function enviar() {
    setErro(null)
    if (errosDoCliente.length) return setErro(`Cliente: ${errosDoCliente.join(' ')}`)
    if (!carrinho.length) return setErro('Ponha ao menos um produto no pedido.')
    const semSku = carrinho.find((i) => !i.produto.codigo)
    if (semSku) {
      return setErro(`"${semSku.produto.nome}" não tem SKU no Tiny; cadastre o código lá primeiro.`)
    }
    if (valores.some((v) => !v)) return setErro('Algum valor está inválido: use só o número.')

    iniciarEnvio(async () => {
      const r = await criarPedidoAvulso({
        chave,
        destinatario: cliente,
        itens: carrinho.map((i, n) => ({
          codigo: i.produto.codigo,
          descricao: i.produto.nome,
          quantidade: i.quantidade,
          valorUnitario: valores[n]!,
        })),
        transportadora: transportadora || null,
        formaFrete: servico || null,
        marcador: marcador.trim() || null,
        observacao: observacao.trim() || null,
      })
      if (!r.ok) return setErro(r.erro)
      setCriado(cliente.nome)
    })
  }

  function recomecar() {
    setChave(novaChave())
    setCliente(VAZIO)
    setCarrinho([])
    setObservacao('')
    setCriado(null)
  }

  if (criado) {
    return (
      <div className="bg-card space-y-4 rounded-lg border p-6">
        <p className="font-display text-lg font-semibold">O pedido de {criado} entrou na fila.</p>
        <p className="text-muted-foreground text-sm">
          Ele vai ao Tiny em seguida. Se o Tiny recusar, o motivo aparece na fila, com o botão de
          reenviar.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/tiny">Ver na fila</Link>
          </Button>
          <Button variant="outline" onClick={recomecar}>
            Montar outro pedido
          </Button>
        </div>
      </div>
    )
  }

  return (
    // Qualquer digitação tira o erro do envio anterior, que já não vale.
    <div className="space-y-6" onInput={() => setErro(null)}>
      <section className="bg-card space-y-4 rounded-lg border p-5">
        <div>
          <h2 className="font-display text-lg font-semibold">1. O cliente</h2>
          <p className="text-muted-foreground text-sm">
            Busque no Tiny ou na base daqui pelo nome ou pelo CPF/CNPJ, ou preencha direto.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={buscaCliente}
            onChange={(e) => setBuscaCliente(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                procurarCliente()
              }
            }}
            placeholder="Nome ou CPF/CNPJ"
            aria-label="Buscar cliente"
            className="max-w-md"
          />
          <Button
            type="button"
            variant="outline"
            onClick={procurarCliente}
            disabled={buscandoCliente}
          >
            {buscandoCliente ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Search aria-hidden="true" />
            )}
            Buscar
          </Button>
        </div>
        {erroCliente ? <p className="text-muted-foreground text-sm">{erroCliente}</p> : null}
        {clientes?.length ? (
          <ul className="grid gap-2 sm:grid-cols-2" aria-label="Clientes encontrados">
            {clientes.map((c) => (
              <li key={`${c.origem}-${c.cpfCnpj}`}>
                <button
                  type="button"
                  onClick={() => escolherCliente(c)}
                  className="hover:border-foreground/30 focus-visible:ring-ring w-full rounded-lg border p-3 text-left text-sm transition-colors outline-none focus-visible:ring-2"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{c.nome}</span>
                    <Badge variant={c.origem === 'tiny' ? 'info' : 'muted'}>
                      {c.origem === 'tiny' ? 'Tiny' : 'Base daqui'}
                    </Badge>
                  </span>
                  <span className="text-muted-foreground block text-xs tabular-nums">
                    {c.cpfCnpj}
                    {c.cidade ? ` · ${c.cidade}/${c.uf}` : ' · sem endereço'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ORDEM.map(({ campo, largo }) => (
            <Campo
              key={campo}
              rotulo={ROTULO_DA_COLUNA[campo]}
              className={largo ? 'sm:col-span-2' : undefined}
              dica={campo === 'cep' && buscandoCep ? 'Buscando o endereço…' : undefined}
            >
              {campo === 'uf' ? (
                <Select
                  value={cliente.uf}
                  onChange={(e) => setCliente((c) => ({ ...c, uf: e.target.value }))}
                >
                  <option value="">-</option>
                  {UFS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={cliente[campo]}
                  onChange={(e) => setCliente((c) => ({ ...c, [campo]: e.target.value }))}
                  onBlur={campo === 'cep' ? procurarCep : undefined}
                  inputMode={campo === 'cep' || campo === 'cpfCnpj' ? 'numeric' : undefined}
                />
              )}
            </Campo>
          ))}
        </div>
        {errosDoCliente.length && cliente.nome ? (
          <p className="text-muted-foreground text-xs">Falta: {errosDoCliente.join(' ')}</p>
        ) : null}
      </section>

      <section className="bg-card space-y-4 rounded-lg border p-5">
        <div>
          <h2 className="font-display text-lg font-semibold">2. Os produtos</h2>
          <p className="text-muted-foreground text-sm">
            Do cadastro do Tiny, com o preço de lá, que pode ser ajustado aqui.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={buscaProduto}
            onChange={(e) => setBuscaProduto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                procurarProduto()
              }
            }}
            placeholder="Nome ou SKU do produto"
            aria-label="Buscar produto no Tiny"
            className="max-w-md"
          />
          <Button
            type="button"
            variant="outline"
            onClick={procurarProduto}
            disabled={buscandoProduto}
          >
            {buscandoProduto ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Search aria-hidden="true" />
            )}
            Buscar
          </Button>
        </div>
        {erroProduto ? <p className="text-destructive text-sm">{erroProduto}</p> : null}
        {produtos?.length ? (
          <ul className="grid gap-2 sm:grid-cols-2" aria-label="Produtos encontrados">
            {produtos.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => adicionar(p)}
                  className="hover:border-foreground/30 focus-visible:ring-ring flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm transition-colors outline-none focus-visible:ring-2"
                >
                  <span>
                    <span className="font-medium">{p.nome}</span>
                    <span className="text-muted-foreground block text-xs">
                      {p.codigo ? `SKU ${p.codigo}` : 'sem SKU'} · {formatarBRL(p.preco)}
                    </span>
                  </span>
                  <Plus className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                  <span className="sr-only">Adicionar</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {carrinho.length ? (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Produto</th>
                  <th className="px-3 py-2 font-medium">Quantidade</th>
                  <th className="px-3 py-2 font-medium">Valor unitário</th>
                  <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                  <th className="px-3 py-2">
                    <span className="sr-only">Tirar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {carrinho.map((i, n) => (
                  <tr key={i.produto.id} className="border-t">
                    <td className="px-3 py-2">
                      {i.produto.nome}
                      <span className="text-muted-foreground block text-xs">
                        {i.produto.codigo ? `SKU ${i.produto.codigo}` : 'sem SKU: não vai'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-8"
                          onClick={() =>
                            mudarItem(n, { quantidade: Math.max(1, i.quantidade - 1) })
                          }
                          aria-label={`Menos ${i.produto.nome}`}
                        >
                          <Minus aria-hidden="true" />
                        </Button>
                        <span className="w-8 text-center tabular-nums">{i.quantidade}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-8"
                          onClick={() =>
                            mudarItem(n, { quantidade: Math.min(999, i.quantidade + 1) })
                          }
                          aria-label={`Mais ${i.produto.nome}`}
                        >
                          <Plus aria-hidden="true" />
                        </Button>
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={i.valor}
                        onChange={(e) => mudarItem(n, { valor: e.target.value })}
                        inputMode="decimal"
                        aria-label={`Valor de ${i.produto.nome}`}
                        aria-invalid={!valores[n]}
                        className="w-28"
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {valores[n] ? formatarBRL(subtotal(valores[n]!, i.quantidade)) : '-'}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setCarrinho((c) => c.filter((_, k) => k !== n))}
                        aria-label={`Tirar ${i.produto.nome}`}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t">
                  <td colSpan={3} className="px-3 py-2 text-right font-medium">
                    Total dos produtos
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {formatarBRL(total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : null}
      </section>

      <section className="bg-card space-y-4 rounded-lg border p-5">
        <h2 className="font-display text-lg font-semibold">3. Envio</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Transportadora" dica="Vazio usa o padrão da conta no Tiny.">
            <Select
              value={transportadora}
              onChange={(e) => {
                setTransportadora(e.target.value)
                setServico(
                  e.target.value ? (servicosDaTransportadora(e.target.value)[0] ?? '') : '',
                )
              }}
            >
              <option value="">Padrão do Tiny</option>
              {transportadoras.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo rotulo="Serviço">
            <Select
              value={servico}
              onChange={(e) => setServico(e.target.value)}
              disabled={!servicos.length}
            >
              {servicos.length ? null : <option value="">-</option>}
              {servicos.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo rotulo="Marcador" dica="Opcional. Ex.: VENDA-EVENTO.">
            <Input value={marcador} onChange={(e) => setMarcador(e.target.value)} maxLength={50} />
          </Campo>
          <Campo rotulo="Observação" className="sm:col-span-3">
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              maxLength={300}
              rows={2}
            />
          </Campo>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="lg" onClick={enviar} disabled={enviando}>
          {enviando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Enviar pedido ao Tiny
        </Button>
        {erro ? (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            O pedido entra na fila e vai ao Tiny em seguida, como os presentes e os lotes.
          </p>
        )}
      </div>
    </div>
  )
}
