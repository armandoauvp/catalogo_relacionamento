'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { MotivoEnvio } from '@prisma/client'
import { Loader2, Lock, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatarBRL } from '@/lib/money'
import { ROTULO_MOTIVO } from '@/lib/validators/solicitacao'
import { corrigirSolicitacao } from '@/lib/actions/solicitacoes'

export type ProdutoParaCorrecao = { id: string; nome: string; valor: string | null }

type ItemDoFormulario = {
  /** Só existe na tela, para o React acompanhar a linha. */
  chave: string
  id: string | null
  produtoId: string | null
  descricaoLivre: string
  urlExterna: string
  valorUnitario: string
  quantidade: number
  doEstoque: boolean
  comprado: boolean
}

type Inicial = {
  solicitacaoId: string
  itens: Omit<ItemDoFormulario, 'chave'>[]
  entregaDestinatario: string
  entregaCep: string
  entregaLogradouro: string
  entregaNumero: string
  entregaComplemento: string
  entregaBairro: string
  entregaCidade: string
  entregaUf: string
  motivo: MotivoEnvio
  motivoOutro: string
  saudacaoCarta: string
  mensagemCarta: string
  observacoes: string
}

let proximaChave = 0
const novaChave = () => `item-${proximaChave++}`

/**
 * A correção do pedido, de uma vez: itens, entrega e carta, salvos juntos. O
 * item já comprado aparece travado, porque o que foi comprado é o que vai.
 */
