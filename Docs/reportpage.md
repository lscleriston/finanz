# Orientações — Tela de relatório mensal por categoria

Leia inteiro antes de escrever qualquer código.

---

## Contexto

Stack: Vite + React + TypeScript + TanStack Query v5 + shadcn/ui + Tailwind CSS.
Backend: FastAPI em `http://localhost:8011`.
Layout: manter sidebar dark + topbar do projeto. A tabela fica na área de conteúdo principal.

---

## O que a tela faz

Exibe um relatório pivot: linhas = categorias/subcategorias, colunas = meses do período selecionado.
O usuário define o período (data inicial e final), clica em "Aplicar" e vê:

1. Seção **Entradas** — categorias com valores positivos, mês a mês
2. Seção **Saídas** — categorias com valores negativos, mês a mês
3. Linha **Saldo** — entradas − saídas por mês, com cor verde (positivo) ou vermelho (negativo)

Cada categoria-pai que tem subcategorias mostra:
- Linha da categoria-pai (nome em destaque, sem valores próprios)
- Linhas das subcategorias indentadas
- Linha "Total — NomeCategoria" com a soma

Categorias sem subcategorias aparecem como linha simples sem indentação extra.

---

## Arquivo a criar

```
src/pages/Relatorio.tsx                   ← página principal
src/components/relatorio/
  ReportFilters.tsx                       ← filtro de período + toggle transferências
  ReportTable.tsx                         ← tabela pivot
  ReportTableRow.tsx                      ← linha individual (normal, total, saldo)
src/lib/utils/report.ts                   ← lógica de agrupamento e pivot
```

Adicionar rota em `src/App.tsx`:
```tsx
<Route path="/relatorio" element={<Relatorio />} />
```

Adicionar item no nav da sidebar:
```tsx
{ to: '/relatorio', label: 'Relatório', icon: BarChart2 }
```

---

## 1. Endpoint de API necessário

Verificar se existe em `api.py`. O relatório precisa de **todas as transações do período**, sem paginação.

```typescript
// src/lib/api.ts — adicionar se não existir
export async function fetchTransactionsAll(params: {
  date_from: string  // "2025-11-01"
  date_to:   string  // "2026-03-31"
  include_transfers?: boolean
}): Promise<Transaction[]> {
  const q = new URLSearchParams({
    date_from: params.date_from,
    date_to:   params.date_to,
    limit:     '9999',  // sem paginação — ajustar conforme o backend aceita
    ...(params.include_transfers ? {} : { exclude_transfers: 'true' }),
  })
  const res = await fetch(`/api/transactions?${q}`)
  if (!res.ok) throw new Error('Erro ao buscar transações')
  const data = await res.json()
  // O backend pode retornar { transactions: [...] } ou [...] diretamente
  return Array.isArray(data) ? data : (data.transactions ?? [])
}
```

> Verificar em `api.py` como o endpoint `GET /api/transactions` aceita os parâmetros de data e limite antes de implementar. Ajustar os nomes dos query params conforme necessário.

---

## 2. Tipos TypeScript

Adicionar em `src/types/` (ou expandir o arquivo existente):

```typescript
// Linha de categoria no relatório
export type ReportCategoryRow = {
  categoryId:    number | null
  categoryName:  string
  parentId:      number | null
  parentName:    string | null
  isParent:      boolean          // true = linha de categoria-pai
  isTotal:       boolean          // true = linha "Total — X"
  totals:        Record<string, number>  // chave = "2025-11", valor = soma
  grandTotal:    number
}

// Estrutura completa do relatório
export type ReportData = {
  months:   string[]              // ["2025-11", "2025-12", "2026-01", ...]
  entradas: ReportCategoryRow[]
  saidas:   ReportCategoryRow[]
  totalEntradas: Record<string, number>
  totalSaidas:   Record<string, number>
  saldo:         Record<string, number>
}
```

---

## 3. Lógica de pivot — `src/lib/utils/report.ts`

```typescript
import { Transaction } from '@/types'

// Gera a lista de meses entre duas datas
export function gerarMeses(dateFrom: string, dateTo: string): string[] {
  const meses: string[] = []
  const inicio = new Date(dateFrom + 'T12:00:00')
  const fim    = new Date(dateTo   + 'T12:00:00')
  const cur    = new Date(inicio.getFullYear(), inicio.getMonth(), 1)

  while (cur <= fim) {
    meses.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`)
    cur.setMonth(cur.getMonth() + 1)
  }
  return meses
}

