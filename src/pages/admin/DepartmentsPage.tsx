import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, ArrowUpDown, ArrowUp, ArrowDown, Building2, UserCheck, UserX, Filter } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { translateError } from "@/lib/errorTranslations";

type Department = Tables<"departments">;
type Profile = Tables<"profiles">;

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<(Department & { head?: Profile })[]>([]);
  const [departmentUsers, setDepartmentUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [isOpen, setIsOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [name, setName] = useState("");
  const [headId, setHeadId] = useState<string>("");
  const [saveLoading, setSaveLoading] = useState(false);

  // Delete modal state
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Dynamic Table states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "assigned" | "unassigned">("all");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchData = async () => {
    setLoading(true);
    const [{ data: depts, error: deptsErr }, { data: users, error: usersErr }] = await Promise.all([
      supabase.from("departments").select("*").order("name"),
      supabase.from("profiles").select("*").in("role", ["department", "coordinator"]),
    ]);

    if (deptsErr) {
      toast({ title: "Erro ao buscar setores", description: translateError(deptsErr), variant: "destructive" });
      setDepartments([]);
    } else {
      const enriched = (depts || []).map((d) => ({
        ...d,
        head: users?.find((u) => u.id === d.head_id),
      }));
      setDepartments(enriched);
    }

    if (!usersErr) {
      setDepartmentUsers(users || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortConfig, filterStatus]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    setSaveLoading(true);
    try {
      let savedDeptId = editingDept?.id;

      if (editingDept) {
        const { error } = await supabase
          .from("departments")
          .update({ name, head_id: headId === "none" ? null : headId })
          .eq("id", editingDept.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("departments")
          .insert({ name, head_id: headId === "none" ? null : headId })
          .select()
          .single();
        if (error) throw error;
        savedDeptId = data.id;
      }

      // Vincula o setor ao perfil do responsável se selecionado
      if (savedDeptId && headId && headId !== "none") {
        await supabase.from("profiles").update({ department_id: savedDeptId }).eq("id", headId);
      }

      toast({ title: editingDept ? "Setor atualizado" : "Setor criado" });
      setIsOpen(false);
      setEditingDept(null);
      setName("");
      setHeadId("");
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: translateError(error), variant: "destructive" });
    } finally {
      setSaveLoading(false);
    }
  };

  const openDeleteConfirm = (dept: Department) => {
    setDeleteTarget(dept);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("departments").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast({ title: "Setor excluído com sucesso" });
      setIsDeleteOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: translateError(error), variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  };

  const openEdit = (dept: Department & { head?: Profile }) => {
    setEditingDept(dept);
    setName(dept.name);
    setHeadId(dept.head_id || "none");
    setIsOpen(true);
  };

  const openCreate = () => {
    setEditingDept(null);
    setName("");
    setHeadId("none");
    setIsOpen(true);
  };

  // KPIs
  const totalCount = departments.length;
  const assignedCount = departments.filter((d) => !!d.head_id).length;
  const unassignedCount = totalCount - assignedCount;

  // Filter & Search
  const filteredDepartments = departments.filter((dept) => {
    if (filterStatus === "assigned" && !dept.head_id) return false;
    if (filterStatus === "unassigned" && dept.head_id) return false;

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const headName = (dept.head?.name || "").toLowerCase();
    const headEmail = (dept.head?.email || "").toLowerCase();

    return (
      dept.name.toLowerCase().includes(term) ||
      headName.includes(term) ||
      headEmail.includes(term)
    );
  });

  // Sorting
  const sortedDepartments = [...filteredDepartments].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;

    let aVal: any = a[key as keyof typeof a];
    let bVal: any = b[key as keyof typeof b];

    if (key === "head") {
      aVal = a.head?.name || a.head?.email || "";
      bVal = b.head?.name || b.head?.email || "";
    }

    if (!aVal && bVal) return direction === "asc" ? -1 : 1;
    if (aVal && !bVal) return direction === "asc" ? 1 : -1;
    if (!aVal && !bVal) return 0;

    if (typeof aVal === "string" && typeof bVal === "string") {
      const cmp = aVal.localeCompare(bVal);
      return direction === "asc" ? cmp : -cmp;
    }

    if (aVal < bVal) return direction === "asc" ? -1 : 1;
    if (aVal > bVal) return direction === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const totalPages = Math.ceil(sortedDepartments.length / itemsPerPage);
  const paginatedDepartments = sortedDepartments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
    return sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Gestão de Setores
          </h1>
          <p className="text-muted-foreground">Cadastre e gerencie os setores e seus responsáveis</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar Setor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingDept ? "Editar Setor" : "Criar Novo Setor"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nome do Setor <span className="text-destructive">*</span></Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Gerência de Tecnologia" />
              </div>
              <div className="space-y-2">
                <Label>Responsável pelo Setor</Label>
                <Select value={headId} onValueChange={setHeadId}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecione um responsável (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum responsável</SelectItem>
                    {departmentUsers
                      .filter((u) => !u.department_id || u.department_id === editingDept?.id)
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name || u.email}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} className="w-full" disabled={saveLoading}>
                {saveLoading ? "Salvando..." : editingDept ? "Atualizar Setor" : "Criar Setor"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards Bar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card
          className={`cursor-pointer transition-all hover:shadow-md border-l-4 border-l-blue-500 ${
            filterStatus === "all" ? "ring-2 ring-primary bg-blue-50/40" : ""
          }`}
          onClick={() => setFilterStatus("all")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total de Setores</span>
              <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                <Building2 className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-bold text-foreground">{totalCount}</div>
            <p className="mt-1 text-xs text-muted-foreground">Setores cadastrados na plataforma</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-md border-l-4 border-l-emerald-500 ${
            filterStatus === "assigned" ? "ring-2 ring-emerald-500 bg-emerald-50/40" : ""
          }`}
          onClick={() => setFilterStatus(filterStatus === "assigned" ? "all" : "assigned")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Com Responsável</span>
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
                <UserCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-bold text-emerald-600">{assignedCount}</div>
            <p className="mt-1 text-xs text-muted-foreground">Possuem chefe/responsável designado</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-md border-l-4 border-l-amber-500 ${
            filterStatus === "unassigned" ? "ring-2 ring-amber-500 bg-amber-50/40" : ""
          }`}
          onClick={() => setFilterStatus(filterStatus === "unassigned" ? "all" : "unassigned")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sem Responsável</span>
              <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
                <UserX className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-bold text-amber-600">{unassignedCount}</div>
            <p className="mt-1 text-xs text-muted-foreground">Aguardando atribuição de responsável</p>
          </CardContent>
        </Card>
      </div>

      {/* Dynamic Table Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Busque por nome do setor ou responsável..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Status:
          </span>
          <Button
            variant={filterStatus === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus("all")}
            className="h-8 text-xs"
          >
            Todos ({totalCount})
          </Button>
          <Button
            variant={filterStatus === "assigned" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus("assigned")}
            className="h-8 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
          >
            Com Responsável ({assignedCount})
          </Button>
          <Button
            variant={filterStatus === "unassigned" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus("unassigned")}
            className="h-8 text-xs text-amber-700 border-amber-200 hover:bg-amber-50"
          >
            Sem Responsável ({unassignedCount})
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando setores...</div>
          ) : sortedDepartments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum setor encontrado para os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center">
                        Nome do Setor <SortIcon columnKey="name" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort("head")}
                    >
                      <div className="flex items-center">
                        Responsável <SortIcon columnKey="head" />
                      </div>
                    </TableHead>
                    <TableHead className="w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDepartments.map((dept) => (
                    <TableRow key={dept.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="font-semibold text-foreground">{dept.name}</TableCell>
                      <TableCell>
                        {dept.head ? (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">{dept.head.name || dept.head.email}</span>
                            <Badge variant="outline" className="text-[10px] bg-slate-100">
                              {dept.head.email}
                            </Badge>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-700 border-amber-200">
                            Sem responsável
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(dept)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => openDeleteConfirm(dept)}
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Exibindo {paginatedDepartments.length} de {sortedDepartments.length} setores
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 text-xs"
                >
                  Anterior
                </Button>
              </PaginationItem>
              <span className="text-xs text-muted-foreground px-2 font-medium">
                Página {currentPage} de {totalPages}
              </span>
              <PaginationItem>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 text-xs"
                >
                  Próximo
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Setor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o setor <strong>{deleteTarget?.name}</strong>? Esta ação é irreversível e removerá as vinculações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? "Excluindo..." : "Confirmar Exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
