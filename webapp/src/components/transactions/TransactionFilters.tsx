import React, { useMemo } from 'react';

export default function TransactionFilters({
  onNew,
  onMonthChange,
  selectedMonth,
  selectedYear,
  setSelectedMonth,
  setSelectedYear,
  q,
  setQ,
  onSearch,
  showAllDates,
  setShowAllDates,
}: any) {
  const months = useMemo(() => {
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return names.map((n, i) => ({ label: n, month: i + 1 }));
  }, []);

  const years = useMemo(() => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const list: number[] = [];
    for (let y = thisYear - 5; y <= thisYear + 1; y++) list.push(y);
    return list;
  }, []);

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-2">
        <div className="text-sm font-medium">Mês</div>
        <select
          className="rounded border p-1 text-sm"
          value={selectedMonth || ''}
          onChange={(e) => {
            const m = Number(e.target.value) || 1;
            const y = selectedYear || new Date().getFullYear();
            if (typeof onMonthChange === 'function') onMonthChange(m, y);
            else {
              setSelectedMonth(m);
              if (onSearch) onSearch();
            }
          }}
        >
          {months.map((m) => (
            <option key={m.month} value={m.month}>
              {m.label}
            </option>
          ))}
        </select>

        <select
          className="rounded border p-1 text-sm ml-2"
          value={selectedYear || new Date().getFullYear()}
          onChange={(e) => {
            const y = Number(e.target.value) || new Date().getFullYear();
            const m = selectedMonth || (new Date().getMonth() + 1);
            if (typeof onMonthChange === 'function') onMonthChange(m, y);
            else {
              setSelectedYear(y);
              if (onSearch) onSearch();
            }
          }}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <input
          className="ml-3 rounded border p-1 text-sm"
          placeholder="Buscar"
          value={q}
          onChange={(e) => setQ && setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSearch) onSearch();
          }}
        />

        <label className="ml-3 text-sm flex items-center gap-2">
          <input type="checkbox" checked={!!showAllDates} onChange={(e) => setShowAllDates && setShowAllDates(e.target.checked)} />
          <span className="text-sm">Mostrar todas as datas</span>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onNew && onNew()} className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground">Nova transação</button>
      </div>
    </div>
  );
}
