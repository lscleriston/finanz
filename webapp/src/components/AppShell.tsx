import { useState } from "react";
import Dashboard from "@/pages/Dashboard";
import AccountMappings from "@/pages/AccountMappings";

type PageView = "dashboard" | "accounts";

export default function AppShell() {
  const [page, setPage] = useState<PageView>("dashboard");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            💰 FinControl
          </h1>
          <nav className="flex gap-1">
            <button
              onClick={() => setPage("dashboard")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                page === "dashboard"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setPage("accounts")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                page === "accounts"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              Contas
            </button>
          </nav>
        </div>
      </header>

      <main className="container py-6 animate-fade-in">
        {page === "dashboard" ? <Dashboard /> : <AccountMappings />}
      </main>
    </div>
  );
}
