// whatsapp-signup: public endpoint — abuse and privacy protections.
// Offline, synthetic — no Resend, no network.

import { assertEquals, assertStrictEquals } from "@std/assert";

import {
  createHandler,
  createRateLimiter,
  type HandlerDeps,
  MAX_BODY_BYTES,
  MAX_CLOCK_SKEW_MS,
  MAX_TIMESTAMP_AGE_MS,
  MIN_SUBMIT_TIME_MS,
  normalizeName,
  normalizePhone,
  type OutgoingEmail,
  RATE_LIMIT_MAX,
  type RateLimiter,
  SHARED_RATE_LIMIT_KEY,
  SHARED_RATE_LIMIT_MAX,
} from "./handler.ts";
import { withCapturedLogs } from "../_shared/testHelpers.ts";

const NAME = "Valentina Q.";
const PHONE = "+56 9 1234 5678";
/** The handler's clock in every suite unless overridden. */
const T_NOW = 1_700_000_000_000;
/** A `_timestamp` a human would produce: the form was presented 10 s ago. */
const PRESENTED_AT = T_NOW - 10_000;

function setup(overrides: Partial<HandlerDeps> = {}) {
  const sent: OutgoingEmail[] = [];
  const deps: HandlerDeps = {
    sendEmail: (email) => {
      sent.push(email);
      return Promise.resolve({ error: null });
    },
    now: () => T_NOW,
    ...overrides,
  };
  return { handler: createHandler(deps), sent };
}

/**
 * Builds a request the way the active caller (InstagramFeed.tsx) does: a plain
 * object body always carries `_timestamp` unless the case sets it explicitly
 * (use `omitTimestamp` to leave it out on purpose).
 */
