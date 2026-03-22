import { useState, useEffect, useCallback, useRef } from "react";
import { fetchTransactions, fetchSummary, type Transaction, type Summary } from "@/lib/api";
import { formatDate, formatCurrency } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";

const PAGE_SIZE = 20;

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
    [dateFrom, dateTo, q]
  );

  useEffect(() => {
    loadPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    setHasMore(true);
    setTransactions([]);
    offsetRef.current = 0;
    loadPage(true);
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

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead className="w-28">Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right w-32">Valor</TableHead>
                <TableHead className="w-36">Categoria</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    Nenhuma transação encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => (
                  <TableRow key={tx.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-xs text-muted-foreground">{tx.id}</TableCell>
                    <TableCell className="font-medium">{tx.account_name || "-"}</TableCell>
                    <TableCell className="font-mono text-sm">{formatDate(tx.date)}</TableCell>
                    <TableCell className="max-w-[280px] truncate">{tx.description}</TableCell>
                    <TableCell
                      className={`text-right font-mono font-semibold ${
                        tx.amount < 0 ? "text-danger" : "text-success"
                      }`}
                    >
                      {formatCurrency(tx.amount)}
                    </TableCell>
                    <TableCell>
                      {tx.category ? (
                        <span className="inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                          {tx.category}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <tfoot>
              <TableRow>
                <TableCell colSpan={4} className="text-right font-semibold">
                  Total acumulado:
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(summary?.total_amount ?? 0)}
                </TableCell>
                <TableCell />
              </TableRow>
            </tfoot>
          </Table>
        </div>

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
    </div>
  );
}
