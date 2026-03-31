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

export interface CategoryNode {
  id: number
  name: string
  parent_id: number | null
}

export function buildReportData(transactions: Transaction[], months: string[], categories?: CategoryNode[]): ReportData {
  const entradas = transactions.filter(t => t.amount > 0)
  const saidas = transactions.filter(t => t.amount < 0)

  return {
    months,
    entradas: buildCategoryRowsWithHierarchy(entradas, months, categories),
    saidas: buildCategoryRowsWithHierarchy(saidas, months, categories),
    totalEntradas: somarPorMes(entradas, months),
    totalSaidas: somarPorMes(saidas, months),
    saldo: calcularSaldo(entradas, saidas, months),
  }
}

function buildCategoryRowsWithHierarchy(transactions: Transaction[], months: string[], categories?: CategoryNode[]): ReportCategoryRow[] {
  const rows: ReportCategoryRow[] = []

  // if categories provided, use them to build a tree and use category_id to assign txs
  const catById = new Map<number, CategoryNode>()
  const childrenMap = new Map<number | null, number[]>()
  if (categories) {
    categories.forEach(c => {
      catById.set(c.id, c)
      const p = c.parent_id ?? null
      if (!childrenMap.has(p)) childrenMap.set(p, [])
      childrenMap.get(p)!.push(c.id)
    })
  }

  const txsByCategory = new Map<number | 'none', Transaction[]>()
  transactions.forEach(t => {
    const cid = t.category_id ?? null
    if (cid && catById.has(cid)) {
      if (!txsByCategory.has(cid)) txsByCategory.set(cid, [])
      txsByCategory.get(cid)!.push(t)
    } else {
      // try to match by name if no category_id
      const name = (t.category && t.category !== '') ? t.category : (t as any).category_name ?? ''
      let matched = false
      if (categories && name) {
        for (const c of categories) {
          if (c.name.toLowerCase() === name.toLowerCase()) {
            if (!txsByCategory.has(c.id)) txsByCategory.set(c.id, [])
            txsByCategory.get(c.id)!.push(t)
            matched = true
            break
          }
        }
      }
      if (!matched) {
        if (!txsByCategory.has('none')) txsByCategory.set('none', [])
        txsByCategory.get('none')!.push(t)
      }
    }
  })

  function pushSimpleRow(catName: string, catId: number | null, txs: Transaction[]) {
    rows.push({
      categoryId: catId,
      categoryName: catName,
      parentId: null,
      parentName: null,
      isParent: false,
      isTotal: false,
      parentKey: null,
      totals: somarPorMes(txs, months),
      grandTotal: txs.reduce((s, t) => s + t.amount, 0),
    })
  }

  if (categories) {
    // process roots
    const roots = childrenMap.get(null) || []
    for (const rid of roots) {
      const root = catById.get(rid)!
      const childIds = childrenMap.get(rid) || []

      // collect all txs for this root and its children
      const allTxs: Transaction[] = []
      if (txsByCategory.has(rid)) allTxs.push(...(txsByCategory.get(rid) || []))
      childIds.forEach(cid => { if (txsByCategory.has(cid)) allTxs.push(...(txsByCategory.get(cid) || [])) })

      if (childIds.length === 0) {
        // no children: show as simple row
        if (allTxs.length > 0) pushSimpleRow(root.name, root.id, allTxs)
      } else {
        // parent row
        rows.push({ categoryId: null, categoryName: root.name, parentId: root.parent_id ?? null, parentName: null, isParent: true, isTotal: false, parentKey: `p_${root.id}`, totals: {}, grandTotal: 0 })

        // child rows
        for (const cid of childIds) {
          const cnode = catById.get(cid)!
          const txs = txsByCategory.get(cid) ?? []
          if (txs.length > 0) rows.push({ categoryId: cnode.id, categoryName: cnode.name, parentId: cnode.parent_id ?? null, parentName: root.name, isParent: false, isTotal: false, parentKey: `p_${root.id}`, totals: somarPorMes(txs, months), grandTotal: txs.reduce((a, t) => a + t.amount, 0) })
        }

        // total row (if any txs)
        if (allTxs.length > 0) rows.push({ categoryId: null, categoryName: `Total — ${root.name}`, parentId: null, parentName: null, isParent: false, isTotal: true, parentKey: `p_${root.id}`, totals: somarPorMes(allTxs, months), grandTotal: allTxs.reduce((a, t) => a + t.amount, 0) })
      }
    }

    // handle transactions without category or categories not in tree
    const noneTxs = txsByCategory.get('none') ?? []
    if (noneTxs.length > 0) {
      // put under 'Sem Categoria' parent
      rows.push({ categoryId: null, categoryName: 'Sem Categoria', parentId: null, parentName: null, isParent: true, isTotal: false, parentKey: 'p_none', totals: {}, grandTotal: 0 })
      rows.push({ categoryId: null, categoryName: 'Sem Categoria', parentId: null, parentName: 'Sem Categoria', isParent: false, isTotal: false, parentKey: 'p_none', totals: somarPorMes(noneTxs, months), grandTotal: noneTxs.reduce((a, t) => a + t.amount, 0) })
      rows.push({ categoryId: null, categoryName: `Total — Sem Categoria`, parentId: null, parentName: null, isParent: false, isTotal: true, parentKey: 'p_none', totals: somarPorMes(noneTxs, months), grandTotal: noneTxs.reduce((a, t) => a + t.amount, 0) })
    }

  } else {
    // fallback: group by provided category string/name
    const map = new Map<string, Transaction[]>()
    transactions.forEach(t => {
      const name = (t.category && t.category !== '') ? t.category : (t as any).category_name ?? 'Sem Categoria'
      if (!map.has(name)) map.set(name, [])
      map.get(name)!.push(t)
    })
    map.forEach((txs, name) => pushSimpleRow(name, null, txs))
  }

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
