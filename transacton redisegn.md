# Orientações — Redesign da tela de transações (FinControl)

Leia este documento inteiro antes de escrever qualquer código. Ele descreve o que mudar, como mudar e a ordem correta para não quebrar o que já funciona.

---

## Contexto do projeto

- **Nome do app:** FinControl
- **Stack:** Vite + React + TypeScript + React Router v6 + TanStack Query v5
- **UI:** shadcn/ui + Tailwind CSS + Lucide React
- **Backend:** FastAPI rodando em `http://localhost:8011`
- **Cliente HTTP:** `src/lib/api.ts` com funções `fetchTransactions()`, `fetchCategories()`, etc.
- **Design system:** `index.css` já atualizado com tokens verdes e fontes DM Sans/DM Mono

---

## O que muda e o que NÃO muda

### Não tocar
- `src/lib/api.ts` — nenhuma mudança nas chamadas de API
- Lógica de TanStack Query (`useQuery`, `useMutation`) — só reorganizar onde fica
- Endpoints do FastAPI — nenhuma mudança no backend
- Lógica de filtros existente — só mover para novos componentes
- Páginas de Categorias, CategoryMappings e Import — fora do escopo

### O que muda
- `src/components/AppShell.tsx` — sidebar dark + nav reorganizado
- `src/pages/Dashboard.tsx` (ou `Transactions.tsx`) — layout completo da tela
- Criação de novos subcomponentes em `src/components/transactions/`

---

## Estrutura de arquivos a criar

```
src/components/
  AppShell.tsx                        ← atualizar (sidebar dark)
  transactions/
    TransactionsList.tsx              ← lista principal com grupos por dia
    TransactionRow.tsx                ← linha individual
    DayGroup.tsx                      ← cabeçalho do grupo + linhas
    TransactionFilters.tsx            ← topbar com mês, filtros, busca
    TransactionSummaryBar.tsx         ← rodapé com totais
    AddTransactionModal.tsx           ← modal para criar transação (era inline)
    CategoryFilterPopover.tsx         ← popover de filtro de categorias
```

---

## 1. AppShell — sidebar dark

Substituir o layout atual pelo seguinte. A sidebar tem fundo escuro fixo independente do tema da aplicação.

### Estrutura do layout
```tsx
// src/components/AppShell.tsx
export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
```

### Sidebar
```tsx
function Sidebar() {
  const { data: accounts } = useQuery({ queryKey: ['accounts'], queryFn: fetchAccounts })

  const saldoTotal = accounts?.reduce((acc, a) => acc + a.balance, 0) ?? 0

  return (
    <aside className="w-56 shrink-0 flex flex-col overflow-hidden"
           style={{ background: '#0f1210' }}>

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b"
           style={{ borderColor: 'rgba(255,255,255,.07)' }}>
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-sm">
          🔥
        </div>
        <span className="text-sm font-semibold" style={{ color: '#eeecea' }}>
          FinControl
        </span>
      </div>

      {/* Nav */}
      <nav className="px-2.5 py-3 flex flex-col gap-0.5">
        <SidebarNavItem to="/transactions" icon={<List />}>Transações</SidebarNavItem>
        <SidebarNavItem to="/dashboard"    icon={<LayoutDashboard />}>Dashboard</SidebarNavItem>
        <SidebarNavItem to="/import"       icon={<Upload />}>Importar</SidebarNavItem>
        <div className="h-px mx-1 my-1" style={{ background: 'rgba(255,255,255,.07)' }} />
        <SidebarNavItem to="/categories"   icon={<Tag />}>Categorias</SidebarNavItem>
      </nav>

      {/* Contas */}
      <div className="px-2.5 mt-1">
        <p className="text-xs font-medium px-2 mb-1.5 uppercase tracking-wider"
           style={{ color: 'rgba(255,255,255,.25)', fontSize: '10px' }}>
          Contas
        </p>
        {accounts?.map((account, i) => (
          <div key={account.id}
               className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer"
               style={{ color: 'rgba(255,255,255,.5)' }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length] }} />
            <span className="flex-1 text-xs truncate">{account.name}</span>
            <span className={cn("font-mono text-xs", account.balance < 0 ? "text-red-400" : "text-emerald-400")}>
              {formatCurrency(account.balance)}
            </span>
          </div>
        ))}
      </div>

      {/* Saldo total */}
      <div className="mx-2.5 mb-3 mt-auto p-3 rounded-xl"
           style={{ background: 'rgba(255,255,255,.05)', border: '0.5px solid rgba(255,255,255,.08)' }}>
        <p className="text-xs font-medium uppercase tracking-wider"
           style={{ color: 'rgba(255,255,255,.3)', fontSize: '10px' }}>
          Saldo atual
        </p>
        <p className={cn("font-mono text-base font-semibold mt-1",
                          saldoTotal < 0 ? "text-red-400" : "text-emerald-400")}>
          {formatCurrency(saldoTotal)}
        </p>
      </div>
    </aside>
  )
}
```

