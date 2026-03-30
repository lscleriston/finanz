import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { fetchAccounts, fetchCategories, createTransaction } from '@/lib/api';

export default function AddTransactionModal({ open = false, onClose = () => {}, onCreated = () => {} }: any) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState({ account_id: '', date: '', description: '', amount: '', category: '', repeat: 1 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAccounts().then(setAccounts).catch(() => {});
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) setForm({ account_id: '', date: '', description: '', amount: '', category: '', repeat: 1 });
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.account_id || !form.date || !form.description || !form.amount) {
      alert('Preencha conta, data, descrição e valor');
      return;
    }
    const parsed = Number(String(form.amount).replace(',', '.'));
    if (Number.isNaN(parsed)) {
      alert('Valor inválido');
      return;
    }
    setLoading(true);
    try {
      for (let i = 0; i < (Number(form.repeat) || 1); i++) {
        const date = i === 0 ? form.date : (() => { const d = new Date(form.date); d.setMonth(d.getMonth()+i); return d.toISOString().split('T')[0]; })();
        await createTransaction({ account_id: Number(form.account_id), date, description: form.description, amount: parsed, category: form.category, source_file: 'manual' });
      }
      onCreated();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao criar transação: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="p-4 w-[520px]">
          <h3 className="text-lg font-semibold">Nova transação</h3>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} className="border rounded p-2">
              <option value="">Selecionar conta</option>
              {accounts.map((a: any) => (<option key={a.id} value={a.id}>{a.name}</option>))}
            </select>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border rounded p-2" />
            <input placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="col-span-2 border rounded p-2" />
            <input placeholder="Valor" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="border rounded p-2" />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="border rounded p-2">
              <option value="">Sem categoria</option>
              {categories.map((c: any) => (<option key={c.id} value={c.name}>{c.name}</option>))}
            </select>
            <input type="number" min={1} max={120} value={form.repeat} onChange={(e) => setForm({ ...form, repeat: Number(e.target.value) })} className="border rounded p-2" />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded px-3 py-1">Cancelar</button>
            <button type="submit" disabled={loading} className="rounded bg-primary px-3 py-1 text-primary-foreground">{loading ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
