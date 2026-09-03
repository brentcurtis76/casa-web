// Unit tests for the shared liturgy authorization guard.
// Purely synthetic — no network, no Supabase client imports.

// deno-lint-ignore-file require-await

import { assertEquals, assertStrictEquals } from "@std/assert";

import {
  type CheckPermissionOutcome,
  createSupabaseAuthzDeps,
  type GetUserOutcome,
  LITURGY_WRITER_PERMISSION,
  readUnverifiedJwtRole,
  requireAnyPermission,
  requireLiturgyWriter,
  requirePermission,
  type RequirePermissionDeps,
} from "./liturgyAuth.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, content-type",
};

const RESOURCE = "liturgy_builder";
const ACTION = "write";
const USER = { id: "user-123", email: "user@example.com" };

type Call =
  | { kind: "getUser"; token: string }
  | {
    kind: "checkPermission";
    userId: string;
    resource: string;
    action: string;
  };

function makeDeps(overrides: {
  getUser?: (token: string) => Promise<GetUserOutcome>;
  checkPermission?: (
    userId: string,
    resource: string,
    action: string,
  ) => Promise<CheckPermissionOutcome>;
}): { deps: RequirePermissionDeps; calls: Call[] } {
  const calls: Call[] = [];
  const deps: RequirePermissionDeps = {
    getUser: async (token) => {
      calls.push({ kind: "getUser", token });
      if (overrides.getUser) return await overrides.getUser(token);
      return { kind: "authenticated", user: USER };
    },
    checkPermission: async (userId, resource, action) => {
      calls.push({ kind: "checkPermission", userId, resource, action });
      if (overrides.checkPermission) {
        return await overrides.checkPermission(userId, resource, action);
      }
      return { kind: "allowed" };
    },
  };
  return { deps, calls };
}

function requestWith(headers: Record<string, string> = {}): Request {
  return new Request("https://edge.test/liturgy", { headers });
}

async function readBody(res: Response): Promise<unknown> {
  return await res.json();
}

function assertCors(res: Response) {
  for (const [k, v] of Object.entries(CORS)) {
    assertEquals(res.headers.get(k), v, `missing CORS header ${k}`);
  }
  assertEquals(res.headers.get("Content-Type"), "application/json");
}

// T-0.1 — Missing Authorization header: 401 UNAUTHORIZED, zero backend calls.
Deno.test("T-0.1 missing Authorization returns 401 UNAUTHORIZED and calls no backend", async () => {
  const { deps, calls } = makeDeps({});
  const result = await requirePermission(requestWith(), deps, {
    resource: RESOURCE,
    action: ACTION,
    corsHeaders: CORS,
  });

  assertStrictEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.response.status, 401);
  assertCors(result.response);
  assertEquals(await readBody(result.response), {
    success: false,
    code: "UNAUTHORIZED",
  });
  assertEquals(calls.length, 0);
});

// T-0.2 — Invalid / expired credential: 401 UNAUTHORIZED, permission RPC never called.
Deno.test("T-0.2 invalid credential returns 401 UNAUTHORIZED and skips permission check", async () => {
  const { deps, calls } = makeDeps({
    getUser: async () => ({ kind: "unauthenticated" }),
  });
  const result = await requirePermission(
    requestWith({ Authorization: "Bearer expired.jwt.token" }),
    deps,
    { resource: RESOURCE, action: ACTION, corsHeaders: CORS },
  );

  assertStrictEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.response.status, 401);
  assertCors(result.response);
  assertEquals(await readBody(result.response), {
    success: false,
    code: "UNAUTHORIZED",
  });
  // Only getUser was called; checkPermission must not run.
  assertEquals(calls.length, 1);
  assertEquals(calls[0], { kind: "getUser", token: "expired.jwt.token" });
});

