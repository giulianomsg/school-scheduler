import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, CheckCircle, XCircle } from "lucide-react";

export default function SchoolDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ active: 0, cancelled: 0, total: 0 });

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [active, cancelled] = await Promise.all([
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("requester_id", user.id).eq("status", "active"),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("requester_id", user.id).eq("status", "cancelled"),
      ]);
      setStats({
        active: active.count ?? 0,
        cancelled: cancelled.count ?? 0,
        total: (active.count ?? 0) + (cancelled.count ?? 0),
      });
    };
    fetch();
  }, [user]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Bem-vindo(a), {profile?.name || "Diretor(a)"}</h1>
        <p className="text-muted-foreground">{profile?.school_unit || "Painel da Escola"}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Agendamentos</CardTitle>
            <CalendarDays className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ativos</CardTitle>
            <CheckCircle className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats.active}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cancelados</CardTitle>
            <XCircle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats.cancelled}</div></CardContent>
        </Card>
      </div>
    </div>
  );
}
