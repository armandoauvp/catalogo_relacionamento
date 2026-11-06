/**
 * Empresas e departamentos que a demanda escolhe numa lista (pedido da área de
 * 05/11): os mesmos do formulário do Financeiro, para a trilha e o fechamento
 * falarem a mesma língua dele. Antes eram texto livre com sugestão, e a mesma
 * subsidiária aparecia com grafias diferentes no gráfico.
 *
 * A demanda antiga continua com o valor que tem, mesmo fora da lista: editar
 * outro campo não obriga a reclassificar, e nada é reescrito sem alguém pedir.
 */

/** "Qual empresa realizará o pagamento?", na ordem do formulário. */
export const SUBSIDIARIAS = [
  'Holding: Supernova',
  'AUVP Assessoria',
  'AUVP Corban',
  'AUVP Corretora de Seguros',
  'DNS',
  'AUVP Consultoria',
  'The Brain',
] as const

export const DEPARTAMENTOS = [
  'Atendimento e CX',
  'AUVP Seguros',
  'Capital Humano',
  'Consultoria e Investimentos',
  'Conteúdo',
  'Controladoria e Finanças',
  'Facilities',
  'Controle de Qualidade',
  'Departamento Pessoal',
  'Diretoria',
  'Infra',
  'Jurídico',
  'Novos Negócios',
  'Produção Audiovisual',
  'Produto',
  'Produto e Tecnologia',
  'Publicidade',
  'Tecnologia e Desenvolvimento',
  'Treinamentos',
] as const

/** As opções do campo: a lista, mais o valor que a demanda já tem, se for de fora. */
export function opcoesDoCampo(
  lista: readonly string[],
  atual: string | null | undefined,
): { valor: string; foraDaLista: boolean }[] {
  const opcoes = lista.map((valor) => ({ valor, foraDaLista: false }))
  return atual && !lista.includes(atual) ? [{ valor: atual, foraDaLista: true }, ...opcoes] : opcoes
}

/**
 * Por que a classificação não pode ser gravada, ou nulo. Vale o que está na
 * lista, ou o que a demanda já tinha: é a mesma regra das opções da tela,
 * conferida de novo no servidor.
 */
export function problemaDaClassificacao(
  nova: { subsidiaria: string; departamento: string },
  atual: { subsidiaria: string | null; departamento: string | null } | null,
): { campo: 'subsidiaria' | 'departamento'; erro: string } | null {
  const vale = (lista: readonly string[], valor: string, anterior: string | null | undefined) =>
    lista.includes(valor) || valor === anterior
  if (!vale(SUBSIDIARIAS, nova.subsidiaria, atual?.subsidiaria)) {
    return { campo: 'subsidiaria', erro: 'Escolha a empresa na lista.' }
  }
  if (!vale(DEPARTAMENTOS, nova.departamento, atual?.departamento)) {
    return { campo: 'departamento', erro: 'Escolha o departamento na lista.' }
  }
  return null
}
