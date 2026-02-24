import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, CheckCircle2, Star, UserX, AlertTriangle } from "lucide-react";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function DepartmentDashboard() {
  const { user } = useAuth();
  const [departmentName, setDepartmentName] = useState("");
  const [allAppointments, setAllAppointments] = useState<any[]>([]);
  const [concludeOpen, setConcludeOpen] = useState(false);
  const [concludeId, setConcludeId] = useState("");
  const [concludeNotes, setConcludeNotes] = useState("");

  const fetchData = async () => {
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("department_id")
      .eq("id", user.id)
      .single();

    if (!profile?.department_id) return;

    const { data: dept } = await supabase
      .from("departments")
      .select("name")
      .eq("id", profile.department_id)
      .single();

    if (dept) setDepartmentName(dept.name);

    const { data: appts } = await supabase
      .from("appointments")
      .select("*, timeslots!inner(*), profiles!appointments_requester_id_fkey(*)")
      .eq("timeslots.department_id", profile.department_id)
      .order("created_at", { ascending: false });

    setAllAppointments(appts || []);
  };

  useEffect(() => { fetchData(); }, [user]);

  // Derived data
  const pendingAppointments = useMemo(() =>
    allAppointments.filter(a => a.status === "active" && new Date(a.timeslots.start_time) <= new Date()),
    [allAppointments]
  );

  const todayAppointments = useMemo(() =>
    allAppointments.filter(a => isToday(new Date(a.timeslots.start_time))),
    [allAppointments]
  );

  const completedCount = useMemo(() =>
    allAppointments.filter(a => a.status === "completed").length,
    [allAppointments]
  );

  const noShowCount = useMemo(() =>
    allAppointments.filter(a => a.status === "no-show").length,
    [allAppointments]
  );

  const avgRating = useMemo(() => {
    const rated = allAppointments.filter(a => a.status === "completed" && a.rating != null);
    if (rated.length === 0) return null;
    const sum = rated.reduce((acc, a) => acc + a.rating, 0);
    return (sum / rated.length).toFixed(1);
  }, [allAppointments]);

  // Handlers
  const handleSectorCancel = async (appointmentId: string, schoolUserId: string) => {
    const reason = window.prompt("Digite o motivo do cancelamento (Obrigatório para notificar a escola):");
    if (reason === null) return;
    if (reason.trim() === "") {
      toast({ title: "Justificativa Ausente", description: "Você deve informar um motivo para cancelar o agendamento.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.from("appointments").update({ status: "cancelled", cancel_reason: reason }).eq("id", appointmentId);
      if (error) throw error;
      await supabase.from("notifications").insert({ user_id: schoolUserId, title: "Agendamento Cancelado pelo Setor", message: `O seu agendamento foi cancelado. Motivo: ${reason}` });
      toast({ title: "Sucesso", description: "Agendamento cancelado e escola notificada." });
      setAllAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, status: "cancelled" } : a));
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleNoShow = async (appointmentId: string) => {
    if (!window.confirm("Marcar este agendamento como falta?")) return;
    try {
      const { error } = await supabase.from("appointments").update({ status: "no-show" as any }).eq("id", appointmentId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Agendamento marcado como falta." });
      setAllAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, status: "no-show" } : a));
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleConclude = async () => {
    try {
      const { error } = await supabase.from("appointments").update({ status: "completed" as any, department_notes: concludeNotes || null }).eq("id", concludeId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Atendimento concluído." });
      setAllAppointments(prev => prev.map(a => a.id === concludeId ? { ...a, status: "completed", department_notes: concludeNotes } : a));
      setConcludeOpen(false);
      setConcludeNotes("");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      active: { cls: "bg-success/10 text-success border-success/20", label: "Ativo" },
      cancelled: { cls: "bg-muted text-muted-foreground", label: "Cancelado" },
      completed: { cls: "bg-emerald-100 text-emerald-700 border-emerald-300", label: "Concluído" },
      "no-show": { cls: "bg-red-100 text-red-800 border-red-300", label: "Falta" },
    };
    const s = map[status] || map.cancelled;
    return <Badge variant="outline" className={s.cls}>{s.label}</Badge>;
  };

  const renderAppointmentCard = (appt: any, showPendingAlert = false) => (
    <div key={appt.id} className={`flex items-center justify-between rounded-lg border p-4 ${showPendingAlert ? "border-amber-400 bg-amber-50/50" : ""}`}>
      <div>
        {showPendingAlert && (
          <div className="flex items-center gap-1 text-amber-600 text-xs font-medium mb-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Aguardando desfecho
          </div>
        )}
        <p className="font-medium">{appt.profiles?.name || appt.profiles?.email}</p>
        <p className="text-sm text-muted-foreground">{appt.description}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {format(new Date(appt.timeslots.start_time), "dd/MM · HH:mm", { locale: ptBR })} - {format(new Date(appt.timeslots.end_time), "HH:mm")}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        {statusBadge(appt.status)}
        {appt.status === "active" && new Date(appt.timeslots.start_time) > new Date() && (
          <Button variant="destructive" size="sm" onClick={() => handleSectorCancel(appt.id, appt.requester_id)}>Cancelar</Button>
        )}
        {appt.status === "active" && new Date(appt.timeslots.start_time) <= new Date() && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-destructive border-destructive/30" onClick={() => handleNoShow(appt.id)}>Marcar Falta</Button>
            <Button variant="outline" size="sm" className="text-emerald-700 border-emerald-300" onClick={() => { setConcludeId(appt.id); setConcludeNotes(""); setConcludeOpen(true); }}>Concluir Atendimento</Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel do Setor</h1>
        <p className="text-muted-foreground">{departmentName || "Carregando..."}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nota Média</CardTitle>
            <Star className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgRating ?? "—"}<span className="text-base font-normal text-muted-foreground">/5.0</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Atendimentos Concluídos</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{completedCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Faltas</CardTitle>
            <UserX className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{noShowCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendências</CardTitle>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{pendingAppointments.length}</div></CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={pendingAppointments.length > 0 ? "pending" : "today"} className="w-full">
        <TabsList>
          <TabsTrigger value="pending">
            Pendências {pendingAppointments.length > 0 && <Badge className="ml-2 bg-amber-500 text-white">{pendingAppointments.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="today">Agenda de Hoje</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader><CardTitle>Aguardando Desfecho</CardTitle></CardHeader>
            <CardContent>
              {pendingAppointments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhuma pendência. Tudo em dia!</p>
              ) : (
                <div className="space-y-3">{pendingAppointments.map(a => renderAppointmentCard(a, true))}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="today">
          <Card>
            <CardHeader><CardTitle>Agendamentos de Hoje</CardTitle></CardHeader>
            <CardContent>
              {todayAppointments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum agendamento para hoje.</p>
              ) : (
                <div className="space-y-3">{todayAppointments.map(a => renderAppointmentCard(a))}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={concludeOpen} onOpenChange={setConcludeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir Atendimento</DialogTitle>
            <DialogDescription className="hidden">Preencha as anotações para concluir o atendimento.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Anotações da reunião (opcional)" value={concludeNotes} onChange={(e) => setConcludeNotes(e.target.value)} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConcludeOpen(false)}>Cancelar</Button>
            <Button onClick={handleConclude}>Salvar e Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