// T-0.3 — Authenticated user, permission denied (false): 403 FORBIDDEN.
Deno.test("T-0.3 authenticated user without permission returns 403 FORBIDDEN", async () => {
  const { deps, calls } = makeDeps({
    checkPermission: async () => ({ kind: "denied" }),
  });
  const result = await requirePermission(
    requestWith({ Authorization: "Bearer good.jwt" }),
    deps,
    { resource: RESOURCE, action: ACTION, corsHeaders: CORS },
  );

  assertStrictEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.response.status, 403);
  assertCors(result.response);
  assertEquals(await readBody(result.response), {
    success: false,
    code: "FORBIDDEN",
  });
  assertEquals(calls.length, 2);
});

// T-0.4a — Auth backend error / 5xx during getUser: 503 AUTHZ_BACKEND_ERROR.
Deno.test("T-0.4a auth backend error returns 503 AUTHZ_BACKEND_ERROR", async () => {
  const { deps, calls } = makeDeps({
    getUser: async () => ({ kind: "backend_error", error: new Error("boom") }),
  });
  const result = await requirePermission(
    requestWith({ Authorization: "Bearer any.jwt" }),
    deps,
    { resource: RESOURCE, action: ACTION, corsHeaders: CORS },
  );

  assertStrictEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.response.status, 503);
  assertCors(result.response);
  assertEquals(await readBody(result.response), {
    success: false,
    code: "AUTHZ_BACKEND_ERROR",
  });
  assertEquals(calls.length, 1);
});

// T-0.4b — Permission RPC error: 503 AUTHZ_BACKEND_ERROR (fail-closed).
Deno.test("T-0.4b permission RPC error returns 503 AUTHZ_BACKEND_ERROR", async () => {
  const { deps, calls } = makeDeps({
    checkPermission: async () => ({
      kind: "backend_error",
      error: { message: "connection reset" },
    }),
  });
  const result = await requirePermission(
    requestWith({ Authorization: "Bearer any.jwt" }),
    deps,
    { resource: RESOURCE, action: ACTION, corsHeaders: CORS },
  );

  assertStrictEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.response.status, 503);
  assertCors(result.response);
  assertEquals(await readBody(result.response), {
    success: false,
    code: "AUTHZ_BACKEND_ERROR",
  });
  assertEquals(calls.length, 2);
});

// T-0.6 — Happy path: authenticated user with permission returns ok with user.
Deno.test("T-0.6 authenticated user with permission returns ok user", async () => {
  const { deps, calls } = makeDeps({});
  const result = await requirePermission(
    requestWith({ Authorization: "Bearer good.jwt" }),
    deps,
    { resource: RESOURCE, action: ACTION, corsHeaders: CORS },
  );

  assertStrictEquals(result.ok, true);
  if (!result.ok) return;
  assertEquals(result.user, USER);
  assertEquals(calls.length, 2);
  assertEquals(calls[0], { kind: "getUser", token: "good.jwt" });
  assertEquals(calls[1], {
    kind: "checkPermission",
    userId: USER.id,
    resource: RESOURCE,
    action: ACTION,
  });
});

// T-0.7 — Exception thrown by dep: still fail-closed 503 AUTHZ_BACKEND_ERROR.
Deno.test("T-0.7 thrown exceptions are fail-closed to 503 AUTHZ_BACKEND_ERROR", async () => {
  // Thrown from getUser
  {
    const { deps } = makeDeps({
      getUser: () => {
        throw new Error("network down");
      },
    });
    const result = await requirePermission(
      requestWith({ Authorization: "Bearer x" }),
      deps,
      { resource: RESOURCE, action: ACTION, corsHeaders: CORS },
    );
    assertStrictEquals(result.ok, false);
    if (result.ok) return;
    assertEquals(result.response.status, 503);
    assertCors(result.response);
    assertEquals(await readBody(result.response), {
      success: false,
      code: "AUTHZ_BACKEND_ERROR",
    });
  }
  // Thrown from checkPermission
  {
    const { deps } = makeDeps({
      checkPermission: () => {
        throw new Error("kaboom");
      },
    });
    const result = await requirePermission(
      requestWith({ Authorization: "Bearer x" }),
      deps,
      { resource: RESOURCE, action: ACTION, corsHeaders: CORS },
    );
    assertStrictEquals(result.ok, false);
    if (result.ok) return;
    assertEquals(result.response.status, 503);
    assertCors(result.response);
    assertEquals(await readBody(result.response), {
      success: false,
      code: "AUTHZ_BACKEND_ERROR",
    });
  }
});

