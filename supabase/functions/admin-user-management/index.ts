import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // ── Verify JWT ──────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "No authorization header" }, 200);
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ success: false, error: "Token inválido" }, 200);
    }

    // ── Verify caller is general_admin ──────────────────────────────────
    const { data: adminRoleRow } = await supabaseAdmin
      .from("church_user_roles")
      .select("id, church_roles!inner(name)")
      .eq("user_id", user.id)
      .eq("church_roles.name", "general_admin")
      .maybeSingle();

    if (!adminRoleRow) {
      return jsonResponse(
        { success: false, error: "No tienes permisos de administrador" },
        200
      );
    }

    // ── Parse request body ──────────────────────────────────────────────
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return jsonResponse({ success: false, error: "Falta el campo 'action'" }, 200);
    }

    // ── Action dispatcher ───────────────────────────────────────────────
    switch (action) {
      case "create-user":
        return await handleCreateUser(supabaseAdmin, body, user.id);
      case "delete-user":
        return await handleDeleteUser(supabaseAdmin, body, user.id);
      case "reset-password":
        return await handleResetPassword(supabaseAdmin, body, user.id, req);
      default:
        return jsonResponse(
          { success: false, error: `Acción desconocida: ${action}` },
          200
        );
    }
  } catch (error) {
    console.error("Error in admin-user-management:", error);
    return jsonResponse(
      { success: false, error: "Error interno del servidor" },
      200
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// create-user
// ═══════════════════════════════════════════════════════════════════════════════

async function handleCreateUser(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  adminUserId: string
) {
  const { email, fullName, tempPassword, roles } = body as {
    email?: string;
    fullName?: string;
    tempPassword?: string;
    roles?: string[];
  };

  if (!email || !fullName || !tempPassword) {
    return jsonResponse(
      { success: false, error: "Se requieren email, fullName y tempPassword" },
      200
    );
  }

  // Create user in Supabase Auth
  const { data: newUser, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        must_change_password: true,
      },
    });

  if (createError || !newUser.user) {
    console.error("Error creating user:", createError);
    return jsonResponse(
      {
        success: false,
        error: createError?.message || "Error al crear el usuario",
      },
      200
    );
  }

  const userId = newUser.user.id;

  // Upsert profile
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert({ id: userId, full_name: fullName });

  if (profileError) {
    console.error("Error upserting profile:", profileError);
    // Non-blocking — user was already created in auth
  }

  // Assign initial roles if provided
  if (roles && roles.length > 0) {
    // Look up role IDs from church_roles by name
    const { data: roleRows } = await supabaseAdmin
      .from("church_roles")
      .select("id, name")
      .in("name", roles);

    if (roleRows && roleRows.length > 0) {
      const inserts = roleRows.map((r: { id: string; name: string }) => ({
        user_id: userId,
        role_id: r.id,
        assigned_by: adminUserId,
      }));

      const { error: rolesError } = await supabaseAdmin
        .from("church_user_roles")
        .insert(inserts);

      if (rolesError) {
        console.error("Error assigning roles:", rolesError);
        // Non-blocking — user was already created
      }
    }
  }

  // Audit log
  try {
    await supabaseAdmin.from("church_audit_log").insert({
      user_id: adminUserId,
      action_type: "user_created",
      target_user_id: userId,
      details: {
        email,
        full_name: fullName,
        roles: roles || [],
      },
    });
  } catch {
    // Audit log failure is non-blocking
  }

  console.log(
    `Admin ${adminUserId} created user ${email} (${userId}) with roles: ${(roles || []).join(", ")}`
  );

  return jsonResponse(
    {
      success: true,
      userId,
      message: `Usuario ${fullName} creado exitosamente`,
    },
    200
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// delete-user
// ═══════════════════════════════════════════════════════════════════════════════

async function handleDeleteUser(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  adminUserId: string
) {
  const { userId } = body as { userId?: string };

  if (!userId) {
    return jsonResponse(
      { success: false, error: "Se requiere userId" },
      200
    );
  }

  if (!UUID_RE.test(userId)) {
    return jsonResponse(
      { success: false, error: "userId no es un UUID válido" },
      200
    );
  }

  // Prevent self-deletion
  if (userId === adminUserId) {
    return jsonResponse(
      { success: false, error: "No puedes eliminar tu propia cuenta" },
      200
    );
  }

  // Look up user info for audit log before deletion
  const { data: targetUserData } = await supabaseAdmin.auth.admin.getUserById(
    userId
  );
  const targetEmail = targetUserData?.user?.email || "unknown";

  if (targetUserData?.user) {
    // Delete user from auth (cascades to profiles and church_user_roles via FK)
    const { error: deleteError } =
      await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Error deleting user:", deleteError);
      return jsonResponse(
        {
          success: false,
          error: deleteError.message || "Error al eliminar el usuario",
        },
        200
      );
    }
  } else {
    // Orphaned profile (exists in profiles but not in auth.users) — clean up manually
    console.log(`User ${userId} not found in auth.users, cleaning up orphaned data`);
    await supabaseAdmin.from("church_user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);
  }

  // Audit log
  try {
    await supabaseAdmin.from("church_audit_log").insert({
      user_id: adminUserId,
      action_type: "user_deleted",
      target_user_id: null, // User no longer exists; cannot reference
      details: {
        deleted_user_id: userId,
        deleted_email: targetEmail,
      },
    });
  } catch {
    // Audit log failure is non-blocking
  }

  console.log(`Admin ${adminUserId} deleted user ${targetEmail} (${userId})`);

  return jsonResponse(
    {
      success: true,
      message: `Usuario eliminado exitosamente`,
    },
    200
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// reset-password
// ═══════════════════════════════════════════════════════════════════════════════

async function handleResetPassword(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  adminUserId: string,
  req: Request
) {
  const { userId, email: providedEmail } = body as {
    userId?: string;
    email?: string;
  };

  if (!userId && !providedEmail) {
    return jsonResponse(
      { success: false, error: "Se requiere userId o email" },
      200
    );
  }

  if (userId && !UUID_RE.test(userId)) {
    return jsonResponse(
      { success: false, error: "userId no es un UUID válido" },
      200
    );
  }

  let email = providedEmail;

  // Look up email if not provided
  if (!email && userId) {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(
      userId
    );
    email = userData?.user?.email || undefined;
  }

  if (!email) {
    return jsonResponse(
      { success: false, error: "No se pudo obtener el correo del usuario" },
      200
    );
  }

  // Generate recovery link
  const origin = req.headers.get("origin") || "https://casa-web.vercel.app";
  const { error: linkError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${origin}/reset-password`,
      },
    });

  if (linkError) {
    console.error("Error generating recovery link:", linkError);
    return jsonResponse(
      {
        success: false,
        error:
          linkError.message ||
          "Error al generar el enlace de recuperación",
      },
      200
    );
  }

  // Audit log
  try {
    await supabaseAdmin.from("church_audit_log").insert({
      user_id: adminUserId,
      action_type: "password_reset_sent",
      target_user_id: userId || null,
      details: {
        target_email: email,
      },
    });
  } catch {
    // Audit log failure is non-blocking
  }

  console.log(
    `Admin ${adminUserId} triggered password reset for ${email}`
  );

  return jsonResponse(
    {
      success: true,
      message: `Correo de recuperación enviado a ${email}`,
    },
    200
  );
}
