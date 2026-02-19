import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { CalendarDays, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Department = Tables<"departments">;
type Timeslot = Tables<"timeslots">;

export default function BookAppointmentPage() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("");
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
    if (!selectedDept) { setTimeslots([]); return; }
    setLoadingSlots(true);
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
  }, [selectedDept]);

  const handleBook = async () => {
    if (!user || !selectedSlot || !description.trim()) {
      toast({ title: "Selecione um horário e adicione uma descrição", variant: "destructive" });
      return;
    }
    setBooking(true);
    const { error } = await supabase.from("appointments").insert({
      timeslot_id: selectedSlot,
      requester_id: user.id,
      description,
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
            <div className="space-y-2">
              <Label>Horários Disponíveis</Label>
              {loadingSlots ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : timeslots.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum horário disponível para este setor.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {timeslots.map((ts) => (
                    <button
                      key={ts.id}
                      onClick={() => setSelectedSlot(ts.id)}
                      className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                        selectedSlot === ts.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "hover:border-primary/50"
                      }`}
                    >
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{format(new Date(ts.start_time), "dd/MM/yyyy", { locale: ptBR })}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(ts.start_time), "HH:mm")} - {format(new Date(ts.end_time), "HH:mm")}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedSlot && (
            <div className="space-y-2">
              <Label>Descrição / Motivo</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva brevemente o motivo da sua visita..."
                rows={3}
              />
            </div>
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
