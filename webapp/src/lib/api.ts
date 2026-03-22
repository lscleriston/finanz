const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface Transaction {
  id: number;
  source_file: string;
  account_name: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  details: string;
  inserted_at: string;
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
