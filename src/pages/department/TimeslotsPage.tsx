import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, Clock, Trash2, CalendarPlus, AlertCircle } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

export default function TimeslotsPage() {
  const { user } = useAuth();
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [timeslots, setTimeslots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados do Formulário
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const fetchTimeslots = async () => {
    if (!user) return;
    setLoading(true);

    const { data: profile } = await supabase.from("profiles").select("department_id").eq("id", user.id).single();
    
    if (profile?.department_id) {
      setDepartmentId(profile.department_id);
      
      const { data: slots, error } = await supabase
        .from("timeslots")
        .select("*")
        .eq("department_id", profile.department_id)
        .order("start_time", { ascending: true });

      if (error) {
        toast({ title: "Erro ao buscar horários", description: error.message, variant: "destructive" });
      } else {
        setTimeslots(slots || []);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTimeslots();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!departmentId || !date || !startTime || !endTime) return;

    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);

    if (startDateTime < new Date()) {
      toast({ title: "Atenção", description: "Não é possível criar horários no passado.", variant: "destructive" });
      return;
    }

    if (endDateTime <= startDateTime) {
      toast({ title: "Atenção", description: "O horário de término deve ser após o início.", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.from("timeslots").insert({
        department_id: departmentId,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        is_available: true,
      });

      if (error) throw error;

      toast({ title: "Sucesso", description: "Horário criado com sucesso!" });
      setStartTime("");
      setEndTime("");
      fetchTimeslots();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja apagar este horário?")) return;

    try {
      const { error } = await supabase.from("timeslots").delete().eq("id", id);
      if (error) throw error;

      toast({ title: "Sucesso", description: "Horário apagado." });
      fetchTimeslots();
    } catch (error: any) {
      toast({ title: "Erro", description: "Não é possível apagar um horário que já possui agendamentos vinculados.", variant: "destructive" });
    }
  };

  const handleBulkDeleteExpired = async () => {
    if (!window.confirm("Deseja apagar todos os horários expirados que não foram agendados? Esta ação é irreversível.")) return;

    const expiredUnusedIds = timeslots
      .filter(t => isPast(parseISO(t.start_time)) && t.is_available === true)
      .map(t => t.id);

    if (expiredUnusedIds.length === 0) {
      toast({ title: "Atenção", description: "Nenhum horário expirado disponível para limpeza." });
      return;
    }

    try {
      const { error } = await supabase.from("timeslots").delete().in('id', expiredUnusedIds);
      if (error) throw error;
      
      toast({ title: "Limpeza concluída", description: `${expiredUnusedIds.length} horários foram apagados com sucesso.` });
      fetchTimeslots();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  // ==========================================
  // AGRUPAMENTO E ORGANIZAÇÃO (LÓGICA CLIENT-SIDE)
  // ==========================================
  const now = new Date();

  // Separa em Futuros e Expirados
  const futureSlots = timeslots.filter(t => new Date(t.start_time) >= now);
  const pastSlots = timeslots.filter(t => new Date(t.start_time) < now);

  // Função para agrupar array de horários por Dia
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

  // Componente de Renderização do Cartão de Horário
  const SlotCard = ({ slot }: { slot: any }) => (
    <div className={`flex items-center justify-between p-3 border rounded-md mb-2 ${slot.is_available ? 'bg-white' : 'bg-slate-50 border-slate-200 opacity-80'}`}>
      <div className="flex items-center gap-3">
        <div className="bg-indigo-50 p-2 rounded-md">
          <Clock className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <p className="font-semibold text-slate-800">
            {format(new Date(slot.start_time), "HH:mm")} - {format(new Date(slot.end_time), "HH:mm")}
          </p>
          <div className="mt-1">
            {slot.is_available ? (
              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Livre</Badge>
            ) : (
              <Badge variant="outline" className="text-slate-500 border-slate-200">Reservado</Badge>
            )}
          </div>
        </div>
      </div>
      
      {/* Botão de Apagar só aparece se estiver livre */}
      {slot.is_available && (
        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(slot.id)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-10 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gerenciamento de Horários</h1>
        <p className="text-muted-foreground">Disponibilize vagas para as escolas agendarem no seu setor.</p>
      </div>

      <Card className="border-indigo-100 shadow-sm">
        <CardHeader className="bg-indigo-50/50 pb-4">
          <CardTitle className="flex items-center gap-2 text-indigo-800">
            <CalendarPlus className="w-5 h-5" />
            Adicionar Novo Horário
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row items-end gap-4">
            <div className="space-y-2 w-full">
              <label className="text-sm font-medium">Data do Atendimento</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required min={format(now, "yyyy-MM-dd")} />
            </div>
            <div className="space-y-2 w-full">
              <label className="text-sm font-medium">Hora de Início</label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div className="space-y-2 w-full">
              <label className="text-sm font-medium">Hora de Fim</label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700">
              Criar Vaga
            </Button>
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

          {/* ABA 1: FUTUROS */}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {futureGrouped[dateKey].map((slot: any) => (
                      <SlotCard key={slot.id} slot={slot} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* ABA 2: EXPIRADOS */}
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
              // Mostra os expirados do mais recente para o mais antigo
              Object.keys(pastGrouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).map(dateKey => (
                <div key={dateKey} className="mb-6 opacity-75">
                  <h3 className="font-bold text-slate-500 mb-3 flex items-center gap-2 border-b pb-2">
                    <CalendarDays className="w-4 h-4" />
                    {format(parseISO(dateKey), "dd/MM/yyyy", { locale: ptBR })}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
    </div>
  );
}