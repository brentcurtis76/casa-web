// Integration tests for the generate-story request handler.
//
// T-INT-generate-story covers the fail-closed authz contract:
//   * OPTIONS is served before the guard (200 + CORS, no auth calls).
//   * Missing Authorization returns 401 UNAUTHORIZED before req.json(),
//     Storage / Gemini research, or the Anthropic provider (`fetch`) are
//     touched — verified with spies.
//   * A false permission returns 403 FORBIDDEN, again before any downstream
//     side effect (T-0.5 per-handler wiring).
//   * A getUser backend failure returns 503 AUTHZ_BACKEND_ERROR; a
//     checkPermission backend failure also returns 503. Both preserve CORS
//     and JSON, and both leave req.json / provider spies at zero.
//   * The guard maps to `liturgy_builder:write` — verified via the args
//     the handler passes to `checkPermission` (T-0.9 per-handler wiring).

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
    googleAiApiKey: "test-google-key",
    authzDeps: authz,
  };
}

function samplePayload() {
  return {
    context: {
      title: "Adviento",
      summary: "Esperanza en la espera",
      readings: [{ reference: "Is 40:1-5", text: "Consolad, consolad…" }],
    },
    location: "Chiloé",
    characters: [],
    style: "reflexivo",
    additionalNotes: "",
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
  "POST without Authorization returns 401 UNAUTHORIZED and never reads body or calls provider",
  async () => {
    const { deps: authz, calls } = makeAuthzDeps();
    const handler = createHandler(baseDeps(authz));

    await withFetchSpy(async (fetchSpy) => {
      const { req, json } = spyRequest(
        "https://edge.test/generate-story",
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

      // Fail-closed: no body parse, no fetch (Gemini research / Anthropic
      // provider), no authz backend calls at all when the credential is
      // missing.
      assertEquals(json.calls, 0, "req.json must not be called");
      assertEquals(fetchSpy.calls, 0, "fetch must not be called");
      assertEquals(calls.length, 0, "authz backend must not be called");
    });
  },
);

// T-INT-generate-story-3 — T-0.5 / T-0.9 per-handler wiring: false
// permission returns 403 and the guard is called with the exact
// liturgy_builder:write pair.
Deno.test(
  "handler denies with 403 FORBIDDEN and maps to permission liturgy_builder:write",
  async () => {
    const { deps: authz, calls } = makeAuthzDeps({
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
        resource: "liturgy_builder",
        action: "write",
      });

      // Denial short-circuits before body/provider access.
      assertEquals(json.calls, 0);
      assertEquals(fetchSpy.calls, 0);
    });
  },
);

// T-INT-generate-story-4 — auth backend failure fails closed to 503.
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
        "https://edge.test/generate-story",
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

// T-INT-generate-story-5 — permission RPC failure fails closed to 503,
// and the RPC was invoked with the exact liturgy_builder:write pair.
Deno.test(
  "permission RPC error returns 503 AUTHZ_BACKEND_ERROR and skips downstream",
  async () => {
    const { deps: authz, calls } = makeAuthzDeps({
      checkPermission: async () => ({
        kind: "backend_error",
        error: { message: "connection reset" },
      }),
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
        resource: "liturgy_builder",
        action: "write",
      });

      assertEquals(json.calls, 0);
      assertEquals(fetchSpy.calls, 0);
    });
  },
);

// ---------------------------------------------------------------------------
// T-INT-generate-story-truncation
//
// Regression cover for the 2026-07 outage: the Anthropic response hit
// max_tokens, the truncated JSON prefix failed every parse attempt, and the
// user saw only "JSON inválido" while the real cause stayed in the logs.
// ---------------------------------------------------------------------------

/**
 * Replaces globalThis.fetch with a router keyed on request URL, so a test can
 * drive the Gemini research call and the Anthropic provider call separately.
 */
async function withFetchRouter<T>(
  routes: { gemini?: () => Response; anthropic: () => Response },
  fn: (sent: { anthropic: Record<string, unknown> | null }) => Promise<T>,
): Promise<T> {
  const original = globalThis.fetch;
  const sent: { anthropic: Record<string, unknown> | null } = {
    anthropic: null,
  };
  globalThis.fetch = ((
    input: Parameters<typeof fetch>[0],
    init?: RequestInit,
  ) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    if (url.includes("generativelanguage.googleapis.com")) {
      return Promise.resolve(
        routes.gemini?.() ?? new Response("", { status: 404 }),
      );
    }
    if (url.includes("api.anthropic.com")) {
      // Capture the outgoing payload so tests can pin the request
      // parameters, not just the response handling.
      sent.anthropic = JSON.parse(String(init?.body ?? "{}"));
      return Promise.resolve(routes.anthropic());
    }
    throw new Error(`unexpected fetch to ${url}`);
  }) as typeof fetch;
  try {
    return await fn(sent);
  } finally {
    globalThis.fetch = original;
  }
}

