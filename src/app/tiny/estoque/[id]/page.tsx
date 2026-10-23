import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { tinyConfigurado } from '@/lib/env'
import { obterEstoque, obterImagemDoProduto } from '@/lib/tiny/api'
import { ErroDoTiny } from '@/lib/tiny/erros'
import type { EstoqueDoProduto } from '@/lib/tiny/leitura'
import { CabecalhoDaPagina } from '@/components/pagina'
import { Stat } from '@/components/stat'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const numero = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

/** O saldo de um produto no Tiny, por depósito, ao lado do que o catálogo daqui diz. */
export default async function SaldoNoTinyPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermissao('tiny.operar')
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()

  let estoque: EstoqueDoProduto | null = null
  let imagem: string | null = null
  let erro: string | null = tinyConfigurado ? null : 'O Tiny ainda não está ligado.'
  if (tinyConfigurado) {
    try {
      estoque = await obterEstoque(id)
      imagem = await obterImagemDoProduto(id)
    } catch (e) {
      if (!(e instanceof ErroDoTiny)) throw e
      if (e.codigo === 20 || e.codigo === 32) notFound()
      erro = e.message
    }
  }

  const local = estoque?.codigo
    ? await db.produto.findFirst({
        where: { skuTiny: estoque.codigo },
        select: { id: true, nome: true, origem: true, controlaEstoque: true, estoque: true },
      })
    : null

  return (
    <>
      <Link
        href="/tiny/estoque"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Estoque no Tiny
      </Link>

      {!estoque ? (
        <div
          role="alert"
          className="border-warning/40 bg-warning/10 flex gap-3 rounded-lg border p-4 text-sm"
        >
          <AlertTriangle className="text-warning mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>{erro}</p>
        </div>
      ) : (
        <>
          <CabecalhoDaPagina
            sobrancelha={estoque.codigo ? `SKU ${estoque.codigo}` : 'Sem SKU'}
            titulo={estoque.nome}
            acoes={
              estoque.disponivel > 0 ? (
                <Badge variant="success">Disponível</Badge>
              ) : (
                <Badge variant="error">Sem saldo livre</Badge>
              )
            }
          />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="grid gap-4 sm:grid-cols-3">
                <Stat
                  destaque
                  rotulo="Disponível"
                  valor={numero(estoque.disponivel)}
                  apoio={`${estoque.unidade}, já sem o reservado`}
                />
                <Stat rotulo="Saldo" valor={numero(estoque.saldo)} apoio="Geral, no Tiny" />
                <Stat
                  rotulo="Reservado"
                  valor={numero(estoque.reservado)}
                  apoio="Em pedidos ainda abertos"
                />
              </div>

              <section aria-labelledby="depositos" className="bg-card rounded-lg border">
                <h2 id="depositos" className="font-display px-5 pt-5 text-lg font-semibold">
                  Por depósito
                </h2>
                {estoque.depositos.length === 0 ? (
                  <p className="text-muted-foreground px-5 pt-2 pb-5 text-sm">
                    O Tiny não informou depósitos para este produto.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Depósito</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead>Conta no geral?</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {estoque.depositos.map((d) => (
                        <TableRow key={`${d.nome}-${d.empresa}`}>
                          <TableCell className="font-medium">{d.nome}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {d.empresa ?? '-'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {numero(d.saldo)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {d.desconsiderado ? (
                              <span className="text-muted-foreground">Não</span>
                            ) : (
                              'Sim'
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </section>
            </div>

            <div className="space-y-6">
              {imagem ? (
                <div className="bg-card overflow-hidden rounded-lg border">
                  {/* Foto hospedada no Tiny, fora do domínio que o next/image conhece. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagem}
                    alt={estoque.nome}
                    width={600}
                    height={600}
                    className="aspect-square w-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : null}

              <section className="bg-card rounded-lg border p-5 text-sm">
                <h2 className="font-display mb-3 text-lg font-semibold">No catálogo daqui</h2>
                {local ? (
                  <>
                    <p className="font-medium">{local.nome}</p>
                    <p className="text-muted-foreground mt-1">
                      {local.origem === 'estoque_interno' ? 'Em estoque' : 'Sob pedido'}
                      {local.controlaEstoque && local.estoque !== null
                        ? ` · ${local.estoque} na contagem daqui`
                        : ''}
                    </p>
                    <Link
                      href="/admin/catalogo"
                      className="hover:text-primary-emphasis mt-3 inline-block underline underline-offset-4"
                    >
                      Abrir o cadastro de produtos
                    </Link>
                  </>
                ) : (
                  <p className="text-muted-foreground">Nenhum presente do catálogo usa este SKU.</p>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </>
  )
}
