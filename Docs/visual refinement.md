# Prompt — Refinamento visual da tela de transações (FinControl)

Cole este documento inteiro como contexto para a LLM antes de pedir qualquer alteração.

---

## Contexto

Stack: Vite + React + TypeScript + React Router v6 + TanStack Query v5 + shadcn/ui + Tailwind CSS + Lucide React.

O redesign da estrutura já foi aplicado com sucesso:
- Sidebar dark funcionando
- Agrupamento de transações por dia funcionando
- Parcelas identificadas no título ("Parcela 3/4")

O que ainda falta é refinamento visual. Este documento descreve **exatamente** o que ajustar.

---

## Resultado esperado (referência visual)

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔥 FinControl   [sidebar escura #0f1210, largura 224px]         │
│                                                                  │
│  ≡  Transações  ← item ativo: fundo rgba(29,158,117,.12),       │
│  ⊞  Dashboard      texto #5DCAA5, ícone Lucide                  │
│  ↑  Importar    ← itens inativos: rgba(255,255,255,.45)         │
│  ◷  Parcelamentos                                               │
│  ⊷  Categorias                                                  │
│  ─────────────────────────────────────────                      │
│  CONTAS                                                         │
│  ● Bradesco      -R$18.382   ← dot vermelho + valor negativo    │
│  ● BradescoCC    -R$37.364   ← dot azul                        │
│  ● Nubank        -R$249.652  ← dot verde                       │
│  ─────────────────────────────────────────                      │
│  Saldo atual                                                    │
│  -R$ 8.583,18   ← fundo rgba branco 5%, texto red-400          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ TOPBAR (h-14, border-b)                                         │
│ [‹] Mar 2026 [›]  |  [Todas as contas ▾]  [Categorias ▾]       │
│                    🔍 Buscar...         [+ Nova transação]      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  QUI, 26 MAR ─────────────────── saldo do dia −R$ 160,08       │
│                                                                  │
│  PAGTO ELETRONICO TRIBUTO    [Imposto]  ● BradescoCC  -R$137,49 │
│  CARTAO VISA ELECTRON        [Pendente] ● BradescoCC  -R$ 22,59 │
│                                                                  │
│  QUA, 04 MAR ─────────────────── saldo do dia −R$ 422,70       │
│                                                                  │
│  Amazonmktplc*Srdossant  [3/4] [Vestuário] ● Nubank  -R$134,72 │
│  Amazonmktplc*Fabiluvar  [3/4] [Pendente]  ● Nubank  -R$ 56,22 │
│  Shopee*Lpmveis          [3/4] [Móveis]    ● Nubank  -R$127,74 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Receitas +R$17.250  │ Despesas -R$14.735  │ Parcelas R$2.384   │ Saldo +R$2.514 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Problema 1 — Contas não aparecem na sidebar

A sidebar deve buscar as contas via `useQuery` e exibi-las com dot colorido e saldo.

### Implementar em `AppShell.tsx` (ou onde a Sidebar está definida):

```tsx
import { useQuery } from '@tanstack/react-query'
import { fetchAccounts } from '@/lib/api'  // ajustar o import conforme o projeto

// Dentro do componente Sidebar:
const { data: accounts = [] } = useQuery({
  queryKey: ['accounts'],
  queryFn: fetchAccounts,
})

const saldoTotal = accounts.reduce((sum, a) => sum + (a.balance ?? a.saldo ?? 0), 0)
```

**Verificar o nome do campo de saldo retornado pela API** — pode ser `balance`, `saldo` ou outro. Inspecionar a resposta de `GET /api/accounts` para confirmar antes de usar.

### HTML da seção de contas (dentro da sidebar):
```tsx
{/* Separador */}
<div className="h-px mx-3 my-2" style={{ background: 'rgba(255,255,255,.07)' }} />

{/* Label */}
<p className="px-3 mb-1 font-medium uppercase tracking-wider"
   style={{ fontSize: '10px', color: 'rgba(255,255,255,.25)' }}>
  Contas
</p>

{/* Lista de contas */}
{accounts.map((account, i) => (
  <div key={account.id}
       className="flex items-center gap-2 px-3 py-1.5 mx-1 rounded-lg cursor-pointer transition-colors"
       style={{ color: 'rgba(255,255,255,.5)' }}
       onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.05)'}
       onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
    <span className="w-2 h-2 rounded-full shrink-0"
          style={{ background: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length] }} />
    <span className="flex-1 truncate" style={{ fontSize: '11px' }}>
      {account.name ?? account.nome}
    </span>
    <span className="font-mono"
          style={{
            fontSize: '10px',
            color: (account.balance ?? account.saldo ?? 0) < 0 ? '#f87171' : '#34d399'
          }}>
      {formatCurrency(account.balance ?? account.saldo ?? 0)}
    </span>
  </div>
))}

{/* Saldo total */}
<div className="mx-3 mt-2 mb-3 p-3 rounded-xl"
     style={{
       background: 'rgba(255,255,255,.05)',
       border: '0.5px solid rgba(255,255,255,.08)'
     }}>
  <p className="font-medium uppercase tracking-wider"
     style={{ fontSize: '10px', color: 'rgba(255,255,255,.3)' }}>
    Saldo atual
  </p>
  <p className="font-mono font-semibold mt-1"
     style={{
       fontSize: '15px',
       color: saldoTotal < 0 ? '#f87171' : '#34d399'
     }}>
    {formatCurrency(saldoTotal)}
  </p>
</div>
```

### Constante de cores por conta — criar em `src/lib/constants.ts`:
```typescript
export const ACCOUNT_COLORS = [
  '#E24B4A',  // vermelho
  '#378ADD',  // azul
  '#1D9E75',  // verde
  '#EF9F27',  // âmbar
  '#D4537E',  // rosa
  '#7F77DD',  // violeta
]
```

---

## Problema 2 — Ícones ausentes no nav

Cada item do nav deve ter um ícone Lucide à esquerda. Lucide já está instalado (`lucide-react` no package.json).

```tsx
import {
  List,
  LayoutDashboard,
  Upload,
  Clock,
  Tag,
} from 'lucide-react'

// Mapeamento de rota → ícone
const NAV_ITEMS = [
  { to: '/transactions', label: 'Transações',    icon: List            },
  { to: '/contas',       label: 'Contas',         icon: LayoutDashboard },
  { to: '/importar',     label: 'Importar',       icon: Upload          },
  { to: '/categorias',   label: 'Categorias',     icon: Tag             },
]

// Componente de item
function NavItem({ to, label, icon: Icon }) {
  return (
    <NavLink to={to}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
      style={({ isActive }) => ({
        color:      isActive ? '#5DCAA5'                : 'rgba(255,255,255,.45)',
        background: isActive ? 'rgba(29,158,117,.12)'  : 'transparent',
      })}>
      <Icon size={14} strokeWidth={1.8} />
      {label}
    </NavLink>
  )
}
```

---

## Problema 3 — Linhas de transação muito esparsas

As linhas precisam ser mais densas e ter a estrutura em grid de 5 colunas:
`[descrição flex-1] [badge categoria 130px] [conta 110px] [valor 90px] [ação 24px]`

```tsx
// Trocar o layout atual das linhas por este grid
<div
  className="group grid items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
  style={{ gridTemplateColumns: '1fr 130px 110px 90px 24px' }}
>
  {/* Coluna 1 — Descrição + badge de parcela */}
  <div className="min-w-0">
    <div className="flex items-center gap-1.5 text-sm font-medium truncate"
         style={{ color: 'var(--foreground)' }}>
      {/* Limpar o texto: remover " - Parcela X/Y" da descrição se já mostrar o badge */}
      {descricaoSemParcela}
      {installment && (
        <span className="shrink-0 px-1.5 py-0.5 rounded-full text-xs font-medium"
              style={{ background: '#EEEDFE', color: '#3C3489', fontSize: '10px' }}>
          {installment.current}/{installment.total}
        </span>
      )}
    </div>
  </div>

  {/* Coluna 2 — Badge de categoria */}
  <div>
    {categoria ? (
      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
            style={{ background: categoria.cor ?? '#E1F5EE', color: categoria.cor_texto ?? '#085041' }}>
        {categoria.nome}
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
            style={{
              background: '#FAEEDA', color: '#633806',
              border: '0.5px solid rgba(239,159,39,.4)'
            }}>
        Pendente
      </span>
    )}
  </div>

  {/* Coluna 3 — Conta com dot colorido */}
  <div className="flex items-center gap-1.5" style={{ fontSize: '11px', color: 'rgba(255,255,255,.4)' }}>
    <span className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: accountColor(transaction.account_id) }} />
    <span className="truncate">{transaction.account_name}</span>
  </div>

  {/* Coluna 4 — Valor */}
  <span className="font-mono text-sm font-medium text-right whitespace-nowrap"
        style={{ color: transaction.amount < 0 ? '#f87171' : '#34d399' }}>
    {formatCurrency(transaction.amount)}
  </span>

  {/* Coluna 5 — Editar (só no hover) */}
  <button className="opacity-0 group-hover:opacity-100 transition-opacity
                     w-5 h-5 rounded flex items-center justify-center"
          style={{ color: 'rgba(255,255,255,.3)' }}>
    <Pencil size={11} />
  </button>
</div>
```

**Limpar o texto da descrição** — atualmente aparece "Amazonmktplc*Srdossant - Parcela 4/4". O badge já mostra a parcela, então remover o trecho " - Parcela X/Y" da string de descrição antes de renderizar:

```typescript
function limparDescricao(description: string): string {
  return description.replace(/\s*[-–]\s*Parcela\s+\d+\/\d+/i, '').trim()
}
```

---

## Problema 4 — Cabeçalho do grupo de dia sem refinamento

```tsx
// Substituir o cabeçalho atual por:
<div className="flex items-center gap-3 py-1 mt-4 mb-1">
  <span style={{
    fontSize: '10px',
    fontWeight: 500,
    color: 'rgba(255,255,255,.3)',
    textTransform: 'uppercase',
    letterSpacing: '.07em',
    whiteSpace: 'nowrap',
  }}>
    {formatDayLabel(group.date)}
    {/* ex: "QUI, 26 MAR" */}
  </span>
  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,.07)' }} />
  <span className="font-mono whitespace-nowrap"
        style={{ fontSize: '10px', color: 'rgba(255,255,255,.25)' }}>
    {group.saldo >= 0 ? '+' : ''}{formatCurrency(group.saldo)}
  </span>
</div>
```

---

## Problema 5 — Summary bar ausente ou incompleta

A summary bar deve ficar fixada no rodapé da área de conteúdo, **não dentro do scroll**.
Verificar se está dentro do `flex flex-col h-full` com `shrink-0` correto:

```tsx
// Estrutura correta da página
<div className="flex flex-col h-full overflow-hidden">
  <TransactionFilters />                              {/* shrink-0 */}
  <main className="flex-1 overflow-y-auto px-4 pb-2">
    {grupos.map(g => <DayGroup key={g.date} group={g} />)}
  </main>
  <TransactionSummaryBar resumo={resumo} />           {/* shrink-0, nunca some */}
</div>

// Summary bar
<div className="grid grid-cols-4 shrink-0 border-t"
     style={{ borderColor: 'rgba(255,255,255,.07)', background: 'rgba(255,255,255,.02)' }}>
  {[
    { label: 'Receitas',      valor: resumo.receitas,      cor: '#34d399' },
    { label: 'Despesas',      valor: resumo.despesas,      cor: '#f87171' },
    { label: 'Parcelamentos', valor: resumo.parcelamentos, cor: '#eeecea' },
    { label: 'Saldo do mês',  valor: resumo.saldo,
      cor: resumo.saldo >= 0 ? '#34d399' : '#f87171' },
  ].map((item, i) => (
    <div key={item.label}
         className={i < 3 ? 'border-r' : ''}
         style={{
           padding: '10px 16px',
           borderColor: 'rgba(255,255,255,.07)',
         }}>
      <p style={{ fontSize: '10px', fontWeight: 500, color: 'rgba(255,255,255,.3)',
                  textTransform: 'uppercase', letterSpacing: '.05em' }}>
        {item.label}
      </p>
      <p className="font-mono font-semibold mt-0.5"
         style={{ fontSize: '14px', color: item.cor }}>
        {formatCurrency(item.valor)}
      </p>
    </div>
  ))}
</div>
```

---

## Função formatCurrency

Confirmar que esta função existe em `src/lib/utils.ts` ou `src/lib/format.ts`:

```typescript
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}
```

---

## Checklist — aplicar nessa ordem

- [ ] Criar `src/lib/constants.ts` com `ACCOUNT_COLORS`
- [ ] Confirmar nome do campo de saldo em `GET /api/accounts` (balance? saldo?)
- [ ] Adicionar `useQuery(['accounts'], fetchAccounts)` dentro da Sidebar
- [ ] Renderizar lista de contas com dot colorido e saldo na sidebar
- [ ] Adicionar box de saldo total no rodapé da sidebar
- [ ] Adicionar ícones Lucide nos itens do nav (List, Upload, Tag, etc.)
- [ ] Aplicar grid de 5 colunas nas linhas de transação
- [ ] Implementar `limparDescricao()` e aplicar no texto da linha
- [ ] Substituir badge de parcela pelo formato `[X/Y]` inline
- [ ] Adicionar badge colorido de categoria (ou "Pendente" em âmbar)
- [ ] Adicionar dot colorido de conta na coluna de conta
- [ ] Refinar cabeçalho do grupo de dia com linha divisória e saldo
- [ ] Garantir summary bar fixada no rodapé fora do scroll
- [ ] Testar: sidebar mostra contas com saldos reais da API