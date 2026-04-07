import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import nodemailer from "npm:nodemailer";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const smtpUser = Deno.env.get("SMTP_USER");
        const smtpPass = Deno.env.get("SMTP_PASS");

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error("Missing Supabase configuration");
        }

        if (!smtpUser || !smtpPass) {
            throw new Error("Missing SMTP credentials");
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const payload = await req.json();
        const { type, record, old_record } = payload;

        // Only process appointments table webhook
        if (payload.table !== "appointments") {
            return new Response("Not an appointment event", { status: 200 });
        }

        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });

        // Helper to fetch details and emails
        const getEmails = async (recordData: any) => {
            // 1. Get Timeslot & Department Details
            const { data: timeslot } = await supabase
                .from("timeslots")
                .select("start_time, department_id, departments(name)")
                .eq("id", recordData.timeslot_id)
                .single();

            if (!timeslot) throw new Error("Timeslot not found");

            const departmentName = timeslot.departments?.name || "Departamento";
            const startTimeFormated = new Intl.DateTimeFormat('pt-BR', {
                dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Sao_Paulo'
            }).format(new Date(timeslot.start_time));

            // 2. Get Director Data
            const { data: directorProfile } = await supabase
                .from("profiles")
                .select("name, email, unidades_escolares(nome_escola)")
                .eq("id", recordData.requester_id)
                .single();

            const schoolName = directorProfile?.unidades_escolares?.nome_escola || directorProfile?.name || "Escola";
            const directorEmail = directorProfile?.email;

            // 3. Get Department Users
            const { data: deptProfiles } = await supabase
                .from("profiles")
                .select("email")
                .eq("department_id", timeslot.department_id)
                .eq("role", "department");

            const departmentEmails = deptProfiles?.map((p: any) => p.email).filter(Boolean) || [];

            // 4. Get Specific Attendant if any
            let attendantEmail = null;
            let attendantName = null;
            if (recordData.requested_attendant_id) {
                const { data: attendantProfile } = await supabase
                    .from("profiles")
                    .select("name, email")
                    .eq("id", recordData.requested_attendant_id)
                    .single();
                if (attendantProfile) {
                    attendantEmail = attendantProfile.email;
                    attendantName = attendantProfile.name;
                }
            }

            return {
                directorEmail,
                departmentEmails,
                attendantEmail,
                attendantName,
                departmentName,
                schoolName,
                startTimeFormated,
                description: recordData.description
            };
        };

        const systemBaseUrl = "https://agenda.educacao.riopreto.br";

        const buildEmailHtml = (title: string, contentHtml: string, actionText?: string, actionUrl?: string) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Agenda SME - ${title}</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; color: #333333; margin: 0; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://educacao.riopreto.br/ramais/public/assets/brasao@2x.png" alt="Brasão da Prefeitura Municipal de São José do Rio Preto" style="max-width: 120px; height: auto; display: block; margin: 0 auto;">
            <h1 style="font-size: 22px; margin: 15px 0 5px 0; color: #222222;">Prefeitura Municipal de São José do Rio Preto</h1>
            <h2 style="font-size: 16px; margin: 0; color: #666666; font-weight: normal;">Secretaria Municipal de Educação</h2>
        </div>
        <hr style="border: none; border-top: 1px solid #eeeeee; margin-bottom: 30px;">
        <div style="margin-bottom: 40px; text-align: left;">
            <h3 style="font-size: 20px; color: #333333; margin-top: 0; text-align: center;">Agenda SME - ${title}</h3>
            <div style="font-size: 16px; line-height: 1.6; color: #555555;">
                ${contentHtml}
            </div>
            ${actionText && actionUrl ? `
            <div style="text-align: center; margin-top: 30px;">
                <a href="${actionUrl}" style="background-color: #0056b3; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-weight: bold; display: inline-block;">${actionText}</a>
            </div>` : ''}
        </div>
        <hr style="border: none; border-top: 1px solid #eeeeee; margin-bottom: 20px;">
        <div style="font-size: 14px; line-height: 1.6; color: #444444; margin-bottom: 25px;">
            <p style="margin: 0 0 10px 0;">Dúvidas, entre em contato com a Gerência de Educação Digital.</p>
            <p style="margin: 0;"><strong>Telefone:</strong> (17) 3211-4014</p>
            <p style="margin: 0;"><strong>E-mail:</strong> <a href="mailto:digital@educacao.riopreto.sp.gov.br" style="color: #0056b3; text-decoration: none;">digital@educacao.riopreto.sp.gov.br</a></p>
        </div>
        <div style="font-size: 11px; font-style: italic; color: #888888; text-align: justify; line-height: 1.4;">
            <p style="margin: 0;">Esta mensagem e seus anexos podem conter informações confidenciais. Se você não for o destinatário ou autorizado, é proibido usar, divulgar, copiar ou armazenar o conteúdo. Caso a tenha recebido por engano, informe ao remetente e exclua a mensagem.</p>
        </div>
    </div>
