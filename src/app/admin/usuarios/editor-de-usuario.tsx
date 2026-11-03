'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Perfil } from '@prisma/client'
import { Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialogo } from '@/components/ui/dialogo'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ROTULO_PERFIL } from '@/lib/permissions'
import { salvarUsuario } from '@/lib/actions/usuarios'

/**
 * Edição de usuário.
 *
 * Não há "criar": o usuário entra sozinho no primeiro login pelo SSO, como
 * consultor. O que se faz aqui é promover, definir teto de gasto e desativar
 * quem saiu do time. A tela oferece o que `perfisAoAlcance` deixa; quem confere é
 * `salvarUsuario`.
 */

export type UsuarioEditavel = {
  id: string
  nome: string
  email: string
  perfil: Perfil
  limiteMensal: string | null
  ativo: boolean
}

export function EditorDeUsuario({
  usuario,
  perfis,
  defineLimite,
}: {
  usuario: UsuarioEditavel
  /** Os perfis que quem edita pode atribuir. Com um só, não há o que escolher. */
  perfis: readonly Perfil[]
  defineLimite: boolean
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [salvando, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [perfil, setPerfil] = useState<Perfil>(usuario.perfil)

  function abrir() {
    setErro(null)
    setPerfil(usuario.perfil)
    setAberto(true)
  }

  /**
   * `onSubmit`, e não `action`: React limpa o formulário depois de rodar a
   * action, e uma recusa do servidor apagaria o que a pessoa digitou.
   */
  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const dados = new FormData(evento.currentTarget)
    setErro(null)
    iniciar(async () => {
      const r = await salvarUsuario(dados)
      if (!r.ok) return setErro(r.erro)
      setAberto(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={abrir}>
        <Pencil aria-hidden="true" />
        Editar
      </Button>

      <Dialogo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={usuario.nome}
        descricao={usuario.email}
      >
        <form onSubmit={enviar} className="space-y-5">
          <input type="hidden" name="id" value={usuario.id} />

          {perfis.length > 1 ? (
            <div className="space-y-1.5">
              <Label htmlFor="usuario-perfil">Perfil</Label>
              <Select
                id="usuario-perfil"
                name="perfil"
                value={perfil}
                onChange={(e) => setPerfil(e.target.value as Perfil)}
              >
                {perfis.map((p) => (
                  <option key={p} value={p}>
                    {ROTULO_PERFIL[p]}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <input type="hidden" name="perfil" value={perfil} />
          )}

          {defineLimite ? (
            <div className="space-y-1.5">
              <Label htmlFor="usuario-limite">Limite mensal</Label>
              <Input
                id="usuario-limite"
                name="limiteMensal"
                inputMode="decimal"
                placeholder="Sem limite"
                defaultValue={usuario.limiteMensal ?? ''}
                className="max-w-48"
              />
              <p className="text-muted-foreground text-xs">
                Em branco = sem teto. Estourar o limite sinaliza no painel, não bloqueia a
                solicitação : é o que a spec define para o V1.
              </p>
            </div>
          ) : null}

          {defineLimite && perfil !== Perfil.consultor ? (
            <p className="bg-muted/50 text-muted-foreground rounded-md border px-3 py-2 text-xs leading-relaxed">
              O limite mensal vale para quem pede presentes no dia a dia, os consultores.
            </p>
          ) : null}

          <label className="flex items-center gap-2.5 text-sm font-medium">
            <input
              type="checkbox"
              name="ativo"
              value="on"
              defaultChecked={usuario.ativo}
              className="accent-primary size-4"
            />
            Usuário ativo
          </label>

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
