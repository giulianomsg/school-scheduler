import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function SchoolCalendarPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchAppointments = async () => {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

      const { data } = await supabase
        .from("appointments")
        .select("*, timeslots!inner(start_time, end_time, departments(name))")
        .eq("requester_id", user.id)
        .gte("timeslots.start_time", weekStart.toISOString())
        .lte("timeslots.start_time", weekEnd.toISOString());

      setAppointments(data || []);
    };
    fetchAppointments();
  }, [user, currentDate]);

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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendário da Escola</h1>
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
                  dayAppts.map((appt) => (
                    <div key={appt.id} className="rounded-md border p-2 text-xs space-y-1.5 flex flex-col">
                      <div className="flex justify-between items-start">
                        <span className="font-semibold truncate text-foreground">
                          {format(new Date(appt.timeslots.start_time), "HH:mm")}
                        </span>
                        {statusBadge(appt.status)}
                      </div>
                      <span className="font-medium text-primary truncate" title={appt.timeslots?.departments?.name}>
                        {appt.timeslots?.departments?.name || "Setor"}
                      </span>
                      <p className="text-muted-foreground/80 line-clamp-2 leading-relaxed" title={appt.description}>
                        {appt.description}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
