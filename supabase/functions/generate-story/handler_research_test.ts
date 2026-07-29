// PHASE PC — research model wiring + API-observable degradation, through the
// PRODUCTION handler.
//
// What PC changes and therefore what this suite pins:
//
//   1. The Gemini research model is no longer a constant in `handler.ts`. It is
//      read from `GEMINI_RESEARCH_MODEL` by `index.ts` and injected, so the
//      model can move without a code change and the handler cannot quietly
//      disagree with the deployment (PC1).
//   2. Both research calls send `thinkingLevel` and `maxOutputTokens` (PC2).
//   3. Research no longer returns `''` for nine different reasons. It returns a
//      discriminated result, and every failure reaches the client as an additive
//      Spanish `warnings` entry while the story still gets written (PC3-PC5).
//
// BASE-RED @ c496490: the whole file. `researchModel` is not a member of
// `HandlerDeps` there, so it fails to type-check (TS2353 x2); with the injected
// field removed it compiles, and 25 of 29 cases fail on assertions — the model,
// the knobs, and every warning. Both runs are recorded verbatim in the phase
// report.
//
// The 4 cases that pass at base assert the ABSENCE of a warning or the reuse of
// successful text, which the old code satisfies by having no warnings at all.
// Per D7's codified exception they are pinned by recorded mutation instead:
// PC3a, PC4f, PC5e and PC6g each have a named mutation in the phase report.
// The entrypoint wiring (PC1b) is pinned the same way — see the report.

import { assert, assertEquals, assertStrictEquals } from "@std/assert";

import { corsHeaders, createHandler, type HandlerDeps } from "./handler.ts";
import {
  AUTH_HEADER,
  makeAuthzDeps,
  PNG_B64,
  TEST_SUPABASE_URL,
  withCapturedLogs,
  type FetchCall,
  withFetchSpy,
} from "../_shared/testHelpers.ts";

/** Deliberately not a real model id: a hardcoded fallback cannot fake it. */
const RESEARCH_MODEL = "pc-test-research-model";

const GEMINI_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

function deps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    anthropicApiKey: "test-anthropic-key",
    googleAiApiKey: "test-gemini-key",
    researchModel: RESEARCH_MODEL,
    authzDeps: makeAuthzDeps().deps,
    supabaseUrl: TEST_SUPABASE_URL,
    ...overrides,
  };
}

/**
 * A payload that fires BOTH research calls: `location` drives the location
 * research and the landmark's photo drives the image analysis. Anything that
 * only tests one of them proves half the contract.
 */
function storyPayload(extra: Record<string, unknown> = {}) {
  return {
    context: { title: "Adviento", summary: "Esperanza", readings: [] },
    location: "Valparaíso",
    style: "reflexivo",
    characters: [],
    landmarks: [{ name: "Faro", narrativeRole: "guía", referenceImages: [PNG_B64()] }],
    props: [],
    // Stops before Anthropic. PC5 turns this off where the story matters.
    previewPromptOnly: true,
    ...extra,
  };
}

function post(body: unknown): Request {
  return new Request("https://edge.test/generate-story", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH_HEADER },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Provider stubs
// ---------------------------------------------------------------------------

/** One Gemini candidate, exactly as the REST API shapes it. */
function geminiCandidate(
  candidate: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify({ candidates: [candidate] }), { status });
}

/** A successful answer: text plus the `STOP` the API always reports. */
function geminiOk(text = "descripción visual del lugar"): Response {
  return geminiCandidate({ finishReason: "STOP", content: { parts: [{ text }] } });
}

/** The forced-tool path production takes when Claude behaves. */
function anthropicStory(): Response {
  return new Response(
    JSON.stringify({
      content: [{
        type: "tool_use",
        name: "emit_story",
        input: {
          title: "El faro de Ana",
          summary: "Un cuento sobre la esperanza.",
          characters: [{
            name: "Ana",
            role: "protagonist",
            description: "una niña del puerto",
            visualDescription: "chaleco rojo, pelo oscuro",
          }],
          scenes: [{ number: 1, text: "Ana camina.", visualDescription: "muelle iluminado" }],
          spiritualConnection: "Jesús es luz.",
        },
      }],
      usage: { input_tokens: 10, output_tokens: 20 },
    }),
    { status: 200 },
  );
}

