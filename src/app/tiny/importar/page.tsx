import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { tinyConfigurado } from '@/lib/env'
import { sugestoesDoCadastro } from '@/lib/logistica/painel'
import { pode } from '@/lib/permissions'
import { CabecalhoDaPagina, EstadoVazio } from '@/components/pagina'
import { ImportarLote } from './importar-lote'

/**
 * `?clientes=id,id` abre a importação com os clientes escolhidos na base em
 * vez de uma planilha: o endereço padrão de cada um vai para a prévia, onde o
 * que faltar se corrige linha a linha.
 */
export default async function ImportarLotePage({
  searchParams,
}: {
  searchParams: Promise<{ clientes?: string }>
}) {
  const usuario = await exigirPermissao('tiny.operar')
  const sugestoes = tinyConfigurado ? await sugestoesDoCadastro() : null

  const ids = ((await searchParams).clientes ?? '').split(',').filter(Boolean).slice(0, 300)
  const daBase =
    ids.length && pode(usuario.perfil, 'cliente.gerenciar')
      ? await db.cliente.findMany({ where: { id: { in: ids } }, orderBy: { nome: 'asc' } })
      : []

  return (
    <>
      <Link
        href={daBase.length ? '/admin/clientes' : '/tiny'}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {daBase.length ? 'Clientes' : 'Tiny'}
      </Link>
      <CabecalhoDaPagina
        titulo="Importar lote"
        descricao={
          daBase.length
            ? `${daBase.length} clientes da base, um pedido para cada. Escolha o produto e a transportadora.`
            : 'Uma planilha, um produto e uma transportadora: cada linha vira um pedido no Tiny.'
        }
      />
      {sugestoes ? (
        <ImportarLote
          subsidiarias={sugestoes.subsidiarias}
          departamentos={sugestoes.departamentos}
          linhasDaBase={
            daBase.length
              ? daBase.map((c, i) => ({
                  linha: i + 1,
                  campos: {
                    nome: c.nome,
                    cpfCnpj: c.cpf,
                    email: c.email ?? '',
                    telefone: c.telefone ?? '',
                    cep: c.cep ?? '',
                    endereco: c.logradouro ?? '',
                    numero: c.numero ?? '',
                    complemento: c.complemento ?? '',
                    bairro: c.bairro ?? '',
                    cidade: c.cidade ?? '',
                    uf: c.uf ?? '',
                    quantidade: '1',
                    valor: '',
                  },
                }))
              : null
          }
        />
      ) : (
        <EstadoVazio
          titulo="O Tiny ainda não está ligado"
          descricao="Falta o token do Tiny na Vercel (TINY_API_TOKEN). Sem ele não dá para buscar produtos nem criar pedidos."
        />
      )}
    </>
  )
}
