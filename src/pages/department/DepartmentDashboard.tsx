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
import { CalendarDays, Clock, Users, Star, Search, AlertCircle } from "lucide-react";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

export default function DepartmentDashboard() {
  const { user } = useAuth();
  const [departmentName, setDepartmentName] = useState("");
  const [stats, setStats] = useState({ totalSlots: 0, availableSlots: 0 });
  const [allAppointments, setAllAppointments] = useState<any[]>([]);
  
  // Filtro do Histórico
  const [searchTerm, setSearchTerm] = useState("");

  // Modal de Conclusão
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);
  const [departmentNotes, setDepartmentNotes] = useState("");

  const fetchData = async () => {
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("department_id").eq("id", user.id).single();
    if (!profile?.department_id) return;

    const { data: dept } = await supabase.from("departments").select("*").eq("id", profile.department_id).single();
    if (!dept) return;
    setDepartmentName(dept.name);

    // Estatísticas de Horários
    const [totalSlots, availableSlots] = await Promise.all([
      supabase.from("timeslots").select("id", { count: "exact", head: true }).eq("department_id", dept.id),
      supabase.from("timeslots").select("id", { count: "exact", head: true }).eq("department_id", dept.id).eq("is_available", true),
    ]);
    setStats({ totalSlots: totalSlots.count ?? 0, availableSlots: availableSlots.count ?? 0 });

    // Busca TODOS os agendamentos do setor, ordenados do mais recente para o mais antigo
    const { data: appts } = await supabase
      .from("appointments")
      .select("*, timeslots!inner(*), profiles!appointments_requester_id_fkey(*)")
      .eq("timeslots.department_id", dept.id);

    const sortedAppts = (appts || []).sort((a, b) => 
      new Date(b.timeslots.start_time).getTime() - new Date(a.timeslots.start_time).getTime()
    );
    setAllAppointments(sortedAppts);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // ==========================================
  // LÓGICA DE FILTROS E ABAS (CLIENT-SIDE)
  // ==========================================
  const now = new Date();

  // Pendências: Status Ativo E Horário já passou
  const pendingAppointments = allAppointments.filter(
    (appt) => appt.status === "active" && new Date(appt.timeslots.start_time) <= now
  );

  // Hoje: Qualquer status, mas a data é hoje
  const todayAppointments = allAppointments.filter(
    (appt) => isToday(new Date(appt.timeslots.start_time))
  );

  // Histórico: Já teve desfecho (Concluído, Falta, Cancelado)
  const historyAppointments = allAppointments.filter(
    (appt) => ["completed", "cancelled", "no-show"].includes(appt.status)
  );

  // Histórico Filtrado (Search)
  const filteredHistory = historyAppointments.filter((appt) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const schoolName = (appt.profiles?.name || appt.profiles?.email || "").toLowerCase();
    const desc = (appt.description || "").toLowerCase();
    const statusText = appt.status.toLowerCase();
    const dateStr = format(new Date(appt.timeslots.start_time), "dd/MM/yyyy HH:mm").toLowerCase();
    
    return schoolName.includes(term) || desc.includes(term) || statusText.includes(term) || dateStr.includes(term);
  });

  // ==========================================
  // KPIs DE BI (INTELIGÊNCIA DE DADOS)
  // ==========================================
  const completedCount = historyAppointments.filter(a => a.status === "completed").length;
  const noShowCount = historyAppointments.filter(a => a.status === "no-show").length;
  const ratings = historyAppointments.filter(a => a.status === "completed" && a.rating > 0).map(a => a.rating);
  const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "N/A";

  // ==========================================
  // AÇÕES (BOTÕES)
  // ==========================================
  const handleSectorCancel = async (appointmentId: string, schoolUserId: string) => {
    const reason = window.prompt("Digite o motivo do cancelamento (Obrigatório para notificar a escola):");
    if (!reason || reason.trim() === "") {
      if (reason !== null) toast({ title: "Justificativa Ausente", variant: "destructive" });
      return;
    }
    try {
      await supabase.from("appointments").update({ status: "cancelled", cancel_reason: reason }).eq("id", appointmentId);
      await supabase.from("notifications").insert({ user_id: schoolUserId, title: "Agendamento Cancelado", message: `Motivo: ${reason}` });
      toast({ title: "Sucesso", description: "Agendamento cancelado." });
      fetchData();
    } catch (error: any) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
  };

  const handleMarkNoShow = async (appointmentId: string) => {
    if (!window.confirm("Confirmar que a escola faltou ao atendimento?")) return;
    try {
      await supabase.from("appointments").update({ status: "no-show" }).eq("id", appointmentId);
      toast({ title: "Falta registrada" });
      fetchData();
    } catch (error: any) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
  };

  const openCompletionModal = (appointmentId: string) => {
    setSelectedApptId(appointmentId);
    setDepartmentNotes("");
    setIsCompleteModalOpen(true);
  };

  const submitCompletion = async () => {
    try {
      await supabase.from("appointments").update({ status: "completed", department_notes: departmentNotes }).eq("id", selectedApptId);
      toast({ title: "Atendimento Concluído" });
      setIsCompleteModalOpen(false);
      fetchData();
    } catch (error: any) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
  };

  // ==========================================
  // COMPONENTES DE INTERFACE
  // ==========================================
  const statusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">Ativo</Badge>;
      case "cancelled": return <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">Cancelado</Badge>;
      case "completed": return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">Concluído</Badge>;
      case "no-show": return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">Falta</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const renderAppointmentCard = (appt: any, type: "pending" | "today" | "history") => (
    <Card key={appt.id} className={`overflow-hidden ${type === "pending" ? "border-l-4 border-l-amber-500" : ""}`}>
      <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between gap-4">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{appt.profiles?.name || appt.profiles?.email}</h3>
            {statusBadge(appt.status)}
            {type === "pending" && <Badge variant="destructive" className="flex gap-1"><AlertCircle className="w-3 h-3" /> Atrasado</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{appt.description}</p>
          <p className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            {format(new Date(appt.timeslots.start_time), "dd/MM/yyyy 'às' HH:mm")}
          </p>

          {/* Área de Auditoria (Visível no Histórico) */}
          {type === "history" && (
            <div className="mt-4 space-y-2">
              {appt.cancel_reason && (
                <div className="bg-red-50 text-red-800 text-sm p-2 rounded border border-red-100">
                  <strong>Motivo Cancelamento:</strong> {appt.cancel_reason}
                </div>
              )}
              {appt.department_notes && (
                <div className="bg-slate-50 text-slate-700 text-sm p-2 rounded border border-slate-100">
                  <strong>Nossa Anotação:</strong> {appt.department_notes}
                </div>
              )}
              {appt.rating > 0 && (
                <div className="bg-amber-50 text-amber-900 text-sm p-2 rounded border border-amber-100 flex items-start gap-2">
                  <Star className="w-4 h-4 fill-amber-500 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <strong>Avaliação da Escola ({appt.rating}/5):</strong> {appt.school_notes || "Sem comentários."}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botões de Ação (Apenas para Pendências e Ativos Hoje) */}
        {appt.status === "active" && type !== "history" && (
          <div className="flex flex-col gap-2 min-w-[140px]">
            {new Date(appt.timeslots.start_time) > now ? (
              <Button variant="destructive" size="sm" onClick={() => handleSectorCancel(appt.id, appt.requester_id)}>Cancelar (com aviso)</Button>
            ) : (
              <>
                <Button variant="default" className="bg-green-600 hover:bg-green-700" size="sm" onClick={() => openCompletionModal(appt.id)}>Concluir Atendimento</Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleMarkNoShow(appt.id)}>Registrar Falta</Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel do Setor</h1>
        <p className="text-muted-foreground">{departmentName || "Carregando..."}</p>
      </div>

      {/* KPIs Estratégicos */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avaliação Média</CardTitle></CardHeader><CardContent className="text-3xl font-bold flex items-center gap-2">{avgRating} <Star className="w-6 h-6 fill-amber-400 text-amber-400"/></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Concluídos</CardTitle></CardHeader><CardContent className="text-3xl font-bold text-green-600">{completedCount}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Taxa de Faltas</CardTitle></CardHeader><CardContent className="text-3xl font-bold text-red-600">{noShowCount}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Horários Abertos</CardTitle></CardHeader><CardContent className="text-3xl font-bold text-blue-600">{stats.availableSlots}</CardContent></Card>
      </div>

      {/* Painel de Abas */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="pending" className="relative">
            Pendências {pendingAppointments.length > 0 && <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white">{pendingAppointments.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="today">Agenda de Hoje</TabsTrigger>
          <TabsTrigger value="history">Histórico e Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingAppointments.length === 0 ? <p className="text-center text-muted-foreground py-8">Nenhuma pendência. Excelente trabalho!</p> : pendingAppointments.map(a => renderAppointmentCard(a, "pending"))}
        </TabsContent>

        <TabsContent value="today" className="space-y-4">
          {todayAppointments.length === 0 ? <p className="text-center text-muted-foreground py-8">Nenhum agendamento marcado para hoje.</p> : todayAppointments.map(a => renderAppointmentCard(a, "today"))}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Pesquisar por escola, descrição, status ou data..." 
              className="pl-9 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {filteredHistory.length === 0 ? <p className="text-center text-muted-foreground py-8">Nenhum histórico encontrado para esta pesquisa.</p> : filteredHistory.map(a => renderAppointmentCard(a, "history"))}
        </TabsContent>
      </Tabs>

      {/* Modal de Conclusão */}
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
    </div>
  );
}