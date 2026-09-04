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
import { translateError } from "@/lib/errorTranslations";

interface Appointment {
  id: string;
  requester_id: string;
  status: string;
  description: string;
  rating?: number;
  rating_cordialidade?: number;
  rating_comunicacao?: number;
  rating_organizacao?: number;
  rating_impressao?: number;
  school_notes?: string;
  department_notes?: string;
  cancel_reason?: string;
  created_at?: string;
  requested_attendant?: { name: string } | null;
  timeslots: {
    start_time: string;
    department_id: string;
    departments: { name: string; };
  };
  [key: string]: unknown; // fallback for missing fields
}

import { checkAppointmentConflict, type ConflictResult } from "@/lib/conflictUtils";

export default function MyAppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  // Specific Ratings
  const [ratingCordialidade, setRatingCordialidade] = useState<number>(0);
  const [ratingComunicacao, setRatingComunicacao] = useState<number>(0);
  const [ratingOrganizacao, setRatingOrganizacao] = useState<number>(0);
  const [ratingImpressao, setRatingImpressao] = useState<number>(0);

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
      toast({ title: "Erro", description: translateError(error), variant: "destructive" });
    } else {
      setAppointments(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const conflictMap = useMemo(() => {
    const map: Record<string, ConflictResult> = {};
    const activeAppts = appointments.filter((a) => a.status === "active");
    for (const appt of activeAppts) {
      if (!appt.timeslots) continue;
      const res = checkAppointmentConflict(appt.id, appt.timeslots, activeAppts as any[], 15);
      if (res.hasConflict) {
        map[appt.id] = res;
      }
    }
    return map;
  }, [appointments]);

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

      const appt = appointments.find(a => a.id === id);
      if (appt && appt.timeslots?.department_id) {

        // 💡 BUSCA O NOME DA ESCOLA DO USUÁRIO LOGADO
        const { data: profile } = await supabase
          .from("profiles")
          .select("unidades_escolares(nome_escola)")
          .eq("id", user?.id)
          .single();

        const schoolName = profile?.unidades_escolares?.nome_escola || "Uma escola";

        const { data: deptUsers } = await supabase.from("profiles").select("id").eq("department_id", appt.timeslots.department_id);
        if (deptUsers && deptUsers.length > 0) {
          const notes = deptUsers.map(u => ({
            user_id: u.id,
            title: "Cancelamento de Reunião",
            // 💡 MENSAGEM ATUALIZADA: Exibe o nome da escola
            message: `A escola ${schoolName} cancelou o atendimento que estava agendado.`
          }));
          await supabase.from("notifications").insert(notes);
        }
      }

      toast({ title: "Sucesso", description: "Agendamento cancelado." });
      fetchAppointments();
    } catch (error) {
      toast({ title: "Erro", description: translateError(error), variant: "destructive" });
    }
  };

  const openRatingModal = (appt: Appointment) => {
    setSelectedAppointment(appt);
    setRatingCordialidade(appt.rating_cordialidade || 0);
    setRatingComunicacao(appt.rating_comunicacao || 0);
    setRatingOrganizacao(appt.rating_organizacao || 0);
    setRatingImpressao(appt.rating_impressao || 0);
    setSchoolNotes(appt.school_notes || "");
    setIsRatingModalOpen(true);
  };

  const submitRating = async () => {
    if (ratingCordialidade === 0 || ratingComunicacao === 0 || ratingOrganizacao === 0 || ratingImpressao === 0) {
      toast({ title: "Atenção", description: "Por favor, responda a todas as 4 perguntas de avaliação.", variant: "destructive" });
      return;
    }

    try {
      // Calculate overall average
      const averageRating = (ratingCordialidade + ratingComunicacao + ratingOrganizacao + ratingImpressao) / 4;
      // Round to nearest whole number so we can store it as smallint safely (or integer value for display)
      const roundedRating = Math.round(averageRating);

      const { error } = await supabase
        .from("appointments")
        .update({
          rating: roundedRating,
          rating_cordialidade: ratingCordialidade,
          rating_comunicacao: ratingComunicacao,
          rating_organizacao: ratingOrganizacao,
          rating_impressao: ratingImpressao,
          school_notes: schoolNotes
        })
        .eq("id", selectedAppointment.id);

      if (error) throw error;

      toast({ title: "Sucesso", description: "Avaliação salva com sucesso!" });
      setIsRatingModalOpen(false);
      fetchAppointments(); // Atualiza a tela

    } catch (error) {
      toast({ title: "Erro", description: translateError(error), variant: "destructive" });
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
                    {conflictMap[appt.id]?.hasConflict && (
                      <Badge variant="destructive" className="bg-red-600 text-white font-semibold animate-pulse">
                        ⚠️ Choque de Horário
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{appt.description}</p>
                  <p className="text-sm font-medium">
                    {format(new Date(appt.timeslots.start_time), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </p>

                  {/* Alerta Visual de Conflito */}
                  {conflictMap[appt.id]?.hasConflict && (
                    <div className="bg-red-50 border border-red-200 text-red-900 p-3 rounded-md text-xs space-y-1 my-2">
                      <p className="font-semibold flex items-center gap-1.5 text-red-800">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        Choque de horário identificado!
                      </p>
                      <p>{conflictMap[appt.id].message}</p>
                      <p className="text-[11px] text-red-700 italic">O setor responsável pode ajustar o horário para sanar este conflito.</p>
                    </div>
                  )}

                  {/* Exibição do Atendente Solicitado (Opcional) */}
                  {appt.requested_attendant && (
                    <div className="inline-flex items-center gap-1 mt-1">
                      <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                        Atendente Solicitado: {appt.requested_attendant.name}
                      </Badge>
                    </div>
                  )}

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
                      onClick={() => handleCancel(appt.id, appt.timeslots.start_time)}
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
          <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto px-2">

            {/* 1 - Cordialidade e Postura */}
            <div className="flex flex-col gap-2">
              <h4 className="font-semibold text-sm">1. Cordialidade e Postura</h4>
              <ul className="text-xs text-muted-foreground list-disc pl-4 mb-2">
                <li>O atendimento foi realizado com cordialidade e respeito.</li>
                <li>O(a) servidor(a) que lhe atendeu, demonstrou postura profissional durante todo o atendimento.</li>
              </ul>
              <div className="flex flex-col gap-1 text-sm pl-2">
                {[
                  { value: 5, label: "Excelente" },
                  { value: 4, label: "Bom" },
                  { value: 3, label: "Regular" },
                  { value: 2, label: "Ruim" },
                  { value: 1, label: "Péssimo" },
                ].map((option) => (
                  <label key={`cordialidade-${option.value}`} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cordialidade"
                      value={option.value}
                      checked={ratingCordialidade === option.value}
                      onChange={() => setRatingCordialidade(option.value)}
                      className="accent-amber-500 w-4 h-4 cursor-pointer"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            {/* 2 - Comunicação */}
            <div className="flex flex-col gap-2">
              <h4 className="font-semibold text-sm">2. Comunicação</h4>
              <ul className="text-xs text-muted-foreground list-disc pl-4 mb-2">
                <li>As informações foram transmitidas de forma clara e objetiva.</li>
                <li>O(a) servidor(a) que lhe atendeu, demonstrou atenção e escuta ativa durante o atendimento.</li>
                <li>As orientações foram apresentadas de maneira compreensível.</li>
              </ul>
              <div className="flex flex-col gap-1 text-sm pl-2">
                {[
                  { value: 5, label: "Excelente" },
                  { value: 4, label: "Bom" },
                  { value: 3, label: "Regular" },
                  { value: 2, label: "Ruim" },
                  { value: 1, label: "Péssimo" },
                ].map((option) => (
                  <label key={`comunicacao-${option.value}`} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="comunicacao"
                      value={option.value}
                      checked={ratingComunicacao === option.value}
                      onChange={() => setRatingComunicacao(option.value)}
                      className="accent-amber-500 w-4 h-4 cursor-pointer"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            {/* 3 - Organização e Eficiência no Atendimento */}
            <div className="flex flex-col gap-2">
              <h4 className="font-semibold text-sm">3. Organização e Eficiência no Atendimento</h4>
              <ul className="text-xs text-muted-foreground list-disc pl-4 mb-2">
                <li>O atendimento ocorreu de forma organizada.</li>
                <li>O tempo dedicado ao atendimento foi adequado.</li>
                <li>O(a) servidor(a) que lhe atendeu, demonstrou preparo no momento do atendimento.</li>
              </ul>
              <div className="flex flex-col gap-1 text-sm pl-2">
                {[
                  { value: 5, label: "Excelente" },
                  { value: 4, label: "Bom" },
                  { value: 3, label: "Regular" },
                  { value: 2, label: "Ruim" },
                  { value: 1, label: "Péssimo" },
                ].map((option) => (
                  <label key={`organizacao-${option.value}`} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="organizacao"
                      value={option.value}
                      checked={ratingOrganizacao === option.value}
                      onChange={() => setRatingOrganizacao(option.value)}
                      className="accent-amber-500 w-4 h-4 cursor-pointer"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            {/* 4 - Impressão Geral */}
            <div className="flex flex-col gap-2">
              <h4 className="font-semibold text-sm">4. Impressão Geral</h4>
              <ul className="text-xs text-muted-foreground list-disc pl-4 mb-2">
                <li>Senti-me respeitado(a) durante o atendimento.</li>
                <li>Considero o atendimento recebido satisfatório.</li>
              </ul>
              <div className="flex flex-col gap-1 text-sm pl-2">
                {[
                  { value: 5, label: "Excelente" },
                  { value: 4, label: "Bom" },
                  { value: 3, label: "Regular" },
                  { value: 2, label: "Ruim" },
                  { value: 1, label: "Péssimo" },
                ].map((option) => (
                  <label key={`impressao-${option.value}`} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="impressao"
                      value={option.value}
                      checked={ratingImpressao === option.value}
                      onChange={() => setRatingImpressao(option.value)}
                      className="accent-amber-500 w-4 h-4 cursor-pointer"
                    />
                    {option.label}
                  </label>
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