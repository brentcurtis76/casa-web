// Integration tests for the generate-oraciones request handler.
//
// T-INT-generate-oraciones covers the fail-closed authz contract:
//   * OPTIONS is served before the guard (200 + CORS, no auth calls).
//   * Missing Authorization returns 401 UNAUTHORIZED before req.json() or
//     the Anthropic provider (`fetch`) are touched — verified with spies.
//   * An invalid bearer token (getUser -> unauthenticated) also returns
//     401 UNAUTHORIZED and never reaches the body or provider.
//   * A false permission returns 403 FORBIDDEN and the guard is called
//     with exactly `oraciones:write` (T-0.5 / T-0.9 per-handler wiring).
//   * getUser and checkPermission backend failures both fail-closed to
//     503 AUTHZ_BACKEND_ERROR, preserving CORS/JSON and leaving req.json
//     and provider spies at zero.

// deno-lint-ignore-file require-await

import { assertEquals, assertStrictEquals } from "@std/assert";

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
    authzDeps: authz,
  };
}

function samplePayload() {
  return {
    liturgia: {
      titulo: "Adviento — La Luz que Viene",
      resumen: "Preparación para recibir la luz de Cristo.",
      lecturas: [
        {
          cita: "Isaías 9:2",
          texto:
            "El pueblo que andaba en tinieblas vio una gran luz; a los que vivían en tierra de sombras una luz les brilló.",
        },
      ],
      reflexionText: "La luz de Cristo nos invita a caminar con esperanza.",
    },
  };
}

// T-INT-generate-oraciones-1
Deno.test("OPTIONS preflight returns 200 with CORS and skips auth guard", async () => {
  const { deps: authz, calls } = makeAuthzDeps();
  const handler = createHandler(baseDeps(authz));

  await withFetchSpy(async (fetchSpy) => {
    const req = new Request("https://edge.test/generate-oraciones", {
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

// T-INT-generate-oraciones-2
Deno.test(
  "POST without Authorization returns 401 UNAUTHORIZED and never reads body or calls provider",
  async () => {
    const { deps: authz, calls } = makeAuthzDeps();
    const handler = createHandler(baseDeps(authz));

    await withFetchSpy(async (fetchSpy) => {
      const { req, json } = spyRequest(
        "https://edge.test/generate-oraciones",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(samplePayload()),
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

      // Fail-closed: no body parse, no fetch (Anthropic provider / Storage),
      // no authz backend calls at all when the credential is missing.
      assertEquals(json.calls, 0, "req.json must not be called");
      assertEquals(fetchSpy.calls, 0, "fetch must not be called");
      assertEquals(calls.length, 0, "authz backend must not be called");
    });
  },
);

// T-INT-generate-oraciones-3 — invalid bearer token also fails closed
// with 401 and never touches body or provider.
Deno.test(
  "POST with invalid bearer token returns 401 UNAUTHORIZED and never reads body or calls provider",
  async () => {
    const { deps: authz, calls } = makeAuthzDeps({
      getUser: async () => ({ kind: "unauthenticated" }),
    });
    const handler = createHandler(baseDeps(authz));

    await withFetchSpy(async (fetchSpy) => {
      const { req, json } = spyRequest(
        "https://edge.test/generate-oraciones",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer bad.jwt",
          },
          body: JSON.stringify(samplePayload()),
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

      // getUser ran once; checkPermission never called; body/provider
      // untouched.
      assertEquals(calls.length, 1);
      assertEquals(calls[0], { kind: "getUser", token: "bad.jwt" });
      assertEquals(json.calls, 0, "req.json must not be called");
      assertEquals(fetchSpy.calls, 0, "fetch must not be called");
    });
  },
);

// T-INT-generate-oraciones-4 — T-0.5 / T-0.9 per-handler wiring: false
// permission returns 403 with CORS/JSON, and the guard is called with
// exactly `oraciones:write`.
Deno.test(
  "handler denies with 403 FORBIDDEN and maps to permission oraciones:write",
  async () => {
    const { deps: authz, calls } = makeAuthzDeps({
      // Deny so the handler stops after the mapping check — we only care
      // that the resource/action pair was passed correctly.
      checkPermission: async () => ({ kind: "denied" }),
    });
    const handler = createHandler(baseDeps(authz));

    await withFetchSpy(async (fetchSpy) => {
      const { req, json } = spyRequest(
        "https://edge.test/generate-oraciones",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer good.jwt",
          },
          body: JSON.stringify(samplePayload()),
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
        resource: "oraciones",
        action: "write",
      });

      // Denial short-circuits before body/provider access.
      assertEquals(json.calls, 0);
      assertEquals(fetchSpy.calls, 0);
    });
  },
);

// T-INT-generate-oraciones-5 — auth backend failure fails closed to 503,
// preserving CORS/JSON and leaving downstream spies at zero.
Deno.test(
  "auth backend error returns 503 AUTHZ_BACKEND_ERROR and skips downstream",
  async () => {
    const { deps: authz, calls } = makeAuthzDeps({
      getUser: async () => ({
        kind: "backend_error",
        error: new Error("supabase auth 5xx"),
      }),
    });
    const handler = createHandler(baseDeps(authz));

    await withFetchSpy(async (fetchSpy) => {
      const { req, json } = spyRequest(
        "https://edge.test/generate-oraciones",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer any.jwt",
          },
          body: JSON.stringify(samplePayload()),
        },
      );

      const res = await handler(req);

      assertStrictEquals(res.status, 503);
      for (const [k, v] of Object.entries(corsHeaders)) {
        assertEquals(res.headers.get(k), v, `missing CORS header ${k}`);
      }
      assertEquals(res.headers.get("Content-Type"), "application/json");
      assertEquals(await res.json(), {
        success: false,
        code: "AUTHZ_BACKEND_ERROR",
      });

      // Only getUser ran; checkPermission never called.
      assertEquals(calls.length, 1);
      assertEquals(calls[0], { kind: "getUser", token: "any.jwt" });

      assertEquals(json.calls, 0);
      assertEquals(fetchSpy.calls, 0);
    });
  },
);

// T-INT-generate-oraciones-6 — permission RPC failure fails closed to 503,
// and the RPC was invoked with the exact oraciones:write pair.
Deno.test(
  "permission RPC error returns 503 AUTHZ_BACKEND_ERROR and skips downstream",
  async () => {
    const { deps: authz, calls } = makeAuthzDeps({
      checkPermission: async () => ({
        kind: "backend_error",
        error: { message: "rpc timeout" },
      }),
    });
    const handler = createHandler(baseDeps(authz));

    await withFetchSpy(async (fetchSpy) => {
      const { req, json } = spyRequest(
        "https://edge.test/generate-oraciones",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer good.jwt",
          },
          body: JSON.stringify(samplePayload()),
        },
      );

      const res = await handler(req);

      assertStrictEquals(res.status, 503);
      for (const [k, v] of Object.entries(corsHeaders)) {
        assertEquals(res.headers.get(k), v, `missing CORS header ${k}`);
      }
      assertEquals(res.headers.get("Content-Type"), "application/json");
      assertEquals(await res.json(), {
        success: false,
        code: "AUTHZ_BACKEND_ERROR",
      });

      // getUser then checkPermission with the exact resource/action.
      assertEquals(calls.length, 2);
      assertEquals(calls[1], {
        kind: "checkPermission",
        userId: "user-abc",
        resource: "oraciones",
        action: "write",
      });

      assertEquals(json.calls, 0);
      assertEquals(fetchSpy.calls, 0);
    });
  },
);
