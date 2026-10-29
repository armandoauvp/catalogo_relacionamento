'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { MotivoEnvio } from '@prisma/client'
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialogo } from '@/components/ui/dialogo'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LIMITE_DA_MENSAGEM, aplicarModelo, problemaDoModelo } from '@/lib/carta'
import { alternarModelo, moverModelo, salvarModelo } from '@/lib/actions/cartas'
import { cn } from '@/lib/utils'

/** O nome que a prévia usa: mostra como o `{nome}` fica na folha. */
const NOME_DE_EXEMPLO = 'Marina Alves'

/** Criar (sem `modelo`) ou editar um modelo do motivo. */
export function EditorDeModelo({
  motivo,
  rotuloDoMotivo,
  modelo,
}: {
  motivo: MotivoEnvio
  rotuloDoMotivo: string
  modelo?: { id: string; texto: string }
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState(modelo?.texto ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()

  function abrir() {
    setTexto(modelo?.texto ?? '')
    setErro(null)
    setAberto(true)
  }

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErro(null)
    iniciar(async () => {
      const r = await salvarModelo({ id: modelo?.id, motivo, texto })
      if (!r.ok) return setErro(r.erro)
      setAberto(false)
      router.refresh()
    })
  }

  // O aviso aparece enquanto se digita, mas só depois de haver texto: um
  // diálogo novo abrindo com "Escreva o texto" em vermelho seria bronca à toa.
  const problema = texto.trim() ? problemaDoModelo(texto) : null
  const restam = LIMITE_DA_MENSAGEM - texto.trim().length

  return (
    <>
      {modelo ? (
        <Button variant="ghost" size="sm" onClick={abrir}>
          <Pencil aria-hidden="true" />
          Editar
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={abrir}>
          <Plus aria-hidden="true" />
          Acrescentar modelo
        </Button>
      )}

      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={modelo ? 'Editar modelo' : 'Novo modelo'}
        descricao={rotuloDoMotivo}
      >
        <form onSubmit={enviar} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="modelo-texto">Texto</Label>
            <Textarea
              id="modelo-texto"
              rows={5}
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value)
                // A recusa do servidor era sobre o texto de antes.
                setErro(null)
              }}
              aria-invalid={Boolean(problema)}
            />
            <div className="flex items-start justify-between gap-3 text-xs">
              <p className="text-muted-foreground">
                Use <code className="font-mono">{'{nome}'}</code> onde entra o primeiro nome do
                cliente.
              </p>
              <span
                className={cn(
                  'shrink-0 tabular-nums',
                  restam < 0 ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {texto.trim().length} de {LIMITE_DA_MENSAGEM}
              </span>
            </div>
          </div>

          {texto.trim() ? (
            <div className="bg-muted/50 rounded-md border px-3 py-2.5">
              <p className="font-ui text-muted-foreground mb-1 text-[11px] font-semibold tracking-[0.14em] uppercase">
                Como o consultor vê
              </p>
              <p className="text-sm leading-relaxed">{aplicarModelo(texto, NOME_DE_EXEMPLO)}</p>
            </div>
          ) : null}

          {erro || problema ? (
            <p role="alert" className="text-destructive text-sm">
              {erro ?? problema}
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

/** Subir, descer e desativar: mudam a lista que o consultor vê, sem confirmação. */
export function AcoesDoModelo({
  id,
  ativo,
  primeiro,
  ultimo,
}: {
  id: string
  ativo: boolean
  primeiro: boolean
  ultimo: boolean
}) {
  const router = useRouter()
  const [enviando, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function executar(acao: () => ReturnType<typeof alternarModelo>) {
    setErro(null)
    iniciar(async () => {
      const r = await acao()
      if (!r.ok) setErro(r.erro)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {erro ? (
        <span role="alert" className="text-destructive text-xs">
          {erro}
        </span>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        aria-label="Subir"
        disabled={primeiro || enviando}
        onClick={() => executar(() => moverModelo(id, 'subir'))}
      >
        <ArrowUp aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Descer"
        disabled={ultimo || enviando}
        onClick={() => executar(() => moverModelo(id, 'descer'))}
      >
        <ArrowDown aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={enviando}
        onClick={() => executar(() => alternarModelo(id, !ativo))}
      >
        {ativo ? 'Desativar' : 'Reativar'}
      </Button>
    </div>
  )
}
