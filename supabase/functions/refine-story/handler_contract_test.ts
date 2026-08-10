// PHASE PD-REFINE — strict output contract for `refine-story`, through the
// PRODUCTION handler.
//
// `refine-story` was the last story-producing function still parsing prose JSON
// out of the model's text response: a ```json fence match, a `/\{[\s\S]*\}/`
// fallback, a control-character strip, a bare `JSON.parse`, and a three-field
// "structure check" — with every failure, including a provider that answered
// with garbage, funnelled into one HTTP 500. What this suite pins is the same
// contract PD gave `generate-story`:
//
//   1. A forced `emit_refined_story` tool declared `strict: true`, whose schema
//      is the SHARED story schema plus `refinementNotes` ([PDR1]).
//   2. `stop_reason` inspected BEFORE content; `tool_use` plus exactly one
//      matching block is the only success protocol, and the text/JSON.parse
//      fallback is gone ([PDR2]).
//   3. Output that is structurally valid JSON but not a story is rejected by
//      the shared `validateAndNormalizeStory` ([PDR3]).
//   4. Every provider-output failure is a typed 502 `PROVIDER_OUTPUT_INVALID`
//      carrying one of three fixed Spanish messages; the generic 500 keeps only
//      genuine server faults ([PDR4]).
//
// Black-box by construction: every case drives `createHandler(...)` with a
// stubbed `fetch` and asserts on the outgoing Anthropic request or the returned
// envelope. Nothing imports a validator directly, so no case can pass against a
// helper the production path does not call.
//
// BASE-RED @ 5ffd59a for [PDR1] entirely (no `tools` key existed at all), for
// every [PDR2] case (a refusal, a truncation and a prose body were all either a
// 200 or a generic 500), and for every [PDR3] case (the old check read only
// `title` + `Array.isArray(scenes)`). The [PDR4] cases assert behaviour that
// already held and are the regression net for it — they are what fails if the
// new typed dispatch swallows a genuine server fault or moves the authz guard.

import { assert, assertEquals, assertStrictEquals } from "@std/assert";

import { corsHeaders, createHandler, type HandlerDeps } from "./handler.ts";
import {
  AUTH_HEADER,
  type FetchCall,
  makeAuthzDeps,
  spyRequest,
  withCapturedLogs,
  withFetchSpy,
} from "../_shared/testHelpers.ts";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const TOOL_NAME = "emit_refined_story";

function deps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    anthropicApiKey: "test-anthropic-key",
    authzDeps: makeAuthzDeps().deps,
    ...overrides,
  };
}

/** The request body the client sends. Refinement always needs both fields. */
function refinePayload(extra: Record<string, unknown> = {}) {
  return {
    currentStory: {
      title: "El faro de Ana",
      summary: "Un cuento sobre la esperanza.",
      scenes: [{ number: 1, text: "Ana camina por el muelle." }],
    },
    feedback: "Hazlo más tierno.",
    refinementType: "tone",
    liturgyContext: { title: "Adviento", summary: "Esperanza" },
    ...extra,
  };
}

function post(body: unknown, init: RequestInit = {}): Request {
  return new Request("https://edge.test/refine-story", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH_HEADER },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
}

// ---------------------------------------------------------------------------
// Anthropic fixtures
//
// SOURCE for the response envelope: Anthropic's tool-use documentation
// (`/docs/en/agents-and-tools/tool-use/how-tool-use-works` and
// `/docs/en/agents-and-tools/tool-use/strict-tool-use`). A normal client tool
// completion carries `stop_reason:"tool_use"` and a `tool_use` content block
// with `id`, `name` and the schema-valid `input`. Shapes are copied from the
// sibling PD suite rather than invented, so the two functions are pinned
// against the same protocol.
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

function ana(extra: Record<string, unknown> = {}) {
  return {
    name: "Ana",
    role: "protagonist",
    description: "una niña del puerto",
    visualDescription: "chaleco rojo, pelo oscuro, 8 años",
    ...extra,
  };
}

/** A refined story that satisfies every rule. Overrides break one at a time. */
function validRefined(overrides: Record<string, unknown> = {}) {
  return {
    title: "El faro de Ana",
    summary: "Un cuento sobre la esperanza.",
    characters: [ana()],
    scenes: scenes(15),
    spiritualConnection: "Jesús es la luz que guía.",
    props: [],
    refinementNotes: "Tono más tierno en las escenas 3 y 4.",
    ...overrides,
  };
}

