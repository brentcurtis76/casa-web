// generate-children-lesson: fail-closed authz before the body is read and
// before Anthropic. Offline, synthetic — no Supabase, no network.

import { assertEquals, assertStrictEquals } from "@std/assert";

import {
  corsHeaders,
  createHandler,
  FAILURES,
  type HandlerDeps,
  MAX_BODY_BYTES,
  MAX_PROVIDER_RESPONSE_BYTES,
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
import type { RequirePermissionDeps } from "../_shared/liturgyAuth.ts";

function baseDeps(authzDeps: RequirePermissionDeps): HandlerDeps {
  return { anthropicApiKey: "test-anthropic-key", authzDeps };
}

function samplePayload(extra: Record<string, unknown> = {}) {
  return {
    liturgyId: "lit-1",
    liturgyTitle: "Adviento",
    liturgySummary: "Esperanza",
    bibleText: "Lucas 1",
    storyData: {
      title: "La espera",
      summary: "Un cuento",
      spiritualConnection: "Esperar con fe",
      scenes: [{ text: "Escena 1" }],
    },
    ageGroup: "preschool",
    ageGroupLabel: "Preescolar",
    durationMax: 30,
    ...extra,
  };
}

function post(headers: Record<string, string>, body: unknown = samplePayload()) {
  return spyRequest("https://edge.test/generate-children-lesson", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const LESSON = {
  activityName: "Luces de esperanza",
  materials: ["velas de papel"],
  sequence: [
    { phase: "movimiento", title: "a", description: "b", minutes: 5 },
    { phase: "expresion_conversacion", title: "c", description: "d", minutes: 10 },
    { phase: "reflexion_metaprendizaje", title: "e", description: "f", minutes: 5 },
  ],
  adaptations: { small: "s", medium: "m", large: "l", mixed: "x" },
  volunteerPlan: { leader: "L", support: "S" },
  estimatedTotalMinutes: 20,
};

function anthropicOk(): Promise<Response> {
  return Promise.resolve(
    new Response(
      JSON.stringify({
        content: [{ type: "text", text: "```json\n" + JSON.stringify(LESSON) + "\n```" }],
        usage: { input_tokens: 1, output_tokens: 2 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
}

Deno.test("generate-children-lesson: OPTIONS preflight skips the guard", async () => {
  const { deps: authz, calls } = makeAuthzDeps();
  const handler = createHandler(baseDeps(authz));
  await withFetchSpy(async (fetchSpy) => {
    const res = await handler(new Request("https://edge.test/x", { method: "OPTIONS" }));
    assertStrictEquals(res.status, 200);
    assertEquals(res.headers.get("Access-Control-Allow-Origin"), corsHeaders["Access-Control-Allow-Origin"]);
    assertEquals(calls.length, 0);
    assertEquals(fetchSpy.calls.length, 0);
  });
});

Deno.test("generate-children-lesson: no token, anon key, service_role, or publishable key → 401, body unread, no Anthropic", async () => {
  for (const headers of [{}, ANON_KEY_HEADER, SERVICE_ROLE_HEADER, PUBLISHABLE_KEY_HEADER]) {
    const { deps: authz, calls } = makeAuthzDeps({ getUser: strictGetUser() });
    const handler = createHandler(baseDeps(authz));
    await withFetchSpy(async (fetchSpy) => {
      const { req, json } = post(headers);
      const res = await handler(req);
      assertStrictEquals(res.status, 401);
      assertEquals(await res.json(), { success: false, code: "UNAUTHORIZED" });
      assertStrictEquals(json.calls, 0);
      assertEquals(fetchSpy.providerCalls.length, 0);
      assertEquals(calls.filter((c) => c.kind === "checkPermission"), []);
    });
  }
});

Deno.test("generate-children-lesson: authenticated but without liturgy_builder/write → 403, no Anthropic", async () => {
  const { deps: authz, calls } = makeAuthzDeps({
    getUser: strictGetUser(),
    checkPermission: () => Promise.resolve({ kind: "denied" as const }),
  });
  const handler = createHandler(baseDeps(authz));
  await withFetchSpy(async (fetchSpy) => {
    const { req, json } = post(AUTH_HEADER);
    const res = await handler(req);
    assertStrictEquals(res.status, 403);
    assertStrictEquals(json.calls, 0);
    assertEquals(fetchSpy.providerCalls.length, 0);
    assertEquals(calls.at(-1), {
      kind: "checkPermission",
      userId: "user-abc",
      resource: "liturgy_builder",
      action: "write",
    });
  });
});

Deno.test("generate-children-lesson: authz backend failure → 503, no Anthropic", async () => {
  const { deps: authz } = makeAuthzDeps({
    getUser: () => Promise.resolve({ kind: "backend_error" as const }),
  });
  const handler = createHandler(baseDeps(authz));
  await withFetchSpy(async (fetchSpy) => {
    const res = await handler(post(AUTH_HEADER).req);
    assertStrictEquals(res.status, 503);
    assertEquals(fetchSpy.calls.length, 0);
  });
});

Deno.test("generate-children-lesson: an authorized liturgy writer still gets a lesson", async () => {
  const { deps: authz } = makeAuthzDeps({ getUser: strictGetUser() });
  const handler = createHandler(baseDeps(authz));
  await withFetchSpy(async (fetchSpy) => {
    const res = await handler(post(AUTH_HEADER).req);
    assertStrictEquals(res.status, 200);
    const body = await res.json();
    assertStrictEquals(body.success, true);
    assertStrictEquals(body.activityName, LESSON.activityName);
    assertStrictEquals(fetchSpy.providerCalls.length, 1);
    assertStrictEquals(fetchSpy.providerCalls[0].url, "https://api.anthropic.com/v1/messages");
  }, anthropicOk);
});

Deno.test("generate-children-lesson: previewPromptOnly is authorized too, and costs nothing", async () => {
  const { deps: authz } = makeAuthzDeps({ getUser: strictGetUser() });
  const handler = createHandler(baseDeps(authz));
  await withFetchSpy(async (fetchSpy) => {
    const res = await handler(post(AUTH_HEADER, samplePayload({ previewPromptOnly: true })).req);
    assertStrictEquals(res.status, 200);
    const body = await res.json();
    assertStrictEquals(typeof body.promptPreview?.userPrompt, "string");
    assertEquals(fetchSpy.calls.length, 0);
  });
  const denied = createHandler(baseDeps(makeAuthzDeps({
    getUser: strictGetUser(),
    checkPermission: () => Promise.resolve({ kind: "denied" as const }),
  }).deps));
  assertStrictEquals((await denied(post(AUTH_HEADER, samplePayload({ previewPromptOnly: true })).req)).status, 403);
});

// ---------------------------------------------------------------------------
// Value suppression in logs and error responses (Codex round 3)
//
// The defective shape logged `Generando lección para: "<ageGroupLabel>" en
// "<liturgyTitle>"` with the request id, then the first 500 characters of the
// model's answer, then the parsed activity name, then the whole exception
// object — and answered the browser with `error.message`, which carried the
// provider status text, the parse failure, or the generated/requested minutes.
// Every marker below is unique, so a single surviving interpolation fails.
// ---------------------------------------------------------------------------

/** Distinctive strings that must never appear in a log line. */
const M = {
  liturgyTitle: "TITULO-LITURGIA-MARCADOR",
  liturgySummary: "RESUMEN-MARCADOR",
  bibleText: "TEXTO-BIBLICO-MARCADOR",
  scene: "ESCENA-MARCADOR",
  ageGroupLabel: "GRUPO-EDAD-MARCADOR",
  requestId: "REQUEST-ID-MARCADOR",
  activityName: "NOMBRE-ACTIVIDAD-MARCADOR",
  providerBody: "CUERPO-PROVEEDOR-MARCADOR",
  transport: "DETALLE-TRANSPORTE-MARCADOR",
} as const;

function markedPayload(extra: Record<string, unknown> = {}) {
  return samplePayload({
    liturgyTitle: M.liturgyTitle,
    liturgySummary: M.liturgySummary,
    bibleText: M.bibleText,
    storyData: {
      title: "La espera",
      summary: "Un cuento",
      spiritualConnection: "Esperar con fe",
      scenes: [{ text: M.scene }],
    },
    ageGroupLabel: M.ageGroupLabel,
    requestId: M.requestId,
    ...extra,
  });
}

/** A provider reply whose lesson (and surrounding prose) carries markers. */
function markedLessonReply(lesson: Record<string, unknown> = {}): Promise<Response> {
  return Promise.resolve(
    new Response(
      JSON.stringify({
        content: [{
          type: "text",
          text: `${M.providerBody}\n\`\`\`json\n${
            JSON.stringify({ ...LESSON, activityName: M.activityName, ...lesson })
          }\n\`\`\``,
        }],
        usage: { input_tokens: 1, output_tokens: 2 },
      }),
      { status: 200 },
    ),
  );
}

function authorized() {
  return createHandler(baseDeps(makeAuthzDeps({ getUser: strictGetUser() }).deps));
}

function assertNoMarkers(lines: string[], keys: Array<keyof typeof M>) {
  for (const line of lines) {
    for (const key of keys) {
      assertStrictEquals(
        line.includes(M[key]),
        false,
        `log line must not carry ${key}: ${line}`,
      );
    }
  }
}

Deno.test("generate-children-lesson: the success path logs no request content, no provider output, and no parsed lesson", async () => {
  const handler = authorized();
  const lines = await withCapturedLogs((lines) =>
    withFetchSpy(async () => {
      const res = await handler(post(AUTH_HEADER, markedPayload()).req);
      assertStrictEquals(res.status, 200);
      const body = await res.json();
      // The authorized caller still receives its own lesson — suppression is
      // about the LOGS and about failure responses, not about the payload.
      assertStrictEquals(body.activityName, M.activityName);
      assertStrictEquals(body.requestId, M.requestId);
      return lines;
    }, () => markedLessonReply())
  );
  assertStrictEquals(lines.length > 0, true, "the handler must still log something");
  assertNoMarkers(lines, [
    "liturgyTitle",
    "liturgySummary",
    "bibleText",
    "scene",
    "ageGroupLabel",
    "requestId",
    "activityName",
    "providerBody",
  ]);
});

Deno.test("generate-children-lesson: a provider error echoes no body, no status text, and no request content", async () => {
  const handler = authorized();
  const lines = await withCapturedLogs((lines) =>
    withFetchSpy(async () => {
      const res = await handler(post(AUTH_HEADER, markedPayload()).req);
      assertStrictEquals(res.status, FAILURES.PROVIDER_ERROR.status);
      assertEquals(await res.json(), {
        success: false,
        error: FAILURES.PROVIDER_ERROR.error,
        code: "PROVIDER_ERROR",
      });
      return lines;
    }, () =>
      Promise.resolve(
        new Response(`{"error":{"message":"${M.providerBody}"}}`, {
          status: 429,
          statusText: M.providerBody,
        }),
      ))
  );
  assertNoMarkers(lines, ["providerBody", "liturgyTitle", "ageGroupLabel", "requestId"]);
  // The HTTP status IS kept — it is bounded, non-sensitive metadata.
  assertStrictEquals(lines.some((l) => l.includes("429")), true, "the provider status is useful and safe");
});

Deno.test("generate-children-lesson: an unparseable provider answer is a fixed 502 that quotes nothing", async () => {
  const handler = authorized();
  const lines = await withCapturedLogs((lines) =>
    withFetchSpy(async () => {
      const res = await handler(post(AUTH_HEADER, markedPayload()).req);
      assertStrictEquals(res.status, FAILURES.INVALID_PROVIDER_RESPONSE.status);
      const text = await res.text();
      assertStrictEquals(text.includes(M.providerBody), false, "the model's answer must not be echoed");
      assertStrictEquals(JSON.parse(text).code, "INVALID_PROVIDER_RESPONSE");
      return lines;
    }, () =>
      Promise.resolve(
        new Response(
          JSON.stringify({ content: [{ type: "text", text: `${M.providerBody} { no es json }` }] }),
          { status: 200 },
        ),
      ))
  );
  assertNoMarkers(lines, ["providerBody", "liturgyTitle", "ageGroupLabel"]);
});

Deno.test("generate-children-lesson: an over-duration lesson is a fixed 502 that discloses neither duration", async () => {
  // The defective shape answered `Tiempo total (60min) excede máximo (10min)` —
  // generated and requested application content, straight to the browser.
  const handler = authorized();
  const lines = await withCapturedLogs((lines) =>
    withFetchSpy(async () => {
      const res = await handler(post(AUTH_HEADER, markedPayload({ durationMax: 10 })).req);
      assertStrictEquals(res.status, FAILURES.LESSON_TOO_LONG.status);
      const text = await res.text();
      assertEquals(JSON.parse(text), {
        success: false,
        error: FAILURES.LESSON_TOO_LONG.error,
        code: "LESSON_TOO_LONG",
      });
      assertStrictEquals(/\d/.test(JSON.parse(text).error), false, "no minute value may appear");
      return lines;
    }, () => markedLessonReply({ estimatedTotalMinutes: 60 }))
  );
  assertNoMarkers(lines, ["activityName", "ageGroupLabel", "liturgyTitle", "providerBody"]);
  for (const line of lines) {
    assertStrictEquals(line.includes("60"), false, `the generated duration must not be logged: ${line}`);
  }
});

Deno.test("generate-children-lesson: a transport failure leaks neither the exception nor the endpoint", async () => {
  const handler = authorized();
  const lines = await withCapturedLogs((lines) =>
    withFetchSpy(async () => {
      const res = await handler(post(AUTH_HEADER, markedPayload()).req);
      assertStrictEquals(res.status, FAILURES.PROVIDER_UNAVAILABLE.status);
      const text = await res.text();
      assertStrictEquals(text.includes(M.transport), false);
      assertStrictEquals(JSON.parse(text).code, "PROVIDER_UNAVAILABLE");
      return lines;
    }, () => Promise.reject(new Error(M.transport)))
  );
  assertNoMarkers(lines, ["transport", "liturgyTitle", "ageGroupLabel"]);
  for (const line of lines) {
    assertStrictEquals(line.includes("api.anthropic.com"), false, `the endpoint must not be logged: ${line}`);
  }
});

Deno.test("generate-children-lesson: an unexpected exception is a fixed 500 with no message or stack", async () => {
  // `storyData.scenes` is not an array, so prompt building throws. The old
  // catch logged the whole Error and returned `error.message`.
  const handler = authorized();
  const lines = await withCapturedLogs((lines) =>
    withFetchSpy(async (fetchSpy) => {
      const res = await handler(
        post(AUTH_HEADER, markedPayload({ storyData: { title: M.scene, scenes: "no-array" } })).req,
      );
      assertStrictEquals(res.status, FAILURES.UNEXPECTED_ERROR.status);
      assertEquals(await res.json(), {
        success: false,
        error: FAILURES.UNEXPECTED_ERROR.error,
        code: "UNEXPECTED_ERROR",
      });
      assertEquals(fetchSpy.calls.length, 0, "a malformed request buys no provider work");
      return lines;
    })
  );
  for (const line of lines) {
    assertStrictEquals(line.includes("scenes"), false, `no exception message may be logged: ${line}`);
    assertStrictEquals(line.includes("at "), false, `no stack frame may be logged: ${line}`);
  }
});

Deno.test("generate-children-lesson: an invalid or missing body is a fixed 400 and buys no provider work", async () => {
  const handler = authorized();
  await withFetchSpy(async (fetchSpy) => {
    for (const body of [{}, { liturgyId: "lit-1" }, "no-es-json", [1, 2, 3]]) {
      const req = new Request("https://edge.test/generate-children-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH_HEADER },
        body: typeof body === "string" ? body : JSON.stringify(body),
      });
      const res = await handler(req);
      assertStrictEquals(res.status, FAILURES.INVALID_REQUEST.status, JSON.stringify(body));
      assertStrictEquals((await res.json()).code, "INVALID_REQUEST");
    }
    assertEquals(fetchSpy.calls.length, 0);
  });
});

Deno.test("generate-children-lesson: a missing ANTHROPIC_API_KEY is a fixed 500 that names no variable", async () => {
  const handler = createHandler({
    anthropicApiKey: "",
    authzDeps: makeAuthzDeps({ getUser: strictGetUser() }).deps,
  });
  const lines = await withCapturedLogs((lines) =>
    withFetchSpy(async (fetchSpy) => {
      const res = await handler(post(AUTH_HEADER).req);
      assertStrictEquals(res.status, FAILURES.CONFIG_ERROR.status);
      assertStrictEquals((await res.json()).code, "CONFIG_ERROR");
      assertEquals(fetchSpy.calls.length, 0);
      return lines;
    })
  );
  for (const line of lines) {
    assertStrictEquals(line.includes("ANTHROPIC"), false, `the env var name stays out of the log: ${line}`);
  }
});

// ---------------------------------------------------------------------------
// Streaming caps — on the request AND on the untrusted provider reply
//
// The defective shape used `await req.json()` and `await response.json()` /
// `response.text()`: both pulled the stream to completion before any size was
// consulted. Counting pulls is the only way to tell a bound from a measurement
// taken afterwards, so every case below asserts where the read actually stopped.
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
  // `pulls` counts exactly what the consumer asked for.
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      p.pulls++;
      if (opts.failAt !== undefined && index === opts.failAt) {
        controller.error(new Error(M.transport));
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
  return new Request("https://edge.test/generate-children-lesson", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers, ...extra },
    body: stream,
  });
}

const VALID_BODY = JSON.stringify(samplePayload());
/** 64 KiB cap ÷ 1 KiB chunks: the 65th chunk is the first to cross it. */
const CROSSING_CHUNK = Math.floor(MAX_BODY_BYTES / 1024) + 1;

// ── Request body ───────────────────────────────────────────────────────────

Deno.test("generate-children-lesson: the request cap cuts the stream at the crossing chunk and never reaches Anthropic", async () => {
  const handler = authorized();
  const p = probe();
  await withFetchSpy(async (fetchSpy) => {
    const res = await handler(postStream(countingStream(p, filler(400, 1024))));
    assertStrictEquals(res.status, FAILURES.REQUEST_TOO_LARGE.status);
    assertStrictEquals((await res.json()).code, "REQUEST_TOO_LARGE");
    assertEquals(fetchSpy.calls.length, 0, "an over-limit request must buy no provider work");
  });
  assertStrictEquals(p.delivered, CROSSING_CHUNK, "the crossing chunk is the last one delivered");
  assertStrictEquals(p.pulls, CROSSING_CHUNK, `only ${CROSSING_CHUNK} pulls, not 401`);
  assertStrictEquals(p.cancels, 1, "the reader must cancel, not drain");
});

Deno.test("generate-children-lesson: a declared oversize request is refused before the first pull", async () => {
  const handler = authorized();
  const p = probe();
  await withFetchSpy(async (fetchSpy) => {
    const res = await handler(
      postStream(countingStream(p, filler(400, 1024)), AUTH_HEADER, { "content-length": "409600" }),
    );
    assertStrictEquals(res.status, FAILURES.REQUEST_TOO_LARGE.status);
    assertEquals(fetchSpy.calls.length, 0);
  });
  assertStrictEquals(p.pulls, 0, "a declared oversize must cost no pulls at all");
  assertStrictEquals(p.cancels, 1, "the abandoned stream is still cancelled");
});

Deno.test("generate-children-lesson: an understated request content-length cannot buy more than the cap", async () => {
  const handler = authorized();
  const p = probe();
  await withFetchSpy(async (fetchSpy) => {
    const res = await handler(
      postStream(countingStream(p, filler(400, 1024)), AUTH_HEADER, { "content-length": "10" }),
    );
    assertStrictEquals(res.status, FAILURES.REQUEST_TOO_LARGE.status);
    assertEquals(fetchSpy.calls.length, 0);
  });
  assertStrictEquals(p.delivered, CROSSING_CHUNK);
  assertStrictEquals(p.cancels, 1);
});

Deno.test("generate-children-lesson: an interrupted or malformed request stream is a fixed 400 that reaches no provider", async () => {
  const cases: Array<{ label: string; next: (i: number) => Uint8Array | null; failAt?: number }> = [
    { label: "peer hangs up mid-body", next: splitUtf8(VALID_BODY, 8), failAt: 2 },
    { label: "invalid UTF-8", next: (i) => i === 0 ? new Uint8Array([0xff, 0xfe, 0xfd]) : null },
    { label: "truncated JSON", next: splitUtf8('{"liturgyId":', 3) },
  ];
  for (const { label, next, failAt } of cases) {
    const handler = authorized();
    await withFetchSpy(async (fetchSpy) => {
      const res = await handler(postStream(countingStream(probe(), next, { failAt })));
      assertStrictEquals(res.status, FAILURES.INVALID_REQUEST.status, label);
      const text = await res.text();
      assertStrictEquals(text.includes(M.transport), false, `${label}: no transport detail may escape`);
      assertStrictEquals(text.includes("stack"), false, label);
      assertEquals(fetchSpy.calls.length, 0, label);
    });
  }
});

Deno.test("generate-children-lesson: an under-limit chunked request is still served", async () => {
  const handler = authorized();
  const p = probe();
  await withFetchSpy(async (fetchSpy) => {
    const res = await handler(postStream(countingStream(p, splitUtf8(VALID_BODY, 17))));
    assertStrictEquals(res.status, 200);
    assertStrictEquals(fetchSpy.providerCalls.length, 1);
  }, anthropicOk);
  assertStrictEquals(p.cancels, 0, "a body inside the cap is consumed, not cancelled");
  assertStrictEquals(p.delivered > 1, true, "the fixture must actually arrive in pieces");
});

Deno.test("generate-children-lesson: an unauthenticated or unauthorized request is not pulled at all", async () => {
  // `spyRequest` counters cannot see a streaming read, so ordering is proved
  // here by the stream itself: zero pulls means the guard ran first.
  const unauthenticated = probe();
  const anon = createHandler(baseDeps(makeAuthzDeps({ getUser: strictGetUser() }).deps));
  const res401 = await anon(postStream(countingStream(unauthenticated, splitUtf8(VALID_BODY, 8)), {}));
  assertStrictEquals(res401.status, 401);
  assertStrictEquals(unauthenticated.pulls, 0, "the body must not be pulled before authentication");

  const unauthorized = probe();
  const denied = createHandler(baseDeps(makeAuthzDeps({
    getUser: strictGetUser(),
    checkPermission: () => Promise.resolve({ kind: "denied" as const }),
  }).deps));
  const res403 = await denied(postStream(countingStream(unauthorized, splitUtf8(VALID_BODY, 8))));
  assertStrictEquals(res403.status, 403);
  assertStrictEquals(unauthorized.pulls, 0, "the body must not be pulled before authorization");
});

// ── Provider response ──────────────────────────────────────────────────────

/** 1 MB cap ÷ 1 KiB chunks: the 977th chunk is the first past 1,000,000. */
const PROVIDER_CROSSING_CHUNK = 977;

Deno.test("generate-children-lesson: the provider cap cuts the download at the crossing chunk", async () => {
  const handler = authorized();
  const p = probe();
  await withFetchSpy(async () => {
    const res = await handler(post(AUTH_HEADER).req);
    assertStrictEquals(res.status, FAILURES.INVALID_PROVIDER_RESPONSE.status);
    assertStrictEquals((await res.json()).code, "INVALID_PROVIDER_RESPONSE");
  }, () => Promise.resolve(new Response(countingStream(p, filler(2000, 1024)))));

  assertStrictEquals(p.delivered, PROVIDER_CROSSING_CHUNK, "977 KiB is the first chunk past 1,000,000 bytes");
  assertStrictEquals(
    p.pulls,
    PROVIDER_CROSSING_CHUNK,
    `977 of 2000 chunks pulled against a ${MAX_PROVIDER_RESPONSE_BYTES}-byte cap, not 2001`,
  );
  assertStrictEquals(p.cancels, 1, "the provider stream must be cancelled immediately after the cap");
});

Deno.test("generate-children-lesson: a provider reply declaring an oversize length is refused before the first pull", async () => {
  const handler = authorized();
  const p = probe();
  await withFetchSpy(async () => {
    const res = await handler(post(AUTH_HEADER).req);
    assertStrictEquals(res.status, FAILURES.INVALID_PROVIDER_RESPONSE.status);
  }, () =>
    Promise.resolve(
      new Response(countingStream(p, filler(2000, 1024)), {
        headers: { "content-length": String(MAX_PROVIDER_RESPONSE_BYTES + 1) },
      }),
    ));

  assertStrictEquals(p.pulls, 0);
  assertStrictEquals(p.cancels, 1);
});

Deno.test("generate-children-lesson: an understated provider content-length cannot bypass the streaming cap", async () => {
  const handler = authorized();
  const p = probe();
  await withFetchSpy(async () => {
    assertStrictEquals(
      (await handler(post(AUTH_HEADER).req)).status,
      FAILURES.INVALID_PROVIDER_RESPONSE.status,
    );
  }, () =>
    Promise.resolve(
      new Response(countingStream(p, filler(2000, 1024)), { headers: { "content-length": "10" } }),
    ));

  assertStrictEquals(p.delivered, PROVIDER_CROSSING_CHUNK);
  assertStrictEquals(p.cancels, 1);
});

Deno.test("generate-children-lesson: a failed provider reply is cancelled unread — the error body is never pulled", async () => {
  const handler = authorized();
  const p = probe();
  const lines = await withCapturedLogs((lines) =>
    withFetchSpy(async () => {
      const res = await handler(post(AUTH_HEADER).req);
      assertStrictEquals(res.status, FAILURES.PROVIDER_ERROR.status);
      return lines;
    }, () => Promise.resolve(new Response(countingStream(p, filler(2000, 1024)), { status: 500 })))
  );

  assertStrictEquals(p.pulls, 0, "the provider's error body must not be read at all");
  assertStrictEquals(p.delivered, 0);
  assertStrictEquals(p.cancels, 1, "it is cancelled instead");
  assertStrictEquals(lines.some((l) => l.includes("500")), true, "only the status survives");
});
