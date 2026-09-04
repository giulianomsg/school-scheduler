import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, Clock, Users, Star, Search, AlertCircle, Phone, Building } from "lucide-react";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { translateError } from "@/lib/errorTranslations";

import { checkAppointmentConflict, type GenericAppointment, type ConflictResult } from "@/lib/conflictUtils";

interface DepartmentAppointment {
  id: string;
  requester_id: string;
  status: string;
  rating: number;
  rating_cordialidade?: number;
  rating_comunicacao?: number;
  rating_organizacao?: number;
  rating_impressao?: number;
  school_notes?: string;
  department_notes?: string;
  cancel_reason?: string;
  requested_attendant?: { name: string } | null;
  timeslots: {
    id: string;
    start_time: string;
    end_time: string;
    department_id: string;
  };
  profiles?: {
    name: string;
    email: string;
    telefone?: string;
    whatsapp?: string;
    unidades_escolares?: {
      nome_escola: string;
      telefone?: string;
    };
  };
  [key: string]: unknown;
}

export default function DepartmentDashboard() {
  const { user } = useAuth();
  const [departmentName, setDepartmentName] = useState("");
  const [stats, setStats] = useState({ totalSlots: 0, availableSlots: 0 });
  const [allAppointments, setAllAppointments] = useState<DepartmentAppointment[]>([]);
  const [globalActiveAppointments, setGlobalActiveAppointments] = useState<GenericAppointment[]>([]);
  const [activeTab, setActiveTab] = useState("today");

  // Filtro do Histórico
  const [searchTerm, setSearchTerm] = useState("");

  // Modal de Conclusão
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);
  const [departmentNotes, setDepartmentNotes] = useState("");

  // Modal de Reagendamento / Alteração de Horário
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<DepartmentAppointment | null>(null);
  const [availableSlotsForDept, setAvailableSlotsForDept] = useState<any[]>([]);
  const [selectedNewSlotId, setSelectedNewSlotId] = useState<string>("");
  const [rescheduleReason, setRescheduleReason] = useState<string>("");
  const [savingReschedule, setSavingReschedule] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("department_id").eq("id", user.id).single();
    if (!profile?.department_id) return;

    const { data: dept } = await supabase.from("departments").select("*").eq("id", profile.department_id).single();
    if (!dept) return;
    setDepartmentName(dept.name);

    const [totalSlots, availableSlots] = await Promise.all([
      supabase.from("timeslots").select("id", { count: "exact", head: true }).eq("department_id", dept.id),
      supabase.from("timeslots").select("id", { count: "exact", head: true }).eq("department_id", dept.id).eq("is_available", true),
    ]);
    setStats({ totalSlots: totalSlots.count ?? 0, availableSlots: availableSlots.count ?? 0 });

    const [{ data: appts }, { data: globalActive }] = await Promise.all([
      supabase
        .from("appointments")
        .select("*, timeslots!inner(*, departments(name)), profiles!appointments_requester_id_fkey(*, unidades_escolares(*))")
        .eq("timeslots.department_id", dept.id),
      supabase
        .from("appointments")
        .select("id, requester_id, status, timeslot_id, timeslots!inner(id, start_time, end_time, department_id, departments(name))")
        .eq("status", "active")
    ]);

    const sortedAppts = (appts || []).sort((a, b) =>
      new Date(b.timeslots.start_time).getTime() - new Date(a.timeslots.start_time).getTime()
    );
    setAllAppointments(sortedAppts);
    setGlobalActiveAppointments((globalActive || []) as GenericAppointment[]);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Mapeamento de conflitos para todos os agendamentos ativos
  const apptConflictMap = useMemo(() => {
    const conflictMap: Record<string, ConflictResult> = {};
    for (const appt of allAppointments) {
      if (appt.status !== "active" || !appt.timeslots) continue;
      const reqActive = globalActiveAppointments.filter(g => g.requester_id === appt.requester_id);
      const result = checkAppointmentConflict(appt.id, appt.timeslots, reqActive, 15);
      if (result.hasConflict) {
        conflictMap[appt.id] = result;
      }
    }
    return conflictMap;
  }, [allAppointments, globalActiveAppointments]);

  const conflictingAppointments = useMemo(() => {
    return allAppointments.filter(a => a.status === "active" && apptConflictMap[a.id]?.hasConflict);
  }, [allAppointments, apptConflictMap]);

  const now = new Date();

  const pendingAppointments = allAppointments.filter(
    (appt) => appt.status === "active" && new Date(appt.timeslots.start_time) <= now
  );

  const todayAppointments = allAppointments.filter(
    (appt) => isToday(new Date(appt.timeslots.start_time))
  );

  const upcomingAppointments = allAppointments.filter(
    (appt) => appt.status === "active" && new Date(appt.timeslots.start_time) > now && !isToday(new Date(appt.timeslots.start_time))
  );

  const historyAppointments = allAppointments.filter(
    (appt) => ["completed", "cancelled", "no-show"].includes(appt.status)
  );

  const filteredHistory = historyAppointments.filter((appt) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const schoolName = (appt.profiles?.unidades_escolares?.nome_escola || "").toLowerCase();
    const directorName = (appt.profiles?.name || appt.profiles?.email || "").toLowerCase();
    const desc = (String(appt.description || "")).toLowerCase();
    const statusText = appt.status.toLowerCase();
    const dateStr = format(new Date(appt.timeslots.start_time), "dd/MM/yyyy HH:mm").toLowerCase();

    return schoolName.includes(term) || directorName.includes(term) || desc.includes(term) || statusText.includes(term) || dateStr.includes(term);
  });

  const completedCount = historyAppointments.filter(a => a.status === "completed").length;
  const noShowCount = historyAppointments.filter(a => a.status === "no-show").length;
  const openAppointmentsCount = allAppointments.filter(a => a.status === "active").length;
  const ratings = historyAppointments.filter(a => a.status === "completed" && a.rating > 0).map(a => a.rating);
  const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "N/A";

  // Handlers para Reagendamento / Alteração de Horários pelo Setor
  const openRescheduleModal = async (appt: DepartmentAppointment) => {
    setEditingAppointment(appt);
    setSelectedNewSlotId("");
    setRescheduleReason("");
    setIsRescheduleModalOpen(true);

    const { data: slots } = await supabase
      .from("timeslots")
      .select("*")
      .eq("department_id", appt.timeslots.department_id)
      .eq("is_available", true)
      .gte("start_time", new Date().toISOString())
      .order("start_time");
    setAvailableSlotsForDept(slots || []);
  };

  const handleConfirmReschedule = async () => {
    if (!editingAppointment || !selectedNewSlotId) {
      toast({ title: "Atenção", description: "Selecione um novo horário vago para reagendar.", variant: "destructive" });
      return;
    }

    setSavingReschedule(true);
    try {
      // 1. Liberar vaga antiga
      await supabase
        .from("timeslots")
        .update({ is_available: true })
        .eq("id", editingAppointment.timeslots.id);

      // 2. Ocupar nova vaga
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

      // 4. Notificar a escola
      const newSlot = availableSlotsForDept.find((s) => s.id === selectedNewSlotId);
      const newTimeStr = newSlot
        ? format(new Date(newSlot.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
        : "";

      const reasonMsg = rescheduleReason.trim()
        ? ` Motivo: ${rescheduleReason}`
        : " (Horário ajustado pelo setor para resolver choque de horários).";

      await supabase.from("notifications").insert({
        user_id: editingAppointment.requester_id,
        title: `Reagendamento: Setor ${departmentName}`,
        message: `Seu agendamento foi alterado pelo setor para o novo horário: ${newTimeStr}.${reasonMsg}`,
      });

      toast({ title: "Reagendamento Realizado!", description: "O horário foi alterado e a escola foi notificada." });
      setIsRescheduleModalOpen(false);
      setEditingAppointment(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao reagendar", description: translateError(err), variant: "destructive" });
    } finally {
      setSavingReschedule(false);
    }
  };

  // ... (keeping other handlers the same)
  // Re-declare handleSectorCancel and handleMarkNoShow due to replace boundary requirements
  const handleSectorCancel = async (appointmentId: string, schoolUserId: string) => {
    const reason = window.prompt("Digite o motivo do cancelamento (Obrigatório para notificar a escola):");
    if (!reason || reason.trim() === "") {
      if (reason !== null) toast({ title: "Justificativa Ausente", variant: "destructive" });
      return;
    }
    try {
      await supabase.from("appointments").update({ status: "cancelled", cancel_reason: reason }).eq("id", appointmentId);

      // 💡 NOTIFICAÇÃO ATUALIZADA: Inclui o nome do Setor
      await supabase.from("notifications").insert({
        user_id: schoolUserId,
        title: `Cancelamento: Setor ${departmentName}`,
        message: `O setor ${departmentName} cancelou o seu agendamento. Motivo: ${reason}`
      });

      toast({ title: "Sucesso", description: "Agendamento cancelado e escola notificada." });
      fetchData();
    } catch (error: any) { toast({ title: "Erro", description: translateError(error), variant: "destructive" }); }
  };

  const handleMarkNoShow = async (appointmentId: string) => {
    if (!window.confirm("Confirmar que a escola faltou ao atendimento?")) return;
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "no-show" })
        .eq("id", appointmentId);

      if (error) throw error; // Validação estrita do erro

      toast({ title: "Falta registrada" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro na operação", description: error.message, variant: "destructive" });
    }
  };

  const openCompletionModal = (appointmentId: string) => {
    setSelectedApptId(appointmentId);
    setDepartmentNotes("");
    setIsCompleteModalOpen(true);
  };

  const submitCompletion = async () => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "completed", department_notes: departmentNotes })
        .eq("id", selectedApptId);

      if (error) throw error; // Validação estrita do erro

      toast({ title: "Atendimento Concluído" });
      setIsCompleteModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro na operação", description: error.message, variant: "destructive" });
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">Ativo</Badge>;
      case "cancelled": return <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">Cancelado</Badge>;
      case "completed": return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">Concluído</Badge>;
      case "no-show": return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">Falta</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const renderAppointmentCard = (appt: DepartmentAppointment, type: "pending" | "today" | "upcoming" | "history") => {
    const schoolName = appt.profiles?.unidades_escolares?.nome_escola || "Escola não identificada";
    const schoolPhone = appt.profiles?.unidades_escolares?.telefone || "";
    const directorName = appt.profiles?.name || appt.profiles?.email || "Sem nome";
    const directorPhone = appt.profiles?.telefone || appt.profiles?.whatsapp || "";
    const conflict = apptConflictMap[appt.id];

    return (
      <Card key={appt.id} className={`overflow-hidden ${type === "pending" ? "border-l-4 border-l-amber-500" : ""} ${conflict?.hasConflict ? "ring-2 ring-red-500/50" : ""}`}>
        <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between gap-4">
          <div className="space-y-4 flex-1">

            {/* Cabeçalho */}
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-slate-800">
                <Building className="w-5 h-5 text-indigo-600" />
                {schoolName}
              </h3>
              {statusBadge(appt.status)}
              {type === "pending" && <Badge variant="destructive" className="flex gap-1"><AlertCircle className="w-3 h-3" /> Atrasado</Badge>}
              {conflict?.hasConflict && (
                <Badge variant="destructive" className="bg-red-600 text-white gap-1 font-semibold animate-pulse">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Choque de Horário
                </Badge>
              )}
            </div>

            {/* Alerta de Conflito de Horário */}
            {conflict?.hasConflict && (
              <div className="bg-red-50 border border-red-200 text-red-900 p-3 rounded-md text-xs space-y-1">
                <p className="font-semibold flex items-center gap-1.5 text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  Atenção: Necessita reagendamento!
                </p>
                <p>{conflict.message}</p>
              </div>
            )}

            {/* Faixa de Contactos */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 text-sm bg-slate-50 p-3 rounded-md border border-slate-200">
              <div className="flex items-center gap-1.5 font-medium text-slate-700">
                <Users className="w-4 h-4 text-slate-400" />
                Diretor(a): <span className="font-normal text-slate-600">{directorName}</span>
              </div>

              {(directorPhone || schoolPhone) && (
                 <div className="flex flex-wrap items-center gap-4 border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-4">
                  {directorPhone && (
                    <a href={`https://wa.me/55${directorPhone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-green-700 hover:underline">
                      <Phone className="w-4 h-4" />
                      Dir: {directorPhone}
                    </a>
                  )}
                  {schoolPhone && (
                    <div className="flex items-center gap-1.5 text-blue-700">
                      <Phone className="w-4 h-4" />
                      Esc: {schoolPhone}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Pauta e Data */}
            <div className="space-y-1">
              <p className="text-sm text-slate-700"><strong>Pauta:</strong> {String(appt.description || "")}</p>
              <p className="text-sm font-semibold flex items-center gap-2 text-indigo-700">
                <Clock className="w-4 h-4" />
                {format(new Date(appt.timeslots.start_time), "dd/MM/yyyy 'às' HH:mm")}
              </p>

              {/* Exibição do Atendente Solicitado (Opcional) */}
              {appt.requested_attendant && (
                <div className="mt-2 inline-flex">
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 gap-1.5 py-1">
                    <Star className="w-3.5 h-3.5 fill-indigo-700" />
                    Solicitado atendimento com: {appt.requested_attendant.name}
                  </Badge>
                </div>
              )}
            </div>

            {/* Área de Auditoria (Histórico) */}
            {type === "history" && (
              <div className="mt-4 space-y-2">
                {appt.cancel_reason && (
                  <div className="bg-red-50 text-red-800 text-sm p-3 rounded-md border border-red-100">
                    <strong>Motivo Cancelamento:</strong> {appt.cancel_reason}
                  </div>
                )}
                {appt.department_notes && (
                  <div className="bg-slate-50 text-slate-700 text-sm p-3 rounded-md border border-slate-200">
                    <strong>Nossa Anotação:</strong> {appt.department_notes}
                  </div>
                )}

                {/* AVALIAÇÃO DA ESCOLA (Estrelas, Cores e Comentários) */}
                {appt.rating > 0 && (() => {
                  const isFive = appt.rating === 5;
                  const isMedium = appt.rating >= 3 && appt.rating < 5;

                  const colorClass = isFive
                    ? "bg-green-50 border-green-500 text-green-900"
                    : isMedium
                      ? "bg-yellow-50 border-yellow-400 text-yellow-900"
                      : "bg-red-50 border-red-500 text-red-900";

                  const starFillClass = isFive ? "fill-green-500 text-green-500" : isMedium ? "fill-yellow-500 text-yellow-500" : "fill-red-500 text-red-500";
                  const starEmptyClass = isFive ? "text-green-200" : isMedium ? "text-yellow-200" : "text-red-200";

                  const renderStarRow = (label: string, value?: number) => {
                    if (!value) return null;
                    return (
                      <div className="flex items-center justify-between text-xs py-0.5 border-b border-white/40 last:border-0">
                        <span className="opacity-80">{label}:</span>
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`w-3 h-3 ${i < value ? starFillClass : starEmptyClass}`} />
                          ))}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div className={`mt-2 p-3 rounded-md border-l-4 border-y border-r flex flex-col gap-2 ${colorClass}`}>
                      <div className="flex items-center gap-2">
                         <strong className="font-semibold text-sm">Avaliação da Escola (Média {appt.rating}/5):</strong>
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${i < appt.rating ? starFillClass : starEmptyClass}`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Critérios Específicos Adicionados Aqui */}
                      {(appt.rating_cordialidade || appt.rating_comunicacao || appt.rating_organizacao || appt.rating_impressao) && (
                        <div className="bg-white/40 p-2 rounded-sm mb-1 mt-1">
                          {renderStarRow("Cordialidade e Postura", appt.rating_cordialidade)}
                          {renderStarRow("Comunicação", appt.rating_comunicacao)}
                          {renderStarRow("Organização e Eficiência", appt.rating_organizacao)}
                          {renderStarRow("Impressão Geral", appt.rating_impressao)}
                        </div>
                      )}

                      <div className="text-sm">
                        <span className="italic">"{appt.school_notes || "Nenhum comentário preenchido."}"</span>
                      </div>
                    </div>
                  );
                })()}

              </div>
            )}
          </div>

          {/* Botões de Ação */}
          {appt.status === "active" && type !== "history" && (
            <div className="flex flex-col gap-2 min-w-[160px] justify-start mt-2 sm:mt-0">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-indigo-700 border-indigo-200 hover:bg-indigo-50 flex items-center justify-center gap-1.5"
                onClick={() => openRescheduleModal(appt)}
              >
                <CalendarDays className="w-4 h-4" />
                Alterar Horário
              </Button>

              {new Date(appt.timeslots.start_time) > now ? (
                <Button variant="destructive" size="sm" className="w-full" onClick={() => handleSectorCancel(appt.id, appt.requester_id)}>Cancelar (com aviso)</Button>
              ) : (
                <>
                  <Button variant="default" className="bg-green-600 hover:bg-green-700 w-full" size="sm" onClick={() => openCompletionModal(appt.id)}>Concluir Reunião</Button>
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full" onClick={() => handleMarkNoShow(appt.id)}>Registrar Falta</Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel do Setor</h1>
        <p className="text-muted-foreground">{departmentName || "Carregando..."}</p>
      </div>

      {conflictingAppointments.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
            <div>
              <h4 className="font-semibold text-red-900 text-sm">Foram identificados {conflictingAppointments.length} agendamento(s) com choque de horário!</h4>
              <p className="text-xs text-red-700">Utilize a opção "Alterar Horário" nos cartões abaixo para reagendá-los para horários vagos sem conflito.</p>
            </div>
          </div>
          <Button size="sm" variant="destructive" onClick={() => setActiveTab("conflicts")}>
            Ver Agendamentos Conflitantes
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Em Aberto</CardTitle></CardHeader><CardContent className="text-3xl font-bold text-blue-600">{openAppointmentsCount}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avaliação Média</CardTitle></CardHeader><CardContent className="text-3xl font-bold flex items-center gap-2">{avgRating} <Star className="w-6 h-6 fill-amber-400 text-amber-400" /></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Concluídos</CardTitle></CardHeader><CardContent className="text-3xl font-bold text-green-600">{completedCount}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Taxa de Faltas</CardTitle></CardHeader><CardContent className="text-3xl font-bold text-red-600">{noShowCount}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Horários Livres</CardTitle></CardHeader><CardContent className="text-3xl font-bold text-indigo-600">{stats.availableSlots}</CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 mb-6">
          <TabsTrigger value="pending" className="relative">
            Pendências {pendingAppointments.length > 0 && <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white">{pendingAppointments.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="today">Agenda de Hoje</TabsTrigger>
          <TabsTrigger value="upcoming">Próximos</TabsTrigger>
          <TabsTrigger value="conflicts" className="relative text-red-700 font-semibold">
            Com Conflito {conflictingAppointments.length > 0 && <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white animate-pulse">{conflictingAppointments.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingAppointments.length === 0 ? <p className="text-center text-muted-foreground py-8">Nenhuma pendência. Excelente trabalho!</p> : pendingAppointments.map(a => renderAppointmentCard(a, "pending"))}
        </TabsContent>

        <TabsContent value="today" className="space-y-4">
          {todayAppointments.length === 0 ? <p className="text-center text-muted-foreground py-8">Nenhum agendamento marcado para hoje.</p> : todayAppointments.map(a => renderAppointmentCard(a, "today"))}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4">
          {upcomingAppointments.length === 0 ? <p className="text-center text-muted-foreground py-8">Nenhum agendamento futuro encontrado.</p> : upcomingAppointments.map(a => renderAppointmentCard(a, "upcoming"))}
        </TabsContent>

        <TabsContent value="conflicts" className="space-y-4">
          {conflictingAppointments.length === 0 ? (
            <div className="p-8 text-center text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="font-semibold">Nenhum choque de horário pendente!</p>
              <p className="text-xs text-emerald-600 mt-1">Todos os agendamentos das escolas possuem intervalos adequados.</p>
            </div>
          ) : (
            conflictingAppointments.map(a => renderAppointmentCard(a, "upcoming"))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por escola, diretor, pauta ou status..."
              className="pl-9 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {filteredHistory.length === 0 ? <p className="text-center text-muted-foreground py-8">Nenhum histórico encontrado para esta pesquisa.</p> : filteredHistory.map(a => renderAppointmentCard(a, "history"))}
        </TabsContent>
      </Tabs>

      {/* Modal de Conclusão de Atendimento */}
      <Dialog open={isCompleteModalOpen} onOpenChange={setIsCompleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir Atendimento</DialogTitle>
            <DialogDescription>A escola será notificada e poderá avaliar o atendimento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Anotações do Setor (Ata / Resolução)</label>
              <Textarea
                placeholder="Ex: Documentação entregue. Problema resolvido..."
                value={departmentNotes}
                onChange={(e) => setDepartmentNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCompleteModalOpen(false)}>Cancelar</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={submitCompletion}>Salvar e Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Reagendamento / Alteração de Horário pelo Setor */}
      <Dialog open={isRescheduleModalOpen} onOpenChange={setIsRescheduleModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-700">
              <CalendarDays className="w-5 h-5" />
              Alterar Horário do Agendamento
            </DialogTitle>
            <DialogDescription>
              Reagende o atendimento da escola para um novo horário vago do setor.
            </DialogDescription>
          </DialogHeader>

          {editingAppointment && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 p-3 rounded-md border text-sm space-y-1">
                <p className="font-semibold text-slate-800">
                  Escola: {editingAppointment.profiles?.unidades_escolares?.nome_escola || "Não informada"}
                </p>
                <p className="text-xs text-slate-600">
                  Horário Atual: {format(new Date(editingAppointment.timeslots.start_time), "dd/MM/yyyy 'às' HH:mm")}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Selecione uma Nova Vaga Disponível</label>
                {availableSlotsForDept.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded border border-amber-200">
                    Nenhum horário vago disponível neste setor. Crie novos horários na tela "Gerenciar Vagas".
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2 bg-white">
                    {availableSlotsForDept.map((slot) => {
                      const reqActive = globalActiveAppointments.filter(g => g.requester_id === editingAppointment.requester_id);
                      const slotConflict = checkAppointmentConflict(editingAppointment.id, slot, reqActive, 15);
                      const isSelected = selectedNewSlotId === slot.id;

                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => !slotConflict.hasConflict && setSelectedNewSlotId(slot.id)}
                          disabled={slotConflict.hasConflict}
                          className={`w-full text-left p-2.5 rounded border text-xs flex items-center justify-between transition-all ${
                            slotConflict.hasConflict
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
                          {slotConflict.hasConflict && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">
                              Conflito c/ Escola
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
                  placeholder="Ex: Reagendamento para solucionar choque de horários entre setores..."
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