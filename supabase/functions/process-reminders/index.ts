import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (callerProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 60 * 1000);
    const in10 = new Date(now.getTime() + 10 * 60 * 1000);

    let processed = 0;

    // --- Lógica de 30 minutos ---
    const { data: appts30 } = await supabaseAdmin
      .from("appointments")
      .select("id, requester_id, description, timeslot_id, timeslots(start_time, department_id, departments(name))")
      .eq("status", "active")
      .eq("notified_30min", false);

    for (const appt of appts30 || []) {
      const ts = appt.timeslots as any;
      if (!ts) continue;
      const startTime = new Date(ts.start_time);
      if (startTime <= now || startTime > in30) continue;

      const deptName = ts.departments?.name || "Setor";
      const horario = startTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

      // Notificar o solicitante (escola)
      await supabaseAdmin.from("notifications").insert({
        user_id: appt.requester_id,
        title: "Lembrete de Agendamento",
        message: `Seu agendamento no ${deptName} começa em 30 minutos (${horario}).`,
      });

      // Notificar usuários do setor
      const { data: deptUsers } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("department_id", ts.department_id);

      if (deptUsers?.length) {
        await supabaseAdmin.from("notifications").insert(
          deptUsers.map((u: any) => ({
            user_id: u.id,
            title: "Lembrete de Agendamento",
            message: `Agendamento no ${deptName} às ${horario} começa em 30 minutos.`,
          }))
        );
      }

      await supabaseAdmin.from("appointments").update({ notified_30min: true }).eq("id", appt.id);
      processed++;
    }

    // --- Lógica de 10 minutos ---
    const { data: appts10 } = await supabaseAdmin
      .from("appointments")
      .select("id, requester_id, description, timeslot_id, timeslots(start_time, department_id, departments(name))")
      .eq("status", "active")
      .eq("notified_10min", false);

    for (const appt of appts10 || []) {
      const ts = appt.timeslots as any;
      if (!ts) continue;
      const startTime = new Date(ts.start_time);
      if (startTime <= now || startTime > in10) continue;

      const deptName = ts.departments?.name || "Setor";
      const horario = startTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

      await supabaseAdmin.from("notifications").insert({
        user_id: appt.requester_id,
        title: "⚠️ Agendamento Iminente",
        message: `Seu agendamento no ${deptName} começa em 10 minutos (${horario})!`,
      });

      const { data: deptUsers } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("department_id", ts.department_id);

      if (deptUsers?.length) {
        await supabaseAdmin.from("notifications").insert(
          deptUsers.map((u: any) => ({
            user_id: u.id,
            title: "⚠️ Agendamento Iminente",
            message: `Agendamento no ${deptName} às ${horario} começa em 10 minutos!`,
          }))
        );
      }

      await supabaseAdmin.from("appointments").update({ notified_10min: true }).eq("id", appt.id);
      processed++;
    }

    return new Response(JSON.stringify({ success: true, processed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[process-reminders] Error:", error);
    return new Response(JSON.stringify({ error: "Processamento falhou." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});