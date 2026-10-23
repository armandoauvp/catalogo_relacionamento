'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialogo } from '@/components/ui/dialogo'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatarCep } from '@/lib/cep'
import { formatarCpf } from '@/lib/cpf'
import { salvarCliente } from '@/lib/actions/clientes'
import { cn } from '@/lib/utils'

/**
 * Cadastro e edição de cliente.
 *
 * Não existe excluir: o cliente aparece em solicitações antigas, que precisam
 * continuar legíveis. O CPF é a chave de deduplicação, a action recusa um CPF
 * que já pertence a outro cadastro em vez de criar o segundo.
 */

export type ClienteEditavel = {
  id: string
  nome: string
  cpf: string
  telefone: string | null
  email: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  etiquetas: string[]
}

const CAMPOS_DO_ENDERECO: {
  nome: 'cep' | 'logradouro' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'uf'
  rotulo: string
  classe?: string
}[] = [
  { nome: 'cep', rotulo: 'CEP' },
  { nome: 'uf', rotulo: 'UF' },
  { nome: 'logradouro', rotulo: 'Endereço', classe: 'sm:col-span-2' },
  { nome: 'numero', rotulo: 'Número' },
  { nome: 'complemento', rotulo: 'Complemento' },
  { nome: 'bairro', rotulo: 'Bairro' },
  { nome: 'cidade', rotulo: 'Cidade' },
]

export function EditorDeCliente({ cliente }: { cliente?: ClienteEditavel }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [salvando, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const editando = Boolean(cliente)

  /**
   * `onSubmit`, e não `action`: React limpa o formulário depois de rodar a
   * action, e uma recusa do servidor apagaria o que a pessoa digitou.
   */
  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const dados = new FormData(evento.currentTarget)
    setErro(null)
    iniciar(async () => {
      const r = await salvarCliente(dados)
      if (!r.ok) return setErro(r.erro)
      setAberto(false)
      router.refresh()
    })
  }

  return (
    <>
      {editando ? (
        <Button variant="ghost" size="sm" onClick={() => setAberto(true)}>
          <Pencil aria-hidden="true" />
          Editar
        </Button>
      ) : (
        <Button onClick={() => setAberto(true)}>
          <Plus aria-hidden="true" />
          Novo cliente
        </Button>
      )}

      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={editando ? 'Editar cliente' : 'Novo cliente'}
        descricao="O endereço daqui é o padrão: preenche a nova solicitação e os envios ao Tiny. Cada solicitação guarda a própria cópia, e mudar aqui não reescreve o histórico."
      >
        <form onSubmit={enviar} className="space-y-5">
          {cliente ? <input type="hidden" name="id" value={cliente.id} /> : null}

          <div className="space-y-1.5">
            <Label htmlFor="cliente-nome">Nome completo</Label>
            <Input id="cliente-nome" name="nome" required defaultValue={cliente?.nome} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cliente-cpf">CPF</Label>
              <Input
                id="cliente-cpf"
                name="cpf"
                required
                inputMode="numeric"
                placeholder="000.000.000-00"
                defaultValue={cliente ? formatarCpf(cliente.cpf) : ''}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cliente-telefone">Telefone</Label>
              <Input
                id="cliente-telefone"
                name="telefone"
                inputMode="numeric"
                placeholder="(11) 90000-0000"
                defaultValue={cliente?.telefone ?? ''}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cliente-email">E-mail</Label>
              <Input
                id="cliente-email"
                name="email"
                type="email"
                defaultValue={cliente?.email ?? ''}
              />
            </div>
          </div>

          <fieldset className="grid gap-4 border-t pt-4 sm:grid-cols-2">
            <legend className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
              Endereço padrão
            </legend>
            {CAMPOS_DO_ENDERECO.map((c) => (
              <div key={c.nome} className={cn('space-y-1.5', c.classe)}>
                <Label htmlFor={`cliente-${c.nome}`}>{c.rotulo}</Label>
                <Input
                  id={`cliente-${c.nome}`}
                  name={c.nome}
                  defaultValue={
                    c.nome === 'cep' && cliente?.cep
                      ? formatarCep(cliente.cep)
                      : (cliente?.[c.nome] ?? '')
                  }
                  inputMode={c.nome === 'cep' ? 'numeric' : undefined}
                  maxLength={c.nome === 'uf' ? 2 : 120}
                />
              </div>
            ))}
          </fieldset>

          <div className="space-y-1.5 border-t pt-4">
            <Label htmlFor="cliente-etiquetas">Etiquetas</Label>
            <Input
              id="cliente-etiquetas"
              name="etiquetas"
              placeholder="Evento SP 2026, Turma 3"
              defaultValue={cliente?.etiquetas.join(', ') ?? ''}
            />
            <p className="text-muted-foreground text-xs">Separadas por vírgula.</p>
          </div>

          {erro ? (
            <p role="alert" className="text-destructive text-sm">
              {erro}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Dialogo>
    </>
  )
}
