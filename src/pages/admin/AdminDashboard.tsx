import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, CalendarDays, School, Star } from "lucide-react";

interface DeptStats {
  name: string;
  completed: number;
  noShows: number;
  avgRating: number | null;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({ schools: 0, departments: 0, totalAppointments: 0, avgRating: null as number | null });
  const [deptStats, setDeptStats] = useState<DeptStats[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      // Global counts
      const [schoolsRes, deptsRes, apptsRes] = await Promise.all([
        supabase.from("unidades_escolares").select("id", { count: "exact", head: true }),
        supabase.from("departments").select("id", { count: "exact", head: true }),
        supabase.from("appointments").select("id", { count: "exact", head: true }),
      ]);

      // All appointments with department info for analytics
      const { data: allAppts } = await supabase
        .from("appointments")
        .select("status, rating, timeslots!inner(department_id, departments(name))");

      const appointments = allAppts || [];

      // Global avg rating
      const rated = appointments.filter(a => a.status === "completed" && a.rating != null);
      const globalAvg = rated.length > 0
        ? rated.reduce((sum, a) => sum + (a.rating ?? 0), 0) / rated.length
        : null;

      setStats({
        schools: schoolsRes.count ?? 0,
        departments: deptsRes.count ?? 0,
        totalAppointments: apptsRes.count ?? 0,
        avgRating: globalAvg,
      });

      // Per-department stats
      const deptMap = new Map<string, { name: string; completed: number; noShows: number; ratings: number[] }>();
      for (const appt of appointments) {
        const deptName = (appt.timeslots as any)?.departments?.name;
        const deptId = (appt.timeslots as any)?.department_id;
        if (!deptId) continue;
        if (!deptMap.has(deptId)) deptMap.set(deptId, { name: deptName || "—", completed: 0, noShows: 0, ratings: [] });
        const entry = deptMap.get(deptId)!;
        if (appt.status === "completed") {
          entry.completed++;
          if (appt.rating != null) entry.ratings.push(appt.rating);
        }
        if (appt.status === "no-show") entry.noShows++;
      }

      const result: DeptStats[] = Array.from(deptMap.values()).map(d => ({
        name: d.name,
        completed: d.completed,
        noShows: d.noShows,
        avgRating: d.ratings.length > 0 ? d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length : null,
      }));
      result.sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));
      setDeptStats(result);
    };
    fetchData();
  }, []);

  const kpis = [
    { title: "Unidades Escolares", value: stats.schools, icon: School, color: "text-primary" },
    { title: "Setores Ativos", value: stats.departments, icon: Building2, color: "text-secondary" },
    { title: "Total de Agendamentos", value: stats.totalAppointments, icon: CalendarDays, color: "text-success" },
    { title: "Nota Média Global", value: stats.avgRating != null ? stats.avgRating.toFixed(1) : "—", suffix: "/5.0", icon: Star, color: "text-yellow-500" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
        <p className="text-muted-foreground">Inteligência de negócios do sistema de agendamento</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {kpi.value}
                {"suffix" in kpi && kpi.suffix && <span className="text-base font-normal text-muted-foreground">{kpi.suffix}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Desempenho por Setor</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {deptStats.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum dado de desempenho disponível.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Setor</TableHead>
                    <TableHead className="text-center">Atendimentos</TableHead>
                    <TableHead className="text-center">Faltas</TableHead>
                    <TableHead className="text-center">Nota Média</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deptStats.map((dept) => (
                    <TableRow key={dept.name}>
                      <TableCell className="font-medium">{dept.name}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{dept.completed}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{dept.noShows}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {dept.avgRating != null ? (
                          <div className="flex items-center justify-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-medium">{dept.avgRating.toFixed(1)}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
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