### Componente SidebarNavItem
```tsx
function SidebarNavItem({
  to, icon, children
}: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <NavLink to={to}
      className={({ isActive }) => cn(
        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors",
        isActive
          ? "text-emerald-400"
          : "hover:text-white/80"
      )}
      style={({ isActive }) => ({
        color: isActive ? undefined : 'rgba(255,255,255,.45)',
        background: isActive ? 'rgba(29,158,117,.12)' : undefined,
      })}>
      <span className="w-3.5 h-3.5 shrink-0">{icon}</span>
      {children}
    </NavLink>
  )
}
```

### Paleta de cores por conta
```typescript
// src/lib/constants.ts — criar este arquivo
export const ACCOUNT_COLORS = [
  '#E24B4A', // vermelho
  '#378ADD', // azul
  '#1D9E75', // verde
  '#EF9F27', // âmbar
  '#D4537E', // rosa
  '#7F77DD', // violeta
]
```

---

## 2. Tela de transações — layout geral

A tela tem três zonas verticais:
1. **Topbar** — navegação de mês + filtros + busca + botão novo (altura fixa, não scrolla)
2. **Lista** — grupos por dia, scrolla verticalmente
3. **Summary bar** — totais do mês (altura fixa, não scrolla)

```tsx
// src/pages/Transactions.tsx (ou Dashboard.tsx — renomear se necessário)
export default function Transactions() {
  const [mes, setMes]           = useState(() => new Date().getMonth() + 1)
  const [ano, setAno]           = useState(() => new Date().getFullYear())
  const [contaFiltro, setConta] = useState<string>('todas')
  const [catFiltros, setCats]   = useState<string[]>([])
  const [tipo, setTipo]         = useState<'todos'|'receita'|'despesa'>('todos')
  const [busca, setBusca]       = useState('')
  const [modalAberto, setModal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', mes, ano, contaFiltro],
    queryFn: () => fetchTransactions({
      date_from: `${ano}-${String(mes).padStart(2,'0')}-01`,
      date_to:   `${ano}-${String(mes).padStart(2,'0')}-31`,
      account_id: contaFiltro !== 'todas' ? contaFiltro : undefined,
    }),
  })

  // Filtros client-side (categoria, tipo, busca)
  const transacoesFiltradas = useMemo(() => {
    return (data?.transactions ?? []).filter(t => {
      if (catFiltros.length > 0 && !catFiltros.includes(t.category_id)) return false
      if (tipo === 'receita' && t.amount < 0) return false
      if (tipo === 'despesa' && t.amount > 0) return false
      if (busca && !t.description.toLowerCase().includes(busca.toLowerCase())) return false
      return true
    })
  }, [data, catFiltros, tipo, busca])

  const grupos      = useMemo(() => agruparPorDia(transacoesFiltradas), [transacoesFiltradas])
  const resumo      = useMemo(() => calcularResumo(transacoesFiltradas), [transacoesFiltradas])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TransactionFilters
        mes={mes} ano={ano}
        onMesAno={(m, a) => { setMes(m); setAno(a) }}
        contaFiltro={contaFiltro} onConta={setConta}
        catFiltros={catFiltros}   onCats={setCats}
        tipo={tipo}               onTipo={setTipo}
        busca={busca}             onBusca={setBusca}
        onNovaTransacao={() => setModal(true)}
      />

      <main className="flex-1 overflow-y-auto px-4 pb-2">
        {isLoading ? (
          <TransactionsSkeleton />
        ) : grupos.length === 0 ? (
          <TransactionsEmpty busca={busca} />
        ) : (
          grupos.map(g => <DayGroup key={g.date} group={g} />)
        )}
      </main>

      <TransactionSummaryBar resumo={resumo} />

      <AddTransactionModal
        open={modalAberto}
        onClose={() => setModal(false)}
      />
    </div>
  )
}
```

---

## 3. TransactionFilters — topbar

