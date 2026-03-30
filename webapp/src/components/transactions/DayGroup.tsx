import React from 'react';
import TransactionRow from './TransactionRow';
import { formatDayLabel } from '@/lib/tokens';
import { formatCurrency } from '@/lib/format';

export default function DayGroup({ date, transactions = [], saldo = 0, onUpdated }: any) {
  return (
    <div>
      <div className="flex items-center justify-between py-2 px-3 bg-muted/10 rounded text-sm font-semibold">
        <div>{formatDayLabel(date)}</div>
        <div className="text-sm font-medium">{formatCurrency(saldo)}</div>
      </div>
      <div className="mt-2 space-y-1">
        {transactions.map((t: any) => (
          <TransactionRow key={t.id} txn={t} onUpdated={onUpdated} />
        ))}
      </div>
    </div>
  );
}