function anthropicResponse(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function authorizedRequest() {
  return new Request("https://example.test/generate-story", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer good-token",
    },
    body: JSON.stringify(samplePayload()),
  });
}

Deno.test(
  "max_tokens truncation reports the real cause, not a JSON parse error",
  async () => {
    const { deps: authz } = makeAuthzDeps();
    const handler = createHandler(baseDeps(authz));

    // A truncated story: valid JSON prefix, cut mid-array. This is exactly
    // what production returned when max_tokens was 4096.
    const truncated =
      '{"title":"El Pan Compartido","summary":"Un niño aprende a compartir",' +
      '"characters":[{"name":"Alejandro","role":"protagonist",' +
      '"description":"Un niño","visualDescription":"7 años, pelo castaño"';

    await withFetchRouter(
      {
        anthropic: () =>
          anthropicResponse({
            content: [{ type: "text", text: truncated }],
            stop_reason: "max_tokens",
            usage: { input_tokens: 2000, output_tokens: 8192 },
          }),
      },
      async () => {
        const res = await handler(authorizedRequest());

        assertEquals(res.status, 500);
        const body = await res.json() as { success: boolean; error: string };
        assertEquals(body.success, false);

        // The actionable message, not the generic parser failure.
        assertStrictEquals(
          body.error.includes("límite de tokens"),
          true,
          `expected a token-limit message, got: ${body.error}`,
        );
        assertStrictEquals(
          body.error.includes("JSON inválido"),
          false,
          "truncation must not be reported as a JSON parse error",
        );
      },
    );
  },
);

Deno.test(
  "a complete story response still parses and returns 200",
  async () => {
    const { deps: authz } = makeAuthzDeps();
    const handler = createHandler(baseDeps(authz));

    const story = {
      title: "El Pan Compartido",
      summary: "Un niño aprende a compartir",
      characters: [{
        name: "Alejandro",
        role: "protagonist",
        description: "Un niño curioso",
        visualDescription: "7 años, pelo castaño, polera azul",
        appearsInScenes: [1],
      }],
      scenes: [{
        number: 1,
        text: "Alejandro caminaba por la plaza.",
        visualDescription: "Plaza soleada con árboles verdes.",
        charactersInScene: ["Alejandro"],
        landmarkVisible: false,
      }],
      spiritualConnection: "Compartir como Jesús enseñó",
    };

    await withFetchRouter(
      {
        anthropic: () =>
          anthropicResponse({
            content: [{ type: "text", text: JSON.stringify(story) }],
            stop_reason: "end_turn",
            usage: { input_tokens: 2000, output_tokens: 4000 },
          }),
      },
      async () => {
        const res = await handler(authorizedRequest());

        assertEquals(res.status, 200);
        const body = await res.json() as {
          success: boolean;
          title: string;
          scenes: unknown[];
        };
        assertEquals(body.success, true);
        assertEquals(body.title, "El Pan Compartido");
        assertEquals(body.scenes.length, 1);
      },
    );
  },
);

Deno.test(
  "pins the provider parameters that keep the story from being truncated",
  async () => {
    const { deps: authz } = makeAuthzDeps();
    const handler = createHandler(baseDeps(authz));

    await withFetchRouter(
      {
        anthropic: () =>
          anthropicResponse({
            content: [{
              type: "text",
              text: JSON.stringify({
                title: "T",
                summary: "S",
                characters: [{
                  name: "A",
                  role: "protagonist",
                  description: "d",
                  visualDescription: "v",
                  appearsInScenes: [1],
                }],
                scenes: [{
                  number: 1,
                  text: "t",
                  visualDescription: "v",
                  charactersInScene: ["A"],
                  landmarkVisible: false,
                }],
                spiritualConnection: "c",
              }),
            }],
            stop_reason: "end_turn",
            usage: { input_tokens: 10, output_tokens: 20 },
          }),
      },
      async (sent) => {
        const res = await handler(authorizedRequest());
        assertEquals(res.status, 200);
        await res.body?.cancel();

        const body = sent.anthropic as {
          model: string;
          max_tokens: number;
        };

        // A dated model ID silently 404s the day it retires; that is how the
        // sibling process-reflexion-pdf function broke.
        assertStrictEquals(
          body.model,
          "claude-opus-5",
          "model must stay a bare alias, never a dated snapshot ID",
        );

        // 4096 truncated a real 15-scene story mid-JSON in production.
        assertStrictEquals(
          body.max_tokens >= 16000,
          true,
          `max_tokens regressed to ${body.max_tokens}; a full story needs ~4.8k plus margin`,
        );
      },
    );
  },
);
