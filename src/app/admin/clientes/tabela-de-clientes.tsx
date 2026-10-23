'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { Loader2, Send, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { exportarClientesParaOTiny } from '@/lib/actions/contatos-tiny'
import { formatarCpf, formatarTelefone, mascararCpf } from '@/lib/cpf'
import { formatarBRL } from '@/lib/money'
import { EditorDeCliente, type ClienteEditavel } from './editor-de-cliente'

export type ClienteNaTabela = ClienteEditavel & {
  origem: string
  criadoEm: string
  solicitacoes: number
  total: string
}

/** Lote no Tiny com quem foi escolhido: o endereço vai para a prévia, onde se corrige. */
const LIMITE_DO_LOTE = 300

/**
 * A tabela de clientes com seleção. Quem opera o Tiny manda os escolhidos
 * como contatos, ou abre a importação de lote já com eles nas linhas.
 */
export function TabelaDeClientes({
  clientes,
  operaTiny,
  veDadosCompletos,
}: {
  clientes: ClienteNaTabela[]
  operaTiny: boolean
  veDadosCompletos: boolean
}) {
  const router = useRouter()
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set())
  const [enviando, iniciar] = useTransition()
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null)

  const todos = clientes.length > 0 && escolhidos.size === clientes.length
  const alternar = (id: string) =>
    setEscolhidos((s) => {
      const novo = new Set(s)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })

  function mandarComoContatos() {
    setAviso(null)
    iniciar(async () => {
      const r = await exportarClientesParaOTiny([...escolhidos])
      if (!r.ok) return setAviso({ texto: r.erro, erro: true })
      const { enviados, ignorados } = r.dados
      setAviso({
        texto:
          `${enviados} ${enviados === 1 ? 'cliente foi' : 'clientes foram'} para a fila de contatos do Tiny.` +
          (ignorados.length
            ? ` Ficaram de fora: ${ignorados.map((i) => `${i.nome} (${i.motivo})`).join('; ')}`
            : ''),
        erro: ignorados.length > 0,
      })
      setEscolhidos(new Set())
    })
  }

  function abrirLote() {
    const ids = [...escolhidos].slice(0, LIMITE_DO_LOTE)
    router.push(`/tiny/importar?clientes=${ids.join(',')}` as Route)
  }

  return (
    <>
      {operaTiny ? (
        <div
          className="bg-card mb-3 flex min-h-12 flex-wrap items-center gap-3 rounded-lg border px-4 py-2 text-sm"
          aria-live="polite"
        >
          <span className="text-muted-foreground">
            {escolhidos.size
              ? `${escolhidos.size} ${escolhidos.size === 1 ? 'escolhido' : 'escolhidos'}`
              : 'Escolha clientes na tabela para mandar ao Tiny.'}
          </span>
          {escolhidos.size ? (
            <span className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={mandarComoContatos} disabled={enviando}>
                {enviando ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <UserPlus aria-hidden="true" />
                )}
                Cadastrar no Tiny
              </Button>
              <Button
                size="sm"
                onClick={abrirLote}
                disabled={escolhidos.size > LIMITE_DO_LOTE}
                title={
                  escolhidos.size > LIMITE_DO_LOTE
                    ? `Um lote a partir da base vai até ${LIMITE_DO_LOTE} clientes.`
                    : undefined
                }
              >
                <Send aria-hidden="true" />
                Gerar lote de pedidos
              </Button>
            </span>
          ) : null}
          {aviso ? (
            <p
              role={aviso.erro ? 'alert' : 'status'}
              className={aviso.erro ? 'text-destructive w-full' : 'text-success w-full'}
            >
              {aviso.texto}
            </p>
          ) : null}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {operaTiny ? (
                <TableHead className="w-0">
                  <input
                    type="checkbox"
                    aria-label="Escolher todos"
                    checked={todos}
                    onChange={() =>
                      setEscolhidos(todos ? new Set() : new Set(clientes.map((c) => c.id)))
                    }
                    className="accent-primary size-4"
                  />
                </TableHead>
              ) : null}
              <TableHead>Nome</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead className="text-right">Solicitações</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.map((c) => (
              <TableRow key={c.id} data-state={escolhidos.has(c.id) ? 'selected' : undefined}>
                {operaTiny ? (
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Escolher ${c.nome}`}
                      checked={escolhidos.has(c.id)}
                      onChange={() => alternar(c.id)}
                      className="accent-primary size-4"
                    />
                  </TableCell>
                ) : null}
                <TableCell>
                  <Link
                    href={`/admin/clientes/${c.id}` as Route}
                    className="hover:text-primary-emphasis font-medium underline-offset-4 hover:underline"
                  >
                    {c.nome}
                  </Link>
                  {c.etiquetas.length ? (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {c.etiquetas.slice(0, 4).map((e) => (
                        <Badge key={e} variant="muted">
                          {e}
                        </Badge>
                      ))}
                      {c.etiquetas.length > 4 ? (
                        <span className="text-muted-foreground text-xs">
                          +{c.etiquetas.length - 4}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {veDadosCompletos ? formatarCpf(c.cpf) : mascararCpf(c.cpf)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {c.telefone ? (
                    <span className="block tabular-nums">{formatarTelefone(c.telefone)}</span>
                  ) : null}
                  {c.email ?? (c.telefone ? null : '-')}
                </TableCell>
                <TableCell className="text-sm">
                  {c.cidade ? (
                    `${c.cidade}/${c.uf ?? ''}`
                  ) : (
                    <span className="text-muted-foreground">sem endereço</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {c.solicitacoes}
                  {c.solicitacoes ? (
                    <span className="text-muted-foreground block text-xs">
                      {formatarBRL(c.total)}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right">
                  <EditorDeCliente cliente={c} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
