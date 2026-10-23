import Link from 'next/link'
import type { Route } from 'next'
import { Download } from 'lucide-react'
import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { pode } from '@/lib/permissions'
import { clientesDoFiltro, etiquetasEmUso } from '@/lib/clientes'
import {
  filtroDeClientesSchema,
  ORDENS_DE_CLIENTES,
  queryDoFiltro,
  whereDeClientes,
} from '@/lib/filtro-de-clientes'
import { BotaoDeFiltro, FormDeFiltro, LinkDeFiltro } from '@/components/filtro-sem-piscar'
import { BarraDeFiltros, CabecalhoDaPagina, EstadoVazio } from '@/components/pagina'
import { Stat } from '@/components/stat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EditorDeCliente } from './editor-de-cliente'
import { ImportarClientes } from './importar-clientes'
import { TabelaDeClientes } from './tabela-de-clientes'

/** O teto da tela; a exportação leva o recorte inteiro. */
const LIMITE = 300

/**
 * Base de clientes: cadastro, importação, filtros por etiqueta e período,
 * exportação em Excel e, para quem opera o Tiny, mandar os escolhidos como
 * contatos ou como um lote de pedidos.
 */
export default async function AdminClientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const usuario = await exigirPermissao('cliente.gerenciar')
  const veDadosCompletos = pode(usuario.perfil, 'cliente.verDadosSensiveis')
  const operaTiny = pode(usuario.perfil, 'tiny.operar')

  const filtro = filtroDeClientesSchema.parse(await searchParams)
  const where = whereDeClientes(filtro)
  const filtrando = Object.keys(where).length > 0

  const [clientes, total, comEndereco, presenteados, etiquetas] = await Promise.all([
    clientesDoFiltro(filtro, LIMITE),
    db.cliente.count({ where }),
    db.cliente.count({ where: { AND: [where, { cep: { not: null } }] } }),
    db.cliente.count({ where: { AND: [where, { solicitacoes: { some: {} } }] } }),
    etiquetasEmUso(),
  ])

  const query = queryDoFiltro(filtro)

  return (
    <>
      <CabecalhoDaPagina
        titulo="Clientes"
        descricao="Cadastro manual ou importação por CSV. O CPF é a chave que evita duplicatas."
        acoes={
          <>
            <Button variant="outline" asChild>
              {/* Arquivo, não tela: link comum, sem a navegação do app. */}
              <a href={`/api/export/clientes${query ? `?${query}` : ''}`}>
                <Download aria-hidden="true" />
                Baixar Excel
              </a>
            </Button>
            <ImportarClientes />
            <EditorDeCliente />
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat
          rotulo={filtrando ? 'Clientes no filtro' : 'Clientes'}
          valor={total}
          apoio={total > LIMITE ? `A tela mostra ${LIMITE}; o Excel leva todos.` : undefined}
        />
        <Stat rotulo="Com endereço" valor={comEndereco} apoio="Preenchem a entrega sozinhos." />
        <Stat
          rotulo="Já presenteados"
          valor={presenteados}
          apoio="Com pelo menos uma solicitação."
        />
      </div>

      <BarraDeFiltros>
        <FormDeFiltro acao="/admin/clientes" className="flex flex-1 flex-wrap items-center gap-2">
          <Input
            name="busca"
            defaultValue={filtro.busca}
            placeholder="Nome, e-mail ou CPF"
            aria-label="Buscar clientes"
            className="w-56"
          />
          <Select
            name="etiqueta"
            defaultValue={filtro.etiqueta ?? ''}
            aria-label="Etiqueta"
            className="w-48"
          >
            <option value="">Todas as etiquetas</option>
            {etiquetas.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
          <Input
            name="de"
            type="date"
            defaultValue={filtro.de}
            aria-label="Cadastrado desde"
            className="w-40"
          />
          <Input
            name="ate"
            type="date"
            defaultValue={filtro.ate}
            aria-label="Cadastrado até"
            className="w-40"
          />
          <Select name="ordem" defaultValue={filtro.ordem} aria-label="Ordem" className="w-52">
            {Object.entries(ORDENS_DE_CLIENTES).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Select>
          <BotaoDeFiltro>Filtrar</BotaoDeFiltro>
          {filtrando ? (
            <LinkDeFiltro
              href={'/admin/clientes' as Route}
              className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
            >
              Limpar
            </LinkDeFiltro>
          ) : null}
        </FormDeFiltro>
      </BarraDeFiltros>

      {clientes.length === 0 ? (
        <EstadoVazio
          titulo={filtrando ? 'Ninguém neste filtro' : 'Nenhum cliente cadastrado'}
          descricao={
            filtrando
              ? 'Tire um dos filtros ou procure de outro jeito.'
              : 'Cadastre manualmente ou importe um CSV. O CPF é a chave que impede duplicatas.'
          }
          acao={
            filtrando ? (
              <Button variant="outline" asChild>
                <Link href="/admin/clientes">Ver todos</Link>
              </Button>
            ) : (
              <EditorDeCliente />
            )
          }
        />
      ) : (
        <TabelaDeClientes
          operaTiny={operaTiny}
          veDadosCompletos={veDadosCompletos}
          clientes={clientes.map((c) => ({
            id: c.id,
            nome: c.nome,
            cpf: c.cpf,
            telefone: c.telefone,
            email: c.email,
            cep: c.cep,
            logradouro: c.logradouro,
            numero: c.numero,
            complemento: c.complemento,
            bairro: c.bairro,
            cidade: c.cidade,
            uf: c.uf,
            etiquetas: c.etiquetas,
            origem: c.origem,
            criadoEm: c.criadoEm.toISOString(),
            solicitacoes: c.solicitacoes,
            total: c.total?.toString() ?? '0',
          }))}
        />
      )}
    </>
  )
}
