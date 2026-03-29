import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchCategories, createCategory, migrateCategories, deleteCategory } from "@/lib/api";
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

  const handleDelete = async (id: number) => {
    if (!window.confirm("Confirmar exclusão desta categoria?")) return;
    try {
      await deleteCategory(id);
      toast.success("Categoria excluída");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir categoria");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <header className="flex items-center justify-between py-4">
        <nav className="flex gap-2">
          <Link to="/" className="text-sm px-3 py-1 rounded hover:bg-muted">Transações</Link>
          <Link to="/" className="text-sm px-3 py-1 rounded hover:bg-muted">Contas</Link>
          <Link to="/" className="text-sm px-3 py-1 rounded hover:bg-muted">Importar</Link>
        </nav>
        <div />
      </header>
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
        <CardContent className="p-4">
          {categories.length === 0 ? (
            <div className="h-24 text-center text-muted-foreground">Nenhuma categoria encontrada.</div>
          ) : (
            <CategoryTree categories={categories} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}


function CategoryTree({ categories }: { categories: any[] }) {
  // build id->node map
  const map = new Map<number, any>();
  categories.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: any[] = [];
  map.forEach((node) => {
    if (node.parent_id) {
      const p = map.get(node.parent_id);
      if (p) p.children.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  });

  return (
    <div>
      {roots.map((r) => (
        <TreeNode key={r.id} node={r} level={0} />
      ))}
    </div>
  );
}

function TreeNode({ node, level }: { node: any; level: number }) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <div className="flex items-center" style={{ marginLeft: level * 12 }}>
        {node.children && node.children.length > 0 ? (
          <button className="mr-2 text-sm" onClick={() => setOpen((v) => !v)}>
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <div style={{ width: 20 }} />
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4 rounded border" />
          <span className="ml-1">{node.name}</span>
        </label>
        <div className="ml-3">
          <button
            className="text-destructive text-sm"
            onClick={async () => {
              if (!window.confirm(`Excluir categoria '${node.name}'?`)) return;
              try {
                await deleteCategory(node.id);
                toast.success('Categoria excluída');
                window.location.reload();
              } catch (err: any) {
                toast.error(err?.message || 'Erro ao excluir categoria');
              }
            }}
          >
            Excluir
          </button>
        </div>
      </div>
      {open && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((ch: any) => (
            <TreeNode key={ch.id} node={ch} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
