import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface SchoolUnit {
  id: string;
  nome_escola: string;
  tipo_escola: string | null;
  etapa_ano: string | null;
  email_escola: string | null;
  telefone_escola: string | null;
  telefone_escola2: string | null;
  celular_escola: string | null;
  whatsapp_escola: string | null;
  endereco_escola: string | null;
  numero_endereco: string | null;
  bairro_escola: string | null;
  macro_regiao: string | null;
}

const emptyForm = {
  nome_escola: "",
  tipo_escola: "",
  etapa_ano: "",
  email_escola: "",
  telefone_escola: "",
  telefone_escola2: "",
  celular_escola: "",
  whatsapp_escola: "",
  endereco_escola: "",
  numero_endereco: "",
  bairro_escola: "",
  macro_regiao: "",
};

export default function SchoolUnitsPage() {
  const [units, setUnits] = useState<SchoolUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<SchoolUnit | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchUnits = async () => {
    setLoading(true);
    const { data } = await supabase.from("unidades_escolares").select("*").order("nome_escola");
    setUnits((data as SchoolUnit[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchUnits(); }, []);

  const setField = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.nome_escola.trim()) {
      toast({ title: "Nome da escola é obrigatório", variant: "destructive" });
      return;
    }
    const payload = {
      nome_escola: form.nome_escola,
      tipo_escola: form.tipo_escola || null,
      etapa_ano: form.etapa_ano || null,
      email_escola: form.email_escola || null,
      telefone_escola: form.telefone_escola || null,
      telefone_escola2: form.telefone_escola2 || null,
      celular_escola: form.celular_escola || null,
      whatsapp_escola: form.whatsapp_escola || null,
      endereco_escola: form.endereco_escola || null,
      numero_endereco: form.numero_endereco || null,
      bairro_escola: form.bairro_escola || null,
      macro_regiao: form.macro_regiao || null,
    };

    if (editingUnit) {
      const { error } = await supabase.from("unidades_escolares").update(payload).eq("id", editingUnit.id);
      if (error) { toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Unidade escolar atualizada" });
    } else {
      const { error } = await supabase.from("unidades_escolares").insert(payload);
      if (error) { toast({ title: "Erro ao criar", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Unidade escolar criada" });
    }

    setIsOpen(false);
    setEditingUnit(null);
    setForm(emptyForm);
    fetchUnits();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("unidades_escolares").delete().eq("id", id);
    if (error) { toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Unidade escolar excluída" });
    fetchUnits();
  };

  const openEdit = (unit: SchoolUnit) => {
    setEditingUnit(unit);
    setForm({
      nome_escola: unit.nome_escola,
      tipo_escola: unit.tipo_escola || "",
      etapa_ano: unit.etapa_ano || "",
      email_escola: unit.email_escola || "",
      telefone_escola: unit.telefone_escola || "",
      telefone_escola2: unit.telefone_escola2 || "",
      celular_escola: unit.celular_escola || "",
      whatsapp_escola: unit.whatsapp_escola || "",
      endereco_escola: unit.endereco_escola || "",
      numero_endereco: unit.numero_endereco || "",
      bairro_escola: unit.bairro_escola || "",
      macro_regiao: unit.macro_regiao || "",
    });
    setIsOpen(true);
  };

  const openCreate = () => {
    setEditingUnit(null);
    setForm(emptyForm);
    setIsOpen(true);
  };

  const fields: { key: keyof typeof emptyForm; label: string; type?: string }[] = [
    { key: "nome_escola", label: "Nome da Escola *" },
    { key: "tipo_escola", label: "Tipo de Escola" },
    { key: "etapa_ano", label: "Etapa/Ano" },
    { key: "email_escola", label: "E-mail", type: "email" },
    { key: "telefone_escola", label: "Telefone" },
    { key: "telefone_escola2", label: "Telefone 2" },
    { key: "celular_escola", label: "Celular" },
    { key: "whatsapp_escola", label: "WhatsApp" },
    { key: "endereco_escola", label: "Endereço" },
    { key: "numero_endereco", label: "Número" },
    { key: "bairro_escola", label: "Bairro" },
    { key: "macro_regiao", label: "Macrorregião" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Unidades Escolares</h1>
          <p className="text-muted-foreground">Gerencie as escolas cadastradas no sistema</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar Escola
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingUnit ? "Editar Unidade Escolar" : "Nova Unidade Escolar"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {fields.map((f) => (
                <div key={f.key} className="space-y-2">
                  <Label>{f.label}</Label>
                  <Input
                    type={f.type || "text"}
                    value={form[f.key]}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                </div>
              ))}
              <Button onClick={handleSave} className="w-full">
                {editingUnit ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : units.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma unidade escolar cadastrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Bairro</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.nome_escola}</TableCell>
                      <TableCell>{u.tipo_escola || "—"}</TableCell>
                      <TableCell>{u.bairro_escola || "—"}</TableCell>
                      <TableCell>{u.telefone_escola || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
