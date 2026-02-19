import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, CalendarDays, School, Users, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, departments: 0, appointments: 0, schools: 0 });
  const [appointments, setAppointments] = useState<any[]>([]);

  const fetchData = async () => {
    const [users, departments, appointmentsCount, schools] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("departments").select("id", { count: "exact", head: true }),
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("unidades_escolares").select("id", { count: "exact", head: true }),
    ]);
    setStats({
      users: users.count ?? 0,
      departments: departments.count ?? 0,
      appointments: appointmentsCount.count ?? 0,
      schools: schools.count ?? 0,
    });

    const { data } = await supabase
      .from("appointments")
      .select("*, timeslots!inner(*, departments(*)), profiles!appointments_requester_id_fkey(*)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(50);
    setAppointments(data || []);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCancel = async (id: string) => {
    const { error } = await supabase.from("appointments").update({ status: "cancelled" as const }).eq("id", id);
    if (error) { toast({ title: "Erro ao cancelar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Agendamento cancelado" });
    fetchData();
  };

  const cards = [
    { title: "Total de Usuários", value: stats.users, icon: Users, color: "text-primary" },
    { title: "Setores", value: stats.departments, icon: Building2, color: "text-secondary" },
    { title: "Agendamentos Ativos", value: stats.appointments, icon: CalendarDays, color: "text-success" },
    { title: "Unidades Escolares", value: stats.schools, icon: School, color: "text-warning" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
        <p className="text-muted-foreground">Visão geral do sistema de agendamento</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agendamentos Ativos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {appointments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum agendamento ativo.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((appt) => (
                    <TableRow key={appt.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(appt.timeslots.start_time), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{appt.timeslots?.departments?.name || "—"}</TableCell>
                      <TableCell>{appt.profiles?.name || appt.profiles?.email || "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{appt.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20">Ativo</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleCancel(appt.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
