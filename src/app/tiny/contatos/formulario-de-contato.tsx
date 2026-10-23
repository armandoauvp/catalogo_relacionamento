'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { salvarContato } from '@/lib/actions/contatos-tiny'
import { validarContato } from '@/lib/tiny/contato'
import { ROTULO_DA_COLUNA, UFS, type CampoDoLote } from '@/lib/tiny/lote'
import { cn } from '@/lib/utils'

export type CamposDoContato = Record<Exclude<CampoDoLote, 'quantidade' | 'valor'>, string>

export const CONTATO_VAZIO: CamposDoContato = {
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

const ORDEM: { campo: keyof CamposDoContato; largo?: boolean }[] = [
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

/**
 * Cadastro e edição de um contato do Tiny. Grava pela fila: a tela confirma
 * que entrou, e o andamento aparece na lista de contatos.
 */
export function FormularioDeContato({
  tinyId,
  inicial,
}: {
  tinyId: string | null
  inicial: CamposDoContato
}) {
  const [campos, setCampos] = useState(inicial)
  const [enviando, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const erros = validarContato(campos).erros

  async function procurarCep() {
    const cep = campos.cep.replace(/\D/g, '')
    if (cep.length !== 8) return
    setBuscandoCep(true)
    try {
      const resposta = await fetch(`/api/cep/${cep}`)
      if (!resposta.ok) return
      const dados = await resposta.json()
      setCampos((c) => ({
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

  function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (erros.length) return setErro(erros.join(' '))
    iniciar(async () => {
      const r = await salvarContato({ tinyId, campos })
      if (!r.ok) return setErro(r.erro)
      setPronto(true)
    })
  }

  if (pronto) {
    return (
      <div className="bg-card space-y-4 rounded-lg border p-6">
        <p className="font-display text-lg font-semibold">
          {tinyId ? 'A alteração' : 'O cadastro'} de {campos.nome} entrou na fila.
        </p>
        <p className="text-muted-foreground text-sm">
          Vai ao Tiny em seguida. O andamento aparece em &quot;Gravações no Tiny&quot;, na lista de
          contatos.
        </p>
        <Button asChild>
          <Link href="/tiny/contatos">Voltar aos contatos</Link>
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={salvar} className="bg-card space-y-5 rounded-lg border p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ORDEM.map(({ campo, largo }) => (
          <label
            key={campo}
            className={cn(
              'grid content-start gap-1.5 text-sm font-medium',
              largo && 'sm:col-span-2',
            )}
          >
            {ROTULO_DA_COLUNA[campo]}
            {campo === 'uf' ? (
              <Select
                value={campos.uf}
                onChange={(e) => setCampos((c) => ({ ...c, uf: e.target.value }))}
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
                value={campos[campo]}
                onChange={(e) => {
                  setErro(null)
                  setCampos((c) => ({ ...c, [campo]: e.target.value }))
                }}
                onBlur={campo === 'cep' ? procurarCep : undefined}
                // O documento identifica o contato no Tiny: na edição, não muda.
                readOnly={campo === 'cpfCnpj' && Boolean(tinyId)}
                inputMode={campo === 'cep' || campo === 'cpfCnpj' ? 'numeric' : undefined}
              />
            )}
            {campo === 'cep' && buscandoCep ? (
              <span className="text-muted-foreground text-xs font-normal">
                Buscando o endereço…
              </span>
            ) : null}
          </label>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Nome e CPF/CNPJ são obrigatórios. Campo vazio não apaga o que já está no Tiny.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={enviando}>
          {enviando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {tinyId ? 'Salvar no Tiny' : 'Cadastrar no Tiny'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/tiny/contatos">Cancelar</Link>
        </Button>
        {erro ? (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        ) : null}
      </div>
    </form>
  )
}
