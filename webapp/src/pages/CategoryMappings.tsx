import { useState, useEffect } from "react";
import { fetchCategoryMappings, fetchCategories, createCategoryMapping, classifyTransactions } from "@/lib/api";
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
import { Plus, Zap } from "lucide-react";
import { toast } from "sonner";

export default function CategoryMappings() {
  const [mappings, setMappings] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [pattern, setPattern] = useState("");
  const [matchType, setMatchType] = useState("substring");
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [priority, setPriority] = useState<number>(100);

  const load = async () => {
    try {
      setMappings(await fetchCategoryMappings());
      setCategories(await fetchCategories());
    } catch (e) {
      toast.error("Erro ao carregar mapeamentos ou categorias");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    if (!pattern.trim() || !categoryId) {
      toast.error("Preencha padrão e categoria");
      return;
    }
    try {
      await createCategoryMapping({ pattern: pattern.trim(), match_type: matchType, category_id: categoryId, priority, active: true });
      toast.success("Mapeamento criado");
      setPattern("");
      setPriority(100);
      load();
    } catch (e) {
      toast.error("Erro ao criar mapeamento");
    }
  };

  const handleClassify = async () => {
    try {
      const res = await classifyTransactions({ force: false });
      toast.success(`Classificadas: ${res.updated}`);
      load();
    } catch (e) {
      toast.error("Erro ao classificar transações");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Novo Mapeamento de Categoria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Padrão</label>
            <Input placeholder="Ex: supermercado" value={pattern} onChange={(e) => setPattern(e.target.value)} />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Tipo de Match</label>
            <select className="w-full rounded border p-2" value={matchType} onChange={(e) => setMatchType(e.target.value)}>
              <option value="substring">Substring</option>
              <option value="starts_with">Starts With</option>
              <option value="regex">Regex</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Categoria</label>
            <select className="w-full rounded border p-2" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
              <option value={""}>-- selecione --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Prioridade (menor aplica primeiro)</label>
            <Input type="number" value={String(priority)} onChange={(e) => setPriority(Number(e.target.value))} />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">
              <Plus className="mr-2 h-4 w-4" /> Criar
            </Button>
            <Button variant="outline" onClick={handleClassify}>
              <Zap className="mr-2 h-4 w-4" /> Classificar agora
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mapeamentos Existentes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Padrão</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Ativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Nenhum mapeamento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                mappings.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-sm">{m.id}</TableCell>
                    <TableCell>{m.pattern}</TableCell>
                    <TableCell>{m.match_type}</TableCell>
                    <TableCell>{m.category_id}</TableCell>
                    <TableCell>{m.priority}</TableCell>
                    <TableCell>{m.active ? "Sim" : "Não"}</TableCell>
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
