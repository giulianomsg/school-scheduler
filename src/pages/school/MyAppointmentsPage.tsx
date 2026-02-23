import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays } from "lucide-react";

export default function MyAppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAppointments = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("appointments")
      .select("*, timeslots!inner(*, departments(*))")
      .eq("requester_id", user.id)
      .order("created_at", { ascending: false });
    setAppointments(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAppointments(); }, [user]);

const handleCancel = async (appointmentId: string, startTime: string, departmentId: string) => {
    // 1. Verificação de Cooldown (2 horas)
    const appointmentTime = new Date(startTime).getTime();
    const now = new Date().getTime();
    const hoursDifference = (appointmentTime - now) / (1000 * 60 * 60);

    if (hoursDifference < 2 && hoursDifference > 0) {
      toast({
        title: "Ação não permitida",
        description: "Cancelamentos só podem ser feitos com pelo menos 2 horas de antecedência.",
        variant: "destructive",
      });
      return;
    }

    if (!window.confirm("Tem certeza que deseja cancelar este agendamento?")) return;

    try {
      // 2. Cancela o agendamento
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled", cancel_reason: "Cancelado pela Escola" })
        .eq("id", appointmentId);

      if (error) throw error;

      // 3. (Opcional) Retorna o horário para disponível
      // (Se a sua trigger de banco de dados não faz isso automaticamente)
      // await supabase.from('timeslots').update({ is_available: true }).eq('id', timeslotId);

      // 4. Notifica o Departamento
      // Busca todos os funcionários do setor
      const { data: deptUsers } = await supabase
        .from("profiles")
        .select("id")
        .eq("department_id", departmentId);

      if (deptUsers) {
        const notifications = deptUsers.map(u => ({
          user_id: u.id,
          title: "Cancelamento de Escola",
          message: "Uma escola cancelou um agendamento.",
        }));
        await supabase.from("notifications").insert(notifications);
      }

      toast({ title: "Sucesso", description: "Agendamento cancelado." });
      // Chame sua função de recarregar a lista aqui (ex: fetchAppointments())
      
    } catch (error: any) {
      toast({ title: "Erro ao cancelar", description: error.message, variant: "destructive" });
    }
  };

  const statusBadge = (status: string) => (
    <Badge
      variant="outline"
      className={
        status === "active"
          ? "bg-success/10 text-success border-success/20"
          : "bg-destructive/10 text-destructive border-destructive/20"
      }
    >
      {status === "active" ? "Ativo" : "Cancelado"}
    </Badge>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meus Agendamentos</h1>
        <p className="text-muted-foreground">Visualize e gerencie seus agendamentos</p>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : appointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">Nenhum agendamento ainda. Agende um para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => (
            <Card key={appt.id}>
              <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{appt.timeslots?.departments?.name || "Setor"}</p>
                    {statusBadge(appt.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(appt.timeslots.start_time), "dd/MM/yyyy", { locale: ptBR })} ·{" "}
                    {format(new Date(appt.timeslots.start_time), "HH:mm")} -{" "}
                    {format(new Date(appt.timeslots.end_time), "HH:mm")}
                  </p>
                  <p className="text-sm text-muted-foreground">{appt.description}</p>
                </div>
                {appt.status === "active" && (
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => handleCancel(appt.id, appt.timeslots.start_time, appt.timeslots.department_id)}>
                    Cancelar
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