export function FormularioDeCorrecao({
  inicial,
  produtos,
}: {
  inicial: Inicial
  produtos: ProdutoParaCorrecao[]
}) {
  const router = useRouter()
  const [salvando, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [buscandoCep, setBuscandoCep] = useState(false)

  const [itens, setItens] = useState<ItemDoFormulario[]>(() =>
    inicial.itens.map((i) => ({ ...i, chave: novaChave() })),
  )
  const [campos, setCampos] = useState(() => {
    const { itens: _itens, solicitacaoId: _id, ...resto } = inicial
    return resto
  })

  const porId = new Map(produtos.map((p) => [p.id, p]))
  const mudar = (chave: string, parcial: Partial<ItemDoFormulario>) =>
    setItens((lista) => lista.map((i) => (i.chave === chave ? { ...i, ...parcial } : i)))
  const campo = <K extends keyof typeof campos>(nome: K, valor: (typeof campos)[K]) =>
    setCampos((c) => ({ ...c, [nome]: valor }))

  // O total que a tela mostra usa o preço do catálogo para item do catálogo; a
  // action relê o banco e mantém o valor congelado do que já estava no pedido.
  const valorDoItem = (i: ItemDoFormulario) => {
    if (!i.produtoId) return Number(i.valorUnitario.replace(',', '.')) || 0
    const original = inicial.itens.find((o) => o.id === i.id)
    if (original && original.produtoId === i.produtoId) return Number(original.valorUnitario)
    return Number(porId.get(i.produtoId)?.valor ?? 0)
  }
  const total = itens.reduce((acc, i) => acc + valorDoItem(i) * i.quantidade, 0)

  async function buscarCep() {
    const cep = campos.entregaCep.replace(/\D/g, '')
    if (cep.length !== 8) return
    setBuscandoCep(true)
    try {
      const resposta = await fetch(`/api/cep/${cep}`)
      if (!resposta.ok) return setErro('CEP não encontrado. Preencha o endereço à mão.')
      const dados = await resposta.json()
      setCampos((c) => ({
        ...c,
        entregaLogradouro: dados.logradouro || c.entregaLogradouro,
        entregaBairro: dados.bairro || c.entregaBairro,
        entregaCidade: dados.cidade || c.entregaCidade,
        entregaUf: dados.uf || c.entregaUf,
      }))
    } catch {
      setErro('Não foi possível consultar o CEP agora.')
    } finally {
      setBuscandoCep(false)
    }
  }

  function salvar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)
    iniciar(async () => {
      const r = await corrigirSolicitacao({
        solicitacaoId: inicial.solicitacaoId,
        ...campos,
        itens: itens.map((i) => ({
          id: i.id,
          produtoId: i.produtoId,
          descricaoLivre: i.produtoId ? null : i.descricaoLivre,
          urlExterna: i.produtoId ? null : i.urlExterna,
          valorUnitario: i.produtoId ? '0' : i.valorUnitario,
          quantidade: i.quantidade,
          doEstoque: i.produtoId ? false : i.doEstoque,
        })),
      })
      if (!r.ok) return setErro(r.erro)
      router.push(`/admin/solicitacoes/${inicial.solicitacaoId}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={salvar} className="grid gap-6 lg:grid-cols-3" data-tour="corrigir-pedido">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-4">
            <CardTitle className="text-base">Itens</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setItens((l) => [
                  ...l,
                  {
                    chave: novaChave(),
                    id: null,
                    produtoId: null,
                    descricaoLivre: '',
                    urlExterna: '',
                    valorUnitario: '',
                    quantidade: 1,
                    doEstoque: false,
                    comprado: false,
                  },
                ])
              }
            >
              <Plus aria-hidden="true" /> Acrescentar item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {itens.map((item, n) => (
              <fieldset
                key={item.chave}
                disabled={item.comprado}
                className="border-border space-y-3 rounded-md border p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <legend className="text-sm font-medium">
                    Item {n + 1}
                    {item.comprado ? (
                      <span className="text-muted-foreground ml-2 inline-flex items-center gap-1 text-xs font-normal">
                        <Lock className="size-3" aria-hidden="true" /> já comprado, não muda
                      </span>
                    ) : null}
                  </legend>
                  {!item.comprado && itens.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setItens((l) => l.filter((i) => i.chave !== item.chave))}
                    >
                      <Trash2 aria-hidden="true" /> Tirar
                    </Button>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${item.chave}-tipo`}>Presente</Label>
                    <Select
                      id={`${item.chave}-tipo`}
                      value={item.produtoId ?? ''}
                      onChange={(e) =>
                        mudar(item.chave, {
                          produtoId: e.target.value || null,
                          doEstoque: e.target.value ? false : item.doEstoque,
                        })
                      }
                    >
                      <option value="">Presente específico (fora do catálogo)</option>
                      {produtos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                          {p.valor ? ` · ${formatarBRL(p.valor)}` : ' · valor a definir'}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${item.chave}-qtd`}>Qtd.</Label>
                    <Input
                      id={`${item.chave}-qtd`}
                      type="number"
                      min={1}
                      value={item.quantidade}
                      onChange={(e) =>
                        mudar(item.chave, { quantidade: Math.max(1, Number(e.target.value) || 1) })
                      }
                    />
                  </div>
                </div>

                {item.produtoId ? (
                  <p className="text-muted-foreground text-xs">
                    Do catálogo: o valor é o do catálogo ({formatarBRL(valorDoItem(item))}). Para
                    outro valor, use presente específico.
                  </p>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${item.chave}-descricao`}>Descrição</Label>
                      <Input
                        id={`${item.chave}-descricao`}
                        value={item.descricaoLivre}
                        onChange={(e) => mudar(item.chave, { descricaoLivre: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
                      <div className="space-y-1.5">
                        <Label htmlFor={`${item.chave}-link`}>Link</Label>
                        <Input
                          id={`${item.chave}-link`}
                          type="url"
                          placeholder="https://"
                          value={item.urlExterna}
                          onChange={(e) => mudar(item.chave, { urlExterna: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`${item.chave}-valor`}>Valor unitário (R$)</Label>
                        <Input
                          id={`${item.chave}-valor`}
                          inputMode="decimal"
                          value={item.valorUnitario}
                          onChange={(e) => mudar(item.chave, { valorUnitario: e.target.value })}
                        />
                      </div>
                    </div>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-primary mt-0.5 size-4"
                        checked={item.doEstoque}
                        onChange={(e) => mudar(item.chave, { doEstoque: e.target.checked })}
                      />
                      <span>
                        Sai do estoque da AUVP
                        <span className="text-muted-foreground block text-xs">
                          Cuia, vela e outros itens da casa: não passa pela fila de compras.
                        </span>
                      </span>
                    </label>
                  </>
                )}
              </fieldset>
            ))}
            <p className="text-right text-sm">
              Total: <span className="font-semibold tabular-nums">{formatarBRL(total)}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Carta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="motivo">Motivo</Label>
                <Select
                  id="motivo"
                  value={campos.motivo}
                  onChange={(e) => campo('motivo', e.target.value as MotivoEnvio)}
                >
                  {Object.entries(ROTULO_MOTIVO).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </Select>
              </div>
              {campos.motivo === 'outro' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="motivoOutro">Qual motivo</Label>
                  <Input
                    id="motivoOutro"
                    value={campos.motivoOutro}
                    onChange={(e) => campo('motivoOutro', e.target.value)}
                  />
                </div>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="saudacao">Saudação</Label>
              <Input
                id="saudacao"
                maxLength={80}
                value={campos.saudacaoCarta}
                onChange={(e) => campo('saudacaoCarta', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mensagem">Mensagem</Label>
              <Textarea
                id="mensagem"
                rows={10}
                value={campos.mensagemCarta}
                onChange={(e) => campo('mensagemCarta', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="observacoes">Observações internas</Label>
              <Textarea
                id="observacoes"
                rows={3}
                value={campos.observacoes}
                onChange={(e) => campo('observacoes', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Entrega</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="destinatario">Quem recebe</Label>
              <Input
                id="destinatario"
                value={campos.entregaDestinatario}
                onChange={(e) => campo('entregaDestinatario', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cep">CEP</Label>
              <div className="flex gap-2">
                <Input
                  id="cep"
                  inputMode="numeric"
                  value={campos.entregaCep}
                  onChange={(e) => campo('entregaCep', e.target.value)}
                  onBlur={buscarCep}
                />
                {buscandoCep ? (
                  <Loader2 className="text-muted-foreground mt-3 size-4 animate-spin" />
                ) : null}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="logradouro">Logradouro</Label>
              <Input
                id="logradouro"
                value={campos.entregaLogradouro}
                onChange={(e) => campo('entregaLogradouro', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-[6rem_1fr] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="numero">Número</Label>
                <Input
                  id="numero"
                  value={campos.entregaNumero}
                  onChange={(e) => campo('entregaNumero', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="complemento">Complemento</Label>
                <Input
                  id="complemento"
                  value={campos.entregaComplemento}
                  onChange={(e) => campo('entregaComplemento', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bairro">Bairro</Label>
              <Input
                id="bairro"
                value={campos.entregaBairro}
                onChange={(e) => campo('entregaBairro', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-[1fr_4.5rem] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={campos.entregaCidade}
                  onChange={(e) => campo('entregaCidade', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uf">UF</Label>
                <Input
                  id="uf"
                  maxLength={2}
                  value={campos.entregaUf}
                  onChange={(e) => campo('entregaUf', e.target.value.toUpperCase())}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-6">
            {erro ? (
              <p role="alert" className="text-destructive text-sm">
                {erro}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={salvando}>
              {salvando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Salvar correção
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/admin/solicitacoes/${inicial.solicitacaoId}`}>Cancelar</Link>
            </Button>
            <p className="text-muted-foreground text-xs">
              Cada campo que mudar fica no pedido, com o que era antes e quem corrigiu.
            </p>
          </CardContent>
        </Card>
      </div>
    </form>
  )
}
