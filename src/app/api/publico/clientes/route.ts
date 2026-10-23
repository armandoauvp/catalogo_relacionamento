import { NextResponse } from 'next/server'
import { gravarCadastroDoSite } from '@/lib/clientes'
import { env } from '@/lib/env'
import { bearerConfere } from '@/lib/segredo'
import { cadastroDoSiteSchema } from '@/lib/validators/cliente'

/**
 * Cadastro de cliente vindo do site da AUVP, o que o AUVP-Eventos recebia em
 * `/api/public/cadastro`, com duas diferenças de propósito:
 *
 * - exige `Authorization: Bearer <CADASTRO_SITE_CHAVE>`. Deve ser chamado do
 *   servidor do site, nunca do navegador: no navegador a chave fica à vista;
 * - não existe consulta por CPF. Lá ela devolvia os dados de qualquer pessoa
 *   a quem soubesse o CPF.
 *
 * A resposta diz só o id e se o cadastro é novo; nenhum dado pessoal volta.
 */

export const dynamic = 'force-dynamic'

/** Chave curta é adivinhável: abaixo disto a rota não liga. */
const TAMANHO_MINIMO_DA_CHAVE = 24

export async function POST(req: Request) {
  if (env.CADASTRO_SITE_CHAVE.length < TAMANHO_MINIMO_DA_CHAVE) {
    return NextResponse.json({ erro: 'O cadastro pelo site não está ligado.' }, { status: 503 })
  }
  if (!bearerConfere(req.headers.get('authorization'), env.CADASTRO_SITE_CHAVE)) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  const corpo = await req.json().catch(() => null)
  const validado = cadastroDoSiteSchema.safeParse(corpo)
  if (!validado.success) {
    const primeiro = validado.error.issues[0]
    return NextResponse.json(
      { erro: primeiro?.message ?? 'Dados inválidos.', campo: primeiro?.path.join('.') },
      { status: 422 },
    )
  }

  const { id, criado } = await gravarCadastroDoSite(validado.data)
  return NextResponse.json({ id, criado }, { status: criado ? 201 : 200 })
}
