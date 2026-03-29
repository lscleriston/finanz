# Finanz

Aplicação para importação, normalização, classificação e visualização de transações financeiras.

## Visão geral

- Importador versátil que consome CSV / JSON / TXT / PDF e normaliza lançamentos (valores, datas, parcelas).
- Banco de dados SQLite em `data/finanzdb.db` com tabelas para `transactions`, `accounts`, `categories` e `category_mappings`.
- Backend com FastAPI expondo uma API REST para leitura, escrita e operações de manutenção (classificação, migração).
- Frontend em React + Vite (TypeScript) com interface para filtros, criação manual, importação e gerenciamento de categorias.

## Tecnologias principais

- Python 3 + FastAPI + Uvicorn (backend)
- SQLite para armazenamento local (`data/finanzdb.db`)
- Frontend: Vite, React, TypeScript, React Router, TanStack Query (@tanstack/react-query)
- UI: shadcn UI / componentes customizados + Tailwind CSS
- Importação de PDFs (quando disponível): `pdfplumber` / `PyPDF2`

## Estrutura do repositório

- `api.py` — backend FastAPI e definição de endpoints
- `export_to_sqlite.py` — importador + criação/esquema do banco
- `inspect_pdf.py` — utilitários para inspecionar PDFs
- `data/` — banco `finanzdb.db`, backups e `account_mappings.json`
- `webapp/` — frontend (Vite + React + TypeScript)

Dentro de `webapp/src` (resumo):
- `main.tsx` — bootstrap (QueryClientProvider, Router)
- `App.tsx` — rotas e layout (AppShell)
- `lib/api.ts` — cliente HTTP para `/api`
- `pages/` — páginas (Transactions/Dashboard, Categories, CategoryMappings, Import)
- `components/` — AppShell, NavLink e componentes UI reutilizáveis

## Endpoints úteis

- `GET /api/transactions` — lista transações (aceita filtros `account_id`, `date_from`, `date_to`)
- `POST /api/transactions` — criar transação manual
- `DELETE /api/transactions?id=` — remover transação
- `POST /api/transactions/classify` — aplica `category_mappings` às transações
- `POST /api/migrate-categories` — cria categorias a partir do texto em `transactions.category` e associa `category_id` (faz backup do DB por padrão)
- `GET/POST /api/categories` e `GET/POST /api/category-mappings` — CRUD de categorias e mapeamentos

## Como rodar (desenvolvimento)

1. Preparar ambiente Python

```bash
cd /opt/finanz
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Iniciar backend

```bash
.venv/bin/uvicorn api:app --host 0.0.0.0 --port 8011 --reload
```

3. Frontend (em outro terminal)

```bash
cd webapp
npm ci
npm run dev   # por padrão tenta usar 5173; caso esteja em uso usará outra porta (ex.: 5177)
```

4. Importar / reprocessar dados

```bash
python3 export_to_sqlite.py
# ou usar o endpoint de import via frontend: POST /api/import
```

## Backups e segurança

- O endpoint `POST /api/migrate-categories` cria um backup do banco em `data/finanzdb.db.bak.<timestamp>` antes de alterar dados.
- Evite commitar arquivos grandes no repositório (há um backup local movido para `backups/` durante manutenção).

## Fluxo típico (classificação)

1. Criar `category_mappings` via UI ou `POST /api/category-mappings` (ex.: pattern, match_type, category_id, priority).
2. Rodar `POST /api/transactions/classify` para aplicar os mapeamentos às transações (parâmetro `force=true` sobrescreve categorias existentes).

## Onde olhar primeiro

- Backend: [api.py](api.py)
- Importador e DDL: [export_to_sqlite.py](export_to_sqlite.py)
- Frontend: [webapp/src/lib/api.ts](webapp/src/lib/api.ts) e [webapp/src/pages/Dashboard.tsx](webapp/src/pages/Dashboard.tsx)

---

Se quiser, atualizo o `README.md` com instruções de deploy/produção (systemd, nginx) ou adiciono exemplos de payloads das APIs.
