import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { CalendarDays, Clock, User, Phone, Info, ChevronDown, ChevronUp, Users } from "lucide-react";
import { format, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { translateError } from "@/lib/errorTranslations";

type Department = Tables<"departments">;
type Timeslot = Tables<"timeslots">;
type Profile = Tables<"profiles">;

export default function BookAppointmentPage() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [departmentTeam, setDepartmentTeam] = useState<Profile[]>([]);
  const [requestedAttendantId, setRequestedAttendantId] = useState<string>("any");
  const [timeslots, setTimeslots] = useState<Timeslot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [description, setDescription] = useState("");
  const [booking, setBooking] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [expandedActivities, setExpandedActivities] = useState<Record<string, boolean>>({});
  const [userActiveAppointments, setUserActiveAppointments] = useState<any[]>([]);
  const [displacementBuffer, setDisplacementBuffer] = useState<string>("15");

  const toggleActivities = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedActivities(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchUserActiveAppointments = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("appointments")
      .select("id, timeslots!inner(id, start_time, end_time, department_id, departments(name))")
      .eq("requester_id", user.id)
      .eq("status", "active");
    setUserActiveAppointments(data || []);
  };

  useEffect(() => {
    fetchUserActiveAppointments();
  }, [user]);

  const getSlotConflictInfo = (ts: { start_time: string; end_time: string }, activeAppts: any[], displacementMins: number) => {
    const tsStart = new Date(ts.start_time).getTime();
    const tsEnd = new Date(ts.end_time).getTime();

    for (const appt of activeAppts) {
      if (!appt.timeslots) continue;
      const appStart = new Date(appt.timeslots.start_time).getTime();
      const appEnd = new Date(appt.timeslots.end_time).getTime();
      const deptName = appt.timeslots.departments?.name || "outro setor";

      // Conflito Direto de Horário (sobreposição)
      if (tsStart < appEnd && tsEnd > appStart) {
        return {
          hasConflict: true,
          isOverlap: true,
          message: `Conflito direto com agendamento das ${format(appStart, "HH:mm")} às ${format(appEnd, "HH:mm")} em ${deptName}.`
        };
      }

      // Intervalo de Deslocamento Insuficiente
      if (displacementMins > 0) {
        if (appStart >= tsEnd) {
          const gapMinutes = (appStart - tsEnd) / 60000;
          if (gapMinutes < displacementMins) {
            return {
              hasConflict: true,
              isDisplacement: true,
              message: `Tempo de deslocamento curto: Apenas ${Math.round(gapMinutes)} min de intervalo antes do atendimento das ${format(appStart, "HH:mm")} em ${deptName} (mínimo necessário: ${displacementMins} min).`
            };
          }
        } else if (tsStart >= appEnd) {
          const gapMinutes = (tsStart - appEnd) / 60000;
          if (gapMinutes < displacementMins) {
            return {
              hasConflict: true,
              isDisplacement: true,
              message: `Tempo de deslocamento curto: Apenas ${Math.round(gapMinutes)} min de intervalo após o atendimento das ${format(appEnd, "HH:mm")} em ${deptName} (mínimo necessário: ${displacementMins} min).`
            };
          }
        }
      }
    }

    return { hasConflict: false };
  };

  useEffect(() => {
    supabase.from("departments").select("*").order("name").then(({ data }) => {
      setDepartments(data || []);
    });
  }, []);

  useEffect(() => {
    if (!selectedDept) {
      setTimeslots([]);
      setDepartmentTeam([]);
      setRequestedAttendantId("any");
      return;
    }

    setLoadingSlots(true);

    // Buscar Horários Disponíveis
    supabase
      .from("timeslots")
      .select("*")
      .eq("department_id", selectedDept)
      .eq("is_available", true)
      .gte("start_time", new Date().toISOString())
      .order("start_time")
      .then(({ data }) => {
        setTimeslots(data || []);
        setSelectedSlot("");
        setLoadingSlots(false);
      });

    // Buscar Equipe do Setor
    supabase
      .from("profiles")
      .select("*")
      .eq("department_id", selectedDept)
      .eq("role", "department")
      .then(({ data }) => {
        setDepartmentTeam(data || []);
      });
  }, [selectedDept]);

  const handleBook = async () => {
    if (!user || !selectedSlot || !description.trim()) {
      toast({ title: "Selecione um horário e adicione uma descrição", variant: "destructive" });
      return;
    }
    setBooking(true);

    // 1. Re-verificação da disponibilidade da vaga no banco
    const { data: slotData } = await supabase
      .from("timeslots")
      .select("id, start_time, end_time, is_available")
      .eq("id", selectedSlot)
      .maybeSingle();

    if (!slotData || !slotData.is_available) {
      toast({
        title: "Vaga Indisponível",
        description: "Esta vaga acabou de ser preenchida por outro usuário. Por favor, escolha outro horário.",
        variant: "destructive",
      });
      setBooking(false);
      if (selectedDept) {
        const { data } = await supabase
          .from("timeslots")
          .select("*")
          .eq("department_id", selectedDept)
          .eq("is_available", true)
          .gte("start_time", new Date().toISOString())
          .order("start_time");
        setTimeslots(data || []);
      }
      return;
    }

    // 2. Buscar agendamentos ativos atualizados do usuário para validação de conflitos e deslocamento
    const { data: activeAppts } = await supabase
      .from("appointments")
      .select("id, timeslots!inner(id, start_time, end_time, department_id, departments(name))")
      .eq("requester_id", user.id)
      .eq("status", "active");

    const activeList = activeAppts || [];
    const dispMins = parseInt(displacementBuffer, 10) || 0;
    const conflictInfo = getSlotConflictInfo(slotData, activeList, dispMins);

    if (conflictInfo.hasConflict) {
      toast({
        title: conflictInfo.isOverlap ? "Choque de Horários" : "Intervalo de Deslocamento Insuficiente",
        description: conflictInfo.message,
        variant: "destructive",
      });
      setBooking(false);
      return;
    }

    const { error } = await supabase.from("appointments").insert({
      timeslot_id: selectedSlot,
      requester_id: user.id,
      description,
      status: "active",
      requested_attendant_id: requestedAttendantId === "any" || !requestedAttendantId ? null : requestedAttendantId,
    });
    if (error) {
      toast({ title: "Falha no agendamento", description: translateError(error), variant: "destructive" });
    } else {
      toast({ title: "Agendamento realizado com sucesso!" });
      setDescription("");
      setSelectedSlot("");
      fetchUserActiveAppointments();
      if (selectedDept) {
        const { data } = await supabase
          .from("timeslots")
          .select("*")
          .eq("department_id", selectedDept)
          .eq("is_available", true)
          .gte("start_time", new Date().toISOString())
          .order("start_time");
        setTimeslots(data || []);
      }
    }
    setBooking(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agendar Atendimento</h1>
        <p className="text-muted-foreground">Selecione um setor e um horário disponível</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Agendamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Setor</Label>
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um setor" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedDept && (
            <>
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold text-primary">Atendente (Opcional)</Label>
                  <Badge variant="secondary">{departmentTeam.length} Funcionario(s)</Badge>
                </div>
                {departmentTeam.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum funcionário cadastrado neste setor.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Card
                      className={`cursor-pointer transition-all ${(!requestedAttendantId || requestedAttendantId === 'any') ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'bg-slate-50/50 hover:border-primary/50'}`}
                      onClick={() => setRequestedAttendantId('any')}
                    >
                      <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2 h-full min-h-[100px]">
                        <div className="bg-primary/10 p-2 rounded-full">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <p className="font-semibold text-sm">Qualquer Atendente</p>
                        <p className="text-xs text-muted-foreground">A critério do Setor</p>
                      </CardContent>
                    </Card>

                    {departmentTeam.map((member) => {
                      const isSelected = requestedAttendantId === member.id;
                      const isExpanded = expandedActivities[member.id];
                      const hasActivities = member.activities && member.activities !== '<p><br></p>' && member.activities !== '<p></p>';

                      return (
                        <Card
                          key={member.id}
                          className={`cursor-pointer transition-all ${isSelected ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'bg-slate-50/50 hover:border-primary/50'}`}
                          onClick={() => setRequestedAttendantId(member.id)}
                        >
                          <CardContent className="p-4 flex flex-col gap-2 relative">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div className="bg-primary/10 p-2 rounded-full mt-1">
                                  <User className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                  <p className="font-semibold text-sm">{member.name || "Sem nome"}</p>
                                  <p className="text-xs text-muted-foreground">{member.email}</p>
                                </div>
                              </div>
                              {hasActivities && (
                                <button
                                  onClick={(e) => toggleActivities(e, member.id)}
                                  className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-500 shrink-0"
                                  title="Ver atividades"
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                              )}
                            </div>

                            {member.phone && (
                              <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                                <Phone className="w-3 h-3" />
                                <span>{member.phone}</span>
                              </div>
                            )}

                            {hasActivities && isExpanded && (
                              <div className="bg-white p-3 text-sm rounded border border-slate-100 mt-2 animate-in fade-in slide-in-from-top-2">
                                <span className="font-semibold text-slate-700 block mb-2">Atividades:</span>
                                <div
                                  className="prose prose-sm max-w-none text-slate-600 prose-p:leading-snug prose-ul:my-1 prose-li:my-0"
                                  dangerouslySetInnerHTML={{ __html: member.activities }}
                                />
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <Label className="text-base font-semibold">Horários Disponíveis</Label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="disp-buffer" className="text-xs text-muted-foreground whitespace-nowrap">
                      Intervalo p/ Deslocamento:
                    </Label>
                    <Select value={displacementBuffer} onValueChange={setDisplacementBuffer}>
                      <SelectTrigger id="disp-buffer" className="h-8 text-xs w-36 bg-white">
                        <SelectValue placeholder="Intervalo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 min (Sem pausa)</SelectItem>
                        <SelectItem value="5">5 min</SelectItem>
                        <SelectItem value="10">10 min</SelectItem>
                        <SelectItem value="15">15 min (Recomendado)</SelectItem>
                        <SelectItem value="20">20 min</SelectItem>
                        <SelectItem value="30">30 min</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {loadingSlots ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : timeslots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum horário disponível para este setor.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {timeslots.map((ts) => {
                      const requires24hAdvance = ts.requires_24h_advance;
                      const hoursDiff = differenceInHours(new Date(ts.start_time), new Date());
                      const isBlockedBy24hRule = requires24hAdvance && hoursDiff < 24;
                      const dispMins = parseInt(displacementBuffer, 10) || 0;
                      const conflictInfo = getSlotConflictInfo(ts, userActiveAppointments, dispMins);

                      const isDisabled = isBlockedBy24hRule || conflictInfo.hasConflict;

                      return (
                        <button
                          key={ts.id}
                          onClick={() => !isDisabled && setSelectedSlot(ts.id)}
                          disabled={isDisabled}
                          className={`relative flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                            isDisabled
                              ? "opacity-60 cursor-not-allowed bg-slate-50 border-slate-200"
                              : selectedSlot === ts.id
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Clock className={`h-4 w-4 shrink-0 ${isDisabled ? 'text-slate-400' : 'text-muted-foreground'}`} />
                            <div>
                              <p className="text-sm font-medium">{format(new Date(ts.start_time), "dd/MM/yyyy", { locale: ptBR })}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(ts.start_time), "HH:mm")} - {format(new Date(ts.end_time), "HH:mm")}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {conflictInfo.hasConflict && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className={`p-1.5 rounded-full cursor-help ${conflictInfo.isOverlap ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                      <Info className="w-4 h-4" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs max-w-xs">{conflictInfo.message}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {isBlockedBy24hRule && !conflictInfo.hasConflict && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="bg-slate-100 p-1.5 rounded-full text-slate-600 cursor-help">
                                      <Info className="w-4 h-4" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Requer agendamento com 24h de antecedência.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {selectedSlot && (
            <>
              <div className="space-y-2 pt-2 border-t mt-4">
                <Label>Atendente Específico (Opcional)</Label>
                <Select value={requestedAttendantId} onValueChange={setRequestedAttendantId}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Qualquer atendente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">A critério do Setor / Qualquer um</SelectItem>
                    {departmentTeam.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name || member.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Opcionalmente, você pode requerer ser atendido por um funcionário em específico.
                </p>
              </div>

              <div className="space-y-2 pt-4">
                <Label>Descrição / Motivo</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva brevemente o motivo da sua visita..."
                  rows={3}
                  className="bg-white"
                />
              </div>
            </>
          )}

          {selectedSlot && description.trim() && (
            <Button onClick={handleBook} disabled={booking} className="w-full sm:w-auto">
              {booking ? "Agendando..." : "Confirmar Agendamento"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
