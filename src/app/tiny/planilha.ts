import { tabelaDoCsv } from '@/lib/importacao-clientes'

/**
 * Planilhas no navegador: ler o .xlsx ou .csv que a pessoa escolheu e baixar
 * um modelo. Usado pela importação de lote e pela de contatos.
 */

/** A planilha como tabela de texto, linha a linha na mesma posição do Excel. */
export async function lerArquivo(arquivo: File): Promise<string[][]> {
  if (/\.csv$/i.test(arquivo.name)) return tabelaDoCsv(await arquivo.text())

  const ExcelJS = (await import('exceljs')).default
  const livro = new ExcelJS.Workbook()
  await livro.xlsx.load(await arquivo.arrayBuffer())
  const aba = livro.worksheets[0]
  if (!aba) return []
  const tabela: string[][] = Array.from({ length: aba.rowCount }, () => [])
  aba.eachRow({ includeEmpty: false }, (linha, numero) => {
    // `text` é o que o Excel mostra: resolve fórmula, texto rico e data, que
    // `String(valor)` transformaria em "[object Object]".
    tabela[numero - 1] = Array.from(
      { length: aba.columnCount },
      (_, i) => linha.getCell(i + 1).text ?? '',
    )
  })
  return tabela
}

/** CSV com ponto e vírgula e BOM: o Excel brasileiro abre com acento e colunas certas. */
export function baixarCsv(nome: string, linhas: readonly (readonly string[])[]) {
  const csv =
    '﻿' + linhas.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}
