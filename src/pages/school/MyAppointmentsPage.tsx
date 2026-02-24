import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";

export default function MyAppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados do Modal de Avaliação
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [rating, setRating] = useState<number>(0);
  const [schoolNotes, setSchoolNotes] = useState("");

  const fetchAppointments = async () => {
    if (!user) return;
    setLoading(true);
    
    // A query abaixo garante que TUDO seja trazido, incluindo as notas novas
    const { data, error } = await supabase
      .from("appointments")
      .select("*, timeslots!inner(*, departments(name))")
      .eq("requester_id", user.id)
      .order("created_at", { ascending: false });

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

  const handleCancel = async (appointmentId: string, startTime: string, departmentId: string) => {
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
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled", cancel_reason: "Cancelado pela Escola" })
        .eq("id", appointmentId);

      if (error) throw error;

      // Dispara a notificação para o Setor
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
      fetchAppointments(); // Recarrega a lista
      
    } catch (error: any) {
      toast({ title: "Erro ao cancelar", description: error.message, variant: "destructive" });
    }
  };

  const openRatingModal = (appt: any) => {
    setSelectedAppointment(appt);
    setRating(appt.rating || 0);
    setSchoolNotes(appt.school_notes || "");
    setIsRatingModalOpen(true);
  };

  const submitRating = async () => {
    if (rating === 0) {
      toast({ title: "Atenção", description: "Selecione pelo menos 1 estrela para avaliar.", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase
        .from("appointments")
        .update({ 
          rating: rating,
          school_notes: schoolNotes
        })
        .eq("id", selectedAppointment.id);

      if (error) throw error;

      toast({ title: "Sucesso", description: "Avaliação salva com sucesso!" });
      setIsRatingModalOpen(false);
      fetchAppointments(); // Atualiza a tela
      
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
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

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">Meus Agendamentos</h1>
      
      <div className="grid gap-4">
        {loading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : appointments.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Você ainda não possui agendamentos.
            </CardContent>
          </Card>
        ) : (
          appointments.map((appt) => (
            <Card key={appt.id}>
              <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{appt.timeslots?.departments?.name}</h3>
                    {statusBadge(appt.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">{appt.description}</p>
                  <p className="text-sm font-medium">
                    {format(new Date(appt.timeslots.start_time), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </p>
                  
                  {/* Exibição da Nota do Departamento se o status for Concluído */}
                  {appt.status === "completed" && appt.department_notes && (
                    <div className="mt-3 bg-slate-50 p-3 rounded-md border border-slate-100 text-sm">
                      <p className="font-semibold text-xs text-slate-500 mb-1">Feedback do Setor:</p>
                      <p className="text-slate-700">{appt.department_notes}</p>
                    </div>
                  )}

                  {/* Exibição do Motivo do Cancelamento */}
                  {appt.status === "cancelled" && appt.cancel_reason && (
                    <div className="mt-3 bg-red-50 p-3 rounded-md text-sm text-red-800 border border-red-100">
                      <p className="font-semibold text-xs mb-1">Motivo do Cancelamento:</p>
                      <p>{appt.cancel_reason}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 justify-start min-w-[160px]">
                  {/* Trava Visual: Oculta Cancelar se o horário já passou */}
                  {appt.status === "active" && new Date(appt.timeslots.start_time) > new Date() && (
                    <Button 
                      variant="destructive" 
                      onClick={() => handleCancel(appt.id, appt.timeslots.start_time, appt.timeslots.department_id)}
                    >
                      Cancelar
                    </Button>
                  )}

                  {/* Botão de Avaliação (Só aparece se estiver concluído) */}
                  {appt.status === "completed" && (
                    <div className="flex flex-col items-end mt-2 sm:mt-0">
                      {appt.rating ? (
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-amber-500 justify-end mb-1">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`w-4 h-4 ${i < appt.rating ? "fill-current" : "text-slate-200"}`} />
                            ))}
                          </div>
                          {appt.school_notes && <span className="text-xs text-muted-foreground">Avaliação enviada</span>}
                        </div>
                      ) : (
                        <Button variant="default" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white w-full" onClick={() => openRatingModal(appt)}>
                          <Star className="w-4 h-4 mr-2" />
                          Avaliar Atendimento
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modal de Avaliação com 5 Estrelas */}
      <Dialog open={isRatingModalOpen} onOpenChange={setIsRatingModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avaliar Atendimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">Como você avalia a resolução desta pauta?</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star}
                    className={`w-10 h-10 cursor-pointer transition-colors ${star <= rating ? "text-amber-500 fill-current" : "text-slate-200 hover:text-amber-200"}`}
                    onClick={() => setRating(star)}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Anotações da Escola (Opcional)</label>
              <Textarea 
                placeholder="Suas anotações pós-reunião ou feedback adicional..."
                value={schoolNotes}
                onChange={(e) => setSchoolNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRatingModalOpen(false)}>Cancelar</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={submitRating}>Salvar Avaliação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}