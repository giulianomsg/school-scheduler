import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Cabeçalhos CORS padrão para permitir chamadas web e externas
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Lida com requisições OPTIONS (Preflight do CORS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // =======================================================================
    // 1. VALIDAÇÃO DE SEGURANÇA (O Segredo do cron-job.org)
    // =======================================================================
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");

    // Bloqueia a execução se a chave CRON_SECRET não estiver configurada no Supabase
    // ou se o cabeçalho Authorization não bater certo.
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.error("Acesso não autorizado. Chave inválida ou ausente.");
      return new Response(JSON.stringify({ error: "Unauthorized access" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =======================================================================
    // 2. INICIALIZAÇÃO DO SUPABASE (Service Role)
    // =======================================================================
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("As variáveis de ambiente do Supabase não estão configuradas.");
    }

    // O Service Role ignora as políticas RLS, permitindo ler todos os agendamentos
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // =======================================================================
    // 3. LÓGICA DE NEGÓCIO: LEITURA E DISPARO DE LEMBRETES
    // =======================================================================
    const now = new Date();
    let notificationsSent = 0;

    // Busca apenas os agendamentos ativos
    const { data: appointments, error: fetchError } = await supabase
      .from("appointments")
      .select(`
        id, 
        requester_id, 
        notified_30min, 
        notified_10min, 
        description,
        timeslots!inner(start_time, department_id, departments(name))
      `)
      .eq("status", "active");

    if (fetchError) {
      console.error("Erro ao buscar agendamentos:", fetchError);
      throw fetchError;
    }

    // Itera sobre os agendamentos para verificar o tempo restante
    for (const appt of appointments || []) {
      const startTime = new Date(appt.timeslots.start_time);
      // Calcula a diferença em minutos
      const diffMinutes = (startTime.getTime() - now.getTime()) / 60000;

      // ----------------------------------------------------
      // Disparo de Lembrete: 30 Minutos
      // ----------------------------------------------------
      if (diffMinutes <= 30 && diffMinutes > 10 && !appt.notified_30min) {
        // Notifica o Diretor (Escola)
        await supabase.from("notifications").insert({
          user_id: appt.requester_id,
          title: "Lembrete de Atendimento",
          message: `O seu agendamento no setor ${appt.timeslots.departments?.name || "da Secretaria"} começa em cerca de 30 minutos.`,
        });

        // Busca os funcionários do departamento para notificar também
        const { data: deptUsers } = await supabase
          .from("profiles")
          .select("id")
          .eq("department_id", appt.timeslots.department_id);
          
        if (deptUsers && deptUsers.length > 0) {
          const deptNotifications = deptUsers.map((u) => ({
            user_id: u.id,
            title: "Lembrete de Atendimento",
            message: `Você tem um atendimento marcado com uma escola daqui a 30 minutos.`,
          }));
          await supabase.from("notifications").insert(deptNotifications);
        }

        // Atualiza a flag para não enviar duas vezes
        await supabase.from("appointments").update({ notified_30min: true }).eq("id", appt.id);
        notificationsSent++;
      }

      // ----------------------------------------------------
      // Disparo de Lembrete: 10 Minutos
      // ----------------------------------------------------
      if (diffMinutes <= 10 && diffMinutes > 0 && !appt.notified_10min) {
        // Notifica o Diretor (Escola)
        await supabase.from("notifications").insert({
          user_id: appt.requester_id,
          title: "Atenção: Atendimento Iminente",
          message: `O seu atendimento no setor ${appt.timeslots.departments?.name || "da Secretaria"} começará em menos de 10 minutos!`,
        });

        // Notifica os funcionários do departamento
        const { data: deptUsers } = await supabase
          .from("profiles")
          .select("id")
          .eq("department_id", appt.timeslots.department_id);
          
        if (deptUsers && deptUsers.length > 0) {
          const deptNotifications = deptUsers.map((u) => ({
            user_id: u.id,
            title: "Atenção: Atendimento Iminente",
            message: `O seu atendimento com a escola começará em 10 minutos. Por favor, prepare-se.`,
          }));
          await supabase.from("notifications").insert(deptNotifications);
        }

        // Atualiza a flag para não enviar duas vezes
        await supabase.from("appointments").update({ notified_10min: true }).eq("id", appt.id);
        notificationsSent++;
      }
    }

    // Retorna o sucesso da execução
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cron job executado com sucesso. ${notificationsSent} notificações foram disparadas.`,
        timestamp: now.toISOString()
      }), 
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Erro interno no disparo de lembretes:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});