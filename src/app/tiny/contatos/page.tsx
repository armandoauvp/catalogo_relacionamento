import Link from 'next/link'
import type { Route } from 'next'
import { AlertTriangle, FileUp, Plus } from 'lucide-react'
import { db } from '@/lib/db'
import { exigirPermissao } from '@/lib/auth-guards'
import { tinyConfigurado } from '@/lib/env'
import { formatarCpf, formatarTelefone } from '@/lib/cpf'
import { formatarDataHora } from '@/lib/datas'
import { pesquisarContatos } from '@/lib/tiny/api'
import { ErroDoTiny } from '@/lib/tiny/erros'
import { classificarBusca, type PaginaDeContatos } from '@/lib/tiny/leitura'
import { ROTULO_ENVIO, tomDoPedido } from '@/lib/tiny/rotulos'
import { BotaoDeFiltro, FormDeFiltro, LinkDeFiltro } from '@/components/filtro-sem-piscar'
import { BarraDeFiltros, CabecalhoDaPagina, EstadoVazio } from '@/components/pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AtualizarEnquanto, BotaoReenviar } from '../acoes-da-fila'

/**
 * Contatos (clientes) do Tiny: buscar, abrir para editar, cadastrar e
 * atualizar em massa. A busca lê direto do Tiny; o que se grava vai pela fila,
 * e a parte de baixo mostra o andamento.
 */

const documento = (d: string) => (d.length === 11 ? formatarCpf(d) : d)

type Params = { busca?: string; pagina?: string }

