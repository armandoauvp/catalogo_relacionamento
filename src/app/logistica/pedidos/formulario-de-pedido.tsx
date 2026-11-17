'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialogo } from '@/components/ui/dialogo'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { pedirALogistica } from '@/lib/actions/logistica'
import { DEPARTAMENTOS, SUBSIDIARIAS } from '@/lib/logistica/cadastros'
import { formatarISO } from '@/lib/datas'

const CLASSE_DO_SELECT =
  'border-input bg-background text-foreground focus-visible:ring-ring focus-visible:ring-offset-background flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'

function Campo({
  rotulo,
  dica,
  children,
}: {
  rotulo: string
  dica?: string
  children: React.ReactNode
}) {
  return (
    <label className="grid content-start gap-1.5 text-sm font-medium">
      {rotulo}
      {children}
      {dica ? <span className="text-muted-foreground text-xs font-normal">{dica}</span> : null}
    </label>
  )
}

function Lista({ name, lista, vazio }: { name: string; lista: readonly string[]; vazio: string }) {
  return (
    <select name={name} defaultValue="" required className={CLASSE_DO_SELECT}>
      <option value="" disabled>
        {vazio}
      </option>
      {lista.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </select>
  )
}

/**
 * Pedido de trabalho à Logística. Só o que quem pede sabe: o resto
 * (prioridade, complexidade, responsável) a Logística define ao triar.
 */
export function FormularioDePedido() {
  const router = useRouter()
  const formulario = useRef<HTMLFormElement>(null)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, iniciar] = useTransition()

  function enviar(dados: FormData) {
    setErro(null)
    iniciar(async () => {
      const r = await pedirALogistica(dados)
      if (!r.ok) {
        setErro(r.erro)
        // Leva o cursor ao campo que falhou, em vez de só dizer que algo falhou.
        if (r.campo) {
          const campo = formulario.current?.elements.namedItem(r.campo)
          if (campo instanceof HTMLElement) campo.focus()
        }
        return
      }
      setAberto(false)
      formulario.current?.reset()
      router.refresh()
    })
  }

  return (
    <>
      <Button onClick={() => setAberto(true)} data-tour="pedir-logistica">
        <Plus aria-hidden="true" />
        Pedir à Logística
      </Button>

      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Pedir à Logística"
        descricao="Entra na fila da Logística, que define prioridade e responsável. Você acompanha a fase aqui."
        className="w-[min(40rem,calc(100vw-2rem))]"
      >
        <form ref={formulario} action={enviar} className="space-y-4">
          <Campo rotulo="O que você precisa">
            <Input
              name="titulo"
              required
              maxLength={160}
              placeholder="Ex.: Kit de boas-vindas para 20 novos alunos"
            />
          </Campo>

          <Campo rotulo="Itens (opcional)" dica="Um por linha, com a quantidade se souber.">
            <Textarea name="itens" rows={3} placeholder={'Ex.: 20 canecas\n20 camisetas'} />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Empresa">
              <Lista name="subsidiaria" lista={SUBSIDIARIAS} vazio="Escolha a empresa" />
            </Campo>
            <Campo rotulo="Departamento">
              <Lista name="departamento" lista={DEPARTAMENTOS} vazio="Escolha o departamento" />
            </Campo>
          </div>

          <Campo rotulo="Para quando" dica="A Logística confirma ou ajusta o prazo ao triar.">
            <Input type="date" name="paraQuando" required min={formatarISO(new Date())} />
          </Campo>

          <Campo
            rotulo="Detalhes (opcional)"
            dica="Endereço, quem recebe, contexto. Só a Logística lê."
          >
            <Textarea name="observacoes" rows={3} maxLength={2000} />
          </Campo>

          {erro ? (
            <p role="alert" className="text-destructive text-sm">
              {erro}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Enviar pedido
            </Button>
          </div>
        </form>
      </Dialogo>
    </>
  )
}
