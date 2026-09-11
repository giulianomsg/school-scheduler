import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CalendarDays,
  Clock,
  Trash2,
  CalendarPlus,
  AlertCircle,
  CopyPlus,
  ShieldAlert,
  CalendarRange,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  LayoutGrid,
  TableProperties,
  RotateCcw,
  CheckCircle2,
  Building,
  School,
  X,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format, isPast, parseISO, addHours, eachDayOfInterval, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  // Form creation states
  const [isCreateCardOpen, setIsCreateCardOpen] = useState(false);
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
  const [creatingSlots, setCreatingSlots] = useState(false);

  // Modal de Reagendamento / Alteração de Horário pelo Setor
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [selectedNewSlotId, setSelectedNewSlotId] = useState<string>("");
  const [rescheduleReason, setRescheduleReason] = useState<string>("");
  const [savingReschedule, setSavingReschedule] = useState(false);

  // Dynamic Table states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "free" | "booked" | "conflict">("all");
  const [dateFilter, setDateFilter] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [periodTab, setPeriodTab] = useState<"future" | "past">("future");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>({
    key: "start_time",
    direction: "asc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Selection & Bulk deletion
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);

  // AlertDialogs
  const [isSingleDeleteOpen, setIsSingleDeleteOpen] = useState(false);
  const [deleteSlotTarget, setDeleteSlotTarget] = useState<any | null>(null);
  const [singleDeleteLoading, setSingleDeleteLoading] = useState(false);

  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  const [isCleanExpiredOpen, setIsCleanExpiredOpen] = useState(false);
  const [cleanExpiredLoading, setCleanExpiredLoading] = useState(false);

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
        if (profile.role === "department" && profile.department_id) {
          initDeptId = profile.department_id;
        } else if (profile.role === "coordinator" && profile.coordinatorDepts && profile.coordinatorDepts.length > 0) {
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

  // Reset pagination and selection on filter change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedSlotIds([]);
  }, [searchTerm, statusFilter, dateFilter, sortConfig, periodTab]);

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
      toast({
        title: "Atenção",
        description: "Nenhuma data no período corresponde aos dias da semana escolhidos.",
        variant: "destructive",
      });
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
          description: `Todas as ${skippedOverlapCount} vagas geradas entrariam em choque com vagas já existentes neste setor.`,
          variant: "destructive",
        });
      } else if (skippedPastCount > 0 || skippedAdvanceCount > 0) {
        toast({
          title: "Atenção",
          description: "Nenhuma vaga válida foi gerada. Vagas no passado ou com menos de 24h foram ignoradas.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Atenção", description: "O período informado é menor que a duração de um atendimento.", variant: "destructive" });
      }
      return;
    }

    setCreatingSlots(true);
    try {
      const { error } = await supabase.from("timeslots").insert(validSlotsToInsert);
      if (error) throw error;

      const daysCount = datesToProcess.length;
      const bufferInfo = bufferMins > 0 ? ` com ${bufferMins} min de intervalo para deslocamento` : "";
      const overlapWarning = skippedOverlapCount > 0 ? ` (${skippedOverlapCount} vagas ignoradas por sobreposição)` : "";

      toast({
        title: "Agenda Gerada com Sucesso!",
        description:
          creationMode === "single"
            ? `Foram disponibilizadas ${validSlotsToInsert.length} vagas de ${durationMins} minutos${bufferInfo}${overlapWarning}.`
            : `Foram disponibilizadas ${validSlotsToInsert.length} vagas de ${durationMins} minutos${bufferInfo} distribuídas em ${daysCount} dia(s)${overlapWarning}.`,
      });

      setStartTime("");
      setEndTime("");
      fetchTimeslots(departmentId);
    } catch (error: any) {
      toast({ title: "Erro", description: translateError(error), variant: "destructive" });
    } finally {
      setCreatingSlots(false);
    }
  };

  // Verificação de sobreposição entre vagas do próprio setor
  const getSlotOverlapConflict = (slot: any) => {
    const sStart = new Date(slot.start_time).getTime();
    const sEnd = new Date(slot.end_time).getTime();

    const activeAppts = Array.isArray(slot.appointments)
      ? slot.appointments.filter((a: any) => a && a.status === "active")
      : slot.appointments && slot.appointments.status === "active"
      ? [slot.appointments]
      : [];
    const slotHasActiveAppt = !slot.is_available || activeAppts.length > 0;

    for (const other of timeslots) {
      if (other.id === slot.id) continue;
      const oStart = new Date(other.start_time).getTime();
      const oEnd = new Date(other.end_time).getTime();

      if (sStart < oEnd && sEnd > oStart) {
        const otherLabel = `${format(new Date(oStart), "HH:mm")} - ${format(new Date(oEnd), "HH:mm")}`;
        const otherActiveAppts = Array.isArray(other.appointments)
          ? other.appointments.filter((a: any) => a && a.status === "active")
          : other.appointments && other.appointments.status === "active"
          ? [other.appointments]
          : [];
        const otherHasActiveAppt = !other.is_available || otherActiveAppts.length > 0;

        if (slotHasActiveAppt) {
          if (otherHasActiveAppt) {
            return {
              hasConflict: true,
              isDoubleBooking: true,
              isOverlappedByBooked: false,
              conflictingSlot: other,
              message: `Choque de Agendamentos: Este agendamento sobrepõe outro agendamento ativo das ${otherLabel}.`,
            };
          }
        } else {
          if (otherHasActiveAppt) {
            return {
              hasConflict: true,
              isDoubleBooking: false,
              isOverlappedByBooked: true,
              conflictingSlot: other,
              message: `Vaga livre bloqueada devido ao agendamento ativo das ${otherLabel}.`,
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
      await supabase.from("timeslots").update({ is_available: true }).eq("id", editingAppointment.timeslots.id);

      // 2. Ocupar vaga nova
      await supabase.from("timeslots").update({ is_available: false }).eq("id", selectedNewSlotId);

      // 3. Atualizar appointment
      const { error } = await supabase
        .from("appointments")
        .update({ timeslot_id: selectedNewSlotId })
        .eq("id", editingAppointment.id);

      if (error) throw error;

      // 4. Enviar notificação para a escola
      const newSlot = timeslots.find((s) => s.id === selectedNewSlotId);
      const newTimeStr = newSlot ? format(new Date(newSlot.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "";

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

  // --- Deletions with AlertDialogs ---
  const openSingleDeleteConfirm = (slot: any) => {
    setDeleteSlotTarget(slot);
    setIsSingleDeleteOpen(true);
  };

  const confirmSingleDelete = async () => {
    if (!deleteSlotTarget) return;
    setSingleDeleteLoading(true);
    try {
      await supabase.from("appointments").delete().eq("timeslot_id", deleteSlotTarget.id);
      const { error: rpcError } = await supabase.rpc("delete_timeslot_cascade", { p_timeslot_id: deleteSlotTarget.id });

      if (rpcError) {
        const { error: deleteError } = await supabase.from("timeslots").delete().eq("id", deleteSlotTarget.id);
        if (deleteError) throw deleteError;
      }

      toast({ title: "Sucesso", description: "Horário apagado com sucesso." });
      setIsSingleDeleteOpen(false);
      setDeleteSlotTarget(null);
      if (departmentId) fetchTimeslots(departmentId);
    } catch (error: any) {
      toast({ title: "Erro ao apagar", description: translateError(error), variant: "destructive" });
    } finally {
      setSingleDeleteLoading(false);
    }
  };

  const openBulkDeleteConfirm = () => {
    if (selectedSlotIds.length === 0) return;
    setIsBulkDeleteOpen(true);
  };

  const confirmBulkDeleteSelected = async () => {
    if (selectedSlotIds.length === 0) return;
    setBulkDeleteLoading(true);
    try {
      await supabase.from("appointments").delete().in("timeslot_id", selectedSlotIds);
      const { error: rpcError } = await supabase.rpc("delete_timeslots_bulk_cascade", { p_timeslot_ids: selectedSlotIds });
      if (rpcError) {
        const { error: deleteError } = await supabase.from("timeslots").delete().in("id", selectedSlotIds);
        if (deleteError) throw deleteError;
      }

      toast({ title: "Sucesso", description: `${selectedSlotIds.length} horários foram apagados.` });
      setSelectedSlotIds([]);
      setIsBulkDeleteOpen(false);
      if (departmentId) fetchTimeslots(departmentId);
    } catch (error: any) {
      toast({ title: "Erro ao apagar vagas selecionadas", description: translateError(error), variant: "destructive" });
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const openCleanExpiredConfirm = () => {
    setIsCleanExpiredOpen(true);
  };

  const confirmCleanExpired = async () => {
    const expiredUnusedIds = timeslots
      .filter((t) => {
        const activeAppts = Array.isArray(t.appointments) ? t.appointments.filter((a: any) => a && a.status === "active") : [];
        return isPast(parseISO(t.start_time)) && t.is_available === true && activeAppts.length === 0;
      })
      .map((t) => t.id);

    if (expiredUnusedIds.length === 0) {
      toast({ title: "Atenção", description: "Nenhum horário livre expirado para apagar." });
      setIsCleanExpiredOpen(false);
      return;
    }

    setCleanExpiredLoading(true);
    try {
      await supabase.from("appointments").delete().in("timeslot_id", expiredUnusedIds);
      const { error: rpcError } = await supabase.rpc("delete_timeslots_bulk_cascade", { p_timeslot_ids: expiredUnusedIds });
      if (rpcError) {
        const { error: deleteError } = await supabase.from("timeslots").delete().in("id", expiredUnusedIds);
        if (deleteError) throw deleteError;
      }

      toast({ title: "Limpeza concluída", description: `${expiredUnusedIds.length} horários ociosos foram apagados com sucesso.` });
      setIsCleanExpiredOpen(false);
      if (departmentId) fetchTimeslots(departmentId);
    } catch (error: any) {
      toast({ title: "Erro na limpeza", description: translateError(error), variant: "destructive" });
    } finally {
      setCleanExpiredLoading(false);
    }
  };

  // --- Filtering and Sorting Logic ---
  const now = new Date();
  const futureSlots = timeslots.filter((t) => new Date(t.start_time) >= now);
  const pastSlots = timeslots.filter((t) => new Date(t.start_time) < now);

  // Active dataset based on selected period tab
  const currentSlots = periodTab === "future" ? futureSlots : pastSlots;

  // KPI calculations based on current active tab dataset
  const totalSlotsCount = currentSlots.length;
  const freeSlotsCount = currentSlots.filter((s) => {
    const activeAppts = Array.isArray(s.appointments) ? s.appointments.filter((a: any) => a && a.status === "active") : s.appointments?.status === "active" ? [s.appointments] : [];
    return s.is_available && activeAppts.length === 0;
  }).length;
  const bookedSlotsCount = currentSlots.filter((s) => {
    const activeAppts = Array.isArray(s.appointments) ? s.appointments.filter((a: any) => a && a.status === "active") : s.appointments?.status === "active" ? [s.appointments] : [];
    return !s.is_available || activeAppts.length > 0;
  }).length;
  const conflictSlotsCount = currentSlots.filter((s) => getSlotOverlapConflict(s).hasConflict).length;
  const doubleBookingConflicts = timeslots.filter((s) => getSlotOverlapConflict(s).isDoubleBooking);

  const filteredSlots = currentSlots.filter((slot) => {
    const activeAppts = Array.isArray(slot.appointments)
      ? slot.appointments.filter((a: any) => a && a.status === "active")
      : slot.appointments && slot.appointments.status === "active"
      ? [slot.appointments]
      : [];
    const activeAppt = activeAppts[0];
    const isFree = slot.is_available && activeAppts.length === 0;
    const conflict = getSlotOverlapConflict(slot);

    // Status Filter
    if (statusFilter === "free" && !isFree) return false;
    if (statusFilter === "booked" && isFree) return false;
    if (statusFilter === "conflict" && !conflict.hasConflict) return false;

    // Specific Date Filter
    if (dateFilter) {
      const slotDateStr = format(new Date(slot.start_time), "yyyy-MM-dd");
      if (slotDateStr !== dateFilter) return false;
    }

    // Search Term Filter
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();

    const schoolName = (activeAppt?.profiles?.unidades_escolares?.nome_escola || "").toLowerCase();
    const requesterName = (activeAppt?.profiles?.name || "").toLowerCase();
    const requesterEmail = (activeAppt?.profiles?.email || "").toLowerCase();
    const description = (activeAppt?.description || "").toLowerCase();

    const slotDateObj = new Date(slot.start_time);
    const formattedDate = format(slotDateObj, "dd/MM/yyyy", { locale: ptBR }).toLowerCase();
    const formattedDayOfWeek = format(slotDateObj, "EEEE", { locale: ptBR }).toLowerCase();
    const formattedTime = `${format(new Date(slot.start_time), "HH:mm")} - ${format(new Date(slot.end_time), "HH:mm")}`.toLowerCase();
    const statusLabel = isFree ? "livre disponível" : "reservado ocupado agendado";
    const conflictLabel = conflict.hasConflict ? "choque conflito sobreposição bloqueada" : "";

    return (
      formattedDate.includes(term) ||
      formattedDayOfWeek.includes(term) ||
      formattedTime.includes(term) ||
      schoolName.includes(term) ||
      requesterName.includes(term) ||
      requesterEmail.includes(term) ||
      description.includes(term) ||
      statusLabel.includes(term) ||
      conflictLabel.includes(term)
    );
  });

  const sortedSlots = [...filteredSlots].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;

    let aVal: any = "";
    let bVal: any = "";

    if (key === "start_time") {
      aVal = new Date(a.start_time).getTime();
      bVal = new Date(b.start_time).getTime();
    } else if (key === "time") {
      aVal = format(new Date(a.start_time), "HH:mm");
      bVal = format(new Date(b.start_time), "HH:mm");
    } else if (key === "status") {
      const aAppts = Array.isArray(a.appointments) ? a.appointments.filter((x: any) => x && x.status === "active") : a.appointments?.status === "active" ? [a.appointments] : [];
      const bAppts = Array.isArray(b.appointments) ? b.appointments.filter((x: any) => x && x.status === "active") : b.appointments?.status === "active" ? [b.appointments] : [];
      aVal = a.is_available && aAppts.length === 0 ? "0_livre" : "1_reservado";
      bVal = b.is_available && bAppts.length === 0 ? "0_livre" : "1_reservado";
    } else if (key === "school") {
      const aAppts = Array.isArray(a.appointments) ? a.appointments.filter((x: any) => x && x.status === "active") : a.appointments?.status === "active" ? [a.appointments] : [];
      const bAppts = Array.isArray(b.appointments) ? b.appointments.filter((x: any) => x && x.status === "active") : b.appointments?.status === "active" ? [b.appointments] : [];
      aVal = aAppts[0]?.profiles?.unidades_escolares?.nome_escola || aAppts[0]?.profiles?.name || "";
      bVal = bAppts[0]?.profiles?.unidades_escolares?.nome_escola || bAppts[0]?.profiles?.name || "";
    }

    if (typeof aVal === "string" && typeof bVal === "string") {
      const cmp = aVal.localeCompare(bVal);
      return direction === "asc" ? cmp : -cmp;
    }

    if (aVal < bVal) return direction === "asc" ? -1 : 1;
    if (aVal > bVal) return direction === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 text-muted-foreground/50 inline" />;
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="ml-1.5 h-3.5 w-3.5 inline text-primary" />
    ) : (
      <ArrowDown className="ml-1.5 h-3.5 w-3.5 inline text-primary" />
    );
  };

  // Pagination calculation
  const totalPages = Math.ceil(sortedSlots.length / itemsPerPage);
  const paginatedSlots = sortedSlots.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Bulk selection on page (only free slots can be selected)
  const selectableSlotsOnPage = paginatedSlots.filter((slot) => {
    const activeAppts = Array.isArray(slot.appointments)
      ? slot.appointments.filter((a: any) => a && a.status === "active")
      : slot.appointments && slot.appointments.status === "active"
      ? [slot.appointments]
      : [];
    return slot.is_available && activeAppts.length === 0;
  });

  const isAllSelectableSelected =
    selectableSlotsOnPage.length > 0 && selectableSlotsOnPage.every((s) => selectedSlotIds.includes(s.id));

  const toggleSelectAll = () => {
    if (isAllSelectableSelected) {
      const pageIds = selectableSlotsOnPage.map((s) => s.id);
      setSelectedSlotIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      const pageIds = selectableSlotsOnPage.map((s) => s.id);
      setSelectedSlotIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectSlot = (slotId: string) => {
    setSelectedSlotIds((prev) => (prev.includes(slotId) ? prev.filter((id) => id !== slotId) : [...prev, slotId]));
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setDateFilter("");
  };

  const hasActiveFilters = Boolean(searchTerm || statusFilter !== "all" || dateFilter);

  // Grouping for Cards view
  const groupByDate = (slots: any[]) => {
    return slots.reduce((acc: any, slot) => {
      const dateKey = format(new Date(slot.start_time), "yyyy-MM-dd");
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(slot);
      return acc;
    }, {});
  };

  const groupedCards = groupByDate(sortedSlots);

  // Card subcomponent
  const SlotCard = ({ slot }: { slot: any }) => {
    const activeAppts = Array.isArray(slot.appointments)
      ? slot.appointments.filter((a: any) => a && a.status === "active")
      : slot.appointments && slot.appointments.status === "active"
      ? [slot.appointments]
      : [];
    const activeAppt = activeAppts[0];
    const schoolName = activeAppt?.profiles?.unidades_escolares?.nome_escola || activeAppt?.profiles?.name || activeAppt?.profiles?.email;

    const isFreeSlot = slot.is_available && activeAppts.length === 0;
    const slotConflict = getSlotOverlapConflict(slot);

    return (
      <div
        className={`p-3 border rounded-md mb-2 flex flex-col justify-between gap-2 transition-all shadow-sm ${
          slotConflict.hasConflict
            ? slotConflict.isOverlappedByBooked
              ? "bg-amber-50/70 border-amber-300 ring-1 ring-amber-400"
              : "bg-red-50/60 border-red-300 ring-1 ring-red-400"
            : isFreeSlot
            ? "bg-white hover:border-indigo-200"
            : "bg-slate-50 border-slate-200"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-md ${
                slotConflict.hasConflict
                  ? slotConflict.isOverlappedByBooked
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700"
                  : "bg-indigo-50 text-indigo-600"
              }`}
            >
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">
                {format(new Date(slot.start_time), "HH:mm")} - {format(new Date(slot.end_time), "HH:mm")}
              </p>
              <div className="flex flex-wrap items-center gap-1 mt-1">
                {isFreeSlot ? (
                  <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 text-[11px] font-medium">
                    Livre
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-indigo-800 border-indigo-200 bg-indigo-50 text-[11px] font-medium">
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
                  <Badge
                    variant="destructive"
                    className={`${slotConflict.isOverlappedByBooked ? "bg-amber-600" : "bg-red-600"} text-white text-[10px]`}
                  >
                    {slotConflict.isOverlappedByBooked ? "⛔ Bloqueada por Agendamento" : "⚠️ Choque no Setor"}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {isFreeSlot && (
            <Button
              variant="ghost"
              size="icon"
              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 shrink-0"
              onClick={() => openSingleDeleteConfirm(slot)}
              title="Apagar vaga livre"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        {!isFreeSlot && activeAppt && (
          <div className="bg-slate-100 p-2.5 rounded border border-slate-200 text-xs space-y-1 mt-1">
            <p className="font-semibold text-indigo-900 truncate flex items-center gap-1.5">
              <School className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              {schoolName || "Escola Agendada"}
            </p>
            {activeAppt.profiles?.name && (
              <p className="text-slate-600 truncate text-[11px]">Solicitante: {activeAppt.profiles.name}</p>
            )}
            {activeAppt.description && (
              <p className="text-slate-600 truncate text-[11px]">Pauta: {activeAppt.description}</p>
            )}
          </div>
        )}

        {slotConflict.hasConflict && (
          <div
            className={`p-2 rounded text-[11px] flex items-start gap-1.5 mt-1 ${
              slotConflict.isOverlappedByBooked
                ? "bg-amber-100/70 border border-amber-200 text-amber-900"
                : "bg-red-100/70 border border-red-200 text-red-900"
            }`}
          >
            <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${slotConflict.isOverlappedByBooked ? "text-amber-600" : "text-red-600"}`} />
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

  return (
    <div className="space-y-6 animate-fade-in pb-10 max-w-7xl mx-auto">
      {/* Header and Department Switcher */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gerenciamento de Horários</h1>
          <p className="text-muted-foreground">Crie, filtre e gerencie as vagas e expedientes de atendimento do seu setor.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {profile?.role === "coordinator" && profile.coordinatorDepts && profile.coordinatorDepts.length > 0 && (
            <div className="w-full md:w-72">
              <Select value={departmentId || ""} onValueChange={setDepartmentId}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Selecione um setor para gerenciar" />
                </SelectTrigger>
                <SelectContent>
                  {profile.coordinatorDepts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button
            onClick={() => setIsCreateCardOpen(!isCreateCardOpen)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
          >
            {isCreateCardOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {isCreateCardOpen ? "Fechar Criação de Vagas" : "Adicionar Expediente"}
          </Button>
        </div>
      </div>

      {/* Double Booking Warning Banner */}
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

      {/* Collapsible Card: Adicionar Expediente */}
      {isCreateCardOpen && (
        <Card className="border-indigo-100 shadow-md animate-in slide-in-from-top duration-300">
          <CardHeader className="bg-indigo-50/50 pb-4">
            <CardTitle className="flex items-center justify-between text-indigo-900 text-lg">
              <div className="flex items-center gap-2">
                <CalendarPlus className="w-5 h-5 text-indigo-600" />
                Criar e Disponibilizar Novas Vagas
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCreateCardOpen(false)}
                className="h-8 text-xs text-muted-foreground"
              >
                Ocultar
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 mb-2 p-1 bg-slate-100 rounded-lg w-fit">
                <button
                  type="button"
                  onClick={() => setCreationMode("single")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    creationMode === "single" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  Dia Único
                </button>
                <button
                  type="button"
                  onClick={() => setCreationMode("range")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    creationMode === "range" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
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
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Hora Fim (Ex: 12:00)</label>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Duração (minutos)</label>
                    <Input
                      type="number"
                      min="5"
                      step="5"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      required
                      className="bg-white"
                      placeholder="Ex: 30"
                    />
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
                      <Input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        required
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Hora Fim (Ex: 12:00)</label>
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        required
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Duração (minutos)</label>
                      <Input
                        type="number"
                        min="5"
                        step="5"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        required
                        className="bg-white"
                        placeholder="Ex: 30"
                      />
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
                <div className="flex items-center space-x-2 bg-white/60 p-3 rounded border border-indigo-50 w-max">
                  <Switch
                    id="requires-24h"
                    checked={requires24hAdvance}
                    onCheckedChange={setRequires24hAdvance}
                  />
                  <Label htmlFor="requires-24h" className="text-sm text-slate-700 cursor-pointer">
                    Exigir antecedência mínima de 24 horas para escolas agendarem esta vaga
                  </Label>
                </div>

                <Button
                  type="submit"
                  disabled={creatingSlots}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 flex items-center gap-2"
                >
                  <CopyPlus className="w-4 h-4" />
                  {creatingSlots ? "Gerando Horários..." : "Gerar Vagas Automaticamente"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Period Tabs: Próximos Horários vs Histórico Expirado */}
      <Tabs value={periodTab} onValueChange={(val) => setPeriodTab(val as any)} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <TabsList className="grid w-full sm:w-80 grid-cols-2">
            <TabsTrigger value="future" className="text-sm flex items-center gap-2">
              Próximos Horários
              <Badge variant="secondary" className="ml-1 bg-indigo-100 text-indigo-700 text-xs">
                {futureSlots.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="past" className="text-sm flex items-center gap-2">
              Histórico Expirado
              {pastSlots.length > 0 && (
                <Badge variant="secondary" className="ml-1 bg-slate-200 text-slate-700 text-xs">
                  {pastSlots.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* View Mode Switcher (Tabela vs Cards) */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {periodTab === "past" && pastSlots.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={openCleanExpiredConfirm}
                className="text-xs text-amber-700 border-amber-300 hover:bg-amber-50 h-8 flex items-center gap-1.5 mr-2"
              >
                <Trash2 className="w-3.5 h-3.5 text-amber-600" />
                Limpar Ociosos
              </Button>
            )}

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border">
              <Button
                type="button"
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className={`h-7 text-xs flex items-center gap-1.5 ${
                  viewMode === "table" ? "bg-white text-slate-900 shadow-sm" : "text-muted-foreground"
                }`}
              >
                <TableProperties className="h-3.5 w-3.5" />
                Tabela Dinâmica
              </Button>
              <Button
                type="button"
                variant={viewMode === "cards" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("cards")}
                className={`h-7 text-xs flex items-center gap-1.5 ${
                  viewMode === "cards" ? "bg-white text-slate-900 shadow-sm" : "text-muted-foreground"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Visão em Blocos
              </Button>
            </div>
          </div>
        </div>

        {/* KPI Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card
            className={`cursor-pointer transition-all hover:shadow-md border-l-4 border-l-indigo-500 ${
              statusFilter === "all" ? "ring-2 ring-indigo-500 bg-indigo-50/40" : ""
            }`}
            onClick={() => setStatusFilter("all")}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Total de Vagas
                </span>
                <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
                  <CalendarDays className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div className="text-3xl font-bold text-foreground">{totalSlotsCount}</div>
                <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                  {periodTab === "future" ? "Futuras" : "Expiradas"}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Clique para listar todas as vagas</p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md border-l-4 border-l-emerald-500 ${
              statusFilter === "free" ? "ring-2 ring-emerald-500 bg-emerald-50/40" : ""
            }`}
            onClick={() => setStatusFilter(statusFilter === "free" ? "all" : "free")}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Vagas Livres
                </span>
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div className="text-3xl font-bold text-emerald-600">{freeSlotsCount}</div>
                <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                  {totalSlotsCount > 0 ? Math.round((freeSlotsCount / totalSlotsCount) * 100) : 0}% livres
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Disponíveis para agendamento escolar</p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md border-l-4 border-l-blue-500 ${
              statusFilter === "booked" ? "ring-2 ring-blue-500 bg-blue-50/40" : ""
            }`}
            onClick={() => setStatusFilter(statusFilter === "booked" ? "all" : "booked")}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Vagas Reservadas
                </span>
                <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                  <Clock className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div className="text-3xl font-bold text-blue-600">{bookedSlotsCount}</div>
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                  {totalSlotsCount > 0 ? Math.round((bookedSlotsCount / totalSlotsCount) * 100) : 0}% ocupadas
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Com agendamento ativo confirmado</p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md border-l-4 ${
              conflictSlotsCount > 0 ? "border-l-rose-500" : "border-l-slate-300"
            } ${statusFilter === "conflict" ? "ring-2 ring-rose-500 bg-rose-50/40" : ""}`}
            onClick={() => setStatusFilter(statusFilter === "conflict" ? "all" : "conflict")}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Conflitos / Alertas
                </span>
                <div
                  className={`p-2 rounded-lg ${
                    conflictSlotsCount > 0 ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <AlertCircle className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div className={`text-3xl font-bold ${conflictSlotsCount > 0 ? "text-rose-600" : "text-slate-700"}`}>
                  {conflictSlotsCount}
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    conflictSlotsCount > 0 ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-50 text-slate-600"
                  }`}
                >
                  {conflictSlotsCount > 0 ? "Requer atenção" : "Tudo regular"}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Vagas com sobreposição ou choque</p>
            </CardContent>
          </Card>
        </div>

        {/* Search & Dynamic Filters Bar */}
        <div className="bg-white p-4 rounded-lg border shadow-sm space-y-3 mb-6">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full lg:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Busque por data, horário, escola, solicitante ou pauta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>

            {/* Quick Status Buttons & Specific Date Picker */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Filter className="h-3.5 w-3.5" /> Status:
              </span>
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
                className="h-8 text-xs"
              >
                Todos ({totalSlotsCount})
              </Button>
              <Button
                variant={statusFilter === "free" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("free")}
                className={`h-8 text-xs ${
                  statusFilter === "free"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                Livres ({freeSlotsCount})
              </Button>
              <Button
                variant={statusFilter === "booked" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("booked")}
                className={`h-8 text-xs ${
                  statusFilter === "booked"
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "border-blue-200 text-blue-700 hover:bg-blue-50"
                }`}
              >
                Reservados ({bookedSlotsCount})
              </Button>
              {conflictSlotsCount > 0 && (
                <Button
                  variant={statusFilter === "conflict" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("conflict")}
                  className={`h-8 text-xs ${
                    statusFilter === "conflict"
                      ? "bg-rose-600 hover:bg-rose-700 text-white"
                      : "border-rose-200 text-rose-700 hover:bg-rose-50"
                  }`}
                >
                  Conflitos ({conflictSlotsCount})
                </Button>
              )}

              <div className="h-4 w-[1px] bg-border mx-1 hidden sm:block" />

              {/* Date filter */}
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="h-8 text-xs w-36 bg-white"
                  title="Filtrar por data específica"
                />
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {/* Bulk Selection Bar */}
          {selectedSlotIds.length > 0 && (
            <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 px-4 py-2 rounded-md animate-in fade-in">
              <div className="text-xs text-indigo-900 font-medium">
                <strong>{selectedSlotIds.length}</strong> vaga(s) livre(s) selecionada(s)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSlotIds([])}
                  className="h-7 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                >
                  Desmarcar Todas
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={openBulkDeleteConfirm}
                  className="h-7 text-xs flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir Selecionadas ({selectedSlotIds.length})
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Content Tabs Body */}
        <TabsContent value="future" className="mt-0">
          {renderListContent()}
        </TabsContent>
        <TabsContent value="past" className="mt-0">
          {renderListContent()}
        </TabsContent>
      </Tabs>

      {/* --- Render List Content (Table or Cards) --- */}
      {function renderListContent() {
        if (loading) {
          return (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-3 animate-spin text-indigo-500 opacity-60" />
                Carregando horários do setor...
              </CardContent>
            </Card>
          );
        }

        if (sortedSlots.length === 0) {
          return (
            <Card>
              <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                <CalendarDays className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-lg font-medium text-slate-700">
                  {hasActiveFilters
                    ? "Nenhum horário encontrado para os filtros informados."
                    : periodTab === "future"
                    ? "Nenhum horário futuro disponível."
                    : "Nenhum horário expirado."}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {hasActiveFilters ? (
                    <Button variant="link" onClick={clearAllFilters} className="text-indigo-600 p-0 h-auto">
                      Limpar filtros de busca
                    </Button>
                  ) : periodTab === "future" ? (
                    "Utilize o botão 'Adicionar Expediente' acima para criar novas vagas para o setor."
                  ) : (
                    "O histórico de atendimentos anteriores aparecerá aqui."
                  )}
                </p>
              </CardContent>
            </Card>
          );
        }

        if (viewMode === "table") {
          return (
            <Card className="overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-12 text-center">
                        <Checkbox
                          checked={isAllSelectableSelected}
                          onCheckedChange={toggleSelectAll}
                          disabled={selectableSlotsOnPage.length === 0}
                          aria-label="Selecionar todas as vagas livres da página"
                        />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/60 transition-colors"
                        onClick={() => handleSort("start_time")}
                      >
                        <div className="flex items-center">
                          Data do Atendimento <SortIcon columnKey="start_time" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/60 transition-colors"
                        onClick={() => handleSort("time")}
                      >
                        <div className="flex items-center">
                          Horário & Duração <SortIcon columnKey="time" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/60 transition-colors"
                        onClick={() => handleSort("status")}
                      >
                        <div className="flex items-center">
                          Status <SortIcon columnKey="status" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/60 transition-colors"
                        onClick={() => handleSort("school")}
                      >
                        <div className="flex items-center">
                          Escola / Solicitante / Pauta <SortIcon columnKey="school" />
                        </div>
                      </TableHead>
                      <TableHead>Regras</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSlots.map((slot) => {
                      const activeAppts = Array.isArray(slot.appointments)
                        ? slot.appointments.filter((a: any) => a && a.status === "active")
                        : slot.appointments && slot.appointments.status === "active"
                        ? [slot.appointments]
                        : [];
                      const activeAppt = activeAppts[0];
                      const isFree = slot.is_available && activeAppts.length === 0;
                      const conflict = getSlotOverlapConflict(slot);
                      const isSelected = selectedSlotIds.includes(slot.id);

                      const schoolName =
                        activeAppt?.profiles?.unidades_escolares?.nome_escola ||
                        activeAppt?.profiles?.name ||
                        activeAppt?.profiles?.email;

                      const slotDate = new Date(slot.start_time);
                      const formattedDateStr = format(slotDate, "dd/MM/yyyy", { locale: ptBR });
                      const dayOfWeekStr = format(slotDate, "EEEE", { locale: ptBR });
                      const formattedStartTime = format(slotDate, "HH:mm");
                      const formattedEndTime = format(new Date(slot.end_time), "HH:mm");

                      return (
                        <TableRow
                          key={slot.id}
                          className={`transition-colors ${
                            conflict.hasConflict
                              ? conflict.isOverlappedByBooked
                                ? "bg-amber-50/60 hover:bg-amber-50"
                                : "bg-red-50/60 hover:bg-red-50"
                              : isSelected
                              ? "bg-indigo-50/50 hover:bg-indigo-50/80"
                              : !isFree
                              ? "bg-slate-50/40 hover:bg-slate-50"
                              : "hover:bg-slate-50/80"
                          }`}
                        >
                          <TableCell className="text-center">
                            {isFree ? (
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelectSlot(slot.id)}
                                aria-label="Selecionar vaga"
                              />
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </TableCell>

                          <TableCell>
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <CalendarDays className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              {formattedDateStr}
                            </div>
                            <div className="text-xs text-muted-foreground capitalize">{dayOfWeekStr}</div>
                          </TableCell>

                          <TableCell>
                            <div className="font-semibold text-slate-800 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              {formattedStartTime} - {formattedEndTime}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {Math.round((new Date(slot.end_time).getTime() - slotDate.getTime()) / 60000)} min
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1">
                              {isFree ? (
                                <Badge
                                  variant="outline"
                                  className="text-emerald-700 border-emerald-200 bg-emerald-50 text-xs font-medium"
                                >
                                  Livre
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-indigo-800 border-indigo-200 bg-indigo-50 text-xs font-medium"
                                >
                                  Reservado
                                </Badge>
                              )}
                              {conflict.hasConflict && (
                                <Badge
                                  variant="destructive"
                                  className={`text-[10px] ${
                                    conflict.isOverlappedByBooked ? "bg-amber-600" : "bg-red-600"
                                  }`}
                                  title={conflict.message}
                                >
                                  {conflict.isOverlappedByBooked ? "⛔ Bloqueada" : "⚠️ Choque"}
                                </Badge>
                              )}
                            </div>
                            {conflict.hasConflict && (
                              <p className="text-[10px] text-red-600 max-w-xs truncate mt-0.5" title={conflict.message}>
                                {conflict.message}
                              </p>
                            )}
                          </TableCell>

                          <TableCell className="max-w-xs">
                            {isFree ? (
                              <span className="text-xs text-muted-foreground italic">Disponível para agendamento</span>
                            ) : (
                              <div className="space-y-0.5">
                                <div className="font-semibold text-indigo-900 text-xs flex items-center gap-1 truncate">
                                  <School className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  <span className="truncate">{schoolName || "Escola Agendada"}</span>
                                </div>
                                {activeAppt?.profiles?.name && (
                                  <div className="text-[11px] text-slate-600 truncate">
                                    {activeAppt.profiles.name}
                                    {activeAppt.profiles.email ? ` (${activeAppt.profiles.email})` : ""}
                                  </div>
                                )}
                                {activeAppt?.description && (
                                  <div
                                    className="text-[11px] text-slate-500 truncate italic"
                                    title={activeAppt.description}
                                  >
                                    Pauta: {activeAppt.description}
                                  </div>
                                )}
                              </div>
                            )}
                          </TableCell>

                          <TableCell>
                            {slot.requires_24h_advance ? (
                              <Badge variant="secondary" className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px]">
                                <ShieldAlert className="w-3 h-3 mr-1 text-amber-500" />
                                Mín. 24h
                              </Badge>
                            ) : (
                              <span className="text-[11px] text-slate-400">Sem carência</span>
                            )}
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isFree ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 flex items-center gap-1"
                                  onClick={() => openRescheduleModal(slot)}
                                >
                                  <CalendarDays className="w-3.5 h-3.5" />
                                  Alterar Horário
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => openSingleDeleteConfirm(slot)}
                                  title="Apagar este horário"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Dynamic Pagination Bar */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t bg-muted/20">
                  <span className="text-xs text-muted-foreground">
                    Mostrando {(currentPage - 1) * itemsPerPage + 1} a{" "}
                    {Math.min(currentPage * itemsPerPage, sortedSlots.length)} de {sortedSlots.length} horários
                  </span>
                  <Pagination className="justify-end w-auto mx-0">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage > 1) setCurrentPage(currentPage - 1);
                          }}
                          className={currentPage === 1 ? "pointer-events-none opacity-50 cursor-not-allowed" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                        .map((page, idx, array) => {
                          const showEllipsis = idx > 0 && page - array[idx - 1] > 1;
                          return (
                            <React.Fragment key={page}>
                              {showEllipsis && (
                                <PaginationItem>
                                  <span className="px-2 text-xs text-muted-foreground">...</span>
                                </PaginationItem>
                              )}
                              <PaginationItem>
                                <Button
                                  variant={currentPage === page ? "default" : "outline"}
                                  size="sm"
                                  className="h-8 w-8 p-0 text-xs"
                                  onClick={() => setCurrentPage(page)}
                                >
                                  {page}
                                </Button>
                              </PaginationItem>
                            </React.Fragment>
                          );
                        })}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                          }}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50 cursor-not-allowed" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </Card>
          );
        }

        // Cards View Mode
        return (
          <div className="space-y-6">
            {Object.keys(groupedCards).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum horário corresponde aos filtros.</p>
            ) : (
              Object.keys(groupedCards)
                .sort((a, b) => (periodTab === "future" ? new Date(a).getTime() - new Date(b).getTime() : new Date(b).getTime() - new Date(a).getTime()))
                .map((dateKey) => (
                  <div key={dateKey} className="mb-6">
                    <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 border-b pb-2">
                      <CalendarDays className="w-5 h-5 text-indigo-500" />
                      {format(parseISO(dateKey), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      <Badge variant="outline" className="ml-2 text-xs font-normal">
                        {groupedCards[dateKey].length} vaga(s)
                      </Badge>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {groupedCards[dateKey].map((slot: any) => (
                        <SlotCard key={slot.id} slot={slot} />
                      ))}
                    </div>
                  </div>
                ))
            )}
          </div>
        );
      }()}

      {/* --- Dialog: Alterar Horário / Reagendamento --- */}
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
                {timeslots.filter((s) => s.is_available && new Date(s.start_time) >= new Date()).length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded border border-amber-200">
                    Nenhum outro horário livre disponível neste setor. Crie uma nova vaga livre primeiro.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2 bg-white">
                    {timeslots
                      .filter((s) => s.is_available && new Date(s.start_time) >= new Date())
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
                <label className="text-sm font-medium text-slate-700">
                  Motivo do Reagendamento (Enviado para a escola)
                </label>
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

      {/* --- AlertDialog: Exclusão Individual de Vaga Livre --- */}
      <AlertDialog open={isSingleDeleteOpen} onOpenChange={setIsSingleDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar Vaga Livre</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar a vaga de{" "}
              <strong>
                {deleteSlotTarget &&
                  `${format(new Date(deleteSlotTarget.start_time), "dd/MM/yyyy 'das' HH:mm")} às ${format(
                    new Date(deleteSlotTarget.end_time),
                    "HH:mm"
                  )}`}
              </strong>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={singleDeleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSingleDelete}
              disabled={singleDeleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {singleDeleteLoading ? "Apagando..." : "Confirmar Exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- AlertDialog: Exclusão em Lote de Vagas Selecionadas --- */}
      <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar Vagas Selecionadas</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar permanentemente as{" "}
              <strong>{selectedSlotIds.length}</strong> vagas livres selecionadas?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDeleteSelected}
              disabled={bulkDeleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleteLoading ? "Apagando..." : `Apagar ${selectedSlotIds.length} Vagas`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- AlertDialog: Limpar Horários Expirados Ociosos --- */}
      <AlertDialog open={isCleanExpiredOpen} onOpenChange={setIsCleanExpiredOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar Horários Expirados Ociosos</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja apagar permanentemente os horários passados que nunca tiveram agendamento ativo vinculado?
              Esta ação mantém a base de dados organizada e limpa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cleanExpiredLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCleanExpired}
              disabled={cleanExpiredLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cleanExpiredLoading ? "Limpando..." : "Confirmar Limpeza"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}