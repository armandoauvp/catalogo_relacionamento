import type { TomDaNotificacao } from '@prisma/client'
import { formatarDataHora } from '@/lib/datas'
import { ehEntrega, type EventoLido } from './leitura'

/**
 * Os avisos que o rastreio dos Correios gera no sininho.
 *
 * Pedido da Lilian: o consultor fica sabendo de cada movimento do presente que
 * pediu, sem precisar abrir a solicitação. A entrega vem em verde; o que pede
 * ação (retirada na agência, tentativa sem sucesso, extravio, devolução) vem em
 * destaque e avisa também o Admin de Relacionamento, que acompanha o que deu
 * errado. O resto (postado, em transferência) é aviso comum.
 */

/**
 * O que pede alguém agir: o consultor avisar o cliente, ou a área reenviar.
 * Pela descrição, porque o código do evento depende de um formato que os
 * Correios não publicam.
 */
const PEDE_ACAO =
  /retirada|retirar|n[aã]o entregue|ausente|endere[cç]o (incorreto|insuficiente|inexistente)|extravi|roubad|devolvid|devolu[cç][aã]o|recusad|tentativa de entrega|n[aã]o procurado|carteiro n[aã]o atendido|aguardando pagamento|fiscaliza|avariad|danificad|sinistro/i

export function tomDoEvento(
  e: Pick<EventoLido, 'codigo' | 'tipo' | 'descricao'>,
): TomDaNotificacao {
  if (ehEntrega(e)) return 'entrega'
  if (PEDE_ACAO.test(e.descricao)) return 'alerta'
  return 'comum'
}

/** Evento mais velho que isto não vira aviso: é história, não notícia. */
export const IDADE_MAXIMA_DO_AVISO_MS = 7 * 86_400_000

/**
 * Quais dos eventos novos avisam. Na primeira consulta de um objeto chegam
 * todos os eventos de uma vez, e cinco avisos do mesmo presente seriam ruído:
 * vale só o mais recente. Depois, cada evento novo avisa.
 */
export function eventosParaAvisar<T extends Pick<EventoLido, 'ocorridoEm'>>(
  novos: readonly T[],
  primeiraConsulta: boolean,
  agora: Date,
): T[] {
  const recentes = novos.filter(
    (e) => agora.getTime() - e.ocorridoEm.getTime() <= IDADE_MAXIMA_DO_AVISO_MS,
  )
  if (!primeiraConsulta) return recentes
  const maisNovo = [...recentes].sort((a, b) => b.ocorridoEm.getTime() - a.ocorridoEm.getTime())[0]
  return maisNovo ? [maisNovo] : []
}

/** Um evento é o mesmo se tem o mesmo objeto, hora, código e tipo. */
export function chaveDoEvento(
  codigoObjeto: string,
  e: Pick<EventoLido, 'ocorridoEm' | 'codigo' | 'tipo'>,
): string {
  return `rastreio:${codigoObjeto}:${e.ocorridoEm.toISOString()}:${e.codigo}:${e.tipo}`
}

export function textoDoAviso(
  codigoSolicitacao: string,
  destinatario: string,
  e: Pick<EventoLido, 'codigo' | 'tipo' | 'descricao' | 'local' | 'ocorridoEm'>,
): { tom: TomDaNotificacao; titulo: string; texto: string } {
  const tom = tomDoEvento(e)
  const titulo =
    tom === 'entrega'
      ? `${codigoSolicitacao} foi entregue a ${destinatario}`
      : `${codigoSolicitacao}: ${e.descricao}`
  const texto = [
    tom === 'entrega' ? e.descricao : `Presente para ${destinatario}`,
    e.local,
    formatarDataHora(e.ocorridoEm),
  ]
    .filter(Boolean)
    .join(' · ')
  return { tom, titulo, texto }
}
