import { useEffect, useState } from "react";
import { mapErrorMessage } from "@/lib/errorMapper";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Department = Tables<"departments">;
type Profile = Tables<"profiles">;

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<(Department & { head?: Profile })[]>([]);
  const [departmentUsers, setDepartmentUsers] = useState<Profile[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [name, setName] = useState("");
  const [headId, setHeadId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: depts }, { data: users }] = await Promise.all([
      supabase.from("departments").select("*"),
      supabase.from("profiles").select("*").eq("role", "department"),
    ]);

    // Enrich: find user whose department_id matches the department
    const enriched = (depts || []).map((d) => ({
      ...d,
      head: users?.find((u) => u.department_id === d.id),
    }));

    setDepartments(enriched);
    setDepartmentUsers(users || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    if (editingDept) {
      const { error } = await supabase
        .from("departments")
        .update({ name })
        .eq("id", editingDept.id);
      if (error) { toast({ title: "Erro ao atualizar", description: mapErrorMessage(error), variant: "destructive" }); return; }
    } else {
      const { error } = await supabase
        .from("departments")
        .insert({ name });
      if (error) { toast({ title: "Erro ao criar", description: mapErrorMessage(error), variant: "destructive" }); return; }
    }

    // Update the selected user's department_id
    if (headId && editingDept) {
      // Clear previous head if any
      const prevHead = departmentUsers.find((u) => u.department_id === editingDept.id);
      if (prevHead && prevHead.id !== headId) {
        await supabase.from("profiles").update({ department_id: null }).eq("id", prevHead.id);
      }
      await supabase.from("profiles").update({ department_id: editingDept.id }).eq("id", headId);
    }

    toast({ title: editingDept ? "Setor atualizado" : "Setor criado" });
    setIsOpen(false);
    setEditingDept(null);
    setName("");
    setHeadId("");
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) { toast({ title: "Erro ao excluir", description: mapErrorMessage(error), variant: "destructive" }); return; }
    toast({ title: "Setor excluído" });
    fetchData();
  };

  const openEdit = (dept: Department & { head?: Profile }) => {
    setEditingDept(dept);
    setName(dept.name);
    setHeadId(dept.head?.id || "");
    setIsOpen(true);
  };

  const openCreate = () => {
    setEditingDept(null);
    setName("");
    setHeadId("");
    setIsOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Setores</h1>
          <p className="text-muted-foreground">Gerencie setores e seus responsáveis</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar Setor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingDept ? "Editar Setor" : "Criar Setor"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nome do Setor</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Recursos Humanos" />
              </div>
              <div className="space-y-2">
                <Label>Responsável do Setor</Label>
                <Select value={headId} onValueChange={setHeadId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um responsável (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} className="w-full">
                {editingDept ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : departments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum setor ainda. Crie um para começar.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell>{dept.head?.name || dept.head?.email || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(dept)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(dept.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
