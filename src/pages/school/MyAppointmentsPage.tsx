import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Star } from "lucide-react";

export default function MyAppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingApptId, setRatingApptId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [schoolNotes, setSchoolNotes] = useState("");
  const [savingRating, setSavingRating] = useState(false);

  const fetchAppointments = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("appointments")
      .select("*, timeslots!inner(*, departments(*))")
      .eq("requester_id", user.id)
      .order("created_at", { ascending: false });
    setAppointments(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAppointments(); }, [user]);

const handleCancel = async (appointmentId: string, startTime: string, departmentId: string) => {
    // 1. Verificação de Cooldown (2 horas)
    const appointmentTime = new Date(startTime).getTime();
    const now = new Date().getTime();
    const hoursDifference = (appointmentTime - now) / (1000 * 60 * 60);

    if (hoursDifference < 2 && hoursDifference > 0) {
      toast({
        title: "Ação não permitida",
        description: "Cancelamentos só podem ser feitos com pelo menos 2 horas de antecedência.",
        variant: "destructive",
      });
      return;
    }

    if (!window.confirm("Tem certeza que deseja cancelar este agendamento?")) return;

    try {
      // 2. Cancela o agendamento
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled", cancel_reason: "Cancelado pela Escola" })
        .eq("id", appointmentId);

      if (error) throw error;

      // 3. (Opcional) Retorna o horário para disponível
      // (Se a sua trigger de banco de dados não faz isso automaticamente)
      // await supabase.from('timeslots').update({ is_available: true }).eq('id', timeslotId);

      // 4. Notifica o Departamento
      // Busca todos os funcionários do setor
      const { data: deptUsers } = await supabase
        .from("profiles")
        .select("id")
        .eq("department_id", departmentId);

      if (deptUsers) {
        const notifications = deptUsers.map(u => ({
          user_id: u.id,
          title: "Cancelamento de Escola",
          message: "Uma escola cancelou um agendamento.",
        }));
        await supabase.from("notifications").insert(notifications);
      }

      toast({ title: "Sucesso", description: "Agendamento cancelado." });
      // Chame sua função de recarregar a lista aqui (ex: fetchAppointments())
      
    } catch (error: any) {
      toast({ title: "Erro ao cancelar", description: error.message, variant: "destructive" });
    }
  };

  const handleSubmitRating = async () => {
    if (!ratingApptId || ratingValue === 0) {
      toast({ title: "Selecione uma nota", description: "Clique nas estrelas para avaliar.", variant: "destructive" });
      return;
    }
    setSavingRating(true);
    const { error } = await supabase
      .from("appointments")
      .update({ rating: ratingValue, school_notes: schoolNotes || null })
      .eq("id", ratingApptId);
    setSavingRating(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Avaliação salva!", description: "Obrigado pelo seu feedback." });
    setRatingOpen(false);
    setRatingApptId(null);
    setRatingValue(0);
    setSchoolNotes("");
    fetchAppointments();
  };

  const openRatingDialog = (apptId: string) => {
    setRatingApptId(apptId);
    setRatingValue(0);
    setSchoolNotes("");
    setRatingOpen(true);
  };

  const renderStars = (count: number, interactive: boolean, onSelect?: (n: number) => void) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-6 w-6 ${n <= count ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"} ${interactive ? "cursor-pointer hover:scale-110 transition-transform" : ""}`}
          onClick={interactive && onSelect ? () => onSelect(n) : undefined}
        />
      ))}
    </div>
  );

  const statusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      active: { cls: "bg-success/10 text-success border-success/20", label: "Ativo" },
      cancelled: { cls: "bg-destructive/10 text-destructive border-destructive/20", label: "Cancelado" },
      completed: { cls: "bg-emerald-100 text-emerald-700 border-emerald-300", label: "Concluído" },
      "no-show": { cls: "bg-red-100 text-red-800 border-red-300", label: "Falta" },
    };
    const s = map[status] || map.cancelled;
    return <Badge variant="outline" className={s.cls}>{s.label}</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meus Agendamentos</h1>
        <p className="text-muted-foreground">Visualize e gerencie seus agendamentos</p>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : appointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">Nenhum agendamento ainda. Agende um para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => (
            <Card key={appt.id}>
              <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{appt.timeslots?.departments?.name || "Setor"}</p>
                    {statusBadge(appt.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(appt.timeslots.start_time), "dd/MM/yyyy", { locale: ptBR })} ·{" "}
                    {format(new Date(appt.timeslots.start_time), "HH:mm")} -{" "}
                    {format(new Date(appt.timeslots.end_time), "HH:mm")}
                  </p>
                  <p className="text-sm text-muted-foreground">{appt.description}</p>
                  {appt.status === "completed" && appt.department_notes && (
                    <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
                      <span className="font-semibold">Nota do Setor:</span> {appt.department_notes}
                    </div>
                  )}
                  {appt.status === "completed" && appt.rating != null && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">Sua Avaliação:</span>
                      {renderStars(appt.rating, false)}
                      <span className="text-sm text-muted-foreground">{appt.rating}/5</span>
                    </div>
                  )}
                  {appt.status === "completed" && appt.rating != null && appt.school_notes && (
                    <p className="text-xs text-muted-foreground mt-1">Suas anotações: {appt.school_notes}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2 items-end">
                  {appt.status === "completed" && appt.rating == null && (
                    <Button variant="outline" size="sm" className="text-primary border-primary/30 hover:bg-primary/5" onClick={() => openRatingDialog(appt.id)}>
                      Avaliar Atendimento
                    </Button>
                  )}
                  {appt.status === "active" && new Date(appt.timeslots.start_time) > new Date() && (
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => handleCancel(appt.id, appt.timeslots.start_time, appt.timeslots.department_id)}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={ratingOpen} onOpenChange={setRatingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avaliar Atendimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nota</Label>
              {renderStars(ratingValue, true, setRatingValue)}
            </div>
            <div className="space-y-2">
              <Label>Suas anotações sobre o atendimento (opcional)</Label>
              <Textarea value={schoolNotes} onChange={(e) => setSchoolNotes(e.target.value)} placeholder="Escreva aqui..." />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSubmitRating} disabled={savingRating}>
              {savingRating ? "Salvando..." : "Salvar Avaliação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
