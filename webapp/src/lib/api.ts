const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8011"; // backend em 8011 para evitar conflito em dev

export interface Transaction {
  id: number;
  source_file: string;
  account_name: string;
  account_id?: number;
  date: string;
  original_date?: string;
  description: string;
  amount: number;
  category: string;
  category_id?: number;
  details: string;
  inserted_at: string;
}

export interface Account {
  id: number;
  name: string;
  path: string;
  tipo: string;
  invert_values: boolean;
}

export interface Summary {
  total_records: number;
  total_amount: number;
}

export interface AccountMapping {
  path: string;
  name: string;
}

export async function fetchTransactions(params: {
  limit?: number;
  offset?: number;
  q?: string;
  date_from?: string;
  date_to?: string;
}): Promise<Transaction[]> {
  const url = new URL(`${API_BASE}/api/transactions`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  });
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Erro ao buscar transações");
  return res.json();
}

export async function fetchSummary(): Promise<Summary> {
  const res = await fetch(`${API_BASE}/api/summary`);
  if (!res.ok) throw new Error("Erro ao buscar resumo");
  return res.json();
}

export async function fetchAccountMappings(): Promise<AccountMapping[]> {
  const res = await fetch(`${API_BASE}/api/account-mappings`);
  if (!res.ok) throw new Error("Erro ao buscar mapeamentos");
  return res.json();
}

export async function createAccountMapping(mapping: AccountMapping): Promise<void> {
  const res = await fetch(`${API_BASE}/api/account-mappings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mapping),
  });
  if (!res.ok) throw new Error("Erro ao salvar mapeamento");
}

export async function deleteAccountMapping(path: string): Promise<void> {
  const url = new URL(`${API_BASE}/api/account-mappings`);
  url.searchParams.set("path", path);
  const res = await fetch(url.toString(), { method: "DELETE" });
  if (!res.ok) throw new Error("Erro ao excluir mapeamento");
}

export async function fetchAccounts(): Promise<Account[]> {
  const res = await fetch(`${API_BASE}/api/accounts`);
  if (!res.ok) throw new Error("Erro ao buscar contas");
  return res.json();
}

export async function createAccount(data: { name: string; tipo: string; invert_values?: boolean }): Promise<Account> {
  const res = await fetch(`${API_BASE}/api/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erro ao criar conta");
  return res.json();
}

export async function deleteAccount(id: number): Promise<void> {
  const url = new URL(`${API_BASE}/api/accounts`);
  url.searchParams.set("id", String(id));
  const res = await fetch(url.toString(), { method: "DELETE" });
  if (!res.ok) throw new Error("Erro ao excluir conta");
}

export async function importFiles(accountId: number, files: File[], billingDate?: string): Promise<{ status: string; saved_files: string[]; imported_account_id: number; }> {
  const formData = new FormData();
  formData.append("account_id", String(accountId));
  if (billingDate) {
    formData.append("billing_date", billingDate);
  }
  files.forEach((file) => formData.append("files", file));
  const res = await fetch(`${API_BASE}/api/import`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro ao importar arquivos: ${text}`);
  }
  return res.json();
}

export async function createTransaction(data: {
  source_file?: string;
  account_name?: string;
  account_id?: number;
  date?: string;
  description?: string;
  amount?: number;
  category?: string;
  details?: string;
}): Promise<Transaction> {
  const res = await fetch(`${API_BASE}/api/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erro ao criar transação");
  return res.json();
}

export async function deleteTransaction(id: number): Promise<void> {
  const url = new URL(`${API_BASE}/api/transactions`);
  url.searchParams.set("id", String(id));
  const res = await fetch(url.toString(), { method: "DELETE" });
  if (!res.ok) throw new Error("Erro ao excluir transação");
}

export async function reloadData(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/reload`, { method: "POST" });
  if (!res.ok) throw new Error("Erro ao recarregar dados");
}

// Categories & Mappings
export interface Category {
  id: number;
  name: string;
  description?: string;
  parent_id?: number;
}

export interface CategoryMapping {
  id: number;
  pattern: string;
  match_type: string;
  category_id: number;
  priority: number;
  active: boolean;
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_BASE}/api/categories`);
  if (!res.ok) throw new Error("Erro ao buscar categorias");
  return res.json();
}

export async function createCategory(data: { name: string; description?: string }): Promise<Category> {
  const res = await fetch(`${API_BASE}/api/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erro ao criar categoria");
  return res.json();
}

export async function fetchCategoryMappings(): Promise<CategoryMapping[]> {
  const res = await fetch(`${API_BASE}/api/category-mappings`);
  if (!res.ok) throw new Error("Erro ao buscar mapeamentos de categoria");
  return res.json();
}

export async function createCategoryMapping(data: { pattern: string; match_type?: string; category_id: number; priority?: number; active?: boolean }): Promise<CategoryMapping> {
  const res = await fetch(`${API_BASE}/api/category-mappings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erro ao criar mapeamento");
  return res.json();
}

export async function classifyTransactions(opts?: { force?: boolean; date_from?: string; date_to?: string; account_id?: number }): Promise<{ updated: number }> {
  const params = new URLSearchParams();
  if (opts?.force) params.set("force", "true");
  if (opts?.date_from) params.set("date_from", opts.date_from);
  if (opts?.date_to) params.set("date_to", opts.date_to);
  if (opts?.account_id) params.set("account_id", String(opts.account_id));
  const res = await fetch(`${API_BASE}/api/transactions/classify?${params.toString()}`, { method: "POST" });
  if (!res.ok) throw new Error("Erro ao executar classificação");
  return res.json();
}

export async function migrateCategories(opts?: { create_backup?: boolean }): Promise<any> {
  const res = await fetch(`${API_BASE}/api/migrate-categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ create_backup: opts?.create_backup ?? true }),
  });
  if (!res.ok) throw new Error("Erro ao migrar categorias");
  return res.json();
}
