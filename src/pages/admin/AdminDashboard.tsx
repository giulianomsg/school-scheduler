import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Clock, Users, Star, Search, AlertCircle, Phone, Building, Briefcase, Activity } from "lucide-react";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AdminDashboard() {
  const [allAppointments, setAllAppointments] = useState<any[]>([]);
  const [stats, setStats] = useState({ schools: 0, departments: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    
    // 1. Busca estatísticas globais
    const [schoolsRes, deptsRes] = await Promise.all([
      supabase.from("unidades_escolares").select("id", { count: "exact", head: true }),
      supabase.from("departments").select("id", { count: "exact", head: true })
    ]);
    
    setStats({ schools: schoolsRes.count || 0, departments: deptsRes.count || 0 });

    // 2. Busca TODOS os agendamentos com os relacionamentos complexos (Setor + Escola)
    const { data: appts } = await supabase
      .from("appointments")
      .select("*, timeslots!inner(*, departments(name)), profiles!appointments_requester_id_fkey(*, unidades_escolares(*))");

    const sortedAppts = (appts || []).sort((a, b) => 
      new Date(b.timeslots.start_time).getTime() - new Date(a.timeslots.start_time).getTime()
    );
    setAllAppointments(sortedAppts);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const now = new Date();

  // Filtros de Abas
  const pendingAppointments = allAppointments.filter(
    (appt) => appt.status === "active" && new Date(appt.timeslots.start_time) <= now
  );

  const todayAppointments = allAppointments.filter(
    (appt) => isToday(new Date(appt.timeslots.start_time))
  );

  const historyAppointments = allAppointments.filter(
    (appt) => ["completed", "cancelled", "no-show"].includes(appt.status)
  );

  // Filtro de Pesquisa Global
  const filteredHistory = historyAppointments.filter((appt) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const schoolName = (appt.profiles?.unidades_escolares?.nome_escola || "").toLowerCase();
    const directorName = (appt.profiles?.name || appt.profiles?.email || "").toLowerCase();
    const deptName = (appt.timeslots?.departments?.name || "").toLowerCase();
    const desc = (appt.description || "").toLowerCase();
    const statusText = appt.status.toLowerCase();
    const dateStr = format(new Date(appt.timeslots.start_time), "dd/MM/yyyy HH:mm").toLowerCase();
    
    return schoolName.includes(term) || directorName.includes(term) || deptName.includes(term) || desc.includes(term) || statusText.includes(term) || dateStr.includes(term);
  });

  // KPIs Globais
  const noShowCount = historyAppointments.filter(a => a.status === "no-show").length;
  const ratings = historyAppointments.filter(a => a.status === "completed" && a.rating > 0).map(a => a.rating);
  const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "N/A";

  const statusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">Ativo</Badge>;
      case "cancelled": return <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">Cancelado</Badge>;
      case "completed": return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">Concluído</Badge>;
      case "no-show": return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">Falta</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const renderAppointmentCard = (appt: any, type: "pending" | "today" | "history") => {
    const deptName = appt.timeslots?.departments?.name || "Setor Indefinido";
    const schoolName = appt.profiles?.unidades_escolares?.nome_escola || "Escola não identificada";
    const schoolPhone = appt.profiles?.unidades_escolares?.telefone || "";
    const directorName = appt.profiles?.name || appt.profiles?.email || "Sem nome";
    const directorPhone = appt.profiles?.telefone || appt.profiles?.whatsapp || "";

    return (
      <Card key={appt.id} className={`overflow-hidden ${type === "pending" ? "border-l-4 border-l-amber-500" : ""}`}>
        <CardContent className="p-4 sm:p-6 flex flex-col gap-4">
          
          {/* Identificação do Setor e Status */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 flex items-center gap-1.5 px-3 py-1 text-sm">
              <Briefcase className="w-4 h-4" />
              {deptName}
            </Badge>
            <div className="flex items-center gap-2">
              {type === "pending" && <Badge variant="destructive" className="flex gap-1"><AlertCircle className="w-3 h-3" /> Atrasado (Sem Desfecho)</Badge>}
              {statusBadge(appt.status)}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2 text-slate-800">
              <Building className="w-5 h-5 text-slate-500" />
              {schoolName}
            </h3>

            {/* Faixa de Contactos */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 text-sm bg-slate-50 p-3 rounded-md border border-slate-200">
              <div className="flex items-center gap-1.5 font-medium text-slate-700">
                <Users className="w-4 h-4 text-slate-400" />
                Diretor(a): <span className="font-normal text-slate-600">{directorName}</span>
              </div>
              {(directorPhone || schoolPhone) && (
                <div className="flex flex-wrap items-center gap-4 border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-4">
                  {directorPhone && (
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <Phone className="w-4 h-4" /> Dir: {directorPhone}
                    </span>
                  )}
                  {schoolPhone && (
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <Phone className="w-4 h-4" /> Esc: {schoolPhone}
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {/* Pauta e Data */}
            <div className="space-y-1">
              <p className="text-sm text-slate-700"><strong>Pauta:</strong> {appt.description}</p>
              <p className="text-sm font-semibold flex items-center gap-2 text-slate-600">
                <Clock className="w-4 h-4" />
                {format(new Date(appt.timeslots.start_time), "dd/MM/yyyy 'às' HH:mm")}
              </p>
            </div>

            {/* Área de Auditoria Completa */}
            {type === "history" && (
              <div className="mt-4 space-y-2">
                {appt.cancel_reason && (
                  <div className="bg-red-50 text-red-800 text-sm p-3 rounded-md border border-red-100">
                    <strong>Motivo do Cancelamento:</strong> {appt.cancel_reason}
                  </div>
                )}
                {appt.department_notes && (
                  <div className="bg-slate-50 text-slate-700 text-sm p-3 rounded-md border border-slate-200">
                    <strong>Anotação do Setor:</strong> {appt.department_notes}
                  </div>
                )}
                
                {appt.rating > 0 && (() => {
                  const isFive = appt.rating === 5;
                  const isMedium = appt.rating >= 3 && appt.rating < 5;
                  const colorClass = isFive ? "bg-green-50 border-green-500 text-green-900" : isMedium ? "bg-yellow-50 border-yellow-400 text-yellow-900" : "bg-red-50 border-red-500 text-red-900";
                  const starFillClass = isFive ? "fill-green-500 text-green-500" : isMedium ? "fill-yellow-500 text-yellow-500" : "fill-red-500 text-red-500";
                  const starEmptyClass = isFive ? "text-green-200" : isMedium ? "text-yellow-200" : "text-red-200";

                  return (
                    <div className={`mt-2 p-3 rounded-md border-l-4 border-y border-r flex flex-col gap-2 ${colorClass}`}>
                      <div className="flex items-center gap-2">
                        <strong className="font-semibold text-sm">Avaliação da Escola ({appt.rating}/5):</strong>
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`w-4 h-4 ${i < appt.rating ? starFillClass : starEmptyClass}`} />
                          ))}
                        </div>
                      </div>
                      <div className="text-sm">
                        <span className="italic">"{appt.school_notes || "Nenhum comentário preenchido."}"</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel do Administrador (Auditoria)</h1>
        <p className="text-muted-foreground">Visão global de todos os setores e atendimentos da Secretaria.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">NPS Global</CardTitle></CardHeader><CardContent className="text-3xl font-bold flex items-center gap-2">{avgRating} <Star className="w-6 h-6 fill-amber-400 text-amber-400"/></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Faltas Totais</CardTitle></CardHeader><CardContent className="text-3xl font-bold text-red-600">{noShowCount}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Escolas na Rede</CardTitle></CardHeader><CardContent className="text-3xl font-bold text-blue-600">{stats.schools}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Setores Ativos</CardTitle></CardHeader><CardContent className="text-3xl font-bold text-indigo-600">{stats.departments}</CardContent></Card>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">A carregar dados de toda a rede...</p>
      ) : (
        <Tabs defaultValue="today" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="pending" className="relative">
              Atrasos de Setores {pendingAppointments.length > 0 && <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white">{pendingAppointments.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="today">Movimento de Hoje</TabsTrigger>
            <TabsTrigger value="history">Auditoria Geral</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingAppointments.length === 0 ? <p className="text-center text-muted-foreground py-8">Nenhum setor com pendências de encerramento. Excelente!</p> : pendingAppointments.map(a => renderAppointmentCard(a, "pending"))}
          </TabsContent>

          <TabsContent value="today" className="space-y-4">
            {todayAppointments.length === 0 ? <p className="text-center text-muted-foreground py-8">Nenhum atendimento na rede hoje.</p> : todayAppointments.map(a => renderAppointmentCard(a, "today"))}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Pesquisar por escola, diretor, setor, pauta ou status..." 
                className="pl-9 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {filteredHistory.length === 0 ? <p className="text-center text-muted-foreground py-8">Nenhum registo encontrado no banco de dados.</p> : filteredHistory.map(a => renderAppointmentCard(a, "history"))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}