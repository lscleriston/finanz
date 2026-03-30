import { Transaction } from '@/lib/api'

export type ReportCategoryRow = {
  categoryId: number | null
  categoryName: string
  parentId: number | null
  parentName: string | null
  isParent: boolean
  isTotal: boolean
  parentKey?: string | null
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

  // Group by parent -> subcategory
  const porPai = new Map<string, { parentId: number | null; parentName: string | null; subs: Map<string, { catId: number | null; catName: string; txs: Transaction[] }> }>()

  transactions.forEach(t => {
    const parentId = (t as any).parent_category_id ?? null
    const parentName = (t as any).parent_category_name ?? null
    const catId = t.category_id ?? null
    const catName = (t.category && t.category !== '') ? t.category : (t as any).category_name ?? 'Sem Categoria'

    const parentKey = parentId ? `p_${parentId}` : `solo_${catId ?? 'none'}`
    if (!porPai.has(parentKey)) porPai.set(parentKey, { parentId, parentName: parentName ?? catName, subs: new Map() })

    const grupo = porPai.get(parentKey)!
    const subKey = catId ? `s_${catId}` : `s_none_${catName}`
    if (!grupo.subs.has(subKey)) grupo.subs.set(subKey, { catId, catName, txs: [] })
    grupo.subs.get(subKey)!.txs.push(t)
  })

  porPai.forEach((grupo, parentKey) => {
    const subs = Array.from(grupo.subs.values())

    if (subs.length === 1 && parentKey.startsWith('solo_')) {
      // single category (no hierarchical parent) — render simple row
      const txs = subs[0].txs
      rows.push({
        categoryId: txs[0].category_id ?? null,
        categoryName: grupo.parentName,
        parentId: null,
        parentName: null,
        isParent: false,
        isTotal: false,
        parentKey: null,
        totals: somarPorMes(txs, months),
        grandTotal: txs.reduce((s, t) => s + t.amount, 0),
      })
    } else {
      // parent row
      const todasTxs: Transaction[] = []
      subs.forEach(s => todasTxs.push(...s.txs))

      rows.push({
        categoryId: null,
        categoryName: grupo.parentName ?? 'Sem Categoria',
        parentId: grupo.parentId ?? null,
        parentName: null,
        isParent: true,
        isTotal: false,
        parentKey,
        totals: {},
        grandTotal: 0,
      })

      // child rows
      subs.forEach(s => {
        const txs = s.txs
        rows.push({
          categoryId: txs[0].category_id ?? null,
          categoryName: s.catName,
          parentId: grupo.parentId ?? null,
          parentName: grupo.parentName ?? null,
          isParent: false,
          isTotal: false,
          parentKey,
          totals: somarPorMes(txs, months),
          grandTotal: txs.reduce((a, t) => a + t.amount, 0),
        })
      })

      // total row
      rows.push({
        categoryId: null,
        categoryName: `Total — ${grupo.parentName}`,
        parentId: null,
        parentName: null,
        isParent: false,
        isTotal: true,
        parentKey,
        totals: somarPorMes(todasTxs, months),
        grandTotal: todasTxs.reduce((a, t) => a + t.amount, 0),
      })
    }
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
