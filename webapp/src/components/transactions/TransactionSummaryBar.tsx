import React from 'react';
import { formatCurrency } from '@/lib/tokens';

export default function TransactionSummaryBar({ total = 0 }: any) {
  return (
    <div className="fixed bottom-0 left-64 right-0 border-t bg-card/90 px-4 py-3">
      <div className="container flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Resumo do mês</div>
        <div className="text-lg font-bold">{formatCurrency(total)}</div>
      </div>
    </div>
  );
}
