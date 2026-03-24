import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Clock, Users, Star, Search, AlertCircle, Phone, Building, Briefcase } from "lucide-react";
import { format, isToday } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface CoordinatorAppointment {
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
  description?: string;
  timeslots: {
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

export default function CoordinatorDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ totalSlots: 0, availableSlots: 0 });
  const [allAppointments, setAllAppointments] = useState<CoordinatorAppointment[]>([]);

  // Filtros Globais
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("all");

  // Modal de Conclusão
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);
  const [departmentNotes, setDepartmentNotes] = useState("");

  const coordinatorDepts = profile?.coordinatorDepts || [];

  const fetchData = async () => {
    if (!user || coordinatorDepts.length === 0) return;

    const deptIds = coordinatorDepts.map((d: any) => d.id);

    const [totalSlots, availableSlots] = await Promise.all([
      supabase.from("timeslots").select("id", { count: "exact", head: true }).in("department_id", deptIds),
      supabase.from("timeslots").select("id", { count: "exact", head: true }).in("department_id", deptIds).eq("is_available", true),
    ]);
    
    setStats({ totalSlots: totalSlots.count ?? 0, availableSlots: availableSlots.count ?? 0 });

    const { data: appts } = await supabase
      .from("appointments")
      .select("*, timeslots!inner(*), profiles!appointments_requester_id_fkey(*, unidades_escolares(*))")
      .in("timeslots.department_id", deptIds);

    const sortedAppts = (appts || []).sort((a, b) =>
      new Date(b.timeslots.start_time).getTime() - new Date(a.timeslots.start_time).getTime()
    );
    setAllAppointments(sortedAppts as CoordinatorAppointment[]);
  };

  useEffect(() => {
    fetchData();
  }, [user, profile]);

  const getDeptName = (deptId: string) => {
    const d = coordinatorDepts.find((x: any) => x.id === deptId);
    return d ? d.name : "Setor Desconhecido";
  };

  const now = new Date();

  // Filtragem principal por Setor (para todas as abas, se desejar, mas focaremos no histórico)
  // Abaixo os cálculos de abas baseiam-se em allAppointments que pode ou não ser pré-filtrado, 
  // mas o usuário pediu de forma geral ou organizada. 
  // "Movimento de Hoje" e "Atrasos" mostrarão todos, a menos que selecionemos no filtro global.
  const baseAppointments = allAppointments.filter(appt => {
    if (selectedDeptFilter !== "all" && appt.timeslots.department_id !== selectedDeptFilter) return false;
    return true;
  });

  const delaysAppointments = baseAppointments.filter(
    (appt) => appt.status === "active" && new Date(appt.timeslots.start_time) <= now
  );

  const todayAppointments = baseAppointments.filter(
    (appt) => isToday(new Date(appt.timeslots.start_time))
  );

  const historyAppointments = baseAppointments.filter(
    (appt) => ["completed", "cancelled", "no-show"].includes(appt.status)
  );

  const filteredHistory = historyAppointments.filter((appt) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const schoolName = (appt.profiles?.unidades_escolares?.nome_escola || "").toLowerCase();
    const directorName = (appt.profiles?.name || appt.profiles?.email || "").toLowerCase();
    const desc = (String(appt.description || "")).toLowerCase();
    const statusText = appt.status.toLowerCase();
    const deptName = getDeptName(appt.timeslots.department_id).toLowerCase();
    const dateStr = format(new Date(appt.timeslots.start_time), "dd/MM/yyyy HH:mm").toLowerCase();

    return schoolName.includes(term) || directorName.includes(term) || desc.includes(term) || statusText.includes(term) || dateStr.includes(term) || deptName.includes(term);
  });

  const completedCount = historyAppointments.filter(a => a.status === "completed").length;
  const noShowCount = historyAppointments.filter(a => a.status === "no-show").length;
  const ratings = historyAppointments.filter(a => a.status === "completed" && a.rating > 0).map(a => a.rating);
  const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "N/A";

  const handleSectorCancel = async (appointmentId: string, schoolUserId: string, apptDeptId: string) => {
    const reason = window.prompt("Digite o motivo do cancelamento (Obrigatório para notificar a escola):");
    if (!reason || reason.trim() === "") {
      if (reason !== null) toast({ title: "Justificativa Ausente", variant: "destructive" });
      return;
    }
    try {
      await supabase.from("appointments").update({ status: "cancelled", cancel_reason: reason }).eq("id", appointmentId);

      const dName = getDeptName(apptDeptId);
      await supabase.from("notifications").insert({
        user_id: schoolUserId,
        title: `Cancelamento: Setor ${dName}`,
        message: `O setor ${dName} cancelou o seu agendamento. Motivo: ${reason}`
      });

      toast({ title: "Sucesso", description: "Agendamento cancelado e escola notificada." });
      fetchData();
    } catch (error: any) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
  };

  const handleMarkNoShow = async (appointmentId: string) => {
    if (!window.confirm("Confirmar que a escola faltou ao atendimento?")) return;
    try {
      const { error } = await supabase.from("appointments").update({ status: "no-show" }).eq("id", appointmentId);
      if (error) throw error; 
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
      const { error } = await supabase.from("appointments").update({ status: "completed", department_notes: departmentNotes }).eq("id", selectedApptId);
      if (error) throw error;
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

  const renderAppointmentCard = (appt: CoordinatorAppointment, type: "delays" | "today" | "history") => {
    const schoolName = appt.profiles?.unidades_escolares?.nome_escola || "Escola não identificada";
    const schoolPhone = appt.profiles?.unidades_escolares?.telefone || "";
    const directorName = appt.profiles?.name || appt.profiles?.email || "Sem nome";
    const directorPhone = appt.profiles?.telefone || appt.profiles?.whatsapp || "";
    const deptName = getDeptName(appt.timeslots.department_id);

    return (
      <Card key={appt.id} className={`overflow-hidden ${type === "delays" ? "border-l-4 border-l-red-500 bg-red-50/30" : ""}`}>
        <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between gap-4">
          <div className="space-y-4 flex-1">

            {/* Cabeçalho */}
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200 shadow-sm border-indigo-200" variant="secondary">
                <Briefcase className="w-3 h-3 mr-1" />
                {deptName}
              </Badge>
              <h3 className="font-semibold text-lg flex items-center gap-2 text-slate-800">
                <Building className="w-5 h-5 text-slate-400" />
                {schoolName}
              </h3>
              {statusBadge(appt.status)}
              {type === "delays" && <Badge variant="destructive" className="flex gap-1 bg-red-600"><AlertCircle className="w-3 h-3" /> Atrasado</Badge>}
            </div>

            {/* Faixa de Contactos */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 text-sm bg-white p-3 rounded-md border border-slate-200">
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
                {appt.cancel_reason && <div className="bg-red-50 text-red-800 text-sm p-3 rounded-md border border-red-100"><strong>Motivo Cancelamento:</strong> {appt.cancel_reason}</div>}
                {appt.department_notes && <div className="bg-slate-50 text-slate-700 text-sm p-3 rounded-md border border-slate-200"><strong>Nossa Anotação:</strong> {appt.department_notes}</div>}
                {appt.rating > 0 && (
                  <div className="mt-2 p-3 rounded-md border-l-4 border-y border-r flex flex-col gap-2 bg-slate-50 border-slate-300">
                    <div className="flex items-center gap-2">
                      <strong className="font-semibold text-sm">Avaliação da Escola (Média {appt.rating}/5):</strong>
                    </div>
                    <div className="text-sm italic">"{appt.school_notes || "Nenhum comentário preenchido."}"</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botões de Ação */}
          {appt.status === "active" && type !== "history" && (
            <div className="flex flex-col gap-2 min-w-[150px] justify-start mt-2 sm:mt-0">
              {new Date(appt.timeslots.start_time) > now ? (
                <Button variant="destructive" size="sm" className="w-full" onClick={() => handleSectorCancel(appt.id, appt.requester_id, appt.timeslots.department_id)}>Cancelar</Button>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel Geral do Coordenador</h1>
          <p className="text-muted-foreground">Monitoria Multi-Setores</p>
        </div>
        <div className="w-full sm:w-64">
          <Select value={selectedDeptFilter} onValueChange={setSelectedDeptFilter}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Filtrar por Setor..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Setores ({coordinatorDepts.length})</SelectItem>
              {coordinatorDepts.map((d: any) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {coordinatorDepts.length === 0 ? (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-amber-500" />
            <h2 className="text-lg font-semibold text-amber-800">Nenhum Setor Atribuído</h2>
            <p className="text-amber-700">Você não possui setores associados ao seu perfil de coordenador. Contate o administrador.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avaliação Média</CardTitle></CardHeader><CardContent className="text-3xl font-bold flex items-center gap-2">{avgRating} <Star className="w-6 h-6 fill-amber-400 text-amber-400" /></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Atendimentos Concluídos</CardTitle></CardHeader><CardContent className="text-3xl font-bold text-green-600">{completedCount}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Taxa de Faltas (No-Show)</CardTitle></CardHeader><CardContent className="text-3xl font-bold text-red-600">{noShowCount}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total de Vagas Abertas</CardTitle></CardHeader><CardContent className="text-3xl font-bold text-indigo-600">{stats.availableSlots}</CardContent></Card>
          </div>

          <Tabs defaultValue="today" className="w-full">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 mb-10 sm:mb-6 h-auto p-1 py-1.5">
              <TabsTrigger value="delays" className="relative py-2 data-[state=active]:bg-red-50 data-[state=active]:text-red-700">
                Atrasos de Setores 
                {delaysAppointments.length > 0 && <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white font-bold animate-pulse">{delaysAppointments.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="today" className="py-2">Movimento de Hoje</TabsTrigger>
              <TabsTrigger value="history" className="py-2">Auditoria Geral</TabsTrigger>
            </TabsList>

            <TabsContent value="delays" className="space-y-4">
              {delaysAppointments.length === 0 ? <p className="text-center text-muted-foreground py-8">Nenhum agendamento atrasado neste momento.</p> : delaysAppointments.map(a => renderAppointmentCard(a, "delays"))}
            </TabsContent>

            <TabsContent value="today" className="space-y-4">
              {todayAppointments.length === 0 ? <p className="text-center text-muted-foreground py-8">Nenhum agendamento ativo marcado para hoje.</p> : todayAppointments.map(a => renderAppointmentCard(a, "today"))}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por escola, diretor, pauta, status ou setor..."
                  className="pl-9 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {filteredHistory.length === 0 ? <p className="text-center text-muted-foreground py-8">Nenhum histórico encontrado.</p> : filteredHistory.map(a => renderAppointmentCard(a, "history"))}
            </TabsContent>
          </Tabs>
        </>
      )}

      <Dialog open={isCompleteModalOpen} onOpenChange={setIsCompleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir Atendimento</DialogTitle>
            <DialogDescription>A escola será notificada da conclusão.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Anotações do Coordenador/Setor</label>
              <Textarea
                placeholder="Ex: Assunto resolvido conforme protocolo..."
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
