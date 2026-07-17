// Unit tests for the shared liturgy authorization guard.
// Purely synthetic — no network, no Supabase client imports.

// deno-lint-ignore-file require-await

import { assertEquals, assertStrictEquals } from "@std/assert";

import {
  type CheckPermissionOutcome,
  createSupabaseAuthzDeps,
  type GetUserOutcome,
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
