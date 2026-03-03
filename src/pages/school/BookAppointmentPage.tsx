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
import { CalendarDays, Clock, User, Phone, Info } from "lucide-react";
import { format, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

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

    // Verificação de choque de horários
    const selectedTimeslot = timeslots.find((ts) => ts.id === selectedSlot);
    if (selectedTimeslot) {
      const { data: conflict } = await supabase
        .from("appointments")
        .select("id, timeslots!inner(start_time)")
        .eq("requester_id", user.id)
        .eq("status", "active")
        .eq("timeslots.start_time", selectedTimeslot.start_time)
        .maybeSingle();

      if (conflict) {
        toast({
          title: "Choque de Horários",
          description: "Você já possui um atendimento marcado para este mesmo horário em outro setor.",
          variant: "destructive",
        });
        setBooking(false);
        return;
      }
    }

    const { error } = await supabase.from("appointments").insert({
      timeslot_id: selectedSlot,
      requester_id: user.id,
      description,
      requested_attendant_id: requestedAttendantId !== "any" ? requestedAttendantId : null,
    });
    if (error) {
      toast({ title: "Falha no agendamento", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Agendamento realizado com sucesso!" });
      setDescription("");
      setSelectedSlot("");
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
                  <Label className="text-lg font-semibold text-primary">Equipe do Setor</Label>
                  <Badge variant="secondary">{departmentTeam.length} Funcionario(s)</Badge>
                </div>
                {departmentTeam.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum funcionário cadastrado neste setor.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {departmentTeam.map((member) => (
                      <Card key={member.id} className="bg-slate-50/50 border-slate-200">
                        <CardContent className="p-4 flex flex-col gap-2">
                          <div className="flex items-start gap-3">
                            <div className="bg-primary/10 p-2 rounded-full mt-1">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{member.name || "Sem nome"}</p>
                              <p className="text-xs text-muted-foreground">{member.email}</p>
                            </div>
                          </div>
                          {member.phone && (
                            <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                              <Phone className="w-3 h-3" />
                              <span>{member.phone}</span>
                            </div>
                          )}
                          {member.activities && (
                            <div className="bg-white p-2 text-xs rounded border border-slate-100 mt-1 text-slate-600">
                              <span className="font-medium text-slate-700">Atividades:</span> {member.activities}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Label>Horários Disponíveis</Label>
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

                      return (
                        <button
                          key={ts.id}
                          onClick={() => !isBlockedBy24hRule && setSelectedSlot(ts.id)}
                          disabled={isBlockedBy24hRule}
                          className={`relative flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${isBlockedBy24hRule
                              ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200"
                              : selectedSlot === ts.id
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "hover:border-primary/50"
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <Clock className={`h-4 w-4 shrink-0 ${isBlockedBy24hRule ? 'text-slate-400' : 'text-muted-foreground'}`} />
                            <div>
                              <p className="text-sm font-medium">{format(new Date(ts.start_time), "dd/MM/yyyy", { locale: ptBR })}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(ts.start_time), "HH:mm")} - {format(new Date(ts.end_time), "HH:mm")}
                              </p>
                            </div>
                          </div>

                          {isBlockedBy24hRule && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="bg-amber-100 p-1.5 rounded-full text-amber-600 cursor-help">
                                    <Info className="w-4 h-4" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Requer agendamento com 24h de antecedência.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
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
