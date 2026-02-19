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

export default function TimeslotsPage() {
  const { user } = useAuth();
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [timeslots, setTimeslots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  // Bulk generation fields
  const [bulkDate, setBulkDate] = useState("");
  const [startHour, setStartHour] = useState("08:00");
  const [endHour, setEndHour] = useState("17:00");
  const [slotDuration, setSlotDuration] = useState("30");

  useEffect(() => {
    if (!user) return;
    const fetchDept = async () => {
      const { data } = await supabase
        .from("departments")
        .select("id")
        .eq("head_id", user.id)
        .single();
      if (data) {
        setDepartmentId(data.id);
        fetchTimeslots(data.id);
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
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }

    const duration = parseInt(slotDuration);
    const slots: { department_id: string; start_time: string; end_time: string }[] = [];

    const [sh, sm] = startHour.split(":").map(Number);
    const [eh, em] = endHour.split(":").map(Number);

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
      toast({ title: "No slots could be generated", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("timeslots").insert(slots);
    if (error) {
      toast({ title: "Error generating slots", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: `${slots.length} timeslots created` });
    setIsOpen(false);
    fetchTimeslots(departmentId);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("timeslots").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Timeslot deleted" });
    if (departmentId) fetchTimeslots(departmentId);
  };

  if (!departmentId && !loading) {
    return (
      <div className="p-8 text-center text-muted-foreground animate-fade-in">
        You are not assigned as head of any department.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Timeslots</h1>
          <p className="text-muted-foreground">Generate and manage available timeslots</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Generate Slots</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bulk Generate Timeslots</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input type="time" value={startHour} onChange={(e) => setStartHour(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input type="time" value={endHour} onChange={(e) => setEndHour(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Slot Duration (minutes)</Label>
                <Input type="number" value={slotDuration} onChange={(e) => setSlotDuration(e.target.value)} min="15" step="15" />
              </div>
              <Button onClick={handleBulkGenerate} className="w-full">Generate</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : timeslots.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No timeslots yet. Generate some to get started.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeslots.map((ts) => (
                  <TableRow key={ts.id}>
                    <TableCell>{format(new Date(ts.start_time), "MMM dd, yyyy")}</TableCell>
                    <TableCell>{format(new Date(ts.start_time), "HH:mm")} - {format(new Date(ts.end_time), "HH:mm")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ts.is_available ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>
                        {ts.is_available ? "Available" : "Booked"}
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
