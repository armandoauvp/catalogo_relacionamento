'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { conferirSkuNoTiny, gravarSkus } from '@/lib/actions/catalogo'
import { lerPlanilhaDeSkus, type LinhaDeSku, type ProdutoDoCatalogo } from '@/lib/tiny/skus'
import { baixarCsv, lerArquivo } from '@/app/tiny/planilha'

/**
 * SKUs do catálogo por planilha: uma linha por presente, com o nome como está
 * aqui e o código no Tiny. Cada SKU é conferido no Tiny antes de gravar, um
 * por vez, no ritmo que a API aceita.
 */

/** O Tiny bloqueia por um minuto quem passa do limite; abaixo dele, sem pressa. */
const INTERVALO_MS = 1_200
const ESPERA_DO_BLOQUEIO_MS = 61_000

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms))

/** Cada conferência leva o intervalo mais a resposta do Tiny, perto de 1,5 s. */
function restante({ feitos, total }: { feitos: number; total: number }) {
  const segundos = Math.ceil(((total - feitos) * 1_500) / 1_000)
  if (segundos < 5) return ''
  return segundos < 60
    ? `, falta cerca de ${segundos} s`
    : `, falta cerca de ${Math.ceil(segundos / 60)} min`
}

type Conferencia = { ok: true; nomeNoTiny: string } | { ok: false; erro: string }

