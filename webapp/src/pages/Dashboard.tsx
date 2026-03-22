import { useState, useEffect, useCallback, useRef } from "react";
import { fetchTransactions, fetchSummary, fetchAccounts, createAccount, createTransaction, deleteTransaction, type Transaction, type Summary } from "@/lib/api";
import { formatDate, formatCurrency } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";

const PAGE_SIZE = 20;

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [accounts, setAccounts] = useState<{ id: number; name: string; path: string; tipo: string; invert_values: boolean }[]>([]);
  const [accountFilterIds, setAccountFilterIds] = useState<number[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(undefined);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountTipo, setNewAccountTipo] = useState("");
  const [newAccountInvert, setNewAccountInvert] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const offsetRef = useRef(0);

  const loadPage = useCallback(
    async (isReset = false) => {
      if (!hasMore && !isReset) return;

      if (isReset) {
        setLoading(true);
        setHasMore(true);
        offsetRef.current = 0;
      } else {
        setLoadingMore(true);
      }

      try {
        const offset = offsetRef.current;
        const txns = await fetchTransactions({
          limit: PAGE_SIZE,
          offset,
          q,
          date_from: dateFrom,
          date_to: dateTo,
        });

        if (isReset) {
          setTransactions(txns);
        } else {
          setTransactions((prev) => [...prev, ...txns]);
        }

        offsetRef.current = offset + txns.length;

        if (txns.length < PAGE_SIZE) {
          setHasMore(false);
        }

        const sum = await fetchSummary();
        setSummary(sum);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [dateFrom, dateTo, hasMore, q]
  );

  useEffect(() => {
    loadPage(true);

    async function loadAccounts() {
      try {
        const data = await fetchAccounts();
        setAccounts(data);
        setAccountFilterIds(data.map((item) => item.id));
        if (data.length > 0 && selectedAccountId === undefined) {
          setSelectedAccountId(data[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    }

    loadAccounts();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    setHasMore(true);
    setTransactions([]);
    offsetRef.current = 0;
    loadPage(true);
  };

  const handleAddTransaction = async () => {
    if (!newDate || !newDescription || !newAmount) {
      alert("Preencha data, descrição e valor para adicionar.");
      return;
    }

    const parsedAmount = Number(newAmount.toString().replace(',', '.'));
    if (Number.isNaN(parsedAmount)) {
      alert("Valor inválido");
      return;
    }

    try {
      await createTransaction({
        account_id: selectedAccountId,
        account_name: accounts.find((c) => c.id === selectedAccountId)?.name || "-",
        date: newDate,
        description: newDescription,
        amount: parsedAmount,
        category: newCategory,
        source_file: "manual",
      });

      setNewDate("");
      setNewDescription("");
      setNewAmount("");
      setNewCategory("");

      setHasMore(true);
      setTransactions([]);
      offsetRef.current = 0;
      loadPage(true);
    } catch (e) {
      console.error(e);
      alert("Erro ao adicionar transação: " + e);
    }
  };

  const handleCreateAccount = async () => {
    if (!newAccountName.trim() || !newAccountTipo.trim()) {
      alert("Informe o nome e o tipo da conta");
      return;
    }

    try {
      const acc = await createAccount({
        name: newAccountName.trim(),
        tipo: newAccountTipo.trim(),
        invert_values: newAccountInvert,
      });
      setAccounts((prev) => [...prev, acc]);
      setSelectedAccountId(acc.id);
      setNewAccountName("");
      setNewAccountTipo("");
      setNewAccountInvert(false);
    } catch (e) {
      console.error(e);
      alert("Erro ao criar conta: " + e);
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    if (!window.confirm("Excluir transação id " + id + "?")) return;

    try {
      await deleteTransaction(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      const sum = await fetchSummary();
      setSummary(sum);
    } catch (e) {
      console.error(e);
      alert("Erro ao excluir transação: " + e);
    }
  };

  useEffect(() => {
    const onScroll = () => {
      if (loading || loadingMore || !hasMore) return;

      const reachedBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 200;
      if (reachedBottom) {
        loadPage(false);
      }
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasMore, loading, loadingMore, loadPage]);

  const filteredTransactions = accountFilterIds.length
    ? transactions.filter((tx) => tx.account_id && accountFilterIds.includes(tx.account_id))
    : transactions;

  const filteredTotalAmount = filteredTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const groupedTransactions = filteredTransactions.reduce((acc, tx) => {
    const key = tx.date || "Sem data";
    if (!acc[key]) acc[key] = [];
    acc[key].push(tx);
    return acc;
  }, {} as Record<string, Transaction[]>);

  const dates = Object.keys(groupedTransactions).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Descrição, categoria, arquivo…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">De</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Até</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
          </div>
          <Button onClick={handleSearch}>Filtrar</Button>
        </CardContent>
      </Card>

      {/* Account registration */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex-1 min-w-[220px]">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tipo da conta</label>
            <Input value={newAccountTipo} onChange={(e) => setNewAccountTipo(e.target.value)} placeholder="CartaoCredito / ContaCorrente" />
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nome da conta</label>
            <Input value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} placeholder="Bradesco" />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="new-account-invert"
              type="checkbox"
              checked={newAccountInvert}
              onChange={(e) => setNewAccountInvert(e.target.checked)}
              className="h-4 w-4 rounded border"
            />
            <label htmlFor="new-account-invert" className="text-xs text-muted-foreground">Inverter valores importados</label>
          </div>
          <Button onClick={handleCreateAccount}>Criar conta</Button>
        </CardContent>
      </Card>

      {/* Manual entry */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[220px]">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Conta</label>
            <select
              value={selectedAccountId ?? ""}
              onChange={(e) => setSelectedAccountId(Number(e.target.value))}
              className="w-full rounded border p-2"
            >
              <option value="">Selecionar conta</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Data</label>
            <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[280px]">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Descrição</label>
            <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
          </div>
          <div className="min-w-[120px]">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Valor</label>
            <Input value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
          </div>
          <div className="min-w-[140px]">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Categoria</label>
            <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
          </div>
          <Button onClick={handleAddTransaction}>Adicionar lançamento</Button>
        </CardContent>
      </Card>

      {/* Transactions table with account filter */}
      <Card>
        <CardContent className="p-0 overflow-auto">
          <div className="flex gap-4">
            <aside className="w-60 border-r p-4">
              <h2 className="text-sm font-semibold mb-2">Filtro de contas</h2>
              <div className="space-y-1">
                {accounts.map((acc) => (
                  <label key={acc.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={accountFilterIds.includes(acc.id)}
                      onChange={() => {
                        setAccountFilterIds((prev) =>
                          prev.includes(acc.id) ? prev.filter((id) => id !== acc.id) : [...prev, acc.id]
                        );
                      }}
                      className="h-4 w-4 rounded border"
                    />
                    {acc.name}
                  </label>
                ))}
              </div>
              <button
                className="mt-3 rounded bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground"
                onClick={() => setAccountFilterIds(accounts.map((a) => a.id))}
              >
                Selecionar todos
              </button>
              <button
                className="mt-2 rounded bg-muted px-2 py-1 text-xs"
                onClick={() => setAccountFilterIds([])}
              >
                Limpar filtro
              </button>
            </aside>
            <div className="flex-1">
              <Table>
                <TableCaption>
                  Total acumulado: <strong>{formatCurrency(filteredTotalAmount)}</strong>
                </TableCaption>
                <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead className="w-28">Data</TableHead>
                <TableHead className="w-32">Data Orig</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right w-32">Valor</TableHead>
                <TableHead className="w-36">Categoria</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    Nenhuma transação encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                dates.flatMap((date) => [
                  <TableRow key={`${date}-header`} className="bg-muted/10">
                    <TableCell colSpan={7} className="font-semibold">
                      {date === "Sem data" ? "Sem data" : formatDate(date)}
                    </TableCell>
                  </TableRow>,
                  ...groupedTransactions[date].map((tx) => (
                    <TableRow key={tx.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-xs text-muted-foreground">{tx.id}</TableCell>
                      <TableCell className="font-medium">{tx.account_name || "-"}</TableCell>
                      <TableCell className="font-mono text-sm">{formatDate(tx.date)}</TableCell>
                      <TableCell className="font-mono text-sm">{tx.original_date ? formatDate(tx.original_date) : "-"}</TableCell>
                      <TableCell className="max-w-[280px] truncate">{tx.description}</TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${tx.amount < 0 ? "text-danger" : "text-success"}`}>
                        {formatCurrency(tx.amount)}
                      </TableCell>
                      <TableCell>
                        {tx.category ? (
                          <span className="inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">{tx.category}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteTransaction(tx.id)}>
                          Excluir
                        </Button>
                      </TableCell>
                    </TableRow>
                  )),
                ])
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </CardContent>

        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Mostrando 1–{transactions.length} {hasMore ? "(rolagem infinita ativada)" : "(fim dos resultados)"}
          </p>
          <p className="text-sm font-medium">
            {loadingMore && "Carregando mais..."}
            {!loading && !loadingMore && !hasMore && "Todas as transações carregadas."}
          </p>
        </div>
      </Card>

      {hasMore && !loadingMore && (
        <div className="flex justify-center">
          <Button onClick={() => loadPage(false)}>Carregar mais</Button>
        </div>
      )}
      {loadingMore && <p className="text-center text-sm text-muted-foreground">Carregando mais transações...</p>}
    </div>
  );
}
