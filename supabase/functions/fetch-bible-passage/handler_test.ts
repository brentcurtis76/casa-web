// fetch-bible-passage: one authentication, any-of-three authorization, both
// BEFORE the body is read and before Bolls.life is contacted. Offline, synthetic.

import { assertEquals, assertStrictEquals } from "@std/assert";

import {
  BIBLE_PASSAGE_PERMISSIONS,
  BOLLS_BASE_URL,
  createHandler,
  type HandlerDeps,
  MAX_BODY_BYTES,
  MAX_PROVIDER_RESPONSE_BYTES,
  MAX_REFERENCE_CHARS,
  parseReference,
} from "./handler.ts";
import {
  ANON_KEY_HEADER,
  AUTH_HEADER,
  type AuthzCall,
  makeAuthzDeps,
  PUBLISHABLE_KEY_HEADER,
  SERVICE_ROLE_HEADER,
  spyRequest,
  strictGetUser,
  withCapturedLogs,
} from "../_shared/testHelpers.ts";

const REFERENCE = "Juan 3:16";
const PASSAGE_TEXT = "Porque de tal manera amó Dios al mundo";
const CHAPTER = [
  { pk: 1, verse: 15, text: "para que todo el que cree en él tenga vida eterna. " },
  { pk: 2, verse: 16, text: `${PASSAGE_TEXT}, que dio a su Hijo unigénito ` },
  { pk: 3, verse: 17, text: "Dios no envió a su Hijo al mundo para condenar al mundo" },
];

interface ProviderCall {
  url: string;
  init: RequestInit;
}

function setup(opts: {
  allow?: (resource: string, action: string) => boolean;
  authz?: ReturnType<typeof makeAuthzDeps>;
  respond?: (url: string) => Response | Promise<Response>;
} = {}) {
  const provider: ProviderCall[] = [];
  const authz = opts.authz ?? makeAuthzDeps({
    getUser: strictGetUser(),
    checkPermission: (_u, resource, action) =>
      Promise.resolve((opts.allow ?? (() => true))(resource, action) ? { kind: "allowed" } : { kind: "denied" }),
  });
  const deps: HandlerDeps = {
    authzDeps: authz.deps,
    fetchImpl: async (url, init) => {
      provider.push({ url, init });
      const respond = opts.respond ?? (() => Response.json(CHAPTER));
      return await respond(url);
    },
  };
  return { handler: createHandler(deps), provider, calls: authz.calls };
}

function post(headers: Record<string, string>, body: unknown = { reference: REFERENCE, version: "NVI" }, method = "POST") {
  return spyRequest("https://edge.test/fetch-bible-passage", {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: method === "GET" ? undefined : (typeof body === "string" ? body : JSON.stringify(body)),
  });
}

const permissionChecks = (calls: AuthzCall[]) =>
  calls.filter((c) => c.kind === "checkPermission").map((c) =>
    c.kind === "checkPermission" ? `${c.resource}/${c.action}` : ""
  );

Deno.test("fetch-bible-passage: the three permissions are presenter/read, liturgy_builder/write, oraciones/write", () => {
  assertEquals(
    BIBLE_PASSAGE_PERMISSIONS.map((p) => `${p.resource}/${p.action}`),
    ["presenter/read", "liturgy_builder/write", "oraciones/write"],
  );
});

Deno.test("fetch-bible-passage: each of the three permissions authorizes independently, with a single authentication", async () => {
  for (const winner of BIBLE_PASSAGE_PERMISSIONS) {
    const { handler, provider, calls } = setup({
      allow: (resource, action) => resource === winner.resource && action === winner.action,
    });
    const res = await handler(post(AUTH_HEADER).req);
    assertStrictEquals(res.status, 200, `${winner.resource}/${winner.action} must authorize`);
    assertEquals(await res.json(), {
      success: true,
      text: `16 ${PASSAGE_TEXT}, que dio a su Hijo unigénito`,
      reference: "Juan 3:16",
      version: "Nueva Versión Internacional",
      versionCode: "NVI",
    });
    assertStrictEquals(calls.filter((c) => c.kind === "getUser").length, 1, "authenticate exactly once");
    assertStrictEquals(provider.length, 1);
    assertStrictEquals(provider[0].url, `${BOLLS_BASE_URL}/NVI/43/3/`);
    assertStrictEquals(provider[0].init.method, "GET");
  }
});

