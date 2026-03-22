import { useState, useEffect, type ChangeEvent } from "react";
import { fetchAccounts, importFiles, type Account } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function ImportTransactions() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(undefined);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAccounts()
      .then(setAccounts)
      .catch(() => toast.error("Erro ao carregar contas"));
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) {
      setFiles([]);
      return;
    }
    setFiles(Array.from(event.target.files));
  };

  const handleImport = async () => {
    if (!selectedAccountId) {
      toast.error("Selecione a conta de destino");
      return;
    }
    if (files.length === 0) {
      toast.error("Selecione ao menos 1 arquivo");
      return;
    }

    setLoading(true);
    try {
      const result = await importFiles(selectedAccountId, files);
      toast.success(`Importados ${result.saved_files.length} arquivos, rodando reload...`);
      setFiles([]);
    } catch (error) {
      console.error(error);
      toast.error("Falha na importação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Importar Lançamentos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Conta de destino</label>
            <select
              value={selectedAccountId ?? ""}
              onChange={(event) => setSelectedAccountId(Number(event.target.value) || undefined)}
              className="w-full rounded border p-2"
            >
              <option value="">Selecione uma conta</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.tipo})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Arquivos</label>
            <Input type="file" multiple onChange={handleFileChange} />
            <p className="text-xs text-muted-foreground mt-1">
              {files.length} arquivo(s) selecionado(s)
            </p>
          </div>

          <Button onClick={handleImport} disabled={loading} className="w-full">
            {loading ? "Importando..." : "Importar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
