import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Send } from "lucide-react";
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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("school");
  const [inviteSchoolUnit, setInviteSchoolUnit] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setProfiles(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchProfiles(); }, []);

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
          school_unit: inviteSchoolUnit || null,
        },
      });
      if (error) throw error;
      toast({ title: "Convite enviado", description: `E-mail de convite enviado para ${inviteEmail}` });
      setIsInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("school");
      setInviteSchoolUnit("");
      fetchProfiles();
    } catch (error: any) {
      toast({ title: "Falha no convite", description: error.message, variant: "destructive" });
    } finally {
      setInviteLoading(false);
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
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Convidar Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar Novo Usuário</DialogTitle>
            </DialogHeader>
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="department">Setor</SelectItem>
                    <SelectItem value="school">Escola</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {inviteRole === "school" && (
                <div className="space-y-2">
                  <Label>Unidade Escolar</Label>
                  <Input value={inviteSchoolUnit} onChange={(e) => setInviteSchoolUnit(e.target.value)} placeholder="Ex.: Escola Municipal nº 12" />
                </div>
              )}
              <Button onClick={handleInvite} className="w-full" disabled={inviteLoading}>
                <Send className="mr-2 h-4 w-4" />
                {inviteLoading ? "Enviando..." : "Enviar Convite"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : profiles.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum usuário ainda.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Unidade Escolar</TableHead>
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
                    <TableCell>{p.school_unit || "—"}</TableCell>
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