// T-0.9 (RPC part) — Supabase adapter sends exact RPC payload with p_user_id.
Deno.test("T-0.9 supabase adapter calls has_permission with { p_user_id, p_resource, p_action }", async () => {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const fakeAdmin = {
    auth: {
      getUser: async (_token: string) => ({
        data: { user: { id: "u-999", email: "x@y.z" } },
        error: null,
      }),
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return { data: true, error: null };
    },
  };

  const deps = createSupabaseAuthzDeps(fakeAdmin);
  const result = await requireLiturgyWriter(
    requestWith({ Authorization: "Bearer good.jwt" }),
    deps,
    CORS,
  );

  assertStrictEquals(result.ok, true);
  if (!result.ok) return;
  assertEquals(result.user.id, "u-999");

  assertEquals(rpcCalls.length, 1);
  assertEquals(rpcCalls[0].fn, "has_permission");
  assertEquals(rpcCalls[0].args, {
    p_user_id: "u-999",
    p_resource: "liturgy_builder",
    p_action: "write",
  });
  // Guardrail: legacy `p_user` name must NOT appear.
  assertStrictEquals(
    Object.prototype.hasOwnProperty.call(rpcCalls[0].args, "p_user"),
    false,
  );
});

// T-0.4c — Adapter classifies transport-layer errors (status 0) as
// backend_error, not unauthenticated. supabase-js returns
// AuthRetryableFetchError with `status: 0` on network failures; those
// must fail-closed to 503 AUTHZ_BACKEND_ERROR (with CORS + JSON), not
// leak as 401 UNAUTHORIZED.
Deno.test("T-0.4c adapter: getUser error {status: 0} => 503 AUTHZ_BACKEND_ERROR", async () => {
  const fakeAdmin = {
    auth: {
      getUser: async (_token: string) => ({
        data: { user: null },
        error: { status: 0, message: "fetch failed" },
      }),
    },
    rpc: async (_fn: string, _args: Record<string, unknown>) => ({
      data: null,
      error: null,
    }),
  };

  const deps = createSupabaseAuthzDeps(fakeAdmin);
  const result = await requirePermission(
    requestWith({ Authorization: "Bearer any.jwt" }),
    deps,
    { resource: RESOURCE, action: ACTION, corsHeaders: CORS },
  );

  assertStrictEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.response.status, 503);
  assertCors(result.response);
  assertEquals(await readBody(result.response), {
    success: false,
    code: "AUTHZ_BACKEND_ERROR",
  });
});

// T-0.4d — Adapter classifies rate limiting (status 429) as
// backend_error. 429 is a transient backend condition, not an
// authentication failure.
Deno.test("T-0.4d adapter: getUser error {status: 429} => 503 AUTHZ_BACKEND_ERROR", async () => {
  const fakeAdmin = {
    auth: {
      getUser: async (_token: string) => ({
        data: { user: null },
        error: { status: 429, message: "too many requests" },
      }),
    },
    rpc: async (_fn: string, _args: Record<string, unknown>) => ({
      data: null,
      error: null,
    }),
  };

  const deps = createSupabaseAuthzDeps(fakeAdmin);
  const result = await requirePermission(
    requestWith({ Authorization: "Bearer any.jwt" }),
    deps,
    { resource: RESOURCE, action: ACTION, corsHeaders: CORS },
  );

  assertStrictEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.response.status, 503);
  assertCors(result.response);
  assertEquals(await readBody(result.response), {
    success: false,
    code: "AUTHZ_BACKEND_ERROR",
  });
});

