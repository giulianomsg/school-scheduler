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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    const { action, userId, email, password, linkType, redirectTo } = await req.json();

    if (!action) {
      return new Response(JSON.stringify({ error: "Action is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any = {};

    switch (action) {
      case "deleteUser": {
        if (!userId) throw new Error("userId is required");
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw error;
        result = { success: true, message: "Usuário excluído com sucesso" };
        break;
      }

      case "suspendUser": {
        if (!userId) throw new Error("userId is required");
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: "876600h", // ~100 years
        });
        if (error) throw error;
        // Invalidar todas as sessões ativas do usuário
        await supabaseAdmin.auth.admin.signOut(userId, "global");
        result = { success: true, message: "Usuário suspenso com sucesso" };
        break;
      }

      case "reactivateUser": {
        if (!userId) throw new Error("userId is required");
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: "none",
        });
        if (error) throw error;
        result = { success: true, message: "Usuário reativado com sucesso" };
        break;
      }

      case "generateLink": {
        if (!email) throw new Error("email is required");
        const type = linkType === "recovery" ? "recovery" : "magiclink";
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
          type,
          email: email,
          options: redirectTo ? { redirectTo } : undefined,
        });
        if (error) throw error;
        
        let finalLink = data?.properties?.action_link || "";
        // Force the redirect_to to have /set-password regardless of Supabase stripping
        if (type === "recovery" && finalLink.includes("redirect_to=") && !finalLink.includes("set-password")) {
             finalLink = finalLink.replace(/redirect_to=([^&]+)/, "redirect_to=" + encodeURIComponent("https://agenda.educacao.riopreto.br/set-password"));
        }

        result = {
          success: true,
          link: finalLink,
          message: type === "recovery" ? "Link de redefinição gerado" : "Link mágico gerado",
        };
        break;
      }

      case "sendRecoveryEmail": {
        if (!email) throw new Error("email is required");
        
        // 1. Gera o Link
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email: email,
          options: { redirectTo: "https://agenda.educacao.riopreto.br/set-password" },
        });
        if (error) throw new Error("Falha ao gerar link: " + error.message);
        
        let finalLink = data?.properties?.action_link || "";
        if (finalLink.includes("redirect_to=") && !finalLink.includes("set-password")) {
             finalLink = finalLink.replace(/redirect_to=([^&]+)/, "redirect_to=" + encodeURIComponent("https://agenda.educacao.riopreto.br/set-password"));
        }

        // 2. Importa e Envia via Nodemailer
        const nodemailer = await import("npm:nodemailer");
        const smtpUser = Deno.env.get("SMTP_USER");
        const smtpPass = Deno.env.get("SMTP_PASS");

        if (!smtpUser || !smtpPass) {
            throw new Error("Credenciais SMTP não configuradas no servidor.");
        }

        const transporter = nodemailer.default.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });

        const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Agenda SME - Redefinição de Senha</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; color: #333333; margin: 0; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://educacao.riopreto.br/ramais/public/assets/brasao@2x.png" alt="Brasão da Prefeitura Municipal de São José do Rio Preto" style="max-width: 120px; height: auto; display: block; margin: 0 auto;">
            <h1 style="font-size: 22px; margin: 15px 0 5px 0; color: #222222;">Prefeitura Municipal de São José do Rio Preto</h1>
            <h2 style="font-size: 16px; margin: 0; color: #666666; font-weight: normal;">Secretaria Municipal de Educação</h2>
        </div>
        <hr style="border: none; border-top: 1px solid #eeeeee; margin-bottom: 30px;">
        <div style="text-align: center; margin-bottom: 40px;">
            <h3 style="font-size: 20px; color: #333333; margin-top: 0;">Agenda SME - Redefinição de Senha</h3>
            <p style="font-size: 16px; line-height: 1.6; color: #555555;">Você solicitou a redefinição da sua senha de acesso. Clique no botão abaixo para cadastrar uma nova senha segura:</p>
            <p style="margin-top: 25px;">
                <a href="${finalLink}" style="background-color: #0056b3; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-weight: bold; display: inline-block;">Redefinir minha Senha</a>
            </p>
            <p style="font-size: 13px; color: #777; margin-top: 20px;">Se você não solicitou esta ação, por favor ignore este e-mail.</p>
        </div>
        <hr style="border: none; border-top: 1px solid #eeeeee; margin-bottom: 20px;">
        <div style="font-size: 14px; line-height: 1.6; color: #444444; margin-bottom: 25px;">
            <p style="margin: 0 0 10px 0;">Dúvidas, entre em contato com a Gerência de Educação Digital.</p>
            <p style="margin: 0;"><strong>Telefone:</strong> (17) 3211-4014</p>
        </div>
    </div>
</body>
</html>`;

        await transporter.sendMail({
            from: `"Agenda SME" <${smtpUser}>`,
            to: email,
            subject: "Solicitação de Redefinição de Senha - Agenda SME",
            html: htmlContent,
        });

        result = { success: true, message: "E-mail de redefinição enviado com sucesso via servidor." };
        break;
      }

      case "updatePassword": {
        if (!userId || !password) throw new Error("userId and password are required");
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password,
        });
        if (error) throw error;
        result = { success: true, message: "Senha atualizada com sucesso" };
        break;
      }

      case "listAuthUsers": {
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
        if (error) throw error;
        result = {
          success: true,
          users: users.map(u => ({
            id: u.id,
            last_sign_in_at: u.last_sign_in_at,
            email_confirmed_at: u.email_confirmed_at || (u as any).confirmed_at,
            banned_until: u.banned_until,
            created_at: u.created_at
          }))
        };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
