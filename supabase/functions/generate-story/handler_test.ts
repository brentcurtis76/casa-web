// Integration tests for the generate-story request handler.
//
// T-INT-generate-story covers the fail-closed authz contract:
//   * OPTIONS is served before the guard (200 + CORS, no auth calls).
//   * Missing Authorization returns 401 UNAUTHORIZED before req.json(),
//     Gemini research, image analysis, or the Anthropic provider (`fetch`)
//     are touched — verified with spies.
//   * The guard maps to `liturgy_builder:write` — verified via the args the
//     handler passes to `checkPermission`.

// deno-lint-ignore-file no-import-prefix require-await

import {
  assertEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { corsHeaders, createHandler, type HandlerDeps } from "./handler.ts";
import type {
  CheckPermissionOutcome,
  GetUserOutcome,
  RequirePermissionDeps,
} from "../_shared/liturgyAuth.ts";

type Call =
  | { kind: "getUser"; token: string }
  | {
    kind: "checkPermission";
    userId: string;
    resource: string;
    action: string;
  };

function makeAuthzDeps(overrides: {
  getUser?: (token: string) => Promise<GetUserOutcome>;
  checkPermission?: (
    userId: string,
    resource: string,
    action: string,
  ) => Promise<CheckPermissionOutcome>;
} = {}): { deps: RequirePermissionDeps; calls: Call[] } {
  const calls: Call[] = [];
  const deps: RequirePermissionDeps = {
    getUser: async (token) => {
      calls.push({ kind: "getUser", token });
      if (overrides.getUser) return await overrides.getUser(token);
      return {
        kind: "authenticated",
        user: { id: "user-abc", email: "u@example.com" },
      };
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

/**
 * Wraps globalThis.fetch with a spy for the duration of `fn`. The spy
 * throws if invoked (assertion-only spy: no test should reach a real
 * network call).
 */
async function withFetchSpy<T>(
  fn: (spy: { calls: number }) => Promise<T>,
): Promise<T> {
  const spy = { calls: 0 };
  const original = globalThis.fetch;
  globalThis.fetch = ((..._args: Parameters<typeof fetch>) => {
    spy.calls++;
    throw new Error("fetch should not be called in this test");
  }) as typeof fetch;
  try {
    return await fn(spy);
  } finally {
    globalThis.fetch = original;
  }
}

/** Spy-wrapped Request that counts `json()` invocations. */
function spyRequest(
  input: string,
  init: RequestInit,
): { req: Request; json: { calls: number } } {
  const req = new Request(input, init);
  const json = { calls: 0 };
  const original = req.json.bind(req);
  Object.defineProperty(req, "json", {
    value: async () => {
      json.calls++;
      return await original();
    },
    writable: true,
    configurable: true,
  });
  return { req, json };
}

function baseDeps(authz: RequirePermissionDeps): HandlerDeps {
  return {
    anthropicApiKey: "test-anthropic-key",
    googleApiKey: "test-google-key",
    authzDeps: authz,
  };
}

// T-INT-generate-story-1
Deno.test("OPTIONS preflight returns 200 with CORS and skips auth guard", async () => {
  const { deps: authz, calls } = makeAuthzDeps();
  const handler = createHandler(baseDeps(authz));

  await withFetchSpy(async (fetchSpy) => {
    const req = new Request("https://edge.test/generate-story", {
      method: "OPTIONS",
    });
    const res = await handler(req);

    assertStrictEquals(res.status, 200);
    for (const [k, v] of Object.entries(corsHeaders)) {
      assertEquals(res.headers.get(k), v, `missing CORS header ${k}`);
    }
    // Guard is not consulted for preflight; fetch is not touched.
    assertEquals(calls.length, 0);
    assertEquals(fetchSpy.calls, 0);
  });
});

// T-INT-generate-story-2
Deno.test(
  "POST without Authorization returns 401 UNAUTHORIZED and never reads body, researches, or calls provider",
  async () => {
    const { deps: authz, calls } = makeAuthzDeps();
    const handler = createHandler(baseDeps(authz));

    await withFetchSpy(async (fetchSpy) => {
      const { req, json } = spyRequest(
        "https://edge.test/generate-story",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context: { title: "t", summary: "s", readings: [] },
            location: "Valparaíso",
            style: "reflexivo",
          }),
        },
      );

      const res = await handler(req);

      assertStrictEquals(res.status, 401);
      for (const [k, v] of Object.entries(corsHeaders)) {
        assertEquals(res.headers.get(k), v, `missing CORS header ${k}`);
      }
      assertEquals(res.headers.get("Content-Type"), "application/json");
      assertEquals(await res.json(), {
        success: false,
        code: "UNAUTHORIZED",
      });

      // Fail-closed: no body parse, no fetch (Gemini research / image
      // analysis / Anthropic provider), no authz backend calls at all
      // when the credential is missing.
      assertEquals(json.calls, 0, "req.json must not be called");
      assertEquals(fetchSpy.calls, 0, "fetch must not be called");
      assertEquals(calls.length, 0, "authz backend must not be called");
    });
  },
);

// T-INT-generate-story-3
Deno.test(
  "handler maps to permission liturgy_builder:write",
  async () => {
    const { deps: authz, calls } = makeAuthzDeps({
      // Deny so the handler stops after the mapping check — we only care
      // that the resource/action pair was passed correctly.
      checkPermission: async () => ({ kind: "denied" }),
    });
    const handler = createHandler(baseDeps(authz));

    await withFetchSpy(async (fetchSpy) => {
      const { req, json } = spyRequest(
        "https://edge.test/generate-story",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer good.jwt",
          },
          body: JSON.stringify({
            context: { title: "t", summary: "s", readings: [] },
            location: "Valparaíso",
            style: "reflexivo",
          }),
        },
      );

      const res = await handler(req);

      assertStrictEquals(res.status, 403);
      for (const [k, v] of Object.entries(corsHeaders)) {
        assertEquals(res.headers.get(k), v, `missing CORS header ${k}`);
      }
      assertEquals(res.headers.get("Content-Type"), "application/json");
      assertEquals(await res.json(), {
        success: false,
        code: "FORBIDDEN",
      });

      // getUser then checkPermission with the exact resource/action.
      assertEquals(calls.length, 2);
      assertEquals(calls[0], { kind: "getUser", token: "good.jwt" });
      assertEquals(calls[1], {
        kind: "checkPermission",
        userId: "user-abc",
        resource: "liturgy_builder",
        action: "write",
      });

      // Denial short-circuits before body/provider access.
      assertEquals(json.calls, 0);
      assertEquals(fetchSpy.calls, 0);
    });
  },
);
