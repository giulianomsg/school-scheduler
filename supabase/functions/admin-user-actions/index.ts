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

    const { action, userId, email, password, linkType } = await req.json();

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
          email,
        });
        if (error) throw error;
        result = {
          success: true,
          link: data?.properties?.action_link,
          message:
            type === "recovery"
              ? "Link de redefinição gerado"
              : "Link mágico gerado",
        };
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
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
