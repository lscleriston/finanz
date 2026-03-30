# Orientações — Edição inline de transação

Leia inteiro antes de escrever qualquer código.

---

## Contexto

Stack: Vite + React + TypeScript + TanStack Query v5 + shadcn/ui + Tailwind CSS + Lucide React.
Backend: FastAPI em `http://localhost:8011`.
**Não usar Modal nem Dialog** — a edição acontece inline na própria linha da lista.

---

## Comportamento esperado

1. Usuário clica em qualquer lugar da linha → linha entra em modo edição
2. A linha expande no lugar, mantendo o mesmo grid de colunas
3. Descrição e valor viram `<input>`, categoria e conta viram `<select>`
4. Uma barra de ações aparece abaixo com: [Despesa | Receita | Transferência] · [Excluir] [Cancelar] [Salvar]
5. `Enter` ou clique em "Salvar" → chama `PATCH /api/transactions/{id}` → volta ao modo normal
6. `Escape` ou clique em "Cancelar" → volta ao modo normal sem salvar
7. Apenas uma linha pode estar em edição por vez — clicar em outra fecha a atual sem salvar
8. Clique em "Excluir" → primeiro clique muda o botão para "Confirmar exclusão" (vermelho mais forte) → segundo clique chama `DELETE`

---

## Arquivos a modificar / criar

```
src/components/transactions/
  TransactionRow.tsx        ← principal — adicionar modo edição
  DayGroup.tsx              ← passa editandoId para as linhas
src/pages/Transactions.tsx  ← controla qual linha está em edição
```

---

## 1. Estado de edição na página principal

O controle de qual linha está em edição fica na página, não na linha — assim garantimos que só uma linha edita por vez:

```tsx
// src/pages/Transactions.tsx
const [editandoId, setEditandoId] = useState<number | null>(null)

function handleStartEdit(id: number) {
  setEditandoId(id)
}

function handleCloseEdit() {
  setEditandoId(null)
}

// Passar para os grupos
{grupos.map(g => (
  <DayGroup
    key={g.date}
    group={g}
    editandoId={editandoId}
    onStartEdit={handleStartEdit}
    onCloseEdit={handleCloseEdit}
  />
))}
```

---

## 2. DayGroup — repassar props

```tsx
// src/components/transactions/DayGroup.tsx
type DayGroupProps = {
  group: DayGroup
  editandoId: number | null
  onStartEdit: (id: number) => void
  onCloseEdit: () => void
}

export function DayGroup({ group, editandoId, onStartEdit, onCloseEdit }: DayGroupProps) {
  return (
    <div className="mt-3">
      {/* cabeçalho do grupo — sem mudança */}
      <div className="flex items-center gap-3 py-1 mb-0.5">
        <span className="text-2xs font-medium text-muted-foreground uppercase tracking-wide">
          {group.label}
        </span>
        <div className="flex-1 h-px bg-border" />
        <span className="text-2xs text-muted-foreground font-mono">
          {formatCurrency(group.saldo)}
        </span>
      </div>

      {group.transactions.map(t => (
        <TransactionRow
          key={t.id}
          transaction={t}
          isEditing={editandoId === t.id}
          onStartEdit={() => onStartEdit(t.id)}
          onCloseEdit={onCloseEdit}
        />
      ))}
    </div>
  )
}
```

---

## 3. TransactionRow — modo normal e modo edição

Este é o componente principal. Ele renderiza dois estados diferentes baseados na prop `isEditing`.

