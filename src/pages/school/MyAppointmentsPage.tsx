import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";

export default function MyAppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleCancel = async (appointmentId: string) => {
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" as const })
      .eq("id", appointmentId);
    if (error) {
      toast({ title: "Error cancelling", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Appointment cancelled" });
    fetchAppointments();
  };

  const statusBadge = (status: string) => (
    <Badge
      variant="outline"
      className={
        status === "active"
          ? "bg-success/10 text-success border-success/20"
          : "bg-destructive/10 text-destructive border-destructive/20"
      }
    >
      {status === "active" ? "Active" : "Cancelled"}
    </Badge>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Appointments</h1>
        <p className="text-muted-foreground">View and manage your scheduled appointments</p>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : appointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">No appointments yet. Book one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => (
            <Card key={appt.id}>
              <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{appt.timeslots?.departments?.name || "Department"}</p>
                    {statusBadge(appt.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(appt.timeslots.start_time), "MMM dd, yyyy")} ·{" "}
                    {format(new Date(appt.timeslots.start_time), "HH:mm")} -{" "}
                    {format(new Date(appt.timeslots.end_time), "HH:mm")}
                  </p>
                  <p className="text-sm text-muted-foreground">{appt.description}</p>
                </div>
                {appt.status === "active" && (
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => handleCancel(appt.id)}>
                    Cancel
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
