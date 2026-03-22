import { useState, useEffect } from "react";
import {
  fetchAccounts,
  createAccount,
  deleteAccount,
  reloadData,
  type Account,
} from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, RefreshCw, Plus } from "lucide-react";
import { toast } from "sonner";

export default function AccountMappings() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tipo, setTipo] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setAccounts(await fetchAccounts());
    } catch {
      toast.error("Erro ao carregar contas");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    if (!tipo.trim() || !name.trim()) {
      toast.error("Preencha os campos tipo e nome");
      return;
    }
    try {
      await createAccount({ name: name.trim(), tipo: tipo.trim() });
      toast.success("Conta salva!");
      setTipo("");
      setName("");
      load();
    } catch {
      toast.error("Erro ao salvar conta");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteAccount(id);
      toast.success("Conta excluída");
      load();
    } catch {
      toast.error("Erro ao excluir conta");
    }
  };

  const handleReload = async () => {
    setLoading(true);
    try {
      await reloadData();
      toast.success("Dados recarregados com sucesso!");
      load();
    } catch {
      toast.error("Erro ao recarregar dados");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Novo Mapeamento de Conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Tipo da conta</label>
            <Input
              placeholder="Ex: CartaoCredito ou ContaCorrente"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Nome da conta</label>
            <Input
              placeholder="Ex: Bradesco"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button onClick={handleSave} className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Salvar
          </Button>
        </CardContent>
      </Card>

      {/* Mappings List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Mapeamentos Existentes</CardTitle>
          <Button variant="outline" size="sm" onClick={handleReload} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Recarregar dados
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                    <TableHead>ID</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Pasta</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Nenhuma conta cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-sm">{a.id}</TableCell>
                    <TableCell>{a.name}</TableCell>                    <TableCell>{a.tipo}</TableCell>                    <TableCell className="font-mono text-sm">{a.path}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(a.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