function post(
  body: unknown,
  headers: Record<string, string> = {},
  method = "POST",
  opts: { omitTimestamp?: boolean } = {},
) {
  let payload = body;
  if (payload && typeof payload === "object" && !Array.isArray(payload) && !opts.omitTimestamp) {
    payload = { _timestamp: PRESENTED_AT, ...(payload as Record<string, unknown>) };
  }
  return new Request("https://edge.test/whatsapp-signup", {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

Deno.test("whatsapp-signup: a valid public request is emailed, escaped, and not logged", async () => {
  const { handler, sent } = setup();
  const lines = await withCapturedLogs(async (lines) => {
    const res = await handler(post({ name: `${NAME} <b>`, phone: PHONE, _honey: "" }));
    assertStrictEquals(res.status, 200);
    assertEquals(await res.json(), { success: true, message: "Solicitud recibida correctamente" });
    return lines;
  });
  assertStrictEquals(sent.length, 1);
  assertStrictEquals(sent[0].html.includes("&lt;b&gt;"), true);
  assertStrictEquals(sent[0].html.includes("+56912345678"), true);
  for (const line of lines) {
    assertStrictEquals(line.includes("Valentina"), false, "names must not be logged");
    assertStrictEquals(line.includes("1234"), false, "phone numbers must not be logged");
  }
});

Deno.test("whatsapp-signup: non-POST methods are refused", async () => {
  const { handler, sent } = setup();
  assertStrictEquals((await handler(post({ name: NAME, phone: PHONE }, {}, "PUT"))).status, 405);
  assertStrictEquals((await handler(post({ name: NAME, phone: PHONE }, {}, "DELETE"))).status, 405);
  assertEquals(sent.length, 0);
});

Deno.test("whatsapp-signup: honeypot answers a silent 200 without sending", async () => {
  const { handler, sent } = setup();
  const res = await handler(post({ name: NAME, phone: PHONE, _honey: "http://spam" }));
  assertStrictEquals(res.status, 200);
  assertEquals(sent.length, 0);
});

Deno.test("whatsapp-signup: submissions faster than the timing floor are 429", async () => {
  const t0 = 1_700_000_000_000;
  const { handler, sent } = setup({ now: () => t0 + MIN_SUBMIT_TIME_MS - 1 });
  assertStrictEquals((await handler(post({ name: NAME, phone: PHONE, _timestamp: t0 }))).status, 429);
  assertEquals(sent.length, 0);
  const ok = setup({ now: () => t0 + MIN_SUBMIT_TIME_MS });
  assertStrictEquals((await ok.handler(post({ name: NAME, phone: PHONE, _timestamp: t0 }))).status, 200);
});

Deno.test("whatsapp-signup: a missing or malformed `_timestamp` cannot skip the timing check — it is a 400", async () => {
  const { handler, sent } = setup();
  const missing = await handler(post({ name: NAME, phone: PHONE }, {}, "POST", { omitTimestamp: true }));
  assertStrictEquals(missing.status, 400, "omitting _timestamp used to bypass the check");
  const malformed: unknown[] = [
    String(PRESENTED_AT), // numeric string
    null,
    true,
    { at: PRESENTED_AT },
    [PRESENTED_AT],
    T_NOW + MAX_CLOCK_SKEW_MS + 1, // from the future beyond tolerated skew
    T_NOW - MAX_TIMESTAMP_AGE_MS - 1, // stale
  ];
  for (const _timestamp of malformed) {
    const res = await handler(post({ name: NAME, phone: PHONE, _timestamp }));
    assertStrictEquals(res.status, 400, `expected 400 for _timestamp=${JSON.stringify(_timestamp)}`);
  }
  // Boundaries: tolerated skew and maximum age are inclusive.
  assertStrictEquals((await handler(post({ name: NAME, phone: PHONE, _timestamp: T_NOW + MAX_CLOCK_SKEW_MS }))).status, 429);
  assertStrictEquals((await handler(post({ name: NAME, phone: PHONE, _timestamp: T_NOW - MAX_TIMESTAMP_AGE_MS }))).status, 200);
  assertStrictEquals(sent.length, 1);
});

Deno.test("whatsapp-signup: invalid names, phones, bodies, and oversized payloads are rejected", async () => {
  const { handler, sent } = setup();
  const cases: unknown[] = [
    { name: "A", phone: PHONE },
    { name: "x".repeat(101), phone: PHONE },
    { name: "Eva\u0007", phone: PHONE }, // control character (was a raw BEL byte in the earlier suite)
    { name: NAME, phone: "1234567" },
    { name: NAME, phone: "+56 9 hola" },
    { name: NAME, phone: "1".repeat(16) },
    { name: NAME },
    { phone: PHONE },
    [NAME, PHONE],
    "not json",
  ];
  for (const body of cases) {
    const res = await handler(post(body));
    assertStrictEquals(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
  }
  const big = await handler(post({ name: NAME, phone: PHONE, pad: "x".repeat(5000) }));
  assertStrictEquals(big.status, 413);
  assertEquals(sent.length, 0);
});

Deno.test("whatsapp-signup: per-IP rate limit after RATE_LIMIT_MAX requests in the window", async () => {
  const { handler, sent } = setup();
  const ip = { "x-forwarded-for": "203.0.113.7, 10.0.0.1" };
  for (let i = 0; i < RATE_LIMIT_MAX; i++) {
    assertStrictEquals((await handler(post({ name: NAME, phone: PHONE }, ip))).status, 200);
  }
  assertStrictEquals((await handler(post({ name: NAME, phone: PHONE }, ip))).status, 429);
  assertStrictEquals(
    (await handler(post({ name: NAME, phone: PHONE }, { "x-forwarded-for": "198.51.100.2" }))).status,
    200,
  );
  assertStrictEquals(sent.length, RATE_LIMIT_MAX + 1);
});

Deno.test("createRateLimiter: window expiry and bounded memory", () => {
  const limiter = createRateLimiter({ max: 2, windowMs: 1000, maxTrackedKeys: 2 });
  assertStrictEquals(limiter.isLimited("a", 0), false);
  assertStrictEquals(limiter.isLimited("a", 1), false);
  assertStrictEquals(limiter.isLimited("a", 2), true);
  assertStrictEquals(limiter.isLimited("a", 1001), false, "old hits fall out of the window");
  limiter.isLimited("b", 1001);
  limiter.isLimited("c", 1001); // evicts the oldest key
  assertStrictEquals(limiter.isLimited("a", 1002), false, "evicted keys start fresh");
});

Deno.test("whatsapp-signup: provider errors expose no details or stacks", async () => {
  const { handler } = setup({
    sendEmail: () => Promise.resolve({ error: { message: "secret provider detail" } }),
  });
  const res = await handler(post({ name: NAME, phone: PHONE }));
  assertStrictEquals(res.status, 500);
  const text = await res.text();
  assertStrictEquals(text.includes("secret provider detail"), false);
  assertStrictEquals(text.includes("stack"), false);
});

Deno.test("normalizePhone / normalizeName", () => {
  assertStrictEquals(normalizePhone("(56) 9-1234.5678"), "56912345678");
  assertStrictEquals(normalizePhone("+1 202 555 0143"), "+12025550143");
  assertStrictEquals(normalizePhone("++569"), null);
  assertStrictEquals(normalizePhone(569123), null);
  assertStrictEquals(normalizeName("  Ana   María "), "Ana María");
  assertStrictEquals(normalizeName(42), null);
});

// ---------------------------------------------------------------------------
// Streaming body cap — MAX_BODY_BYTES must stop the READ, not just the verdict
//
// Codex's reproduction: a headerless ReadableStream of 100 × 1 KiB chunks was
// consumed whole (102,400 bytes, 101 pulls) before the handler answered 413.
// Every case below therefore counts pulls and cancellations: the status code
// alone cannot tell a real bound from a post-hoc measurement.
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
  headers: Record<string, string> = {},
): Request {
  return new Request("https://edge.test/whatsapp-signup", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: stream,
  });
}

/** Records every key charged, so a test can prove the limiter was not touched. */
function spyLimiter(inner: RateLimiter = createRateLimiter()): { keys: string[]; limiter: RateLimiter } {
  const keys: string[] = [];
  const limiter: RateLimiter = {
    isLimited(key, now) {
      keys.push(key);
      return inner.isLimited(key, now);
    },
  };
  return { keys, limiter };
}

Deno.test("whatsapp-signup: the 4 KiB cap cuts the stream at the chunk that crosses it and never drains the rest", async () => {
  const perIp = spyLimiter();
  const shared = spyLimiter();
  const { handler, sent } = setup({ rateLimiter: perIp.limiter, sharedRateLimiter: shared.limiter });
  const p = probe();

  const res = await handler(postStream(countingStream(p, filler(100, 1024))));

  assertStrictEquals(res.status, 413);
  assertStrictEquals(p.delivered, 5, "the 5th KiB crosses 4096; chunks 6-100 must never arrive");
  assertStrictEquals(p.pulls, 5, `only 5 pulls for a ${MAX_BODY_BYTES}-byte cap, not 101`);
  assertStrictEquals(p.cancels, 1, "the reader must cancel the stream");
  assertEquals(sent, [], "an over-limit body must not send email");
  assertEquals([...perIp.keys, ...shared.keys], [], "an over-limit body must not charge any rate-limit bucket");
});

Deno.test("whatsapp-signup: a declared oversize is refused before the first pull", async () => {
  const { handler, sent } = setup();
  const p = probe();

  const res = await handler(
    postStream(countingStream(p, filler(100, 1024)), { "content-length": "102400" }),
  );

  assertStrictEquals(res.status, 413);
  assertStrictEquals(p.pulls, 0, "a declared oversize must cost no pulls at all");
  assertStrictEquals(p.delivered, 0);
  assertStrictEquals(p.cancels, 1, "the abandoned stream is still cancelled");
  assertEquals(sent, []);
});

Deno.test("whatsapp-signup: an understated content-length cannot buy more than the cap", async () => {
  const { handler, sent } = setup();
  const p = probe();

  // Declares 10 bytes, then streams 100 KiB. The header is an early exit only.
  const res = await handler(
    postStream(countingStream(p, filler(100, 1024)), { "content-length": "10" }),
  );

  assertStrictEquals(res.status, 413);
  assertStrictEquals(p.delivered, 5);
  assertStrictEquals(p.cancels, 1);
  assertEquals(sent, []);
});

Deno.test("whatsapp-signup: an interrupted or malformed stream is a 400 with no email and no rate-limit charge", async () => {
  const cases: Array<{ label: string; next: (i: number) => Uint8Array | null; failAt?: number }> = [
    { label: "peer hangs up mid-body", next: splitUtf8('{"name":"Ana Perez"', 4), failAt: 2 },
    { label: "invalid UTF-8", next: (i) => i === 0 ? new Uint8Array([0xff, 0xfe, 0xfd]) : null },
    { label: "truncated JSON", next: splitUtf8('{"name":', 3) },
  ];
  for (const { label, next, failAt } of cases) {
    const perIp = spyLimiter();
    const shared = spyLimiter();
    const { handler, sent } = setup({ rateLimiter: perIp.limiter, sharedRateLimiter: shared.limiter });
    const res = await handler(postStream(countingStream(probe(), next, { failAt })));

    assertStrictEquals(res.status, 400, label);
    const text = await res.text();
    assertStrictEquals(text.includes("transporte"), false, `${label}: no transport detail may escape`);
    assertStrictEquals(text.includes("stack"), false, label);
    assertEquals(sent, [], label);
    assertEquals([...perIp.keys, ...shared.keys], [], label);
  }
});

Deno.test("whatsapp-signup: an under-limit chunked body is still accepted and emailed", async () => {
  const { handler, sent } = setup();
  const p = probe();
  const body = JSON.stringify({ name: NAME, phone: PHONE, _timestamp: PRESENTED_AT });

  const res = await handler(postStream(countingStream(p, splitUtf8(body, 5))));

  assertStrictEquals(res.status, 200);
  assertStrictEquals(p.cancels, 0, "a body inside the cap is consumed, not cancelled");
  assertStrictEquals(p.delivered > 1, true, "the fixture must actually arrive in pieces");
  assertStrictEquals(sent.length, 1);
  assertStrictEquals(sent[0].html.includes("+56912345678"), true);
});

// ---------------------------------------------------------------------------
// Rate-limit fail-safe: no `x-forwarded-for` used to mean no limit at all
// ---------------------------------------------------------------------------

Deno.test("whatsapp-signup: requests without x-forwarded-for share one bounded bucket instead of going unlimited", async () => {
  const shared = spyLimiter(createRateLimiter({ max: SHARED_RATE_LIMIT_MAX, maxTrackedKeys: 1 }));
  const { handler, sent } = setup({ sharedRateLimiter: shared.limiter });

  for (let i = 0; i < SHARED_RATE_LIMIT_MAX; i++) {
    const res = await handler(post({ name: NAME, phone: PHONE }));
    assertStrictEquals(res.status, 200, `headerless request ${i + 1} should still be served`);
  }
  const overflow = await handler(post({ name: NAME, phone: PHONE }));
  assertStrictEquals(overflow.status, 429, "an unidentifiable caller must not be unlimited");
  assertStrictEquals(sent.length, SHARED_RATE_LIMIT_MAX, "the refused request sends nothing");

  // The bucket is keyed by a constant, never by anything derived from a caller,
  // and the response says nothing about origin.
  assertEquals([...new Set(shared.keys)], [SHARED_RATE_LIMIT_KEY]);
  const body = await overflow.text();
  assertStrictEquals(body.includes(SHARED_RATE_LIMIT_KEY), false, "the bucket key must not be returned");
});

Deno.test("whatsapp-signup: the shared bucket and the per-IP buckets have separate budgets", async () => {
  const perIp = spyLimiter();
  const shared = spyLimiter(createRateLimiter({ max: 1, maxTrackedKeys: 1 }));
  const { handler } = setup({ rateLimiter: perIp.limiter, sharedRateLimiter: shared.limiter });

  assertStrictEquals((await handler(post({ name: NAME, phone: PHONE }))).status, 200);
  assertStrictEquals((await handler(post({ name: NAME, phone: PHONE }))).status, 429, "shared bucket exhausted");

  // An identifiable caller is unaffected by the shared bucket's exhaustion…
  const ip = { "x-forwarded-for": "203.0.113.9" };
  assertStrictEquals((await handler(post({ name: NAME, phone: PHONE }, ip))).status, 200);
  assertEquals(perIp.keys, ["203.0.113.9"], "the per-IP limiter sees only real IPs");
  // …and the shared bucket never sees an IP.
  assertEquals([...new Set(shared.keys)], [SHARED_RATE_LIMIT_KEY]);
});

Deno.test("whatsapp-signup: the shipped default for the shared bucket is bounded, not merely injectable", async () => {
  // No `sharedRateLimiter` override: this exercises SHARED_RATE_LIMIT_MAX as it
  // is wired in production.
  const { handler } = setup();
  for (let i = 0; i < SHARED_RATE_LIMIT_MAX; i++) {
    assertStrictEquals((await handler(post({ name: NAME, phone: PHONE }))).status, 200);
  }
  assertStrictEquals((await handler(post({ name: NAME, phone: PHONE }))).status, 429);
});
