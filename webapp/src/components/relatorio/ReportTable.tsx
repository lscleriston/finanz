import { ReportData, labelMes, formatVal } from '@/lib/utils/report'
import { SectionHeader, CategoryRow, TotalRow } from './ReportTableRow'
import { cn } from '@/lib/utils'

type Props = { data: ReportData }

export function ReportTable({ data }: Props) {
  const { months, entradas, saidas, totalEntradas, totalSaidas, saldo } = data

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
          {entradas.map((row, i) => <CategoryRow key={i} row={row} months={months} />)}
          <TotalRow label="Total — Entradas" totals={totalEntradas} months={months} color="text-primary" bg="bg-primary/5" />

          <SectionHeader label="↓ Saídas" color="text-destructive" months={months} />
          {saidas.map((row, i) => <CategoryRow key={i} row={row} months={months} />)}
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
