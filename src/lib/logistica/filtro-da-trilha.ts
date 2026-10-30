import { FaseOperacional, OrigemDemanda, PrioridadeDemanda, type Prisma } from '@prisma/client'
import { z } from 'zod'
import { ORDENS_DA_TRILHA } from './demandas'

/**
 * O recorte da trilha de demandas pelo clique nos grupos da linha: fase,
 * prioridade, subsidiária, departamento, presente e recorrência. Vale só para
 * a trilha e a exportação dela; os números e gráficos do painel continuam do
 * período inteiro, como a área pediu (decisão de 26/10/2026).
 *
 * A ordem mora na mesma URL, mas não é recorte: não esconde nada, então não
 * aparece entre os filtros ativos.
 *
 * Os nomes dos parâmetros não colidem com os do período (`periodo`, `ref`,
 * `de`, `ate`), que moram na mesma URL.
 */

export const filtroDaTrilhaSchema = z.object({
  fase: z.nativeEnum(FaseOperacional).optional().catch(undefined),
  prioridade: z.nativeEnum(PrioridadeDemanda).optional().catch(undefined),
  subsidiaria: z.string().trim().max(80).optional().catch(undefined),
  departamento: z.string().trim().max(80).optional().catch(undefined),
  origem: z.nativeEnum(OrigemDemanda).optional().catch(undefined),
  recorrente: z.enum(['sim']).optional().catch(undefined),
  ordem: z.enum(ORDENS_DA_TRILHA).optional().catch(undefined),
})

export type FiltroDaTrilha = z.output<typeof filtroDaTrilhaSchema>

/** As chaves do recorte, para o link da exportação levar o mesmo que a tela. */
export const CHAVES_DA_TRILHA = [
  'fase',
  'prioridade',
  'subsidiaria',
  'departamento',
  'origem',
  'recorrente',
] as const

export function whereDoRecorte(f: FiltroDaTrilha): Prisma.DemandaLogisticaWhereInput {
  return {
    ...(f.fase ? { fase: f.fase } : {}),
    ...(f.prioridade ? { prioridade: f.prioridade } : {}),
    ...(f.subsidiaria ? { subsidiaria: f.subsidiaria } : {}),
    ...(f.departamento ? { departamento: f.departamento } : {}),
    ...(f.origem ? { origem: f.origem } : {}),
    ...(f.recorrente ? { recorrente: true } : {}),
  }
}

export function temRecorte(f: FiltroDaTrilha): boolean {
  return CHAVES_DA_TRILHA.some((c) => f[c] !== undefined)
}

/** `fase=em_execucao&departamento=RH&ordem=pedido`, sem as chaves vazias. */
export function queryDoRecorte(f: FiltroDaTrilha): string {
  const q = new URLSearchParams()
  for (const chave of [...CHAVES_DA_TRILHA, 'ordem'] as const) {
    const valor = f[chave]
    if (valor) q.set(chave, valor)
  }
  return q.toString()
}
