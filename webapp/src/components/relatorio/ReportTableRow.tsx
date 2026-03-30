import { ReportCategoryRow } from '@/lib/utils/report'
import { formatVal } from '@/lib/utils/report'
import { cn } from '@/lib/utils'

export function ValCell({ value, bold }: { value: number; bold?: boolean }) {
  if (value === 0) return (
    <td className={cn("px-3 py-1.5 text-right font-mono text-xs text-muted-foreground/40", bold && "font-medium")}>—</td>
  )
  return (
    <td className={cn("px-3 py-1.5 text-right font-mono text-xs text-foreground", bold && "font-medium")}>
      {formatVal(value)}
    </td>
  )
}

export function CategoryRow({ row, months, expanded, onToggle }: { row: ReportCategoryRow; months: string[]; expanded?: boolean; onToggle?: (key: string) => void }) {
  if (row.isParent) {
    return (
      <tr className="bg-muted/40">
        <td colSpan={months.length + 2} className="px-3 py-1.5 text-xs font-medium text-foreground truncate">
          <button onClick={() => row.parentKey && onToggle?.(row.parentKey)} className="flex items-center gap-2">
            <span className="text-2xs">{expanded ? '▾' : '▸'}</span>
            <span>{row.categoryName}</span>
          </button>
        </td>
      </tr>
    )
  }

  if (row.isTotal) {
    return (
      <tr className="border-t border-b border-border bg-muted/30">
        <td className="px-3 py-1.5 text-xs font-medium text-foreground truncate">{row.categoryName}</td>
        <ValCell value={row.grandTotal} bold />
        {months.map(m => <ValCell key={m} value={row.totals[m] ?? 0} bold />)}
      </tr>
    )
  }

  return (
    <tr className="hover:bg-muted/30 transition-colors border-b border-border/50">
      <td className={cn("px-3 py-1.5 text-xs text-muted-foreground truncate", row.parentName ? "pl-6" : "pl-3")}>{row.categoryName}</td>
      <ValCell value={row.grandTotal} />
      {months.map(m => <ValCell key={m} value={row.totals[m] ?? 0} />)}
    </tr>
  )
}

export function SectionHeader({ label, color, months }: { label: string; color: string; months: string[] }) {
  return (
    <tr className="border-t border-border">
      <td colSpan={months.length + 2} className={cn("px-3 py-2 text-2xs font-semibold uppercase tracking-wider", color)}>{label}</td>
    </tr>
  )
}

export function TotalRow({ label, totals, months, color, bg }: { label: string; totals: Record<string,number>; months: string[]; color: string; bg: string }) {
  const grandTotal = Object.values(totals).reduce((a,b) => a+b, 0)
  return (
    <tr className={cn("border-t border-border", bg)}>
      <td className={cn("px-3 py-2 text-xs font-semibold truncate", color)}>{label}</td>
      <td className={cn("px-3 py-2 text-right font-mono text-xs font-semibold", color)}>{formatVal(grandTotal)}</td>
      {months.map(m => (
        <td key={m} className={cn("px-3 py-2 text-right font-mono text-xs font-semibold", color)}>{(totals[m] ?? 0) === 0 ? '—' : formatVal(totals[m] ?? 0)}</td>
      ))}
    </tr>
  )
}
