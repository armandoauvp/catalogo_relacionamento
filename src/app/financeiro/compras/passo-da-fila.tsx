'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialogo } from '@/components/ui/dialogo'
import { Textarea } from '@/components/ui/textarea'
import { alterarStatus } from '@/lib/actions/solicitacoes'
import type { ProximoPasso } from '@/lib/status'

/**
 * O passo do Financeiro na própria fila: marcar como comprado e liberar para
 * envio, sem abrir a solicitação.
 *
 * Pede confirmação porque nenhum dos dois tem volta na lista de status, e
 * liberar para envio ainda gera o pedido no Tiny. A fila é por item, e o status
 * é da solicitação: a confirmação diz quantos itens andam juntos.
 */
export function PassoDaFila({
  solicitacaoId,
  codigo,
  itensDoPedido,
  passo,
}: {
  solicitacaoId: string
  codigo: string
  itensDoPedido: number
  passo: ProximoPasso | null
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()

  if (!passo) return null

  function confirmar(destino: ProximoPasso['destino']) {
    setErro(null)
    iniciar(async () => {
      const r = await alterarStatus({ solicitacaoId, statusNovo: destino })
      if (!r.ok) return setErro(r.erro)
      setAberto(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        data-tour="passo-fila"
        // Em duas linhas: numa só, a coluna empurra a tabela para fora da tela.
        className="h-auto w-28 py-1.5 leading-snug whitespace-normal"
        onClick={() => setAberto(true)}
      >
        {passo.rotulo}
      </Button>
      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={`${passo.rotulo}?`}
        descricao={codigo}
      >
        <div className="text-left whitespace-normal">
          <p className="text-sm leading-relaxed">{passo.explicacao}</p>
          {itensDoPedido > 1 ? (
            <p className="text-muted-foreground mt-2 text-sm">
              Vale para os {itensDoPedido} itens desta solicitação.
            </p>
          ) : null}
          {erro ? (
            <p role="alert" className="text-destructive mt-3 text-sm">
              {erro}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAberto(false)}>
              Voltar
            </Button>
            <Button disabled={salvando} onClick={() => confirmar(passo.destino)}>
              {salvando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {passo.rotulo}
            </Button>
          </div>
        </div>
      </Dialogo>
    </>
  )
}

/**
 * Cancelar direto da fila (pedido da área de 06/11), em vez de abrir a
 * solicitação. Não apaga: o pedido sai da fila e fica no histórico como
 * cancelado, com o motivo, e o saldo do mês continua contando, porque a área
 * reenvia. O pedido de teste tem caminho melhor, e a confirmação aponta para ele.
 */
export function CancelarNaFila({
  solicitacaoId,
  codigo,
  itensDoPedido,
}: {
  solicitacaoId: string
  codigo: string
  itensDoPedido: number
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()

  function cancelar() {
    setErro(null)
    iniciar(async () => {
      const r = await alterarStatus({ solicitacaoId, statusNovo: 'cancelado', motivo })
      if (!r.ok) return setErro(r.erro)
      setAberto(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground w-28"
        onClick={() => {
          setErro(null)
          setAberto(true)
        }}
      >
        Cancelar
      </Button>
      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Cancelar o pedido?"
        descricao={codigo}
      >
        <div className="space-y-3 text-left whitespace-normal">
          <p className="text-sm leading-relaxed">
            O pedido sai da fila e fica no histórico como cancelado, com o motivo. Ele não é apagado
            e continua contando no saldo do mês do consultor.
          </p>
          {itensDoPedido > 1 ? (
            <p className="text-sm font-medium">
              Vale para os {itensDoPedido} itens desta solicitação.
            </p>
          ) : null}
          <p className="text-muted-foreground text-sm">
            É um pedido de teste?{' '}
            <Link
              href={`/admin/solicitacoes/${solicitacaoId}`}
              className="text-foreground underline underline-offset-4"
            >
              Marque como teste na solicitação
            </Link>
            : ele sai do saldo e da trilha da Logística.
          </p>
          <label className="grid gap-1.5 text-sm font-medium">
            Motivo do cancelamento
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Ex.: cliente pediu para não enviar"
            />
          </label>
          {erro ? (
            <p role="alert" className="text-destructive text-sm">
              {erro}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setAberto(false)}>
              Voltar
            </Button>
            <Button variant="destructive" disabled={salvando || !motivo.trim()} onClick={cancelar}>
              {salvando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Cancelar pedido
            </Button>
          </div>
        </div>
      </Dialogo>
    </>
  )
}
