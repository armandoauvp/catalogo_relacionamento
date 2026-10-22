'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { Download, FileSpreadsheet, Loader2, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { buscarProdutosNoTiny, buscarTransportadoras, criarLote } from '@/lib/actions/tiny'
import type { ProdutoDoTiny } from '@/lib/tiny/api'
import { formatarBRL } from '@/lib/money'
import { tabelaDoCsv } from '@/lib/importacao-clientes'
import { lerLote, type LeituraDoLote, type LinhaDoLote } from '@/lib/tiny/lote'
import { servicosDaTransportadora } from '@/lib/tiny/pedido'
import { cn } from '@/lib/utils'

/**
 * Importação em lote, como no AUVP-Eventos: uma planilha com uma linha por
 * destinatário, um produto do Tiny, uma transportadora e um marcador para
 * todas. Cada linha vira um pedido no Tiny pela fila.
 *
 * O que muda em relação ao AUVP-Eventos: a prévia diz o que está errado em
 * cada linha antes de enviar, só as linhas certas vão, e importar a mesma
 * planilha de novo não duplica pedido (o servidor pula quem já recebeu este
 * produto com este marcador).
 */

const MODELO = [
  'Nome',
  'CPF/CNPJ',
  'Email',
  'Telefone',
  'CEP',
  'Endereço',
  'Número',
  'Complemento',
  'Bairro',
  'Cidade',
  'UF',
  'Quantidade',
]

function baixarModelo() {
  const exemplo = [
    'Marina Alves Pereira',
    '529.982.247-25',
    'marina@exemplo.com.br',
    '11987654321',
    '01310-100',
    'Avenida Paulista',
    '1000',
    'Apto 152',
    'Bela Vista',
    'São Paulo',
    'SP',
    '1',
  ]
  const csv = '﻿' + [MODELO, exemplo].map((l) => l.map((c) => `"${c}"`).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'modelo-envio-em-lote.csv'
  a.click()
  URL.revokeObjectURL(url)
}

/** A planilha como tabela de texto, linha a linha na mesma posição do Excel. */
async function lerArquivo(arquivo: File): Promise<string[][]> {
  if (/\.csv$/i.test(arquivo.name)) return tabelaDoCsv(await arquivo.text())

  const ExcelJS = (await import('exceljs')).default
  const livro = new ExcelJS.Workbook()
  await livro.xlsx.load(await arquivo.arrayBuffer())
  const aba = livro.worksheets[0]
  if (!aba) return []
  const tabela: string[][] = Array.from({ length: aba.rowCount }, () => [])
  aba.eachRow({ includeEmpty: false }, (linha, numero) => {
    // `text` é o que o Excel mostra: resolve fórmula, texto rico e data, que
    // `String(valor)` transformaria em "[object Object]".
    tabela[numero - 1] = Array.from(
      { length: aba.columnCount },
      (_, i) => linha.getCell(i + 1).text ?? '',
    )
  })
  return tabela
}

function camposDe(l: LinhaDoLote): Record<string, string> {
  const d = l.destinatario
  return {
    nome: d.nome,
    cpfCnpj: d.cpfCnpj,
    email: d.email ?? '',
    telefone: d.telefone ?? '',
    cep: d.cep,
    endereco: d.endereco,
    numero: d.numero,
    complemento: d.complemento ?? '',
    bairro: d.bairro,
    cidade: d.cidade,
    uf: d.uf,
    quantidade: String(l.quantidade),
  }
}

function Campo({
  rotulo,
  dica,
  children,
  className,
}: {
  rotulo: string
  dica?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn('grid content-start gap-1.5 text-sm font-medium', className)}>
      {rotulo}
      {children}
      {dica ? <span className="text-muted-foreground text-xs font-normal">{dica}</span> : null}
    </label>
  )
}

const selectClasse =
  'border-input bg-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none'