// T-0.4e — Adapter classifies errors without a status field as
// backend_error. An error object with no `status` is ambiguous and
// must not be treated as a credential rejection.
Deno.test("T-0.4e adapter: getUser error without status => 503 AUTHZ_BACKEND_ERROR", async () => {
  const fakeAdmin = {
    auth: {
      getUser: async (_token: string) => ({
        data: { user: null },
        error: { message: "unknown failure" } as { status?: number },
      }),
    },
    rpc: async (_fn: string, _args: Record<string, unknown>) => ({
      data: null,
      error: null,
    }),
  };

  const deps = createSupabaseAuthzDeps(fakeAdmin);
  const result = await requirePermission(
    requestWith({ Authorization: "Bearer any.jwt" }),
    deps,
    { resource: RESOURCE, action: ACTION, corsHeaders: CORS },
  );

  assertStrictEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.response.status, 503);
  assertCors(result.response);
  assertEquals(await readBody(result.response), {
    success: false,
    code: "AUTHZ_BACKEND_ERROR",
  });
});

// T-0.4f — Adapter still returns 401 UNAUTHORIZED for real credential
// rejections (status 401 from the auth backend). Guards the
// unauthenticated branch from over-narrowing to zero cases.
Deno.test("T-0.4f adapter: getUser error {status: 401} => 401 UNAUTHORIZED", async () => {
  const fakeAdmin = {
    auth: {
      getUser: async (_token: string) => ({
        data: { user: null },
        error: { status: 401, message: "invalid jwt" },
      }),
    },
    rpc: async (_fn: string, _args: Record<string, unknown>) => ({
      data: null,
      error: null,
    }),
  };

  const deps = createSupabaseAuthzDeps(fakeAdmin);
  const result = await requirePermission(
    requestWith({ Authorization: "Bearer expired.jwt" }),
    deps,
    { resource: RESOURCE, action: ACTION, corsHeaders: CORS },
  );

  assertStrictEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.response.status, 401);
  assertCors(result.response);
  assertEquals(await readBody(result.response), {
    success: false,
    code: "UNAUTHORIZED",
  });
});

// T-0.9 (matrix completeness) — the five paid edge handlers use two
// distinct permission pairs: `liturgy_builder:write` for four of them
// (process-reflexion-pdf, generate-scene-images, generate-story,
// refine-story) and `oraciones:write` for generate-oraciones. The RPC
// adapter must forward the caller's exact resource/action pair with the
// production parameter name `p_user_id`. This test exercises the
// non-default pair through `requirePermission` so both matrix cells are
// covered explicitly.
Deno.test("T-0.9 supabase adapter forwards oraciones:write via requirePermission with { p_user_id, p_resource, p_action }", async () => {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const fakeAdmin = {
    auth: {
      getUser: async (_token: string) => ({
        data: { user: { id: "u-777", email: "o@y.z" } },
        error: null,
      }),
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return { data: true, error: null };
    },
  };

  const deps = createSupabaseAuthzDeps(fakeAdmin);
  const result = await requirePermission(
    requestWith({ Authorization: "Bearer good.jwt" }),
    deps,
    { resource: "oraciones", action: "write", corsHeaders: CORS },
  );

  assertStrictEquals(result.ok, true);
  if (!result.ok) return;
  assertEquals(result.user.id, "u-777");

  assertEquals(rpcCalls.length, 1);
  assertEquals(rpcCalls[0].fn, "has_permission");
  assertEquals(rpcCalls[0].args, {
    p_user_id: "u-777",
    p_resource: "oraciones",
    p_action: "write",
  });
  // Guardrail: legacy `p_user` name must NOT appear.
  assertStrictEquals(
    Object.prototype.hasOwnProperty.call(rpcCalls[0].args, "p_user"),
    false,
  );
});

// ---------------------------------------------------------------------------
// Credential-shaped bearer tokens (anon key, service_role) are refused before
// any backend call. Tokens are synthetic, built at runtime.
// ---------------------------------------------------------------------------

