import type { EnvioTiny } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { rotuloDaSituacao, seloDoPedido, tomDoPedido } from '@/lib/tiny/rotulos'

/** O selo do pedido no Tiny, igual na tela do Tiny, no lote e na expedição. */
export function SeloDoPedido({
  pedido,
}: {
  pedido: {
    envio: EnvioTiny
    situacao: string | null
    situacaoPendente: string | null
    tinyNumero: string | null
  }
}) {
  const selo = seloDoPedido(pedido)
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <Badge variant={selo.tom}>{selo.texto}</Badge>
      {selo.aCaminho ? (
        <span className="text-muted-foreground text-xs">a caminho do Tiny</span>
      ) : null}
      {pedido.tinyNumero ? (
        <span className="text-muted-foreground text-xs tabular-nums">nº {pedido.tinyNumero}</span>
      ) : null}
    </span>
  )
}

/** Situação de um pedido lido direto do Tiny, que pode não ter nascido aqui. */
export function SeloDaSituacao({ situacao }: { situacao: string }) {
  return (
    <Badge variant={tomDoPedido('enviado', situacao)}>
      {rotuloDaSituacao(situacao) ?? 'Sem situação'}
    </Badge>
  )
}
