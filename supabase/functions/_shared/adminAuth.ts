// Shared admin authorization helper for La Mesa Abierta edge functions.
// Mirrors the inline auth block in admin-add-participant: header check,
// auth.getUser(token), then mesa_abierta_admin_roles membership check.

interface AdminAuthUser {
  id: string;
  email?: string;
}

// Minimal structural view of the client so this helper stays compatible
// with the multiple @supabase/supabase-js versions imported across edge
// functions (SupabaseClient has private members, so cross-version class
// types are not assignable to each other).
interface SupabaseAdminLike {
  auth: {
    getUser(token: string): Promise<{
      data: { user: AdminAuthUser | null };
      error: unknown;
    }>;
  };
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        single(): Promise<{ data: unknown }>;
      };
    };
  };
}

export interface AdminAuthOk {
  ok: true;
  user: AdminAuthUser;
}

export interface AdminAuthFail {
  ok: false;
  response: Response;
}

export type AdminAuthResult = AdminAuthOk | AdminAuthFail;

export async function requireMesaAdmin(
  req: Request,
  supabaseAdmin: SupabaseAdminLike,
  corsHeaders: Record<string, string>,
): Promise<AdminAuthResult> {
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ success: false, error: "No authorization header" }),
        { status: 401, headers: jsonHeaders },
      ),
    };
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: jsonHeaders },
      ),
    };
  }

  const { data: adminRole } = await supabaseAdmin
    .from("mesa_abierta_admin_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!adminRole) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ success: false, error: "User is not an admin" }),
        { status: 403, headers: jsonHeaders },
      ),
    };
  }

  return { ok: true, user };
}