// Label do mês para o cabeçalho da tabela
export function labelMes(mesKey: string): string {
  const [ano, mes] = mesKey.split('-')
  const d = new Date(Number(ano), Number(mes) - 1, 1)
  return d.toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '')
    .replace(/^\w/, c => c.toUpperCase())  // "Nov", "Dez", etc.
}

// Agrupa transações em estrutura de relatório
export function buildReportData(
  transactions: Transaction[],
  months: string[]
): ReportData {
  // Separar entradas e saídas
  const entradas = transactions.filter(t => t.amount > 0)
  const saidas   = transactions.filter(t => t.amount < 0)

  return {
    months,
    entradas:      buildCategoryRows(entradas, months),
    saidas:        buildCategoryRows(saidas,   months),
    totalEntradas: somarPorMes(entradas, months),
    totalSaidas:   somarPorMes(saidas,   months),
    saldo:         calcularSaldo(entradas, saidas, months),
  }
}

function buildCategoryRows(
  transactions: Transaction[],
  months: string[]
): ReportCategoryRow[] {
  const rows: ReportCategoryRow[] = []

  // Agrupar por categoria-pai → subcategoria
  // Transações sem categoria-pai vão direto como linha simples
  const porPai = new Map<string, { parentName: string; subs: Map<string, Transaction[]> }>()

  transactions.forEach(t => {
    const parentKey  = t.parent_category_id
      ? String(t.parent_category_id)
      : t.category_id
      ? `solo_${t.category_id}`
      : 'sem_categoria'

    const parentName = t.parent_category_name ?? t.category_name ?? 'Sem Categoria'

    if (!porPai.has(parentKey)) {
      porPai.set(parentKey, { parentName, subs: new Map() })
    }

    const subKey  = t.category_id ? String(t.category_id) : 'sem_sub'
    const subName = t.category_name ?? 'Sem Categoria'
    const grupo   = porPai.get(parentKey)!

    if (!grupo.subs.has(subKey)) grupo.subs.set(subKey, [])
    grupo.subs.get(subKey)!.push(t)
  })

  porPai.forEach((grupo, parentKey) => {
    const subs = Array.from(grupo.subs.entries())

    if (subs.length === 1 && parentKey.startsWith('solo_')) {
      // Categoria sem subcategorias — linha simples
      const [, txList] = subs[0]
      rows.push({
        categoryId:   txList[0].category_id,
        categoryName: grupo.parentName,
        parentId:     null,
        parentName:   null,
        isParent:     false,
        isTotal:      false,
        totals:       somarPorMes(txList, months),
        grandTotal:   txList.reduce((s, t) => s + t.amount, 0),
      })
    } else {
      // Categoria-pai com subcategorias
      const todasTxs: Transaction[] = []
      subs.forEach(([, txList]) => todasTxs.push(...txList))

      // Linha da categoria-pai
      rows.push({
        categoryId:   null,
        categoryName: grupo.parentName,
        parentId:     null,
        parentName:   null,
        isParent:     true,
        isTotal:      false,
        totals:       {},
        grandTotal:   0,
      })

      // Linhas das subcategorias
      subs.forEach(([, txList]) => {
        rows.push({
          categoryId:   txList[0].category_id,
          categoryName: txList[0].category_name ?? 'Sem Categoria',
          parentId:     txList[0].parent_category_id ?? null,
          parentName:   grupo.parentName,
          isParent:     false,
          isTotal:      false,
          totals:       somarPorMes(txList, months),
          grandTotal:   txList.reduce((s, t) => s + t.amount, 0),
        })
      })

      // Linha de total
      rows.push({
        categoryId:   null,
        categoryName: `Total — ${grupo.parentName}`,
        parentId:     null,
        parentName:   null,
        isParent:     false,
        isTotal:      true,
        totals:       somarPorMes(todasTxs, months),
        grandTotal:   todasTxs.reduce((s, t) => s + t.amount, 0),
      })
    }
  })

  return rows
}

function somarPorMes(
  transactions: Transaction[],
  months: string[]
): Record<string, number> {
  const result: Record<string, number> = {}
  months.forEach(m => { result[m] = 0 })
  transactions.forEach(t => {
    const mesKey = t.date.slice(0, 7)  // "2026-03"
    if (mesKey in result) result[mesKey] += t.amount
  })
  return result
}

