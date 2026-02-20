import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function TimeslotsPage() {
  const { user } = useAuth();
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [timeslots, setTimeslots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const [bulkDate, setBulkDate] = useState("");
  const [startHour, setStartHour] = useState("08:00");
  const [endHour, setEndHour] = useState("17:00");
  const [slotDuration, setSlotDuration] = useState("30");

  useEffect(() => {
    if (!user) return;
    const fetchDept = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("department_id")
        .eq("id", user.id)
        .single();
      if (data?.department_id) {
        setDepartmentId(data.department_id);
        fetchTimeslots(data.department_id);
      } else {
        setLoading(false);
      }
    };
    fetchDept();
  }, [user]);

  const fetchTimeslots = async (deptId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("timeslots")
      .select("*")
      .eq("department_id", deptId)
      .order("start_time", { ascending: true });
    setTimeslots(data || []);
    setLoading(false);
  };

  const handleBulkGenerate = async () => {
    if (!departmentId || !bulkDate || !startHour || !endHour) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    const duration = parseInt(slotDuration);
    const slots: { department_id: string; start_time: string; end_time: string }[] = [];

    let current = new Date(`${bulkDate}T${startHour}:00`);
    const end = new Date(`${bulkDate}T${endHour}:00`);

    while (current < end) {
      const slotEnd = new Date(current.getTime() + duration * 60000);
      if (slotEnd > end) break;
      slots.push({
        department_id: departmentId,
        start_time: current.toISOString(),
        end_time: slotEnd.toISOString(),
      });
      current = slotEnd;
    }

    if (slots.length === 0) {
      toast({ title: "Nenhum horário pôde ser gerado", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("timeslots").insert(slots);
    if (error) {
      toast({ title: "Erro ao gerar horários", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: `${slots.length} horários criados` });
    setIsOpen(false);
    fetchTimeslots(departmentId);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("timeslots").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Horário excluído" });
    if (departmentId) fetchTimeslots(departmentId);
  };

  if (!departmentId && !loading) {
    return (
      <div className="p-8 text-center text-muted-foreground animate-fade-in">
        Você ainda não foi vinculado a nenhum setor. Contate o administrador.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Horários</h1>
          <p className="text-muted-foreground">Gere e gerencie horários disponíveis</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Gerar Horários</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gerar Horários em Lote</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hora Início</Label>
                  <Input type="time" value={startHour} onChange={(e) => setStartHour(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Hora Fim</Label>
                  <Input type="time" value={endHour} onChange={(e) => setEndHour(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Duração do Horário (minutos)</Label>
                <Input type="number" value={slotDuration} onChange={(e) => setSlotDuration(e.target.value)} min="15" step="15" />
              </div>
              <Button onClick={handleBulkGenerate} className="w-full">Gerar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : timeslots.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum horário ainda. Gere alguns para começar.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeslots.map((ts) => (
                  <TableRow key={ts.id}>
                    <TableCell>{format(new Date(ts.start_time), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                    <TableCell>{format(new Date(ts.start_time), "HH:mm")} - {format(new Date(ts.end_time), "HH:mm")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ts.is_available ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>
                        {ts.is_available ? "Disponível" : "Ocupado"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {ts.is_available && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(ts.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