```tsx
// src/components/transactions/TransactionRow.tsx
import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateTransaction, deleteTransaction, fetchCategories, fetchAccounts } from '@/lib/api'
import { formatCurrency, formatDateForInput, parseInputDate } from '@/lib/utils/format'
import { Transaction } from '@/types'
import { ACCOUNT_COLORS } from '@/lib/constants'

type Props = {
  transaction: Transaction
  isEditing: boolean
  onStartEdit: () => void
  onCloseEdit: () => void
}

export function TransactionRow({ transaction, isEditing, onStartEdit, onCloseEdit }: Props) {
  const queryClient = useQueryClient()

  // Form state — sincroniza quando entra em edição
  const [descricao, setDescricao] = useState('')
  const [valor,     setValor]     = useState('')
  const [catId,     setCatId]     = useState<string>('')
  const [contaId,   setContaId]   = useState<string>('')
  const [tipo,      setTipo]      = useState<'despesa' | 'receita' | 'transferencia'>('despesa')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const descInputRef = useRef<HTMLInputElement>(null)

  // Dados para os selects
  const { data: categorias = [] } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories })
  const { data: contas = [] }     = useQuery({ queryKey: ['accounts'],   queryFn: fetchAccounts   })

  // Ao entrar em edição, preencher o form com os dados atuais
  useEffect(() => {
    if (!isEditing) return
    setDescricao(limparDescricao(transaction.description))
    setValor(String(Math.abs(transaction.amount)).replace('.', ','))
    setCatId(String(transaction.category_id ?? ''))
    setContaId(String(transaction.account_id ?? ''))
    setTipo(transaction.amount > 0 ? 'receita' : 'despesa')
    setConfirmDelete(false)
    // Focar no input de descrição
    setTimeout(() => descInputRef.current?.focus(), 50)
  }, [isEditing, transaction])

  // Fechar com Escape
  useEffect(() => {
    if (!isEditing) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseEdit()
      if (e.key === 'Enter')  handleSave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isEditing, descricao, valor, catId, contaId, tipo])

  const saveMutation = useMutation({
    mutationFn: () => {
      const valorNum   = parseFloat(valor.replace(',', '.'))
      const valorFinal = tipo === 'despesa' ? -Math.abs(valorNum) : Math.abs(valorNum)
      return updateTransaction(transaction.id, {
        description: descricao,
        amount:      valorFinal,
        account_id:  Number(contaId),
        category_id: catId ? Number(catId) : null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      onCloseEdit()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTransaction(transaction.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      onCloseEdit()
    },
  })

  function handleSave() {
    if (saveMutation.isPending) return
    saveMutation.mutate()
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    deleteMutation.mutate()
  }

  // Índice da conta para cor do dot
  const contaIndex = contas.findIndex(c => String(c.id) === contaId)
  const dotColor   = ACCOUNT_COLORS[contaIndex % ACCOUNT_COLORS.length] ?? '#888'

  // ── MODO NORMAL ──────────────────────────────────────────────
  if (!isEditing) {
    return (
      <div
        className="group grid items-center gap-3 px-3 py-2 rounded-lg
                   hover:bg-muted/50 transition-colors cursor-pointer"
        style={{ gridTemplateColumns: '1fr 130px 110px 90px 24px' }}
        onClick={onStartEdit}
      >
        {/* Descrição */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium truncate">
            {limparDescricao(transaction.description)}
            {transaction.installment_current && transaction.installment_total && (
              <span className="shrink-0 px-1.5 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: '#EEEDFE', color: '#3C3489', fontSize: '10px' }}>
                {transaction.installment_current}/{transaction.installment_total}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDateDisplay(transaction.date)}
          </p>
        </div>

        {/* Categoria */}
        <div>
          {transaction.category_name ? (
            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                  style={{
                    background: transaction.category_color ?? '#E1F5EE',
                    color:      transaction.category_text_color ?? '#085041',
                  }}>
              {transaction.category_name}
            </span>
          ) : (
            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                  style={{ background:'#FAEEDA', color:'#633806', border:'0.5px solid rgba(239,159,39,.4)' }}>
              Pendente
            </span>
          )}
        </div>

        {/* Conta */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: ACCOUNT_COLORS[
                  contas.findIndex(c => c.id === transaction.account_id) % ACCOUNT_COLORS.length
                ] ?? '#888' }} />
          <span className="truncate">{transaction.account_name}</span>
        </div>

        {/* Valor */}
        <span className={cn(
          "font-mono text-sm font-medium text-right",
          transaction.amount < 0 ? "text-destructive" : "text-primary"
        )}>
          {formatCurrency(transaction.amount)}
        </span>

        {/* Ícone editar (hover) */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity
                        w-5 h-5 flex items-center justify-center text-muted-foreground">
          <Pencil size={11} />
        </div>
      </div>
    )
  }

  // ── MODO EDIÇÃO ───────────────────────────────────────────────
  return (
    <div className="rounded-xl overflow-hidden my-0.5"
         style={{ border: '1.5px solid #1D9E75', background: 'var(--color-background-secondary)' }}>

      {/* Linha de inputs — mesmo grid do modo normal */}
      <div className="grid items-center gap-3 px-3 py-2"
           style={{ gridTemplateColumns: '1fr 130px 110px 90px 24px' }}>

        {/* Descrição */}
        <div className="min-w-0">
          <input
            ref={descInputRef}
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            className="w-full bg-transparent text-sm font-medium text-foreground outline-none
                       border-b border-primary/50 focus:border-primary pb-0.5
                       placeholder:text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {formatDateDisplay(transaction.date)}
            {transaction.installment_current && (
              <> · parcela {transaction.installment_current}/{transaction.installment_total}</>
            )}
          </p>
        </div>

        {/* Categoria */}
        <select
          value={catId}
          onChange={e => setCatId(e.target.value)}
          className="w-full text-xs font-medium px-2 py-1 rounded-full outline-none cursor-pointer
                     border border-primary/40 bg-primary/10 text-primary
                     focus:ring-0 font-sans"
        >
          <option value="">Pendente</option>
          {categorias.map(c => (
            <option key={c.id} value={String(c.id)}>
              {c.name ?? c.nome}
            </option>
          ))}
        </select>

        {/* Conta */}
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
          <select
            value={contaId}
            onChange={e => setContaId(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-xs text-muted-foreground
                       outline-none cursor-pointer border-none font-sans"
          >
            {contas.map(c => (
              <option key={c.id} value={String(c.id)}>
                {c.name ?? c.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Valor */}
        <input
          value={valor}
          onChange={e => setValor(e.target.value)}
          className={cn(
            "w-full bg-transparent font-mono text-sm font-medium text-right outline-none",
            "border-b border-primary/50 focus:border-primary pb-0.5",
            tipo === 'despesa' ? "text-destructive" : "text-primary"
          )}
        />

        {/* Fechar */}
        <button
          onClick={onCloseEdit}
          className="w-5 h-5 flex items-center justify-center rounded
                     text-muted-foreground hover:text-foreground transition-colors">
          <X size={13} />
        </button>
      </div>

      {/* Barra de ações */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50">

        {/* Tipo */}
        <div className="flex gap-1 mr-auto">
          {(['despesa', 'receita', 'transferencia'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                tipo === t && t === 'despesa'
                  ? "bg-red-50   border-red-200   text-red-700   dark:bg-red-950/50   dark:border-red-800   dark:text-red-300"
                  : tipo === t && t === 'receita'
                  ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/50 dark:border-green-800 dark:text-green-300"
                  : tipo === t && t === 'transferencia'
                  ? "bg-blue-50  border-blue-200  text-blue-700  dark:bg-blue-950/50  dark:border-blue-800  dark:text-blue-300"
                  : "bg-muted border-border text-muted-foreground hover:text-foreground"
              )}>
              {t === 'despesa' ? 'Despesa' : t === 'receita' ? 'Receita' : 'Transferência'}
            </button>
          ))}
        </div>

        {/* Excluir */}
        <button
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className={cn(
            "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
            confirmDelete
              ? "bg-destructive/15 border-destructive/40 text-destructive"
              : "bg-muted border-border text-muted-foreground hover:text-destructive hover:border-destructive/40"
          )}>
          {deleteMutation.isPending ? '...' : confirmDelete ? 'Confirmar exclusão' : 'Excluir'}
        </button>

        {/* Cancelar */}
        <button
          onClick={onCloseEdit}
          className="px-2.5 py-1 rounded-md text-xs font-medium border border-border
                     bg-muted text-muted-foreground hover:text-foreground transition-colors">
          Cancelar
        </button>

        {/* Salvar */}
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="px-3 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground
                     hover:opacity-90 transition-opacity disabled:opacity-50">
          {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}
```

