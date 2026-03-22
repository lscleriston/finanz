const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8010"; // backend está no 8010 quando 8000 ocupado

export interface Transaction {
  id: number;
  source_file: string;
  account_name: string;
  account_id?: number;
  date: string;
  description: string;
  amount: number;
  category: string;
  details: string;
  inserted_at: string;
}

export interface Account {
  id: number;
  name: string;
  path: string;
  tipo: string;
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
  const res = await fetch(url.toString());
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

export async function createAccount(data: { name: string; tipo: string }): Promise<Account> {
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

export async function importFiles(accountId: number, files: File[]): Promise<{ status: string; saved_files: string[]; imported_account_id: number; }> {
  const formData = new FormData();
  formData.append("account_id", String(accountId));
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
