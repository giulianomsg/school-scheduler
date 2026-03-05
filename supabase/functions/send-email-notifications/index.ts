import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
    type: "INSERT" | "UPDATE" | "DELETE";
    table: string;
    record: any;
    old_record: any;
}

async function sendEmail(params: { to: string[]; subject: string; html: string; bcc?: string[] }) {
    if (!RESEND_API_KEY) {
        console.error("RESEND_API_KEY is not set");
        return; // Não interrompe a execução, apenas loga e segue
    }

    // Substitua este email por um domínio válido verificado no Resend se necessário
    const from = "Agenda SME <onboarding@resend.dev>";

    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from,
                to: params.to,
                bcc: params.bcc?.length ? params.bcc : undefined,
                subject: params.subject,
                html: params.html,
            }),
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`Resend API error: ${res.status} ${errorText}`);
        } else {
            console.log(`Email sent successfully: ${params.subject}`);
        }
    } catch (error) {
        console.error("Error sending email via Resend:", error);
    }
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const payload: WebhookPayload = await req.json();

        if (payload.table !== "appointments") {
            return new Response("Not an appointment event", { status: 200, headers: corsHeaders });
        }

        const { type, record, old_record } = payload;

        if (type !== "INSERT" && type !== "UPDATE") {
            return new Response("Event type not handled", { status: 200, headers: corsHeaders });
        }

        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error("Missing Supabase environment variables");
        }

        // Instanciar supabase com Service Role Key para ignorar RLS e ler `profiles` e `timeslots` livremente
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Obter timeslot para achar o department_id
        if (!record.timeslot_id) {
            console.log("No timeslot_id found on record");
            return new Response("Missing timeslot_id", { status: 200, headers: corsHeaders });
        }

        const { data: timeslot, error: timeslotError } = await supabase
            .from("timeslots")
            .select("department_id, start_time")
            .eq("id", record.timeslot_id)
            .single();

        if (timeslotError || !timeslot) {
            console.error("Error fetching timeslot:", timeslotError);
            return new Response(JSON.stringify({ error: "Timeslot not found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const departmentId = timeslot.department_id;

        // 2. Resolver E-mails e Nomes
        let requesterEmail = null;
        let requesterName = "Diretor";
        if (record.requester_id) {
            try {
                const { data: requester } = await supabase
                    .from("profiles")
                    .select("email, name")
                    .eq("id", record.requester_id)
                    .single();
                if (requester) {
                    requesterEmail = requester.email;
                    if (requester.name) requesterName = requester.name;
                }
            } catch (e) {
                console.error("Error fetching requester:", e);
            }
        }

        let attendantEmail = null;
        let attendantName = null;
        if (record.requested_attendant_id) {
            try {
                const { data: attendant } = await supabase
                    .from("profiles")
                    .select("email, name")
                    .eq("id", record.requested_attendant_id)
                    .single();
                if (attendant) {
                    attendantEmail = attendant.email;
                    if (attendant.name) attendantName = attendant.name;
                }
            } catch (e) {
                console.error("Error fetching attendant:", e);
            }
        }

        let departmentEmails: string[] = [];
        try {
            const { data: deptProfiles } = await supabase
                .from("profiles")
                .select("email")
                .eq("department_id", departmentId)
                .eq("role", "department");

            if (deptProfiles && deptProfiles.length > 0) {
                departmentEmails = deptProfiles.map(p => p.email).filter(Boolean) as string[];
            }
        } catch (e) {
            console.error("Error fetching department emails:", e);
        }

        // Formatar datas e horários (assumindo que start_time está em ISO8601 UTC)
        const appointmentDateObj = new Date(timeslot.start_time);
        const appointmentDate = appointmentDateObj.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const startTime = appointmentDateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

        // 3. Lógica de Disparo baseada em Eventos
        if (type === "INSERT") {
            // Confirmação para o Requerente (Diretor)
            if (requesterEmail) {
                await sendEmail({
                    to: [requesterEmail],
                    subject: `Confirmação de Agendamento - ${appointmentDate}`,
                    html: `
            <h2>Agendamento Confirmado</h2>
            <p>Olá ${requesterName}, seu agendamento foi registrado com sucesso.</p>
            <p><strong>Data:</strong> ${appointmentDate}</p>
            <p><strong>Horário:</strong> ${startTime}</p>
            <p><strong>Motivo/Descrição:</strong> ${record.description || "Não informada"}</p>
            ${attendantName ? `<p><strong>Atendente Solicitado:</strong> ${attendantName}</p>` : ""}
            <p>Acesse o sistema para visualizar o agendamento completo ou realizar alterações caso necessário.</p>
          `
                });
            }

            // Alerta para o Departamento (+ Atendente)
            if (departmentEmails.length > 0 || attendantEmail) {
                const toList = departmentEmails.length > 0 ? departmentEmails.slice(0, 1) : []; // Resend 'to'
                const bccList = new Set<string>();

                departmentEmails.slice(1).forEach(email => bccList.add(email));

                if (attendantEmail && !toList.includes(attendantEmail)) {
                    if (toList.length === 0) {
                        toList.push(attendantEmail);
                    } else {
                        bccList.add(attendantEmail);
                    }
                }

                const attendantHtml = attendantName
                    ? `<p><strong style="color: #d97706; font-size: 18px;">Atendente Solicitado Especialmente: ${attendantName}</strong></p>`
                    : "";

                await sendEmail({
                    to: toList.length > 0 ? toList : ["onboarding@resend.dev"],
                    bcc: Array.from(bccList),
                    subject: "Novo Agendamento Recebido",
                    html: `
            <h2>Novo Agendamento</h2>
            <p>O diretor <strong>${requesterName}</strong> marcou um novo atendimento.</p>
            <p><strong>Data:</strong> ${appointmentDate}</p>
            <p><strong>Horário:</strong> ${startTime}</p>
            <p><strong>Descrição:</strong> ${record.description || "Não informada"}</p>
            ${attendantHtml}
            <p>Acesse o painel para verificar os detalhes da solicitação.</p>
          `
                });
            }
        }
        else if (type === "UPDATE" && old_record) {

            const statusChanged = record.status !== old_record.status;
            const deptNotesChanged = record.department_notes !== old_record.department_notes;
            const ratingChanged = record.rating !== old_record.rating;
            const schoolNotesChanged = record.school_notes !== old_record.school_notes;

            // 1. Notificações de Cancelamento
            if (statusChanged && record.status === "cancelled") {
                const cancelReason = record.cancel_reason || "Não informado";

                // Notifica Diretor
                if (requesterEmail) {
                    await sendEmail({
                        to: [requesterEmail],
                        subject: "Aviso: Agendamento Cancelado",
                        html: `
              <h2>Agendamento Cancelado</h2>
              <p>Olá ${requesterName}, informamos que o agendamento para o dia ${appointmentDate} às ${startTime} foi cancelado.</p>
              <p><strong>Motivo do Cancelamento:</strong> ${cancelReason}</p>
            `
                    });
                }

                // Notifica Departamento e Atendente
                if (departmentEmails.length > 0 || attendantEmail) {
                    const toList = departmentEmails.length > 0 ? departmentEmails.slice(0, 1) : [];
                    const bccList = new Set<string>();
                    departmentEmails.slice(1).forEach(email => bccList.add(email));

                    if (attendantEmail && !toList.includes(attendantEmail)) {
                        if (toList.length === 0) {
                            toList.push(attendantEmail);
                        } else {
                            bccList.add(attendantEmail);
                        }
                    }

                    await sendEmail({
                        to: toList.length > 0 ? toList : ["onboarding@resend.dev"],
                        bcc: Array.from(bccList),
                        subject: "Aviso: Agendamento Cancelado pelo Diretor",
                        html: `
              <h2>Agendamento Cancelado</h2>
              <p>O agendamento com a escola (Diretor: ${requesterName}) para o dia ${appointmentDate} às ${startTime} foi cancelado.</p>
              <p><strong>Motivo do Cancelamento:</strong> ${cancelReason}</p>
            `
                    });
                }
            }

            // 2. Feedback do Departamento para Escola (se mudou)
            if (deptNotesChanged && record.department_notes) {
                if (requesterEmail) {
                    await sendEmail({
                        to: [requesterEmail],
                        subject: "Nova Atualização no seu Agendamento (Retorno do Departamento)",
                        html: `
              <h2>Retorno do Departamento</h2>
              <p>Olá ${requesterName}, o departamento adicionou um parecer ao seu agendamento do dia ${appointmentDate}.</p>
              <p><strong>Parecer:</strong></p>
              <blockquote style="border-left: 4px solid #ccc; margin: 10px 0; padding-left: 10px; color: #555;">
                ${record.department_notes}
              </blockquote>
              <p>Acesse o painel do sistema para mais detalhes.</p>
            `
                    });
                }
            }

            // 3. Avaliação da Escola para o Departamento (rating ou comments mudaram)
            if ((ratingChanged && record.rating) || (schoolNotesChanged && record.school_notes)) {
                if (departmentEmails.length > 0 || attendantEmail) {
                    const toList = departmentEmails.length > 0 ? departmentEmails.slice(0, 1) : [];
                    const bccList = new Set<string>();
                    departmentEmails.slice(1).forEach(email => bccList.add(email));

                    if (attendantEmail && !toList.includes(attendantEmail)) {
                        if (toList.length === 0) {
                            toList.push(attendantEmail);
                        } else {
                            bccList.add(attendantEmail);
                        }
                    }

                    await sendEmail({
                        to: toList.length > 0 ? toList : ["onboarding@resend.dev"],
                        bcc: Array.from(bccList),
                        subject: "Nova Avaliação de Atendimento Recebida",
                        html: `
              <h2>Avaliação do Atendimento</h2>
              <p>O diretor ${requesterName} enviou uma avaliação para o atendimento do dia ${appointmentDate} às ${startTime}.</p>
              <p><strong>Avaliação (Nota de 1 a 5):</strong> ${record.rating || "Não informada"}</p>
              <p><strong>Comentários/Feedback:</strong> ${record.school_notes || "Nenhum comentário"}</p>
            `
                    });
                }
            }
        }

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    } catch (error) {
        console.error("Error processing webhook:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
    }
});