export function ImportarLote({
  subsidiarias,
  departamentos,
}: {
  subsidiarias: string[]
  departamentos: string[]
}) {
  const router = useRouter()
  const [arquivo, setArquivo] = useState<string | null>(null)
  const [leitura, setLeitura] = useState<LeituraDoLote | null>(null)
  const [erroDoArquivo, setErroDoArquivo] = useState<string | null>(null)
  const [lendo, setLendo] = useState(false)
  const [soErros, setSoErros] = useState(false)

  const [busca, setBusca] = useState('')
  const [produtos, setProdutos] = useState<ProdutoDoTiny[] | null>(null)
  const [produto, setProduto] = useState<ProdutoDoTiny | null>(null)
  const [buscando, iniciarBusca] = useTransition()
  const [erroDaBusca, setErroDaBusca] = useState<string | null>(null)

  const [transportadoras, setTransportadoras] = useState<string[]>([])
  const [transportadora, setTransportadora] = useState('')
  const [servico, setServico] = useState('')

  const [enviando, iniciarEnvio] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{
    loteId: string
    criados: number
    jaEnviados: { linha: number; nome: string }[]
  } | null>(null)

  useEffect(() => {
    buscarTransportadoras().then((r) => {
      if (r.ok) setTransportadoras(r.dados)
    })
  }, [])

  const servicos = useMemo(
    () => (transportadora ? servicosDaTransportadora(transportadora) : []),
    [transportadora],
  )

  const validas = leitura?.linhas.filter((l) => l.erros.length === 0) ?? []
  const comErro = leitura?.linhas.filter((l) => l.erros.length > 0) ?? []
  const mostradas = soErros ? comErro : (leitura?.linhas ?? [])

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    setErroDoArquivo(null)
    setLeitura(null)
    setResultado(null)
    if (!f) return
    setArquivo(f.name)
    setLendo(true)
    try {
      const lida = lerLote(await lerArquivo(f))
      if (lida.faltando.length) {
        setErroDoArquivo(
          `A planilha não tem as colunas: ${lida.faltando.join(', ')}. Use o modelo.`,
        )
      } else if (lida.linhas.length === 0) {
        setErroDoArquivo('A planilha não tem nenhuma linha abaixo do cabeçalho.')
      } else {
        setLeitura(lida)
        setSoErros(lida.linhas.some((l) => l.erros.length > 0))
      }
    } catch {
      setErroDoArquivo('Não foi possível ler o arquivo. Envie um .xlsx ou .csv.')
    } finally {
      setLendo(false)
    }
  }

  function buscar() {
    setErroDaBusca(null)
    iniciarBusca(async () => {
      const r = await buscarProdutosNoTiny(busca)
      if (!r.ok) return setErroDaBusca(r.erro)
      setProdutos(r.dados)
      if (r.dados.length === 0) setErroDaBusca('Nenhum produto com esse nome no Tiny.')
    })
  }

  function enviar(dados: FormData) {
    setErro(null)
    if (!produto) return setErro('Escolha o produto do Tiny.')
    if (!validas.length) return setErro('Nenhuma linha válida para enviar.')
    iniciarEnvio(async () => {
      const r = await criarLote({
        arquivo,
        marcador: String(dados.get('marcador') ?? ''),
        subsidiaria: String(dados.get('subsidiaria') ?? ''),
        departamento: String(dados.get('departamento') ?? ''),
        produto: { codigo: produto.codigo || null, nome: produto.nome, preco: produto.preco },
        transportadora: transportadora || null,
        formaFrete: servico || null,
        linhas: validas.map((l) => ({ linha: l.linha, campos: camposDe(l) })),
      })
      if (!r.ok) return setErro(r.erro)
      if (r.dados.jaEnviados.length) setResultado(r.dados)
      else router.push(`/tiny/lotes/${r.dados.loteId}` as Route)
    })
  }

  if (resultado) {
    return (
      <div className="bg-card space-y-4 rounded-lg border p-6">
        <p className="font-display text-lg font-semibold">
          {resultado.criados} {resultado.criados === 1 ? 'pedido entrou' : 'pedidos entraram'} na
          fila.
        </p>
        <div className="text-sm">
          <p>
            {resultado.jaEnviados.length}{' '}
            {resultado.jaEnviados.length === 1 ? 'linha foi pulada' : 'linhas foram puladas'}: já
            tinham virado pedido com este marcador e este produto.
          </p>
          <ul className="text-muted-foreground mt-2 list-inside list-disc">
            {resultado.jaEnviados.slice(0, 20).map((j) => (
              <li key={j.linha}>
                Linha {j.linha}: {j.nome}
              </li>
            ))}
          </ul>
        </div>
        <Button asChild>
          <Link href={`/tiny/lotes/${resultado.loteId}` as Route}>Acompanhar o lote</Link>
        </Button>
      </div>
    )
  }

  return (
    <form action={enviar} className="space-y-6">
      <section className="bg-card space-y-4 rounded-lg border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">1. A planilha</h2>
            <p className="text-muted-foreground text-sm">
              Uma linha por destinatário, em .xlsx ou .csv. A planilha do AUVP-Eventos serve como
              está.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={baixarModelo}>
            <Download aria-hidden="true" />
            Baixar modelo
          </Button>
        </div>

        <Input
          type="file"
          accept=".xlsx,.csv"
          onChange={aoEscolher}
          aria-label="Planilha de destinatários"
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

        {leitura ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="text-muted-foreground size-4" aria-hidden="true" />
                <span>
                  <span className="font-semibold">{validas.length}</span> prontas para enviar
                  {comErro.length ? (
                    <>
                      {' · '}
                      <span className="text-destructive font-semibold">{comErro.length}</span> com
                      erro, que ficam de fora
                    </>
                  ) : null}
                </span>
              </p>
              {comErro.length ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={soErros}
                    onChange={(e) => setSoErros(e.target.checked)}
                    className="accent-primary size-4"
                  />
                  Mostrar só as linhas com erro
                </label>
              ) : null}
            </div>

            <div className="max-h-96 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 sticky top-0 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Linha</th>
                    <th className="px-3 py-2 font-medium">Nome</th>
                    <th className="px-3 py-2 font-medium">CPF/CNPJ</th>
                    <th className="px-3 py-2 font-medium">Cidade</th>
                    <th className="px-3 py-2 text-right font-medium">Qtd.</th>
                    <th className="px-3 py-2 font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {mostradas.map((l) => (
                    <tr key={l.linha} className="border-t align-top">
                      <td className="text-muted-foreground px-3 py-2 tabular-nums">{l.linha}</td>
                      <td className="px-3 py-2">{l.destinatario.nome || '-'}</td>
                      <td className="px-3 py-2 tabular-nums">{l.destinatario.cpfCnpj || '-'}</td>
                      <td className="px-3 py-2">
                        {l.destinatario.cidade}
                        {l.destinatario.uf ? `/${l.destinatario.uf}` : ''}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.quantidade}</td>
                      <td className="px-3 py-2">
                        {l.erros.length ? (
                          <span className="text-destructive text-xs">{l.erros.join(' ')}</span>
                        ) : (
                          <Badge variant="success">ok</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <section className="bg-card space-y-4 rounded-lg border p-5">
        <div>
          <h2 className="font-display text-lg font-semibold">2. O produto no Tiny</h2>
          <p className="text-muted-foreground text-sm">
            O mesmo para todas as linhas, com o preço do cadastro do Tiny.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                buscar()
              }
            }}
            placeholder="Nome ou código do produto"
            aria-label="Buscar produto no Tiny"
            className="max-w-md"
          />
          <Button type="button" variant="outline" onClick={buscar} disabled={buscando}>
            {buscando ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Search aria-hidden="true" />
            )}
            Buscar
          </Button>
        </div>
        {erroDaBusca ? <p className="text-destructive text-sm">{erroDaBusca}</p> : null}
        {produtos?.length ? (
          <ul className="grid gap-2 sm:grid-cols-2" aria-label="Produtos encontrados">
            {produtos.map((p) => {
              const escolhido = produto?.id === p.id
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={escolhido}
                    onClick={() => setProduto(p)}
                    className={cn(
                      'focus-visible:ring-ring w-full rounded-lg border p-3 text-left text-sm transition-colors outline-none focus-visible:ring-2',
                      escolhido
                        ? 'border-primary bg-primary/5 ring-primary/25 ring-2'
                        : 'hover:border-foreground/30',
                    )}
                  >
                    <span className="font-medium">{p.nome}</span>
                    <span className="text-muted-foreground block text-xs">
                      {p.codigo ? `SKU ${p.codigo} · ` : ''}
                      {formatarBRL(p.preco)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </section>

      <section className="bg-card space-y-4 rounded-lg border p-5">
        <div>
          <h2 className="font-display text-lg font-semibold">3. Envio e registro</h2>
          <p className="text-muted-foreground text-sm">
            O marcador identifica o lote no Tiny, e é ele que impede a mesma pessoa de receber duas
            vezes o mesmo produto, mesmo importando a planilha de novo.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Marcador" dica="Ex.: EVENTO-NOV-26. Até 50 caracteres.">
            <Input name="marcador" required maxLength={50} />
          </Campo>
          <Campo rotulo="Transportadora" dica="Vazio usa o padrão da conta no Tiny.">
            <select
              value={transportadora}
              onChange={(e) => {
                setTransportadora(e.target.value)
                setServico(
                  e.target.value ? (servicosDaTransportadora(e.target.value)[0] ?? '') : '',
                )
              }}
              className={selectClasse}
            >
              <option value="">Padrão do Tiny</option>
              {transportadoras.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Serviço">
            <select
              value={servico}
              onChange={(e) => setServico(e.target.value)}
              disabled={!servicos.length}
              className={selectClasse}
            >
              {servicos.length ? null : <option value="">-</option>}
              {servicos.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Subsidiária que pediu" dica="Para o gráfico do Dashboard Logístico.">
            <Input name="subsidiaria" list="lote-subsidiarias" required maxLength={80} />
          </Campo>
          <Campo rotulo="Departamento que pediu">
            <Input name="departamento" list="lote-departamentos" required maxLength={80} />
          </Campo>
        </div>
        <datalist id="lote-subsidiarias">
          {subsidiarias.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <datalist id="lote-departamentos">
          {departamentos.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={enviando || !validas.length || !produto}>
          {enviando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {validas.length
            ? `Enviar ${validas.length} ${validas.length === 1 ? 'pedido' : 'pedidos'} ao Tiny`
            : 'Enviar ao Tiny'}
        </Button>
        {erro ? (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Os pedidos entram na fila e vão ao Tiny em seguida, um a cada dois segundos.
          </p>
        )}
      </div>
    </form>
  )
}
