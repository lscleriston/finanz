import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart2 } from 'lucide-react'
import { ReportFilters } from '@/components/relatorio/ReportFilters'
import { ReportTable } from '@/components/relatorio/ReportTable'
import { fetchTransactionsAll, fetchCategories } from '@/lib/api'
import { gerarMeses, buildReportData } from '@/lib/utils/report'

type FilterParams = { dateFrom: string; dateTo: string; includeTransfers: boolean }

const DEFAULT_PARAMS: FilterParams = {
  dateFrom: (() => { const d = new Date(); d.setMonth(d.getMonth() - 4); d.setDate(1); return d.toISOString().slice(0,10) })(),
  dateTo: new Date().toISOString().slice(0,10),
  includeTransfers: false,
}

export default function Relatorio() {
  const [params, setParams] = useState<FilterParams>(DEFAULT_PARAMS)

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['report-transactions', params],
    queryFn: () => fetchTransactionsAll({ date_from: params.dateFrom, date_to: params.dateTo, include_transfers: params.includeTransfers }),
  })

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => fetchCategories() })

  const months = useMemo(() => gerarMeses(params.dateFrom, params.dateTo), [params])
  const reportData = useMemo(() => buildReportData(transactions, months, categories), [transactions, months, categories])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border shrink-0">
        <BarChart2 className="w-4 h-4 text-muted-foreground" />
        <h1 className="text-sm font-semibold">Relatório mensal</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        <ReportFilters onApply={setParams} />

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-xs text-muted-foreground">Calculando relatório...</p>
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart2 className="w-8 h-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Nenhuma transação no período</p>
            <p className="text-xs text-muted-foreground mt-1">Ajuste o período e clique em Aplicar</p>
          </div>
        ) : (
          <ReportTable data={reportData} />
        )}
      </div>
    </div>
  )
}
