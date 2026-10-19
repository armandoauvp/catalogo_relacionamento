import { db } from './db'

/**
 * Fotos de produto.
 *
 * O arquivo é gravado no Postgres, e não num bucket. A spec previa S3 e o
 * `env` reserva as variáveis, mas o V1 tem algumas dezenas de fotos e a área
 * precisa cadastrar produto no dia em que a ferramenta subir, esperar bucket
 * provisionado travaria justamente o que ela faz sozinha.
 *
 * A troca por bucket acontece aqui dentro e em nenhum outro lugar: `fotoUrl`
 * continua sendo uma URL e as telas não sabem de onde ela vem.
 */

export const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const
export type TipoDeImagem = (typeof TIPOS_ACEITOS)[number]

/**
 * 4 MB: o que cabe numa requisição da Vercel, que recusa acima de 4,5 MB. A
 * tabela aceita até 5 MB (CHECK constraint), então este é o teto que vale.
 */
export const TAMANHO_MAXIMO = 4 * 1024 * 1024

export type ResultadoDoUpload = { ok: true; url: string } | { ok: false; erro: string }

function ehTipoAceito(tipo: string): tipo is TipoDeImagem {
  return (TIPOS_ACEITOS as readonly string[]).includes(tipo)
}

export async function salvarFoto(arquivo: File, usuarioId: string): Promise<ResultadoDoUpload> {
  if (!ehTipoAceito(arquivo.type)) {
    return { ok: false, erro: 'Envie uma imagem JPEG, PNG, WebP ou AVIF.' }
  }
  if (arquivo.size === 0) {
    return { ok: false, erro: 'O arquivo chegou vazio. Tente enviar de novo.' }
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return { ok: false, erro: 'A imagem passa de 4 MB. Reduza antes de enviar.' }
  }

  const dados = Buffer.from(await arquivo.arrayBuffer())

  const salvo = await db.arquivo.create({
    data: {
      nome: arquivo.name.slice(0, 200) || 'foto',
      tipo: arquivo.type,
      tamanho: dados.byteLength,
      dados,
      criadoPor: usuarioId,
    },
    select: { id: true },
  })

  return { ok: true, url: `/api/arquivos/${salvo.id}` }
}

/** URL que esta ferramenta serve, o que pode ser apagado junto com o produto. */
export function ehArquivoInterno(url: string | null | undefined): boolean {
  return Boolean(url?.startsWith('/api/arquivos/'))
}

/**
 * Lê a foto do formulário.
 *
 * São dois caminhos no mesmo campo: o arquivo enviado agora, que é gravado e
 * vira URL, ou a URL que já estava lá, inclusive vazia, quando a pessoa
 * removeu a foto.
 */
export async function fotoDoFormulario(
  dados: FormData,
  usuarioId: string,
): Promise<{ ok: true; url: string | null } | { ok: false; erro: string }> {
  const arquivo = dados.get('foto')

  if (arquivo instanceof File && arquivo.size > 0) {
    const salvo = await salvarFoto(arquivo, usuarioId)
    if (!salvo.ok) return { ok: false, erro: salvo.erro }
    return { ok: true, url: salvo.url }
  }

  const atual = String(dados.get('fotoUrl') ?? '').trim()
  return { ok: true, url: atual || null }
}
