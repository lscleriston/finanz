import { Transaction } from '@/lib/api'

export type ReportCategoryRow = {
  categoryId: number | null
  categoryName: string
  parentId: number | null
  parentName: string | null
  isParent: boolean
  isTotal: boolean
  totals: Record<string, number>
  grandTotal: number
}

export type ReportData = {
  months: string[]
  entradas: ReportCategoryRow[]
  saidas: ReportCategoryRow[]
  totalEntradas: Record<string, number>
  totalSaidas: Record<string, number>
  saldo: Record<string, number>
}

export function gerarMeses(dateFrom: string, dateTo: string): string[] {
  const meses: string[] = []
  const inicio = new Date(dateFrom + 'T12:00:00')
  const fim = new Date(dateTo + 'T12:00:00')
  const cur = new Date(inicio.getFullYear(), inicio.getMonth(), 1)

  while (cur <= fim) {
    meses.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`)
    cur.setMonth(cur.getMonth() + 1)
  }
  return meses
}

export function labelMes(mesKey: string): string {
  const [ano, mes] = mesKey.split('-')
  const d = new Date(Number(ano), Number(mes) - 1, 1)
  return d.toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '')
    .replace(/^\u0000?\w/, c => c.toUpperCase())
}

export function buildReportData(transactions: Transaction[], months: string[]): ReportData {
  const entradas = transactions.filter(t => t.amount > 0)
  const saidas = transactions.filter(t => t.amount < 0)

  return {
    months,
    entradas: buildCategoryRows(entradas, months),
    saidas: buildCategoryRows(saidas, months),
    totalEntradas: somarPorMes(entradas, months),
    totalSaidas: somarPorMes(saidas, months),
    saldo: calcularSaldo(entradas, saidas, months),
  }
}

function buildCategoryRows(transactions: Transaction[], months: string[]): ReportCategoryRow[] {
  const rows: ReportCategoryRow[] = []

  // Group by parent (if present) otherwise by category
  const map = new Map<string, { name: string; txs: Transaction[] }>()

  transactions.forEach(t => {
    const parentId = (t as any).parent_category_id ?? null
    const parentName = (t as any).parent_category_name ?? null
    const catId = t.category_id ?? null
    const catName = (t.category && t.category !== '') ? t.category : (t as any).category_name ?? 'Sem Categoria'

    const key = parentId ? `p_${parentId}` : `c_${catId ?? 'none'}_${catName}`
    if (!map.has(key)) map.set(key, { name: parentName ?? catName, txs: [] })
    map.get(key)!.txs.push(t)
  })

  // For now, treat each map entry as a simple group (no deep parent/sub rows)
  map.forEach((group, key) => {
    const txs = group.txs
    rows.push({
      categoryId: txs[0].category_id ?? null,
      categoryName: group.name,
      parentId: (txs[0] as any).parent_category_id ?? null,
      parentName: (txs[0] as any).parent_category_name ?? null,
      isParent: false,
      isTotal: false,
      totals: somarPorMes(txs, months),
      grandTotal: txs.reduce((s, t) => s + t.amount, 0),
    })
  })

  return rows
}

function somarPorMes(transactions: Transaction[], months: string[]): Record<string, number> {
  const result: Record<string, number> = {}
  months.forEach(m => { result[m] = 0 })
  transactions.forEach(t => {
    const mesKey = t.date.slice(0, 7)
    if (mesKey in result) result[mesKey] += t.amount
  })
  return result
}

function calcularSaldo(entradas: Transaction[], saidas: Transaction[], months: string[]): Record<string, number> {
  const e = somarPorMes(entradas, months)
  const s = somarPorMes(saidas, months)
  const result: Record<string, number> = {}
  months.forEach(m => { result[m] = (e[m] ?? 0) + (s[m] ?? 0) })
  return result
}

export function formatVal(value: number): string {
  if (value === 0) return '—'
  return Math.abs(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
