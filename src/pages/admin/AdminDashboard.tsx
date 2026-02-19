import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CalendarDays, School, Users } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, departments: 0, appointments: 0, schools: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [users, departments, appointments, schools] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("departments").select("id", { count: "exact", head: true }),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "school"),
      ]);
      setStats({
        users: users.count ?? 0,
        departments: departments.count ?? 0,
        appointments: appointments.count ?? 0,
        schools: schools.count ?? 0,
      });
    };
    fetchStats();
  }, []);

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
    </div>
  );
}
