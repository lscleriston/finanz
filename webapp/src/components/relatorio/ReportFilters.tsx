import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  onApply: (params: { dateFrom: string; dateTo: string; includeTransfers: boolean }) => void
}

export function ReportFilters({ onApply }: Props) {
  const now = new Date()
  const ymAgo = new Date(now.getFullYear(), now.getMonth() - 4, 1)

  const [dateFrom, setDateFrom] = useState(formatDateInput(ymAgo))
  const [dateTo, setDateTo] = useState(formatDateInput(now))
  const [includeTransfers, setIncludeTransfers] = useState(false)

  function handleApply() {
    onApply({ dateFrom: parseInputDate(dateFrom), dateTo: parseInputDate(dateTo), includeTransfers })
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-muted/30 shrink-0">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Período</span>
      <Input value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="DD/MM/AAAA" className="h-8 text-xs font-mono w-32" />
      <span className="text-xs text-muted-foreground">até</span>
      <Input value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="DD/MM/AAAA" className="h-8 text-xs font-mono w-32" />
      <Button size="sm" className="h-8 text-xs" onClick={handleApply}>Aplicar</Button>

      <div className="flex items-center gap-4 ml-auto">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Transferências</span>
        <div className="flex gap-4">
          {[{ label: 'Nenhuma', value: false }, { label: 'Todas', value: true }].map(opt => (
            <label key={String(opt.value)} className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground">
              <div onClick={() => setIncludeTransfers(opt.value)} className="w-3 h-3 rounded-full border-2 flex items-center justify-center cursor-pointer" style={{ borderColor: includeTransfers === opt.value ? '#1D9E75' : 'var(--color-border-secondary)', background: includeTransfers === opt.value ? '#1D9E75' : 'transparent' }} />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatDateInput(date: Date): string {
  return date.toLocaleDateString('pt-BR')
}

function parseInputDate(str: string): string {
  const [d, m, y] = str.split('/')
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}