Deno.test("fetch-bible-passage: no token, anon key, service_role, or publishable key → 401 before the body is read or the provider is called", async () => {
  for (const headers of [{}, ANON_KEY_HEADER, SERVICE_ROLE_HEADER, PUBLISHABLE_KEY_HEADER]) {
    const { handler, provider, calls } = setup();
    const { req, json, text } = post(headers);
    const res = await handler(req);
    assertStrictEquals(res.status, 401);
    assertEquals(await res.json(), { success: false, code: "UNAUTHORIZED" });
    assertStrictEquals(json.calls + text.calls, 0, "body must not be read before authentication");
    assertStrictEquals(provider.length, 0, "the provider must not be called");
    assertStrictEquals(calls.some((c) => c.kind === "checkPermission"), false);
  }
});

Deno.test("fetch-bible-passage: a signed-in user with none of the three permissions → 403, all three evaluated, nothing else touched", async () => {
  const { handler, provider, calls } = setup({ allow: () => false });
  const { req, json, text } = post(AUTH_HEADER);
  const res = await handler(req);
  assertStrictEquals(res.status, 403);
  assertEquals(await res.json(), { success: false, code: "FORBIDDEN" });
  assertEquals(permissionChecks(calls), ["presenter/read", "liturgy_builder/write", "oraciones/write"]);
  assertStrictEquals(json.calls + text.calls, 0, "body must not be read when denied");
  assertStrictEquals(provider.length, 0);
});

Deno.test("fetch-bible-passage: authorization backend failures fail closed with 503 and never reach the provider", async () => {
  const cases = [
    makeAuthzDeps({ getUser: () => Promise.resolve({ kind: "backend_error" }) }),
    makeAuthzDeps({ getUser: () => Promise.reject(new Error("auth down")) }),
    makeAuthzDeps({
      getUser: strictGetUser(),
      checkPermission: (_u, resource) =>
        Promise.resolve(resource === "oraciones" ? { kind: "backend_error" } : { kind: "denied" }),
    }),
    makeAuthzDeps({
      getUser: strictGetUser(),
      checkPermission: () => Promise.reject(new Error("rpc down")),
    }),
  ];
  for (const authz of cases) {
    const { handler, provider } = setup({ authz });
    const { req, json, text } = post(AUTH_HEADER);
    const res = await handler(req);
    assertStrictEquals(res.status, 503);
    assertEquals(await res.json(), { success: false, code: "AUTHZ_BACKEND_ERROR" });
    assertStrictEquals(json.calls + text.calls, 0);
    assertStrictEquals(provider.length, 0);
  }
});

