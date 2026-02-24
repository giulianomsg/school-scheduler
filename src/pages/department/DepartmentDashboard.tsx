import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function DepartmentDashboard() {
  const { user } = useAuth();
  const [departmentName, setDepartmentName] = useState("");
  const [stats, setStats] = useState({ totalSlots: 0, availableSlots: 0, activeAppointments: 0 });
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [concludeOpen, setConcludeOpen] = useState(false);
  const [concludeId, setConcludeId] = useState("");
  const [concludeNotes, setConcludeNotes] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("department_id")
        .eq("id", user.id)
        .single();

      if (!profile?.department_id) return;

      const { data: dept } = await supabase
        .from("departments")
        .select("*")
        .eq("id", profile.department_id)
        .single();

      if (!dept) return;
      setDepartmentName(dept.name);

      const [totalSlots, availableSlots, activeAppts] = await Promise.all([
        supabase.from("timeslots").select("id", { count: "exact", head: true }).eq("department_id", dept.id),
        supabase.from("timeslots").select("id", { count: "exact", head: true }).eq("department_id", dept.id).eq("is_available", true),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);

      setStats({
        totalSlots: totalSlots.count ?? 0,
        availableSlots: availableSlots.count ?? 0,
        activeAppointments: activeAppts.count ?? 0,
      });

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data: appts } = await supabase
        .from("appointments")
        .select("*, timeslots!inner(*), profiles!appointments_requester_id_fkey(*)")
        .eq("timeslots.department_id", dept.id)
        .eq("status", "active")
        .gte("timeslots.start_time", todayStart.toISOString())
        .lte("timeslots.start_time", todayEnd.toISOString())
        .order("created_at", { ascending: true });

      setTodayAppointments(appts || []);
    };
    fetchData();
  }, [user]);

const handleSectorCancel = async (appointmentId: string, schoolUserId: string) => {
    const reason = window.prompt("Digite o motivo do cancelamento (Obrigatório para notificar a escola):");
    
    if (reason === null) return; 
    if (reason.trim() === "") {
      toast({
        title: "Justificativa Ausente",
        description: "Você deve informar um motivo para cancelar o agendamento.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("appointments")
        .update({ 
          status: "cancelled", 
          cancel_reason: reason 
        })
        .eq("id", appointmentId);

      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: schoolUserId,
        title: "Agendamento Cancelado pelo Setor",
        message: `O seu agendamento foi cancelado. Motivo: ${reason}`,
      });

      toast({ title: "Sucesso", description: "Agendamento cancelado e escola notificada." });
      
      // Atualiza a tela instantaneamente sem precisar de F5
      setTodayAppointments((prev) => 
        prev.map(appt => appt.id === appointmentId ? { ...appt, status: "cancelled" } : appt)
      );
      
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
      setTodayAppointments((prev) => prev.map(a => a.id === appointmentId ? { ...a, status: "no-show" } : a));
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleConclude = async () => {
    try {
      const { error } = await supabase.from("appointments").update({ status: "completed" as any, department_notes: concludeNotes || null }).eq("id", concludeId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Atendimento concluído." });
      setTodayAppointments((prev) => prev.map(a => a.id === concludeId ? { ...a, status: "completed", department_notes: concludeNotes } : a));
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel do Setor</h1>
        <p className="text-muted-foreground">{departmentName || "Carregando..."}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Horários</CardTitle>
            <Clock className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats.totalSlots}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Disponíveis</CardTitle>
            <CalendarDays className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats.availableSlots}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Agendamentos Ativos</CardTitle>
            <Users className="h-5 w-5 text-secondary" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats.activeAppointments}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agendamentos de Hoje</CardTitle>
        </CardHeader>
        <CardContent>
          {todayAppointments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum agendamento para hoje.</p>
          ) : (
            <div className="space-y-3">
              {todayAppointments.map((appt) => (
                <div key={appt.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">{appt.profiles?.name || appt.profiles?.email}</p>
                    <p className="text-sm text-muted-foreground">{appt.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(appt.timeslots.start_time), "HH:mm")} - {format(new Date(appt.timeslots.end_time), "HH:mm")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                      {statusBadge(appt.status)}
                      {appt.status === "active" && new Date(appt.timeslots.start_time) > new Date() && (
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => handleSectorCancel(appt.id, appt.requester_id)}
                        >
                          Cancelar
                        </Button>
                      )}
                      {appt.status === "active" && new Date(appt.timeslots.start_time) <= new Date() && (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="text-destructive border-destructive/30" onClick={() => handleNoShow(appt.id)}>
                            Marcar Falta
                          </Button>
                          <Button variant="outline" size="sm" className="text-emerald-700 border-emerald-300" onClick={() => { setConcludeId(appt.id); setConcludeNotes(""); setConcludeOpen(true); }}>
                            Concluir Atendimento
                          </Button>
                        </div>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={concludeOpen} onOpenChange={setConcludeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir Atendimento</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Anotações da reunião (opcional)"
            value={concludeNotes}
            onChange={(e) => setConcludeNotes(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConcludeOpen(false)}>Cancelar</Button>
            <Button onClick={handleConclude}>Salvar e Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
