import { exigirPermissao } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { catalogoProvider } from '@/lib/providers'
import { saldoDoMes } from '@/lib/saldo'
import { CabecalhoDaPagina } from '@/components/pagina'
import { FormularioDeSolicitacao, type ProdutoDoCatalogo } from './formulario'

/**
 * Nova solicitação: cliente → itens → entrega → carta → revisão.
 *
 * O catálogo vem inteiro para o cliente porque a busca da etapa 2 é local, são
 * dezenas de produtos, não milhares, e um round-trip por tecla atrapalharia
 * mais do que economizaria. `Prisma.Decimal` não atravessa a fronteira do
 * servidor, então o valor vira `number` aqui; o valor que conta é o relido do
 * banco no momento de gravar, em `criarSolicitacao`.
 *
 * O saldo do mês vem junto porque a decisão que ele muda acontece aqui: saber
 * que restam R$ 200 enquanto se escolhe o presente é diferente de descobrir
 * isso depois, na lista.
 */
export default async function NovaSolicitacaoPage() {
  const usuario = await exigirPermissao('solicitacao.criar')

  const [pagina, saldo, modelosDeCarta] = await Promise.all([
    catalogoProvider.listar({ apenasAtivos: true, porPagina: 500 }),
    saldoDoMes(usuario.id),
    db.modeloCarta.findMany({
      where: { ativo: true },
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
      select: { id: true, motivo: true, texto: true },
    }),
  ])

  const produtos: ProdutoDoCatalogo[] = pagina.itens.map((p) => ({
    id: p.id,
    nome: p.nome,
    descricao: p.descricao,
    categoriaNome: p.categoriaNome,
    fotoUrl: p.fotoUrl,
    valor: p.valor ? p.valor.toNumber() : null,
    tipoValor: p.tipoValor,
    origem: p.origem,
    controlaEstoque: p.controlaEstoque,
    estoque: p.estoque,
    urlCompra: p.urlCompra,
    exigeAcompanhamento: p.exigeAcompanhamento,
    serveComoAcompanhamento: p.serveComoAcompanhamento,
  }))

  return (
    <>
      <CabecalhoDaPagina
        titulo="Enviar um presente"
        descricao="Cinco etapas, do cliente à revisão. Nada é enviado antes da última."
      />

      <FormularioDeSolicitacao
        produtos={produtos}
        consultor={usuario.nome}
        gastoNoMes={saldo.gasto.toNumber()}
        limiteMensal={saldo.limite ? saldo.limite.toNumber() : null}
        modelosDeCarta={modelosDeCarta}
      />
    </>
  )
}