Deno.test("fetch-bible-passage: only POST (and OPTIONS) — other methods are 405 without authentication", async () => {
  const { handler, provider, calls } = setup();
  for (const method of ["GET", "PUT", "DELETE"]) {
    const res = await handler(post(AUTH_HEADER, undefined, method).req);
    assertStrictEquals(res.status, 405, method);
  }
  const preflight = await handler(new Request("https://edge.test/fetch-bible-passage", { method: "OPTIONS" }));
  assertStrictEquals(preflight.status, 200);
  assertStrictEquals(preflight.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(calls, [], "method rejection needs no backend");
  assertStrictEquals(provider.length, 0);
});

Deno.test("fetch-bible-passage: invalid or unbounded requests are 400/413 and never call the provider", async () => {
  const { handler, provider } = setup();
  const bad: unknown[] = [
    {},
    { reference: "" },
    { reference: "   " },
    { reference: 42 },
    { reference: ["Juan 3:16"] },
    { reference: "x".repeat(MAX_REFERENCE_CHARS + 1) },
    { reference: "Libro Inexistente 3:16" },
    { reference: "Juan" },
    { reference: "Juan 0" },
    { reference: "Juan 151" },
    { reference: "Juan 3:0" },
    { reference: "Juan 3:177" },
    { reference: "Juan 3:20-16" },
    { reference: "Juan 3:16; DROP TABLE" },
    { reference: REFERENCE, version: 7 },
    { reference: REFERENCE, version: "x".repeat(17) },
    ["Juan 3:16"],
    "not json",
    "null",
  ];
  for (const body of bad) {
    const res = await handler(post(AUTH_HEADER, body).req);
    assertStrictEquals(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
    const payload = await res.json();
    assertStrictEquals(payload.success, false);
  }
  const big = await handler(post(AUTH_HEADER, { reference: REFERENCE, pad: "x".repeat(3000) }).req);
  assertStrictEquals(big.status, 413);
  assertStrictEquals(provider.length, 0, "no invalid request may reach the provider");
});

Deno.test("fetch-bible-passage: valid behaviour is preserved — chapter, range, version fallback, display reference", async () => {
  const { handler, provider } = setup();

  const chapter = await (await handler(post(AUTH_HEADER, { reference: "Juan 3" }).req)).json();
  assertStrictEquals(chapter.success, true);
  assertStrictEquals(chapter.reference, "Juan 3");
  assertStrictEquals(chapter.text.startsWith("15 para que todo"), true);
  assertStrictEquals(chapter.text.includes("17 Dios no envió"), true);

  const range = await (await handler(post(AUTH_HEADER, { reference: "jn 3:15-16", version: "RV1960" }).req)).json();
  assertStrictEquals(range.reference, "Juan 3:15-16");
  assertStrictEquals(range.version, "Reina-Valera 1960");
  assertStrictEquals(range.versionCode, "RV1960");
  assertStrictEquals(range.text.includes("17 "), false);
  assertStrictEquals(provider[1].url, `${BOLLS_BASE_URL}/RV1960/43/3/`);

  // Unknown or missing version falls back to NVI, as the original did; RVG maps to Bolls' RV2004 id.
  const fallback = await (await handler(post(AUTH_HEADER, { reference: REFERENCE, version: "ZZZ" }).req)).json();
  assertStrictEquals(fallback.versionCode, "NVI");
  const missing = await (await handler(post(AUTH_HEADER, { reference: REFERENCE }).req)).json();
  assertStrictEquals(missing.versionCode, "NVI");
  await handler(post(AUTH_HEADER, { reference: "Salmo 23", version: "RVG" }).req);
  assertStrictEquals(provider[4].url, `${BOLLS_BASE_URL}/RV2004/19/23/`);

  // A verse the chapter does not contain → 400, not a provider error.
  const outOfRange = await handler(post(AUTH_HEADER, { reference: "Juan 3:40" }).req);
  assertStrictEquals(outOfRange.status, 400);
});

Deno.test("fetch-bible-passage: provider failures are 404/502 and leak neither provider bodies nor exception details", async () => {
  const secret = "secret upstream detail";
  const scenarios: Array<{ respond: (url: string) => Response | Promise<Response>; status: number }> = [
    { respond: () => new Response(secret, { status: 404 }), status: 404 },
    { respond: () => new Response(secret, { status: 500 }), status: 502 },
    { respond: () => Promise.reject(new Error(secret)), status: 502 },
    { respond: () => new Response(`<html>${secret}</html>`, { status: 200 }), status: 502 },
    { respond: () => Response.json([]), status: 502 },
    { respond: () => Response.json([{ verse: "16", text: secret }]), status: 502 },
    { respond: () => Response.json({ verse: 16, text: secret }), status: 502 },
    {
      respond: () => new Response("[]", { status: 200, headers: { "content-length": String(5_000_000) } }),
      status: 502,
    },
  ];
  for (const { respond, status } of scenarios) {
    const { handler } = setup({ respond });
    const lines = await withCapturedLogs(async (lines) => {
      const res = await handler(post(AUTH_HEADER).req);
      assertStrictEquals(res.status, status);
      const text = await res.text();
      assertStrictEquals(text.includes(secret), false, "provider payload must not be echoed");
      assertStrictEquals(text.includes("stack"), false);
      return lines;
    });
    for (const line of lines) {
      assertStrictEquals(line.includes(secret), false, `logs must not carry provider payloads: ${line}`);
    }
  }
});

Deno.test("fetch-bible-passage: logs never carry the submitted reference, the passage text, or the response", async () => {
  const { handler } = setup();
  const lines = await withCapturedLogs(async (lines) => {
    const res = await handler(post(AUTH_HEADER, { reference: "Juan 3:16-17", version: "NVI" }).req);
    assertStrictEquals(res.status, 200);
    return lines;
  });
  assertStrictEquals(lines.length > 0, true);
  for (const line of lines) {
    assertStrictEquals(line.includes("Juan"), false, `reference in logs: ${line}`);
    assertStrictEquals(line.includes("3:16"), false, `reference in logs: ${line}`);
    assertStrictEquals(line.includes(PASSAGE_TEXT), false, `passage text in logs: ${line}`);
    assertStrictEquals(line.includes("success"), false, `response body in logs: ${line}`);
  }
});

Deno.test("parseReference: formats, aliases, and bounds", () => {
  assertEquals(parseReference("Juan 3:16"), { bookId: 43, chapter: 3, startVerse: 16, endVerse: 16 });
  assertEquals(parseReference("  1 Corintios 13:1-13 "), { bookId: 46, chapter: 13, startVerse: 1, endVerse: 13 });
  assertEquals(parseReference("Salmo 23"), { bookId: 19, chapter: 23 });
  assertEquals(parseReference("Salmos 150"), { bookId: 19, chapter: 150 });
  assertEquals(parseReference("Salmos 119:176"), { bookId: 19, chapter: 119, startVerse: 176, endVerse: 176 });
  assertStrictEquals(parseReference("Salmos 151"), null);
  assertStrictEquals(parseReference("Salmos 119:177"), null);
  assertStrictEquals(parseReference("Juan 3:16-15"), null);
  assertStrictEquals(parseReference("Juan 3:16-21-25"), null);
  assertStrictEquals(parseReference("Juan 1000"), null);
  assertStrictEquals(parseReference("Klingon 1:1"), null);
  assertStrictEquals(parseReference(""), null);
});

// ---------------------------------------------------------------------------
// Streaming caps — on the request AND on the untrusted provider reply
//
// Codex's reproduction: a headerless provider Response of 2,000 × 1 KiB chunks
// was consumed whole (2,048,000 bytes, 2,001 pulls) before the handler answered
// 502, despite MAX_PROVIDER_RESPONSE_BYTES = 1,000,000. Counting pulls is the
// only way to tell a bound from a measurement taken afterwards, so every case
// below asserts where the read actually stopped.
// ---------------------------------------------------------------------------

interface StreamProbe {
  pulls: number;
  cancels: number;
  delivered: number;
}

const probe = (): StreamProbe => ({ pulls: 0, cancels: 0, delivered: 0 });

/** A body with no `content-length`, handing out chunks until `next` returns null. */
function countingStream(
  p: StreamProbe,
  next: (index: number) => Uint8Array | null,
  opts: { failAt?: number } = {},
): ReadableStream<Uint8Array> {
  let index = 0;
  // `highWaterMark: 0` switches off the stream's own one-chunk read-ahead, so
  // `pulls` counts exactly what the consumer asked for. With the default
  // strategy a chunk is fetched eagerly on the first free microtask, and the
  // counts drift by one depending on how many awaits ran first — which would
  // measure the queueing strategy rather than the handler.
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      p.pulls++;
      if (opts.failAt !== undefined && index === opts.failAt) {
        controller.error(new Error("transporte interrumpido"));
        return;
      }
      const chunk = next(index);
      if (chunk === null) {
        controller.close();
        return;
      }
      index++;
      p.delivered++;
      controller.enqueue(chunk);
    },
    cancel() {
      p.cancels++;
    },
  }, { highWaterMark: 0 });
}

