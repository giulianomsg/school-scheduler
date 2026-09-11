import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Briefcase, Calendar as CalendarIcon, CalendarDays, Clock, CheckCircle2, XCircle, School, ShieldAlert } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function CalendarPage() {
  const { profile } = useAuth();
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [timeslots, setTimeslots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayModal, setSelectedDayModal] = useState<Date | null>(null);

  useEffect(() => {
    if (profile) {
      if (profile.role === 'department' && profile.department_id) {
        setDepartmentId(profile.department_id);
      } else if (profile.role === 'coordinator' && profile.coordinatorDepts && profile.coordinatorDepts.length > 0) {
        if (!departmentId) setDepartmentId(profile.coordinatorDepts[0].id);
      }
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (!departmentId) return;
    const fetchTimeslots = async () => {
      setLoading(true);

      let rangeStart: Date;
      let rangeEnd: Date;

      if (viewMode === "month") {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        rangeStart = startOfWeek(monthStart, { weekStartsOn: 1 });
        rangeEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      } else {
        rangeStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        rangeEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      }

      // Busca timeslots do setor com left join em appointments e perfis/escola
      const { data } = await supabase
        .from("timeslots")
        .select(`
          *,
          appointments(
            id,
            status,
            description,
            requester_id,
            profiles:requester_id(
              name,
              email,
              unidades_escolares:school_unit_id(nome_escola)
            )
          )
        `)
        .eq("department_id", departmentId)
        .gte("start_time", rangeStart.toISOString())
        .lte("start_time", rangeEnd.toISOString())
        .order("start_time", { ascending: true });

      setTimeslots(data || []);
      setLoading(false);
    };

    fetchTimeslots();
  }, [departmentId, currentDate, viewMode]);

  // General navigation
  const prevPeriod = () => {
    if (viewMode === "month") setCurrentDate(subMonths(currentDate, 1));
    else setCurrentDate(addDays(currentDate, -7));
  };

  const nextPeriod = () => {
    if (viewMode === "month") setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 7));
  };

  const goToToday = () => setCurrentDate(new Date());

  // Generate grid days
  const gridDays = (() => {
    if (viewMode === "month") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    }
  })();

  const statusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">Ativo</Badge>;
      case "cancelled": return <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200 text-[10px]">Cancelado</Badge>;
      case "completed": return <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Concluído</Badge>;
      case "no-show": return <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-200 text-[10px]">Falta</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  const getSlotsForDay = (day: Date) => {
    return timeslots.filter((ts) =>
      isSameDay(new Date(ts.start_time), day)
    );
  };

  const dayModalSlots = selectedDayModal ? getSlotsForDay(selectedDayModal) : [];

  if (!departmentId && !loading) {
    return <div className="p-8 text-center text-muted-foreground">Você ainda não foi vinculado a nenhum setor. Contate o administrador.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Calendário do Setor
          </h1>
          <p className="text-muted-foreground text-sm">
            {viewMode === "month"
              ? format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })
              : `Semana de ${format(gridDays[0], "dd/MM")} a ${format(gridDays[6], "dd/MM/yyyy")}`}
          </p>

          {profile?.role === 'coordinator' && profile.coordinatorDepts && profile.coordinatorDepts.length > 0 && (
            <div className="mt-3 w-72">
              <Select value={departmentId || ''} onValueChange={setDepartmentId}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione um setor" /></SelectTrigger>
                <SelectContent>
                  {profile.coordinatorDepts.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Alternador Mês / Semana */}
          <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1 border">
            <Button
              variant={viewMode === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("month")}
              className="h-8 text-xs px-3"
            >
              <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
              Mês
            </Button>
            <Button
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("week")}
              className="h-8 text-xs px-3"
            >
              <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
              Semana
            </Button>
          </div>

          {/* Navegação de Data */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={prevPeriod}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={goToToday}>
              Hoje
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={nextPeriod}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      <Card className="p-2 sm:p-4 bg-white shadow-sm border">
        {/* Day Header */}
        <div className="grid grid-cols-7 gap-1 text-center font-semibold text-xs text-muted-foreground border-b pb-2 mb-2">
          <div>Seg</div>
          <div>Ter</div>
          <div>Qua</div>
          <div>Qui</div>
          <div>Sex</div>
          <div className="text-slate-400">Sáb</div>
          <div className="text-slate-400">Dom</div>
        </div>

        {/* Days Cells */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {gridDays.map((day) => {
            const daySlots = getSlotsForDay(day);
            const isCurrentMonth = viewMode === "month" ? isSameMonth(day, currentDate) : true;
            const isTodayCell = isToday(day);

            return (
              <div
                key={day.toISOString()}
                onClick={() => setSelectedDayModal(day)}
                className={`min-h-[90px] sm:min-h-[120px] p-1.5 sm:p-2 border rounded-lg transition-all cursor-pointer flex flex-col justify-between ${
                  isTodayCell
                    ? "ring-2 ring-primary bg-blue-50/40 border-primary/40"
                    : isCurrentMonth
                    ? "bg-white hover:border-primary/50 hover:shadow-sm"
                    : "bg-slate-50/60 opacity-50 border-dashed"
                }`}
              >
                {/* Cell Header */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                      isTodayCell
                        ? "bg-primary text-primary-foreground"
                        : isCurrentMonth
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  {daySlots.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-slate-100 font-semibold">
                      {daySlots.length}
                    </Badge>
                  )}
                </div>

                {/* Event Pills Container (Desktop) */}
                <div className="space-y-1 flex-1 overflow-hidden hidden sm:block">
                  {loading ? (
                    <div className="text-[10px] text-muted-foreground animate-pulse">...</div>
                  ) : daySlots.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground/60 text-center pt-2">—</p>
                  ) : (
                    <>
                      {daySlots.slice(0, 2).map((slot) => {
                        const apptsList = Array.isArray(slot.appointments)
                          ? slot.appointments
                          : (slot.appointments ? [slot.appointments] : []);
                        
                        const activeAppt = apptsList.find((a: any) => a && a.status === "active")
                          || apptsList.find((a: any) => a && ["completed", "no-show"].includes(a.status))
                          || apptsList.find((a: any) => a && a.status !== "cancelled")
                          || apptsList[0];

                        const hasValidAppt = activeAppt && activeAppt.id && activeAppt.status !== "cancelled";

                        if (!hasValidAppt) {
                          return (
                            <div key={slot.id} className="p-1 rounded text-[10px] border border-dashed text-slate-500 bg-slate-50 flex justify-between items-center">
                              <span>{format(new Date(slot.start_time), "HH:mm")}</span>
                              <span className={`font-semibold ${slot.is_available ? "text-emerald-600" : "text-slate-400"}`}>
                                {slot.is_available ? "Livre" : "Cancelado"}
                              </span>
                            </div>
                          );
                        }

                        const profileData = activeAppt.profiles;
                        const schoolData = profileData?.unidades_escolares;
                        const schoolName = Array.isArray(schoolData) ? schoolData[0]?.nome_escola : schoolData?.nome_escola;

                        return (
                          <div
                            key={slot.id}
                            className={`p-1 rounded text-[10px] border flex flex-col leading-tight truncate ${
                              activeAppt.status === "active"
                                ? "bg-blue-50 border-blue-200 text-blue-900"
                                : activeAppt.status === "completed"
                                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                                : activeAppt.status === "cancelled"
                                ? "bg-slate-100 border-slate-200 text-slate-500 opacity-70"
                                : "bg-rose-50 border-rose-200 text-rose-900"
                            }`}
                          >
                            <div className="flex items-center justify-between font-semibold">
                              <span>{format(new Date(slot.start_time), "HH:mm")}</span>
                              {statusBadge(activeAppt.status)}
                            </div>
                            {schoolName && <span className="truncate font-medium">{schoolName}</span>}
                          </div>
                        );
                      })}

                      {daySlots.length > 2 && (
                        <div className="text-[10px] font-semibold text-primary text-center pt-0.5">
                          +{daySlots.length - 2} mais
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Event Dots Container (Mobile) */}
                <div className="sm:hidden flex flex-wrap gap-1 mt-1 justify-center">
                  {daySlots.slice(0, 4).map((slot, idx) => {
                    const apptsList = Array.isArray(slot.appointments) ? slot.appointments : (slot.appointments ? [slot.appointments] : []);
                    const activeAppt = apptsList.find((a: any) => a && a.status === "active");
                    return (
                      <span
                        key={idx}
                        className={`h-2 w-2 rounded-full ${
                          activeAppt ? "bg-blue-500" : slot.is_available ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                      />
                    );
                  })}
                  {daySlots.length > 4 && (
                    <span className="text-[9px] font-bold text-muted-foreground">+</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Day Details Modal */}
      <Dialog open={!!selectedDayModal} onOpenChange={(open) => !open && setSelectedDayModal(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              {selectedDayModal && format(selectedDayModal, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </DialogTitle>
            <DialogDescription>
              {dayModalSlots.length} horário(s) no expediente deste dia.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {dayModalSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum horário cadastrado para esta data.
              </p>
            ) : (
              dayModalSlots.map((slot) => {
                const apptsList = Array.isArray(slot.appointments)
                  ? slot.appointments
                  : (slot.appointments ? [slot.appointments] : []);
                
                const activeAppt = apptsList.find((a: any) => a && a.status === "active")
                  || apptsList.find((a: any) => a && ["completed", "no-show"].includes(a.status))
                  || apptsList.find((a: any) => a && a.status !== "cancelled")
                  || apptsList[0];

                const hasValidAppt = activeAppt && activeAppt.id && activeAppt.status !== "cancelled";

                if (!hasValidAppt) {
                  return (
                    <Card key={slot.id} className="p-3 border border-dashed bg-slate-50/60 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="font-semibold text-sm">
                          {format(new Date(slot.start_time), "HH:mm")} - {format(new Date(slot.end_time), "HH:mm")}
                        </span>
                      </div>
                      <Badge variant="outline" className={slot.is_available ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600"}>
                        {slot.is_available ? "Livre" : "Indisponível"}
                      </Badge>
                    </Card>
                  );
                }

                const profileData = activeAppt.profiles;
                const schoolData = profileData?.unidades_escolares;
                const schoolName = Array.isArray(schoolData) ? schoolData[0]?.nome_escola : schoolData?.nome_escola;

                return (
                  <Card key={slot.id} className="p-3 border shadow-sm space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <span className="font-bold text-sm text-foreground">
                          {format(new Date(slot.start_time), "HH:mm")} - {format(new Date(slot.end_time), "HH:mm")}
                        </span>
                      </div>
                      {statusBadge(activeAppt.status)}
                    </div>

                    {schoolName && (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <School className="w-3.5 h-3.5 shrink-0" />
                        <span>{schoolName}</span>
                      </div>
                    )}

                    {activeAppt.description && (
                      <p className="text-xs text-muted-foreground bg-slate-50 p-2 rounded border leading-relaxed">
                        {activeAppt.description}
                      </p>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
