/**
 * O saldo é apurado por mês corrente e a exportação filtra por período, então
 * os limites do intervalo precisam ser calculados num lugar só.
 *
 * O banco guarda UTC. As datas visíveis ao usuário são de São Paulo. Sem essa
 * conversão, uma solicitação criada às 22h do dia 31 cairia no mês seguinte.
 */

const FUSO = 'America/Sao_Paulo'

/** Partes ano/mês/dia de um instante, já no fuso de São Paulo. */
export function partesLocais(data: Date): { ano: number; mes: number; dia: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [ano, mes, dia] = fmt.format(data).split('-').map(Number)
  return { ano: ano!, mes: mes!, dia: dia! }
}

/**
 * Deslocamento do fuso em minutos para o instante dado.
 * Calculado a partir do próprio Intl, e não fixado em -3, para que o
 * eventual retorno do horário de verão não exija mudança de código.
 */
function offsetEmMinutos(data: Date): number {
  const utc = new Date(data.toLocaleString('en-US', { timeZone: 'UTC' }))
  const local = new Date(data.toLocaleString('en-US', { timeZone: FUSO }))
  return (utc.getTime() - local.getTime()) / 60_000
}

/** Meia-noite de São Paulo no dia dado, como instante UTC. */
export function instanteLocal(ano: number, mes: number, dia: number): Date {
  const palpite = new Date(Date.UTC(ano, mes - 1, dia, 0, 0, 0, 0))
  return new Date(palpite.getTime() + offsetEmMinutos(palpite) * 60_000)
}

/** Intervalo [inicio, fim) do mês que contém a data, em instantes UTC. */
export function intervaloDoMes(referencia: Date = new Date()): { inicio: Date; fim: Date } {
  const { ano, mes } = partesLocais(referencia)
  const inicio = instanteLocal(ano, mes, 1)
  const fim = mes === 12 ? instanteLocal(ano + 1, 1, 1) : instanteLocal(ano, mes + 1, 1)
  return { inicio, fim }
}

/** Ano corrente no fuso local, usado na numeração SOL-AAAA-NNNN. */
export function anoCorrente(referencia: Date = new Date()): number {
  return partesLocais(referencia).ano
}

export function formatarData(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'short' }).format(data)
}

export function formatarDataHora(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(data)
}

/** Formato estável para célula de planilha e nome de arquivo. */
export function formatarISO(data: Date): string {
  const { ano, mes, dia } = partesLocais(data)
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/**
 * O último instante de um dia do calendário de São Paulo, a partir do
 * `AAAA-MM-DD` de um `<input type="date">`.
 *
 * Previsão "15/10" quer dizer "até o fim do dia 15". Gravada como meia-noite,
 * a demanda passaria a contar como atrasada desde o começo do próprio dia
 * em que vence. Data impossível ou vazia volta nula.
 */
export function fimDoDiaLocal(diaIso: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(diaIso ?? '')
  if (!m) return null
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const conferido = new Date(Date.UTC(ano, mes - 1, dia))
  if (conferido.getUTCMonth() !== mes - 1 || conferido.getUTCDate() !== dia) return null
  const seguinte = new Date(Date.UTC(ano, mes - 1, dia + 1))
  return new Date(
    instanteLocal(
      seguinte.getUTCFullYear(),
      seguinte.getUTCMonth() + 1,
      seguinte.getUTCDate(),
    ).getTime() - 1,
  )
}
