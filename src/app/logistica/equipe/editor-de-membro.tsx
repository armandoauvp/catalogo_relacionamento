'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialogo } from '@/components/ui/dialogo'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { alternarMembro, salvarMembro } from '@/lib/actions/logistica'
import { prepararFoto } from '@/lib/arquivos-no-navegador'

export type MembroEditavel = {
  id: string
  nome: string
  funcao: string
  descricao: string | null
  email: string | null
  fotoUrl: string | null
  ordem: number
  ativo: boolean
}

/**
 * Cadastro de membro da equipe. Sem exclusão: quem sai do time é desativado
 * e some da página, mas continua no histórico.
 */
export function EditorDeMembro({ membro }: { membro?: MembroEditavel }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()

  function enviar(dados: FormData) {
    setErro(null)
    iniciar(async () => {
      await prepararFoto(dados)
      const r = await salvarMembro(dados)
      if (!r.ok) return setErro(r.erro)
      setAberto(false)
      router.refresh()
    })
  }

  function alternar() {
    if (!membro) return
    setErro(null)
    iniciar(async () => {
      const r = await alternarMembro(membro.id, !membro.ativo)
      if (!r.ok) return setErro(r.erro)
      setAberto(false)
      router.refresh()
    })
  }

  return (
    <>
      {membro ? (
        <Button variant="ghost" size="sm" onClick={() => setAberto(true)}>
          <Pencil aria-hidden="true" />
          Editar
        </Button>
      ) : (
        <Button onClick={() => setAberto(true)}>
          <UserPlus aria-hidden="true" />
          Adicionar pessoa
        </Button>
      )}

      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={membro ? `Editar ${membro.nome}` : 'Nova pessoa na equipe'}
        descricao="Aparece para todos que abrem o Dashboard Logístico."
      >
        <form action={enviar} className="space-y-4">
          {membro ? <input type="hidden" name="id" value={membro.id} /> : null}
          <input type="hidden" name="fotoUrl" value={membro?.fotoUrl ?? ''} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="membro-nome">Nome</Label>
              <Input id="membro-nome" name="nome" defaultValue={membro?.nome} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="membro-funcao">Função</Label>
              <Input
                id="membro-funcao"
                name="funcao"
                defaultValue={membro?.funcao}
                placeholder="Ex.: Expedição"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="membro-descricao">O que faz (opcional)</Label>
            <Textarea
              id="membro-descricao"
              name="descricao"
              defaultValue={membro?.descricao ?? ''}
              rows={3}
              maxLength={400}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
            <div className="space-y-1.5">
              <Label htmlFor="membro-email">E-mail (opcional)</Label>
              <Input
                id="membro-email"
                name="email"
                type="email"
                defaultValue={membro?.email ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="membro-ordem">Ordem</Label>
              <Input
                id="membro-ordem"
                name="ordem"
                type="number"
                min={0}
                defaultValue={membro?.ordem ?? 0}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="membro-foto">Foto (opcional)</Label>
            <Input
              id="membro-foto"
              name="foto"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
            />
            <p className="text-muted-foreground text-xs">
              {membro?.fotoUrl ? 'Envie outra para trocar a atual. ' : ''}Foto grande é reduzida
              antes de enviar.
            </p>
          </div>

          {erro ? (
            <p role="alert" className="text-destructive text-sm">
              {erro}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-between gap-2">
            {membro ? (
              <Button type="button" variant="ghost" onClick={alternar} disabled={salvando}>
                {membro.ativo ? 'Desativar' : 'Reativar'}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando}>
                {salvando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                Salvar
              </Button>
            </div>
          </div>
        </form>
      </Dialogo>
    </>
  )
}