export default async function ContatosDoTinyPage({
  searchParams,
}: {
  searchParams: Promise<Params>
}) {
  await exigirPermissao('tiny.operar')
  const params = await searchParams
  const busca = (params.busca ?? '').trim()
  const pagina = Math.max(1, Number(params.pagina) || 1)

  let resultado: PaginaDeContatos | null = null
  let erro: string | null = null
  if (tinyConfigurado && busca.length >= 3) {
    const criterio = classificarBusca(busca)
    try {
      resultado = await pesquisarContatos(
        criterio?.tipo === 'cpfCnpj'
          ? { cpfCnpj: criterio.valor, pagina }
          : { pesquisa: busca, pagina },
      )
    } catch (e) {
      if (!(e instanceof ErroDoTiny)) throw e
      erro = e.message
    }
  }

  const [naFila, recentes] = await Promise.all([
    db.contatoTiny.count({ where: { envio: { in: ['pendente', 'processando'] } } }),
    db.contatoTiny.findMany({
      orderBy: [{ criadoEm: 'desc' }],
      take: 30,
      include: { criadoPor: { select: { nome: true } } },
    }),
  ])

  const linkDaPagina = (n: number) =>
    `/tiny/contatos?busca=${encodeURIComponent(busca)}${n > 1 ? `&pagina=${n}` : ''}` as Route

  return (
    <>
      <AtualizarEnquanto ativo={naFila > 0} intervaloMs={8000} />
      <CabecalhoDaPagina
        titulo="Contatos no Tiny"
        descricao="Os clientes cadastrados no Tiny: busque, edite, cadastre ou atualize vários de uma vez por planilha, sem gerar pedido."
        acoes={
          <>
            <Button variant="outline" asChild>
              <Link href="/tiny/contatos/importar">
                <FileUp aria-hidden="true" />
                Atualizar por planilha
              </Link>
            </Button>
            <Button asChild>
              <Link href="/tiny/contatos/novo">
                <Plus aria-hidden="true" />
                Novo contato
              </Link>
            </Button>
          </>
        }
      />

      <BarraDeFiltros>
        <FormDeFiltro acao="/tiny/contatos" className="flex flex-1 flex-wrap items-center gap-2">
          <Input
            name="busca"
            defaultValue={busca}
            placeholder="Nome ou CPF/CNPJ"
            aria-label="Buscar contato no Tiny"
            className="w-72"
          />
          <BotaoDeFiltro>Buscar</BotaoDeFiltro>
        </FormDeFiltro>
      </BarraDeFiltros>

      {!tinyConfigurado || erro ? (
        <div
          role="alert"
          className="border-warning/40 bg-warning/10 mb-6 flex gap-3 rounded-lg border p-4 text-sm"
        >
          <AlertTriangle className="text-warning mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>
            {erro ?? (
              <>
                <span className="font-semibold">O Tiny ainda não está ligado.</span> Falta o token
                em <code>TINY_API_TOKEN</code>, na Vercel.
              </>
            )}
          </p>
        </div>
      ) : null}

      {resultado && resultado.contatos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum contato encontrado"
          descricao="Confira o nome ou o documento. Quem ainda não existe no Tiny pode ser cadastrado aqui."
        />
      ) : null}

      {resultado && resultado.contatos.length > 0 ? (
        <div className="mb-8">
          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultado.contatos.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <span className="font-medium">{c.nome}</span>
                      {!c.ativo ? (
                        <Badge variant="muted" className="ml-2">
                          inativo
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="tabular-nums">{documento(c.cpfCnpj)}</TableCell>
                    <TableCell>
                      {c.endereco.cidade ? (
                        `${c.endereco.cidade}/${c.endereco.uf}`
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.email ?? ''}
                      {c.fone ? (
                        <span className="text-muted-foreground block tabular-nums">
                          {formatarTelefone(c.fone)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/tiny/contatos/${c.id}` as Route}>Editar</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {resultado.paginas > 1 ? (
            <nav
              aria-label="Páginas"
              className="mt-4 flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-muted-foreground tabular-nums">
                Página {resultado.pagina} de {resultado.paginas}
              </span>
              <span className="flex gap-2">
                {resultado.pagina > 1 ? (
                  <Button variant="outline" size="sm" asChild>
                    <LinkDeFiltro href={linkDaPagina(resultado.pagina - 1)}>Anterior</LinkDeFiltro>
                  </Button>
                ) : null}
                {resultado.pagina < resultado.paginas ? (
                  <Button variant="outline" size="sm" asChild>
                    <LinkDeFiltro href={linkDaPagina(resultado.pagina + 1)}>Próxima</LinkDeFiltro>
                  </Button>
                ) : null}
              </span>
            </nav>
          ) : null}
        </div>
      ) : null}

      <section aria-labelledby="fila-de-contatos">
        <h2 id="fila-de-contatos" className="font-display mb-3 text-lg font-semibold">
          Gravações no Tiny
          {naFila ? (
            <span className="text-muted-foreground ml-2 text-sm font-normal">{naFila} na fila</span>
          ) : null}
        </h2>
        {recentes.length === 0 ? (
          <EstadoVazio
            titulo="Nada gravado ainda"
            descricao="Cadastros, edições e planilhas de contatos aparecem aqui com o andamento de cada um."
          />
        ) : (
          <div className="bg-card overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Andamento</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <span className="font-medium">{c.nome}</span>
                      <span className="text-muted-foreground block text-xs tabular-nums">
                        {documento(c.cpfCnpj)} · {formatarDataHora(c.criadoEm)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.origem}
                      {c.linha ? (
                        <span className="text-muted-foreground"> · linha {c.linha}</span>
                      ) : null}
                      {c.criadoPor ? (
                        <span className="text-muted-foreground block text-xs">
                          {c.criadoPor.nome}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tomDoPedido(c.envio, null)}>
                        {c.envio === 'enviado'
                          ? c.resultado === 'incluido'
                            ? 'Incluído no Tiny'
                            : 'Alterado no Tiny'
                          : ROTULO_ENVIO[c.envio]}
                      </Badge>
                      {c.erro ? (
                        <p className="text-destructive mt-1 max-w-80 text-xs">{c.erro}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {c.envio === 'falhou' ? <BotaoReenviar id={c.id} contato /> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </>
  )
}
