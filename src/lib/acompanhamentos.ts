/**
 * Presentes que não podem ir sozinhos.
 *
 * Regra da área: alguns itens do catálogo acompanham uma bebida. A caixa de
 * madeira, o kit de queijos e o kit com abridor existem para embalar um vinho,
 * e sozinhos chegam ao cliente pela metade. O nome deles na planilha já diz
 * isso: "Escolha o vinho".
 *
 * O pareamento é por rótulo, e não por produto: o kit declara que precisa de
 * `vinho` (`exigeAcompanhamento`) e cada garrafa declara que serve como `vinho`
 * (`serveComoAcompanhamento`). Assim a área acrescenta um vinho novo sem mexer
 * em nenhum kit, e amanhã pode existir um kit que peça `whisky` sem código
 * novo.
 *
 * Quem satisfaz é sempre item de catálogo. Presente específico é texto livre:
 * não dá para afirmar que "uma garrafa de tinto" é o vinho que o kit pede, e
 * uma trava que se contorna digitando qualquer coisa não é uma trava.
 */

export type ItemParaAcompanhamento = {
  produtoId: string | null
  produto?: {
    nome: string
    exigeAcompanhamento: string | null
    serveComoAcompanhamento: string | null
  } | null
}

/** Uma exigência não atendida, com os produtos que a pediram. */
export type Pendencia = {
  /** O rótulo pedido, como `vinho`. */
  exigencia: string
  /** Nomes dos produtos que dependem dele, para a tela poder dizer quais. */
  produtos: string[]
}

export function acompanhamentosFaltando(itens: readonly ItemParaAcompanhamento[]): Pendencia[] {
  const oferecidos = new Set(
    itens
      .map((i) => i.produto?.serveComoAcompanhamento)
      .filter((rotulo): rotulo is string => Boolean(rotulo)),
  )

  const pendencias = new Map<string, string[]>()

  for (const item of itens) {
    const exigencia = item.produto?.exigeAcompanhamento
    if (!exigencia || oferecidos.has(exigencia)) continue

    const nomes = pendencias.get(exigencia) ?? []
    // Dois kits iguais na mesma solicitação não viram duas linhas de aviso.
    if (!nomes.includes(item.produto!.nome)) nomes.push(item.produto!.nome)
    pendencias.set(exigencia, nomes)
  }

  return [...pendencias.entries()].map(([exigencia, produtos]) => ({ exigencia, produtos }))
}

/**
 * A frase que a tela mostra. Fica aqui, e não na tela, porque a mesma frase
 * aparece no formulário do consultor e no erro que a server action devolve.
 */
export function mensagemDePendencia(pendencias: readonly Pendencia[]): string | null {
  if (pendencias.length === 0) return null

  const partes = pendencias.map(({ exigencia, produtos }) => {
    const lista =
      produtos.length === 1
        ? `“${produtos[0]}”`
        : `${produtos
            .slice(0, -1)
            .map((n) => `“${n}”`)
            .join(', ')} e “${produtos.at(-1)}”`
    const verbo = produtos.length === 1 ? 'precisa' : 'precisam'
    return `${lista} ${verbo} de um ${exigencia} na mesma solicitação`
  })

  return `${partes.join('; ')}. Escolha no catálogo antes de continuar.`
}

/**
 * Garrafa cadastrada pela tela sem dizer que serve como vinho: o kit não a
 * reconhece e a solicitação trava (SOL-2026-0029, 26/11/2026). O nome é só
 * um palpite para avisar quem cadastra; a regra continua sendo o rótulo.
 */
export function pareceVinhoSemRotulo(p: {
  nome: string
  exigeAcompanhamento: string | null
  serveComoAcompanhamento: string | null
}): boolean {
  if (p.exigeAcompanhamento?.trim() || p.serveComoAcompanhamento?.trim()) return false
  return /^vinhos?\b/i.test(p.nome.trim())
}
