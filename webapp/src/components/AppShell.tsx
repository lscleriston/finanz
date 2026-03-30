import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from '@tanstack/react-query';
import { fetchAccounts } from '@/lib/api';
import { ACCOUNT_COLORS } from '@/lib/constants';
import { formatCurrency } from '@/lib/tokens';
import { List, LayoutDashboard, Upload, Clock, Tag } from 'lucide-react';
import AccountsSidebar from './AccountsSidebar';

export default function AppShell() {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-56 min-h-screen bg-[#0f1210] text-white border-r border-white/6 flex flex-col">
        <div className="h-16 flex items-center px-4 border-b border-white/6">
          <h1 className="text-lg font-semibold tracking-tight">💰 FinControl</h1>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-2 overflow-auto">
          {/* accounts list fetched via react-query */}
          {/* will render below nav items */}
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-white/6" : "text-white/80 hover:bg-white/3"
              }`
            }
          >
            <List size={14} strokeWidth={1.6} />
            Transações
          </NavLink>
          <NavLink
            to="/accounts"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-white/6" : "text-white/80 hover:bg-white/3"
              }`
            }
          >
            <LayoutDashboard size={14} strokeWidth={1.6} />
            Contas
          </NavLink>
          <NavLink
            to="/import"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-white/6" : "text-white/80 hover:bg-white/3"
              }`
            }
          >
            <Upload size={14} strokeWidth={1.6} />
            Importar
          </NavLink>
          <NavLink
            to="/categories"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-white/6" : "text-white/80 hover:bg-white/3"
              }`
            }
          >
            <Tag size={14} strokeWidth={1.6} />
            Categorias
          </NavLink>
        </nav>
        {/* accounts section - sticky at bottom so it's always visible */}
        <div className="sticky bottom-0 bg-[#0f1210]">
          <div className="px-3 py-2 border-t border-white/6">
            <AccountsSidebar />
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-md">
          <div className="container flex h-14 items-center justify-between">
            <div />
            <nav className="flex gap-1">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                  }`
                }
              >
                Transações
              </NavLink>
            </nav>
          </div>
        </header>

        <main className="container py-6 animate-fade-in flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
