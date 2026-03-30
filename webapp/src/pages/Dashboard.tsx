import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { fetchTransactions, fetchSummary, fetchAccounts, fetchCategories, createAccount, createTransaction, deleteTransaction, type Transaction, type Summary } from "@/lib/api";
import TransactionFilters from "@/components/transactions/TransactionFilters";
import TransactionsList from "@/components/transactions/TransactionsList";
import TransactionSummaryBar from "@/components/transactions/TransactionSummaryBar";
import AddTransactionModal from "@/components/transactions/AddTransactionModal";
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
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [categoryFilterIds, setCategoryFilterIds] = useState<number[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(undefined);
  const [showAllDates, setShowAllDates] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newRepeatCount, setNewRepeatCount] = useState<number>(1);
  const offsetRef = useRef(0);

  const loadPage = useCallback(
    async (isReset = false, monthParam?: number, yearParam?: number) => {
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
        const useMonth = monthParam ?? selectedMonth;
        const useYear = yearParam ?? selectedYear;
        const from = `${useYear}-${String(useMonth).padStart(2, "0")}-01`;
        const lastDay = new Date(useYear, useMonth, 0).getDate();
        const to = `${useYear}-${String(useMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

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
    async function init() {
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

      try {
        const cats = await fetchCategories();
        setCategories(cats);
        // keep categories unchecked by default
        setCategoryFilterIds([]);
      } catch (e) {
        console.error("Erro ao carregar categorias:", e);
      }

      await loadPage(true);
    }

    init();

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

  useEffect(() => {
    const onFocus = () => {
      setHasMore(true);
      setTransactions([]);
      offsetRef.current = 0;
      loadPage(true).catch((e) => console.error("Erro ao recarregar ao focar:", e));
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadPage]);

  const filteredTransactions = transactions.filter((tx) => {
    // account filter
    if (accountFilterIds.length) {
      if (tx.account_id) {
        if (!accountFilterIds.includes(tx.account_id)) return false;
      }
    }

    // category filter
    if (categoryFilterIds.length) {
      // if tx has category_id prefer it
      if (tx.category_id) {
        if (!categoryFilterIds.includes(tx.category_id)) return false;
      } else if (tx.category) {
        // fall back to matching category name
        const matched = categories.some((c) => categoryFilterIds.includes(c.id) && c.name === tx.category);
        if (!matched) return false;
      } else {
        return false;
      }
    }

    return true;
  });

  // build category tree from flat list
  const categoryTree = useMemo(() => {
    const map = new Map<number, { id: number; name: string; parent_id?: number | null; children: any[] }>();
    categories.forEach((c: any) => map.set(c.id, { ...c, parent_id: (c as any).parent_id ?? null, children: [] }));
    const roots: any[] = [];
    map.forEach((node) => {
      const pid = node.parent_id;
      if (pid && map.has(pid)) {
        map.get(pid)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }, [categories]);

  function getDescendantIds(node: any): number[] {
    const ids: number[] = [node.id];
    if (node.children && node.children.length) {
      node.children.forEach((c: any) => ids.push(...getDescendantIds(c)));
    }
    return ids;
  }

  function toggleCategorySelection(node: any) {
    const ids = getDescendantIds(node);
    setCategoryFilterIds((prev) => {
      const has = ids.every((i) => prev.includes(i));
      if (has) {
        // remove all
        return prev.filter((i) => !ids.includes(i));
      }
      // add missing
      const set = new Set(prev);
      ids.forEach((i) => set.add(i));
      return Array.from(set);
    });
  }

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

  // convert groupedTransactions object into an ordered array of groups for TransactionsList
  const groupsArray = dates.map((d) => {
    const txs = groupedTransactions[d] || [];
    const saldo = txs.reduce((s, t) => s + (t.amount || 0), 0);
    return {
      date: d,
      transactions: txs,
      saldo,
      onUpdated: async () => {
        setHasMore(true);
        setTransactions([]);
        offsetRef.current = 0;
        await loadPage(true);
      },
    };
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);

  function handleStartEdit(id: number) {
    // close current editing row without saving
    if (editandoId && editandoId !== id) setEditandoId(null);
    setEditandoId(id);
  }

  function handleCloseEdit() {
    setEditandoId(null);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
            <TransactionFilters
              onNew={() => setModalOpen(true)}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              setSelectedMonth={setSelectedMonth}
              setSelectedYear={setSelectedYear}
              q={q}
              setQ={setQ}
              onSearch={handleSearch}
              showAllDates={showAllDates}
              setShowAllDates={setShowAllDates}
              onMonthChange={async (m: number, y: number) => {
                setSelectedMonth(m);
                setSelectedYear(y);
                setHasMore(true);
                setTransactions([]);
                offsetRef.current = 0;
                await loadPage(true, m, y);
              }}
            />
          </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 overflow-auto">
          {/* Transactions list */}
          {loading ? (
            <div className="text-sm text-muted-foreground">Carregando transações…</div>
          ) : (
            <TransactionsList groups={groupsArray} editandoId={editandoId} onStartEdit={handleStartEdit} onCloseEdit={handleCloseEdit} />
          )}
        </CardContent>
      </Card>

      <TransactionSummaryBar total={filteredTotalAmount} />

      <AddTransactionModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

// Recursive category node component (renders a tree node with check and children)
function CategoryNode({ node, depth, selectedIds, onToggle }: any) {
  const isSelected = node && selectedIds.includes(node.id);
  return (
    <li>
      <div className="flex items-center" style={{ marginLeft: depth * 12 }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(node)}
          className="h-4 w-4 rounded border"
        />
        <span className="ml-2">{node.name}</span>
      </div>
      {node.children && node.children.length > 0 && (
        <ul className="mt-1">
          {node.children.map((c: any) => (
            <CategoryNode key={c.id} node={c} depth={depth + 1} selectedIds={selectedIds} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </li>
  );
}
