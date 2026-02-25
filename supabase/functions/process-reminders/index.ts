import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // Liberação do CORS para navegadores
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // =======================================================================
    // 1. MODO INVESTIGADOR: LER A SENHA (POR CABEÇALHO OU URL)
    // =======================================================================
    const url = new URL(req.url);
    const querySecret = url.searchParams.get("secret");
    const authHeader = req.headers.get("Authorization");
    
    // Lê a senha que você configurou no painel do Lovable Cloud
    const cronSecret = Deno.env.get("CRON_SECRET");

    // SE O LOVABLE NÃO CARREGOU A VARIÁVEL, AVISA O MOTIVO (Erro 500)
    if (!cronSecret) {
        return new Response(JSON.stringify({
            erro: "Servidor desconfigurado",
            detalhe: "A variável CRON_SECRET não foi encontrada. O Lovable não conseguiu ler o segredo na nuvem."
        }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Tenta pegar a senha de onde o robô enviou
    const tokenFromHeader = authHeader?.replace("Bearer ", "").trim();
    const senhaRecebida = querySecret || tokenFromHeader;

    // SE A SENHA ENVIADA FOR DIFERENTE, EXPLICA O QUE RECEBEU (Erro 401)
    if (senhaRecebida !== cronSecret) {
         return new Response(JSON.stringify({
            erro: "Acesso Negado",
            detalhe: "A chave recebida não coincide com a chave guardada no servidor.",
            senhaRecebidaViaURL: querySecret || "Nenhuma",
            senhaRecebidaViaHeader: authHeader || "Nenhuma"
        }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =======================================================================
    // 2. INICIALIZAR SUPABASE COMO ADMINISTRADOR DO SISTEMA
    // =======================================================================
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
         return new Response(JSON.stringify({ erro: "Chaves do Supabase ausentes no servidor." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // =======================================================================
    // 3. A SUA LÓGICA ORIGINAL DE NEGÓCIO
    // =======================================================================
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 60 * 1000);
    const in10 = new Date(now.getTime() + 10 * 60 * 1000);

    let processed = 0;

    // --- Lógica de 30 minutos ---
    const { data: appts30, error: err30 } = await supabaseAdmin
      .from("appointments")
      .select("id, requester_id, description, timeslot_id, timeslots(start_time, department_id, departments(name))")
      .eq("status", "active")
      .eq("notified_30min", false);

    if (err30) throw err30;

    for (const appt of appts30 || []) {
      const ts = appt.timeslots as any;
      if (!ts) continue;
      const startTime = new Date(ts.start_time);
      if (startTime <= now || startTime > in30) continue;

      const deptName = ts.departments?.name || "Setor";
      const horario = startTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

      await supabaseAdmin.from("notifications").insert({
        user_id: appt.requester_id,
        title: "Lembrete de Agendamento",
        message: `Seu agendamento no ${deptName} começa em 30 minutos (${horario}).`,
      });

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
    const { data: appts10, error: err10 } = await supabaseAdmin
      .from("appointments")
      .select("id, requester_id, description, timeslot_id, timeslots(start_time, department_id, departments(name))")
      .eq("status", "active")
      .eq("notified_10min", false);

    if (err10) throw err10;

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

    return new Response(JSON.stringify({ success: true, processados: processed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[process-reminders] Error:", error);
    return new Response(JSON.stringify({ erro: "Falha interna na lógica de banco de dados.", detalhes: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});