'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Download, FileSpreadsheet, Loader2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { importarContatos } from '@/lib/actions/contatos-tiny'
import { lerContatos } from '@/lib/tiny/contato'
import { conferirRepetidos, type LeituraDoLote, type LinhaDoLote } from '@/lib/tiny/lote'
import { baixarCsv, lerArquivo } from '../../planilha'

/**
 * Atualização cadastral em massa no Tiny, sem gerar pedido: uma linha por
 * contato. Quem já existe no Tiny (pelo CPF/CNPJ) é alterado; quem não existe
 * é incluído.
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
]

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
  }
}

export function ImportarContatos() {
  const [arquivo, setArquivo] = useState<string | null>(null)
  const [leitura, setLeitura] = useState<LeituraDoLote | null>(null)
  const [erroDoArquivo, setErroDoArquivo] = useState<string | null>(null)
  const [lendo, setLendo] = useState(false)
  const [enviando, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [feito, setFeito] = useState<{ novos: number; atualizados: number } | null>(null)

  const validas = leitura?.linhas.filter((l) => l.erros.length === 0) ?? []
  const comErro = leitura?.linhas.filter((l) => l.erros.length > 0) ?? []

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    setErroDoArquivo(null)
    setLeitura(null)
    if (!f) return
    setArquivo(f.name)
    setLendo(true)
    try {
      const lida = lerContatos(await lerArquivo(f))
      if (lida.faltando.length) {
        setErroDoArquivo(`A planilha não tem as colunas: ${lida.faltando.join(', ')}.`)
      } else if (!lida.linhas.length) {
        setErroDoArquivo('A planilha não tem nenhuma linha abaixo do cabeçalho.')
      } else {
        setLeitura(lida)
      }
    } catch {
      setErroDoArquivo('Não foi possível ler o arquivo. Envie um .xlsx ou .csv.')
    } finally {
      setLendo(false)
    }
  }

  function tirar(linha: number) {
    setLeitura((l) =>
      l ? { ...l, linhas: conferirRepetidos(l.linhas.filter((x) => x.linha !== linha)) } : l,
    )
  }

  function enviar() {
    setErro(null)
    iniciar(async () => {
      const r = await importarContatos({
        arquivo,
        linhas: validas.map((l) => ({ linha: l.linha, campos: camposDe(l) })),
      })
      if (!r.ok) return setErro(r.erro)
      setFeito(r.dados)
    })
  }

  if (feito) {
    const total = feito.novos + feito.atualizados
    return (
      <div className="bg-card space-y-4 rounded-lg border p-6">
        <p className="font-display text-lg font-semibold">
          {total} {total === 1 ? 'contato entrou' : 'contatos entraram'} na fila do Tiny.
        </p>
        {feito.atualizados ? (
          <p className="text-muted-foreground text-sm">
            {feito.atualizados} já esperavam a vez e foram atualizados com os dados desta planilha.
          </p>
        ) : null}
        <p className="text-muted-foreground text-sm">
          Vão um a cada dois segundos, ou quatro quando é preciso procurar o contato antes.
        </p>
        <Button asChild>
          <Link href="/tiny/contatos">Acompanhar nos contatos</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="bg-card space-y-4 rounded-lg border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-muted-foreground max-w-prose text-sm">
            Uma linha por contato, em .xlsx ou .csv. Obrigatórios: Nome e CPF/CNPJ. Coluna vazia não
            apaga o que já está no Tiny.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => baixarCsv('modelo-contatos-tiny.csv', [MODELO])}
          >
            <Download aria-hidden="true" />
            Baixar modelo
          </Button>
        </div>
        <Input
          type="file"
          accept=".xlsx,.csv"
          onChange={aoEscolher}
          aria-label="Planilha de contatos"
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
            <p className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="text-muted-foreground size-4" aria-hidden="true" />
              <span>
                <span className="font-semibold">{validas.length}</span> prontos para enviar
                {comErro.length ? (
                  <>
                    {' · '}
                    <span className="text-destructive font-semibold">{comErro.length}</span> com
                    erro, que ficam de fora
                  </>
                ) : null}
              </span>
            </p>
            <div className="max-h-96 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 sticky top-0 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Linha</th>
                    <th className="px-3 py-2 font-medium">Nome</th>
                    <th className="px-3 py-2 font-medium">CPF/CNPJ</th>
                    <th className="px-3 py-2 font-medium">Cidade</th>
                    <th className="px-3 py-2 font-medium">Situação</th>
                    <th className="px-3 py-2">
                      <span className="sr-only">Tirar</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leitura.linhas.map((l) => (
                    <tr key={l.linha} className="border-t align-top">
                      <td className="text-muted-foreground px-3 py-2 tabular-nums">{l.linha}</td>
                      <td className="px-3 py-2">{l.destinatario.nome || '-'}</td>
                      <td className="px-3 py-2 tabular-nums">{l.destinatario.cpfCnpj || '-'}</td>
                      <td className="px-3 py-2">
                        {l.destinatario.cidade}
                        {l.destinatario.uf ? `/${l.destinatario.uf}` : ''}
                      </td>
                      <td className="px-3 py-2">
                        {l.erros.length ? (
                          <span className="text-destructive text-xs">{l.erros.join(' ')}</span>
                        ) : (
                          <Badge variant="success">ok</Badge>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => tirar(l.linha)}
                          aria-label={`Tirar a linha ${l.linha}`}
                        >
                          <X aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={enviar} disabled={enviando || !validas.length}>
          {enviando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {validas.length
            ? `Atualizar ${validas.length} ${validas.length === 1 ? 'contato' : 'contatos'} no Tiny`
            : 'Atualizar no Tiny'}
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
