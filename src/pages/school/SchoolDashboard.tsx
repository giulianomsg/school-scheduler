import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, CheckCircle, XCircle, Clock, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function SchoolDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ active: 0, cancelled: 0, total: 0 });
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [activeAppointments, setActiveAppointments] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [active, cancelled] = await Promise.all([
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("requester_id", user.id).eq("status", "active"),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("requester_id", user.id).eq("status", "cancelled"),
      ]);
      setStats({
        active: active.count ?? 0,
        cancelled: cancelled.count ?? 0,
        total: (active.count ?? 0) + (cancelled.count ?? 0),
      });

      if (profile?.school_unit_id) {
        const { data } = await supabase.from("unidades_escolares").select("nome_escola").eq("id", profile.school_unit_id).single();
        setSchoolName(data?.nome_escola || null);
      }

      // Buscar agendamentos ativos com join de timeslots e departments
      const { data: activeAppts } = await supabase
        .from("appointments")
        .select("*, timeslots!inner(start_time, end_time, departments(name))")
        .eq("requester_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      setActiveAppointments(activeAppts || []);
    };
    fetchData();
  }, [user, profile]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Bem-vindo(a), {profile?.name || "Diretor(a)"}</h1>
        <p className="text-muted-foreground">{schoolName || "Painel da Escola"}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Agendamentos</CardTitle>
            <CalendarDays className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ativos</CardTitle>
            <CheckCircle className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats.active}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cancelados</CardTitle>
            <XCircle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats.cancelled}</div></CardContent>
        </Card>
      </div>

      {/* Agenda Ativa Imediata */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Seus Próximos Atendimentos</h2>
        {activeAppointments.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <CalendarDays className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="font-medium">Nenhum agendamento ativo no momento.</p>
              <p className="text-sm mt-1">Acesse "Agendar" no menu para marcar um novo atendimento.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {activeAppointments.map((appt) => (
              <Card key={appt.id}>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{appt.timeslots?.departments?.name || "Setor"}</h3>
                      <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">Ativo</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      {appt.description}
                    </p>
                  </div>
                  <div className="text-sm font-medium flex items-center gap-1.5 text-primary shrink-0">
                    <Clock className="h-4 w-4" />
                    {format(new Date(appt.timeslots.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
