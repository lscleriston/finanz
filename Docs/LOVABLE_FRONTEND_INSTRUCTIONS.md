# Instruções para construir o frontend no Lovable

Este projeto já possui backend e UI em React/Vite e pode ser facilmente refeito em Lovable seguindo alguns contratos.

## Tecnologias usadas no projeto atual
- Python 3.11+ (ou 3.10)
- FastAPI (backend de API)
- SQLite (armazenamento em `data/transactions.db`)
- React + Vite (frontend atual em `webapp/`)
- PDF parsing: `pdfplumber`, `PyPDF2` (apenas para ingestão em `export_to_sqlite.py`)
- CSV / JSON / TXT / PDF para ingestão de lançamentos
- CORS configurado para `localhost:5173` e `localhost:5174`

## Objetivo para Lovable
1. Criar 2 telas ou rotas:
   - Dashboard (lista de transações + filtros + paginação + resumo)
   - Cadastro de Conta (mapear conta por caminho, salvar, excluir, recarregar importação)
2. Manter o contrato da API existente (mesmas URIs e payloads):
   - `GET /api/transactions?limit=...&offset=...&q=...&date_from=...&date_to=...`
   - `GET /api/summary`
   - `GET /api/account-mappings`
   - `POST /api/account-mappings` payload `{ path, name }`
   - `DELETE /api/account-mappings?path=...`
   - `POST /api/reload`
3. Consumer de backend:
   - Listar transações em tabela
   - Mostrar conta, data, descrição, valor e categoria (ou '-' se vazio)
   - Data formatada `DD/MM/YYYY`
   - Valor formatado `R$ 1.234,56`

## Arquitetura de páginas (sugestão)
### Dashboard
- Header: título + botão/navegação para Cadastro de Conta.
- Card de resumo com total de lançamentos e total de valores.
- Filtros:
  - texto livre (`q`) para descrição/categoria/file
  - intervalo de datas (`date_from`,`date_to`)
- Tabela de transações:
  - Colunas: `ID`, `Conta`, `Data`, `Descrição`, `Valor`, `Categoria`.
- Paginação com botão Anterior/Próxima.

### Cadastro de Conta
- Formulário:
  - `Caminho da conta` (p.ex. "CartaoCredito/Bradesco")
  - `Nome da conta` (p.ex. "Bradesco")
  - botão Salvar (POST `/api/account-mappings`)
- Lista de mapeamentos existentes com botão Excluir (DELETE `/api/account-mappings`).
- Botão `Recarregar dados` que chama POST `/api/reload`.

## Regras de dados
- O processamento original espera que contas se baseiem em `path`:
  - `CartaoCredito/Bradesco` gera `Bradesco` (quando mapeado para nome)
- O banco já aplica `INSERT OR IGNORE` para evitar duplicação.
- Categorias podem ser inferidas no backend pelo campo `category` se presente.

## Corpo de API esperado (exemplos)
### `GET /api/transactions`
Resposta:
```json
[
  {
    "id": 1,
    "source_file": "CartaoCredito/Bradesco/arquivo.pdf",
    "account_name": "Bradesco",
    "date": "2026-02-15",
    "description": "SUPERMERCADO X",
    "amount": -250.45,
    "category": "Alimentação",
    "details": "...",
    "inserted_at": "2026-03-21T12:00:00"
  }
]
```

### `GET /api/summary`
Resposta:
```json
{ "total_records": 250, "total_amount": -12000.50 }
```

## Dicas de integração Lovable
- Use store/state para `pageView` (`dashboard` / `accounts`).
- Reaproveite o esquema de fetch/api como um serviço independente.
- Se houver suporte para componentes de tabela/carrossel, use para `transactions`.
- Formatação local:
  - `new Intl.DateTimeFormat('pt-BR')`
  - `new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`

## Teste pós-migração
1. Execute `uvicorn api:app --reload`.
2. Execute `python3 export_to_sqlite.py` (ou use botão `Recarregar` do frontend).
3. Abra o Lovable frontend e valide:
   - filtros de data e texto funcionam
   - cadastro e exclusão de contas atualiza listagem
   - recarregar importação repopula o dashboard

## Observação final
Ao finalizar a implementação em Lovable, copie o fluxo de navegação e os nomes de campos idênticos para não quebrar dependências. O backend atual não precisa ser alterado para o frontend passar a funcionar.
