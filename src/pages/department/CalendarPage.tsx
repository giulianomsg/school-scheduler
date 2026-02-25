import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function CalendarPage() {
  const { user } = useAuth();
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchDept = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("department_id")
        .eq("id", user.id)
        .single();
      if (data?.department_id) setDepartmentId(data.department_id);
      setLoading(false);
    };
    fetchDept();
  }, [user]);

  useEffect(() => {
    if (!departmentId) return;
    const fetchAppointments = async () => {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

      // Atualizado para buscar os dados relacionais da unidade escolar a partir do perfil
      const { data } = await supabase
        .from("appointments")
        .select(`
          *,
          timeslots!inner(*),
          profiles!appointments_requester_id_fkey(
            *,
            school_units(name)
          )
        `)
        .eq("timeslots.department_id", departmentId)
        .gte("timeslots.start_time", weekStart.toISOString())
        .lte("timeslots.start_time", weekEnd.toISOString())
        .order("created_at", { ascending: true });

      setAppointments(data || []);
    };
    fetchAppointments();
  }, [departmentId, currentDate]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const prevWeek = () => setCurrentDate(addDays(currentDate, -7));
  const nextWeek = () => setCurrentDate(addDays(currentDate, 7));

  const statusBadge = (status: string) => {
    if (status === "active") {
      return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Ativo</Badge>;
    }
    if (status === "cancelled") {
      return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Cancelado</Badge>;
    }
    return <Badge variant="outline" className="bg-secondary/20 text-secondary-foreground">{status}</Badge>;
  };

  if (!departmentId && !loading) {
    return <div className="p-8 text-center text-muted-foreground">Você ainda não foi vinculado a nenhum setor. Contate o administrador.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendário Semanal</h1>
          <p className="text-muted-foreground">
            {format(weekDays[0], "dd MMM", { locale: ptBR })} - {format(weekDays[6], "dd MMM yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={prevWeek}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
          <Button variant="outline" size="icon" onClick={nextWeek}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        {weekDays.map((day) => {
          const dayAppts = appointments.filter((a) =>
            isSameDay(new Date(a.timeslots.start_time), day)
          );
          const isToday = isSameDay(day, new Date());

          return (
            <Card key={day.toISOString()} className={isToday ? "ring-2 ring-primary" : ""}>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs font-medium">
                  <span className="text-muted-foreground">{format(day, "EEE", { locale: ptBR })}</span>
                  <br />
                  <span className={`text-lg ${isToday ? "text-primary" : ""}`}>{format(day, "dd")}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-2">
                {dayAppts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center">—</p>
                ) : (
                  dayAppts.map((appt) => {
                    // Extração defensiva da estrutura aninhada retornada pelo Supabase
                    const schoolData = appt.profiles?.school_units;
                    const schoolName = Array.isArray(schoolData) ? schoolData[0]?.name : schoolData?.name;

                    return (
                      <div key={appt.id} className="rounded-md border p-2 text-xs space-y-1.5 flex flex-col">
                        <div className="flex justify-between items-start">
                          <span className="font-semibold truncate text-foreground">
                            {format(new Date(appt.timeslots.start_time), "HH:mm")}
                          </span>
                          {statusBadge(appt.status)}
                        </div>
                        
                        {schoolName && (
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-primary truncate" title={schoolName}>
                              {schoolName}
                            </span>
                          </div>
                        )}
                        
                        <p className="text-muted-foreground font-medium truncate" title={appt.profiles?.name || appt.profiles?.email}>
                          {appt.profiles?.name || appt.profiles?.email}
                        </p>
                        
                        <p className="text-muted-foreground/80 line-clamp-2 leading-relaxed" title={appt.description}>
                          {appt.description}
                        </p>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}