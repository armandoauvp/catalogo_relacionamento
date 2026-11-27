'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, PackageCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialogo } from '@/components/ui/dialogo'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { confirmarChegada } from '@/lib/actions/solicitacoes'
import type { ItemNaChegada } from '@/lib/expedicao'

/**
 * "Chegou": a Logística confirma que o item comprado está com ela, conferido
 * e cadastrado no Tiny.
 *
 * É a entrada no estoque, como a Lobby fazia: o item de fora do catálogo só
 * passa a existir para a Logística depois de cadastrado lá, e o SKU é pedido
 * aqui. Pede confirmação porque é aqui que o pedido vai para o Tiny, e daí não
 * volta pela lista de status.
 */
export function Chegou({
  solicitacaoId,
  codigo,
  itens,
}: {
  solicitacaoId: string
  codigo: string
  itens: ItemNaChegada[]
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()
  const externos = itens.filter((i) => i.externo)
  const [skus, setSkus] = useState<Record<string, string>>(() =>
    Object.fromEntries(externos.map((i) => [i.id, i.sku ?? ''])),
  )

  function confirmar() {
    setErro(null)
    iniciar(async () => {
      const r = await confirmarChegada(solicitacaoId, skus)
      if (!r.ok) return setErro(r.erro)
      setAberto(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setAberto(true)}>
        <PackageCheck aria-hidden="true" />
        Chegou
      </Button>
      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="O item chegou?"
        descricao={codigo}
      >
        <div className="text-left whitespace-normal">
          <p className="text-sm leading-relaxed">
            O pedido vai para &quot;Pronto para processar&quot;, aqui na Expedição, e vira pedido no
            Tiny. Confirme só com o item na mão, conferido.
          </p>

          {externos.length ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm leading-relaxed">
                {externos.length === 1 ? 'Este item é' : 'Estes itens são'} de fora do catálogo.
                Cadastre no Tiny (Cadastros → Produtos) e informe o SKU de lá:
              </p>
              {externos.map((item) => (
                <div key={item.id} className="space-y-1.5">
                  <Label htmlFor={`sku-${item.id}`}>
                    {item.quantidade}× {item.produto}
                  </Label>
                  <Input
                    id={`sku-${item.id}`}
                    value={skus[item.id] ?? ''}
                    onChange={(e) => setSkus((atual) => ({ ...atual, [item.id]: e.target.value }))}
                    placeholder="SKU no Tiny"
                    autoComplete="off"
                  />
                </div>
              ))}
            </div>
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
            <Button disabled={salvando} onClick={confirmar}>
              {salvando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {salvando ? 'Conferindo no Tiny…' : 'Confirmar chegada'}
            </Button>
          </div>
        </div>
      </Dialogo>
    </>
  )
}
