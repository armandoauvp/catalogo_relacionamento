/**
 * Redução da foto no navegador, antes do envio.
 *
 * Foto de celular passa fácil de 4 MB, e a Vercel recusa qualquer requisição
 * acima de 4,5 MB antes de ela chegar à aplicação, com um erro que não diz
 * nada a quem está cadastrando. Reduzida aqui, ela chega com algumas centenas
 * de KB, e o catálogo, que mostra a foto pequena, não perde nada.
 *
 * Só a parte do navegador mora aqui; quem valida e grava é `arquivos.ts`.
 */

/** Lado maior da foto depois de reduzida: sobra para a moldura 3:4 do catálogo. */
const LADO_MAXIMO = 1600

/** Abaixo disto a foto vai como veio: reduzir não compensaria. */
const JA_E_LEVE = 600 * 1024

function codificar(canvas: HTMLCanvasElement, tipo: string): Promise<Blob | null> {
  return new Promise((resolver) => canvas.toBlob(resolver, tipo, 0.85))
}

/**
 * A foto reduzida, ou a original quando não dá para reduzir: arquivo que o
 * navegador não decodifica (HEIC fora do Safari, por exemplo) segue como está,
 * e o servidor diz o que fazer.
 */
export async function reduzirFoto(arquivo: File): Promise<File> {
  if (!arquivo.type.startsWith('image/') || arquivo.size <= JA_E_LEVE) return arquivo

  let imagem: ImageBitmap
  try {
    imagem = await createImageBitmap(arquivo)
  } catch {
    return arquivo
  }

  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(imagem.width * escala)
  canvas.height = Math.round(imagem.height * escala)
  canvas.getContext('2d')?.drawImage(imagem, 0, 0, canvas.width, canvas.height)
  imagem.close()

  // WebP quando o navegador codifica; o Safari antigo devolve PNG no lugar, e
  // aí JPEG é menor.
  let blob = await codificar(canvas, 'image/webp')
  if (!blob || blob.type !== 'image/webp') blob = await codificar(canvas, 'image/jpeg')
  if (!blob || blob.size >= arquivo.size) return arquivo

  const extensao = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const nome = arquivo.name.replace(/\.[^.]+$/, '') || 'foto'
  return new File([blob], `${nome}.${extensao}`, { type: blob.type })
}

/** Troca, no próprio formulário, o campo `foto` pela versão reduzida. */
export async function prepararFoto(dados: FormData, campo = 'foto'): Promise<void> {
  const arquivo = dados.get(campo)
  if (arquivo instanceof File && arquivo.size > 0) dados.set(campo, await reduzirFoto(arquivo))
}
