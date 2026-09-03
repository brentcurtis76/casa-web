// send-signup-confirmation: ownership / Mesa-admin authorization before any
// privileged read, signed URL, or email. Offline, synthetic.

import { assertEquals, assertStrictEquals } from "@std/assert";

import {
  createHandler,
  type HandlerDeps,
  MAX_BODY_BYTES,
  type ParticipantDetails,
} from "./handler.ts";
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

const CALLER = { id: "user-abc", email: "u@example.com" };
const PARTICIPANT_ID = "part-1";
const DETAILS: ParticipantDetails = {
  email: "participant@example.com",
  fullName: "Participante Ejemplo",
  rolePreference: "guest",
  hasPlusOne: false,
  dinnerDate: "2026-10-03",
  dinnerTime: "20:00",
  registrationDeadline: "2026-09-30T12:00:00Z",
};

interface Trace {
  ownerLookups: string[];
  adminChecks: string[];
  detailLoads: string[];
  signs: number;
  emails: { to: string; subject: string; html: string }[];
  /**
   * Every dependency call in the order it happened. The authorization stage
   * (`owner`, `admin`) has to appear BEFORE the sensitive stage (`pii`, `sign`,
   * `email`); asserting the sequence — not just the counts — is what makes a
   * reordering of the handler fail this suite instead of passing it.
   */
  order: string[];
}

function newTrace(): Trace {
  return { ownerLookups: [], adminChecks: [], detailLoads: [], signs: 0, emails: [], order: [] };
}

function setup(opts: { ownerId?: string | null; admin?: boolean; signOk?: boolean } = {}) {
  const ownerId = opts.ownerId === undefined ? CALLER.id : opts.ownerId;
  const trace: Trace = newTrace();
  const { deps: authzDeps, calls } = makeAuthzDeps({ getUser: strictGetUser(CALLER) });
  const deps: HandlerDeps = {
    authzDeps,
    findParticipantOwner: (id) => {
      trace.ownerLookups.push(id);
      trace.order.push("owner");
      return Promise.resolve(ownerId === null ? null : { userId: ownerId });
    },
    isMesaAdmin: (userId) => {
      trace.adminChecks.push(userId);
      trace.order.push("admin");
      return Promise.resolve(opts.admin ?? false);
    },
    loadParticipantDetails: (id) => {
      trace.detailLoads.push(id);
      trace.order.push("pii");
      return Promise.resolve(DETAILS);
    },
    logoSigner: {
      createSignedUrl: () => {
        trace.signs++;
        trace.order.push("sign");
        return Promise.resolve(
          opts.signOk === false
            ? { data: null, error: new Error("sign failed") }
            : { data: { signedUrl: "https://proj.supabase.co/storage/v1/object/sign/Media/logo.png?token=signed" }, error: null },
        );
      },
    },
    sendEmail: (to, subject, html) => {
      trace.emails.push({ to, subject, html });
      trace.order.push("email");
      return Promise.resolve({ success: true });
    },
  };
  return { handler: createHandler(deps), trace, calls };
}