---

## 4. Funções auxiliares

Adicionar em `src/lib/utils/format.ts`:

```typescript
// Remove " - Parcela X/Y" da descrição — o badge já mostra isso
export function limparDescricao(description: string): string {
  return description.replace(/\s*[-–]\s*Parcela\s+\d+\/\d+/i, '').trim()
}

// "2026-03-04" → "04/03/2026"
export function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00')
  return d.toLocaleDateString('pt-BR')
}

// "04/03/2026" → "2026-03-04"
export function parseInputDate(dateStr: string): string {
  const [day, month, year] = dateStr.split('/')
  return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`
}
```

---

## 5. Funções de API

Verificar em `src/lib/api.ts`. Adicionar se não existirem:

```typescript
// Verificar em api.py o endpoint exato — pode ser PATCH ou PUT
export async function updateTransaction(id: number, data: Partial<Transaction>) {
  const res = await fetch(`/api/transactions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Erro ao salvar')
  return res.json()
}

// Verificar em api.py — pode ser DELETE /api/transactions?id= ou /api/transactions/{id}
export async function deleteTransaction(id: number) {
  const res = await fetch(`/api/transactions?id=${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Erro ao excluir')
  return res.json()
}
```

> Antes de implementar: abrir `api.py` e confirmar os métodos HTTP e formato de URL dos endpoints de update e delete. Ajustar acima conforme necessário.

---

## 6. Tipos TypeScript

Confirmar que `Transaction` em `src/types/` tem os campos abaixo. Adicionar os que faltarem:

```typescript
export type Transaction = {
  id:                    number
  description:           string
  date:                  string
  amount:                number
  account_id:            number
  account_name:          string
  category_id:           number | null
  category_name:         string | null
  category_color?:       string | null  // hex do fundo do badge
  category_text_color?:  string | null  // hex do texto do badge
  installment_current?:  number | null
  installment_total?:    number | null
}
```

---

## Checklist de implementação

- [ ] Confirmar endpoints de `PATCH`/`DELETE` em `api.py` e ajustar `api.ts`
- [ ] Adicionar `updateTransaction` e `deleteTransaction` em `api.ts` se não existirem
- [ ] Adicionar `limparDescricao`, `formatDateDisplay`, `parseInputDate` em `format.ts`
- [ ] Adicionar estado `editandoId` e handlers `handleStartEdit`/`handleCloseEdit` em `Transactions.tsx`
- [ ] Passar `editandoId`, `onStartEdit`, `onCloseEdit` para `DayGroup`
- [ ] Repassar `isEditing`, `onStartEdit`, `onCloseEdit` de `DayGroup` para `TransactionRow`
- [ ] Implementar modo edição em `TransactionRow` (seção `if (!isEditing)` + seção de edição)
- [ ] Testar: clicar na linha abre edição com dados preenchidos
- [ ] Testar: clicar em outra linha fecha a edição atual e abre a nova
- [ ] Testar: `Escape` cancela sem salvar
- [ ] Testar: `Enter` salva
- [ ] Testar: salvar chama API e atualiza a lista
- [ ] Testar: excluir com dois cliques de confirmação

---

## O que NÃO fazer

- Não usar `Dialog` nem `Modal` — edição é 100% inline
- Não guardar o estado `isEditing` dentro do `TransactionRow` — fica na página pai para garantir que só uma linha edita por vez
- Não enviar o campo `date` como editável por enquanto — manter a data original da transação no save (simplifica a implementação inicial)
- Não usar `window.confirm()` para exclusão — usar o estado `confirmDelete` no botão
- Não fechar a edição antes da mutation `onSuccess` — evita UI inconsistente