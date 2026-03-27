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
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [accounts, setAccounts] = useState<{ id: number; name: string; path: string; tipo: string; invert_values: boolean }[]>([]);
  const [accountFilterIds, setAccountFilterIds] = useState<number[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(undefined);
  const [showAllDates, setShowAllDates] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newRepeatCount, setNewRepeatCount] = useState<number>(1);
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
        const from = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
        const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
        const to = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

        const params: Record<string, unknown> = {
          limit: PAGE_SIZE,
          offset,
          q,
        };

        if (!showAllDates) {
          params.date_from = from;
          params.date_to = to;
        }

        const txns = await fetchTransactions(params);

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
    [selectedMonth, selectedYear, showAllDates, hasMore, q]
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
    if (!selectedAccountId) {
      alert("Selecione a conta antes de adicionar uma transação.");
      return;
    }

    if (!newDate || !newDescription || !newAmount) {
      alert("Preencha data, descrição e valor para adicionar.");
      return;
    }

    const parsedAmount = Number(newAmount.toString().replace(',', '.'));
    if (Number.isNaN(parsedAmount)) {
      alert("Valor inválido");
      return;
    }
    const repeatCount = Number(newRepeatCount) || 1;

    function addMonthsToDate(dateStr: string, months: number) {
      const d = new Date(dateStr);
      const day = d.getDate();
      const newD = new Date(d.getFullYear(), d.getMonth() + months, day);
      return newD.toISOString().split("T")[0];
    }

    try {
      for (let i = 0; i < repeatCount; i++) {
        const txnDate = i === 0 ? newDate : addMonthsToDate(newDate, i);
        await createTransaction({
          account_id: selectedAccountId,
          account_name: accounts.find((c) => c.id === selectedAccountId)?.name || "-",
          date: txnDate,
          description: newDescription,
          amount: parsedAmount,
          category: newCategory,
          source_file: "manual",
        });
      }

      setNewDate("");
      setNewDescription("");
      setNewAmount("");
      setNewCategory("");
      setNewRepeatCount(1);

      try {
        setHasMore(true);
        setTransactions([]);
        offsetRef.current = 0;
        await loadPage(true);
      } catch (refreshError) {
        console.error("Transação(s) criadas, mas falha ao recarregar:", refreshError);
        alert("Transação(s) criadas com sucesso, mas houve falha ao recarregar a lista: " + refreshError);
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao adicionar transação: " + e);
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

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (!a.date || !b.date) return 0;
    if (a.date < b.date) return 1;
    if (a.date > b.date) return -1;
    return 0;
  });

  const filteredTotalAmount = sortedTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const groupedTransactions = sortedTransactions.reduce((acc, tx) => {
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
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Mês</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-40 rounded border p-2"
            >
              <option value={1}>Jan</option>
              <option value={2}>Fev</option>
              <option value={3}>Mar</option>
              <option value={4}>Abr</option>
              <option value={5}>Mai</option>
              <option value={6}>Jun</option>
              <option value={7}>Jul</option>
              <option value={8}>Ago</option>
              <option value={9}>Set</option>
              <option value={10}>Out</option>
              <option value={11}>Nov</option>
              <option value={12}>Dez</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Ano</label>
            <Input
              type="number"
              min={2000}
              max={2100}
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-28"
            />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              id="show-all-dates"
              type="checkbox"
              checked={showAllDates}
              onChange={(e) => setShowAllDates(e.target.checked)}
              className="h-4 w-4 rounded border"
            />
            <label htmlFor="show-all-dates" className="text-xs text-muted-foreground">Mostrar todas as datas</label>
          </div>
          <Button onClick={handleSearch}>Filtrar</Button>
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
          <div className="min-w-[140px]">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Repetições</label>
            <Input
              type="number"
              min={1}
              max={120}
              value={newRepeatCount}
              onChange={(e) => setNewRepeatCount(Number(e.target.value))}
            />
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
              <div className="p-4 border-b bg-background/50">
                <span className="text-sm font-medium">Total acumulado:</span>
                <span className="ml-2 text-lg font-bold">{formatCurrency(filteredTotalAmount)}</span>
              </div>
              <Table>
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
