// prayer-request: a publishable key alone must never trigger an email.
// Offline, synthetic — no Resend, no Supabase, no network.

import { assertEquals, assertStrictEquals } from "@std/assert";

import { createHandler, type HandlerDeps, type OutgoingEmail } from "./handler.ts";
import {
  ANON_KEY_HEADER,
  AUTH_HEADER,
  makeAuthzDeps,
  PUBLISHABLE_KEY_HEADER,
  SERVICE_ROLE_HEADER,
  spyRequest,
  strictGetUser,
  withCapturedLogs,
  withFetchSpy,
} from "../_shared/testHelpers.ts";

function setup(overrides: Partial<HandlerDeps> = {}) {
  const { deps: authzDeps, calls } = makeAuthzDeps({ getUser: strictGetUser() });
  const sent: OutgoingEmail[] = [];
  const deps: HandlerDeps = {
    authzDeps,
    sendEmail: (email) => {
      sent.push(email);
      return Promise.resolve({ error: null });
    },
    ...overrides,
  };
  return { handler: createHandler(deps), calls, sent };
}

const BODY = { request: "Por mi familia", name: "M. P.", isAnonymous: false };

function post(headers: Record<string, string>, body: unknown = BODY) {
  return spyRequest("https://edge.test/prayer-request", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

Deno.test("prayer-request: OPTIONS preflight skips auth and sends nothing", async () => {
  const { handler, calls, sent } = setup();
  const res = await handler(new Request("https://edge.test/prayer-request", { method: "OPTIONS" }));
  assertStrictEquals(res.status, 200);
  assertEquals(calls.length, 0);
  assertEquals(sent.length, 0);
});

Deno.test("prayer-request: no token, anon key, service_role, or publishable key → 401 before body or email", async () => {
  for (const headers of [{}, ANON_KEY_HEADER, SERVICE_ROLE_HEADER, PUBLISHABLE_KEY_HEADER]) {
    const { handler, sent } = setup();
    await withFetchSpy(async (fetchSpy) => {
      const { req, json } = post(headers);
      const res = await handler(req);
      assertStrictEquals(res.status, 401);
      assertEquals(await res.json(), { success: false, code: "UNAUTHORIZED" });
      assertStrictEquals(json.calls, 0, "body must not be read");
      assertEquals(sent.length, 0, "no email may be sent");
      assertEquals(fetchSpy.calls.length, 0);
    });
  }
});

Deno.test("prayer-request: backend outage fails closed (503) without sending", async () => {
  const { deps: authzDeps } = makeAuthzDeps({
    getUser: () => Promise.resolve({ kind: "backend_error" as const }),
  });
  const { handler, sent } = setup({ authzDeps });
  const res = await handler(post(AUTH_HEADER).req);
  assertStrictEquals(res.status, 503);
  assertEquals(sent.length, 0);
});

Deno.test("prayer-request: an authenticated user's request is emailed, HTML-escaped, and never logged", async () => {
  const { handler, sent } = setup();
  const body = { request: "Por <b>todos</b>", name: "Ana <x>", isAnonymous: false };
  const lines = await withCapturedLogs(async (lines) => {
    const res = await handler(post(AUTH_HEADER, body).req);
    assertStrictEquals(res.status, 200);
    assertEquals(await res.json(), {
      success: true,
      message: "Petición de oración recibida correctamente",
    });
    return lines;
  });
  assertStrictEquals(sent.length, 1);
  assertStrictEquals(sent[0].html.includes("&lt;b&gt;todos&lt;/b&gt;"), true);
  assertStrictEquals(sent[0].html.includes("Ana &lt;x&gt;"), true);
  assertStrictEquals(sent[0].html.includes("<b>todos</b>"), false);
  for (const line of lines) {
    assertStrictEquals(line.includes("Ana"), false, "the name must not be logged");
    assertStrictEquals(line.includes("todos"), false, "the request text must not be logged");
  }
});

Deno.test("prayer-request: anonymous requests omit the name even when one is supplied", async () => {
  const { handler, sent } = setup();
  const res = await handler(post(AUTH_HEADER, { request: "x", name: "Ana", isAnonymous: true }).req);
  assertStrictEquals(res.status, 200);
  assertStrictEquals(sent[0].subject, "Nueva petición de oración anónima");
  assertStrictEquals(sent[0].html.includes("Ana"), false);
});

Deno.test("prayer-request: empty or oversized requests are 400 and not sent", async () => {
  const { handler, sent } = setup();
  assertStrictEquals((await handler(post(AUTH_HEADER, { request: "  " }).req)).status, 400);
  assertStrictEquals((await handler(post(AUTH_HEADER, { request: "x".repeat(5001) }).req)).status, 400);
  assertStrictEquals((await handler(post(AUTH_HEADER, "not-json").req)).status, 400);
  assertEquals(sent.length, 0);
});

Deno.test("prayer-request: provider errors are reported without details or stacks", async () => {
  const { handler } = setup({
    sendEmail: () => Promise.resolve({ error: { message: "secret provider detail" } }),
  });
  const res = await handler(post(AUTH_HEADER).req);
  assertStrictEquals(res.status, 500);
  const text = await res.text();
  assertStrictEquals(text.includes("secret provider detail"), false);
  assertStrictEquals(text.includes("stack"), false);
});

Deno.test("prayer-request: missing RESEND_API_KEY is a 500 only after authentication", async () => {
  const { handler } = setup({ sendEmail: null });
  assertStrictEquals((await handler(post({}).req)).status, 401);
  assertStrictEquals((await handler(post(AUTH_HEADER).req)).status, 500);
});

// ---------------------------------------------------------------------------
// Streaming request cap (Codex round 3)
//
// The defective shape used `await req.json()`: the whole upload was pulled and
// materialised before any size was consulted. `MAX_REQUEST_CHARS` did not help
// — it measured a string that already existed. Counting pulls is the only way
// to tell a bound from a measurement taken afterwards, so every case below
// asserts where the read actually stopped, and that no email was bought.
// ---------------------------------------------------------------------------

import { MAX_BODY_BYTES, MAX_NAME_CHARS, MAX_REQUEST_CHARS } from "./handler.ts";

interface StreamProbe {
  pulls: number;
  cancels: number;
  delivered: number;
}

const probe = (): StreamProbe => ({ pulls: 0, cancels: 0, delivered: 0 });

const TRANSPORT_MARKER = "DETALLE-TRANSPORTE-MARCADOR";

/** A body with no `content-length`, handing out chunks until `next` returns null. */
function countingStream(
  p: StreamProbe,
  next: (index: number) => Uint8Array | null,
  opts: { failAt?: number } = {},
): ReadableStream<Uint8Array> {
  let index = 0;
  // `highWaterMark: 0` switches off the stream's own one-chunk read-ahead, so
  // `pulls` counts exactly what the consumer asked for.
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      p.pulls++;
      if (opts.failAt !== undefined && index === opts.failAt) {
        controller.error(new Error(TRANSPORT_MARKER));
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
  return new Request("https://edge.test/prayer-request", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers, ...extra },
    body: stream,
  });
}

const VALID_BODY = JSON.stringify(BODY);
/** 32 KiB cap ÷ 1 KiB chunks: the 33rd chunk is the first to cross it. */
const CROSSING_CHUNK = Math.floor(MAX_BODY_BYTES / 1024) + 1;

Deno.test("prayer-request: the cap cuts the stream at the crossing chunk and buys no email", async () => {
  const { handler, sent } = setup();
  const p = probe();

  const res = await handler(postStream(countingStream(p, filler(400, 1024))));

  assertStrictEquals(res.status, 413);
  assertEquals(await res.json(), { success: false, error: "Solicitud demasiado grande" });
  assertStrictEquals(p.delivered, CROSSING_CHUNK, "the crossing chunk is the last one delivered");
  assertStrictEquals(
    p.pulls,
    CROSSING_CHUNK,
    `only ${CROSSING_CHUNK} pulls for a ${MAX_BODY_BYTES}-byte cap, not 401`,
  );
  assertStrictEquals(p.cancels, 1, "the reader must cancel, not drain");
  assertEquals(sent, [], "an over-limit upload must send nothing");
});

Deno.test("prayer-request: a declared oversize body is refused before the first pull", async () => {
  const { handler, sent } = setup();
  const p = probe();

  const res = await handler(
    postStream(countingStream(p, filler(400, 1024)), AUTH_HEADER, { "content-length": "409600" }),
  );

  assertStrictEquals(res.status, 413);
  assertStrictEquals(p.pulls, 0, "a declared oversize must cost no pulls at all");
  assertStrictEquals(p.cancels, 1, "the abandoned stream is still cancelled");
  assertEquals(sent, []);
});

Deno.test("prayer-request: an understated content-length cannot buy more than the cap", async () => {
  const { handler, sent } = setup();
  const p = probe();

  const res = await handler(
    postStream(countingStream(p, filler(400, 1024)), AUTH_HEADER, { "content-length": "10" }),
  );

  assertStrictEquals(res.status, 413);
  assertStrictEquals(p.delivered, CROSSING_CHUNK, "the declaration is an early exit, never a licence");
  assertStrictEquals(p.cancels, 1);
  assertEquals(sent, []);
});

Deno.test("prayer-request: an interrupted or malformed body is a fixed 400 that sends nothing and leaks nothing", async () => {
  const cases: Array<{ label: string; next: (i: number) => Uint8Array | null; failAt?: number }> = [
    { label: "peer hangs up mid-body", next: splitUtf8(VALID_BODY, 4), failAt: 2 },
    { label: "invalid UTF-8", next: (i) => i === 0 ? new Uint8Array([0xff, 0xfe, 0xfd]) : null },
    { label: "truncated JSON", next: splitUtf8('{"request":', 3) },
    { label: "a bare JSON array", next: splitUtf8("[1,2,3]", 3) },
  ];
  for (const { label, next, failAt } of cases) {
    const { handler, sent } = setup();
    const res = await handler(postStream(countingStream(probe(), next, { failAt })));

    assertStrictEquals(res.status, 400, label);
    const text = await res.text();
    assertStrictEquals(text.includes(TRANSPORT_MARKER), false, `${label}: no transport detail may escape`);
    assertStrictEquals(text.includes("stack"), false, label);
    assertEquals(sent, [], label);
  }
});

Deno.test("prayer-request: an under-limit chunked body is still delivered and emailed", async () => {
  const { handler, sent } = setup();
  const p = probe();

  const res = await handler(postStream(countingStream(p, splitUtf8(VALID_BODY, 5))));

  assertStrictEquals(res.status, 200);
  assertStrictEquals(p.cancels, 0, "a body inside the cap is consumed, not cancelled");
  assertStrictEquals(p.delivered > 1, true, "the fixture must actually arrive in pieces");
  assertStrictEquals(sent.length, 1);
});

Deno.test("prayer-request: the longest legitimate petition still fits under the byte cap", async () => {
  // The cap must not become a second, tighter character limit: a petition at
  // exactly MAX_REQUEST_CHARS — including multi-byte characters — must pass.
  const { handler, sent } = setup();
  const petition = "ñ".repeat(MAX_REQUEST_CHARS);
  const body = JSON.stringify({ request: petition, name: "M".repeat(MAX_NAME_CHARS), isAnonymous: false });
  assertStrictEquals(
    new TextEncoder().encode(body).byteLength < MAX_BODY_BYTES,
    true,
    "the largest payload the character limits allow must fit under the byte cap",
  );

  const p = probe();
  const res = await handler(postStream(countingStream(p, splitUtf8(body, 997))));
  assertStrictEquals(res.status, 200);
  assertStrictEquals(p.cancels, 0);
  assertStrictEquals(sent.length, 1);
});

Deno.test("prayer-request: authentication runs before the body — an unauthenticated stream is never pulled", async () => {
  // `spyRequest` counters cannot see a streaming read, so the ordering of
  // authentication against the body read is proved by the stream itself.
  for (const headers of [{}, ANON_KEY_HEADER, SERVICE_ROLE_HEADER, PUBLISHABLE_KEY_HEADER]) {
    const { handler, sent } = setup();
    const p = probe();
    const res = await handler(postStream(countingStream(p, splitUtf8(VALID_BODY, 4)), headers));
    assertStrictEquals(res.status, 401);
    assertStrictEquals(p.pulls, 0, "not one byte may be pulled before authentication");
    assertEquals(sent, [], "no email may be sent");
  }
});

Deno.test("prayer-request: an authz backend outage also refuses before any pull", async () => {
  const { deps: authzDeps } = makeAuthzDeps({
    getUser: () => Promise.resolve({ kind: "backend_error" as const }),
  });
  const { handler, sent } = setup({ authzDeps });
  const p = probe();
  const res = await handler(postStream(countingStream(p, splitUtf8(VALID_BODY, 4))));
  assertStrictEquals(res.status, 503);
  assertStrictEquals(p.pulls, 0, "a fail-closed 503 must not pull the body either");
  assertEquals(sent, []);
});

Deno.test("prayer-request: an over-cap upload logs nothing about the request and no transport detail", async () => {
  const { handler, sent } = setup();
  const p = probe();
  const lines = await withCapturedLogs(async (lines) => {
    const res = await handler(postStream(countingStream(p, filler(400, 1024))));
    assertStrictEquals(res.status, 413);
    return lines;
  });
  for (const line of lines) {
    assertStrictEquals(line.includes(TRANSPORT_MARKER), false, `no transport detail may be logged: ${line}`);
    assertStrictEquals(line.includes("aaaa"), false, `no request bytes may be logged: ${line}`);
  }
  assertEquals(sent, []);
});