const filler = (count: number, size: number) => (index: number) =>
  index < count ? new Uint8Array(size).fill(0x61) : null;

function splitUtf8(text: string, chunkSize: number): (index: number) => Uint8Array | null {
  const bytes = new TextEncoder().encode(text);
  return (index) => {
    const offset = index * chunkSize;
    return offset >= bytes.length ? null : bytes.slice(offset, offset + chunkSize);
  };
}

function postStream(
  stream: ReadableStream<Uint8Array>,
  headers: Record<string, string> = AUTH_HEADER,
  extra: Record<string, string> = {},
): Request {
  return new Request("https://edge.test/fetch-bible-passage", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers, ...extra },
    body: stream,
  });
}

const VALID_BODY = JSON.stringify({ reference: REFERENCE, version: "NVI" });

// ── Request body ───────────────────────────────────────────────────────────

Deno.test("fetch-bible-passage: the 2 KiB request cap cuts the stream at the crossing chunk and never reaches the provider", async () => {
  const { handler, provider } = setup();
  const p = probe();

  const res = await handler(postStream(countingStream(p, filler(100, 1024))));

  assertStrictEquals(res.status, 413);
  assertStrictEquals(p.delivered, 3, "the 3rd KiB crosses 2048; chunks 4-100 must never arrive");
  assertStrictEquals(p.pulls, 3, `only 3 pulls for a ${MAX_BODY_BYTES}-byte cap, not 101`);
  assertStrictEquals(p.cancels, 1, "the reader must cancel the stream");
  assertStrictEquals(provider.length, 0, "an over-limit request must buy no provider work");
});

