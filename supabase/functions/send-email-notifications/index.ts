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

        // PROCESS EVENTS
        // ------------------------------------------------------------------------------------------

        // 1. INSERT (Novo Agendamento)
        if (type === "INSERT") {
            const data = await getEmails(record);

            // Email para o Diretor (Assumindo que 'directorEmail' já tem o email salvo no perfil)
            if (data.directorEmail) {
                await transporter.sendMail({
                    from: `"Sistema de Agendamento" <${smtpUser}>`,
                    to: data.directorEmail,
                    subject: `Confirmação de Agendamento - ${data.departmentName}`,
                    html: `<p>Olá,</p>
                 <p>O seu agendamento para <strong>${data.departmentName}</strong> foi confirmado.</p>
                 <p><strong>Data/Hora:</strong> ${data.startTimeFormated}</p>
                 <p><strong>Pauta:</strong> ${data.description}</p>
                 ${data.attendantName ? `<p><strong>Atendente Solicitado:</strong> ${data.attendantName}</p>` : ''}
                 <hr/>
                 <p><small>Este é um e-mail automático, por favor não responda.</small></p>`,
                });
            }

            // Email para o Departamento
            if (data.departmentEmails.length > 0) {
                const attendantHighlight = data.attendantName
                    ? `<p><strong>ATENÇÃO: Este atendimento foi solicitado especificamente para o servidor(a): ${data.attendantName}</strong></p>`
                    : '';

                await transporter.sendMail({
                    from: `"Sistema de Agendamento" <${smtpUser}>`,
                    bcc: data.departmentEmails,
                    subject: `Novo Agendamento Recebido - ${data.schoolName}`,
                    html: `<p>Olá equipe do <strong>${data.departmentName}</strong>,</p>
                 <p>Um novo agendamento foi realizado por <strong>${data.schoolName}</strong>.</p>
                 <p><strong>Data/Hora:</strong> ${data.startTimeFormated}</p>
                 <p><strong>Pauta:</strong> ${data.description}</p>
                 ${attendantHighlight}
                 <p><a href="#">Acesse o sistema para mais detalhes.</a></p>`,
                });
            }

            // Email para o Atendente Específico (se existir e tiver email)
            if (data.attendantEmail) {
                await transporter.sendMail({
                    from: `"Sistema de Agendamento" <${smtpUser}>`,
                    to: data.attendantEmail,
                    subject: `Novo Agendamento Direcionado a Você - ${data.schoolName}`,
                    html: `<p>Olá <strong>${data.attendantName}</strong>,</p>
                 <p>A escola <strong>${data.schoolName}</strong> realizou um agendamento e <strong>solicitou especificamente o seu atendimento</strong>.</p>
                 <p><strong>Data/Hora:</strong> ${data.startTimeFormated}</p>
                 <p><strong>Pauta:</strong> ${data.description}</p>
                 <p><a href="#">Acesse o sistema para ver os detalhes da reunião.</a></p>`,
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
                        html: `<p>Olá,</p>${cancelHtml}`,
                    });
                }

                if (data.departmentEmails.length > 0) {
                    await transporter.sendMail({
                        from: `"Sistema de Agendamento" <${smtpUser}>`,
                        bcc: data.departmentEmails,
                        subject: `[Cancelado] Agendamento - ${data.schoolName}`,
                        html: `<p>Olá equipe,</p>${cancelHtml}`,
                    });
                }

                if (data.attendantEmail) {
                    await transporter.sendMail({
                        from: `"Sistema de Agendamento" <${smtpUser}>`,
                        to: data.attendantEmail,
                        subject: `[Cancelado] Agendamento Direcionado - ${data.schoolName}`,
                        html: `<p>Olá ${data.attendantName},</p>${cancelHtml}`,
                    });
                }
            }

            // 2B. Feedbacks (Department Notes, Rating, School Notes) só se alterado nesta query

            // Feedback do Departamento (department_notes)
            if (record.department_notes && record.department_notes !== old_record.department_notes) {
                if (data.directorEmail) {
                    await transporter.sendMail({
                        from: `"Sistema de Agendamento" <${smtpUser}>`,
                        to: data.directorEmail,
                        subject: `Novo Feedback do Setor - ${data.departmentName}`,
                        html: `<p>Olá,</p>
                   <p>O setor <strong>${data.departmentName}</strong> inseriu um feedback referente ao atendimento do dia <strong>${data.startTimeFormated}</strong>.</p>
                   <div style="background:#f4f4f4;padding:10px;margin-top:10px;">
                     <p><strong>Feedback:</strong><br/>${record.department_notes}</p>
                   </div>
                   <p><small>Acesse o sistema para mais detalhes.</small></p>`,
                    });
                }
            }

            // Avaliação da Escola (rating ou school_notes alterado)
            const isRatingChanged = record.rating !== old_record.rating && record.rating !== null;
            const isSchoolNotesChanged = record.school_notes !== old_record.school_notes && record.school_notes !== null;

            if (isRatingChanged || isSchoolNotesChanged) {
                if (data.departmentEmails.length > 0) {
                    const ratingText = record.rating ? `<p><strong>Avaliação:</strong> ${record.rating} Estrela(s)</p>` : '';
                    const notesText = record.school_notes ? `<p><strong>Anotações da Escola:</strong><br/>${record.school_notes}</p>` : '';

                    await transporter.sendMail({
                        from: `"Sistema de Agendamento" <${smtpUser}>`,
                        bcc: data.departmentEmails,
                        subject: `Nova Avaliação de Atendimento - ${data.schoolName}`,
                        html: `<p>Olá equipe do <strong>${data.departmentName}</strong>,</p>
                   <p>A escola <strong>${data.schoolName}</strong> avaliou o atendimento realizado em <strong>${data.startTimeFormated}</strong>.</p>
                   <div style="background:#f9f9eb;padding:10px;margin-top:10px;border-left:4px solid #f59e0b;">
                     ${ratingText}
                     ${notesText}
                   </div>
                   <p><small>Acesse o sistema para ver o histórico completo.</small></p>`,
                    });
                }
            }
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        console.error("Error processing webhook:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
