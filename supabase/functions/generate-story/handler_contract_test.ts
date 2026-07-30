// PHASE PD — strict output contract for `generate-story`, through the
// PRODUCTION handler.
//
// What PD changes and therefore what this suite pins:
//
//   1. The `emit_story` tool is declared strict: `strict:true` top-level,
//      `additionalProperties:false` on every object, `props` required, integer
//      scene/reference numbers ([PD1]).
//   2. `stop_reason` is inspected BEFORE content. `tool_use` plus exactly one
//      matching block is the only success protocol; the text/JSON.parse
//      fallback is gone ([PD2]).
//   3. Provider output that is structurally valid but semantically wrong is
//      rejected by `validateAndNormalizeStory` ([PD3]-[PD5]).
//   4. Every provider-output failure is a typed 502 `PROVIDER_OUTPUT_INVALID`
//      with one of three fixed Spanish messages, mapped INSIDE the handler;
//      client input is 400/422 `CLIENT_INPUT_INVALID`; the generic 500 keeps
//      only genuinely unexpected failures ([PD6]).
//   5. Story-normalization warnings append after PC's research warnings ([PD7]).
//
// Black-box by construction: every case drives `createHandler(...)` with a
// stubbed `fetch` and asserts on the outgoing Anthropic request or the returned
// envelope. Nothing imports a validator directly, so no case can pass against a
// helper the production path does not call — the failure mode that made four
// earlier CASA rounds' "component tests" worthless.
//
// BASE-RED @ 96cb2cc: recorded verbatim in the phase report, per criterion. The
// cases that pass at base (they assert behaviour 96cb2cc already had — the
// forced `tool_choice`, `props:[]` acceptance, the absence of a story warning)
// are pinned by recorded MUTATION instead, per D7's codified exception. Each
// such case names its mutation in a comment above it.

import { assert, assertEquals, assertStrictEquals } from "@std/assert";

import { corsHeaders, createHandler, type HandlerDeps } from "./handler.ts";
import {
  AUTH_HEADER,
  type FetchCall,
  HEIC_B64,
  makeAuthzDeps,
  PNG_B64,
  TEST_SUPABASE_URL,
  withCapturedLogs,
  withFetchSpy,
} from "../_shared/testHelpers.ts";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function deps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    anthropicApiKey: "test-anthropic-key",
    googleAiApiKey: "test-gemini-key",
    researchModel: "pd-test-research-model",
    authzDeps: makeAuthzDeps().deps,
    supabaseUrl: TEST_SUPABASE_URL,
    ...overrides,
  };
}

/**
 * The story path, not the preview path: PD is about what happens to Anthropic's
 * answer, so every case must actually reach Anthropic.
 */
function storyPayload(extra: Record<string, unknown> = {}) {
  return {
    context: { title: "Adviento", summary: "Esperanza", readings: [] },
    location: "Valparaíso",
    style: "reflexivo",
    characters: [],
    landmarks: [],
    props: [],
    previewPromptOnly: false,
    ...extra,
  };
}

function post(body: unknown, init: RequestInit = {}): Request {
  return new Request("https://edge.test/generate-story", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH_HEADER },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
}

/** A successful Gemini research answer (PC consumes text only on `STOP`). */
function geminiOk(text = "descripción visual del lugar"): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ finishReason: "STOP", content: { parts: [{ text }] } }],
    }),
    { status: 200 },
  );
}

// ---------------------------------------------------------------------------
// Anthropic fixtures
//
// SOURCE for the response envelope: Anthropic's tool-use documentation
// (`/docs/en/agents-and-tools/tool-use/how-tool-use-works` and
// `/docs/en/agents-and-tools/tool-use/strict-tool-use`, both read 2026-07-29).
// A normal client tool completion carries `stop_reason:"tool_use"` and a
// `tool_use` content block with `id`, `name` and the schema-valid `input`.
// Every shape below is copied from those pages rather than invented (D7).
// ---------------------------------------------------------------------------

function scene(n: number, extra: Record<string, unknown> = {}) {
  return {
    number: n,
    text: `Ana camina por el muelle, escena ${n}.`,
    visualDescription: `Muelle iluminado al atardecer, plano ${n}`,
    ...extra,
  };
}

function scenes(count: number): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, i) => scene(i + 1));
}

/** The protagonist every fixture needs. One, canonical, non-empty. */
function ana(extra: Record<string, unknown> = {}) {
  return {
    name: "Ana",
    role: "protagonist",
    description: "una niña del puerto",
    visualDescription: "chaleco rojo, pelo oscuro, 8 años",
    ...extra,
  };
}

/** A story that satisfies every PD rule. Overrides break one rule at a time. */
function validStory(overrides: Record<string, unknown> = {}) {
  return {
    title: "El faro de Ana",
    summary: "Un cuento sobre la esperanza.",
    characters: [ana()],
    scenes: scenes(15),
    spiritualConnection: "Jesús es la luz que guía.",
    props: [],
    ...overrides,
  };
}

/** A schema-valid prop. `sceneNumbers` defaults to two in-range scenes. */
function farol(overrides: Record<string, unknown> = {}) {
  return {
    name: "el farol de bronce",
    kind: "prop",
    narrativeRole: "la luz que Ana lleva",
    visualDescription: "farol de bronce con vidrio ámbar",
    sceneNumbers: [2, 5],
    ...overrides,
  };
}

/** The success protocol: `tool_use` + exactly one matching block. */
function toolUse(
  input: unknown,
  extra: Record<string, unknown> = {},
): Response {
  return new Response(
    JSON.stringify({
      id: "msg_01PD",
      type: "message",
      role: "assistant",
      model: "claude-opus-4-5-20251101",
      stop_reason: "tool_use",
      content: [{
        type: "tool_use",
        id: "toolu_01PD",
        name: "emit_story",
        input,
      }],
      usage: { input_tokens: 10, output_tokens: 20 },
      ...extra,
    }),
    { status: 200 },
  );
}