function calcularSaldo(
  entradas: Transaction[],
  saidas: Transaction[],
  months: string[]
): Record<string, number> {
  const e = somarPorMes(entradas, months)
  const s = somarPorMes(saidas,   months)
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
```

> **Atenção:** O campo `parent_category_id` e `parent_category_name` pode não existir na API atual. Verificar a resposta de `GET /api/transactions` e ajustar os nomes dos campos conforme o que o backend retorna. Se não houver hierarquia de categorias, simplificar: tratar cada `category_name` como uma linha simples sem pai.

---

## 4. ReportFilters

```tsx
// src/components/relatorio/ReportFilters.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  onApply: (params: {
    dateFrom: string
    dateTo: string
    includeTransfers: boolean
  }) => void
}

export function ReportFilters({ onApply }: Props) {
  const now   = new Date()
  const ymAgo = new Date(now.getFullYear(), now.getMonth() - 4, 1)

  const [dateFrom,          setDateFrom]          = useState(formatDateInput(ymAgo))
  const [dateTo,            setDateTo]            = useState(formatDateInput(now))
  const [includeTransfers,  setIncludeTransfers]  = useState(false)

  function handleApply() {
    onApply({
      dateFrom:         parseInputDate(dateFrom),
      dateTo:           parseInputDate(dateTo),
      includeTransfers,
    })
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-muted/30 shrink-0">

      {/* Período */}
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
        Período
      </span>
      <Input
        value={dateFrom}
        onChange={e => setDateFrom(e.target.value)}
        placeholder="DD/MM/AAAA"
        className="h-8 text-xs font-mono w-32"
      />
      <span className="text-xs text-muted-foreground">até</span>
      <Input
        value={dateTo}
        onChange={e => setDateTo(e.target.value)}
        placeholder="DD/MM/AAAA"
        className="h-8 text-xs font-mono w-32"
      />
      <Button size="sm" className="h-8 text-xs" onClick={handleApply}>
        Aplicar
      </Button>

      {/* Toggle transferências */}
      <div className="flex items-center gap-4 ml-auto">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Transferências</span>
        <div className="flex gap-4">
          {[
            { label: 'Nenhuma', value: false },
            { label: 'Todas',   value: true  },
          ].map(opt => (
            <label key={String(opt.value)}
                   className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground">
              <div onClick={() => setIncludeTransfers(opt.value)}
                   className="w-3 h-3 rounded-full border-2 flex items-center justify-center cursor-pointer"
                   style={{
                     borderColor: includeTransfers === opt.value ? '#1D9E75' : 'var(--color-border-secondary)',
                     background:  includeTransfers === opt.value ? '#1D9E75' : 'transparent',
                   }} />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatDateInput(date: Date): string {
  return date.toLocaleDateString('pt-BR')  // "01/11/2025"
}

function parseInputDate(str: string): string {
  const [d, m, y] = str.split('/')
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
}
```

---

## 5. ReportTable

```tsx
// src/components/relatorio/ReportTable.tsx
import { cn } from '@/lib/utils'
import { ReportData, ReportCategoryRow } from '@/types'
import { labelMes, formatVal } from '@/lib/utils/report'

type Props = { data: ReportData }

export function ReportTable({ data }: Props) {
  const { months, entradas, saidas, totalEntradas, totalSaidas, saldo } = data

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>

        {/* Cabeçalho */}
        <thead>
          <tr className="bg-muted border-b border-border">
            <th className="text-left px-3 py-2.5 text-2xs font-medium text-muted-foreground
                           uppercase tracking-wide"
                style={{ width: '200px' }}>
              Categoria
            </th>
            <th className="text-right px-3 py-2.5 text-2xs font-medium text-muted-foreground
                           uppercase tracking-wide"
                style={{ width: '90px' }}>
              Total
            </th>
            {months.map(m => (
              <th key={m}
                  className="text-right px-3 py-2.5 text-2xs font-medium text-muted-foreground
                             uppercase tracking-wide"
                  style={{ width: '80px' }}>
                {labelMes(m)}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {/* ── ENTRADAS ── */}
          <SectionHeader label="↑ Entradas" color="text-primary" months={months} />
          {entradas.map((row, i) => (
            <CategoryRow key={i} row={row} months={months} type="entrada" />
          ))}
          <TotalRow
            label="Total — Entradas"
            totals={totalEntradas}
            months={months}
            color="text-primary"
            bg="bg-primary/5"
          />

          {/* ── SAÍDAS ── */}
          <SectionHeader label="↓ Saídas" color="text-destructive" months={months} />
          {saidas.map((row, i) => (
            <CategoryRow key={i} row={row} months={months} type="saida" />
          ))}
          <TotalRow
            label="Total — Saídas"
            totals={totalSaidas}
            months={months}
            color="text-destructive"
            bg="bg-destructive/5"
          />

          {/* ── SALDO ── */}
          <tr className="border-t-2 border-border">
            <td className="px-3 py-2.5 text-sm font-semibold">Saldo</td>
            <td className="px-3 py-2.5 text-right font-mono text-sm font-semibold"
                style={{
                  color: Object.values(saldo).reduce((a,b) => a+b, 0) >= 0
                    ? '#1D9E75' : '#E24B4A'
                }}>
              {formatVal(Object.values(saldo).reduce((a,b) => a+b, 0))}
            </td>
            {months.map(m => (
              <td key={m}
                  className="px-3 py-2.5 text-right font-mono text-sm font-semibold"
                  style={{ color: (saldo[m] ?? 0) >= 0 ? '#1D9E75' : '#E24B4A' }}>
                {saldo[m] === 0 ? '—' : `${(saldo[m] ?? 0) >= 0 ? '+' : ''}${formatVal(saldo[m] ?? 0)}`}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/* Sub-componentes internos */

function SectionHeader({ label, color, months }: {
  label: string; color: string; months: string[]
}) {
  return (
    <tr className="border-t border-border">
      <td colSpan={months.length + 2}
          className={cn("px-3 py-2 text-2xs font-semibold uppercase tracking-wider", color)}>
        {label}
      </td>
    </tr>
  )
}

function CategoryRow({ row, months, type }: {
  row: ReportCategoryRow; months: string[]; type: 'entrada' | 'saida'
}) {
  if (row.isParent) {
    return (
      <tr className="bg-muted/40">
        <td className="px-3 py-1.5 text-xs font-medium text-foreground truncate"
            colSpan={months.length + 2}>
          {row.categoryName}
        </td>
      </tr>
    )
  }

  if (row.isTotal) {
    return (
      <tr className="border-t border-b border-border bg-muted/30">
        <td className="px-3 py-1.5 text-xs font-medium text-foreground truncate">
          {row.categoryName}
        </td>
        <ValCell value={row.grandTotal} bold />
        {months.map(m => <ValCell key={m} value={row.totals[m] ?? 0} bold />)}
      </tr>
    )
  }

  return (
    <tr className="hover:bg-muted/30 transition-colors border-b border-border/50">
      <td className={cn(
        "px-3 py-1.5 text-xs text-muted-foreground truncate",
        row.parentName ? "pl-6" : "pl-3"
      )}>
        {row.categoryName}
      </td>
      <ValCell value={row.grandTotal} />
      {months.map(m => <ValCell key={m} value={row.totals[m] ?? 0} />)}
    </tr>
  )
}

function TotalRow({ label, totals, months, color, bg }: {
  label: string; totals: Record<string,number>
  months: string[]; color: string; bg: string
}) {
  const grandTotal = Object.values(totals).reduce((a,b) => a+b, 0)
  return (
    <tr className={cn("border-t border-border", bg)}>
      <td className={cn("px-3 py-2 text-xs font-semibold truncate", color)}>{label}</td>
      <td className={cn("px-3 py-2 text-right font-mono text-xs font-semibold", color)}>
        {formatVal(grandTotal)}
      </td>
      {months.map(m => (
        <td key={m} className={cn("px-3 py-2 text-right font-mono text-xs font-semibold", color)}>
          {(totals[m] ?? 0) === 0 ? '—' : formatVal(totals[m] ?? 0)}
        </td>
      ))}
    </tr>
  )
}

function ValCell({ value, bold }: { value: number; bold?: boolean }) {
  if (value === 0) return (
    <td className={cn(
      "px-3 py-1.5 text-right font-mono text-xs text-muted-foreground/40",
      bold && "font-medium"
    )}>—</td>
  )
  return (
    <td className={cn(
      "px-3 py-1.5 text-right font-mono text-xs text-foreground",
      bold && "font-medium"
    )}>
      {formatVal(value)}
    </td>
  )
}
```

---

## 6. Página principal — Relatorio.tsx

```tsx
// src/pages/Relatorio.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart2 } from 'lucide-react'
import { ReportFilters } from '@/components/relatorio/ReportFilters'
import { ReportTable }   from '@/components/relatorio/ReportTable'
import { fetchTransactionsAll } from '@/lib/api'
import { gerarMeses, buildReportData } from '@/lib/utils/report'
import { useMemo } from 'react'

type FilterParams = {
  dateFrom: string
  dateTo: string
  includeTransfers: boolean
}

const DEFAULT_PARAMS: FilterParams = {
  dateFrom: (() => {
    const d = new Date(); d.setMonth(d.getMonth() - 4); d.setDate(1)
    return d.toISOString().slice(0, 10)
  })(),
  dateTo:           new Date().toISOString().slice(0, 10),
  includeTransfers: false,
}

export default function Relatorio() {
  const [params, setParams] = useState<FilterParams>(DEFAULT_PARAMS)

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['report-transactions', params],
    queryFn:  () => fetchTransactionsAll({
      date_from:         params.dateFrom,
      date_to:           params.dateTo,
      include_transfers: params.includeTransfers,
    }),
  })

  const months     = useMemo(() => gerarMeses(params.dateFrom, params.dateTo), [params])
  const reportData = useMemo(() => buildReportData(transactions, months), [transactions, months])

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header da página */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border shrink-0">
        <BarChart2 className="w-4 h-4 text-muted-foreground" />
        <h1 className="text-sm font-semibold">Relatório mensal</h1>
      </div>

      {/* Conteúdo */}
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
            <p className="text-xs text-muted-foreground mt-1">
              Ajuste o período e clique em Aplicar
            </p>
          </div>
        ) : (
          <ReportTable data={reportData} />
        )}
      </div>
    </div>
  )
}
```

---

## Checklist de implementação

- [ ] Verificar response de `GET /api/transactions` — confirmar nomes dos campos (`date`, `amount`, `category_name`, `category_id`, etc.)
- [ ] Verificar se backend suporta busca por intervalo de datas sem paginação — ajustar parâmetros em `fetchTransactionsAll`
- [ ] Verificar se existe hierarquia de categorias (pai/filho) na API — se não houver, simplificar `buildCategoryRows` para linha simples sem indentação
- [ ] Criar `src/lib/utils/report.ts` com `gerarMeses`, `labelMes`, `buildReportData`, `formatVal`
- [ ] Adicionar `fetchTransactionsAll` em `src/lib/api.ts`
- [ ] Criar `ReportFilters.tsx`
- [ ] Criar `ReportTable.tsx` com sub-componentes internos
- [ ] Criar `src/pages/Relatorio.tsx`
- [ ] Adicionar rota `/relatorio` em `App.tsx`
- [ ] Adicionar item "Relatório" com ícone `BarChart2` no nav da sidebar
- [ ] Testar: alterar período e clicar Aplicar recarrega os dados
- [ ] Testar: meses do cabeçalho batem com o período selecionado
- [ ] Testar: totais de entradas e saídas batem com a soma das linhas
- [ ] Testar: saldo = entradas + saídas (saídas já são negativas)
- [ ] Testar: valores zero aparecem como "—" não como "0,00"
- [ ] Testar: saldo positivo em verde, negativo em vermelho

---

## Regras visuais da tabela

- Largura da coluna de categoria: `200px` fixo — não deixar expandir
- Largura da coluna Total: `90px` fixo
- Largura de cada coluna de mês: `80px` fixo
- `table-layout: fixed` obrigatório — evita que colunas de valor se expandam por texto longo
- Valores zero: sempre exibir `—` em `text-muted-foreground/40`
- Valores: sempre `font-mono` para alinhamento tabular
- Sem linha de borda entre cada subcategoria — só no total do grupo
- Hover nas linhas de subcategoria: `bg-muted/30`
- Linhas de total de grupo: `bg-muted/30` sem hover
- Linhas de total de seção (Entradas/Saídas): `bg-primary/5` ou `bg-destructive/5`

---

## O que NÃO fazer

- Não usar `overflow-x: auto` na tabela inteira — usar `table-layout: fixed` com larguras definidas
- Não calcular totais no frontend se o backend já retornar — verificar primeiro se a API tem endpoint de relatório nativo
- Não mostrar centavos desnecessários — usar 2 casas decimais sempre
- Não mostrar "R$" em todas as células — só na linha de saldo e nos totais de seção para reduzir ruído visual
- Não recarregar ao mudar as datas — só ao clicar "Aplicar"