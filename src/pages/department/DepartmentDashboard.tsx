import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DepartmentDashboard() {
  const { user } = useAuth();
  const [departmentName, setDepartmentName] = useState("");
  const [stats, setStats] = useState({ totalSlots: 0, availableSlots: 0, activeAppointments: 0 });
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: dept } = await supabase
        .from("departments")
        .select("*")
        .eq("head_id", user.id)
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

  const statusBadge = (status: string) => (
    <Badge variant="outline" className={status === "active" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>
      {status === "active" ? "Ativo" : "Cancelado"}
    </Badge>
  );

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
                  {statusBadge(appt.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