/** An arbitrary Anthropic 200 body — for the protocol-violation cases. */
function anthropicRaw(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

interface RunOpts {
  payload?: Record<string, unknown> | string;
  gemini?: (url: string, init?: RequestInit) => Response | Promise<Response>;
  anthropic?: (url: string, init?: RequestInit) => Response | Promise<Response>;
  deps?: Partial<HandlerDeps>;
}

interface RunResult {
  status: number;
  body: Record<string, unknown>;
  anthropic: FetchCall[];
  lines: string[];
}

async function run(opts: RunOpts = {}): Promise<RunResult> {
  return await withCapturedLogs(async (lines) =>
    await withFetchSpy(async (spy) => {
      const res = await createHandler(deps(opts.deps))(
        post(opts.payload ?? storyPayload()),
      );
      const body = await res.json() as Record<string, unknown>;
      for (const [k, v] of Object.entries(corsHeaders)) {
        assertEquals(res.headers.get(k), v, `missing CORS header ${k}`);
      }
      assertEquals(res.headers.get("Content-Type"), "application/json");
      return {
        status: res.status,
        body,
        anthropic: spy.calls.filter((c) => c.url.includes("api.anthropic.com")),
        lines,
      };
    }, (url, init) =>
      Promise.resolve(
        url.includes("generativelanguage")
          ? (opts.gemini ?? (() => geminiOk()))(url, init)
          : (opts.anthropic ?? (() => toolUse(validStory())))(url, init),
      ))
  );
}

/** Drives one story and returns the envelope. */
async function runStory(story: unknown): Promise<RunResult> {
  return await run({ anthropic: () => toolUse(story) });
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

/** The three fixed Spanish messages (G3). Copied, not paraphrased. */
const REFUSAL_MSG =
  "El proveedor rechazó generar el cuento. Ajusta las notas y vuelve a intentarlo.";
const MAX_TOKENS_MSG =
  "El proveedor cortó el cuento antes de completarlo. Usa notas más breves y vuelve a intentarlo.";
const INVALID_STORY_MSG =
  "El proveedor devolvió un cuento con una estructura inválida. Vuelve a intentarlo.";

const PROP_NOT_RECURRING_MSG =
  "Se omitió un elemento recurrente porque aparece en menos de dos escenas válidas.";

/** Asserts the exact provider-output envelope for one fixed message. */
function assertProviderInvalid(
  r: RunResult,
  message: string,
  where: string,
): void {
  assertStrictEquals(r.status, 502, `${where}: status`);
  assertStrictEquals(r.body.success, false, `${where}: success`);
  assertStrictEquals(r.body.code, "PROVIDER_OUTPUT_INVALID", `${where}: code`);
  assertStrictEquals(r.body.error, message, `${where}: error copy`);
}

/** The default case: a story rejected by validation. */
function assertInvalidStory(r: RunResult, where: string): void {
  assertProviderInvalid(r, INVALID_STORY_MSG, where);
}

function requestBody(call: FetchCall): Record<string, unknown> {
  return JSON.parse(String(call.init?.body)) as Record<string, unknown>;
}

function storyTool(r: RunResult): Record<string, unknown> {
  const tools = requestBody(r.anthropic[0]).tools;
  assert(Array.isArray(tools), "the request must carry a tools array");
  assertStrictEquals(tools.length, 1, "exactly one tool");
  return tools[0] as Record<string, unknown>;
}

/**
 * Walks a dotted path through the request schema, asserting each hop exists.
 *
 * Typed rather than an `any` chain so a wrong path fails with the path in the
 * message instead of a bare `undefined` — and so this suite adds no new lint
 * identity (D6).
 */
function at(root: unknown, path: string): unknown {
  let cursor: unknown = root;
  const walked: string[] = [];
  for (const key of path.split(".")) {
    assert(
      cursor !== null && typeof cursor === "object",
      `schema path ${path} stops being an object at ${
        walked.join(".") || "<root>"
      }`,
    );
    cursor = (cursor as Record<string, unknown>)[key];
    walked.push(key);
  }
  return cursor;
}

interface Warning {
  source: string;
  code: string;
  message: string;
}

function warningsOf(body: Record<string, unknown>): Warning[] {
  return (body.warnings ?? []) as Warning[];
}

function codesOf(body: Record<string, unknown>): string[] {
  return warningsOf(body).map((w) => `${w.source}:${w.code}`);
}

type JsonObject = Record<string, unknown>;

function scenesOf(body: Record<string, unknown>): JsonObject[] {
  return (body.scenes ?? []) as JsonObject[];
}

function charactersOf(body: Record<string, unknown>): JsonObject[] {
  return (body.characters ?? []) as JsonObject[];
}

// ===========================================================================
// [PD1] — strict request and schema pin
// ===========================================================================

Deno.test("PD1a the emit_story tool declares strict:true at the top level", async () => {
  const r = await run();
  const tool = storyTool(r);

  assertStrictEquals(tool.name, "emit_story");
  // SOURCE: strict-tool-use docs — "Set `strict: true` as a top-level property
  // in your tool definition, alongside `name`, `description`, and
  // `input_schema`." Not inside input_schema, not on tool_choice.
  assertStrictEquals(tool.strict, true, "strict must be top-level on the tool");
  assertStrictEquals(
    at(tool, "input_schema.strict"),
    undefined,
    "strict must NOT be inside input_schema",
  );
});

// MUTATION PROOF (D7), recorded in the report: 96cb2cc already forces the tool,
// so this case cannot be base-red. Dropping `tool_choice` from the request body
// fails it.
Deno.test("PD1b the request forces the emit_story tool", async () => {
  const r = await run();
  assertEquals(requestBody(r.anthropic[0]).tool_choice, {
    type: "tool",
    name: "emit_story",
  });
});

Deno.test("PD1c props is a required root property", async () => {
  const required = at(storyTool(await run()), "input_schema.required");
  assert(Array.isArray(required), "the root schema must declare `required`");
  assert(
    required.includes("props"),
    `props must be required, got ${JSON.stringify(required)}`,
  );
});

Deno.test("PD1d scene and reference numbers are integer schemas", async () => {
  const tool = storyTool(await run());

  for (
    const path of [
      "input_schema.properties.scenes.items.properties.number.type",
      "input_schema.properties.characters.items.properties.appearsInScenes.items.type",
      "input_schema.properties.props.items.properties.sceneNumbers.items.type",
    ]
  ) {
    assertStrictEquals(at(tool, path), "integer", path);
  }
});

Deno.test("PD1e additionalProperties:false at root and every nested object", async () => {
  const tool = storyTool(await run());

  for (
    const path of [
      "input_schema.additionalProperties",
      "input_schema.properties.characters.items.additionalProperties",
      "input_schema.properties.scenes.items.additionalProperties",
      "input_schema.properties.props.items.additionalProperties",
    ]
  ) {
    assertStrictEquals(at(tool, path), false, `${path} must be pinned false`);
  }
});

// MUTATION PROOF (D7): base accepts `props:[]` too (it never looks at props), so
// this is coverage. Making `props` reject an empty array — e.g. treating
// `props.length === 0` as fatal in the normalizer — fails it.
Deno.test("PD1f an empty props array is representable and valid", async () => {
  const r = await runStory(validStory({ props: [] }));
  assertStrictEquals(r.status, 200);
  assertStrictEquals(r.body.success, true);
});

Deno.test("PD1g the prompt's exact-structure example includes props", async () => {
  // The preview envelope is the only production surface that returns the
  // system prompt, so the assertion reads the real string rather than a copy.
  const r = await run({ payload: storyPayload({ previewPromptOnly: true }) });
  const preview = r.body.promptPreview as { systemPrompt: string };
  const example = preview.systemPrompt.match(/\{"title":"string".*?\}\s*$/ms) ??
    preview.systemPrompt.match(/\{"title":"string"[^\n]*/);

  assert(example, "the prompt must still carry an exact-structure example");
  assert(
    example[0].includes('"props"'),
    `the structure example omits props: ${example[0].slice(0, 400)}`,
  );
});

// ===========================================================================
// [PD2] — stop-reason protocol, and no text fallback
// ===========================================================================

Deno.test("PD2a stop_reason refusal is a typed 502 with the refusal copy", async () => {
  const r = await run({
    anthropic: () =>
      anthropicRaw({
        stop_reason: "refusal",
        stop_details: { type: "refusal", category: "cyber" },
        content: [],
      }),
  });
  assertProviderInvalid(r, REFUSAL_MSG, "refusal");
});

Deno.test("PD2b stop_reason max_tokens is a typed 502 with the truncation copy", async () => {
  const r = await run({
    anthropic: () =>
      anthropicRaw({
        stop_reason: "max_tokens",
        // A truncated strict response can still carry a partial tool_use block.
        content: [{
          type: "tool_use",
          id: "toolu_01",
          name: "emit_story",
          input: {},
        }],
      }),
  });
  assertProviderInvalid(r, MAX_TOKENS_MSG, "max_tokens");
});

Deno.test("PD2c the refusal and truncation copy the handler returns are distinct", async () => {
  // Asserted on OBSERVED output, not on the two constants: comparing the
  // fixtures to each other is an assertion that cannot fail (D7). Collapsing
  // the two branches onto one message fails this.
  const refusal = await run({
    anthropic: () => anthropicRaw({ stop_reason: "refusal", content: [] }),
  });
  const truncated = await run({
    anthropic: () => anthropicRaw({ stop_reason: "max_tokens", content: [] }),
  });

  assertStrictEquals(refusal.status, 502);
  assertStrictEquals(truncated.status, 502);
  assert(
    refusal.body.error !== truncated.body.error,
    `refusal and truncation must not share copy (both ${refusal.body.error})`,
  );
});

Deno.test("PD2d stop_reason is checked BEFORE content", async () => {
  // A refusal carrying a perfectly valid story must still be a refusal: reading
  // content first would serve it as a success.
  const r = await run({
    anthropic: () =>
      anthropicRaw({
        stop_reason: "refusal",
        content: [{
          type: "tool_use",
          id: "toolu_01",
          name: "emit_story",
          input: validStory(),
        }],
      }),
  });
  assertProviderInvalid(r, REFUSAL_MSG, "refusal with a valid story");
});

Deno.test("PD2e end_turn with a valid story is invalid-story 502", async () => {
  const r = await run({
    anthropic: () =>
      anthropicRaw({
        stop_reason: "end_turn",
        content: [{
          type: "tool_use",
          id: "toolu_01",
          name: "emit_story",
          input: validStory(),
        }],
      }),
  });
  assertInvalidStory(r, "end_turn");
});

Deno.test("PD2f a missing stop_reason is invalid-story 502", async () => {
  const r = await run({
    anthropic: () =>
      anthropicRaw({
        content: [{
          type: "tool_use",
          id: "toolu_01",
          name: "emit_story",
          input: validStory(),
        }],
      }),
  });
  assertInvalidStory(r, "absent stop_reason");
});

Deno.test("PD2g no story tool block is invalid-story 502", async () => {
  const r = await run({
    anthropic: () => anthropicRaw({ stop_reason: "tool_use", content: [] }),
  });
  assertInvalidStory(r, "no tool block");
});

Deno.test("PD2h a wrong tool name is invalid-story 502", async () => {
  const r = await run({
    anthropic: () =>
      anthropicRaw({
        stop_reason: "tool_use",
        content: [{
          type: "tool_use",
          id: "toolu_01",
          name: "emit_cuento",
          input: validStory(),
        }],
      }),
  });
  assertInvalidStory(r, "wrong tool name");
});

Deno.test("PD2i two emit_story blocks are invalid-story 502", async () => {
  const block = {
    type: "tool_use",
    id: "toolu_01",
    name: "emit_story",
    input: validStory(),
  };
  const r = await run({
    anthropic: () =>
      anthropicRaw({
        stop_reason: "tool_use",
        content: [block, { ...block, id: "toolu_02" }],
      }),
  });
  assertInvalidStory(r, "two story tool blocks");
});

Deno.test("PD2j the text/JSON fallback is gone — fenced JSON prose is 502", async () => {
  // The exact shape the removed fallback handled: a text block whose body is a
  // fenced JSON story. At base this was parsed and served as a 200.
  const r = await run({
    anthropic: () =>
      anthropicRaw({
        stop_reason: "end_turn",
        content: [{
          type: "text",
          text: "```json\n" + JSON.stringify(validStory()) + "\n```",
        }],
      }),
  });
  assertInvalidStory(r, "fenced JSON in a text block");
});

Deno.test("PD2k bare JSON in a text block is 502", async () => {
  const r = await run({
    anthropic: () =>
      anthropicRaw({
        stop_reason: "end_turn",
        content: [{ type: "text", text: JSON.stringify(validStory()) }],
      }),
  });
  assertInvalidStory(r, "bare JSON in a text block");
});

Deno.test("PD2l unparseable prose is 502", async () => {
  const r = await run({
    anthropic: () =>
      anthropicRaw({
        stop_reason: "end_turn",
        content: [{
          type: "text",
          text: "Lo siento, no puedo ayudar con eso.",
        }],
      }),
  });
  assertInvalidStory(r, "prose");
});

// ===========================================================================
// [PD3] — required semantic story fields
// ===========================================================================

Deno.test("PD3a props omitted is 502", async () => {
  const story = validStory();
  delete (story as Record<string, unknown>).props;
  assertInvalidStory(await runStory(story), "props omitted");
});

Deno.test("PD3b title/summary/spiritualConnection must be non-empty after trim", async () => {
  for (const field of ["title", "summary", "spiritualConnection"]) {
    for (const bad of ["", "   ", "\t\n", 42, null, undefined, {}]) {
      const r = await runStory(validStory({ [field]: bad }));
      assertInvalidStory(r, `${field}=${JSON.stringify(bad)}`);
    }
  }
});

Deno.test("PD3c character name/description/visualDescription must be non-empty after trim", async () => {
  for (const field of ["name", "description", "visualDescription"]) {
    for (const bad of ["", "  ", 7, null]) {
      const r = await runStory(
        validStory({ characters: [ana({ [field]: bad })] }),
      );
      assertInvalidStory(r, `characters[0].${field}=${JSON.stringify(bad)}`);
    }
  }
});

Deno.test("PD3d an empty or non-array characters list is 502", async () => {
  for (const bad of [[], "Ana", null, undefined, {}]) {
    assertInvalidStory(
      await runStory(validStory({ characters: bad })),
      `characters=${JSON.stringify(bad)}`,
    );
  }
});

Deno.test("PD3e exactly one protagonist is required", async () => {
  const secondary = ana({ name: "Beto", role: "secondary" });

  // Zero protagonists.
  assertInvalidStory(
    await runStory(validStory({ characters: [secondary] })),
    "zero protagonists",
  );
  // Two protagonists.
  assertInvalidStory(
    await runStory(
      validStory({ characters: [ana(), ana({ name: "Beto" })] }),
    ),
    "two protagonists",
  );
  // Exactly one, with company, is fine.
  const ok = await runStory(validStory({ characters: [ana(), secondary] }));
  assertStrictEquals(
    ok.status,
    200,
    "one protagonist plus a secondary is valid",
  );
});

Deno.test("PD3f character names are unique under the normalized key", async () => {
  for (
    const [label, names] of [
      ["trim + case", [" Ana ", "ana"]],
      ["internal whitespace", ["Ana  María", "Ana María"]],
      ["case only", ["ANA", "Ana"]],
    ] as Array<[string, string[]]>
  ) {
    const r = await runStory(
      validStory({
        characters: [
          ana({ name: names[0] }),
          ana({ name: names[1], role: "secondary" }),
        ],
      }),
    );
    assertInvalidStory(r, `colliding names (${label})`);
  }
});

Deno.test("PD3g NFKC-equivalent names collide", async () => {
  // Precomposed U+00F1 vs "n" + combining tilde U+0303. Written as escapes so
  // an editor cannot silently normalise the fixture away: different bytes, the
  // same name to a reader, and NFKC folds them together.
  // Annotated as `string`, not left to inference: two non-overlapping string
  // LITERAL types make `!==` a TS2367 compile error rather than a runtime check.
  const precomposed: string = "A\u00F1o";
  const decomposed: string = "An\u0303o";
  assert(precomposed !== decomposed, "the fixture must be byte-different");
  assertStrictEquals(
    precomposed.normalize("NFKC"),
    decomposed.normalize("NFKC"),
    "the fixture must be NFKC-equal",
  );

  const r = await runStory(
    validStory({
      characters: [
        ana({ name: precomposed }),
        ana({ name: decomposed, role: "secondary" }),
      ],
    }),
  );
  assertInvalidStory(r, "NFKC-equivalent names");
});

Deno.test("PD3h display names are trimmed", async () => {
  const r = await runStory(
    validStory({ characters: [ana({ name: "  Ana  " })] }),
  );
  assertStrictEquals(r.status, 200);
  assertStrictEquals(charactersOf(r.body)[0].name, "Ana");
});

Deno.test("PD3i role casing is canonicalized; other values fail", async () => {
  for (const raw of ["Protagonist", "PROTAGONIST", "protagonist"]) {
    const r = await runStory(validStory({ characters: [ana({ role: raw })] }));
    assertStrictEquals(r.status, 200, `role ${raw} must be accepted`);
    assertStrictEquals(
      charactersOf(r.body)[0].role,
      "protagonist",
      `role ${raw} must canonicalize`,
    );
  }
  for (const raw of ["protagonista", "main", "", " protagonist", 1, null]) {
    assertInvalidStory(
      await runStory(validStory({ characters: [ana({ role: raw })] })),
      `role=${JSON.stringify(raw)}`,
    );
  }
});

// ===========================================================================
// [PD4] — scene window and numbering
// ===========================================================================

Deno.test("PD4a the scene window is 12..16 inclusive", async () => {
  for (const n of [12, 13, 14, 15, 16]) {
    const r = await runStory(validStory({ scenes: scenes(n) }));
    assertStrictEquals(r.status, 200, `${n} scenes must be accepted`);
    assertStrictEquals(scenesOf(r.body).length, n);
  }
  for (const n of [0, 1, 11, 17, 20]) {
    assertInvalidStory(
      await runStory(validStory({ scenes: scenes(n) })),
      `${n} scenes`,
    );
  }
});

Deno.test("PD4b no story is padded or truncated to reach the window", async () => {
  const r = await runStory(validStory({ scenes: scenes(12) }));
  assertStrictEquals(scenesOf(r.body).length, 12, "12 must stay 12");
  assertEquals(
    scenesOf(r.body).map((s) => s.number),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  );
});

Deno.test("PD4c an out-of-order 1..N set is sorted", async () => {
  const shuffled = [15, 3, 1, 9, 2, 14, 4, 12, 5, 13, 6, 11, 7, 10, 8].map((
    n,
  ) => scene(n));
  const r = await runStory(validStory({ scenes: shuffled }));

  assertStrictEquals(r.status, 200);
  assertEquals(
    scenesOf(r.body).map((s) => s.number),
    Array.from({ length: 15 }, (_, i) => i + 1),
  );
  // The text travelled with its own number, not just the order.
  assertStrictEquals(scenesOf(r.body)[0].text, scene(1).text);
});

Deno.test("PD4d broken scene numbering is fatal", async () => {
  const base = scenes(15);
  for (
    const [label, list] of [
      ["duplicate", [...base.slice(0, 14), scene(14)]],
      ["missing", [...base.slice(0, 14), scene(16)]],
      ["fractional", [...base.slice(0, 14), scene(15.5)]],
      ["zero", [scene(0), ...base.slice(0, 14)]],
      ["negative", [scene(-1), ...base.slice(0, 14)]],
      ["out of range", [...base.slice(0, 14), scene(99)]],
      ["string", [...base.slice(0, 14), scene("15" as unknown as number)]],
      ["absent", [...base.slice(0, 14), { text: "t", visualDescription: "v" }]],
    ] as Array<[string, Array<Record<string, unknown>>]>
  ) {
    assertInvalidStory(
      await runStory(validStory({ scenes: list })),
      `scene numbers: ${label}`,
    );
  }
});

Deno.test("PD4e scene text and visualDescription must be non-empty after trim", async () => {
  for (const field of ["text", "visualDescription"]) {
    for (const bad of ["", "   ", 3, null]) {
      const list = [...scenes(14), scene(15, { [field]: bad })];
      assertInvalidStory(
        await runStory(validStory({ scenes: list })),
        `scenes[14].${field}=${JSON.stringify(bad)}`,
      );
    }
  }
});

Deno.test("PD4f a non-array scenes value is 502", async () => {
  for (const bad of [null, undefined, "quince", {}]) {
    assertInvalidStory(
      await runStory(validStory({ scenes: bad })),
      `scenes=${JSON.stringify(bad)}`,
    );
  }
});

// ===========================================================================
// [PD9] — landmarkVisible, edge-side only
// ===========================================================================

Deno.test("PD9a landmarkVisible survives validation in both boolean states", async () => {
  const list = [
    scene(1, { landmarkVisible: true }),
    scene(2, { landmarkVisible: false }),
    ...scenes(15).slice(2),
  ];
  const r = await runStory(validStory({ scenes: list }));

  assertStrictEquals(r.status, 200);
  assertStrictEquals(scenesOf(r.body)[0].landmarkVisible, true);
  assertStrictEquals(scenesOf(r.body)[1].landmarkVisible, false);
  // Absent stays absent — the field is optional, not defaulted.
  assert(
    !("landmarkVisible" in scenesOf(r.body)[2]),
    "an absent landmarkVisible must not be invented",
  );
});

Deno.test("PD9b a non-boolean landmarkVisible is 502", async () => {
  for (const bad of ["true", 1, null, {}]) {
    const list = [scene(1, { landmarkVisible: bad }), ...scenes(15).slice(1)];
    assertInvalidStory(
      await runStory(validStory({ scenes: list })),
      `landmarkVisible=${JSON.stringify(bad)}`,
    );
  }
});

// ===========================================================================
// [PD5] — reference arrays and prop normalization
// ===========================================================================

Deno.test("PD5a appearsInScenes is sorted when valid", async () => {
  const r = await runStory(
    validStory({ characters: [ana({ appearsInScenes: [5, 1, 3] })] }),
  );
  assertStrictEquals(r.status, 200);
  assertEquals(charactersOf(r.body)[0].appearsInScenes, [1, 3, 5]);
});

Deno.test("PD5b a malformed appearsInScenes is fatal, never repaired", async () => {
  for (
    const [label, value] of [
      ["non-array", 3],
      ["string entries", ["1", "2"]],
      ["fractional", [1, 2.5]],
      ["duplicate", [1, 1, 2]],
      ["out of range", [1, 99]],
      ["zero", [0, 1]],
      ["negative", [-1, 1]],
      ["null entry", [1, null]],
    ] as Array<[string, unknown]>
  ) {
    assertInvalidStory(
      await runStory(
        validStory({ characters: [ana({ appearsInScenes: value })] }),
      ),
      `appearsInScenes ${label}`,
    );
  }
});

Deno.test("PD5c an absent appearsInScenes stays absent", async () => {
  const r = await runStory(validStory());
  assertStrictEquals(r.status, 200);
  assert(
    !("appearsInScenes" in charactersOf(r.body)[0]),
    "an absent optional array must not be invented",
  );
});

Deno.test("PD5d charactersInScene values must resolve to a declared character", async () => {
  const list = [
    scene(1, { charactersInScene: ["Beto"] }),
    ...scenes(15).slice(1),
  ];
  assertInvalidStory(
    await runStory(validStory({ scenes: list })),
    "unknown character reference",
  );
});

Deno.test("PD5e accepted charactersInScene values are rewritten to the display name", async () => {
  const list = [
    scene(1, { charactersInScene: [" ana "] }),
    ...scenes(15).slice(1),
  ];
  const r = await runStory(validStory({ scenes: list }));

  assertStrictEquals(r.status, 200);
  assertEquals(scenesOf(r.body)[0].charactersInScene, ["Ana"]);
});

Deno.test("PD5f charactersInScene must be unique under the character key", async () => {
  const list = [
    scene(1, { charactersInScene: ["Ana", " ana "] }),
    ...scenes(15).slice(1),
  ];
  assertInvalidStory(
    await runStory(validStory({ scenes: list })),
    "duplicate character reference",
  );
});

Deno.test("PD5g a malformed charactersInScene is fatal", async () => {
  for (const bad of ["Ana", 1, [1], [null], [""], [{}]]) {
    const list = [scene(1, { charactersInScene: bad }), ...scenes(15).slice(1)];
    assertInvalidStory(
      await runStory(validStory({ scenes: list })),
      `charactersInScene=${JSON.stringify(bad)}`,
    );
  }
});

Deno.test("PD5h prop text fields must be non-empty after trim", async () => {
  for (const field of ["name", "narrativeRole", "visualDescription"]) {
    for (const bad of ["", "  ", 5, null]) {
      assertInvalidStory(
        await runStory(validStory({ props: [farol({ [field]: bad })] })),
        `props[0].${field}=${JSON.stringify(bad)}`,
      );
    }
  }
});

Deno.test("PD5i prop kind casing is canonicalized; other values fail", async () => {
  for (const [raw, canonical] of [["Location", "location"], ["PROP", "prop"]]) {
    const r = await runStory(validStory({ props: [farol({ kind: raw })] }));
    assertStrictEquals(r.status, 200, `kind ${raw} must be accepted`);
    const suggested = r.body.suggestedProps as JsonObject[];
    assertStrictEquals(
      suggested[0].kind,
      canonical,
      `kind ${raw} must canonicalize`,
    );
  }
  for (const bad of ["widget", "", " prop", 1, null]) {
    assertInvalidStory(
      await runStory(validStory({ props: [farol({ kind: bad })] })),
      `kind=${JSON.stringify(bad)}`,
    );
  }
});

Deno.test("PD5j a malformed sceneNumbers is fatal, not coerced", async () => {
  for (
    const [label, value] of [
      ["non-array", 3],
      ["fractional", [2, 5.5]],
      ["string entries", ["2", "5"]],
      ["null entry", [2, null]],
      ["object entry", [2, {}]],
    ] as Array<[string, unknown]>
  ) {
    assertInvalidStory(
      await runStory(validStory({ props: [farol({ sceneNumbers: value })] })),
      `sceneNumbers ${label}`,
    );
  }
});

Deno.test("PD5k duplicate and out-of-range prop scene numbers are dropped and sorted", async () => {
  const r = await runStory(
    validStory({ props: [farol({ sceneNumbers: [9, 2, 9, 99, 0, -3, 2] })] }),
  );

  assertStrictEquals(r.status, 200);
  const suggested = r.body.suggestedProps as JsonObject[];
  assertEquals(
    suggested[0].sceneNumbers,
    [2, 9],
    "only the lossy rule applies",
  );
  assertEquals(codesOf(r.body), [], "a surviving prop raises no warning");
});

Deno.test("PD5l a prop with two remaining references survives", async () => {
  const r = await runStory(
    validStory({ props: [farol({ sceneNumbers: [3, 3, 7, 99] })] }),
  );
  const suggested = r.body.suggestedProps as JsonObject[];

  assertStrictEquals(r.status, 200);
  assertStrictEquals(suggested.length, 1);
  assertEquals(suggested[0].sceneNumbers, [3, 7]);
});

Deno.test("PD5m a prop with fewer than two references is dropped with one warning", async () => {
  for (
    const [label, value] of [
      ["one number", [4]],
      ["one after dedup", [4, 4]],
      ["one after range drop", [4, 99]],
      ["none", []],
      ["all out of range", [99, 100]],
    ] as Array<[string, number[]]>
  ) {
    const r = await runStory(
      validStory({ props: [farol({ sceneNumbers: value })] }),
    );

    assertStrictEquals(r.status, 200, `${label}: still a success`);
    assertStrictEquals(
      r.body.suggestedProps,
      undefined,
      `${label}: the dropped prop must not be returned`,
    );
    assertEquals(
      codesOf(r.body),
      ["story:PROP_NOT_RECURRING"],
      `${label}: warning`,
    );
    assertStrictEquals(
      warningsOf(r.body)[0].message,
      PROP_NOT_RECURRING_MSG,
      `${label}: fixed copy`,
    );
  }
});

Deno.test("PD5n the prop warning never names the provider's prop", async () => {
  const secret = "el farol secreto de contrabando";
  const r = await runStory(
    validStory({ props: [farol({ name: secret, sceneNumbers: [4] })] }),
  );

  assertStrictEquals(r.status, 200);
  const rendered = JSON.stringify(warningsOf(r.body));
  assert(!rendered.includes(secret), "the warning leaked the prop name");
  assert(!rendered.includes("farol"), "the warning leaked provider text");
});

Deno.test("PD5o two dropped props raise one warning each", async () => {
  const r = await runStory(
    validStory({
      props: [
        farol({ name: "el farol", sceneNumbers: [4] }),
        farol({ name: "el bote", sceneNumbers: [] }),
      ],
    }),
  );

  assertStrictEquals(r.status, 200);
  assertEquals(codesOf(r.body), [
    "story:PROP_NOT_RECURRING",
    "story:PROP_NOT_RECURRING",
  ]);
});

Deno.test("PD5p a non-array props value is 502", async () => {
  for (const bad of ["farol", 1, {}, null]) {
    assertInvalidStory(
      await runStory(validStory({ props: bad })),
      `props=${JSON.stringify(bad)}`,
    );
  }
});

// ===========================================================================
// [PD6] — typed status and exact envelopes
// ===========================================================================

Deno.test("PD6a the 502 envelope carries exactly success/code/error when nothing else applies", async () => {
  const r = await runStory(validStory({ title: "" }));
  assertInvalidStory(r, "bare 502");
  assertEquals(Object.keys(r.body).sort(), ["code", "error", "success"]);
});

Deno.test("PD6b the 502 carries skippedImages and warnings together", async () => {
  const r = await run({
    payload: storyPayload({
      // A HEIC prop photo: sniffed, unsupported, dropped — not fatal.
      props: [{
        id: "p1",
        kind: "prop",
        name: "Farol",
        narrativeRole: "luz",
        referenceImages: [HEIC_B64()],
      }],
    }),
    // Research fails, so PC contributes a warning too.
    gemini: () => new Response("x", { status: 404 }),
    anthropic: () => toolUse(validStory({ title: "" })),
  });

  assertInvalidStory(r, "502 with both additive fields");
  assertEquals(Object.keys(r.body).sort(), [
    "code",
    "error",
    "skippedImages",
    "success",
    "warnings",
  ]);
  assertEquals(r.body.skippedImages, [
    { field: "props[0].referenceImages[0]", code: "NOT_IMAGE" },
  ]);
  assert(warningsOf(r.body).length > 0, "PC's warnings must survive");
});

Deno.test("PD6c the 502 carries skippedImages alone", async () => {
  const r = await run({
    payload: storyPayload({
      props: [{
        id: "p1",
        kind: "prop",
        name: "Farol",
        narrativeRole: "luz",
        referenceImages: [HEIC_B64()],
      }],
    }),
    anthropic: () => toolUse(validStory({ title: "" })),
  });

  assertInvalidStory(r, "502 with skippedImages only");
  assertEquals(Object.keys(r.body).sort(), [
    "code",
    "error",
    "skippedImages",
    "success",
  ]);
});

Deno.test("PD6d the 502 carries warnings alone", async () => {
  const r = await run({
    gemini: () => new Response("x", { status: 404 }),
    anthropic: () => toolUse(validStory({ title: "" })),
  });

  assertInvalidStory(r, "502 with warnings only");
  assertEquals(Object.keys(r.body).sort(), [
    "code",
    "error",
    "success",
    "warnings",
  ]);
});

Deno.test("PD6e neither provider values nor validation paths reach the client or the log", async () => {
  const PLANTED = "https://secret.example/photo.png?token=SIGNEDTOKEN123";
  const r = await run({
    anthropic: () =>
      anthropicRaw({
        stop_reason: PLANTED,
        content: [{
          type: "tool_use",
          id: "toolu_01",
          name: "emit_story",
          input: validStory({
            title: PLANTED,
            summary: PLANTED,
            spiritualConnection: PLANTED,
            characters: [ana({ name: PLANTED, visualDescription: PLANTED })],
            // Broken on purpose: the rejection path is the one that logs.
            scenes: scenes(3),
          }),
        }],
      }),
  });

  assertStrictEquals(r.status, 502);
  const rendered = JSON.stringify(r.body);
  const logged = r.lines.join("\n");
  assert(r.lines.length > 0, "the handler must actually have logged something");

  for (
    const [where, text] of [["response", rendered], ["log", logged]] as const
  ) {
    assert(!text.includes("SIGNEDTOKEN123"), `${where} leaked the token`);
    assert(!text.includes(PLANTED), `${where} leaked the planted URL`);
    assert(!text.includes("secret.example"), `${where} leaked the host`);
    assert(!text.includes("?token="), `${where} leaked a query string`);
  }
});

Deno.test("PD6e2 a rejected story's own values reach neither the client nor the log", async () => {
  // PD6e plants the token in `stop_reason`, which the protocol gate rejects
  // BEFORE validation runs — so it never exercises the validation channel. This
  // case keeps the success protocol intact and breaks the story instead, so the
  // rejection really goes through `validateAndNormalizeStory` and whatever the
  // handler logs about it. (Found by mutation M32: serializing the provider's
  // story into the log detail passed PD6e untouched.)
  const PLANTED = "https://secret.example/photo.png?token=SIGNEDTOKEN123";
  const r = await runStory(
    validStory({
      title: PLANTED,
      summary: PLANTED,
      spiritualConnection: PLANTED,
      characters: [ana({ name: PLANTED, visualDescription: PLANTED })],
      props: [farol({ name: PLANTED, visualDescription: PLANTED })],
      // The one thing that makes it invalid, so the story is rejected while
      // every other field still carries the planted value.
      scenes: scenes(3),
    }),
  );

  assertInvalidStory(r, "planted values on a rejected story");
  const rendered = JSON.stringify(r.body);
  const logged = r.lines.join("\n");
  assert(r.lines.length > 0, "the handler must actually have logged something");

  for (
    const [where, text] of [["response", rendered], ["log", logged]] as const
  ) {
    assert(!text.includes("SIGNEDTOKEN123"), `${where} leaked the token`);
    assert(!text.includes(PLANTED), `${where} leaked the planted URL`);
    assert(!text.includes("secret.example"), `${where} leaked the host`);
    assert(!text.includes("?token="), `${where} leaked a query string`);
  }
});

Deno.test("PD6f malformed JSON is 400 CLIENT_INPUT_INVALID", async () => {
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(post("{not json"));
    const body = await res.json() as Record<string, unknown>;

    assertStrictEquals(res.status, 400);
    assertStrictEquals(body.success, false);
    assertStrictEquals(body.code, "CLIENT_INPUT_INVALID");
    assertStrictEquals(typeof body.error, "string");
    assert(
      (body.error as string).length > 0,
      "the 400 must carry Spanish copy",
    );
    assertStrictEquals(
      spy.calls.length,
      0,
      "no provider call on malformed input",
    );
  });
});

Deno.test("PD6g missing client fields are 422 CLIENT_INPUT_INVALID", async () => {
  for (
    const [label, payload] of [
      ["no context", { location: "Valparaíso" }],
      ["no location", { context: { title: "Adviento", summary: "Esperanza" } }],
      ["empty location", {
        context: { title: "A", summary: "B" },
        location: "",
      }],
      ["both absent", {}],
    ] as Array<[string, Record<string, unknown>]>
  ) {
    await withFetchSpy(async (spy) => {
      const res = await createHandler(deps())(post(payload));
      const body = await res.json() as Record<string, unknown>;

      assertStrictEquals(res.status, 422, `${label}: status`);
      assertStrictEquals(body.success, false, `${label}: success`);
      assertStrictEquals(body.code, "CLIENT_INPUT_INVALID", `${label}: code`);
      assertStrictEquals(
        spy.calls.length,
        0,
        `${label}: client input must not reach a provider`,
      );
    });
  }
});

Deno.test("PD6h client input is never labelled provider output, and vice versa", async () => {
  const client = await (async () => {
    const res = await createHandler(deps())(post({ location: "Valparaíso" }));
    return await res.json() as Record<string, unknown>;
  })();
  assertStrictEquals(client.code, "CLIENT_INPUT_INVALID");

  const provider = await runStory(validStory({ title: "" }));
  assertStrictEquals(provider.body.code, "PROVIDER_OUTPUT_INVALID");
});

Deno.test("PD6i an unexpected failure is still 500 with no typed code", async () => {
  // A provider HTTP non-2xx keeps its pre-PD behaviour (G3): the generic 500.
  const r = await run({
    anthropic: () => new Response("provider rejected", { status: 400 }),
  });

  assertStrictEquals(r.status, 500);
  assertStrictEquals(r.body.success, false);
  assertStrictEquals(r.body.error, "Error de Claude API: 400");
  assert(!("code" in r.body), "the generic 500 must not grow a typed code");
});

// ===========================================================================
// [PD7] — warning aggregation
// ===========================================================================

Deno.test("PD7a story warnings append after the research warnings, order preserved", async () => {
  const r = await run({
    payload: storyPayload({
      landmarks: [{
        name: "Faro",
        narrativeRole: "guía",
        referenceImages: [PNG_B64()],
      }],
    }),
    gemini: () => new Response("x", { status: 404 }),
    anthropic: () =>
      toolUse(validStory({ props: [farol({ sceneNumbers: [4] })] })),
  });

  assertStrictEquals(r.status, 200);
  assertEquals(codesOf(r.body), [
    "location:MODEL_NOT_FOUND",
    "landmark:MODEL_NOT_FOUND",
    "story:PROP_NOT_RECURRING",
  ]);
});

Deno.test("PD7b a rejected story keeps research warnings and drops its own", async () => {
  const r = await run({
    gemini: () => new Response("x", { status: 404 }),
    // A story that BOTH drops a prop and fails validation. The prop warning
    // belongs to a story that was discarded, so it must not be reported.
    anthropic: () =>
      toolUse(
        validStory({ title: "", props: [farol({ sceneNumbers: [4] })] }),
      ),
  });

  assertInvalidStory(r, "rejected story");
  assertEquals(codesOf(r.body), ["location:MODEL_NOT_FOUND"]);
});

// MUTATION PROOF (D7): base has no story warnings at all, so the absence is
// trivially true there. Emitting the prop warning unconditionally — dropping
// the `< 2` guard in the normalizer — fails this.
Deno.test("PD7c a clean run grows no warnings key", async () => {
  const r = await runStory(validStory({ props: [farol()] }));

  assertStrictEquals(r.status, 200);
  assert(!("warnings" in r.body), "the success envelope must be unchanged");
});

Deno.test("PD7d story warnings do not replace the research entries", async () => {
  const r = await run({
    gemini: () => new Response("x", { status: 404 }),
    anthropic: () =>
      toolUse(validStory({ props: [farol({ sceneNumbers: [4] })] })),
  });

  const research = warningsOf(r.body).filter((w) => w.source === "location");
  assertStrictEquals(research.length, 1, "PC's entry must survive verbatim");
  assertStrictEquals(research[0].code, "MODEL_NOT_FOUND");
  assert(
    research[0].message.includes("investigación"),
    `PC's copy must be unchanged, got ${research[0].message}`,
  );
});

// ===========================================================================
// The success envelope is otherwise unchanged
// ===========================================================================

Deno.test("PD-envelope a valid story still returns the pre-PD success shape", async () => {
  const r = await runStory(validStory());

  assertStrictEquals(r.status, 200);
  assertStrictEquals(r.body.success, true);
  assertStrictEquals(r.body.title, "El faro de Ana");
  assertStrictEquals(r.body.summary, "Un cuento sobre la esperanza.");
  assertStrictEquals(r.body.spiritualConnection, "Jesús es la luz que guía.");
  assertStrictEquals(r.body.moral, "Jesús es la luz que guía.");
  assertStrictEquals(r.body.model, "claude-opus-4-5-20251101");
  assertStrictEquals(scenesOf(r.body).length, 15);
  assertStrictEquals(r.body.suggestedDuration, 5);
  assertEquals(r.body.usage, { input_tokens: 10, output_tokens: 20 });
  // `content`/`story` are the legacy plain-text mirrors of the scene texts.
  assertStrictEquals(
    r.body.content,
    scenes(15).map((s) => s.text).join("\n\n"),
  );
  assertStrictEquals(r.body.story, r.body.content);
});