```tsx
// src/components/transactions/TransactionFilters.tsx
export function TransactionFilters({ mes, ano, onMesAno, contaFiltro, onConta,
  catFiltros, onCats, tipo, onTipo, busca, onBusca, onNovaTransacao }) {

  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

  function navMes(delta: number) {
    let m = mes + delta, a = ano
    if (m < 1)  { m = 12; a-- }
    if (m > 12) { m = 1;  a++ }
    onMesAno(m, a)
  }

  return (
    <div className="flex items-center gap-2 px-4 h-14 border-b border-border shrink-0 flex-wrap">

      {/* Navegação de mês */}
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="icon" className="h-7 w-7"
                onClick={() => navMes(-1)}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <span className="text-sm font-medium min-w-24 text-center">
          {MESES[mes - 1]} {ano}
        </span>
        <Button variant="outline" size="icon" className="h-7 w-7"
                onClick={() => navMes(1)}>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="w-px h-4 bg-border mx-1" />

      {/* Filtro de conta */}
      <Select value={contaFiltro} onValueChange={onConta}>
        <SelectTrigger className="h-8 text-xs w-36">
          <SelectValue placeholder="Todas as contas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas as contas</SelectItem>
          {/* mapear contas do useQuery */}
        </SelectContent>
      </Select>

      {/* Filtro de categorias — POPOVER (substitui a lista de checkboxes lateral) */}
      <CategoryFilterPopover selected={catFiltros} onChange={onCats} />

      {/* Filtro de tipo */}
      <Select value={tipo} onValueChange={onTipo}>
        <SelectTrigger className="h-8 text-xs w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          <SelectItem value="receita">Receitas</SelectItem>
          <SelectItem value="despesa">Despesas</SelectItem>
        </SelectContent>
      </Select>

      <div className="w-px h-4 bg-border mx-1" />

      {/* Busca */}
      <div className="relative flex-1 min-w-36 max-w-60">
        <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
        <Input value={busca} onChange={e => onBusca(e.target.value)}
               placeholder="Buscar transações..."
               className="h-8 text-xs pl-8" />
      </div>

      <Button size="sm" className="ml-auto h-8 text-xs gap-1.5"
              onClick={onNovaTransacao}>
        <Plus className="w-3.5 h-3.5" /> Nova transação
      </Button>
    </div>
  )
}
```

---

## 4. CategoryFilterPopover

Substitui o painel lateral de checkboxes. Usa o componente `Popover` + `Command` do shadcn já instalado.

