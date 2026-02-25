import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Clock, CalendarDays, Building2, Star, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

export default function MyAppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados da Avaliação (Rating)
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [schoolNotes, setSchoolNotes] = useState("");

  const fetchAppointments = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("appointments")
      .select("*, timeslots!inner(start_time, end_time, department_id, departments(name))")
      .eq("requester_id", user.id)
      .order("timeslots(start_time)", { ascending: false });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setAppointments(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAppointments();
  }, [user]);

  const handleCancel = async (id: string, startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < 2) {
      toast({ title: "Atenção", description: "Faltam menos de 2 horas. O cancelamento não é mais permitido.", variant: "destructive" });
      return;
    }

    if (!window.confirm("Deseja realmente cancelar este agendamento?")) return;

    try {
      await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
      
      // DISPARA A NOTIFICAÇÃO (Com som) PARA TODOS DO SETOR
      const appt = appointments.find(a => a.id === id);
      if (appt && appt.timeslots?.department_id) {
         const { data: deptUsers } = await supabase.from("profiles").select("id").eq("department_id", appt.timeslots.department_id);
         if (deptUsers && deptUsers.length > 0) {
             const notes = deptUsers.map(u => ({
                 user_id: u.id,
                 title: "Cancelamento de Reunião",
                 message: "A escola cancelou o atendimento que estava agendado."
             }));
             await supabase.from("notifications").insert(notes);
         }
      }

      toast({ title: "Sucesso", description: "Agendamento cancelado." });
      fetchAppointments();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const openRatingModal = (id: string) => {
    setSelectedApptId(id);
    setRating(0);
    setSchoolNotes("");
    setIsRatingModalOpen(true);
  };

  const submitRating = async () => {
    if (rating === 0) {
      toast({ title: "Atenção", description: "Por favor, selecione uma nota de 1 a 5 estrelas.", variant: "destructive" });
      return;
    }

    try {
      await supabase.from("appointments").update({ rating, school_notes: schoolNotes }).eq("id", selectedApptId);
      
      // DISPARA NOTIFICAÇÃO (Sem som) PARA TODOS DO SETOR
      const appt = appointments.find(a => a.id === selectedApptId);
      if (appt && appt.timeslots?.department_id) {
         const { data: deptUsers } = await supabase.from("profiles").select("id").eq("department_id", appt.timeslots.department_id);
         if (deptUsers && deptUsers.length > 0) {
             const notes = deptUsers.map(u => ({
                 user_id: u.id,
                 title: "Nova Avaliação Recebida",
                 message: `A escola avaliou o atendimento com ${rating} estrelas.`
             }));
             await supabase.from("notifications").insert(notes);
         }
      }

      toast({ title: "Obrigado!", description: "A sua avaliação foi salva com sucesso." });
      setIsRatingModalOpen(false);
      fetchAppointments();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Ativo</Badge>;
      case "completed": return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Concluído</Badge>;
      case "cancelled": return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Cancelado</Badge>;
      case "no-show": return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Falta</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meus Agendamentos</h1>
        <p className="text-muted-foreground">Acompanhe os seus agendamentos junto aos setores da Secretaria.</p>
      </div>

      {loading ? (
        <p className="text-center py-8 text-muted-foreground">Carregando seus agendamentos...</p>
      ) : appointments.length === 0 ? (
        <Card className="border-dashed bg-slate-50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-slate-500 space-y-3">
            <CalendarDays className="w-12 h-12 text-slate-300" />
            <p>Nenhum agendamento encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {appointments.map((appt) => (
            <Card key={appt.id} className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-50 p-2 rounded-md">
                        <Building2 className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-slate-800">{appt.timeslots?.departments?.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusBadge(appt.status)}
                          <span className="flex items-center text-sm text-slate-500 gap-1.5">
                            <Clock className="w-4 h-4" />
                            {format(new Date(appt.timeslots.start_time), "dd/MM/yyyy 'às' HH:mm")}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 p-3 rounded-md border border-slate-100">
                      <p className="text-sm text-slate-700"><strong>Pauta:</strong> {appt.description}</p>
                      {appt.cancel_reason && <p className="text-sm text-red-600 mt-2"><strong>Motivo Cancelamento:</strong> {appt.cancel_reason}</p>}
                    </div>

                    {appt.rating > 0 && (
                       <div className="flex items-center gap-2 text-sm text-amber-600 font-medium pt-2">
                         <CheckCircle className="w-4 h-4" /> Avaliado ({appt.rating}/5 estrelas)
                       </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 min-w-[140px] justify-center">
                    {appt.status === "active" && (
                      <Button variant="outline" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleCancel(appt.id, appt.timeslots.start_time)}>
                        <XCircle className="w-4 h-4 mr-2" /> Cancelar
                      </Button>
                    )}
                    {appt.status === "completed" && appt.rating === 0 && (
                      <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => openRatingModal(appt.id)}>
                        <Star className="w-4 h-4 mr-2 fill-white" /> Avaliar Setor
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Avaliação */}
      <Dialog open={isRatingModalOpen} onOpenChange={setIsRatingModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avaliar Atendimento</DialogTitle>
            <DialogDescription className="hidden">Deixe sua nota para o setor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-3 flex flex-col items-center">
              <label className="text-sm font-medium text-slate-700">Como foi o atendimento?</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setRating(star)} className="focus:outline-none transition-transform hover:scale-110">
                    <Star className={`w-8 h-8 ${rating >= star ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Comentário (Opcional)</label>
              <Textarea placeholder="Deixe um elogio ou sugestão..." value={schoolNotes} onChange={(e) => setSchoolNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRatingModalOpen(false)}>Cancelar</Button>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={submitRating}>Enviar Avaliação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}