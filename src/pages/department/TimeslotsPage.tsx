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
      .select("*, appointments(id)")
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

    if (slotsToInsert.length === 0) {
      if (skippedPastCount > 0 || skippedAdvanceCount > 0) {
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
      const { error } = await supabase.from("timeslots").insert(slotsToInsert);
      if (error) throw error;

      const daysCount = datesToProcess.length;
      const bufferInfo = bufferMins > 0 ? ` com ${bufferMins} min de intervalo para deslocamento` : "";
      toast({
        title: "Agenda Gerada com Sucesso!",
        description: creationMode === "single"
          ? `Foram disponibilizadas ${slotsToInsert.length} vagas de ${durationMins} minutos${bufferInfo}.`
          : `Foram disponibilizadas ${slotsToInsert.length} vagas de ${durationMins} minutos${bufferInfo} distribuídas em ${daysCount} dia(s).`,
      });

      setStartTime("");
      setEndTime("");
      fetchTimeslots(departmentId);
    } catch (error: any) {
      toast({ title: "Erro", description: translateError(error), variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja apagar este horário?")) return;

    try {
      const { error } = await supabase.from("timeslots").delete().eq("id", id);
      if (error) throw error;

      toast({ title: "Sucesso", description: "Horário apagado." });
      fetchTimeslots(departmentId!);
    } catch (error: any) {
      toast({ title: "Erro", description: "Não é possível apagar um horário que já possui histórico.", variant: "destructive" });
    }
  };

  const handleBulkDeleteExpired = async () => {
    if (!window.confirm("Deseja apagar os horários expirados órfãos (que nunca tiveram agendamento)? Esta ação é irreversível.")) return;

    // 💡 CORREÇÃO 2: Só apaga os que estão no passado, livres, e SEM histórico (appointments vazio)
    const expiredUnusedIds = timeslots
      .filter(t => isPast(parseISO(t.start_time)) && t.is_available === true && (!t.appointments || t.appointments.length === 0))
      .map(t => t.id);

    if (expiredUnusedIds.length === 0) {
      toast({ title: "Atenção", description: "Todos os horários expirados possuem histórico no banco de dados e não podem ser apagados por segurança." });
      return;
    }

    try {
      const { error } = await supabase.from("timeslots").delete().in('id', expiredUnusedIds);
      if (error) throw error;

      toast({ title: "Limpeza concluída", description: `${expiredUnusedIds.length} horários ociosos foram apagados com sucesso.` });
      fetchTimeslots(departmentId!);
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
    // 💡 CORREÇÃO 3: Define se a vaga já teve alguém associado a ela
    const hasHistory = slot.appointments && slot.appointments.length > 0;

    return (
      <div className={`flex items-center justify-between p-3 border rounded-md mb-2 ${slot.is_available ? 'bg-white' : 'bg-slate-50 border-slate-200 opacity-80'}`}>
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2 rounded-md">
            <Clock className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">
              {format(new Date(slot.start_time), "HH:mm")} - {format(new Date(slot.end_time), "HH:mm")}
            </p>
            {slot.is_available ? (
              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 mr-2">
                {/* Etiqueta inteligente: avisa o porquê de não poder ser apagado */}
                {hasHistory ? "Reciclado (Livre)" : "Livre"}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-500 border-slate-200 mr-2">Reservado</Badge>
            )}
            {slot.requires_24h_advance && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 mt-1 inline-flex w-fit">
                <ShieldAlert className="w-3 h-3 mr-1" />
                Requer 24h
              </Badge>
            )}
          </div>
        </div>

        {/* Lixeira só renderiza se estiver Livre E nunca tiver tido agendamentos */}
        {slot.is_available && !hasHistory && (
          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(slot.id)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  };

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

      <Card className="border-indigo-100 shadow-sm">
        <CardHeader className="bg-indigo-50/50 pb-4">
          <CardTitle className="flex items-center gap-2 text-indigo-800">
            <CalendarPlus className="w-5 h-5" />
            Adicionar Expediente
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Seletor de Modo de Criação */}
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

            {/* Inputs de Data conforme modo */}
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
    </div>
  );
}