interface RunOpts {
  payload?: Record<string, unknown>;
  gemini?: (url: string, init?: RequestInit) => Response | Promise<Response>;
  anthropic?: (url: string, init?: RequestInit) => Response | Promise<Response>;
  deps?: Partial<HandlerDeps>;
}

interface RunResult {
  status: number;
  body: Record<string, unknown>;
  gemini: FetchCall[];
  anthropic: FetchCall[];
  lines: string[];
}

/** Drives one request and reports everything the assertions need. */
async function run(opts: RunOpts = {}): Promise<RunResult> {
  return await withCapturedLogs(async (lines) =>
    await withFetchSpy(async (spy) => {
      const res = await createHandler(deps(opts.deps))(post(opts.payload ?? storyPayload()));
      const body = await res.json() as Record<string, unknown>;
      for (const [k, v] of Object.entries(corsHeaders)) {
        assertEquals(res.headers.get(k), v, `missing CORS header ${k}`);
      }
      return {
        status: res.status,
        body,
        gemini: spy.calls.filter((c) => c.url.includes("generativelanguage")),
        anthropic: spy.calls.filter((c) => c.url.includes("api.anthropic.com")),
        lines,
      };
    }, (url, init) =>
      Promise.resolve(
        url.includes("generativelanguage")
          ? (opts.gemini ?? (() => geminiOk()))(url, init)
          : (opts.anthropic ?? (() => anthropicStory()))(url, init),
      ))
  );
}

interface Warning {
  source: string;
  code: string;
  message: string;
  httpStatus?: number;
  finishReason?: string;
}

function warningsOf(body: Record<string, unknown>): Warning[] {
  return (body.warnings ?? []) as Warning[];
}

/** `source:code` per warning, in order — the whole taxonomy in one string. */
function codesOf(body: Record<string, unknown>): string[] {
  return warningsOf(body).map((w) => `${w.source}:${w.code}`);
}

function promptOf(body: Record<string, unknown>): string {
  return ((body.promptPreview ?? {}) as { userPrompt?: string }).userPrompt ?? "";
}