export function ImportarSkus({ catalogo }: { catalogo: ProdutoDoCatalogo[] }) {
  const [tabela, setTabela] = useState<string[][] | null>(null)
  const [linhas, setLinhas] = useState<LinhaDeSku[]>([])
  const [erroDoArquivo, setErroDoArquivo] = useState<string | null>(null)
  const [lendo, setLendo] = useState(false)
  const [conferencias, setConferencias] = useState<Map<string, Conferencia>>(new Map())
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null)
  const [aguardando, setAguardando] = useState(false)
  const [gravando, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [gravados, setGravados] = useState<number | null>(null)

  const chave = (sku: string) => sku.trim().toLowerCase()
  const situacao = (l: LinhaDeSku): Conferencia | 'conferindo' | null =>
    l.erro ? { ok: false, erro: l.erro } : (conferencias.get(chave(l.sku)) ?? 'conferindo')
  const prontas = linhas.filter((l) => {
    const s = situacao(l)
    return s !== 'conferindo' && s?.ok
  })
  const comErro = linhas.filter((l) => {
    const s = situacao(l)
    return s !== 'conferindo' && s && !s.ok
  })

  async function conferir(lidas: LinhaDeSku[]) {
    const skus = [...new Set(lidas.filter((l) => !l.erro).map((l) => chave(l.sku)))]
    const originais = new Map(lidas.map((l) => [chave(l.sku), l.sku]))
    setProgresso({ feitos: 0, total: skus.length })
    for (const [i, sku] of skus.entries()) {
      if (i > 0) await esperar(INTERVALO_MS)
      let r = await conferirSkuNoTiny(originais.get(sku) ?? sku)
      if (r.ok && r.dados.limite) {
        setAguardando(true)
        await esperar(ESPERA_DO_BLOQUEIO_MS)
        setAguardando(false)
        r = await conferirSkuNoTiny(originais.get(sku) ?? sku)
      }
      const conferencia: Conferencia = r.ok
        ? r.dados.ok
          ? { ok: true, nomeNoTiny: r.dados.nomeNoTiny }
          : { ok: false, erro: r.dados.erro }
        : { ok: false, erro: r.erro }
      setConferencias((m) => new Map(m).set(sku, conferencia))
      setProgresso({ feitos: i + 1, total: skus.length })
    }
  }

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    setErroDoArquivo(null)
    setTabela(null)
    setLinhas([])
    setConferencias(new Map())
    setProgresso(null)
    if (!f) return
    setLendo(true)
    try {
      const lida = await lerArquivo(f)
      const leitura = lerPlanilhaDeSkus(lida, catalogo)
      if (leitura.faltando.length) {
        setErroDoArquivo(`A planilha não tem as colunas: ${leitura.faltando.join(', ')}.`)
      } else if (!leitura.linhas.length) {
        setErroDoArquivo('Nenhuma linha com SKU preenchido.')
      } else {
        setTabela(lida)
        setLinhas(leitura.linhas)
        setLendo(false)
        await conferir(leitura.linhas)
      }
    } catch {
      setErroDoArquivo('Não foi possível ler o arquivo. Envie um .xlsx ou .csv.')
    } finally {
      setLendo(false)
    }
  }

  function gravar() {
    if (!tabela) return
    setErro(null)
    iniciar(async () => {
      const r = await gravarSkus(
        tabela,
        prontas.map((l) => {
          const c = conferencias.get(chave(l.sku))
          return { linha: l.linha, nomeNoTiny: c?.ok ? c.nomeNoTiny : '' }
        }),
      )
      if (!r.ok) return setErro(r.erro)
      setGravados(r.dados.gravados)
    })
  }

  if (gravados !== null) {
    return (
      <div className="bg-card space-y-4 rounded-lg border p-6">
        <p className="font-display text-lg font-semibold">
          {gravados} {gravados === 1 ? 'SKU gravado' : 'SKUs gravados'} no catálogo.
        </p>
        <p className="text-muted-foreground text-sm">
          Os presentes com SKU já podem virar pedido no Tiny. Os que ficaram de fora seguem com o
          aviso no catálogo.
        </p>
        <Button asChild>
          <Link href="/admin/catalogo?sku=falta">Ver quem ainda falta</Link>
        </Button>
      </div>
    )
  }

  const conferindo = progresso !== null && progresso.feitos < progresso.total

  return (
    <div className="space-y-6">
      <section className="bg-card space-y-4 rounded-lg border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-muted-foreground max-w-prose text-sm">
            Uma linha por presente, em .xlsx ou .csv, com as colunas <strong>Presente</strong> (o
            nome como está no catálogo) e <strong>SKU no Tiny</strong>. Linha sem SKU é pulada. O
            código precisa existir no Tiny antes: cada um é conferido lá.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              baixarCsv('skus-do-catalogo.csv', [
                ['Presente', 'SKU no Tiny'],
                ...catalogo.map((p) => [p.nome, p.skuTiny ?? '']),
              ])
            }
          >
            <Download aria-hidden="true" />
            Baixar os presentes
          </Button>
        </div>
        <Input
          type="file"
          accept=".xlsx,.csv"
          onChange={aoEscolher}
          disabled={conferindo}
          aria-label="Planilha de SKUs"
          className="file:bg-muted h-auto py-2 file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm"
        />
        {lendo ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Lendo a planilha…
          </p>
        ) : null}
        {erroDoArquivo ? (
          <p role="alert" className="text-destructive text-sm">
            {erroDoArquivo}
          </p>
        ) : null}

        {linhas.length ? (
          <div className="space-y-3">
            <p className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
              <FileSpreadsheet className="text-muted-foreground size-4" aria-hidden="true" />
              {conferindo ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  {aguardando
                    ? 'O Tiny pediu uma pausa de um minuto; a conferência continua sozinha.'
                    : `Conferindo no Tiny: ${progresso.feitos} de ${progresso.total}${restante(progresso)}…`}
                </span>
              ) : (
                <span>
                  <span className="font-semibold">{prontas.length}</span> prontos para gravar
                  {comErro.length ? (
                    <>
                      {' · '}
                      <span className="text-destructive font-semibold">{comErro.length}</span> com
                      erro, que ficam de fora
                    </>
                  ) : null}
                </span>
              )}
            </p>
            <div className="max-h-[28rem] overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 sticky top-0 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Linha</th>
                    <th className="px-3 py-2 font-medium">Presente</th>
                    <th className="px-3 py-2 font-medium">SKU</th>
                    <th className="px-3 py-2 font-medium">No Tiny</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => {
                    const s = situacao(l)
                    return (
                      <tr key={l.linha} className="border-t align-top">
                        <td className="text-muted-foreground px-3 py-2 tabular-nums">{l.linha}</td>
                        <td className="px-3 py-2">{l.presente || '-'}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {l.sku}
                          {l.skuAtual && l.skuAtual !== l.sku ? (
                            <span className="text-muted-foreground block text-xs">
                              hoje: {l.skuAtual}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          {s === 'conferindo' ? (
                            <span className="text-muted-foreground text-xs">conferindo…</span>
                          ) : s?.ok ? (
                            <span className="flex flex-wrap items-center gap-2">
                              <Badge variant="success">ok</Badge>
                              {s.nomeNoTiny ? (
                                <span className="text-muted-foreground text-xs">
                                  {s.nomeNoTiny}
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-destructive text-xs">{s?.erro}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={gravar} disabled={gravando || conferindo || !prontas.length}>
          {gravando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {prontas.length
            ? `Gravar ${prontas.length} ${prontas.length === 1 ? 'SKU' : 'SKUs'}`
            : 'Gravar SKUs'}
        </Button>
        {erro ? (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        ) : null}
      </div>
    </div>
  )
}
