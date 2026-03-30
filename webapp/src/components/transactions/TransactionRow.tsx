import React, { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/tokens';
import { fetchCategories, updateTransaction } from '@/lib/api';

export default function TransactionRow({ txn, onUpdated }: any) {
  const [editing, setEditing] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  async function handleCategoryChange(cat: any) {
    try {
      await updateTransaction(txn.id, { category: cat.name, category_id: cat.id });
      if (onUpdated) onUpdated();
    } catch (e) {
      console.error('Falha ao atualizar categoria', e);
      alert('Erro ao atualizar categoria');
    }
  }

  return (
    <div className="grid grid-cols-6 gap-3 items-center p-2 rounded hover:bg-muted/10">
      <div className="col-span-3 truncate">{txn.description}</div>
      <div className="col-span-1 text-sm text-muted-foreground">
        {txn.category ? (
          <span className="inline-block rounded px-2 py-0.5 text-xs">{txn.category}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
        <div className="mt-1">
          <select value={txn.category_id || ''} onChange={(e) => {
            const cid = Number(e.target.value);
            const cat = categories.find(c => c.id === cid);
            if (cat) handleCategoryChange(cat);
          }} className="mt-1 border rounded p-1 text-sm">
            <option value="">— mudar categoria —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="col-span-1 text-sm">{txn.account_name || '-'}</div>
      <div className="col-span-1 text-right font-mono font-semibold" style={{ color: (txn.amount || 0) < 0 ? '#f87171' : '#34d399' }}>{formatCurrency(txn.amount || 0)}</div>
    </div>
  );
}