function bodyOfCall(call: FetchCall): Record<string, unknown> {
  return JSON.parse(String(call.init?.body)) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// [PC1] — the model is injected, and it reaches both calls
// ---------------------------------------------------------------------------

// Two different values through the same code path: a constant left behind in
// handler.ts can satisfy at most one of them.
Deno.test("PC1a the injected research model reaches BOTH Gemini calls", async () => {
  for (const model of [RESEARCH_MODEL, "otro-modelo-de-prueba-9"]) {
    const r = await run({ deps: { researchModel: model } });

    assertStrictEquals(r.status, 200);
    assertStrictEquals(r.gemini.length, 2, "location research + landmark analysis");
    for (const call of r.gemini) {
      assertStrictEquals(call.url, GEMINI_URL(model), "research call used the wrong model");
    }
  }
});

// The entrypoint half of the same claim. `index.ts` calls `serve()` at module
// scope, so it cannot be imported here (std@0.168's `serve` binds a port on
// import); its wiring is therefore asserted at the source level. Two
// independent mechanisms catch a severed wire: this case, and `deno check` —
// `researchModel` is a required dep with no handler-side fallback.
//
// MUTATION PROOFS (D7), recorded verbatim in the phase report:
//   * drop `researchModel` from the `createHandler({...})` call in index.ts
//   * rename the env var read to `GEMINI_MODEL`
//   * change the default to `gemini-2.0-flash`
// each fails this case.
Deno.test("PC1b index.ts owns the env read and hands the model to the handler", async () => {
  const entry = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const handler = await Deno.readTextFile(new URL("./handler.ts", import.meta.url));

  assert(
    /Deno\.env\.get\(\s*['"]GEMINI_RESEARCH_MODEL['"]\s*\)\s*\?\?\s*['"]gemini-3\.5-flash['"]/
      .test(entry),
    "index.ts must read GEMINI_RESEARCH_MODEL with the 'gemini-3.5-flash' default",
  );
  assert(
    /createHandler\(\{[^}]*\bresearchModel\b[^}]*\}\)/s.test(entry),
    "index.ts must pass researchModel into createHandler",
  );

  // D2, the other direction: the handler is not allowed to reach around the
  // injection, and it no longer owns a model constant of its own.
  assert(!handler.includes("Deno.env"), "handler.ts must not read the environment (D2)");
  assertEquals(
    handler.match(/['"]gemini-[\w.-]+['"]/g),
    null,
    "handler.ts must not hardcode a Gemini model id",
  );
});

// ---------------------------------------------------------------------------
// [PC2] — the request knobs, on both calls
// ---------------------------------------------------------------------------

Deno.test("PC2 both research calls pin thinkingLevel LOW and maxOutputTokens 1024", async () => {
  const r = await run();

  assertStrictEquals(r.gemini.length, 2);
  for (const call of r.gemini) {
    const gc = bodyOfCall(call).generationConfig as {
      maxOutputTokens?: unknown;
      thinkingConfig?: { thinkingLevel?: unknown };
    };
    assertStrictEquals(gc?.maxOutputTokens, 1024, "maxOutputTokens");
    assertStrictEquals(gc?.thinkingConfig?.thinkingLevel, "LOW", "thinkingConfig.thinkingLevel");
  }
});

// ---------------------------------------------------------------------------
// [PC3] — candidate shape -> status/code
// ---------------------------------------------------------------------------

Deno.test("PC3a STOP with non-empty text is ok: no warning, and the text is used", async () => {
  const r = await run({ gemini: () => geminiOk("faro blanco sobre roca negra") });

  assertStrictEquals(r.status, 200);
  assertEquals(r.body.warnings, undefined, "a successful request carries no warnings key");
  assert(
    promptOf(r.body).includes("faro blanco sobre roca negra"),
    "successful research must reach the Claude prompt",
  );
});

Deno.test("PC3b STOP with empty or whitespace-only text is EMPTY_RESPONSE", async () => {
  for (
    const candidate of [
      { finishReason: "STOP", content: { parts: [{ text: "" }] } },
      { finishReason: "STOP", content: { parts: [{ text: "   \n  " }] } },
      { finishReason: "STOP", content: { parts: [] } },
      { finishReason: "STOP" },
    ]
  ) {
    const r = await run({ gemini: () => geminiCandidate(candidate) });

    assertStrictEquals(r.status, 200);
    assertEquals(
      codesOf(r.body),
      ["location:EMPTY_RESPONSE", "landmark:EMPTY_RESPONSE"],
      `candidate ${JSON.stringify(candidate)}`,
    );
    assertStrictEquals(warningsOf(r.body)[0].finishReason, "STOP");
    assertStrictEquals(warningsOf(r.body)[0].httpStatus, undefined);
  }
});

// The one that matters most: half a visual description reads exactly like a
// whole one, and it would be copied verbatim into every illustration.
Deno.test("PC3c MAX_TOKENS is OUTPUT_TRUNCATED and its partial text is discarded", async () => {
  const r = await run({
    gemini: () =>
      geminiCandidate({
        finishReason: "MAX_TOKENS",
        content: { parts: [{ text: "el faro es de color" }] },
      }),
  });

  assertStrictEquals(r.status, 200);
  assertEquals(codesOf(r.body), ["location:OUTPUT_TRUNCATED", "landmark:OUTPUT_TRUNCATED"]);
  assertStrictEquals(warningsOf(r.body)[0].finishReason, "MAX_TOKENS");
  assert(
    !promptOf(r.body).includes("el faro es de color"),
    "truncated research must not contribute partial text",
  );
});

Deno.test("PC3d any other finish reason is OUTPUT_BLOCKED, and reports which", async () => {
  for (const finishReason of ["SAFETY", "RECITATION", "PROHIBITED_CONTENT", "OTHER"]) {
    const r = await run({
      gemini: () => geminiCandidate({ finishReason, content: { parts: [{ text: "algo" }] } }),
    });

    assertEquals(codesOf(r.body), ["location:OUTPUT_BLOCKED", "landmark:OUTPUT_BLOCKED"]);
    assertStrictEquals(warningsOf(r.body)[0].finishReason, finishReason);
    assert(!promptOf(r.body).includes("algo"), "blocked research must contribute nothing");
  }
});

// A missing finish reason is not a shape the API documents — it was filed as a
// provider bug — so it is treated as "not STOP" and reported without inventing
// a reason to name.
Deno.test("PC3e a missing finishReason is OUTPUT_BLOCKED with no finishReason reported", async () => {
  const r = await run({ gemini: () => geminiCandidate({ content: { parts: [{ text: "x" }] } }) });

  assertEquals(codesOf(r.body), ["location:OUTPUT_BLOCKED", "landmark:OUTPUT_BLOCKED"]);
  assertEquals(
    Object.keys(warningsOf(r.body)[0]).sort(),
    ["code", "message", "source"],
    "no finishReason key when the provider sent none",
  );
});

// ---------------------------------------------------------------------------
// [PC4] — transport and configuration -> status/code
// ---------------------------------------------------------------------------

Deno.test("PC4a HTTP 404 is MODEL_NOT_FOUND, reported with its status and not retried", async () => {
  const r = await run({ gemini: () => new Response("no such model", { status: 404 }) });

  assertStrictEquals(r.status, 200, "a bad model must not fail the story");
  assertEquals(codesOf(r.body), ["location:MODEL_NOT_FOUND", "landmark:MODEL_NOT_FOUND"]);
  assertStrictEquals(warningsOf(r.body)[0].httpStatus, 404);
  assertStrictEquals(warningsOf(r.body)[0].finishReason, undefined);
  assertStrictEquals(r.gemini.length, 2, "404 is not retried: one attempt per call");
});

Deno.test("PC4b another HTTP error is PROVIDER_HTTP_ERROR with its status", async () => {
  const r = await run({ gemini: () => new Response("bad request", { status: 400 }) });

  assertEquals(codesOf(r.body), ["location:PROVIDER_HTTP_ERROR", "landmark:PROVIDER_HTTP_ERROR"]);
  assertStrictEquals(warningsOf(r.body)[0].httpStatus, 400);
});

// A 5xx IS retried, and a 5xx that survives the retry comes back as a response
// rather than a throw — so it reports the status it actually returned.
Deno.test("PC4c a 5xx surviving the retry is PROVIDER_HTTP_ERROR, after two attempts", async () => {
  const r = await run({
    gemini: () =>
      new Response("upstream busy", { status: 503, headers: { "retry-after": "1" } }),
  });

  assertEquals(codesOf(r.body), ["location:PROVIDER_HTTP_ERROR", "landmark:PROVIDER_HTTP_ERROR"]);
  assertStrictEquals(warningsOf(r.body)[0].httpStatus, 503);
  assertStrictEquals(r.gemini.length, 4, "two calls x (attempt + retry)");
});

Deno.test("PC4d a transport failure on both attempts is PROVIDER_UNAVAILABLE", async () => {
  const r = await run({
    gemini: (url) => Promise.reject(new TypeError(`error sending request for url (${url})`)),
  });

  assertStrictEquals(r.status, 200);
  assertEquals(codesOf(r.body), ["location:PROVIDER_UNAVAILABLE", "landmark:PROVIDER_UNAVAILABLE"]);
  assertEquals(
    Object.keys(warningsOf(r.body)[0]).sort(),
    ["code", "message", "source"],
    "nothing answered, so there is no status and no finish reason to report",
  );
  assertStrictEquals(r.gemini.length, 4, "two calls x (attempt + retry)");
});

Deno.test("PC4e a missing provider key is NO_API_KEY, with zero provider calls", async () => {
  const r = await run({ deps: { googleAiApiKey: "" } });

  assertStrictEquals(r.status, 200);
  assertEquals(codesOf(r.body), ["location:NO_API_KEY", "landmark:NO_API_KEY"]);
  assertStrictEquals(r.gemini.length, 0, "no key means no spend");
});

// The ONLY skipped case, and it is not a degradation: the user supplied no
// photos, so there was never an analysis to warn about.
Deno.test("PC4f an entity with no photos is skipped and raises no warning", async () => {
  const r = await run({
    payload: storyPayload({
      landmarks: [{ name: "Faro", narrativeRole: "guía" }],
      props: [{ id: "p1", name: "Farol", narrativeRole: "luz", referenceImages: [] }],
    }),
  });

  assertStrictEquals(r.status, 200);
  assertEquals(r.body.warnings, undefined, "no photos is not a failure");
  assertStrictEquals(r.gemini.length, 1, "only the location research runs");
});

// Precedence, pinned: no photos wins over no key, so a photoless entity does
// not manufacture a second report of the one configuration problem.
Deno.test("PC4g with no key and no photos, only the location research warns", async () => {
  const r = await run({
    deps: { googleAiApiKey: "" },
    payload: storyPayload({ landmarks: [{ name: "Faro", narrativeRole: "guía" }] }),
  });

  assertEquals(codesOf(r.body), ["location:NO_API_KEY"]);
});

// The warning's `source` is the call site, not the entity's `kind`: a prop
// whose kind is "location" is still a prop analysis.
Deno.test("PC4h a prop reports source 'prop' even when its kind is 'location'", async () => {
  const r = await run({
    payload: storyPayload({
      landmarks: [],
      props: [{
        id: "p1",
        kind: "location",
        name: "La caleta",
        narrativeRole: "hogar",
        referenceImages: [PNG_B64()],
      }],
    }),
    gemini: () => new Response("no such model", { status: 404 }),
  });

  assertEquals(codesOf(r.body), ["location:MODEL_NOT_FOUND", "prop:MODEL_NOT_FOUND"]);
});

// ---------------------------------------------------------------------------
// [PC5] — the story still gets written, and every envelope reports why not
// ---------------------------------------------------------------------------

Deno.test("PC5a partial research failure still calls Anthropic and returns the story", async () => {
  let geminiCalls = 0;
  const r = await run({
    payload: storyPayload({ previewPromptOnly: false }),
    // First call is the location research; the landmark analysis fails.
    gemini: () => ++geminiCalls === 1 ? geminiOk("costa de niebla") : new Response("x", { status: 404 }),
  });

  assertStrictEquals(r.status, 200);
  assertStrictEquals(r.body.success, true);
  assertStrictEquals(r.body.title, "El faro de Ana");
  assertStrictEquals(r.anthropic.length, 1, "Anthropic must still be called");
  assertEquals(codesOf(r.body), ["landmark:MODEL_NOT_FOUND"]);
});

Deno.test("PC5b total research failure still returns a story, with every warning", async () => {
  const r = await run({
    payload: storyPayload({
      previewPromptOnly: false,
      props: [{ id: "p1", name: "Farol", narrativeRole: "luz", referenceImages: [PNG_B64()] }],
    }),
    gemini: () => new Response("x", { status: 404 }),
  });

  assertStrictEquals(r.status, 200);
  assertStrictEquals(r.body.success, true);
  assertStrictEquals(r.anthropic.length, 1);
  assertEquals(codesOf(r.body), [
    "location:MODEL_NOT_FOUND",
    "landmark:MODEL_NOT_FOUND",
    "prop:MODEL_NOT_FOUND",
  ]);
});

Deno.test("PC5c the prompt-preview envelope carries the warnings", async () => {
  const r = await run({ gemini: () => new Response("x", { status: 404 }) });

  assertStrictEquals(r.status, 200);
  assertStrictEquals(r.body.success, true);
  assert(promptOf(r.body).length > 0, "the preview must still be returned");
  assertEquals(codesOf(r.body), ["location:MODEL_NOT_FOUND", "landmark:MODEL_NOT_FOUND"]);
});

// The PF [B4] rule, one stage later: a failure AFTER research must not erase
// the fact that the story was written blind.
Deno.test("PC5d a post-research provider failure keeps the warnings on the 500", async () => {
  const r = await run({
    payload: storyPayload({ previewPromptOnly: false }),
    gemini: () => new Response("x", { status: 404 }),
    anthropic: () => new Response("provider rejected", { status: 400 }),
  });

  assertStrictEquals(r.status, 500);
  assertStrictEquals(r.body.success, false);
  // Unchanged: the existing field keeps its value and its meaning.
  assertStrictEquals(r.body.error, "Error de Claude API: 400");
  assertEquals(codesOf(r.body), ["location:MODEL_NOT_FOUND", "landmark:MODEL_NOT_FOUND"]);
});

// The additive half. Adding the key unconditionally would have been a contract
// change for every response this function has ever sent.
Deno.test("PC5e with all research ok, no envelope grows a warnings key", async () => {
  const success = await run({ payload: storyPayload({ previewPromptOnly: false }) });
  assertStrictEquals(success.status, 200);
  assert(!("warnings" in success.body), "success envelope must be unchanged");

  const preview = await run();
  assert(!("warnings" in preview.body), "preview envelope must be unchanged");

  const failure = await run({
    payload: storyPayload({ previewPromptOnly: false }),
    anthropic: () => new Response("provider rejected", { status: 400 }),
  });
  assertStrictEquals(failure.status, 500);
  assertEquals(Object.keys(failure.body).sort(), ["error", "success"]);
});

// `skippedImages` is PF's contract and PC rides on top of it, not over it.
Deno.test("PC5f skippedImages and warnings coexist on the same envelope", async () => {
  const r = await run({
    payload: storyPayload({
      // A second reference that pass 2 drops: an unsupported iPhone format.
      props: [{
        id: "p1",
        name: "Farol",
        narrativeRole: "luz",
        referenceImages: ["data:image/heic;base64," + PNG_B64()],
      }],
    }),
    gemini: () => new Response("x", { status: 404 }),
  });

  assertStrictEquals(r.status, 200);
  assert(Array.isArray(r.body.skippedImages), "PF's field must survive");
  assert(warningsOf(r.body).length > 0, "PC's field must be present too");
});

// ---------------------------------------------------------------------------
// [PC6] — the new channels carry no secrets
//
// Same planted-token pattern as T-F.13*: a signed URL is placed in every input
// the new code reads, and neither the log nor the response may echo it.
// ---------------------------------------------------------------------------

const PLANTED_URL = "https://secret.example/photo.png?token=SIGNEDTOKEN123";

function assertNoPlantedSecret(text: string, where: string) {
  assert(!text.includes("SIGNEDTOKEN123"), `${where} leaked the signed token`);
  assert(!text.includes(PLANTED_URL), `${where} leaked the planted URL`);
  assert(!text.includes("secret.example"), `${where} leaked the planted host`);
  assert(!text.includes("?token="), `${where} leaked a query string`);
}

function assertClean(r: RunResult) {
  assert(r.lines.length > 0, "the handler must actually have logged something");
  assertNoPlantedSecret(r.lines.join("\n"), "log");
  assertNoPlantedSecret(JSON.stringify(r.body), "response");
}

// `finishReason` is provider-controlled text that PC both logs and returns.
Deno.test("PC6a a URL planted in finishReason reaches neither the log nor the response", async () => {
  const r = await run({
    gemini: () =>
      geminiCandidate({ finishReason: PLANTED_URL, content: { parts: [{ text: "x" }] } }),
  });

  assertEquals(codesOf(r.body), ["location:OUTPUT_BLOCKED", "landmark:OUTPUT_BLOCKED"]);
  assertStrictEquals(
    warningsOf(r.body)[0].finishReason,
    "DESCONOCIDO",
    "an unparseable finish reason is reported by shape, not by value",
  );
  assertClean(r);
});

// A lowercase enum-looking reason is still not the enum, and must not pass
// through as-is: this is the `safeMode()` lesson from PF [B3-R].
Deno.test("PC6b a finishReason outside the enum shape is reported as DESCONOCIDO", async () => {
  const r = await run({
    gemini: () => geminiCandidate({ finishReason: "stop", content: { parts: [{ text: "x" }] } }),
  });

  assertStrictEquals(warningsOf(r.body)[0].finishReason, "DESCONOCIDO");
});

Deno.test("PC6c a provider error body is never quoted into the log or the warning", async () => {
  const r = await run({
    gemini: () => new Response(`rejected: ${PLANTED_URL}`, { status: 400 }),
  });

  assertEquals(codesOf(r.body), ["location:PROVIDER_HTTP_ERROR", "landmark:PROVIDER_HTTP_ERROR"]);
  assertClean(r);
});

Deno.test("PC6d a transport error message is not quoted into the log or the warning", async () => {
  const r = await run({
    gemini: () =>
      Promise.reject(new TypeError(`error sending request for url (${PLANTED_URL}): dns error`)),
  });

  assertEquals(codesOf(r.body), ["location:PROVIDER_UNAVAILABLE", "landmark:PROVIDER_UNAVAILABLE"]);
  assertClean(r);
});

// Discarded provider text is still text this handler held: the truncation path
// must not log or return the fragment it refused to use.
Deno.test("PC6e truncated provider text is not logged or returned", async () => {
  const r = await run({
    gemini: () =>
      geminiCandidate({
        finishReason: "MAX_TOKENS",
        content: { parts: [{ text: `visual: ${PLANTED_URL}` }] },
      }),
  });

  assertEquals(codesOf(r.body), ["location:OUTPUT_TRUNCATED", "landmark:OUTPUT_TRUNCATED"]);
  assertClean(r);
});

// The warning message is built from the code and the call site alone. If it
// ever interpolated the entity it describes, this is where it would show.
//
// Scoped to the LOG and the WARNINGS, not the whole body: `previewPromptOnly`
// returns the assembled prompt, which contains the caller's own location and
// entity names by design — pre-existing behaviour that PF's T-F.13c already
// drew the same boundary around (it too asserts only on the log).
Deno.test("PC6f warning messages never interpolate request text", async () => {
  const r = await run({
    payload: storyPayload({
      location: PLANTED_URL,
      landmarks: [{
        name: PLANTED_URL,
        narrativeRole: PLANTED_URL,
        referenceImages: [PNG_B64()],
      }],
    }),
    gemini: () => new Response("x", { status: 404 }),
  });

  assertEquals(codesOf(r.body), ["location:MODEL_NOT_FOUND", "landmark:MODEL_NOT_FOUND"]);
  assert(r.lines.length > 0, "the handler must actually have logged something");
  assertNoPlantedSecret(r.lines.join("\n"), "log");
  assertNoPlantedSecret(JSON.stringify(warningsOf(r.body)), "warnings");

  // States the boundary rather than leaving it implicit: the echo is the
  // preview feature, and it is confined to the preview field.
  assert(
    promptOf(r.body).includes(PLANTED_URL),
    "the preview returns the caller's own prompt — if this stops being true, " +
      "the assertion above has become vacuous and must be re-scoped",
  );
});

// D8: the copy that reaches the user is Spanish, and it says what happened.
Deno.test("PC6g warning messages are Spanish and mention the degradation", async () => {
  const r = await run({ gemini: () => new Response("x", { status: 404 }) });

  // Without this the loop below asserts nothing when there are no warnings.
  assertStrictEquals(warningsOf(r.body).length, 2, "both research calls must have warned");
  for (const w of warningsOf(r.body)) {
    assertStrictEquals(typeof w.message, "string");
    assert(
      w.message.includes("El cuento se generó sin esa información."),
      `message must state the consequence, got: ${w.message}`,
    );
    assert(
      w.message.startsWith("El modelo de investigación visual no está disponible en "),
      `message must state the cause, got: ${w.message}`,
    );
  }
});