/** The success protocol: `tool_use` + exactly one matching block. */
function toolUse(input: unknown, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      id: "msg_01PDR",
      type: "message",
      role: "assistant",
      model: "claude-opus-5",
      stop_reason: "tool_use",
      content: [{
        type: "tool_use",
        id: "toolu_01PDR",
        name: TOOL_NAME,
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
        post(opts.payload ?? refinePayload()),
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
    }, (_url, _init) =>
      Promise.resolve(
        (opts.anthropic ?? (() => toolUse(validRefined())))(_url, _init),
      ))
  );
}

/** Drives one refined-story payload and returns the envelope. */
async function runStory(story: unknown): Promise<RunResult> {
  return await run({ anthropic: () => toolUse(story) });
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

/**
 * The three fixed Spanish messages. Copied from `_shared/storyContract.ts`, not
 * imported, so a silent edit to the shared copy fails this suite rather than
 * moving with it.
 */
const REFUSAL_MSG =
  "El proveedor rechazó generar el cuento. Ajusta las notas y vuelve a intentarlo.";
const MAX_TOKENS_MSG =
  "El proveedor cortó el cuento antes de completarlo. Usa notas más breves y vuelve a intentarlo.";
const INVALID_STORY_MSG =
  "El proveedor devolvió un cuento con una estructura inválida. Vuelve a intentarlo.";

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

function assertInvalidStory(r: RunResult, where: string): void {
  assertProviderInvalid(r, INVALID_STORY_MSG, where);
}

function requestBody(call: FetchCall): Record<string, unknown> {
  return JSON.parse(String(call.init?.body)) as Record<string, unknown>;
}

function refineTool(r: RunResult): Record<string, unknown> {
  const tools = requestBody(r.anthropic[0]).tools;
  assert(Array.isArray(tools), "the request must carry a tools array");
  assertStrictEquals(tools.length, 1, "exactly one tool");
  return tools[0] as Record<string, unknown>;
}

/** Walks a dotted path through the request schema, asserting each hop exists. */
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

type JsonObject = Record<string, unknown>;

function storyOf(body: Record<string, unknown>): JsonObject {
  return (body.story ?? {}) as JsonObject;
}

function scenesOf(body: Record<string, unknown>): JsonObject[] {
  return (storyOf(body).scenes ?? []) as JsonObject[];
}

// ===========================================================================
// [PDR1] — strict request and schema pin
// ===========================================================================

Deno.test("PDR1a the emit_refined_story tool declares strict:true at the top level", async () => {
  const r = await run();
  const tool = refineTool(r);

  assertStrictEquals(tool.name, TOOL_NAME);
  // SOURCE: strict-tool-use docs — "Set `strict: true` as a top-level property
  // in your tool definition, alongside `name`, `description`, and
  // `input_schema`." Not inside input_schema, not on tool_choice.
  assertStrictEquals(tool.strict, true, "strict must be top-level on the tool");
  assertStrictEquals(
    at(tool, "input_schema.strict"),
    undefined,
    "strict inside input_schema is silently ignored by the API",
  );
});

Deno.test("PDR1b the request forces the emit_refined_story tool", async () => {
  const r = await run();
  assertEquals(requestBody(r.anthropic[0]).tool_choice, {
    type: "tool",
    name: TOOL_NAME,
  });
});

Deno.test("PDR1c refinementNotes joins the story's required root properties", async () => {
  const schema = at(refineTool(await run()), "input_schema");
  const required = at(schema, "required");
  assert(Array.isArray(required), "required must be an array");

  // The refinement payload is the story shape PLUS the notes — not a subset of
  // it, and not a replacement for it.
  for (
    const field of [
      "title",
      "summary",
      "characters",
      "scenes",
      "spiritualConnection",
      "props",
      "refinementNotes",
    ]
  ) {
    assert(required.includes(field), `${field} must be required`);
  }
  assertStrictEquals(
    at(schema, "properties.refinementNotes.type"),
    "string",
    "refinementNotes must be declared a string",
  );
});

Deno.test("PDR1d additionalProperties:false at root and every nested object", async () => {
  const schema = at(refineTool(await run()), "input_schema");

  for (
    const path of [
      "",
      "properties.characters.items",
      "properties.scenes.items",
      "properties.props.items",
    ]
  ) {
    const node = path === "" ? schema : at(schema, path);
    assertStrictEquals(
      (node as JsonObject).additionalProperties,
      false,
      `additionalProperties must be false at ${path || "<root>"}`,
    );
  }
});

Deno.test("PDR1e scene and reference numbers are integer schemas", async () => {
  const schema = at(refineTool(await run()), "input_schema");

  // `number` would admit 2.5, which is not a scene.
  for (
    const path of [
      "properties.scenes.items.properties.number.type",
      "properties.characters.items.properties.appearsInScenes.items.type",
      "properties.props.items.properties.sceneNumbers.items.type",
    ]
  ) {
    assertStrictEquals(at(schema, path), "integer", `${path} must be integer`);
  }
});

Deno.test("PDR1f the prompt states ONE scene window, and it is the one the validator enforces", async () => {
  const body = requestBody((await run()).anthropic[0]);
  const system = String(body.system);
  const user = String(
    (body.messages as Array<{ content: string }>)[0].content,
  );
  const sent = `${system}\n${user}`;

  // The defect this phase closes: the system prompt promised "entre 12-16" and
  // the `length` refinement instruction promised "entre 10 y 18", and the code
  // enforced neither. `refinementType: "length"` is the request that carries
  // both, so both are in the bytes asserted here.
  const lengthRun = requestBody(
    (await run({ payload: refinePayload({ refinementType: "length" }) }))
      .anthropic[0],
  );
  const lengthPrompt = `${String(lengthRun.system)}\n${
    String((lengthRun.messages as Array<{ content: string }>)[0].content)
  }`;

  for (const [where, text] of [["default", sent], ["length", lengthPrompt]] as const) {
    assert(
      text.includes("12") && text.includes("16"),
      `${where}: the prompt must state the 12–16 window`,
    );
    for (const stale of ["10 y 18", "entre 10", "y 18 escenas"]) {
      assert(
        !text.includes(stale),
        `${where}: stale scene range "${stale}" survives in the prompt`,
      );
    }
  }
});

Deno.test("PDR1g the prompt asks for the tool, not for JSON prose", async () => {
  const system = String(requestBody((await run()).anthropic[0]).system);

  assert(
    system.includes(TOOL_NAME),
    "the system prompt must name the tool it expects",
  );
  // The old instruction — "Tu respuesta debe ser ÚNICAMENTE un objeto JSON
  // válido" — is what taught the model to answer in prose. With a forced tool
  // it is not just redundant, it contradicts the only success protocol.
  assert(
    !system.includes("ÚNICAMENTE un objeto JSON"),
    "the prose-JSON response instruction must be gone",
  );
});

// ===========================================================================
// [PDR2] — the stop_reason protocol and the removed prose fallback
// ===========================================================================

Deno.test("PDR2a stop_reason refusal is a typed 502 with the refusal copy", async () => {
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

Deno.test("PDR2b stop_reason max_tokens is a typed 502 with the truncation copy", async () => {
  const r = await run({
    anthropic: () =>
      anthropicRaw({
        stop_reason: "max_tokens",
        // A truncated strict response can still carry a partial tool_use block.
        content: [{
          type: "tool_use",
          id: "toolu_01",
          name: TOOL_NAME,
          input: {},
        }],
      }),
  });
  assertProviderInvalid(r, MAX_TOKENS_MSG, "max_tokens");
});

Deno.test("PDR2c the three provider-output messages the handler returns are distinct", async () => {
  // Asserted on OBSERVED output, not by comparing the fixtures to each other:
  // collapsing two branches onto one message must fail this.
  const refusal = await run({
    anthropic: () => anthropicRaw({ stop_reason: "refusal", content: [] }),
  });
  const truncated = await run({
    anthropic: () => anthropicRaw({ stop_reason: "max_tokens", content: [] }),
  });
  const invalid = await run({
    anthropic: () => anthropicRaw({ stop_reason: "end_turn", content: [] }),
  });

  const copies = [refusal, truncated, invalid].map((r) => {
    assertStrictEquals(r.status, 502);
    return r.body.error;
  });
  assertStrictEquals(
    new Set(copies).size,
    3,
    `the three reasons must not share copy: ${JSON.stringify(copies)}`,
  );
});

Deno.test("PDR2d stop_reason is checked BEFORE content", async () => {
  // A refusal carrying a perfectly valid refined story must still be a refusal:
  // reading content first would serve it as a success.
  const r = await run({
    anthropic: () =>
      anthropicRaw({
        stop_reason: "refusal",
        content: [{
          type: "tool_use",
          id: "toolu_01",
          name: TOOL_NAME,
          input: validRefined(),
        }],
      }),
  });
  assertProviderInvalid(r, REFUSAL_MSG, "refusal with a valid story");
});

Deno.test("PDR2e end_turn with a valid story is invalid-story 502", async () => {
  const r = await run({
    anthropic: () =>
      anthropicRaw({
        stop_reason: "end_turn",
        content: [{
          type: "tool_use",
          id: "toolu_01",
          name: TOOL_NAME,
          input: validRefined(),
        }],
      }),
  });
  assertInvalidStory(r, "end_turn");
});

Deno.test("PDR2f a missing stop_reason is invalid-story 502", async () => {
  const r = await run({
    anthropic: () =>
      anthropicRaw({
        content: [{
          type: "tool_use",
          id: "toolu_01",
          name: TOOL_NAME,
          input: validRefined(),
        }],
      }),
  });
  assertInvalidStory(r, "absent stop_reason");
});

Deno.test("PDR2g no tool block is invalid-story 502", async () => {
  const r = await run({
    anthropic: () => anthropicRaw({ stop_reason: "tool_use", content: [] }),
  });
  assertInvalidStory(r, "no tool block");
});

Deno.test("PDR2h a wrong tool name is invalid-story 502", async () => {
  const r = await run({
    anthropic: () =>
      anthropicRaw({
        stop_reason: "tool_use",
        content: [{
          type: "tool_use",
          id: "toolu_01",
          // The sibling function's tool. Close enough to be a real mistake,
          // and it must not be accepted here.
          name: "emit_story",
          input: validRefined(),
        }],
      }),
  });
  assertInvalidStory(r, "wrong tool name");
});

Deno.test("PDR2i two emit_refined_story blocks are invalid-story 502", async () => {
  const block = {
    type: "tool_use",
    id: "toolu_01",
    name: TOOL_NAME,
    input: validRefined(),
  };
  const r = await run({
    anthropic: () =>
      anthropicRaw({
        stop_reason: "tool_use",
        content: [block, { ...block, id: "toolu_02" }],
      }),
  });
  assertInvalidStory(r, "two tool blocks");
});

Deno.test("PDR2j the fenced-JSON fallback is gone — a ```json block is 502", async () => {
  // The exact shape the removed `/```json\s*([\s\S]*?)\s*```/` match handled.
  // At base this was parsed and served as a 200.
  const r = await run({
    anthropic: () =>
      anthropicRaw({
        stop_reason: "end_turn",
        content: [{
          type: "text",
          text: "```json\n" + JSON.stringify(validRefined()) + "\n```",
        }],
      }),
  });
  assertInvalidStory(r, "fenced JSON in a text block");
});

Deno.test("PDR2k the brace fallback is gone — bare JSON in a text block is 502", async () => {
  // The exact shape the removed `/\{[\s\S]*\}/` fallback handled.
  const r = await run({
    anthropic: () =>
      anthropicRaw({
        stop_reason: "end_turn",
        content: [{ type: "text", text: JSON.stringify(validRefined()) }],
      }),
  });
  assertInvalidStory(r, "bare JSON in a text block");
});

Deno.test("PDR2l unparseable prose is 502", async () => {
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

Deno.test("PDR2m a non-JSON provider body is a typed 502 that echoes no provider bytes", async () => {
  // V8's SyntaxError quotes the first ten raw bytes of the unparseable input
  // back into its message, so the planted token IS those ten leading bytes:
  // any path that echoes the engine message — at base, the generic 500 — has
  // the whole token in its `error` field.
  const TOKEN = "SIGNEDTOK1";
  const r = await run({
    anthropic: () => new Response(`${TOKEN} no es json {{{`, { status: 200 }),
  });

  const rendered = JSON.stringify(r.body);
  const logged = r.lines.join("\n");
  assert(r.lines.length > 0, "the handler must actually have logged something");
  for (
    const [where, text] of [["response", rendered], ["log", logged]] as const
  ) {
    assert(!text.includes(TOKEN), `${where} leaked the token: ${text}`);
    assert(
      !text.includes("no es json"),
      `${where} leaked raw provider bytes: ${text}`,
    );
    assert(
      !text.includes("not valid JSON"),
      `${where} echoed the engine parse error: ${text}`,
    );
  }
  assertInvalidStory(r, "non-JSON provider body");
});

Deno.test("PDR2n a JSON null provider body is a typed 502, not an engine TypeError", async () => {
  // `null` is valid JSON, so the parse survives and the first property read is
  // what detonates: `Cannot read properties of null (reading 'stop_reason')`,
  // echoed to the client by the generic 500 at base.
  const r = await run({
    anthropic: () => new Response("null", { status: 200 }),
  });

  for (
    const [where, text] of [
      ["response", JSON.stringify(r.body)],
      ["log", r.lines.join("\n")],
    ] as const
  ) {
    assert(
      !text.includes("Cannot read properties"),
      `${where} echoed the engine error: ${text}`,
    );
  }
  assertInvalidStory(r, "null provider body");
});

// ===========================================================================
// [PDR3] — structural validation of the refined story (502, never 500)
// ===========================================================================

Deno.test("PDR3a a valid refined story is a 200 carrying the normalized story", async () => {
  const r = await run();

  assertStrictEquals(r.status, 200);
  assertStrictEquals(r.body.success, true);
  assertStrictEquals(storyOf(r.body).title, "El faro de Ana");
  assertStrictEquals(scenesOf(r.body).length, 15);
  // The envelope's two historical keys survive: `refinementNotes` at the top
  // level AND inside `story`, which is where the pre-PD-REFINE client read it.
  assertStrictEquals(
    r.body.refinementNotes,
    "Tono más tierno en las escenas 3 y 4.",
  );
  assertStrictEquals(
    storyOf(r.body).refinementNotes,
    "Tono más tierno en las escenas 3 y 4.",
  );
  assertStrictEquals(r.body.model, "claude-opus-5");
  assertEquals(r.body.usage, { input_tokens: 10, output_tokens: 20 });
});

Deno.test("PDR3b the scene window is 12..16 inclusive, and outside it is 502", async () => {
  for (const count of [12, 16]) {
    const r = await runStory(validRefined({ scenes: scenes(count) }));
    assertStrictEquals(r.status, 200, `${count} scenes must be accepted`);
    assertStrictEquals(scenesOf(r.body).length, count);
  }
  for (const count of [11, 17]) {
    const r = await runStory(validRefined({ scenes: scenes(count) }));
    assertInvalidStory(r, `${count} scenes`);
  }
});

Deno.test("PDR3c a missing or blank refinementNotes is 502", async () => {
  const { refinementNotes: _omitted, ...withoutNotes } = validRefined();
  assertInvalidStory(await runStory(withoutNotes), "refinementNotes omitted");
  assertInvalidStory(
    await runStory(validRefined({ refinementNotes: "   " })),
    "refinementNotes blank after trim",
  );
  assertInvalidStory(
    await runStory(validRefined({ refinementNotes: 42 })),
    "refinementNotes not a string",
  );
});

Deno.test("PDR3d props omitted is 502 — an absent list is not an empty one", async () => {
  const { props: _omitted, ...withoutProps } = validRefined();
  assertInvalidStory(await runStory(withoutProps), "props omitted");
});

Deno.test("PDR3e a story that is not an object at all is 502", async () => {
  for (const input of [null, "un cuento", 7, [validRefined()]]) {
    assertInvalidStory(await runStory(input), `tool input ${typeof input}`);
  }
});

Deno.test("PDR3f empty prose fields are 502", async () => {
  for (const field of ["title", "summary", "spiritualConnection"]) {
    assertInvalidStory(
      await runStory(validRefined({ [field]: "   " })),
      `blank ${field}`,
    );
  }
});

Deno.test("PDR3g the protagonist rule survives refinement", async () => {
  assertInvalidStory(
    await runStory(validRefined({ characters: [ana(), ana({ name: "Beto" })] })),
    "two protagonists",
  );
  assertInvalidStory(
    await runStory(validRefined({ characters: [ana({ role: "secondary" })] })),
    "no protagonist",
  );
});

Deno.test("PDR3h broken scene numbering is 502, never repaired", async () => {
  const duplicated = scenes(15);
  duplicated[4] = scene(4);
  assertInvalidStory(
    await runStory(validRefined({ scenes: duplicated })),
    "duplicate scene number",
  );

  const outOfRange = scenes(15);
  outOfRange[7] = scene(99);
  assertInvalidStory(
    await runStory(validRefined({ scenes: outOfRange })),
    "scene number out of range",
  );
});

Deno.test("PDR3i an out-of-order 1..N set is sorted, not rejected", async () => {
  const shuffled = [...scenes(15)].reverse();
  const r = await runStory(validRefined({ scenes: shuffled }));

  assertStrictEquals(r.status, 200);
  assertEquals(
    scenesOf(r.body).map((s) => s.number),
    Array.from({ length: 15 }, (_, i) => i + 1),
  );
});

Deno.test("PDR3j a structural rejection logs codes and paths, never provider text", async () => {
  const SECRET = "TITULO-SECRETO-DEL-PROVEEDOR";
  const r = await runStory(validRefined({ title: SECRET, props: undefined }));

  assertInvalidStory(r, "props omitted with a planted title");
  const logged = r.lines.join("\n");
  assert(logged.length > 0, "the rejection must be logged");
  assert(
    !logged.includes(SECRET),
    `the log echoed provider text: ${logged}`,
  );
  assert(
    logged.includes("REQUIRED@props"),
    `the log must carry the validation code and path: ${logged}`,
  );
});

// ===========================================================================
// [PDR4] — what must STILL be a 500, and the authz ordering that must not move
//
// These five assert behaviour that already held at base, so they are pinned by
// recorded MUTATION rather than by base-red (D7's codified exception). Each was
// applied to `handler.ts` alone, killed its case, and was reverted:
//
//   M1 → PDR4a  the missing-key throw becomes `new ProviderOutputError(...)`
//   M2 → PDR4b  the provider non-2xx throw becomes `new ProviderOutputError(...)`
//   M3 → PDR4c  the `!currentStory || !feedback` guard is deleted
//   M4 → PDR4d  the OPTIONS branch is deleted (preflight falls through the guard)
//   M5 → PDR4e  `await req.json()` is hoisted above `requireLiturgyWriter`
// ===========================================================================

Deno.test("PDR4a a missing ANTHROPIC_API_KEY is a 500 and never reaches the provider", async () => {
  const r = await run({ deps: { anthropicApiKey: "" } });

  assertStrictEquals(r.status, 500, "a config fault is a server fault");
  assertStrictEquals(r.body.success, false);
  assertStrictEquals(r.body.code, undefined, "not a typed provider error");
  assertStrictEquals(r.body.error, "ANTHROPIC_API_KEY no está configurada");
  assertStrictEquals(r.anthropic.length, 0, "no provider call may be attempted");
});

Deno.test("PDR4b a provider non-2xx is a 500, not a 502", async () => {
  // The provider FAILED to answer, which is not the same event as answering
  // with something unusable — and the retry advice differs.
  const r = await run({
    anthropic: () => new Response("upstream exploded", { status: 529 }),
  });

  assertStrictEquals(r.status, 500);
  assertStrictEquals(r.body.code, undefined);
  assertStrictEquals(r.body.error, "Error de Claude API: 529");
});

Deno.test("PDR4c a request missing currentStory or feedback is unchanged", async () => {
  for (const missing of ["currentStory", "feedback"]) {
    const payload = refinePayload();
    delete (payload as Record<string, unknown>)[missing];
    const r = await run({ payload });

    assertStrictEquals(r.status, 500, `${missing} missing: status`);
    assertStrictEquals(r.body.error, "Se requiere currentStory y feedback");
    assertStrictEquals(r.anthropic.length, 0, "no provider call");
  }
});

Deno.test("PDR4d OPTIONS is still answered before the authz guard", async () => {
  const { deps: authz, calls } = makeAuthzDeps();
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps({ authzDeps: authz }))(
      new Request("https://edge.test/refine-story", { method: "OPTIONS" }),
    );

    assertStrictEquals(res.status, 200);
    for (const [k, v] of Object.entries(corsHeaders)) {
      assertEquals(res.headers.get(k), v, `missing CORS header ${k}`);
    }
    assertStrictEquals(calls.length, 0, "the guard must not run for preflight");
    assertStrictEquals(spy.calls.length, 0, "no provider call");
  });
});

Deno.test("PDR4e the guard still runs before req.json() and before the provider", async () => {
  // The new output path sits far below the guard, and this is what fails if a
  // future edit ever hoists body parsing or the provider call above it.
  const { deps: authz, calls } = makeAuthzDeps({
    checkPermission: () => Promise.resolve({ kind: "denied" }),
  });
  await withFetchSpy(async (spy) => {
    const { req, json } = spyRequest("https://edge.test/refine-story", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...AUTH_HEADER },
      body: JSON.stringify(refinePayload()),
    });
    const res = await createHandler(deps({ authzDeps: authz }))(req);

    assertStrictEquals(res.status, 403);
    assertEquals(await res.json(), { success: false, code: "FORBIDDEN" });
    assertStrictEquals(json.calls, 0, "req.json must not be called");
    assertStrictEquals(spy.calls.length, 0, "fetch must not be called");
    assertEquals(calls.map((c) => c.kind), ["getUser", "checkPermission"]);
  });
});