Deno.test("fetch-bible-passage: a declared oversize request is refused before the first pull", async () => {
  const { handler, provider } = setup();
  const p = probe();

  const res = await handler(postStream(countingStream(p, filler(100, 1024)), AUTH_HEADER, {
    "content-length": "102400",
  }));

  assertStrictEquals(res.status, 413);
  assertStrictEquals(p.pulls, 0, "a declared oversize must cost no pulls at all");
  assertStrictEquals(p.cancels, 1, "the abandoned stream is still cancelled");
  assertStrictEquals(provider.length, 0);
});

Deno.test("fetch-bible-passage: an understated request content-length cannot buy more than the cap", async () => {
  const { handler, provider } = setup();
  const p = probe();

  const res = await handler(postStream(countingStream(p, filler(100, 1024)), AUTH_HEADER, {
    "content-length": "10",
  }));

  assertStrictEquals(res.status, 413);
  assertStrictEquals(p.delivered, 3);
  assertStrictEquals(p.cancels, 1);
  assertStrictEquals(provider.length, 0);
});

Deno.test("fetch-bible-passage: an interrupted or malformed request stream is a 400 that reaches no provider and leaks nothing", async () => {
  const cases: Array<{ label: string; next: (i: number) => Uint8Array | null; failAt?: number }> = [
    { label: "peer hangs up mid-body", next: splitUtf8(VALID_BODY, 4), failAt: 2 },
    { label: "invalid UTF-8", next: (i) => i === 0 ? new Uint8Array([0xff, 0xfe, 0xfd]) : null },
    { label: "truncated JSON", next: splitUtf8('{"reference":', 3) },
  ];
  for (const { label, next, failAt } of cases) {
    const { handler, provider } = setup();
    const res = await handler(postStream(countingStream(probe(), next, { failAt })));

    assertStrictEquals(res.status, 400, label);
    const text = await res.text();
    assertStrictEquals(text.includes("transporte"), false, `${label}: no transport detail may escape`);
    assertStrictEquals(text.includes("stack"), false, label);
    assertStrictEquals(provider.length, 0, label);
  }
});

Deno.test("fetch-bible-passage: an under-limit chunked request is still served", async () => {
  const { handler, provider } = setup();
  const p = probe();

  const res = await handler(postStream(countingStream(p, splitUtf8(VALID_BODY, 5))));

  assertStrictEquals(res.status, 200);
  assertStrictEquals(p.cancels, 0, "a body inside the cap is consumed, not cancelled");
  assertStrictEquals(p.delivered > 1, true, "the fixture must actually arrive in pieces");
  assertStrictEquals(provider.length, 1);
});

Deno.test("fetch-bible-passage: an unauthenticated or unauthorized request is not pulled at all", async () => {
  // The `spyRequest` counters cannot see a streaming read, so ordering is
  // proved here by the stream itself: zero pulls means the guard ran first.
  const unauthenticated = probe();
  const anon = setup();
  const res401 = await anon.handler(postStream(countingStream(unauthenticated, splitUtf8(VALID_BODY, 4)), {}));
  assertStrictEquals(res401.status, 401);
  assertStrictEquals(unauthenticated.pulls, 0, "the body must not be pulled before authentication");
  assertStrictEquals(anon.provider.length, 0);

  const unauthorized = probe();
  const denied = setup({ allow: () => false });
  const res403 = await denied.handler(postStream(countingStream(unauthorized, splitUtf8(VALID_BODY, 4))));
  assertStrictEquals(res403.status, 403);
  assertStrictEquals(unauthorized.pulls, 0, "the body must not be pulled before authorization");
  assertStrictEquals(denied.provider.length, 0);
});

