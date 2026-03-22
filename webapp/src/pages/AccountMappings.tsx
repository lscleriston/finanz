import { useState, useEffect } from "react";
import {
  fetchAccountMappings,
  createAccountMapping,
  deleteAccountMapping,
  reloadData,
  type AccountMapping,
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
  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setMappings(await fetchAccountMappings());
    } catch {
      toast.error("Erro ao carregar mapeamentos");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    if (!path.trim() || !name.trim()) {
      toast.error("Preencha os dois campos");
      return;
    }
    try {
      await createAccountMapping({ path: path.trim(), name: name.trim() });
      toast.success("Mapeamento salvo!");
      setPath("");
      setName("");
      load();
    } catch {
      toast.error("Erro ao salvar mapeamento");
    }
  };

  const handleDelete = async (p: string) => {
    try {
      await deleteAccountMapping(p);
      toast.success("Mapeamento excluído");
      load();
    } catch {
      toast.error("Erro ao excluir");
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
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Caminho da conta</label>
            <Input
              placeholder="Ex: CartaoCredito/Bradesco"
              value={path}
              onChange={(e) => setPath(e.target.value)}
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
                <TableHead>Caminho</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                    Nenhum mapeamento cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                mappings.map((m) => (
                  <TableRow key={m.path}>
                    <TableCell className="font-mono text-sm">{m.path}</TableCell>
                    <TableCell>{m.name}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(m.path)}
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
