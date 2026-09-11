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
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, ArrowUpDown, ArrowUp, ArrowDown, School, Phone, MapPin, Filter, Building } from "lucide-react";
import { translateError } from "@/lib/errorTranslations";

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

  // Form states
  const [isOpen, setIsOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<SchoolUnit | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saveLoading, setSaveLoading] = useState(false);

  // Delete modal state
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SchoolUnit | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Dynamic Table states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchUnits = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("unidades_escolares").select("*").order("nome_escola");
    if (error) {
      toast({ title: "Erro ao buscar escolas", description: translateError(error), variant: "destructive" });
      setUnits([]);
    } else {
      setUnits((data as SchoolUnit[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortConfig, filterType]);

  const setField = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.nome_escola.trim()) {
      toast({ title: "Nome da escola é obrigatório", variant: "destructive" });
      return;
    }

    setSaveLoading(true);
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

    try {
      if (editingUnit) {
        const { error } = await supabase.from("unidades_escolares").update(payload).eq("id", editingUnit.id);
        if (error) throw error;
        toast({ title: "Unidade escolar atualizada" });
      } else {
        const { error } = await supabase.from("unidades_escolares").insert(payload);
        if (error) throw error;
        toast({ title: "Unidade escolar criada" });
      }

      setIsOpen(false);
      setEditingUnit(null);
      setForm(emptyForm);
      fetchUnits();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: translateError(error), variant: "destructive" });
    } finally {
      setSaveLoading(false);
    }
  };

  const openDeleteConfirm = (unit: SchoolUnit) => {
    setDeleteTarget(unit);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("unidades_escolares").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast({ title: "Unidade escolar excluída com sucesso" });
      setIsDeleteOpen(false);
      fetchUnits();
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: translateError(error), variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
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

  // Unique school types for filter dropdown
  const uniqueTypes = Array.from(
    new Set(units.map((u) => u.tipo_escola).filter((t): t is string => !!t))
  );

  // KPIs
  const totalCount = units.length;
  const withPhoneCount = units.filter((u) => !!u.telefone_escola || !!u.whatsapp_escola || !!u.celular_escola).length;
  const withEmailCount = units.filter((u) => !!u.email_escola).length;

  // Filter & Search
  const filteredUnits = units.filter((u) => {
    if (filterType !== "all" && u.tipo_escola !== filterType) return false;

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();

    return (
      u.nome_escola.toLowerCase().includes(term) ||
      (u.tipo_escola || "").toLowerCase().includes(term) ||
      (u.bairro_escola || "").toLowerCase().includes(term) ||
      (u.telefone_escola || "").toLowerCase().includes(term) ||
      (u.email_escola || "").toLowerCase().includes(term) ||
      (u.macro_regiao || "").toLowerCase().includes(term)
    );
  });

  // Sorting
  const sortedUnits = [...filteredUnits].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;

    const aVal = (a[key as keyof SchoolUnit] || "") as string;
    const bVal = (b[key as keyof SchoolUnit] || "") as string;

    if (!aVal && bVal) return direction === "asc" ? -1 : 1;
    if (aVal && !bVal) return direction === "asc" ? 1 : -1;
    if (!aVal && !bVal) return 0;

    const cmp = aVal.localeCompare(bVal);
    return direction === "asc" ? cmp : -cmp;
  });

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const totalPages = Math.ceil(sortedUnits.length / itemsPerPage);
  const paginatedUnits = sortedUnits.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
            <School className="h-6 w-6 text-primary" />
            Unidades Escolares
          </h1>
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
              <Button onClick={handleSave} className="w-full" disabled={saveLoading}>
                {saveLoading ? "Salvando..." : editingUnit ? "Atualizar Escola" : "Criar Escola"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards Bar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 border-l-4 border-l-blue-500 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total de Escolas</span>
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <School className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-foreground">{totalCount}</div>
          <p className="mt-1 text-xs text-muted-foreground">Unidades escolares cadastradas</p>
        </Card>

        <Card className="p-5 border-l-4 border-l-emerald-500 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Com Contato Telefônico</span>
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
              <Phone className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-emerald-600">{withPhoneCount}</div>
          <p className="mt-1 text-xs text-muted-foreground">Com telefone/WhatsApp cadastrado</p>
        </Card>

        <Card className="p-5 border-l-4 border-l-purple-500 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Com E-mail Institucional</span>
            <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
              <Building className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-purple-600">{withEmailCount}</div>
          <p className="mt-1 text-xs text-muted-foreground">Possuem e-mail de contato cadastrado</p>
        </Card>
      </div>

      {/* Dynamic Table Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Busque por nome da escola, bairro, telefone, e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        {uniqueTypes.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Tipo:
            </span>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 text-xs w-[180px] bg-white">
                <SelectValue placeholder="Todos os Tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {uniqueTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Main Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando unidades escolares...</div>
          ) : sortedUnits.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhuma unidade escolar encontrada para a busca selecionada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort("nome_escola")}
                    >
                      <div className="flex items-center">
                        Nome da Escola <SortIcon columnKey="nome_escola" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort("tipo_escola")}
                    >
                      <div className="flex items-center">
                        Tipo <SortIcon columnKey="tipo_escola" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort("bairro_escola")}
                    >
                      <div className="flex items-center">
                        Bairro <SortIcon columnKey="bairro_escola" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort("telefone_escola")}
                    >
                      <div className="flex items-center">
                        Telefone <SortIcon columnKey="telefone_escola" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort("macro_regiao")}
                    >
                      <div className="flex items-center">
                        Macrorregião <SortIcon columnKey="macro_regiao" />
                      </div>
                    </TableHead>
                    <TableHead className="w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUnits.map((u) => (
                    <TableRow key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="font-semibold text-foreground">
                        <div>
                          <div>{u.nome_escola}</div>
                          {u.email_escola && (
                            <div className="text-[11px] text-muted-foreground font-normal">{u.email_escola}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.tipo_escola ? (
                          <Badge variant="outline" className="bg-slate-100 text-[11px]">
                            {u.tipo_escola}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{u.bairro_escola || "—"}</TableCell>
                      <TableCell>{u.telefone_escola || u.whatsapp_escola || u.celular_escola || "—"}</TableCell>
                      <TableCell>{u.macro_regiao || "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => openDeleteConfirm(u)}
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
            Exibindo {paginatedUnits.length} de {sortedUnits.length} escolas
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
            <AlertDialogTitle>Excluir Unidade Escolar</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.nome_escola}</strong>? Esta ação é irreversível.
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