```tsx
// src/components/transactions/CategoryFilterPopover.tsx
export function CategoryFilterPopover({ selected, onChange }) {
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  })

  const label = selected.length === 0
    ? 'Categorias'
    : `${selected.length} categoria${selected.length > 1 ? 's' : ''}`

  function toggle(id: string) {
    onChange(selected.includes(id)
      ? selected.filter(s => s !== id)
      : [...selected, id])
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm"
                className={cn("h-8 text-xs gap-1.5",
                  selected.length > 0 && "border-primary/50 bg-primary/5 text-primary")}>
          <Tag className="w-3 h-3" />
          {label}
          {selected.length > 0 && (
            <span className="ml-1 w-4 h-4 rounded-full bg-primary text-primary-foreground
                             text-xs flex items-center justify-center font-medium">
              {selected.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar categoria..." className="h-8 text-xs" />
          <CommandList className="max-h-52">
            <CommandEmpty className="text-xs text-center py-3 text-muted-foreground">
              Nenhuma categoria
            </CommandEmpty>
            <CommandGroup>
              {categories?.map(cat => (
                <CommandItem key={cat.id}
                             onSelect={() => toggle(String(cat.id))}
                             className="text-xs gap-2 cursor-pointer">
                  <div className={cn(
                    "w-3.5 h-3.5 rounded border flex items-center justify-center",
                    selected.includes(String(cat.id))
                      ? "bg-primary border-primary"
                      : "border-border"
                  )}>
                    {selected.includes(String(cat.id)) && (
                      <Check className="w-2.5 h-2.5 text-primary-foreground" />
                    )}
                  </div>
                  {cat.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {selected.length > 0 && (
            <div className="p-1 border-t border-border">
              <Button variant="ghost" size="sm"
                      className="w-full h-7 text-xs text-muted-foreground"
                      onClick={() => onChange([])}>
                Limpar filtro
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

---

## 5. DayGroup e TransactionRow

### DayGroup
```tsx
// src/components/transactions/DayGroup.tsx
export function DayGroup({ group }: { group: DayGroup }) {
  return (
    <div className="mt-3">
      {/* Cabeçalho do dia */}
      <div className="flex items-center gap-3 py-1 mb-0.5">
        <span className="text-2xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
          {group.label}
        </span>
        <div className="flex-1 h-px bg-border" />
        <span className="text-2xs text-muted-foreground font-mono whitespace-nowrap">
          {group.saldo >= 0 ? '+' : ''}{formatCurrency(group.saldo)}
        </span>
      </div>

      {/* Linhas */}
      {group.transactions.map(t => (
        <TransactionRow key={t.id} transaction={t} />
      ))}
    </div>
  )
}
```

### TransactionRow
```tsx
// src/components/transactions/TransactionRow.tsx
export function TransactionRow({ transaction: t }: { transaction: Transaction }) {
  const queryClient = useQueryClient()

  async function handleCategoryChange(categoryId: string) {
    await updateTransaction(t.id, { category_id: categoryId })
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
  }

  return (
    // "group" no Tailwind ativa o group-hover nos filhos
    <div className="group grid items-center gap-2 px-2.5 py-2 rounded-lg
                    hover:bg-muted/60 transition-colors cursor-pointer"
         style={{ gridTemplateColumns: '1fr 130px 110px 90px 24px' }}>

      {/* Descrição */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-medium truncate">
          {t.description}
          {t.installment_current && t.installment_total && (
            <span className="badge-installment shrink-0">
              {t.installment_current}/{t.installment_total}
            </span>
          )}
        </div>
        {t.installment_current && (
          <p className="text-xs text-muted-foreground mt-0.5">
            parcela de {formatCurrency(Math.abs(t.amount))}
          </p>
        )}
      </div>

      {/* Categoria — clicável para editar */}
      <CategoryBadge
        categoryId={t.category_id}
        categoryName={t.category_name}
        onSelect={handleCategoryChange}
      />

      {/* Conta */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: accountColor(t.account_id) }} />
        <span className="truncate">{t.account_name}</span>
      </div>

      {/* Valor */}
      <span className={cn(
        "font-mono text-sm font-medium text-right",
        t.amount < 0 ? "text-destructive" : "text-primary"
      )}>
        {formatCurrency(t.amount)}
      </span>

      {/* Editar — só no hover */}
      <button className="opacity-0 group-hover:opacity-100 transition-opacity
                         w-5 h-5 rounded flex items-center justify-center
                         hover:bg-muted text-muted-foreground">
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  )
}
```

### CategoryBadge (inline — clique abre popover de troca)
```tsx
function CategoryBadge({ categoryId, categoryName, onSelect }) {
  if (!categoryName) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className="badge-pending">Pendente</button>
        </PopoverTrigger>
        <CategoryPickerContent onSelect={onSelect} />
      </Popover>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="badge-category text-left"
                style={{
                  background: getCategoryColor(categoryId),
                  color: getCategoryTextColor(categoryId),
                }}>
          {categoryName}
        </button>
      </PopoverTrigger>
      <CategoryPickerContent onSelect={onSelect} />
    </Popover>
  )
}
```

---

## 6. TransactionSummaryBar

```tsx
// src/components/transactions/TransactionSummaryBar.tsx
export function TransactionSummaryBar({ resumo }: { resumo: Resumo }) {
  const items = [
    { label: 'Receitas',      valor: resumo.receitas,      cor: 'text-primary'     },
    { label: 'Despesas',      valor: resumo.despesas,      cor: 'text-destructive' },
    { label: 'Parcelamentos', valor: resumo.parcelamentos, cor: 'text-foreground'  },
    { label: 'Saldo do mês',  valor: resumo.saldo,
      cor: resumo.saldo >= 0 ? 'text-primary' : 'text-destructive' },
  ]

  return (
    <div className="grid grid-cols-4 border-t border-border bg-muted/30 shrink-0">
      {items.map((item, i) => (
        <div key={item.label}
             className={cn("px-4 py-2.5", i < 3 && "border-r border-border")}>
          <p className="text-2xs font-medium text-muted-foreground uppercase tracking-wide">
            {item.label}
          </p>
          <p className={cn("font-mono text-sm font-semibold mt-0.5", item.cor)}>
            {formatCurrency(item.valor)}
          </p>
        </div>
      ))}
    </div>
  )
}
```

---

## 7. AddTransactionModal

O formulário que estava inline na tela agora vira um modal. Migrar a lógica existente de criação para cá sem alterar a chamada de API.

```tsx
// src/components/transactions/AddTransactionModal.tsx
export function AddTransactionModal({ open, onClose }) {
  const queryClient = useQueryClient()
  const form = useForm({ resolver: zodResolver(transactionSchema) })

  const mutation = useMutation({
    mutationFn: createTransaction,  // já existe em api.ts
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      form.reset()
      onClose()
    },
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Nova transação</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(d => mutation.mutate(d))}
                className="space-y-3">
            {/* Conta, Data, Descrição, Valor, Categoria, Repetições */}
            {/* Migrar os campos que já existem no formulário atual */}
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Salvando...' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 8. Funções utilitárias

Criar ou atualizar `src/lib/utils/format.ts`:

```typescript
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDayLabel(dateStr: string): string {
  // dateStr: "2026-03-01"
  const d = new Date(dateStr + 'T12:00:00') // T12 evita problema de timezone
  return d.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
  // "dom., 01 de mar." → formatar para "Dom, 01 mar" com replace se necessário
}
```

Criar `src/lib/utils/transactions.ts`:

```typescript
export type DayGroup = {
  date:         string
  label:        string
  transactions: Transaction[]
  saldo:        number
}

export type Resumo = {
  receitas:      number
  despesas:      number
  parcelamentos: number
  saldo:         number
}

export function agruparPorDia(transactions: Transaction[]): DayGroup[] {
  const map = new Map<string, Transaction[]>()
  transactions.forEach(t => {
    const key = t.date.slice(0, 10) // garantir "YYYY-MM-DD"
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(t)
  })
  return Array.from(map.entries()).map(([date, items]) => ({
    date,
    label:        formatDayLabel(date),
    transactions: items,
    saldo:        items.reduce((s, t) => s + t.amount, 0),
  }))
}

export function calcularResumo(transactions: Transaction[]): Resumo {
  const receitas      = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const despesas      = transactions.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)
  const parcelamentos = transactions
    .filter(t => t.installment_current != null && t.amount < 0)
    .reduce((s, t) => s + t.amount, 0)
  return { receitas, despesas, parcelamentos, saldo: receitas + despesas }
}
```

---

## 9. Estados de loading e vazio

```tsx
// Skeleton (mostrar ao isLoading)
function TransactionsSkeleton() {
  return (
    <div className="mt-4 space-y-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
      ))}
    </div>
  )
}

// Empty state
function TransactionsEmpty({ busca }: { busca: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-3">
        <FileX className="w-5 h-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">Nenhuma transação encontrada</p>
      <p className="text-xs text-muted-foreground mt-1">
        {busca
          ? `Nenhum resultado para "${busca}"`
          : 'Importe um extrato ou adicione manualmente'}
      </p>
    </div>
  )
}
```

---

## Checklist de implementação (seguir nessa ordem)

- [ ] Criar `src/lib/constants.ts` com `ACCOUNT_COLORS`
- [ ] Criar `src/lib/utils/format.ts` com `formatCurrency` e `formatDayLabel`
- [ ] Criar `src/lib/utils/transactions.ts` com `agruparPorDia` e `calcularResumo`
- [ ] Atualizar `AppShell.tsx` — sidebar dark + `SidebarNavItem`
- [ ] Criar `TransactionSummaryBar.tsx`
- [ ] Criar `CategoryFilterPopover.tsx`
- [ ] Criar `TransactionFilters.tsx` usando o popover acima
- [ ] Criar `TransactionRow.tsx` com `CategoryBadge`
- [ ] Criar `DayGroup.tsx`
- [ ] Criar `TransactionsList.tsx` com skeleton e empty state
- [ ] Criar `AddTransactionModal.tsx` migrando lógica do formulário inline
- [ ] Atualizar `Dashboard.tsx` (ou `Transactions.tsx`) montando tudo
- [ ] Remover painel lateral de checkboxes de categorias do layout antigo
- [ ] Remover formulário inline de criação do layout antigo
- [ ] Testar: troca de mês recarrega dados, filtros funcionam sem reload, modal abre/fecha

---

## O que NÃO fazer

- Não remover campos do formulário de criação — só mover para o modal
- Não alterar `fetchTransactions()` em `api.ts` — só os parâmetros passados
- Não usar `position: fixed` em nada — usar `overflow-hidden` no shell + `overflow-y-auto` na lista
- Não hardcodar cores de categoria — vir sempre do backend ou de um mapa por `category_id`
- Não mostrar a coluna `id` da transação ao usuário — é dado interno
- Não usar `font-bold` (700) — máximo `font-semibold` (600)
- Não reinventar componentes — `Dialog`, `Popover`, `Command`, `Select` já estão instalados via shadcn