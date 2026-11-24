'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { StatusSolicitacao } from '@prisma/client'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  ROTULO_STATUS,
  desfazAoChegar,
  ehVolta,
  exigeMotivoNaMudanca,
  motivosProntos,
  type ProximoPasso,
} from '@/lib/status'
import { cn } from '@/lib/utils'

const OUTRO = 'Outro'
import { alterarStatus, encaminharEmLote, marcarComoTeste } from '@/lib/actions/solicitacoes'

/**
 * Mudança de status.
 *
 * As opções vêm prontas do servidor (`transicoesPermitidas`) e a action valida
 * de novo com a mesma função: o que a tela oferece e o que o servidor aceita
 * não podem divergir.
 *
 * `proximo` é o passo natural, em um botão, para ninguém precisar decifrar a
 * lista de status: aprovar, marcar como comprado, liberar para envio. A lista
 * continua abaixo para o que foge do caminho, como cancelar.
 */
export function AlterarStatus({
  solicitacaoId,
  atual,
  opcoes,
  proximo,
}: {
  solicitacaoId: string
  atual: StatusSolicitacao
  opcoes: StatusSolicitacao[]
  proximo: ProximoPasso | null
}) {
  const router = useRouter()
  const [salvando, iniciar] = useTransition()

  const sugerido = proximo?.destino
  const padrao = sugerido && opcoes.includes(sugerido) ? sugerido : opcoes[0]

  // A escolha é guardada como "o que a pessoa clicou", não como o status em si.
  // Depois de gravar, a tela recarrega com outras opções, e uma escolha antiga
  // deixaria o `<select>` mostrando a primeira opção enquanto o React ainda
  // acharia que vale a anterior, o botão gravaria coisa diferente do que a
  // tela mostra. Descartar o que saiu da lista resolve na origem.
  const [escolhido, setEscolhido] = useState<StatusSolicitacao | null>(null)
  const status = escolhido && opcoes.includes(escolhido) ? escolhido : padrao

  const [motivo, setMotivo] = useState('')
  // "Outro" abre o texto livre; os motivos prontos preenchem o motivo direto.
  const [outro, setOutro] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (!status) return null

  // Aprovar vai pelo mesmo caminho da gestão em lote: a aprovação vira uma linha
  // do histórico e o pedido segue para onde os itens mandam, num clique só.
  function avancar(passo: ProximoPasso) {
    setErro(null)
    iniciar(async () => {
      if (passo.aprovacao) {
        const r = await encaminharEmLote([solicitacaoId], 'automatico')
        if (!r.ok) return setErro(r.erro)
        const ignorada = r.dados.ignoradas[0]
        if (ignorada) return setErro(ignorada.motivo)
      } else {
        // A nota escrita embaixo vale também para o botão do passo seguinte.
        const r = await alterarStatus({
          solicitacaoId,
          statusNovo: passo.destino,
          motivo: motivo.trim() || undefined,
        })
        if (!r.ok) return setErro(r.erro)
      }
      setMotivo('')
      setEscolhido(null)
      router.refresh()
    })
  }

  const volta = ehVolta(atual, status)
  const precisaDeMotivo = exigeMotivoNaMudanca(atual, status)
  const prontos = motivosProntos(status)
  const rotulo = (s: StatusSolicitacao) =>
    ehVolta(atual, s) ? `↩ Voltar para ${ROTULO_STATUS[s]}` : ROTULO_STATUS[s]
  const desfaz = desfazAoChegar(status)
  // O que a volta desfaz, dito antes do clique: quem volta precisa saber.
  const efeitos = volta
    ? [
        desfaz.compra && 'os itens comprados voltam para a fila do Financeiro',
        desfaz.tiny && 'o pedido no Tiny é cancelado, se ainda não foi enviado',
        status === StatusSolicitacao.pendente || status === StatusSolicitacao.aguardando_aprovacao
          ? 'a demanda sai da trilha da Logística até a nova aprovação'
          : null,
      ].filter(Boolean)
    : []

  function enviar() {
    setErro(null)
    iniciar(async () => {
      const resposta = await alterarStatus({
        solicitacaoId,
        statusNovo: status,
        motivo: motivo.trim() || undefined,
      })
      if (!resposta.ok) {
        setErro(resposta.erro)
        return
      }
      setMotivo('')
      setOutro(false)
      setEscolhido(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {proximo ? (
        <div className="space-y-2 border-b pb-4" data-tour="proximo-passo">
          <Button
            onClick={() => avancar(proximo)}
            disabled={salvando}
            className="h-auto w-full py-2.5 leading-snug whitespace-normal"
          >
            {salvando ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {proximo.rotulo}
          </Button>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {proximo.explicacao} Ou escolha outro status abaixo.
          </p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="status-novo">Novo status</Label>
        <Select
          id="status-novo"
          value={status}
          onChange={(e) => {
            setEscolhido(e.target.value as StatusSolicitacao)
            setErro(null)
          }}
        >
          {opcoes.map((opcao) => (
            <option key={opcao} value={opcao}>
              {rotulo(opcao)}
              {opcao === sugerido ? ' (sugerido)' : ''}
            </option>
          ))}
        </Select>
        {volta ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {efeitos.length
              ? `Ao voltar, ${efeitos.join('; ')}.`
              : 'A solicitação volta a esta etapa.'}{' '}
            O motivo fica no histórico.
          </p>
        ) : null}
      </div>

      {precisaDeMotivo ? (
        <div className="space-y-2">
          <Label htmlFor="motivo-status">Motivo</Label>
          {prontos.length > 0 ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Motivos prontos">
              {[...prontos, OUTRO].map((m) => {
                const ligado = m === OUTRO ? outro : !outro && motivo === m
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={ligado}
                    onClick={() => {
                      setOutro(m === OUTRO)
                      setMotivo(m === OUTRO ? '' : m)
                    }}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      ligado
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input hover:bg-accent',
                    )}
                  >
                    {m}
                  </button>
                )
              })}
            </div>
          ) : null}
          {prontos.length === 0 || outro ? (
            <Textarea
              id="motivo-status"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={
                volta
                  ? 'Por que voltar? Fica no histórico, junto com quem voltou e quando.'
                  : 'Fica gravado no histórico, junto com quem mudou e quando.'
              }
            />
          ) : null}
        </div>
      ) : (
        // Nota livre em qualquer mudança: quem corrigiu o pedido avisa quem vem
        // depois (a Lilian devolvendo à Dani) sem sair da ferramenta.
        <div className="space-y-1.5">
          <Label htmlFor="nota-status">
            Nota <span className="text-muted-foreground font-normal">(opcional)</span>
          </Label>
          <Textarea
            id="nota-status"
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="O que você corrigiu ou o que falta. Fica no histórico e aparece na fila de compras."
          />
        </div>
      )}

      {erro ? (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      ) : null}

      <Button
        onClick={enviar}
        variant={proximo ? 'outline' : 'default'}
        disabled={salvando || (precisaDeMotivo && !motivo.trim())}
        // Alguns rótulos são longos ("Entregue / rastreio finalizado") e o
        // botão do DS não quebra linha: sem isto o texto vaza do cartão.
        className="h-auto w-full py-2.5 leading-snug whitespace-normal"
      >
        {salvando ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {salvando
          ? 'Gravando…'
          : volta
            ? `Voltar para ${ROTULO_STATUS[status]}`
            : `Mudar para ${ROTULO_STATUS[status]}`}
      </Button>
    </div>
  )
}

/**
 * Marca a solicitação como teste: fora do saldo do mês e da trilha da
 * Logística, com o selo nas telas e "TESTE" na observação do pedido no Tiny.
 */
export function MarcarComoTeste({
  solicitacaoId,
  teste,
}: {
  solicitacaoId: string
  teste: boolean
}) {
  const router = useRouter()
  const [salvando, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  return (
    <div className="mt-4 space-y-1 border-t pt-4">
      <Button
        variant="ghost"
        size="sm"
        disabled={salvando}
        onClick={() =>
          iniciar(async () => {
            setErro(null)
            const r = await marcarComoTeste(solicitacaoId, !teste)
            if (!r.ok) return setErro(r.erro)
            router.refresh()
          })
        }
      >
        {salvando ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {teste ? 'Desmarcar como teste' : 'Marcar como teste'}
      </Button>
      <p className="text-muted-foreground text-xs">
        {teste
          ? 'Esta solicitação é teste: não conta no limite do mês nem na trilha da Logística.'
          : 'Teste não conta no limite do mês nem na trilha da Logística.'}
      </p>
      {erro ? (
        <p role="alert" className="text-destructive text-xs">
          {erro}
        </p>
      ) : null}
    </div>
  )
}
