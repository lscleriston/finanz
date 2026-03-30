import React from 'react';
import DayGroup from './DayGroup';

export default function TransactionsList({ groups = [], editandoId = null, onStartEdit, onCloseEdit }: any) {
  // groups: Array<{ date: string, transactions: Transaction[], saldo?: number, onUpdated?: fn }>
  if (!groups || groups.length === 0) return <div className="text-sm text-muted-foreground">Nenhuma transação.</div>;
  return (
    <div className="space-y-4">
      {groups.map((g: any) => (
        <DayGroup
          key={g.date}
          date={g.date}
          transactions={g.transactions}
          saldo={g.saldo}
          onUpdated={g.onUpdated}
          editandoId={editandoId}
          onStartEdit={onStartEdit}
          onCloseEdit={onCloseEdit}
        />
      ))}
    </div>
  );
}
