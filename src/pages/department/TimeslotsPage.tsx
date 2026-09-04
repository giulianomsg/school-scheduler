import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, Clock, Trash2, CalendarPlus, AlertCircle, CopyPlus, ShieldAlert, CalendarRange } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format, isPast, parseISO, addHours, eachDayOfInterval, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { translateError } from "@/lib/errorTranslations";

const DAYS_OF_WEEK = [
  { id: 1, label: "Seg" },
  { id: 2, label: "Ter" },
  { id: 3, label: "Qua" },
  { id: 4, label: "Qui" },
  { id: 5, label: "Sex" },
  { id: 6, label: "Sáb" },
  { id: 0, label: "Dom" },
];

export default function TimeslotsPage() {
  const { user, profile } = useAuth();
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [timeslots, setTimeslots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [creationMode, setCreationMode] = useState<"single" | "range">("single");
  const [date, setDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [duration, setDuration] = useState("30");
  const [bufferMinutes, setBufferMinutes] = useState("0");
  const [requires24hAdvance, setRequires24hAdvance] = useState(true);

  // Modal de Reagendamento / Alteração de Horário pelo Setor
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [selectedNewSlotId, setSelectedNewSlotId] = useState<string>("");
  const [rescheduleReason, setRescheduleReason] = useState<string>("");
  const [savingReschedule, setSavingReschedule] = useState(false);

  const toggleDay = (dayId: number) => {
    if (selectedDays.includes(dayId)) {
      setSelectedDays(selectedDays.filter((d) => d !== dayId));
    } else {
      setSelectedDays([...selectedDays, dayId]);
    }
  };

  const selectWeekdays = () => setSelectedDays([1, 2, 3, 4, 5]);
  const selectAllDays = () => setSelectedDays([0, 1, 2, 3, 4, 5, 6]);

  const fetchTimeslots = async (currentDeptId: string) => {
    setLoading(true);

    const { data: slots, error } = await supabase
      .from("timeslots")
      .select("*, appointments(*, profiles!appointments_requester_id_fkey(*, unidades_escolares(*)))")
      .eq("department_id", currentDeptId)
      .order("start_time", { ascending: true });

    if (error) {
      toast({ title: "Erro ao buscar horários", description: translateError(error), variant: "destructive" });
    } else {
      setTimeslots(slots || []);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    if (profile) {
      let initDeptId = departmentId;
      if (!initDeptId) {
        if (profile.role === 'department' && profile.department_id) {
          initDeptId = profile.department_id;
        } else if (profile.role === 'coordinator' && profile.coordinatorDepts && profile.coordinatorDepts.length > 0) {
          initDeptId = profile.coordinatorDepts[0].id;
        }
      }
      
      if (initDeptId && initDeptId !== departmentId) {
         setDepartmentId(initDeptId);
      } else if (initDeptId) {
         fetchTimeslots(initDeptId);
      } else {
         setLoading(false);
      }
    }
  }, [profile, departmentId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!departmentId || !startTime || !endTime || !duration) return;

    const durationMins = parseInt(duration, 10);
    const bufferMins = parseInt(bufferMinutes, 10) || 0;
    if (durationMins < 5) {
      toast({ title: "Atenção", description: "A duração mínima do atendimento é de 5 minutos.", variant: "destructive" });
      return;
    }

    let datesToProcess: string[] = [];

    if (creationMode === "single") {
      if (!date) {
        toast({ title: "Atenção", description: "Selecione a data do atendimento.", variant: "destructive" });
        return;
      }
      datesToProcess = [date];
    } else {
      if (!startDate || !endDate) {
        toast({ title: "Atenção", description: "Selecione as datas inicial e final do período.", variant: "destructive" });
        return;
      }
      if (endDate < startDate) {
        toast({ title: "Atenção", description: "A data final deve ser igual ou posterior à data inicial.", variant: "destructive" });
        return;
      }
      if (selectedDays.length === 0) {
        toast({ title: "Atenção", description: "Selecione ao menos um dia da semana.", variant: "destructive" });
        return;
      }

      const startObj = parseISO(startDate);
      const endObj = parseISO(endDate);
      const intervalDays = eachDayOfInterval({ start: startObj, end: endObj });

      datesToProcess = intervalDays
        .filter((dayDate) => selectedDays.includes(getDay(dayDate)))
        .map((dayDate) => format(dayDate, "yyyy-MM-dd"));
    }

    if (datesToProcess.length === 0) {
      toast({ title: "Atenção", description: "Nenhuma data no período corresponde aos dias da semana escolhidos.", variant: "destructive" });
      return;
    }

    const now = new Date();
    const minAdvanceTime = addHours(now, 24);
    const slotsToInsert: any[] = [];
    let skippedPastCount = 0;
    let skippedAdvanceCount = 0;

    for (const targetDateStr of datesToProcess) {
      const startDateTime = new Date(`${targetDateStr}T${startTime}:00`);
      const endDateTime = new Date(`${targetDateStr}T${endTime}:00`);

      if (endDateTime <= startDateTime) {
        toast({ title: "Atenção", description: "O horário de término deve ser após o início.", variant: "destructive" });
        return;
      }

      let current = startDateTime;

      while (current < endDateTime) {
        const next = new Date(current.getTime() + durationMins * 60000);
        if (next > endDateTime) break;

        if (current < now) {
          skippedPastCount++;
          current = new Date(next.getTime() + bufferMins * 60000);
          continue;
        }

        if (requires24hAdvance && current < minAdvanceTime) {
          skippedAdvanceCount++;
          current = new Date(next.getTime() + bufferMins * 60000);
          continue;
        }

        slotsToInsert.push({
          department_id: departmentId,
          start_time: current.toISOString(),
          end_time: next.toISOString(),
          is_available: true,
          requires_24h_advance: requires24hAdvance,
        });

        current = new Date(next.getTime() + bufferMins * 60000);
      }
    }

    // Validação de sobreposição com vagas já existentes no setor
    let skippedOverlapCount = 0;
    const validSlotsToInsert = slotsToInsert.filter((newSlot) => {
      const nStart = new Date(newSlot.start_time).getTime();
      const nEnd = new Date(newSlot.end_time).getTime();

      const overlaps = timeslots.some((existing) => {
        const eStart = new Date(existing.start_time).getTime();
        const eEnd = new Date(existing.end_time).getTime();
        return nStart < eEnd && nEnd > eStart;
      });

      if (overlaps) {
        skippedOverlapCount++;
        return false;
      }
      return true;
    });

    if (validSlotsToInsert.length === 0) {
      if (skippedOverlapCount > 0) {
        toast({
          title: "Atenção - Choque de Horários",
          description: `Todas as ${skippedOverlapCount} vagas geradas entrariam em choque de horário com vagas já existentes neste setor.`,
          variant: "destructive"
        });
      } else if (skippedPastCount > 0 || skippedAdvanceCount > 0) {
        toast({
          title: "Atenção",
          description: "Nenhuma vaga válida foi gerada. As vagas no passado ou com menos de 24h de antecedência foram ignoradas.",
          variant: "destructive"
        });
      } else {
        toast({ title: "Atenção", description: "O período informado é menor que a duração de um atendimento.", variant: "destructive" });
      }
      return;
    }

    try {
      const { error } = await supabase.from("timeslots").insert(validSlotsToInsert);
      if (error) throw error;

      const daysCount = datesToProcess.length;
      const bufferInfo = bufferMins > 0 ? ` com ${bufferMins} min de intervalo para deslocamento` : "";
      const overlapWarning = skippedOverlapCount > 0 ? ` (${skippedOverlapCount} vagas ignoradas por sobreposição)` : "";

      toast({
        title: "Agenda Gerada com Sucesso!",
        description: creationMode === "single"
          ? `Foram disponibilizadas ${validSlotsToInsert.length} vagas de ${durationMins} minutos${bufferInfo}${overlapWarning}.`
          : `Foram disponibilizadas ${validSlotsToInsert.length} vagas de ${durationMins} minutos${bufferInfo} distribuídas em ${daysCount} dia(s)${overlapWarning}.`,
      });

      setStartTime("");
      setEndTime("");
      fetchTimeslots(departmentId);
    } catch (error: any) {
      toast({ title: "Erro", description: translateError(error), variant: "destructive" });
    }
  };

  // Verificação de sobreposição entre vagas do próprio setor
  const getSlotOverlapConflict = (slot: any) => {
    const sStart = new Date(slot.start_time).getTime();
    const sEnd = new Date(slot.end_time).getTime();

    const activeAppts = Array.isArray(slot.appointments)
      ? slot.appointments.filter((a: any) => a && a.status === "active")
      : (slot.appointments && slot.appointments.status === "active" ? [slot.appointments] : []);
    const slotHasActiveAppt = !slot.is_available || activeAppts.length > 0;

    for (const other of timeslots) {
      if (other.id === slot.id) continue;
      const oStart = new Date(other.start_time).getTime();
      const oEnd = new Date(other.end_time).getTime();

      if (sStart < oEnd && sEnd > oStart) {
        const otherLabel = `${format(new Date(oStart), "HH:mm")} - ${format(new Date(oEnd), "HH:mm")}`;
        const otherActiveAppts = Array.isArray(other.appointments)
          ? other.appointments.filter((a: any) => a && a.status === "active")
          : (other.appointments && other.appointments.status === "active" ? [other.appointments] : []);
        const otherHasActiveAppt = !other.is_available || otherActiveAppts.length > 0;

        if (slotHasActiveAppt) {
          // Se esta vaga é reservada (tem agendamento ativo):
          // Só exibe "Choque no Setor" se a vaga que está sobrepondo TAMBÉM tiver agendamento ativo!
          if (otherHasActiveAppt) {
            return {
              hasConflict: true,
              isDoubleBooking: true,
              isOverlappedByBooked: false,
              conflictingSlot: other,
              message: `Choque de Agendamentos: Este agendamento sobrepõe outro agendamento ativo das ${otherLabel}.`
            };
          }
        } else {
          // Se esta vaga é LIVRE (sem agendamento ativo):
          // Exibe "Bloqueada por Agendamento" se a vaga que está sobrepondo possuir agendamento ativo.
          if (otherHasActiveAppt) {
            return {
              hasConflict: true,
              isDoubleBooking: false,
              isOverlappedByBooked: true,
              conflictingSlot: other,
              message: `Vaga livre bloqueada devido ao agendamento ativo das ${otherLabel}.`
            };
          }
        }
      }
    }
    return { hasConflict: false, isDoubleBooking: false, isOverlappedByBooked: false, message: "" };
  };

  const openRescheduleModal = (slot: any) => {
    const appts = Array.isArray(slot.appointments) ? slot.appointments : [slot.appointments];
    const activeAppt = appts.find((a: any) => a && a.status === "active") || appts[0];
    if (!activeAppt) {
      toast({ title: "Atenção", description: "Esta vaga não possui um agendamento ativo.", variant: "destructive" });
      return;
    }

    setEditingAppointment({
      ...activeAppt,
      timeslots: slot,
    });
    setSelectedNewSlotId("");
    setRescheduleReason("");
    setIsRescheduleModalOpen(true);
  };

  const handleConfirmReschedule = async () => {
    if (!editingAppointment || !selectedNewSlotId) {
      toast({ title: "Atenção", description: "Selecione uma nova vaga livre para reagendar.", variant: "destructive" });
      return;
    }

    setSavingReschedule(true);
    try {
      // 1. Liberar vaga antiga
      await supabase
        .from("timeslots")
        .update({ is_available: true })
        .eq("id", editingAppointment.timeslots.id);

      // 2. Ocupar vaga nova
      await supabase
        .from("timeslots")
        .update({ is_available: false })
        .eq("id", selectedNewSlotId);

      // 3. Atualizar appointment
      const { error } = await supabase
        .from("appointments")
        .update({ timeslot_id: selectedNewSlotId })
        .eq("id", editingAppointment.id);

      if (error) throw error;

      // 4. Enviar notificação para a escola
      const newSlot = timeslots.find((s) => s.id === selectedNewSlotId);
      const newTimeStr = newSlot
        ? format(new Date(newSlot.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
        : "";

      const reasonMsg = rescheduleReason.trim()
        ? ` Motivo: ${rescheduleReason}`
        : " (Horário ajustado pelo setor para resolver sobreposição de vagas).";

      await supabase.from("notifications").insert({
        user_id: editingAppointment.requester_id,
        title: `Reagendamento de Atendimento`,
        message: `Seu agendamento foi alterado pelo setor para o novo horário: ${newTimeStr}.${reasonMsg}`,
      });

      toast({ title: "Agendamento Reagendado!", description: "O horário foi alterado e a vaga anterior foi liberada." });
      setIsRescheduleModalOpen(false);
      setEditingAppointment(null);
      if (departmentId) fetchTimeslots(departmentId);
    } catch (err: any) {
      toast({ title: "Erro ao reagendar", description: translateError(err), variant: "destructive" });
    } finally {
      setSavingReschedule(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja apagar este horário?")) return;

    try {
      // Deleta agendamentos cancelados ou históricos órfãos dessa vaga para evitar erro de chave estrangeira
      await supabase.from("appointments").delete().eq("timeslot_id", id).neq("status", "active");

      const { error } = await supabase.from("timeslots").delete().eq("id", id);
      if (error) throw error;

      toast({ title: "Sucesso", description: "Horário apagado." });
      if (departmentId) fetchTimeslots(departmentId);
    } catch (error: any) {
      toast({ title: "Erro ao apagar", description: translateError(error), variant: "destructive" });
    }
  };

  const handleBulkDeleteExpired = async () => {
    if (!window.confirm("Deseja apagar os horários expirados órfãos (que nunca tiveram agendamento)? Esta ação é irreversível.")) return;

    // 💡 CORREÇÃO 2: Só apaga os que estão no passado, livres, e SEM agendamento ativo
    const expiredUnusedIds = timeslots
      .filter(t => {
        const activeAppts = Array.isArray(t.appointments) ? t.appointments.filter((a: any) => a && a.status === "active") : [];
        return isPast(parseISO(t.start_time)) && t.is_available === true && activeAppts.length === 0;
      })
      .map(t => t.id);

    if (expiredUnusedIds.length === 0) {
      toast({ title: "Atenção", description: "Todos os horários expirados possuem histórico no banco de dados e não podem ser apagados por segurança." });
      return;
    }

    try {
      await supabase.from("appointments").delete().in("timeslot_id", expiredUnusedIds).neq("status", "active");
      const { error } = await supabase.from("timeslots").delete().in('id', expiredUnusedIds);
      if (error) throw error;

      toast({ title: "Limpeza concluída", description: `${expiredUnusedIds.length} horários ociosos foram apagados com sucesso.` });
      if (departmentId) fetchTimeslots(departmentId);
    } catch (error: any) {
      toast({ title: "Erro", description: translateError(error), variant: "destructive" });
    }
  };

  const now = new Date();

  const futureSlots = timeslots.filter(t => new Date(t.start_time) >= now);
  const pastSlots = timeslots.filter(t => new Date(t.start_time) < now);

  const groupByDate = (slots: any[]) => {
    return slots.reduce((acc: any, slot) => {
      const dateKey = format(new Date(slot.start_time), "yyyy-MM-dd");
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(slot);
      return acc;
    }, {});
  };

  const futureGrouped = groupByDate(futureSlots);
  const pastGrouped = groupByDate(pastSlots);

  const SlotCard = ({ slot }: { slot: any }) => {
    const activeAppts = Array.isArray(slot.appointments)
      ? slot.appointments.filter((a: any) => a && a.status === "active")
      : (slot.appointments && slot.appointments.status === "active" ? [slot.appointments] : []);
    const activeAppt = activeAppts[0];
    const schoolName = activeAppt?.profiles?.unidades_escolares?.nome_escola || activeAppt?.profiles?.name || activeAppt?.profiles?.email;

    const isFreeSlot = slot.is_available && activeAppts.length === 0;
    const slotConflict = getSlotOverlapConflict(slot);

    return (
      <div className={`p-3 border rounded-md mb-2 flex flex-col justify-between gap-2 transition-all ${
        slotConflict.hasConflict
          ? slotConflict.isOverlappedByBooked
            ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400'
            : 'bg-red-50/60 border-red-300 ring-1 ring-red-400'
          : isFreeSlot
            ? 'bg-white'
            : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-md ${slotConflict.hasConflict ? (slotConflict.isOverlappedByBooked ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700') : 'bg-indigo-50 text-indigo-600'}`}>
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">
                {format(new Date(slot.start_time), "HH:mm")} - {format(new Date(slot.end_time), "HH:mm")}
              </p>
              <div className="flex flex-wrap items-center gap-1 mt-1">
                {isFreeSlot ? (
                  <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-[11px]">
                    Livre
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-700 border-slate-300 bg-slate-100 text-[11px] font-medium">
                    Reservado
                  </Badge>
                )}
                {slot.requires_24h_advance && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[10px]">
                    <ShieldAlert className="w-3 h-3 mr-0.5" />
                    24h
                  </Badge>
                )}
                {slotConflict.hasConflict && (
                  <Badge variant="destructive" className={`${slotConflict.isOverlappedByBooked ? 'bg-amber-600' : 'bg-red-600'} text-white text-[10px]`}>
                    {slotConflict.isOverlappedByBooked ? "⛔ Bloqueada por Agendamento" : "⚠️ Choque no Setor"}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {isFreeSlot && (
            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 shrink-0" onClick={() => handleDelete(slot.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        {!isFreeSlot && activeAppt && (
          <div className="bg-slate-100 p-2 rounded border border-slate-200 text-xs space-y-1 mt-1">
            <p className="font-semibold text-indigo-800 truncate">
              🏫 {schoolName || "Escola Agendada"}
            </p>
            {activeAppt.description && (
              <p className="text-slate-600 truncate">Pauta: {activeAppt.description}</p>
            )}
          </div>
        )}

        {slotConflict.hasConflict && (
          <div className={`p-2 rounded text-[11px] flex items-start gap-1.5 mt-1 ${slotConflict.isOverlappedByBooked ? 'bg-amber-100/70 border border-amber-200 text-amber-900' : 'bg-red-100/70 border border-red-200 text-red-900'}`}>
            <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${slotConflict.isOverlappedByBooked ? 'text-amber-600' : 'text-red-600'}`} />
            <span>{slotConflict.message}</span>
          </div>
        )}

        {!isFreeSlot && activeAppt && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 flex items-center justify-center gap-1.5 mt-1 h-8"
            onClick={() => openRescheduleModal(slot)}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Alterar Horário
          </Button>
        )}
      </div>
    );
  };

  const doubleBookingConflicts = timeslots.filter(s => getSlotOverlapConflict(s).isDoubleBooking);

  return (
    <div className="space-y-6 animate-fade-in pb-10 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gerenciamento de Horários</h1>
          <p className="text-muted-foreground">Crie e disponibilize vagas para as escolas agendarem no seu setor.</p>
        </div>
        {profile?.role === 'coordinator' && profile.coordinatorDepts && profile.coordinatorDepts.length > 0 && (
          <div className="w-full md:w-72 mt-1">
            <Select value={departmentId || ''} onValueChange={setDepartmentId}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione um setor para gerenciar" /></SelectTrigger>
              <SelectContent>
                {profile.coordinatorDepts.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {doubleBookingConflicts.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
            <div>
              <h4 className="font-semibold text-red-900 text-sm">
                Atenção: Existem {doubleBookingConflicts.length} agendamento(s) com choque no setor!
              </h4>
              <p className="text-xs text-red-700">
                Agendamentos ativos sobrepostos foram destacados em vermelho. Utilize a opção "Alterar Horário" nas vagas reservadas para ajustá-los.
              </p>
            </div>
          </div>
        </div>
      )}

      <Card className="border-indigo-100 shadow-sm">
        <CardHeader className="bg-indigo-50/50 pb-4">
          <CardTitle className="flex items-center gap-2 text-indigo-800">
            <CalendarPlus className="w-5 h-5" />
            Adicionar Expediente
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 mb-2 p-1 bg-slate-100 rounded-lg w-fit">
              <button
                type="button"
                onClick={() => setCreationMode("single")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  creationMode === "single"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                Dia Único
              </button>
              <button
                type="button"
                onClick={() => setCreationMode("range")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  creationMode === "range"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                Intervalo de Dias (Range)
              </button>
            </div>

            {creationMode === "single" ? (
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Data do Atendimento</label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required={creationMode === "single"}
                    min={format(now, "yyyy-MM-dd")}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Hora Início (Ex: 08:00)</label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required className="bg-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Hora Fim (Ex: 12:00)</label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required className="bg-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Duração (minutos)</label>
                  <Input type="number" min="5" step="5" value={duration} onChange={(e) => setDuration(e.target.value)} required className="bg-white" placeholder="Ex: 30" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Intervalo p/ Deslocamento</label>
                  <Select value={bufferMinutes} onValueChange={setBufferMinutes}>
                    <SelectTrigger className="bg-white">
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
            ) : (
              <div className="space-y-4 border border-indigo-100 p-4 rounded-lg bg-indigo-50/30">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Data Inicial</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required={creationMode === "range"}
                      min={format(now, "yyyy-MM-dd")}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Data Final</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required={creationMode === "range"}
                      min={startDate || format(now, "yyyy-MM-dd")}
                      className="bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-sm font-medium text-slate-700">Dias da Semana Atendidos</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={selectWeekdays}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                      >
                        Dias Úteis (Seg-Sex)
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={selectAllDays}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                      >
                        Todos os Dias
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {DAYS_OF_WEEK.map((d) => {
                      const isSelected = selectedDays.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => toggleDay(d.id)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2 border-t border-indigo-100/60">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Hora Início (Ex: 08:00)</label>
                    <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required className="bg-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Hora Fim (Ex: 12:00)</label>
                    <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required className="bg-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Duração (minutos)</label>
                    <Input type="number" min="5" step="5" value={duration} onChange={(e) => setDuration(e.target.value)} required className="bg-white" placeholder="Ex: 30" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Intervalo p/ Deslocamento</label>
                    <Select value={bufferMinutes} onValueChange={setBufferMinutes}>
                      <SelectTrigger className="bg-white">
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
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <div className="flex items-center space-x-2 bg-white/50 p-3 rounded border border-indigo-50 w-max">
                <Switch
                  id="requires-24h"
                  checked={requires24hAdvance}
                  onCheckedChange={setRequires24hAdvance}
                />
                <Label htmlFor="requires-24h" className="text-sm text-slate-700 cursor-pointer">
                  Exigir antecedência mínima de 24 horas para escolas agendarem esta vaga
                </Label>
              </div>

              <Button type="submit" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 flex items-center gap-2">
                <CopyPlus className="w-4 h-4" />
                Gerar Vagas Automaticamente
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Carregando horários...</p>
      ) : (
        <Tabs defaultValue="future" className="w-full mt-8">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="future" className="text-md">
              Próximos Horários
              <Badge variant="secondary" className="ml-2 bg-indigo-100 text-indigo-700">{futureSlots.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="past" className="text-md">
              Histórico Expirado
              {pastSlots.length > 0 && <Badge variant="secondary" className="ml-2 bg-slate-200 text-slate-700">{pastSlots.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="future" className="space-y-6">
            {Object.keys(futureGrouped).length === 0 ? (
              <Card>
                <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                  <CalendarDays className="w-12 h-12 text-slate-200 mb-4" />
                  <p className="text-lg font-medium text-slate-600">Nenhum horário disponível.</p>
                  <p className="text-sm text-slate-500">Crie novas vagas acima para que as escolas possam agendar.</p>
                </CardContent>
              </Card>
            ) : (
              Object.keys(futureGrouped).sort().map(dateKey => (
                <div key={dateKey} className="mb-6">
                  <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 border-b pb-2">
                    <CalendarDays className="w-5 h-5 text-indigo-500" />
                    {format(parseISO(dateKey), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {futureGrouped[dateKey].map((slot: any) => (
                      <SlotCard key={slot.id} slot={slot} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-6">
            {pastSlots.length > 0 && (
              <div className="flex justify-between items-center bg-amber-50 p-4 rounded-lg border border-amber-200">
                <div className="flex gap-3 items-center">
                  <AlertCircle className="w-6 h-6 text-amber-500" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Cemitério de Horários</p>
                    <p className="text-xs text-amber-700">Aqui estão os horários que já passaram. Mantenha a sua base limpa.</p>
                  </div>
                </div>
                <Button variant="destructive" size="sm" onClick={handleBulkDeleteExpired}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Limpar Ociosos
                </Button>
              </div>
            )}

            {Object.keys(pastGrouped).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum horário expirado.</p>
            ) : (
              Object.keys(pastGrouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).map(dateKey => (
                <div key={dateKey} className="mb-6 opacity-75">
                  <h3 className="font-bold text-slate-500 mb-3 flex items-center gap-2 border-b pb-2">
                    <CalendarDays className="w-4 h-4" />
                    {format(parseISO(dateKey), "dd/MM/yyyy", { locale: ptBR })}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {pastGrouped[dateKey].map((slot: any) => (
                      <SlotCard key={slot.id} slot={slot} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={isRescheduleModalOpen} onOpenChange={setIsRescheduleModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-700">
              <CalendarDays className="w-5 h-5" />
              Alterar Horário do Agendamento
            </DialogTitle>
            <DialogDescription>
              Reagende o atendimento da escola para um novo horário livre do setor sem sobreposição.
            </DialogDescription>
          </DialogHeader>

          {editingAppointment && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 p-3 rounded-md border text-sm space-y-1">
                <p className="font-semibold text-slate-800">
                  Escola: {editingAppointment.profiles?.unidades_escolares?.nome_escola || editingAppointment.profiles?.name || "Não informada"}
                </p>
                <p className="text-xs text-slate-600">
                  Horário Atual: {format(new Date(editingAppointment.timeslots.start_time), "dd/MM/yyyy 'às' HH:mm")}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Selecione uma Nova Vaga Disponível</label>
                {timeslots.filter(s => s.is_available && new Date(s.start_time) >= new Date()).length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded border border-amber-200">
                    Nenhum outro horário livre disponível neste setor. Crie uma nova vaga livre acima primeiro.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2 bg-white">
                    {timeslots
                      .filter(s => s.is_available && new Date(s.start_time) >= new Date())
                      .map((slot) => {
                        const isSelected = selectedNewSlotId === slot.id;
                        const conflict = getSlotOverlapConflict(slot);

                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => !conflict.hasConflict && setSelectedNewSlotId(slot.id)}
                            disabled={conflict.hasConflict}
                            className={`w-full text-left p-2.5 rounded border text-xs flex items-center justify-between transition-all ${
                              conflict.hasConflict
                                ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200"
                                : isSelected
                                  ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600 font-semibold"
                                  : "hover:border-indigo-300"
                            }`}
                          >
                            <div>
                              <p className="font-medium text-slate-800">
                                {format(new Date(slot.start_time), "dd/MM/yyyy", { locale: ptBR })}
                              </p>
                              <p className="text-slate-500">
                                {format(new Date(slot.start_time), "HH:mm")} - {format(new Date(slot.end_time), "HH:mm")}
                              </p>
                            </div>
                            {conflict.hasConflict && (
                              <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">
                                Sobrepõe outra vaga
                              </span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Motivo do Reagendamento (Enviado para a escola)</label>
                <Textarea
                  placeholder="Ex: Ajuste para resolver sobreposição de horários no setor..."
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  rows={3}
                  className="bg-white"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRescheduleModalOpen(false)} disabled={savingReschedule}>
              Cancelar
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleConfirmReschedule}
              disabled={savingReschedule || !selectedNewSlotId}
            >
              {savingReschedule ? "Salvar Reagendamento..." : "Confirmar e Notificar Escola"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}