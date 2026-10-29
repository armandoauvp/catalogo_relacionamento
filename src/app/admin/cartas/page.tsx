import { MotivoEnvio } from '@prisma/client'
import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { ROTULO_MOTIVO } from '@/lib/validators/solicitacao'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { CabecalhoDaPagina } from '@/components/pagina'
import { cn } from '@/lib/utils'
import { AcoesDoModelo, EditorDeModelo } from './editor-de-modelo'

/**
 * Modelos de carta: as sugestões da etapa da carta, por motivo.
 *
 * A lista inclui os desativados, no lugar deles: some só da sugestão, e quem
 * desativou por engano encontra o modelo onde ele estava.
 */
export default async function ModelosDeCartaPage() {
  await exigirPermissao('carta.gerenciarModelos')

  const modelos = await db.modeloCarta.findMany({
    orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    select: { id: true, motivo: true, texto: true, ativo: true },
  })

  return (
    <>
      <CabecalhoDaPagina
        titulo="Modelos de carta"
        descricao="As sugestões de texto que o consultor vê na etapa da carta, na ordem desta lista. Ele escolhe uma e edita antes de enviar; mudar um modelo não altera carta já enviada."
      />

      <div className="space-y-6">
        {Object.values(MotivoEnvio).map((motivo) => {
          const doMotivo = modelos.filter((m) => m.motivo === motivo)
          const ativos = doMotivo.filter((m) => m.ativo).length

          return (
            <Card key={motivo}>
              <CardContent className="p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold">{ROTULO_MOTIVO[motivo]}</h2>
                    <p className="text-muted-foreground text-xs">
                      {ativos === 0
                        ? 'Nenhuma sugestão: o consultor escreve do zero.'
                        : ativos === 1
                          ? '1 sugestão ativa'
                          : `${ativos} sugestões ativas`}
                    </p>
                  </div>
                  <EditorDeModelo motivo={motivo} rotuloDoMotivo={ROTULO_MOTIVO[motivo]} />
                </div>

                {doMotivo.length ? (
                  <ul className="divide-y border-t">
                    {doMotivo.map((m, i) => (
                      <li
                        key={m.id}
                        className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className={cn('min-w-0 flex-1', !m.ativo && 'opacity-60')}>
                          <p className="text-sm leading-relaxed">{m.texto}</p>
                          {!m.ativo ? (
                            <Badge variant="muted" className="mt-2">
                              desativado
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <EditorDeModelo
                            motivo={motivo}
                            rotuloDoMotivo={ROTULO_MOTIVO[motivo]}
                            modelo={{ id: m.id, texto: m.texto }}
                          />
                          <AcoesDoModelo
                            id={m.id}
                            ativo={m.ativo}
                            primeiro={i === 0}
                            ultimo={i === doMotivo.length - 1}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}
