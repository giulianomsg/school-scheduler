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
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Plus, Send, Save, MoreHorizontal, Pencil, KeyRound, Mail, RefreshCw, Ban, CheckCircle, Trash2, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import SchoolUnitCombobox from "@/components/SchoolUnitCombobox";
import DepartmentCombobox from "@/components/DepartmentCombobox";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  department: "Setor",
  school: "Escola",
};

const roleBadgeClasses: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive border-destructive/20",
  department: "bg-secondary/20 text-secondary-foreground border-secondary/30",
  school: "bg-success/10 text-success border-success/20",
};

export default function UsersPage() {
  const [profiles, setProfiles] = useState<(Profile & { unidade?: { nome_escola: string } | null; departamento?: { name: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("school");
  const [inviteSchoolUnitId, setInviteSchoolUnitId] = useState("");
  const [inviteDepartmentId, setInviteDepartmentId] = useState("");
  const [inviteCargo, setInviteCargo] = useState("");
  const [inviteWhatsapp, setInviteWhatsapp] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteActivities, setInviteActivities] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  // Edit state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<string>("school");
  const [editCargo, setEditCargo] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editActivities, setEditActivities] = useState("");
  const [editSchoolUnitId, setEditSchoolUnitId] = useState("");
  const [editDepartmentId, setEditDepartmentId] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Password modal
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Delete confirmation
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Action loading (for suspend/reactivate/links)
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // New states for enhancements
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [authUsers, setAuthUsers] = useState<Record<string, string | null>>({});

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*, unidades_escolares(nome_escola), departments!department_id(name)")
      .order("created_at", { ascending: false });

    // Novo bloco de tratamento de erro
    if (error) {
      toast({
        title: "Erro ao carregar usuários",
        description: error.message,
        variant: "destructive"
      });
      console.error("Erro no fetchProfiles:", error);
      setProfiles([]);
    } else {
      const mapped = (data || []).map((p: any) => ({
        ...p,
        unidade: p.unidades_escolares,
        departamento: p.departments,
      }));
      setProfiles(mapped);
      
      // Fetch auth users for last_sign_in_at
      try {
        const authData = await supabase.functions.invoke("admin-user-actions", { body: { action: "listAuthUsers" } });
        if (authData.data && authData.data.users) {
          const dict: Record<string, string | null> = {};
          authData.data.users.forEach((u: any) => {
            dict[u.id] = u.last_sign_in_at;
          });
          setAuthUsers(dict);
        }
      } catch (e) {
        console.error("Erro ao buscar ultimo acesso:", e);
      }
    }

    setLoading(false);
  };

  useEffect(() => { fetchProfiles(); }, []);

  // --- Admin actions via edge function ---
  const callAdminAction = async (payload: Record<string, any>) => {
    const { data, error } = await supabase.functions.invoke("admin-user-actions", { body: payload });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  // --- Invite ---
  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast({ title: "E-mail é obrigatório", variant: "destructive" });
      return;
    }
    setInviteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: inviteEmail,
          name: inviteName,
          role: inviteRole,
          school_unit_id: inviteRole === "school" ? (inviteSchoolUnitId || null) : null,
          department_id: inviteRole === "department" ? (inviteDepartmentId || null) : null,
          cargo: inviteCargo || null,
          whatsapp: inviteWhatsapp || null,
          phone: inviteRole === "department" ? (invitePhone || null) : null,
          activities: inviteRole === "department" ? (inviteActivities || null) : null,
        },
      });
      
      if (error) {
        // O supabase-js omite o corpo do erro 400 por padrão.
        // Vamos lançar um erro mais claro sugerindo o Rate Limit
        throw new Error("Erro do servidor (Edge Function). Possivelmente você atingiu o limite de envio de e-mails do Supabase (Rate Limit) ou o e-mail já existe.");
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }

      toast({ title: "Convite enviado", description: `E-mail de convite enviado para ${inviteEmail}` });
      setIsInviteOpen(false);
      resetInviteForm();
      fetchProfiles();
    } catch (error: any) {
      toast({ title: "Falha no convite", description: error.message, variant: "destructive" });
    } finally {
      setInviteLoading(false);
    }
  };

  const resetInviteForm = () => {
    setInviteEmail(""); setInviteName(""); setInviteRole("school");
    setInviteSchoolUnitId(""); setInviteDepartmentId("");
    setInviteCargo(""); setInviteWhatsapp("");
    setInvitePhone(""); setInviteActivities("");
  };

  // --- Edit ---
  const openEdit = (p: Profile) => {
    setEditProfile(p);
    setEditName(p.name || "");
    setEditRole(p.role);
    setEditCargo(p.cargo || "");
    setEditWhatsapp(p.whatsapp || "");
    setEditPhone(p.phone || "");
    setEditActivities(p.activities || "");
    setEditSchoolUnitId(p.school_unit_id || "");
    setEditDepartmentId((p as any).department_id || "");
    setIsEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editProfile) return;
    setEditLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        name: editName,
        role: editRole as any,
        cargo: editCargo || null,
        whatsapp: editWhatsapp || null,
        phone: editRole === "department" ? (editPhone || null) : null,
        activities: editRole === "department" ? (editActivities || null) : null,
        school_unit_id: editRole === "school" ? (editSchoolUnitId || null) : null,
        department_id: editRole === "department" ? (editDepartmentId || null) : null,
      } as any)
      .eq("id", editProfile.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Usuário atualizado com sucesso" });
      setIsEditOpen(false);
      fetchProfiles();
    }
    setEditLoading(false);
  };

  // --- Change Password ---
  const openPasswordModal = (p: Profile) => {
    setPasswordTarget(p);
    setNewPassword("");
    setIsPasswordOpen(true);
  };

  const handleChangePassword = async () => {
    if (!passwordTarget || !newPassword.trim()) return;
    setPasswordLoading(true);
    try {
      await callAdminAction({ action: "updatePassword", userId: passwordTarget.id, password: newPassword });
      toast({ title: "Senha atualizada com sucesso" });
      setIsPasswordOpen(false);
    } catch (err: any) {
      toast({ title: "Erro ao alterar senha", description: err.message, variant: "destructive" });
    } finally {
      setPasswordLoading(false);
    }
  };

  // --- Generate Link ---
  const handleGenerateLink = async (p: Profile, linkType: "magiclink" | "recovery") => {
    setActionLoading(p.id);
    try {
      const data = await callAdminAction({ action: "generateLink", email: p.email, linkType });
      const label = linkType === "recovery" ? "Redefinição de Senha" : "Link Mágico";
      if (data.link) {
        await navigator.clipboard.writeText(data.link);
        toast({ title: `${label} gerado`, description: "Link copiado para a área de transferência." });
      } else {
        toast({ title: `${label} gerado` });
      }
    } catch (err: any) {
      toast({ title: "Erro ao gerar link", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  // --- Suspend / Reactivate ---
  const handleSuspend = async (p: Profile) => {
    setActionLoading(p.id);
    try {
      await callAdminAction({ action: "suspendUser", userId: p.id });
      toast({ title: "Acesso suspenso", description: `${p.name || p.email} foi suspenso.` });
      fetchProfiles();
    } catch (err: any) {
      toast({ title: "Erro ao suspender", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async (p: Profile) => {
    setActionLoading(p.id);
    try {
      await callAdminAction({ action: "reactivateUser", userId: p.id });
      toast({ title: "Acesso reativado", description: `${p.name || p.email} foi reativado.` });
      fetchProfiles();
    } catch (err: any) {
      toast({ title: "Erro ao reativar", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  // --- Delete ---
  const openDeleteConfirm = (p: Profile) => {
    setDeleteTarget(p);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await callAdminAction({ action: "deleteUser", userId: deleteTarget.id });
      toast({ title: "Usuário excluído com sucesso" });
      setIsDeleteOpen(false);
      fetchProfiles();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  };

  // --- Role-dependent field rendering ---
  const renderRoleFields = (role: string, opts: {
    schoolUnitId: string; onSchoolChange: (v: string) => void;
    departmentId: string; onDepartmentChange: (v: string) => void;
    phone: string; onPhoneChange: (v: string) => void;
    activities: string; onActivitiesChange: (v: string) => void;
  }) => (
    <>
      {role === "school" && (
        <div className="space-y-2">
          <Label>Unidade Escolar</Label>
          <SchoolUnitCombobox value={opts.schoolUnitId} onChange={opts.onSchoolChange} />
        </div>
      )}
      {role === "department" && (
        <>
          <div className="space-y-2">
            <Label>Setor / Departamento</Label>
            <DepartmentCombobox value={opts.departmentId} onChange={opts.onDepartmentChange} />
          </div>
          <div className="space-y-2">
            <Label>Telefone (Setor)</Label>
            <Input value={opts.phone} onChange={(e) => opts.onPhoneChange(e.target.value)} placeholder="(XX) XXXXX-XXXX" />
          </div>
          <div className="space-y-2">
            <Label className="mb-1">Atividades do Funcionário</Label>
            <div className="bg-white rounded-md">
              <ReactQuill
                theme="snow"
                value={opts.activities}
                onChange={opts.onActivitiesChange}
                placeholder="Descreva as tarefas diárias e responsabilidades..."
              />
            </div>
          </div>
        </>
      )}
    </>
  );

  // --- Filtering & Sorting Local Data ---
  const filteredProfiles = profiles.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const roleString = (roleLabels[p.role] || p.role).toLowerCase();
    const unitString = (p.unidade?.nome_escola || "").toLowerCase();
    const depString = (p.departamento?.name || "").toLowerCase();
    return (
      (p.name || "").toLowerCase().includes(term) ||
      p.email.toLowerCase().includes(term) ||
      (p.cargo || "").toLowerCase().includes(term) ||
      roleString.includes(term) ||
      unitString.includes(term) ||
      depString.includes(term)
    );
  });

  const sortedProfiles = [...filteredProfiles].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    
    let aVal: any = a[key as keyof typeof a];
    let bVal: any = b[key as keyof typeof b];

    if (key === "unidade_setor") {
      aVal = a.role === "school" ? a.unidade?.nome_escola : a.role === "department" ? a.departamento?.name : "";
      bVal = b.role === "school" ? b.unidade?.nome_escola : b.role === "department" ? b.departamento?.name : "";
    } else if (key === "role_label") {
      aVal = roleLabels[a.role] || a.role;
      bVal = roleLabels[b.role] || b.role;
    } else if (key === "last_sign_in_at") {
      aVal = authUsers[a.id] || "";
      bVal = authUsers[b.id] || "";
    }

    if (!aVal && bVal) return direction === "asc" ? -1 : 1;
    if (aVal && !bVal) return direction === "asc" ? 1 : -1;
    if (!aVal && !bVal) return 0;
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
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
  
  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
    return sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };
  
  const formatLastSignIn = (isoString?: string | null) => {
    if (!isoString) return "Nunca logou";
    try {
      return new Date(isoString).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return "Data inválida";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gerenciamento de Usuários</h1>
          <p className="text-muted-foreground">Convide usuários e gerencie perfis</p>
        </div>
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Convidar Usuário</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Convidar Novo Usuário</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="usuario@exemplo.com" type="email" />
              </div>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Nome Completo" />
              </div>
              <div className="space-y-2">
                <Label>Perfil</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="department">Setor</SelectItem>
                    <SelectItem value="school">Escola</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {renderRoleFields(inviteRole, {
                schoolUnitId: inviteSchoolUnitId, onSchoolChange: setInviteSchoolUnitId,
                departmentId: inviteDepartmentId, onDepartmentChange: setInviteDepartmentId,
                phone: invitePhone, onPhoneChange: setInvitePhone,
                activities: inviteActivities, onActivitiesChange: setInviteActivities,
              })}
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input value={inviteCargo} onChange={(e) => setInviteCargo(e.target.value)} placeholder="Ex.: Diretor(a)" />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input value={inviteWhatsapp} onChange={(e) => setInviteWhatsapp(e.target.value)} placeholder="(XX) XXXXX-XXXX" />
              </div>
              <Button onClick={handleInvite} className="w-full" disabled={inviteLoading}>
                <Send className="mr-2 h-4 w-4" />
                {inviteLoading ? "Enviando..." : "Enviar Convite"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={editProfile?.email || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="department">Setor</SelectItem>
                  <SelectItem value="school">Escola</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {renderRoleFields(editRole, {
              schoolUnitId: editSchoolUnitId, onSchoolChange: setEditSchoolUnitId,
              departmentId: editDepartmentId, onDepartmentChange: setEditDepartmentId,
              phone: editPhone, onPhoneChange: setEditPhone,
              activities: editActivities, onActivitiesChange: setEditActivities,
            })}
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input value={editCargo} onChange={(e) => setEditCargo(e.target.value)} placeholder="Ex.: Diretor(a)" />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={editWhatsapp} onChange={(e) => setEditWhatsapp(e.target.value)} placeholder="(XX) XXXXX-XXXX" />
            </div>
            <Button onClick={handleEditSave} className="w-full" disabled={editLoading}>
              <Save className="mr-2 h-4 w-4" />
              {editLoading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar Senha</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Definir nova senha para <strong>{passwordTarget?.name || passwordTarget?.email}</strong>
            </p>
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <Button onClick={handleChangePassword} className="w-full" disabled={passwordLoading || newPassword.length < 6}>
              <KeyRound className="mr-2 h-4 w-4" />
              {passwordLoading ? "Salvando..." : "Atualizar Senha"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name || deleteTarget?.email}</strong>? Esta ação não pode ser desfeita e todos os dados associados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteLoading ? "Excluindo..." : "Confirmar Exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Users Table */}
      <div className="flex items-center justify-between mb-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Busque por nome, e-mail, perfil, unidade, setor ou cargo..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : sortedProfiles.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum usuário encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('name')}>
                      <div className="flex items-center">Nome <SortIcon columnKey="name" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('email')}>
                      <div className="flex items-center">E-mail <SortIcon columnKey="email" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('role_label')}>
                      <div className="flex items-center">Perfil <SortIcon columnKey="role_label" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('unidade_setor')}>
                      <div className="flex items-center">Unidade / Setor <SortIcon columnKey="unidade_setor" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('cargo')}>
                      <div className="flex items-center">Cargo <SortIcon columnKey="cargo" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('last_sign_in_at')}>
                      <div className="flex items-center">Último Acesso <SortIcon columnKey="last_sign_in_at" /></div>
                    </TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProfiles.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name || "—"}</TableCell>
                      <TableCell>{p.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={roleBadgeClasses[p.role]}>
                          {roleLabels[p.role] || p.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {p.role === "school" ? (p.unidade?.nome_escola || "—") :
                          p.role === "department" ? (p.departamento?.name || "—") : "—"}
                      </TableCell>
                      <TableCell>{p.cargo || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatLastSignIn(authUsers[p.id])}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={actionLoading === p.id}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(p)}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar Perfil
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openPasswordModal(p)}>
                              <KeyRound className="mr-2 h-4 w-4" /> Alterar Senha
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleGenerateLink(p, "magiclink")}>
                              <Mail className="mr-2 h-4 w-4" /> Enviar Link Mágico
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleGenerateLink(p, "recovery")}>
                              <RefreshCw className="mr-2 h-4 w-4" /> Enviar Redefinição de Senha
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleSuspend(p)}>
                              <Ban className="mr-2 h-4 w-4" /> Suspender Acesso
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleReactivate(p)}>
                              <CheckCircle className="mr-2 h-4 w-4" /> Reativar Acesso
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openDeleteConfirm(p)} className="text-destructive focus:text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir Usuário
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
