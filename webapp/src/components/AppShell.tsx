import { NavLink, Outlet } from "react-router-dom";

export default function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight text-foreground">💰 FinControl</h1>
          <nav className="flex gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                }`
              }
            >
              Transações
            </NavLink>
            <NavLink
              to="/accounts"
              className={({ isActive }) =>
                `rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                }`
              }
            >
              Contas
            </NavLink>
            <NavLink
              to="/import"
              className={({ isActive }) =>
                `rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                }`
              }
            >
              Importar
            </NavLink>
            <NavLink
              to="/categories"
              className={({ isActive }) =>
                `rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                }`
              }
            >
              Categorias
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="container py-6 animate-fade-in">
        <Outlet />
      </main>
    </div>
  );
}
