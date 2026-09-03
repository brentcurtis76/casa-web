// Shared fail-closed authorization guard for CASA edge functions.
//
// Verifies the caller's bearer token, then evaluates a resource/action
// permission via an injected dependency. Every failure path returns a
// JSON response with CORS + Content-Type headers so callers can simply
// return `result.response` without any additional shaping.
//
// Design notes:
//   * No network I/O or environment reads at import time — pure module.
//   * `deps` is injectable so tests can exercise every branch without
//     touching Supabase or the network.
//   * Backend / transport / 5xx failures always fail-closed with 503
//     `AUTHZ_BACKEND_ERROR`; a missing or invalid credential is 401
//     `UNAUTHORIZED`; an authenticated user without permission is 403
//     `FORBIDDEN`.

export interface AuthzUser {
  id: string;
  email?: string;
}

export type GetUserOutcome =
  | { kind: "authenticated"; user: AuthzUser }
  | { kind: "unauthenticated" }
  | { kind: "backend_error"; error?: unknown };

export type CheckPermissionOutcome =
  | { kind: "allowed" }
  | { kind: "denied" }
  | { kind: "backend_error"; error?: unknown };

export interface RequirePermissionDeps {
  getUser(token: string): Promise<GetUserOutcome>;
  checkPermission(
    userId: string,
    resource: string,
    action: string,
  ): Promise<CheckPermissionOutcome>;
}

export interface RequirePermissionOpts {
  resource: string;
  action: string;
  corsHeaders: Record<string, string>;
}

export interface AuthzOk {
  ok: true;
  user: AuthzUser;
}

export interface AuthzFail {
  ok: false;
  response: Response;
}

export type AuthzResult = AuthzOk | AuthzFail;

function fail(
  status: number,
  code: "UNAUTHORIZED" | "FORBIDDEN" | "AUTHZ_BACKEND_ERROR",
  corsHeaders: Record<string, string>,
): AuthzFail {
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  return {
    ok: false,
    response: new Response(
      JSON.stringify({ success: false, code }),
      { status, headers },
    ),
  };
}

/**
 * Reads the `role` claim of a JWT-shaped bearer token WITHOUT verifying it.
 * Used only to refuse, before any network call, tokens that can never
 * represent a user session: the project's `anon` key and any `service_role`
 * credential a caller might present. Everything else (including malformed
 * tokens) is still decided by `deps.getUser`, exactly as before.
 */
export function readUnverifiedJwtRole(token: string): string | undefined {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((p) => p.length === 0 || !/^[A-Za-z0-9_-]+$/.test(p))) {
    return undefined;
  }
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload: unknown = JSON.parse(atob(padded));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
    const role = (payload as { role?: unknown }).role;
    return typeof role === "string" ? role : undefined;
  } catch {
    return undefined;
  }
}

/** Bearer roles that are credentials, never user sessions. Refused up front. */
const NON_SESSION_ROLES: ReadonlySet<string> = new Set(["service_role", "anon"]);

export async function requirePermission(
  req: Request,
  deps: RequirePermissionDeps,
  opts: RequirePermissionOpts,
): Promise<AuthzResult> {
  const { corsHeaders, resource, action } = opts;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return fail(401, "UNAUTHORIZED", corsHeaders);
  }
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return fail(401, "UNAUTHORIZED", corsHeaders);
  }
  // The anon key or a service_role credential presented as the bearer token is
  // never a user session: refuse it here, with no backend round trip.
  const role = readUnverifiedJwtRole(token);
  if (role !== undefined && NON_SESSION_ROLES.has(role)) {
    return fail(401, "UNAUTHORIZED", corsHeaders);
  }

  let authOutcome: GetUserOutcome;
  try {
    authOutcome = await deps.getUser(token);
  } catch (_e) {
    return fail(503, "AUTHZ_BACKEND_ERROR", corsHeaders);
  }

  if (authOutcome.kind === "backend_error") {
    return fail(503, "AUTHZ_BACKEND_ERROR", corsHeaders);
  }
  if (authOutcome.kind === "unauthenticated") {
    return fail(401, "UNAUTHORIZED", corsHeaders);
  }

  const user = authOutcome.user;

  let permOutcome: CheckPermissionOutcome;
  try {
    permOutcome = await deps.checkPermission(user.id, resource, action);
  } catch (_e) {
    return fail(503, "AUTHZ_BACKEND_ERROR", corsHeaders);
  }

  if (permOutcome.kind === "backend_error") {
    return fail(503, "AUTHZ_BACKEND_ERROR", corsHeaders);
  }
  if (permOutcome.kind === "denied") {
    return fail(403, "FORBIDDEN", corsHeaders);
  }

  return { ok: true, user };
}

/**
 * The one permission every AI image/story generation function requires. The
 * Cuentacuentos editor mirrors it (src/components/liturgia-builder/editors/
 * imageGenerationAccess.ts) and scripts/security/authorization-policy_test.ts
 * asserts both sides agree.
 */
export const LITURGY_WRITER_PERMISSION = {
  resource: "liturgy_builder",
  action: "write",
} as const;

export function requireLiturgyWriter(
  req: Request,
  deps: RequirePermissionDeps,
  corsHeaders: Record<string, string>,
): Promise<AuthzResult> {
  return requirePermission(req, deps, {
    resource: LITURGY_WRITER_PERMISSION.resource,
    action: LITURGY_WRITER_PERMISSION.action,
    corsHeaders,
  });
}

// Adapter that binds `RequirePermissionDeps` to a Supabase service-role
// client. Kept separate from `requirePermission` so tests can exercise
// the guard without any Supabase imports.
//
// The RPC call MUST use the parameter name `p_user_id` (not `p_user`) —
// this is the SQL signature of `public.has_permission` in production.
type SupabaseAuthGetUser = (
  token: string,
) => PromiseLike<{
  data: { user: { id: string; email?: string } | null };
  error: { status?: number } | null;
}>;

type SupabaseRpc = (
  fn: string,
  params: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;

export interface SupabaseAdminLike {
  auth: { getUser: SupabaseAuthGetUser };
  rpc: SupabaseRpc;
}

export function createSupabaseAuthzDeps(
  supabaseAdmin: SupabaseAdminLike,
): RequirePermissionDeps {
  return {
    async getUser(token: string): Promise<GetUserOutcome> {
      try {
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (error) {
          const status = (error as { status?: number }).status;
          if (status === 400 || status === 401 || status === 403) {
            return { kind: "unauthenticated" };
          }
          return { kind: "backend_error", error };
        }
        const user = data?.user;
        if (!user) {
          return { kind: "unauthenticated" };
        }
        return {
          kind: "authenticated",
          user: { id: user.id, email: user.email },
        };
      } catch (e) {
        return { kind: "backend_error", error: e };
      }
    },
    async checkPermission(
      userId: string,
      resource: string,
      action: string,
    ): Promise<CheckPermissionOutcome> {
      try {
        const { data, error } = await supabaseAdmin.rpc("has_permission", {
          p_user_id: userId,
          p_resource: resource,
          p_action: action,
        });
        if (error) {
          return { kind: "backend_error", error };
        }
        return data === true ? { kind: "allowed" } : { kind: "denied" };
      } catch (e) {
        return { kind: "backend_error", error: e };
      }
    },
  };
}