function b64url(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fakeJwt(payload: Record<string, unknown>): string {
  return [b64url({ alg: "HS256", typ: "JWT" }), b64url(payload), "x".repeat(43)].join(".");
}
function bearerRequest(token: string): Request {
  return new Request("https://edge.test/fn", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
}

Deno.test("readUnverifiedJwtRole reads the role claim and returns undefined for anything else", () => {
  assertStrictEquals(readUnverifiedJwtRole(fakeJwt({ role: "authenticated", sub: "u1" })), "authenticated");
  assertStrictEquals(readUnverifiedJwtRole(fakeJwt({ role: "service_role" })), "service_role");
  assertStrictEquals(readUnverifiedJwtRole(fakeJwt({ sub: "u1" })), undefined);
  assertStrictEquals(readUnverifiedJwtRole("t".repeat(40)), undefined);
  assertStrictEquals(readUnverifiedJwtRole("a.b"), undefined);
  assertStrictEquals(readUnverifiedJwtRole("a.!!!.c"), undefined);
});

Deno.test("a service_role credential presented as bearer is refused with 401 and never reaches the backend", async () => {
  const { deps, calls } = makeDeps({});
  const result = await requirePermission(bearerRequest(fakeJwt({ role: "service_role", iss: "supabase" })), deps, {
    resource: RESOURCE,
    action: ACTION,
    corsHeaders: CORS,
  });
  assertStrictEquals(result.ok, false);
  if (!result.ok) {
    assertStrictEquals(result.response.status, 401);
    assertEquals(await result.response.json(), { success: false, code: "UNAUTHORIZED" });
  }
  assertEquals(calls, []);
});

Deno.test("the anon key presented as bearer is refused with 401 and never reaches the backend", async () => {
  const { deps, calls } = makeDeps({});
  const result = await requireLiturgyWriter(bearerRequest(fakeJwt({ role: "anon", iss: "supabase" })), deps, CORS);
  assertStrictEquals(result.ok, false);
  if (!result.ok) assertStrictEquals(result.response.status, 401);
  assertEquals(calls, []);
});

Deno.test("a user-session token still goes through the backend, and the shared permission constant is liturgy_builder/write", async () => {
  const { deps, calls } = makeDeps({});
  const result = await requireLiturgyWriter(bearerRequest(fakeJwt({ role: "authenticated", sub: USER.id })), deps, CORS);
  assertStrictEquals(result.ok, true);
  assertStrictEquals(calls.length, 2);
  assertEquals(calls[1], { kind: "checkPermission", userId: USER.id, resource: "liturgy_builder", action: "write" });
  assertEquals({ ...LITURGY_WRITER_PERMISSION }, { resource: "liturgy_builder", action: "write" });
});

// ---------------------------------------------------------------------------
// requireUser — JWT-only guard (no permission check)
// ---------------------------------------------------------------------------

import { requireUser } from "./liturgyAuth.ts";
import {
  ANON_KEY_HEADER,
  AUTH_HEADER,
  makeAuthzDeps,
  PUBLISHABLE_KEY_HEADER,
  SERVICE_ROLE_HEADER,
  strictGetUser,
} from "./testHelpers.ts";

function userDeps(getUser = strictGetUser(USER)) {
  const calls: string[] = [];
  return {
    calls,
    deps: {
      getUser: (token: string) => {
        calls.push(token);
        return getUser(token);
      },
    },
  };
}

Deno.test("requireUser: missing Authorization is 401 and never reaches the backend", async () => {
  const { deps, calls } = userDeps();
  const result = await requireUser(new Request("https://edge.test/fn"), deps, CORS);
  assertStrictEquals(result.ok, false);
  if (!result.ok) assertStrictEquals(result.response.status, 401);
  assertEquals(calls, []);
});

Deno.test("requireUser: the anon/publishable JWT and a service_role credential are refused offline", async () => {
  for (const headers of [ANON_KEY_HEADER, SERVICE_ROLE_HEADER]) {
    const { deps, calls } = userDeps();
    const result = await requireUser(new Request("https://edge.test/fn", { headers }), deps, CORS);
    assertStrictEquals(result.ok, false);
    if (!result.ok) {
      assertStrictEquals(result.response.status, 401);
      assertEquals(await result.response.json(), { success: false, code: "UNAUTHORIZED" });
    }
    assertEquals(calls, [], "a non-session credential must not cost a backend round trip");
  }
});

Deno.test("requireUser: a modern publishable key is not a session — backend says so, 401", async () => {
  const { deps, calls } = userDeps();
  const result = await requireUser(
    new Request("https://edge.test/fn", { headers: PUBLISHABLE_KEY_HEADER }),
    deps,
    CORS,
  );
  assertStrictEquals(result.ok, false);
  if (!result.ok) assertStrictEquals(result.response.status, 401);
  assertStrictEquals(calls.length, 1);
});

Deno.test("requireUser: backend failure fails closed with 503", async () => {
  const { deps } = userDeps(() => Promise.resolve({ kind: "backend_error" as const }));
  const result = await requireUser(
    new Request("https://edge.test/fn", { headers: AUTH_HEADER }),
    deps,
    CORS,
  );
  assertStrictEquals(result.ok, false);
  if (!result.ok) assertStrictEquals(result.response.status, 503);
});

Deno.test("requireUser: a genuine session token authenticates and returns the user", async () => {
  const { deps } = userDeps();
  const result = await requireUser(
    new Request("https://edge.test/fn", { headers: AUTH_HEADER }),
    deps,
    CORS,
  );
  assertStrictEquals(result.ok, true);
  if (result.ok) assertEquals(result.user, USER);
});

// ---------------------------------------------------------------------------
// requireAnyPermission — one authentication, several acceptable permissions
// ---------------------------------------------------------------------------

const ANY_OF = [
  { resource: "presenter", action: "read" },
  { resource: "liturgy_builder", action: "write" },
  { resource: "oraciones", action: "write" },
] as const;

function anyOfRequest(headers: Record<string, string> = AUTH_HEADER): Request {
  return new Request("https://edge.test/fn", { method: "POST", headers });
}

Deno.test("requireAnyPermission: each alternative authorizes on its own, and authentication happens once", async () => {
  for (const winner of ANY_OF) {
    const { deps, calls } = makeAuthzDeps({
      getUser: strictGetUser(),
      checkPermission: (_u, resource, action) =>
        Promise.resolve(
          resource === winner.resource && action === winner.action
            ? { kind: "allowed" as const }
            : { kind: "denied" as const },
        ),
    });
    const result = await requireAnyPermission(anyOfRequest(), deps, { anyOf: ANY_OF, corsHeaders: CORS });
    assertStrictEquals(result.ok, true, `${winner.resource}/${winner.action} must authorize`);
    if (result.ok) assertStrictEquals(result.user.id, "user-abc");
    assertStrictEquals(calls.filter((c) => c.kind === "getUser").length, 1, "authenticate exactly once");
    const checked = calls.filter((c) => c.kind === "checkPermission");
    // Short-circuits: nothing after the winning alternative is evaluated.
    const winnerIndex = ANY_OF.findIndex((a) => a.resource === winner.resource && a.action === winner.action);
    assertStrictEquals(checked.length, winnerIndex + 1);
  }
});

Deno.test("requireAnyPermission: 403 only when EVERY alternative is denied, all of them evaluated", async () => {
  const { deps, calls } = makeAuthzDeps({
    getUser: strictGetUser(),
    checkPermission: () => Promise.resolve({ kind: "denied" }),
  });
  const result = await requireAnyPermission(anyOfRequest(), deps, { anyOf: ANY_OF, corsHeaders: CORS });
  assertStrictEquals(result.ok, false);
  if (!result.ok) {
    assertStrictEquals(result.response.status, 403);
    assertEquals(await result.response.json(), { success: false, code: "FORBIDDEN" });
  }
  assertEquals(
    calls.filter((c) => c.kind === "checkPermission").map((c) => c.kind === "checkPermission" && `${c.resource}/${c.action}`),
    ANY_OF.map((a) => `${a.resource}/${a.action}`),
  );
});

Deno.test("requireAnyPermission: fails closed with 503 when no alternative is allowed and one could not be determined", async () => {
  const backendError = makeAuthzDeps({
    getUser: strictGetUser(),
    checkPermission: (_u, resource) =>
      Promise.resolve(resource === "liturgy_builder" ? { kind: "backend_error" as const } : { kind: "denied" as const }),
  });
  const r1 = await requireAnyPermission(anyOfRequest(), backendError.deps, { anyOf: ANY_OF, corsHeaders: CORS });
  assertStrictEquals(r1.ok, false);
  if (!r1.ok) assertStrictEquals(r1.response.status, 503);

  const thrown = makeAuthzDeps({
    getUser: strictGetUser(),
    checkPermission: (_u, resource) => {
      if (resource === "presenter") throw new Error("rpc down");
      return Promise.resolve({ kind: "denied" as const });
    },
  });
  const r2 = await requireAnyPermission(anyOfRequest(), thrown.deps, { anyOf: ANY_OF, corsHeaders: CORS });
  assertStrictEquals(r2.ok, false);
  if (!r2.ok) {
    assertStrictEquals(r2.response.status, 503);
    assertEquals(await r2.response.json(), { success: false, code: "AUTHZ_BACKEND_ERROR" });
  }

  // But a later alternative that IS allowed still authorizes: the decision is determined.
  const recovered = makeAuthzDeps({
    getUser: strictGetUser(),
    checkPermission: (_u, resource) =>
      Promise.resolve(
        resource === "presenter"
          ? { kind: "backend_error" as const }
          : resource === "oraciones"
          ? { kind: "allowed" as const }
          : { kind: "denied" as const },
      ),
  });
  const r3 = await requireAnyPermission(anyOfRequest(), recovered.deps, { anyOf: ANY_OF, corsHeaders: CORS });
  assertStrictEquals(r3.ok, true);

  const authDown = makeAuthzDeps({ getUser: () => Promise.resolve({ kind: "backend_error" }) });
  const r4 = await requireAnyPermission(anyOfRequest(), authDown.deps, { anyOf: ANY_OF, corsHeaders: CORS });
  assertStrictEquals(r4.ok, false);
  if (!r4.ok) assertStrictEquals(r4.response.status, 503);
  assertStrictEquals(authDown.calls.some((c) => c.kind === "checkPermission"), false);
});

Deno.test("requireAnyPermission: missing, anon, service_role and publishable-key bearers are 401 before any permission check", async () => {
  for (const headers of [{}, ANON_KEY_HEADER, SERVICE_ROLE_HEADER, PUBLISHABLE_KEY_HEADER]) {
    const { deps, calls } = makeAuthzDeps({ getUser: strictGetUser() });
    const result = await requireAnyPermission(anyOfRequest(headers), deps, { anyOf: ANY_OF, corsHeaders: CORS });
    assertStrictEquals(result.ok, false);
    if (!result.ok) assertStrictEquals(result.response.status, 401);
    assertStrictEquals(calls.some((c) => c.kind === "checkPermission"), false);
  }
});

Deno.test("requireAnyPermission: an empty alternative list is a misconfiguration and fails closed (503) without touching the backend", async () => {
  const { deps, calls } = makeAuthzDeps({ getUser: strictGetUser() });
  const result = await requireAnyPermission(anyOfRequest(), deps, { anyOf: [], corsHeaders: CORS });
  assertStrictEquals(result.ok, false);
  if (!result.ok) assertStrictEquals(result.response.status, 503);
  assertEquals(calls, []);
});
