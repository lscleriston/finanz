import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAccounts } from '@/lib/api';
import { ACCOUNT_COLORS } from '@/lib/constants';
import { formatCurrency } from '@/lib/tokens';

export default function AccountsSidebar() {
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: fetchAccounts });

  const saldoTotal = accounts.reduce((s: number, a: any) => s + (a.balance ?? 0), 0);

  function accountColor(idx: number) {
    return ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length];
  }

  return (
    <div>
      <div className="h-px mx-3 my-2" style={{ background: 'rgba(255,255,255,.07)' }} />
      <p className="px-3 mb-1 font-medium uppercase tracking-wider" style={{ fontSize: '10px', color: 'rgba(255,255,255,.25)' }}>
        Contas
      </p>
      <div className="space-y-1 px-1">
        {accounts.map((account: any, i: number) => (
          <div key={account.id}
               className="flex items-center gap-2 px-3 py-1.5 mx-1 rounded-lg cursor-pointer transition-colors"
               style={{ color: 'rgba(255,255,255,.5)' }}
               onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.05)')}
               onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: accountColor(i) }} />
            <span className="flex-1 truncate" style={{ fontSize: '11px' }}>{account.name ?? account.nome}</span>
            <span className="font-mono" style={{ fontSize: '10px', color: (account.balance ?? 0) < 0 ? '#f87171' : '#34d399' }}>
              {formatCurrency(account.balance ?? 0)}
            </span>
          </div>
        ))}
      </div>

      <div className="mx-3 mt-2 mb-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,.05)', border: '0.5px solid rgba(255,255,255,.08)' }}>
        <p className="font-medium uppercase tracking-wider" style={{ fontSize: '10px', color: 'rgba(255,255,255,.3)' }}>Saldo atual</p>
        <p className="font-mono font-semibold mt-1" style={{ fontSize: '15px', color: saldoTotal < 0 ? '#f87171' : '#34d399' }}>{formatCurrency(saldoTotal)}</p>
      </div>
    </div>
  );
}
