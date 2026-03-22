# Finanz

Aplicação para importação e análise de transações financeiras de múltiplas fontes.

## Características principais

- Importação automática de extratos CSV / JSON / TXT / PDF (pdfplumber / PyPDF2)
- Normalização de valores (brasileiro: `1.234,56`) em número flutuante
- Regras específicas para cartões de crédito Bradesco (sinal invertido)
- Armazenamento em SQLite (`data/transactions.db`)
- API REST com FastAPI para consulta e manipulação:
  - `GET /api/transactions`
  - `GET /api/summary`
  - `POST /api/transactions` (inserção manual)
  - `DELETE /api/transactions?id=` (exclusão)
  - `POST /api/reload` (recarregar todos arquivos da pasta `export`, preservando contas existentes)

- Dashboard em React/Tailwind:
  - Filtros (busca, intervalo de datas)
  - Rolagem infinita com paginação por incremento
  - Inserção e exclusão individual de lançamentos
  - Resumo em tempo real (total de registros + total montante)

## Estrutura

- `api.py`: backend FastAPI
- `export_to_sqlite.py`: importador de dados do diretório `export`
- `inspect_pdf.py`: utilitário para inspeção de PDFs
- `webapp/`: frontend Vite + React

## Como executar

1. Ativar virtualenv:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
2. Instalar dependências:
   ```bash
   pip install -r requirements.txt
   cd webapp
   npm ci
   ```
3. Reprocessar dados:
   ```bash
   cd /opt/finanz
   python3 export_to_sqlite.py
   ```
4. Iniciar backend:
   ```bash
   uvicorn api:app --reload
   ```
5. Iniciar frontend:
   ```bash
   cd webapp
   npm run dev
   ```

## Notas

- Se `pdfplumber` / `PyPDF2` não estiver instalado, PDFs não são processados.
- Ajustes de extração de PDF podem ser feitos em `export_to_sqlite.py`.
- `account_mappings.json` em `data/` permite mapear caminhos de arquivos para nomes de conta.
