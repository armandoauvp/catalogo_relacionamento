import type { ReactNode } from 'react'
import type { Prisma } from '@prisma/client'
import { formatarBRL, subtotal } from '@/lib/money'
import { formatarCpf, formatarTelefone } from '@/lib/cpf'
import { formatarCep } from '@/lib/cep'
import { ROTULO_MOTIVO } from '@/lib/validators/solicitacao'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LinhaDoTempo } from '@/components/linha-do-tempo'

/**
 * Corpo do detalhe de uma solicitação.
 *
 * Compartilhado pelo Admin e pelo consultor. O consultor não é um visitante de
 * segunda classe aqui: ele vê os mesmos itens, a mesma carta e o mesmo
 * histórico: é a solicitação dele. O que muda é o que fica na coluna da
 * direita, que entra por `acoes`, e os dados sensíveis do cliente, que seguem
 * a matriz de permissões.
 */

export type SolicitacaoDetalhada = Prisma.SolicitacaoGetPayload<{
  include: {
    cliente: true
    consultor: { select: { nome: true } }
    itens: { include: { produto: { select: { nome: true } } } }
    historico: { include: { usuario: { select: { nome: true } } } }
  }
}>

export function DetalheDaSolicitacao({
  solicitacao,
  verDadosSensiveis,
  acoes,
}: {
  solicitacao: SolicitacaoDetalhada
  verDadosSensiveis: boolean
  /** Cartões extras da coluna da direita, a mudança de status, no Admin. */
  acoes?: ReactNode
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card className="overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Itens</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead className="text-right">Unitário</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {solicitacao.itens.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="font-medium">{item.produto?.nome ?? item.descricaoLivre}</span>
                    {item.urlExterna ? (
                      <a
                        href={item.urlExterna}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary-emphasis mt-0.5 block truncate text-xs underline-offset-4 hover:underline"
                      >
                        {item.urlExterna.replace(/^https?:\/\//, '')}
                      </a>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.quantidade}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {formatarBRL(item.valorUnitario)}
                  </TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                    {formatarBRL(subtotal(item.valorUnitario, item.quantidade))}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableCell colSpan={3} className="text-right font-medium">
                  Total
                </TableCell>
                <TableCell className="text-right text-base font-semibold whitespace-nowrap tabular-nums">
                  {formatarBRL(solicitacao.valorTotal)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Carta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Motivo do envio:{' '}
              <span className="text-foreground font-medium">
                {solicitacao.motivo === 'outro'
                  ? (solicitacao.motivoOutro ?? 'Outro')
                  : ROTULO_MOTIVO[solicitacao.motivo]}
              </span>
            </p>

            {/* A carta é o texto que chega ao cliente: tratada como citação,
                e não como mais um campo do formulário. */}
            <blockquote className="border-primary/25 bg-muted/40 rounded-r-md border-l-2 py-3 pr-4 pl-4 text-sm leading-relaxed whitespace-pre-wrap">
              {solicitacao.saudacaoCarta ? (
                <span className="mb-2 block">{solicitacao.saudacaoCarta}</span>
              ) : null}
              {solicitacao.mensagemCarta}
            </blockquote>

            {solicitacao.observacoes ? (
              <div className="border-t pt-4">
                <p className="text-muted-foreground font-ui mb-1.5 text-xs font-semibold tracking-[0.1em] uppercase">
                  Observações internas
                </p>
                <p className="text-sm whitespace-pre-wrap">{solicitacao.observacoes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            <LinhaDoTempo
              linhas={solicitacao.historico.map((h) => ({
                id: h.id,
                statusAnterior: h.statusAnterior,
                statusNovo: h.statusNovo,
                motivo: h.motivo,
                criadoEm: h.criadoEm,
                autor: h.usuario?.nome ?? 'sistema',
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <CartaoDeRastreio
          rastreio={solicitacao.rastreio}
          transportadora={solicitacao.transportadora}
        />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{solicitacao.cliente.nome}</p>
            {verDadosSensiveis ? (
              <>
                <p className="text-muted-foreground tabular-nums">
                  {formatarCpf(solicitacao.cliente.cpf)}
                </p>
                {solicitacao.cliente.telefone ? (
                  <p className="text-muted-foreground tabular-nums">
                    {formatarTelefone(solicitacao.cliente.telefone)}
                  </p>
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Entrega</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-1 text-sm">
            <p className="text-foreground font-medium">{solicitacao.entregaDestinatario}</p>
            <p>
              {solicitacao.entregaLogradouro}, {solicitacao.entregaNumero}
              {solicitacao.entregaComplemento ? `, ${solicitacao.entregaComplemento}` : ''}
            </p>
            <p>{solicitacao.entregaBairro}</p>
            <p>
              {solicitacao.entregaCidade}/{solicitacao.entregaUf} ·{' '}
              <span className="tabular-nums">{formatarCep(solicitacao.entregaCep)}</span>
            </p>
            <p className="border-t pt-2 text-xs">
              Endereço gravado na criação. Se o cliente se mudar, esta solicitação continua
              mostrando para onde o presente foi.
            </p>
          </CardContent>
        </Card>

        {acoes}
      </div>
    </div>
  )
}

/**
 * Rastreio, do lado de quem lê.
 *
 * Fica no topo da coluna, e não no fim: é a pergunta que traz o consultor a
 * esta tela. Sem código, o cartão diz em que pé está em vez de sumir, um
 * espaço vazio faria a pessoa procurar o que não existe.
 */
function CartaoDeRastreio({
  rastreio,
  transportadora,
}: {
  rastreio: string | null
  transportadora: string | null
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Rastreio</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {rastreio ? (
          <>
            {/* `select-all`: o código é copiado para o site da transportadora. */}
            <p className="font-medium tracking-wide tabular-nums select-all">{rastreio}</p>
            {transportadora ? <p className="text-muted-foreground mt-1">{transportadora}</p> : null}
            <p className="text-muted-foreground mt-3 border-t pt-3 text-xs">
              Acompanhe no site da transportadora. O status desta tela muda quando alguém confirma a
              entrega aqui dentro.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">
            Ainda sem código. Ele aparece aqui quando a expedição posta o presente.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
