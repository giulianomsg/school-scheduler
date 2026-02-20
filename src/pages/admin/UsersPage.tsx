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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Send, Save, MoreHorizontal, Pencil, KeyRound, Mail, RefreshCw, Ban, CheckCircle, Trash2 } from "lucide-react";
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
  const [inviteLoading, setInviteLoading] = useState(false);

  // Edit state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<string>("school");
  const [editCargo, setEditCargo] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
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

const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*, unidades_escolares(nome_escola), departments(name)")
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
        },
      });
      if (error) throw error;
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
  };

  // --- Edit ---
  const openEdit = (p: Profile) => {
    setEditProfile(p);
    setEditName(p.name || "");
    setEditRole(p.role);
    setEditCargo(p.cargo || "");
    setEditWhatsapp(p.whatsapp || "");
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
  }) => (
    <>
      {role === "school" && (
        <div className="space-y-2">
          <Label>Unidade Escolar</Label>
          <SchoolUnitCombobox value={opts.schoolUnitId} onChange={opts.onSchoolChange} />
        </div>
      )}
      {role === "department" && (
        <div className="space-y-2">
          <Label>Setor</Label>
          <DepartmentCombobox value={opts.departmentId} onChange={opts.onDepartmentChange} />
        </div>
      )}
    </>
  );

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
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : profiles.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum usuário ainda.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Unidade / Setor</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((p) => (
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
