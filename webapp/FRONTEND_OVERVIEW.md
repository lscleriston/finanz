# Visão Geral do Frontend

Este documento descreve as tecnologias usadas no frontend, como a aplicação está montada e um exemplo de apresentação da **Tela de Transações**.

**Arquitetura e tecnologias**

- Vite: bundler e dev server (rápido, ESM-first).
- React (+ JSX/TSX): biblioteca de UI.
- TypeScript: tipagem estática para componentes e API client.
- React Router: rotas e layout com `AppShell` / `Outlet`.
- TanStack Query (`@tanstack/react-query`): cache e fetch de dados do backend.
- shadcn UI (componentes): biblioteca de componentes UI usados no projeto.
- Fetch API / `lib/api.ts`: cliente HTTP simples que encapsula chamadas para `/api` (FastAPI backend).

## Estrutura principal (pasta `src`)

- `src/main.tsx` — bootstrap da aplicação; registra `QueryClientProvider` e `BrowserRouter`.
- `src/App.tsx` — rotas da aplicação e `AppShell` (header + outlet).
- `src/components/AppShell.tsx` — layout global (nav, header, áreas de conteúdo).
- `src/pages/Dashboard.tsx` (renomeado para `Transactions`) — tela principal de transações.
- `src/lib/api.ts` — funções para `fetchTransactions()`, `createTransaction()`, `fetchCategories()`, `classifyTransactions()`, etc.
- `src/components/ui/*` — componentes UI reutilizáveis (botões, inputs, modais, table, toast).

## Fluxo de dados

- A tela de Transações chama `fetchTransactions()` em `src/lib/api.ts` usando React Query para obter os dados e manter cache.
- A filtragem por conta/mês/ano é feita aplicando parâmetros na query (`account_id`, `date_from`, `date_to`).
- Operações (criar, excluir, editar) disparam mutações com React Query e invalidam a query `transactions` para recarregar a lista.

## Tela de Transações — descrição

A tela exibe:
- Filtros: seleção de conta (select), seletor mês/ano, pesquisa por texto.
- Botões rápidos: `Importar`, `Nova transação`, `Classificar agora`.
- Lista de transações agrupada por data (ou por `due_date` quando aplicável), com cabeçalho mostrando saldos/totais.
- Cada grupo (ex.: `2026-03-28`) mostra linhas com: descrição, conta, valor, categoria (se atribuída), ações (editar/excluir).

### Exemplo simplificado de apresentação (pseudocódigo JSX)

```jsx
// Trecho ilustrativo (não é cópia literal do arquivo)
function TransactionsList({ groups }) {
  return (
    <div className="transactions">
      {groups.map(group => (
        <section key={group.date} className="tx-group">
          <h3>{group.date} — {group.totalFormatted}</h3>
          <table>
            <tbody>
              {group.items.map(tx => (
                <tr key={tx.id}>
                  <td className="desc">{tx.description}</td>
                  <td className="account">{tx.account_name}</td>
                  <td className="category">{tx.category_name || '—'}</td>
                  <td className={`amount ${tx.amount < 0 ? 'debit' : 'credit'}`}>
                    {formatCurrency(tx.amount)}
                  </td>
                  <td className="actions">[Editar] [Apagar]</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  )
}
```

## Como o agrupamento é feito

- A query retorna transações ordenadas por `date`/`due_date`.
- No cliente (ou na helper), as transações são transformadas em um mapa por `date` → lista, somando totais para o cabeçalho do grupo.

## Interação com backend

- Endpoints relevantes (ver `src/lib/api.ts`):
  - `GET /api/transactions` — lista com filtros.
  - `POST /api/transactions` — cria transação manual.
  - `POST /api/transactions/classify` — aplica mapeamentos (classifica em lote).
  - `GET /api/categories`, `POST /api/category-mappings` — para gerenciamento de categorias.

## Boas práticas adotadas

- Uso de React Query para evitar fetchs redundantes e facilitar estados de loading/error.
- Componentização: componentes `ui/*` reaproveitáveis para consistência de UI.
- Rotas aninhadas (`AppShell` com `Outlet`) para manter header/nav persistentes.
- Separação `src/lib/api.ts` para facilitar testes/inspeção e evoluções do contrato API.

## Próximos exemplos que posso adicionar

- Código de amostra do componente `Dashboard/Transactions` com hooks (`useQuery`, `useMutation`).
- Exemplo de payload de criação manual de transação.
- Guia rápido para adicionar um `category_mapping` e rodar a classificação.

## Arquivos relevantes para leitura rápida

- [src/App.tsx](src/App.tsx) — rotas e layout
- [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx) — tela de transações
- [src/lib/api.ts](src/lib/api.ts) — cliente HTTP e funções de API
- [src/components/AppShell.tsx](src/components/AppShell.tsx) — layout global

---

Se quiser, adiciono agora o exemplo do componente `Transactions` com `useQuery` e `useMutation` (código completo), ou um passo-a-passo para criar mapeamentos e rodar a classificação automática.
