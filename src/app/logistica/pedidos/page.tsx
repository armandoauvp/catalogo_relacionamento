import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { formatarData } from '@/lib/datas'
import { CabecalhoDaPagina, EstadoVazio } from '@/components/pagina'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FaseBadge } from '../pecas'
import { FormularioDePedido } from './formulario-de-pedido'

/**
 * Os pedidos que a pessoa fez à Logística, com a fase de cada um.
 *
 * O recorte é quem pediu, no `where`: o pedido de outra pessoa não é carregado.
 * As observações não aparecem aqui nem para quem as escreveu: é o campo que a
 * Logística usa para endereço e contato, e ela pode completá-lo na triagem.
 */
export default async function MeusPedidosPage() {
  const usuario = await exigirPermissao('logistica.pedir')

  const pedidos = await db.demandaLogistica.findMany({
    where: { solicitanteId: usuario.id },
    select: {
      id: true,
      titulo: true,
      itens: true,
      departamento: true,
      fase: true,
      responsavel: true,
      ativa: true,
      solicitadaEm: true,
      previsaoConclusao: true,
      concluidaEm: true,
    },
    orderBy: { solicitadaEm: 'desc' },
    take: 100,
  })

  return (
    <>
      <CabecalhoDaPagina
        titulo="Meus pedidos à Logística"
        descricao="O que você pediu à Logística e em que fase está cada pedido."
        acoes={
          <>
            <Button variant="outline" asChild>
              <Link href="/logistica">
                <ArrowLeft aria-hidden="true" />
                Dashboard
              </Link>
            </Button>
            <FormularioDePedido />
          </>
        }
      />

      {pedidos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum pedido ainda"
          descricao="Precisa de um envio, um kit ou um brinde? Peça por aqui: o pedido entra direto na fila da Logística, e a fase aparece nesta tela."
        />
      ) : (
        <Card className="overflow-hidden" data-tour="meus-pedidos">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Pedido em</TableHead>
                <TableHead>Previsão</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Fase</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="min-w-56">
                    <span className="font-medium">{p.titulo}</span>
                    {p.itens.length ? (
                      <span className="text-muted-foreground mt-0.5 block text-xs">
                        {p.itens.join(' · ')}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.departamento ?? '-'}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
                    {formatarData(p.solicitadaEm)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {p.concluidaEm
                      ? `Concluído em ${formatarData(p.concluidaEm)}`
                      : p.previsaoConclusao
                        ? formatarData(p.previsaoConclusao)
                        : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.responsavel ?? 'Aguardando triagem'}
                  </TableCell>
                  <TableCell>
                    {p.ativa ? (
                      <FaseBadge fase={p.fase} />
                    ) : (
                      <span className="text-muted-foreground text-sm">Arquivado</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  )
}