function post(headers: Record<string, string>, body: unknown = { participantId: PARTICIPANT_ID }) {
  return spyRequest("https://edge.test/send-signup-confirmation", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function assertNothingPrivileged(trace: Trace) {
  assertEquals(trace.ownerLookups, []);
  assertEquals(trace.adminChecks, []);
  assertEquals(trace.detailLoads, []);
  assertStrictEquals(trace.signs, 0);
  assertEquals(trace.emails, []);
}

Deno.test("send-signup-confirmation: no token, anon key, service_role, or publishable key → 401 before any read, signed URL, or email", async () => {
  for (const headers of [{}, ANON_KEY_HEADER, SERVICE_ROLE_HEADER, PUBLISHABLE_KEY_HEADER]) {
    const { handler, trace } = setup();
    await withFetchSpy(async () => {
      const { req, json } = post(headers);
      const res = await handler(req);
      assertStrictEquals(res.status, 401);
      assertStrictEquals(json.calls, 0, "body must not be read before authentication");
      assertNothingPrivileged(trace);
    });
  }
});

Deno.test("send-signup-confirmation: the owner of the participant row gets the email with the logo", async () => {
  const { handler, trace, calls } = setup();
  const lines = await withCapturedLogs(async (lines) => {
    const res = await handler(post(AUTH_HEADER).req);
    assertStrictEquals(res.status, 200);
    assertEquals(await res.json(), { success: true, message: "Confirmation email sent successfully" });
    return lines;
  });
  assertEquals(trace.ownerLookups, [PARTICIPANT_ID]);
  assertEquals(trace.adminChecks, [], "owners need no admin lookup");
  assertEquals(trace.detailLoads, [PARTICIPANT_ID]);
  assertStrictEquals(trace.signs, 1);
  assertStrictEquals(trace.emails.length, 1);
  assertStrictEquals(trace.emails[0].to, DETAILS.email);
  assertStrictEquals(trace.emails[0].html.includes('alt="La Mesa Abierta Logo"'), true);
  assertStrictEquals(trace.emails[0].html.includes(DETAILS.fullName), true);
  assertStrictEquals(calls.some((c) => c.kind === "checkPermission"), false, "no RBAC permission is involved");
  for (const line of lines) {
    assertStrictEquals(line.includes(DETAILS.email), false, "participant email must not be logged");
    assertStrictEquals(line.includes("Participante"), false, "participant name must not be logged");
  }
});

Deno.test("send-signup-confirmation: someone else's participant → 403 with no PII read, signed URL, or email", async () => {
  const { handler, trace } = setup({ ownerId: "user-other" });
  const res = await handler(post(AUTH_HEADER).req);
  assertStrictEquals(res.status, 403);
  assertEquals(await res.json(), { success: false, code: "FORBIDDEN" });
  assertEquals(trace.ownerLookups, [PARTICIPANT_ID]);
  assertEquals(trace.adminChecks, [CALLER.id]);
  assertEquals(trace.detailLoads, []);
  assertStrictEquals(trace.signs, 0);
  assertEquals(trace.emails, []);
});

Deno.test("send-signup-confirmation: a Mesa Abierta admin may confirm another member's signup", async () => {
  const { handler, trace } = setup({ ownerId: "user-other", admin: true });
  const res = await handler(post(AUTH_HEADER).req);
  assertStrictEquals(res.status, 200);
  assertEquals(trace.adminChecks, [CALLER.id]);
  assertStrictEquals(trace.emails.length, 1);
});

Deno.test("send-signup-confirmation: unknown participant → 404; missing/invalid participantId → 400", async () => {
  const missing = setup({ ownerId: null });
  assertStrictEquals((await missing.handler(post(AUTH_HEADER).req)).status, 404);
  assertEquals(missing.trace.emails, []);
  const bad = setup();
  assertStrictEquals((await bad.handler(post(AUTH_HEADER, {}).req)).status, 400);
  assertStrictEquals((await bad.handler(post(AUTH_HEADER, { participantId: 7 }).req)).status, 400);
  assertStrictEquals((await bad.handler(post(AUTH_HEADER, "nope").req)).status, 400);
  assertEquals(bad.trace.ownerLookups, []);
});

Deno.test("send-signup-confirmation: logo signing failure still sends the email without a logo", async () => {
  const { handler, trace } = setup({ signOk: false });
  const res = await handler(post(AUTH_HEADER).req);
  assertStrictEquals(res.status, 200);
  assertStrictEquals(trace.emails.length, 1);
  assertStrictEquals(trace.emails[0].html.includes("<img"), false);
});

// ---------------------------------------------------------------------------
// Output hygiene: HTML escaping of participant data, logo attribute encoding,
// and method restriction (round 2 of the publishable-key review).
// ---------------------------------------------------------------------------

import { escapeHtml, logoSrcAttribute } from "./handler.ts";

const HOSTILE_NAME = `Ana <img src=x onerror=alert(1)> "&'<script>alert(2)</script>`;
const HOSTILE_TIME = `20:00<script>alert(3)</script>`;

function setupWithDetails(details: ParticipantDetails, signedUrl?: string) {
  const trace: Trace = newTrace();
  const { deps: authzDeps, calls } = makeAuthzDeps({ getUser: strictGetUser(CALLER) });
  const deps: HandlerDeps = {
    authzDeps,
    findParticipantOwner: () => Promise.resolve({ userId: CALLER.id }),
    isMesaAdmin: () => Promise.resolve(false),
    loadParticipantDetails: () => Promise.resolve(details),
    logoSigner: {
      createSignedUrl: () => {
        trace.signs++;
        return Promise.resolve(
          signedUrl === undefined
            ? { data: null, error: new Error("no logo in this test") }
            : { data: { signedUrl }, error: null },
        );
      },
    },
    sendEmail: (to, subject, html) => {
      trace.emails.push({ to, subject, html });
      return Promise.resolve({ success: true });
    },
  };
  return { handler: createHandler(deps), trace, calls };
}

Deno.test("send-signup-confirmation: hostile participant strings are HTML-escaped in the email", async () => {
  const { handler, trace } = setupWithDetails({
    ...DETAILS,
    fullName: HOSTILE_NAME,
    dinnerTime: HOSTILE_TIME,
    dinnerDate: "<b>2026-10-03</b>",
    registrationDeadline: "<i>not a date</i>",
  });
  const res = await handler(post(AUTH_HEADER).req);
  assertStrictEquals(res.status, 200);
  assertStrictEquals(trace.emails.length, 1);
  const html = trace.emails[0].html;
  assertStrictEquals(html.includes("<img src=x"), false, "raw participant markup must not survive");
  assertStrictEquals(html.includes("<script>"), false, "raw script tags must not survive");
  assertStrictEquals(html.includes("onerror="), true, "the text is kept — only neutralised");
  assertStrictEquals(html.includes("&lt;img src=x onerror=alert(1)&gt;"), true);
  assertStrictEquals(html.includes("&quot;&amp;&#39;&lt;script&gt;alert(2)&lt;/script&gt;"), true);
  assertStrictEquals(html.includes("<h2>¡Hola Ana &lt;img"), true);
  assertStrictEquals(html.includes("20:00&lt;script&gt;alert(3)&lt;/script&gt;"), true);
  // Hostile date strings only ever render as an escaped "Invalid Date".
  assertStrictEquals(html.includes("<b>2026"), false);
  assertStrictEquals(html.includes("<i>not a date</i>"), false);
});

Deno.test("send-signup-confirmation: the signed logo URL is attribute-encoded, and non-http(s) URLs render no logo", async () => {
  const hostileUrl = 'https://proj.supabase.co/storage/v1/object/sign/Media/logo.png?token=abc&x="><script>alert(1)</script>';
  const { handler, trace } = setupWithDetails(DETAILS, hostileUrl);
  const res = await handler(post(AUTH_HEADER).req);
  assertStrictEquals(res.status, 200);
  const html = trace.emails[0].html;
  const img = html.match(/<img [^>]*>/)?.[0] ?? "";
  assertStrictEquals(img.includes('"><script>'), false, "the URL must not break out of the src attribute");
  assertStrictEquals(html.includes("<script>alert(1)</script>"), false);
  assertStrictEquals(img.includes("token=abc&amp;x="), true, "& is encoded for the attribute");
  const src = img.match(/src="([^"]*)"/)?.[1] ?? "";
  assertStrictEquals(src.length > 0, true);
  assertStrictEquals(/["<>]/.test(src), false, "no raw quote or angle bracket survives inside the attribute value");
  assertStrictEquals(src.includes("%22"), true, "the quote is percent-encoded by URL normalisation");
  assertStrictEquals(src.includes("%3C") || src.includes("&lt;"), true, "< is percent- or entity-encoded");

  const javascript = setupWithDetails(DETAILS, "javascript:alert(1)");
  assertStrictEquals((await javascript.handler(post(AUTH_HEADER).req)).status, 200);
  assertStrictEquals(javascript.trace.emails[0].html.includes("<img"), false, "a javascript: URL renders no logo");

  const garbage = setupWithDetails(DETAILS, "not a url at all");
  assertStrictEquals((await garbage.handler(post(AUTH_HEADER).req)).status, 200);
  assertStrictEquals(garbage.trace.emails[0].html.includes("<img"), false);
});

Deno.test("escapeHtml / logoSrcAttribute", () => {
  assertStrictEquals(escapeHtml(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  assertStrictEquals(logoSrcAttribute("https://proj.supabase.co/a.png?t=1&u=2"), "https://proj.supabase.co/a.png?t=1&amp;u=2");
  assertStrictEquals(logoSrcAttribute("javascript:alert(1)"), null);
  assertStrictEquals(logoSrcAttribute("data:text/html,<script>"), null);
  assertStrictEquals(logoSrcAttribute("nope"), null);
});

Deno.test("send-signup-confirmation: only POST (and OPTIONS) — other methods are 405 before authentication or any read", async () => {
  const { handler, trace, calls } = setup();
  for (const method of ["GET", "PUT", "DELETE"]) {
    const res = await handler(new Request("https://edge.test/send-signup-confirmation", { method, headers: AUTH_HEADER }));
    assertStrictEquals(res.status, 405, method);
  }
  assertEquals(calls, [], "method rejection needs no backend");
  assertNothingPrivileged(trace);
  const preflight = await handler(new Request("https://edge.test/send-signup-confirmation", { method: "OPTIONS" }));
  assertStrictEquals(preflight.status, 200);
});

// ---------------------------------------------------------------------------
// Authorization ORDER (Codex round 3)
//
// `requireUser` is AUTHENTICATION, not ownership authorization: it proves who
// is calling, not that they may touch this participant. The two stages are
// asserted separately below, and each asserts a SEQUENCE, so moving the PII
// load, the logo signing or the email above the ownership/admin decision fails
// here even though the counts would still look right.
// ---------------------------------------------------------------------------

Deno.test("send-signup-confirmation: ownership is decided BEFORE the PII load, the signed URL and the email", async () => {
  const { handler, trace } = setup();
  assertStrictEquals((await handler(post(AUTH_HEADER).req)).status, 200);
  assertEquals(
    trace.order,
    ["owner", "pii", "sign", "email"],
    "the ownership decision must precede every sensitive step",
  );
  assertStrictEquals(trace.order.indexOf("owner") < trace.order.indexOf("pii"), true);
  assertStrictEquals(trace.order.indexOf("owner") < trace.order.indexOf("sign"), true);
  assertStrictEquals(trace.order.indexOf("owner") < trace.order.indexOf("email"), true);
});

Deno.test("send-signup-confirmation: the Mesa-admin fallback is also decided before any sensitive step", async () => {
  const { handler, trace } = setup({ ownerId: "user-other", admin: true });
  assertStrictEquals((await handler(post(AUTH_HEADER).req)).status, 200);
  assertEquals(
    trace.order,
    ["owner", "admin", "pii", "sign", "email"],
    "admin is consulted only after ownership fails, and still before the PII",
  );
});

Deno.test("send-signup-confirmation: a denied caller reaches no sensitive step at all", async () => {
  const { handler, trace } = setup({ ownerId: "user-other", admin: false });
  assertStrictEquals((await handler(post(AUTH_HEADER).req)).status, 403);
  assertEquals(trace.order, ["owner", "admin"], "nothing sensitive may run after a denial");
});

Deno.test("send-signup-confirmation: an unknown participant stops at the ownership lookup", async () => {
  const { handler, trace } = setup({ ownerId: null });
  assertStrictEquals((await handler(post(AUTH_HEADER).req)).status, 404);
  assertEquals(trace.order, ["owner"]);
});

// ---------------------------------------------------------------------------
// Streaming request cap (Codex round 3)
//
// The defective shape used `await req.json()`: the whole upload was pulled and
// materialised before any size was consulted. Counting pulls is the only way to
// tell a bound from a measurement taken afterwards.
// ---------------------------------------------------------------------------

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
  return new Request("https://edge.test/send-signup-confirmation", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers, ...extra },
    body: stream,
  });
}

const VALID_BODY = JSON.stringify({ participantId: PARTICIPANT_ID });
/** 2 KiB cap ÷ 1 KiB chunks: the 3rd chunk is the first to cross it. */
const CROSSING_CHUNK = Math.floor(MAX_BODY_BYTES / 1024) + 1;

Deno.test("send-signup-confirmation: the 2 KiB cap cuts the stream at the crossing chunk and touches no participant", async () => {
  const { handler, trace } = setup();
  const p = probe();

  const res = await handler(postStream(countingStream(p, filler(100, 1024))));

  assertStrictEquals(res.status, 413);
  assertEquals(await res.json(), { success: false, error: "Solicitud demasiado grande" });
  assertStrictEquals(p.delivered, CROSSING_CHUNK, "the crossing chunk is the last one delivered");
  assertStrictEquals(p.pulls, CROSSING_CHUNK, `only ${CROSSING_CHUNK} pulls for a ${MAX_BODY_BYTES}-byte cap, not 101`);
  assertStrictEquals(p.cancels, 1, "the reader must cancel, not drain");
  assertNothingPrivileged(trace);
});

Deno.test("send-signup-confirmation: a declared oversize body is refused before the first pull", async () => {
  const { handler, trace } = setup();
  const p = probe();

  const res = await handler(
    postStream(countingStream(p, filler(100, 1024)), AUTH_HEADER, { "content-length": "102400" }),
  );

  assertStrictEquals(res.status, 413);
  assertStrictEquals(p.pulls, 0, "a declared oversize must cost no pulls at all");
  assertStrictEquals(p.cancels, 1, "the abandoned stream is still cancelled");
  assertNothingPrivileged(trace);
});

Deno.test("send-signup-confirmation: an understated content-length cannot buy more than the cap", async () => {
  const { handler, trace } = setup();
  const p = probe();

  const res = await handler(
    postStream(countingStream(p, filler(100, 1024)), AUTH_HEADER, { "content-length": "10" }),
  );

  assertStrictEquals(res.status, 413);
  assertStrictEquals(p.delivered, CROSSING_CHUNK);
  assertStrictEquals(p.cancels, 1);
  assertNothingPrivileged(trace);
});

Deno.test("send-signup-confirmation: an interrupted or malformed body is a 400 that touches no participant and leaks nothing", async () => {
  const cases: Array<{ label: string; next: (i: number) => Uint8Array | null; failAt?: number }> = [
    { label: "peer hangs up mid-body", next: splitUtf8(VALID_BODY, 4), failAt: 2 },
    { label: "invalid UTF-8", next: (i) => i === 0 ? new Uint8Array([0xff, 0xfe, 0xfd]) : null },
    { label: "truncated JSON", next: splitUtf8('{"participantId":', 3) },
  ];
  for (const { label, next, failAt } of cases) {
    const { handler, trace } = setup();
    const res = await handler(postStream(countingStream(probe(), next, { failAt })));

    assertStrictEquals(res.status, 400, label);
    const text = await res.text();
    assertStrictEquals(text.includes(TRANSPORT_MARKER), false, `${label}: no transport detail may escape`);
    assertStrictEquals(text.includes("stack"), false, label);
    assertNothingPrivileged(trace);
  }
});

Deno.test("send-signup-confirmation: an under-limit chunked body is still served", async () => {
  const { handler, trace } = setup();
  const p = probe();

  const res = await handler(postStream(countingStream(p, splitUtf8(VALID_BODY, 5))));

  assertStrictEquals(res.status, 200);
  assertStrictEquals(p.cancels, 0, "a body inside the cap is consumed, not cancelled");
  assertStrictEquals(p.delivered > 1, true, "the fixture must actually arrive in pieces");
  assertEquals(trace.order, ["owner", "pii", "sign", "email"]);
});

Deno.test("send-signup-confirmation: authentication runs before the body — an unauthenticated stream is never pulled", async () => {
  // `spyRequest` counters cannot see a streaming read, so the ordering of
  // stage 1 against the body read is proved by the stream itself.
  for (const headers of [{}, ANON_KEY_HEADER, SERVICE_ROLE_HEADER, PUBLISHABLE_KEY_HEADER]) {
    const { handler, trace } = setup();
    const p = probe();
    const res = await handler(postStream(countingStream(p, splitUtf8(VALID_BODY, 4)), headers));
    assertStrictEquals(res.status, 401);
    assertStrictEquals(p.pulls, 0, "not one byte may be pulled before authentication");
    assertNothingPrivileged(trace);
  }
});

Deno.test("send-signup-confirmation: a non-POST method is rejected before authentication and before any pull", async () => {
  const { handler, trace, calls } = setup();
  const p = probe();
  const res = await handler(
    new Request("https://edge.test/send-signup-confirmation", {
      method: "PUT",
      headers: { ...AUTH_HEADER },
      body: countingStream(p, splitUtf8(VALID_BODY, 4)),
    }),
  );
  assertStrictEquals(res.status, 405);
  assertStrictEquals(p.pulls, 0);
  assertEquals(calls, []);
  assertNothingPrivileged(trace);
});
