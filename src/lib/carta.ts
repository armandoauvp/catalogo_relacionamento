import { MotivoEnvio } from '@prisma/client'

/**
 * A carta que vai junto do presente.
 *
 * A área escreve uma carta por envio, e a maioria delas repete a mesma
 * estrutura: uma saudação pelo primeiro nome, o recado do motivo, e a
 * assinatura de quem mandou. O que muda de verdade é o meio.
 *
 * Por isso duas coisas moram aqui: os modelos que o consultor usa como ponto
 * de partida, e a montagem da folha que ele vê antes de enviar. A impressão
 * continua sendo feita fora do sistema (ver `docs/05-perguntas-em-aberto.md`),
 * mas o que a pessoa lê na tela precisa ser a carta inteira, e não só o campo
 * de texto: é lendo a saudação junto do corpo que se percebe que o nome ficou
 * errado ou que a mensagem começa repetindo o "Olá".
 */

/** O nome pelo qual se trata alguém numa carta. */
export function primeiroNome(nomeCompleto: string): string {
  const limpo = nomeCompleto.trim().replace(/\s+/g, ' ')
  if (!limpo) return ''

  const primeiro = limpo.split(' ')[0]!

  // "de", "da", "dos" nunca são o primeiro nome de ninguém, mas podem ser a
  // primeira palavra quando o cadastro veio invertido ("de Souza, Ana").
  if (primeiro.length <= 3 && /^(de|da|do|das|dos|e)$/i.test(primeiro)) {
    return limpo.split(' ')[1] ?? primeiro
  }

  return primeiro
}

/**
 * Modelos por motivo.
 *
 * São ponto de partida, não texto final: o consultor escolhe e edita. Moram
 * no banco (`ModeloCarta`) e a área os ajusta em Administração → Modelos de
 * carta, sem deploy. O `{nome}` é substituído pelo primeiro nome do cliente
 * na hora de aplicar.
 */
export type ModeloDeCarta = { id: string; motivo: MotivoEnvio; texto: string }

/**
 * O que impede gravar um modelo, ou nulo se ele pode ir.
 *
 * O marcador errado é o erro que mais escapa: "{Nome}" ou "{cliente}" não são
 * trocados por nada e chegariam assim na folha impressa. Por isso qualquer
 * chave que não seja exatamente `{nome}` é recusada aqui, antes de virar
 * sugestão para todo mundo.
 */
export function problemaDoModelo(texto: string): string | null {
  const limpo = texto.trim()
  if (!limpo) return 'Escreva o texto do modelo.'
  if (limpo.length > LIMITE_DA_MENSAGEM) {
    return `O modelo passa de ${LIMITE_DA_MENSAGEM} caracteres, o que cabe numa carta.`
  }

  // Tirados os `{nome}`, qualquer chave que sobre está errada.
  const errado = limpo.replaceAll('{nome}', '').match(/\{[^}]*\}?|\}/u)?.[0]
  if (errado) {
    return `"${errado}" não é trocado por nada. Para o primeiro nome do cliente, use {nome}.`
  }
  return null
}

/** Troca o `{nome}` do modelo pelo primeiro nome de quem recebe. */
export function aplicarModelo(modelo: string, nomeDoCliente: string): string {
  const nome = primeiroNome(nomeDoCliente)
  // Sem nome cadastrado, "Oi, {nome}!" viraria "Oi, !". Melhor cortar a
  // saudação e deixar a frase começar no recado.
  if (!nome) return modelo.replace(/^[^{]*\{nome\}[,!.\s]*/u, '').trim()
  return modelo.replaceAll('{nome}', nome)
}

export type DadosDaCarta = {
  /** Quem recebe, como escrito na entrega. */
  destinatario: string
  motivo: MotivoEnvio
  motivoOutro: string
  mensagem: string
  /** Quem assina: o consultor que está pedindo. */
  remetente: string
}

export type PreviaDaCarta = {
  saudacao: string
  corpo: string
  assinatura: string
  /** O motivo por extenso, para o cabeçalho da folha. */
  ocasiao: string
}

/** O motivo como a carta o nomeia: "Outro" vira o que a pessoa escreveu. */
export function ocasiaoDaCarta(motivo: MotivoEnvio, motivoOutro: string): string {
  if (motivo !== MotivoEnvio.outro) return ROTULO_DA_OCASIAO[motivo]
  return motivoOutro.trim() || 'Uma lembrança'
}

const ROTULO_DA_OCASIAO: Record<MotivoEnvio, string> = {
  aniversario: 'Aniversário',
  casamento: 'Casamento',
  nascimento: 'Nascimento',
  reforco_relacionamento: 'Um obrigado',
  primeiro_milhao: 'Primeiro milhão',
  outro: 'Uma lembrança',
}

/**
 * Monta a folha como ela será lida.
 *
 * A saudação some quando a primeira frase já chama a pessoa pelo nome. Não é
 * só o "Oi, Marina": "Feliz aniversário, Marina!" também já cumprimenta, e
 * imprimir "Olá, Marina," logo acima disso repete o nome duas vezes em duas
 * linhas. Por isso a checagem é a frase inteira, e não o começo dela.
 */
export function previaDaCarta(dados: DadosDaCarta): PreviaDaCarta {
  const nome = primeiroNome(dados.destinatario)
  const corpo = dados.mensagem.trim()

  // A primeira frase: até o primeiro ponto final, de exclamação ou de
  // interrogação. Sem pontuação nenhuma, a mensagem inteira é uma frase só.
  const primeiraFrase = corpo.split(/[.!?]/, 1)[0] ?? ''
  const jaCumprimenta =
    nome.length > 0 && new RegExp(`\\b${escapar(nome)}\\b`, 'iu').test(primeiraFrase)

  return {
    saudacao: !nome || jaCumprimenta ? '' : `Olá, ${nome},`,
    corpo,
    assinatura: dados.remetente.trim(),
    ocasiao: ocasiaoDaCarta(dados.motivo, dados.motivoOutro),
  }
}

const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Quanto cabe numa carta.
 *
 * Não é limite do banco, é limite de folha: a carta é impressa num cartão
 * pequeno, e um texto muito longo sai em corpo ilegível ou não sai. O número
 * veio da carta mais longa que a área já mandou, com folga.
 */
export const LIMITE_DA_MENSAGEM = 600

/** Quanto ainda cabe, e se já passou. */
export function espacoRestante(mensagem: string): { restam: number; excedeu: boolean } {
  const restam = LIMITE_DA_MENSAGEM - mensagem.length
  return { restam, excedeu: restam < 0 }
}