</body>
</html>`;

        // PROCESS EVENTS
        // ------------------------------------------------------------------------------------------

        // 1. INSERT (Novo Agendamento)
        if (type === "INSERT") {
            const data = await getEmails(record);

            // Email para o Diretor (Assumindo que 'directorEmail' já tem o email salvo no perfil)
            if (data.directorEmail) {
                const content = `<p>Olá,</p>
                 <p>O seu agendamento para <strong>${data.departmentName}</strong> foi adicionado com sucesso e encontra-se com o status de <strong>Pendente</strong>. O setor logo avaliará e confirmará o seu agendamento.</p>
                 <p><strong>Data/Hora:</strong> ${data.startTimeFormated}</p>
                 <p><strong>Pauta:</strong> ${data.description}</p>
                 ${data.attendantName ? `<p><strong>Atendente Solicitado:</strong> ${data.attendantName}</p>` : ''}`;
                await transporter.sendMail({
                    from: `"Sistema de Agendamento" <${smtpUser}>`,
                    to: data.directorEmail,
                    subject: `Agendamento Solicitado - ${data.departmentName}`,
                    html: buildEmailHtml(`Agendamento Solicitado`, content, "Acessar Meus Agendamentos", `${systemBaseUrl}/my-appointments`),
                });
            }

            // Email para o Departamento
            if (data.departmentEmails.length > 0) {
                const attendantHighlight = data.attendantName
                    ? `<p style="color: #d97706; background-color: #fef3c7; padding: 10px; border-left: 4px solid #d97706;"><strong>ATENÇÃO: Este atendimento foi solicitado especificamente para o servidor(a): ${data.attendantName}</strong></p>`
                    : '';

                const content = `<p>Olá equipe do <strong>${data.departmentName}</strong>,</p>
                 <p>Um novo agendamento foi realizado por <strong>${data.schoolName}</strong> e está pendente de confirmação.</p>
                 <p><strong>Data/Hora:</strong> ${data.startTimeFormated}</p>
                 <p><strong>Pauta:</strong> ${data.description}</p>
                 ${attendantHighlight}`;
                 
                await transporter.sendMail({
                    from: `"Sistema de Agendamento" <${smtpUser}>`,
                    bcc: data.departmentEmails,
                    subject: `Novo Agendamento Recebido - ${data.schoolName}`,
                    html: buildEmailHtml(`Novo Agendamento Recebido`, content, "Acessar Agendamentos do Setor", `${systemBaseUrl}/timeslots`),
                });
            }

            // Email para o Atendente Específico (se existir e tiver email)
            if (data.attendantEmail) {
                const content = `<p>Olá <strong>${data.attendantName}</strong>,</p>
                 <p>A escola <strong>${data.schoolName}</strong> realizou um agendamento e <strong>solicitou especificamente o seu atendimento</strong>.</p>
                 <p><strong>Data/Hora:</strong> ${data.startTimeFormated}</p>
                 <p><strong>Pauta:</strong> ${data.description}</p>`;
                 
                await transporter.sendMail({
                    from: `"Sistema de Agendamento" <${smtpUser}>`,
                    to: data.attendantEmail,
                    subject: `Novo Agendamento Direcionado a Você - ${data.schoolName}`,
                    html: buildEmailHtml(`Agendamento Direcionado`, content, "Acessar Agendamentos", `${systemBaseUrl}/timeslots`),
                });
            }
        }

        // 2. UPDATE (Cancelamento e Feedbacks)
        if (type === "UPDATE" && old_record) {
            const data = await getEmails(record);

            // 2A. Cancelamento (apenas se mudou para cancelled)
            if (record.status === 'cancelled' && old_record.status !== 'cancelled') {
                const cancelReasonMsg = record.cancel_reason ? `<p><strong>Motivo:</strong> ${record.cancel_reason}</p>` : '';
                const cancelHtml = `
          <p>O agendamento da escola <strong>${data.schoolName}</strong> com <strong>${data.departmentName}</strong> em <strong>${data.startTimeFormated}</strong> foi <strong>CANCELADO</strong>.</p>
          ${cancelReasonMsg}
        `;

                if (data.directorEmail) {
                    await transporter.sendMail({
                        from: `"Sistema de Agendamento" <${smtpUser}>`,
                        to: data.directorEmail,
                        subject: `[Cancelado] Agendamento - ${data.departmentName}`,
                        html: buildEmailHtml(`Agendamento Cancelado`, `<p>Olá,</p>${cancelHtml}`, "Acessar Sistema", systemBaseUrl),
                    });
                }

                if (data.departmentEmails.length > 0) {
                    await transporter.sendMail({
                        from: `"Sistema de Agendamento" <${smtpUser}>`,
                        bcc: data.departmentEmails,
                        subject: `[Cancelado] Agendamento - ${data.schoolName}`,
                        html: buildEmailHtml(`Agendamento Cancelado`, `<p>Olá equipe,</p>${cancelHtml}`, "Acessar Sistema", systemBaseUrl),
                    });
                }

                if (data.attendantEmail) {
                    await transporter.sendMail({
                        from: `"Sistema de Agendamento" <${smtpUser}>`,
                        to: data.attendantEmail,
                        subject: `[Cancelado] Agendamento Direcionado - ${data.schoolName}`,
                        html: buildEmailHtml(`Agendamento Cancelado`, `<p>Olá ${data.attendantName},</p>${cancelHtml}`, "Acessar Sistema", systemBaseUrl),
                    });
                }
            }

            // 2B. Feedbacks (Department Notes, Rating, School Notes) só se alterado nesta query

            // Feedback do Departamento (department_notes)
            if (record.department_notes && record.department_notes !== old_record.department_notes) {
                if (data.directorEmail) {
                    const content = `<p>Olá,</p>
                   <p>O setor <strong>${data.departmentName}</strong> inseriu um recado ou resposta referente ao atendimento do dia <strong>${data.startTimeFormated}</strong>.</p>
                   <div style="background:#f4f4f4;padding:15px;margin-top:10px; border-radius: 4px;">
                     <p style="margin: 0;"><strong>Mensagem do Setor:</strong><br/><br/>${record.department_notes}</p>
                   </div>`;
                   
                    await transporter.sendMail({
                        from: `"Sistema de Agendamento" <${smtpUser}>`,
                        to: data.directorEmail,
                        subject: `Nova Mensagem do Setor - ${data.departmentName}`,
                        html: buildEmailHtml("Nova Mensagem no Agendamento", content, "Acessar Sistema", systemBaseUrl),
                    });
                }
            }

            // Avaliação da Escola (rating ou school_notes alterado)
            const isRatingChanged = record.rating !== old_record.rating && record.rating !== null;
            const isSchoolNotesChanged = record.school_notes !== old_record.school_notes && record.school_notes !== null;

            if (isRatingChanged || isSchoolNotesChanged) {
                if (data.departmentEmails.length > 0) {
                    const ratingText = record.rating ? `<p><strong>Avaliação Geral:</strong> ${record.rating} Estrela(s)</p>` : '';
                    const notesText = record.school_notes ? `<p><strong>Feedback Aberto da Escola:</strong><br/>${record.school_notes}</p>` : '';

                    const content = `<p>Olá equipe do <strong>${data.departmentName}</strong>,</p>
                   <p>A escola <strong>${data.schoolName}</strong> avaliou o atendimento realizado em <strong>${data.startTimeFormated}</strong>.</p>
                   <div style="background:#f9f9eb;padding:15px;margin-top:10px;border-left:4px solid #f59e0b; border-radius: 0 4px 4px 0;">
                     ${ratingText}
                     ${notesText}
                   </div>`;
                   
                    await transporter.sendMail({
                        from: `"Sistema de Agendamento" <${smtpUser}>`,
                        bcc: data.departmentEmails,
                        subject: `Nova Avaliação de Atendimento - ${data.schoolName}`,
                        html: buildEmailHtml("Avaliação de Atendimento", content, "Acessar Sistema", systemBaseUrl),
                    });
                }
            }
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error: any) {
        console.error("Error processing webhook:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
