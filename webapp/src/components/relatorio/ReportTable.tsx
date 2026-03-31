import { useState, useEffect } from 'react'
import { ReportData, labelMes, formatVal } from '@/lib/utils/report'
import { SectionHeader, CategoryRow, TotalRow } from './ReportTableRow'
import { cn } from '@/lib/utils'

type Props = { data: ReportData }

export function ReportTable({ data }: Props) {
  const { months, entradas, saidas, totalEntradas, totalSaidas, saldo } = data
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  function toggleParent(key?: string | null) {
    if (!key) return
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function renderRows(rows: typeof entradas) {
    return rows.map((row, i) => {
      // child rows are shown only when their parent is expanded
      if (row.parentKey && !row.isParent && !row.isTotal) {
        if (!expanded[row.parentKey]) return null
      }
      return <CategoryRow key={i} row={row} months={months} expanded={Boolean(row.parentKey ? expanded[row.parentKey] : undefined)} onToggle={toggleParent} />
    })
  }

  // auto-expand parents when data changes to make report visible immediately
  useEffect(() => {
    const keys: Record<string, boolean> = {}
    ;[...data.entradas, ...data.saidas].forEach(r => {
      if (r.isParent && r.parentKey) keys[r.parentKey] = true
    })
    if (Object.keys(keys).length) setExpanded(keys)
  }, [data])

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr className="bg-muted border-b border-border">
            <th className="text-left px-3 py-2.5 text-2xs font-medium text-muted-foreground uppercase tracking-wide" style={{ width: '200px' }}>Categoria</th>
            <th className="text-right px-3 py-2.5 text-2xs font-medium text-muted-foreground uppercase tracking-wide" style={{ width: '90px' }}>Total</th>
            {months.map(m => (
              <th key={m} className="text-right px-3 py-2.5 text-2xs font-medium text-muted-foreground uppercase tracking-wide" style={{ width: '80px' }}>{labelMes(m)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <SectionHeader label="↑ Entradas" color="text-primary" months={months} />
          {renderRows(entradas)}
          <TotalRow label="Total — Entradas" totals={totalEntradas} months={months} color="text-primary" bg="bg-primary/5" />

          <SectionHeader label="↓ Saídas" color="text-destructive" months={months} />
          {renderRows(saidas)}
          <TotalRow label="Total — Saídas" totals={totalSaidas} months={months} color="text-destructive" bg="bg-destructive/5" />

          <tr className="border-t-2 border-border">
            <td className="px-3 py-2.5 text-sm font-semibold">Saldo</td>
            <td className="px-3 py-2.5 text-right font-mono text-sm font-semibold" style={{ color: Object.values(saldo).reduce((a,b) => a+b, 0) >= 0 ? '#1D9E75' : '#E24B4A' }}>{formatVal(Object.values(saldo).reduce((a,b) => a+b, 0))}</td>
            {months.map(m => (
              <td key={m} className="px-3 py-2.5 text-right font-mono text-sm font-semibold" style={{ color: (saldo[m] ?? 0) >= 0 ? '#1D9E75' : '#E24B4A' }}>{saldo[m] === 0 ? '—' : `${(saldo[m] ?? 0) >= 0 ? '+' : ''}${formatVal(saldo[m] ?? 0)}`}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
