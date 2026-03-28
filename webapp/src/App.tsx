import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "./pages/NotFound.tsx";
import Categories from "./pages/Categories";
import CategoryMappings from "./pages/CategoryMappings";
import AppShell from "@/components/AppShell";
import Transactions from "./pages/Dashboard";
import AccountMappings from "./pages/AccountMappings";
import ImportTransactions from "./pages/ImportTransactions";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<Transactions />} />
            <Route path="accounts" element={<AccountMappings />} />
            <Route path="import" element={<ImportTransactions />} />
            <Route path="categories" element={<Categories />} />
            <Route path="category-mappings" element={<CategoryMappings />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
