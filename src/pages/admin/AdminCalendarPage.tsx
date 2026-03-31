import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Briefcase } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AdminCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAppointments = async () => {
      setLoading(true);
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = addDays(endOfWeek(currentDate, { weekStartsOn: 1 }), 1); // Expand properly

      const { data: appts } = await supabase
        .from("appointments")
        .select(`
          *,
          timeslots!inner(
            *,
            departments(name)
          ),
          profiles!appointments_requester_id_fkey(
            name,
            email,
            unidades_escolares(*)
          )
        `);

      // Filtrar apenas a semana
      const currentWeekAppts = (appts || []).filter(appt => {
        const d = new Date(appt.timeslots.start_time);
        return d >= weekStart && d <= weekEnd;
      });

      // Ordenar por hora
      const sortedAppts = currentWeekAppts.sort((a, b) => 
        new Date(a.timeslots.start_time).getTime() - new Date(b.timeslots.start_time).getTime()
      );

      setAppointments(sortedAppts);
      setLoading(false);
    };

    fetchAppointments();
  }, [currentDate]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const prevWeek = () => setCurrentDate(addDays(currentDate, -7));
  const nextWeek = () => setCurrentDate(addDays(currentDate, 7));

  const statusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">Ativo</Badge>;
      case "cancelled": return <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200 text-[10px]">Cancelado</Badge>;
      case "completed": return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-[10px]">Concluído</Badge>;
      case "no-show": return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-[10px]">Falta</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendário Global (Administração)</h1>
          <p className="text-muted-foreground">
            {format(weekDays[0], "dd MMM", { locale: ptBR })} - {format(weekDays[6], "dd MMM yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex gap-2 items-start mt-2 sm:mt-0">
          <Button variant="outline" size="icon" onClick={prevWeek}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
          <Button variant="outline" size="icon" onClick={nextWeek}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        {weekDays.map((day) => {
          const dayAppts = appointments.filter((appt) =>
            isSameDay(new Date(appt.timeslots.start_time), day)
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
                <div className="mt-1 text-[10px] text-muted-foreground font-semibold">
                  {dayAppts.length} agendamento{dayAppts.length !== 1 ? 's' : ''}
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-3">
                {loading ? (
                  <p className="text-xs text-muted-foreground text-center animate-pulse">Carregando...</p>
                ) : dayAppts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center">—</p>
                ) : (
                  dayAppts.map((appt) => {
                    const deptName = appt.timeslots?.departments?.name || "Setor Indefinido";
                    const schoolData = appt.profiles?.unidades_escolares;
                    const schoolName = Array.isArray(schoolData) ? schoolData[0]?.nome_escola : schoolData?.nome_escola;

                    return (
                      <div key={appt.id} className="rounded-md border p-2 text-xs space-y-1.5 flex flex-col shadow-sm bg-white hover:border-sidebar-accent transition-colors">
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-foreground bg-slate-100 px-1 rounded">
                            {format(new Date(appt.timeslots.start_time), "HH:mm")}
                          </span>
                          {statusBadge(appt.status)}
                        </div>
                        
                        {/* Indicador de Departamento */}
                        <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-50 rounded px-1 py-0.5 border border-slate-100">
                          <Briefcase className="w-3 h-3 text-slate-400" />
                          <span className="truncate" title={deptName}>{deptName}</span>
                        </div>
                        
                        {schoolName && (
                          <span className="font-medium text-primary line-clamp-2" title={schoolName}>
                            {schoolName}
                          </span>
                        )}
                        
                        <p className="text-muted-foreground/90 line-clamp-3 leading-tight" title={appt.description}>
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
