// Integration tests for the generate-scene-images request handler.
//
// T-INT-scene-images covers the fail-closed authz contract that FASE 0
// delivered, re-asserted here because FASE F extracted the request logic out
// of `index.ts` into an importable `handler.ts`. These cases are NOT base-red:
// before the extraction there was no way to import the handler at all, so they
// could not have been written. They are the regression net proving the
// extraction preserved the guard's placement — it still runs before req.json(),
// before any image download, and before Gemini.
//
// The FASE F image-safety cases (T-F.*) live in `handler_imageFetch_test.ts`.

import { assertEquals, assertStrictEquals } from "@std/assert";

import { corsHeaders, createHandler, type HandlerDeps } from "./handler.ts";
import {
  AUTH_HEADER,
  makeAuthzDeps,
  spyRequest,
  withFetchSpy,
} from "../_shared/testHelpers.ts";
import type { RequirePermissionDeps } from "../_shared/liturgyAuth.ts";

function baseDeps(authz: RequirePermissionDeps): HandlerDeps {
  return {
    apiKey: "test-gemini-key",
    flashModel: "test-flash-model",
    proModel: "test-pro-model",
    authzDeps: authz,
  };
}

function samplePayload() {
  return {
    type: "scene",
    styleId: "storybook",
    scene: { text: "Ana camina por el puerto.", visualDescription: "puerto" },
    location: { name: "Valparaíso", description: "puerto" },
    characters: [],
  };
}

// T-INT-scene-images-1
Deno.test("OPTIONS preflight returns 200 with CORS and skips auth guard", async () => {
  const { deps: authz, calls } = makeAuthzDeps();
  const handler = createHandler(baseDeps(authz));

  await withFetchSpy(async (fetchSpy) => {
    const res = await handler(
      new Request("https://edge.test/generate-scene-images", {
        method: "OPTIONS",
      }),
    );

    assertStrictEquals(res.status, 200);
    for (const [k, v] of Object.entries(corsHeaders)) {
      assertEquals(res.headers.get(k), v, `missing CORS header ${k}`);
    }
    assertEquals(calls.length, 0);
    assertEquals(fetchSpy.calls.length, 0);
  });
});

// T-INT-scene-images-2
Deno.test(
  "POST without Authorization returns 401 UNAUTHORIZED and never reads body or calls provider",
  async () => {
    const { deps: authz, calls } = makeAuthzDeps();
    const handler = createHandler(baseDeps(authz));

    await withFetchSpy(async (fetchSpy) => {
      const { req, json } = spyRequest(
        "https://edge.test/generate-scene-images",
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
      assertEquals(await res.json(), { success: false, code: "UNAUTHORIZED" });

      assertEquals(json.calls, 0, "req.json must not be called");
      assertEquals(fetchSpy.calls.length, 0, "fetch must not be called");
      assertEquals(calls.length, 0, "authz backend must not be called");
    });
  },
);

// T-INT-scene-images-3 — per-handler wiring: the guard is asked for exactly
// liturgy_builder:write, and a denial is 403 before any body/provider work.
Deno.test(
  "handler denies with 403 FORBIDDEN and maps to permission liturgy_builder:write",
  async () => {
    const { deps: authz, calls } = makeAuthzDeps({
      checkPermission: () => Promise.resolve({ kind: "denied" as const }),
    });
    const handler = createHandler(baseDeps(authz));

    await withFetchSpy(async (fetchSpy) => {
      const { req, json } = spyRequest(
        "https://edge.test/generate-scene-images",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...AUTH_HEADER },
          body: JSON.stringify(samplePayload()),
        },
      );

      const res = await handler(req);

      assertStrictEquals(res.status, 403);
      assertEquals(await res.json(), { success: false, code: "FORBIDDEN" });

      const perm = calls.find((c) => c.kind === "checkPermission");
      assertEquals(perm?.kind === "checkPermission" && perm.resource, "liturgy_builder");
      assertEquals(perm?.kind === "checkPermission" && perm.action, "write");

      assertEquals(json.calls, 0, "req.json must not be called");
      assertEquals(fetchSpy.calls.length, 0, "fetch must not be called");
    });
  },
);

// T-INT-scene-images-4
Deno.test(
  "auth backend error returns 503 AUTHZ_BACKEND_ERROR and skips downstream",
  async () => {
    const { deps: authz } = makeAuthzDeps({
      getUser: () => Promise.resolve({ kind: "backend_error" as const }),
    });
    const handler = createHandler(baseDeps(authz));

    await withFetchSpy(async (fetchSpy) => {
      const { req, json } = spyRequest(
        "https://edge.test/generate-scene-images",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...AUTH_HEADER },
          body: JSON.stringify(samplePayload()),
        },
      );

      const res = await handler(req);

      assertStrictEquals(res.status, 503);
      assertEquals(await res.json(), {
        success: false,
        code: "AUTHZ_BACKEND_ERROR",
      });
      assertEquals(json.calls, 0, "req.json must not be called");
      assertEquals(fetchSpy.calls.length, 0, "fetch must not be called");
    });
  },
);

// T-INT-scene-images-5
Deno.test(
  "permission RPC error returns 503 AUTHZ_BACKEND_ERROR and skips downstream",
  async () => {
    const { deps: authz } = makeAuthzDeps({
      checkPermission: () => Promise.resolve({ kind: "backend_error" as const }),
    });
    const handler = createHandler(baseDeps(authz));

    await withFetchSpy(async (fetchSpy) => {
      const { req, json } = spyRequest(
        "https://edge.test/generate-scene-images",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...AUTH_HEADER },
          body: JSON.stringify(samplePayload()),
        },
      );

      const res = await handler(req);

      assertStrictEquals(res.status, 503);
      assertEquals(json.calls, 0, "req.json must not be called");
      assertEquals(fetchSpy.calls.length, 0, "fetch must not be called");
    });
  },
);
