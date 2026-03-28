import { useState, useEffect } from "react";
import { fetchCategories, createCategory, migrateCategories } from "@/lib/api";
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
import { Plus, Database } from "lucide-react";
import { toast } from "sonner";

export default function Categories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setCategories(await fetchCategories());
    } catch {
      toast.error("Erro ao carregar categorias");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    try {
      await createCategory({ name: name.trim(), description: description.trim() || undefined, parent_id: parentId });
      toast.success("Categoria criada");
      setName("");
      setDescription("");
      setParentId(undefined);
      load();
    } catch (e) {
      toast.error("Erro ao criar categoria");
    }
  };

  const handleMigrate = async () => {
    setLoading(true);
    try {
      const res = await migrateCategories({ create_backup: true });
      toast.success(`Migrado: ${res.mapped_distinct} itens, ${res.categories_created} atualizações`);
      load();
    } catch (e) {
      toast.error("Erro ao migrar categorias");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Nova Categoria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Nome</label>
            <Input placeholder="Ex: Alimentação" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Categoria Pai (opcional)</label>
            <select className="w-full rounded border p-2" value={parentId ?? ""} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">-- Nenhuma --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Descrição (opcional)</label>
            <Input placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">
              <Plus className="mr-2 h-4 w-4" /> Criar
            </Button>
            <Button variant="outline" onClick={handleMigrate} disabled={loading}>
              <Database className="mr-2 h-4 w-4" /> Migrar categorias
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Categorias Existentes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                    Nenhuma categoria encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-sm">{c.id}</TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.description}</TableCell>
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