// ── Provider response ──────────────────────────────────────────────────────

Deno.test("fetch-bible-passage: the 1 MiB provider cap cuts the download at the crossing chunk", async () => {
  const p = probe();
  const { handler } = setup({ respond: () => new Response(countingStream(p, filler(2000, 1024))) });

  const res = await handler(post(AUTH_HEADER).req);

  assertStrictEquals(res.status, 502);
  assertStrictEquals(p.delivered, 977, "977 KiB is the first chunk past 1_000_000 bytes");
  assertStrictEquals(
    p.pulls,
    977,
    `977 of 2000 chunks pulled against a ${MAX_PROVIDER_RESPONSE_BYTES}-byte cap, not 2001`,
  );
  assertStrictEquals(p.cancels, 1, "the provider stream must be cancelled immediately after the cap");
});

Deno.test("fetch-bible-passage: a provider reply declaring an oversize length is refused before the first pull", async () => {
  const p = probe();
  const { handler } = setup({
    respond: () =>
      new Response(countingStream(p, filler(2000, 1024)), {
        headers: { "content-length": String(MAX_PROVIDER_RESPONSE_BYTES + 1) },
      }),
  });

  assertStrictEquals((await handler(post(AUTH_HEADER).req)).status, 502);
  assertStrictEquals(p.pulls, 0);
  assertStrictEquals(p.cancels, 1);
});

Deno.test("fetch-bible-passage: an understated provider content-length cannot bypass the streaming cap", async () => {
  const p = probe();
  const { handler } = setup({
    respond: () => new Response(countingStream(p, filler(2000, 1024)), { headers: { "content-length": "10" } }),
  });

  assertStrictEquals((await handler(post(AUTH_HEADER).req)).status, 502);
  assertStrictEquals(p.delivered, 977);
  assertStrictEquals(p.cancels, 1);
});

Deno.test("fetch-bible-passage: an interrupted or invalid provider stream is a value-suppressed 502", async () => {
  const secret = "detalle interno del proveedor";
  const cases: Array<{ label: string; next: (i: number) => Uint8Array | null; failAt?: number }> = [
    { label: "provider hangs up mid-response", next: splitUtf8(JSON.stringify(CHAPTER), 8), failAt: 3 },
    { label: "invalid UTF-8", next: (i) => i === 0 ? new Uint8Array([0xff, 0xfe, 0xfd]) : null },
    { label: "truncated JSON", next: splitUtf8(`[{"verse":16,"text":"${secret}"`, 6) },
  ];
  for (const { label, next, failAt } of cases) {
    const { handler } = setup({ respond: () => new Response(countingStream(probe(), next, { failAt })) });
    const lines = await withCapturedLogs(async (lines) => {
      const res = await handler(post(AUTH_HEADER).req);
      assertStrictEquals(res.status, 502, label);
      const text = await res.text();
      assertEquals(
        JSON.parse(text),
        { success: false, error: "La API no retornó contenido válido para este capítulo" },
        label,
      );
      assertStrictEquals(text.includes(secret), false, label);
      assertStrictEquals(text.includes("transporte"), false, `${label}: no transport detail may escape`);
      assertStrictEquals(text.includes("stack"), false, label);
      return lines;
    });
    for (const line of lines) {
      assertStrictEquals(line.includes(secret), false, `${label}: logs must not carry provider payloads`);
      assertStrictEquals(line.includes("transporte"), false, `${label}: logs must not carry transport detail`);
    }
  }
});

Deno.test("fetch-bible-passage: an under-limit chunked provider response is still parsed and served", async () => {
  const p = probe();
  const { handler } = setup({
    respond: () => new Response(countingStream(p, splitUtf8(JSON.stringify(CHAPTER), 9))),
  });

  const res = await handler(post(AUTH_HEADER).req);

  assertStrictEquals(res.status, 200);
  assertEquals(await res.json(), {
    success: true,
    text: `16 ${PASSAGE_TEXT}, que dio a su Hijo unigénito`,
    reference: "Juan 3:16",
    version: "Nueva Versión Internacional",
    versionCode: "NVI",
  });
  assertStrictEquals(p.cancels, 0, "a reply inside the cap is consumed, not cancelled");
  assertStrictEquals(p.delivered > 1, true, "the fixture must actually arrive in pieces");
});
