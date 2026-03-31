import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { updateTransaction, deleteTransaction, fetchCategories, fetchAccounts } from '@/lib/api';
import { formatCurrency, formatDateDisplay } from '@/lib/format';
import { limparDescricao } from '@/lib/tokens';
import { ACCOUNT_COLORS } from '@/lib/constants';

export default function TransactionRow({ txn, onUpdated, isEditing = false, onStartEdit, onCloseEdit }: any) {
  const queryClient = useQueryClient();

  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [catId, setCatId] = useState<string>('');
  const [contaId, setContaId] = useState<string>('');
  const [tipo, setTipo] = useState<'despesa' | 'receita' | 'transferencia'>('despesa');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [repeatCount, setRepeatCount] = useState<number>(1);

  const descInputRef = useRef<HTMLInputElement>(null);

  const { data: categorias = [] } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const { data: contas = [] } = useQuery({ queryKey: ['accounts'], queryFn: fetchAccounts });

  useEffect(() => {
    if (!isEditing) return;
    setDescricao(limparDescricao(txn.description));
    setValor(String(Math.abs(txn.amount || 0)).replace('.', ','));
    setCatId(String(txn.category_id ?? ''));
    setContaId(String(txn.account_id ?? ''));
    setTipo((txn.amount || 0) > 0 ? 'receita' : 'despesa');
    setConfirmDelete(false);
    setTimeout(() => descInputRef.current?.focus(), 50);
  }, [isEditing, txn]);

  useEffect(() => {
    if (!isEditing) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseEdit && onCloseEdit();
      if (e.key === 'Enter') handleSave();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isEditing, descricao, valor, catId, contaId, tipo]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const valorNum = parseFloat(String(valor).replace(',', '.')) || 0;
      const valorFinal = tipo === 'despesa' ? -Math.abs(valorNum) : Math.abs(valorNum);

      // update current txn
      const categoryName = categorias.find((c: any) => String(c.id) === String(catId))?.name ?? null;
      const updated = await updateTransaction(txn.id, {
        description: descricao,
        amount: valorFinal,
        account_id: contaId ? Number(contaId) : null,
        category_id: catId ? Number(catId) : null,
        category: categoryName,
      });

      // if repeatCount > 1, create additional occurrences (month by month)
      if (repeatCount && repeatCount > 1) {
        function addMonthsToDate(dateStr: string, months: number) {
          const d = new Date(dateStr);
          const day = d.getDate();
          const newD = new Date(d.getFullYear(), d.getMonth() + months, day);
          return newD.toISOString().split('T')[0];
        }

          for (let i = 1; i < repeatCount; i++) {
          const txnDate = addMonthsToDate(txn.date, i);
            await (await import('@/lib/api')).createTransaction({
              account_id: contaId ? Number(contaId) : txn.account_id,
              account_name: contas.find((c: any) => String(c.id) === String(contaId))?.name || txn.account_name,
              date: txnDate,
              description: descricao,
              amount: valorFinal,
              category_id: catId ? Number(catId) : null,
              category: categoryName,
              source_file: 'manual',
            });
        }
      }

      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['report-transactions'] });
      if (onUpdated) onUpdated();
      onCloseEdit && onCloseEdit();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => deleteTransaction(txn.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['report-transactions'] });
      if (onUpdated) onUpdated();
      onCloseEdit && onCloseEdit();
    },
  });

  function handleSave() {
    if (saveMutation.isPending) return;
    saveMutation.mutate();
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    deleteMutation.mutate();
  }

  const contaIndex = contas.findIndex((c: any) => String(c.id) === contaId);
  const dotColor = ACCOUNT_COLORS[contaIndex % ACCOUNT_COLORS.length] ?? '#888';

  if (!isEditing) {
    return (
      <div
        className="group grid items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/10 transition-colors cursor-pointer"
        style={{ gridTemplateColumns: '1fr 130px 110px 90px 24px' }}
        onClick={() => onStartEdit && onStartEdit()}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium truncate">
            {limparDescricao(txn.description)}
            {txn.installment_current && txn.installment_total && (
              <span className="shrink-0 px-1.5 py-0.5 rounded-full text-xs font-medium" style={{ background: '#EEEDFE', color: '#3C3489', fontSize: '10px' }}>
                {txn.installment_current}/{txn.installment_total}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{formatDateDisplay(txn.date)}</p>
        </div>

        <div>
          {txn.category ? (
            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ background: txn.category_color ?? '#E1F5EE', color: txn.category_text_color ?? '#085041' }}>
              {txn.category}
            </span>
          ) : (
            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ background: '#FAEEDA', color: '#633806', border: '0.5px solid rgba(239,159,39,.4)' }}>
              Pendente
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ACCOUNT_COLORS[contas.findIndex((c: any) => c.id === txn.account_id) % ACCOUNT_COLORS.length] ?? '#888' }} />
          <span className="truncate">{txn.account_name}</span>
        </div>

        <span className={cn('font-mono text-sm font-medium text-right', (txn.amount || 0) < 0 ? 'text-destructive' : 'text-primary')}>
          {formatCurrency(txn.amount || 0)}
        </span>

        <div className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center text-muted-foreground">
          <Pencil size={11} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden my-0.5" style={{ border: '1.5px solid #1D9E75', background: 'var(--color-background-secondary)' }}>
      <div className="grid items-center gap-3 px-3 py-2" style={{ gridTemplateColumns: '1fr 130px 110px 90px 24px' }}>
        <div className="min-w-0">
          <input ref={descInputRef} value={descricao} onChange={e => setDescricao(e.target.value)} className="w-full bg-transparent text-sm font-medium text-foreground outline-none border-b border-primary/50 focus:border-primary pb-0.5 placeholder:text-muted-foreground" />
          <p className="text-xs text-muted-foreground mt-1">
            {formatDateDisplay(txn.date)}{txn.installment_current && (<> · parcela {txn.installment_current}/{txn.installment_total}</>)}
          </p>
        </div>

        <select value={catId} onChange={e => setCatId(e.target.value)} className="w-full text-xs font-medium px-2 py-1 rounded-full outline-none cursor-pointer border border-primary/40 bg-primary/10 text-primary focus:ring-0 font-sans">
          <option value="">Pendente</option>
          {categorias.map((c: any) => (
            <option key={c.id} value={String(c.id)}>{c.name ?? c.nome}</option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
          <select value={contaId} onChange={e => setContaId(e.target.value)} className="flex-1 min-w-0 bg-transparent text-xs text-muted-foreground outline-none cursor-pointer border-none font-sans">
            {contas.map((c: any) => (
              <option key={c.id} value={String(c.id)}>{c.name ?? c.nome}</option>
            ))}
          </select>
        </div>

        <input value={valor} onChange={e => setValor(e.target.value)} className={cn('w-full bg-transparent font-mono text-sm font-medium text-right outline-none', 'border-b border-primary/50 focus:border-primary pb-0.5', tipo === 'despesa' ? 'text-destructive' : 'text-primary')} />

        <button onClick={onCloseEdit} className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"><X size={13} /></button>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50">
        <div className="flex gap-1 mr-auto">
          {(['despesa', 'receita', 'transferencia'] as const).map(t => (
            <button key={t} onClick={() => setTipo(t)} className={cn('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors', tipo === t && t === 'despesa' ? 'bg-red-50   border-red-200   text-red-700' : tipo === t && t === 'receita' ? 'bg-green-50 border-green-200 text-green-700' : tipo === t && t === 'transferencia' ? 'bg-blue-50  border-blue-200  text-blue-700' : 'bg-muted border-border text-muted-foreground hover:text-foreground')}>
              {t === 'despesa' ? 'Despesa' : t === 'receita' ? 'Receita' : 'Transferência'}
            </button>
          ))}
        </div>

        <button onClick={handleDelete} disabled={deleteMutation.isPending} className={cn('px-2.5 py-1 rounded-md text-xs font-medium border transition-colors', confirmDelete ? 'bg-destructive/15 border-destructive/40 text-destructive' : 'bg-muted border-border text-muted-foreground hover:text-destructive hover:border-destructive/40')}>
          {deleteMutation.isPending ? '...' : confirmDelete ? 'Confirmar exclusão' : 'Excluir'}
        </button>

        <button onClick={onCloseEdit} className="px-2.5 py-1 rounded-md text-xs font-medium border border-border bg-muted text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>

        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Repetir</label>
          <input type="number" min={1} value={repeatCount} onChange={(e) => setRepeatCount(Math.max(1, Number(e.target.value) || 1))} className="w-16 rounded border p-1 text-sm" />
        </div>

        <button onClick={handleSave} disabled={saveMutation.isPending} className="px-3 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50">{saveMutation.isPending ? 'Salvando...' : 'Salvar'}</button>
      </div>
    </div>
  );
}
