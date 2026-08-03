CODEX SPEC REVIEW — PD — vs phase/pc-research@96cb2cc

VERDICT: EXECUTABLE WITH THE TEXT BELOW

The draft has the right phase objective, but it is not executable verbatim. G1's premise about
a caller-supplied scene count is false, G4's corpus-stub premise is false, and the current
Anthropic contract requires explicit stop-reason and enum-casing defenses around strict mode.
The decisions and acceptance criteria below replace the draft's unresolved gap block.

## SCOPE BOUNDARY

**Base/branch:** `phase/pd-contract` from `phase/pc-research`@`96cb2cc`.

**In scope:** `supabase/functions/generate-story/handler.ts`; focused
`generate-story` contract tests; and the fidelity-only Anthropic story fixture in
`supabase/functions/_shared/corpusRunner.ts`. `corpus_baseline.json` is read-only. The stale
research-cap rationale comment at `handler.ts:70-72` is corrected while this file is already
open.

**Out of scope:** all `src/**`; `refine-story` (G6); image collection/materialization; research
model, thinking, cap, retry, and warning semantics already closed by PC; storage; scene-image
generation; deploys; and live provider calls. PD is edge-only. `index.ts` changes only if
strictly required by a type/import move; no environment or model change is authorized.

**Contract boundary:** PD validates only the story returned by Anthropic. PF image errors retain
their existing statuses/codes. Anthropic HTTP non-2xx transport/API handling is not silently
reclassified as provider-output validation. A later change to those errors needs its own
criterion.

## G1 — SCENE COUNT

### DECISION

There is no requested scene count in either live `generate-story` request body. At
`cc-downscale-a`@`185c370`, `CuentacuentoEditor.getRequestBody()` sends context, location,
characters, style, notes, and props; at `phase/pc-research`@`96cb2cc` it sends the same shape.
The only `sceneCount` found in the live frontend lineage is `StoryIndexEntry.sceneCount`, which
is saved-story metadata, not generation configuration. The product rule therefore remains
server-owned: request exactly 15 scenes and accept the established 12–16 tolerance.

### PASTE-READY SPEC TEXT

**Scene-count contract:** live callers send no scene-count parameter. `generate-story` requests
exactly 15 scenes in its server-owned prompt and accepts any provider result with 12–16 scenes
inclusive. A result with 12, 13, 14, 15, or 16 scenes is valid without a count warning. A result
with fewer than 12 or more than 16 scenes is provider-invalid and returns 502
`PROVIDER_OUTPUT_INVALID`; the handler must not pad, truncate, merge, or invent scenes. Adding a
caller-selected count later is a new request/response contract and is outside PD.

After the count check, scene numbers must be integers whose set is exactly `1..N`. Input order may
differ; valid scenes are returned sorted by number. Duplicate, missing, fractional, zero,
negative, or out-of-range scene numbers are fatal provider-output errors, not normalization
opportunities.

## G2 — EDGE/UI SPLIT

### DECISION

PD is edge-only. Fold the frontend work into the existing `PC-UI` prerequisite because it already
owns parsing/rendering the `warnings` envelope on the PFE/PA lineage and touches the same editor
and error parser. Do not create a second overlapping `PD-UI` branch.

T-D.13 is removed from PD acceptance. It becomes a `PC-UI` acceptance criterion: a mocked
`generate-story` response with both `landmarkVisible:true` and `false` must preserve those values
when building `Story.scenes`, through persistence/reload, and into the subsequent
`generate-scene-images` scene request. The edge-only PD branch may assert that it returns the
boolean; it may not claim the frontend mapping is end-to-end.

### PASTE-READY SPEC TEXT

**Frontend disposition:** PD changes only `supabase/functions/**`. Extend the already-required
`PC-UI` follow-up to (a) parse/render both research and story-normalization warnings on success
and non-2xx envelopes, and (b) preserve `landmarkVisible` from `generate-story` response →
`Story.scenes` → persisted/reloaded story → `generate-scene-images` request. Prior-plan T-D.13
belongs to `PC-UI`, not PD, and PREL cannot claim it from the edge tests.

## G3 — EXACT 502 ENVELOPE AND CONTRACT COUPLING

### DECISION

Use one public provider-output code and three Spanish messages selected by an internal reason.
Do not expose provider text, parsed values, validation paths, or raw stop reasons. Preserve
degradation accumulated before Anthropic output validation.

### PASTE-READY SPEC TEXT

**Typed errors and response mapping:**

- `ProviderOutputError` is internal and carries one of `REFUSAL`, `MAX_TOKENS`, or
  `INVALID_STORY`. It is mapped inside the handler to HTTP 502. It is never re-thrown into the
  generic 500 catch.
- `ClientInputError` is internal. Malformed JSON maps to 400; a syntactically valid request
  missing required client fields such as `context` or non-empty `location` maps to 422. Both use
  `code:"CLIENT_INPUT_INVALID"`. Existing more-specific PF image 4xx responses remain unchanged.
- Unexpected implementation failures remain 500. A provider HTTP non-2xx response retains its
  pre-PD behavior unless a separately reviewed criterion changes it.

The exact provider-output envelope is:

```json
{
  "success": false,
  "code": "PROVIDER_OUTPUT_INVALID",
  "error": "<one fixed Spanish message>",
  "skippedImages": [{"field": "<safe field path>", "code": "<PF code>"}],
  "warnings": [{"source": "<closed source>", "code": "<closed code>", "message": "<Spanish>"}]
}
```

`skippedImages` is included only when non-empty and retains PF's existing
`{field,code}` elements. `warnings` is included only when non-empty and, on a 502, contains only
warnings already established before output validation (for example PC research degradation).
Story-normalization warnings are appended only when the story succeeds. Empty optional keys are
omitted. The fixed messages are:

- `REFUSAL`: `El proveedor rechazó generar el cuento. Ajusta las notas y vuelve a intentarlo.`
- `MAX_TOKENS`: `El proveedor cortó el cuento antes de completarlo. Usa notas más breves y vuelve a intentarlo.`
- `INVALID_STORY`: `El proveedor devolvió un cuento con una estructura inválida. Vuelve a intentarlo.`

**Story warning extension:** a recurring prop with fewer than two valid scene references is
dropped on an otherwise valid story and adds exactly:

```json
{
  "source": "story",
  "code": "PROP_NOT_RECURRING",
  "message": "Se omitió un elemento recurrente porque aparece en menos de dos escenas válidas."
}
```

The message never includes the provider's prop name or text.

**CONTRACT-COUPLED:** PFE already consumes `skippedImages` from non-2xx invoke bodies; PD must not
rename, reshape, or suppress it on 502. `PC-UI` must extend its warning parser to accept
`source:"story"` / `code:"PROP_NOT_RECURRING"` and must parse `warnings` from both successful data
and `FunctionsHttpError.context` bodies. Any change to these fields after PD reopens the
corresponding PFE/PC-UI consumer check.

## G4 — CORPUS IMPACT

### DECISION

The draft's “corpus stub returns a valid story” statement is false. At `96cb2cc`,
`corpusRunner.ts:60-71` returns a text fallback containing one scene, no character role, and no
`props`. Five non-preview story cases currently record status 200 and would become 502 under the
new validator; the preview case never calls Anthropic.

This is fixture drift, not an intended product divergence. Upgrade only the shared Anthropic
stub to a normal successful strict-tool response: `stop_reason:"tool_use"`, one
`tool_use` block named `emit_story`, and schema-valid input containing 15 numbered scenes,
exactly one protagonist, non-empty required fields, and `props:[]`. Provider-call counts and all
captured outcomes must remain unchanged. Do not re-capture or edit `corpus_baseline.json`
(base/target blob at the PD base: `91ec703355f3584701fe25da484370e4ba57b156`).

### PASTE-READY SPEC TEXT

**Corpus rule:** after the fidelity-only story-stub correction, every captured case must retain
its baseline `status`, `code`, `fetched`, `providerImages`, and `providerCalls`; all six story
cases remain 200. `corpus_baseline.json` is never re-captured for PD. If any captured outcome
still changes, the executor stops and reports a finding. An intentional divergence requires a
case-local `intentional:{status,code,why}` entry naming the old/new behavior and PM/reviewer
approval; changing the baseline to green is forbidden by D5.

## G5 — CURRENT STRICT-TOOL REALITY

### DECISION

Confirmed against Anthropic's current primary documentation on 2026-07-29:

- `strict:true` is a top-level tool-definition property beside `name`, `description`, and
  `input_schema`; on normal tool completion it constrains `tool_use.input` to the schema.
- Structured outputs/strict tools are available for Claude 4.5 and later, which includes the
  pinned `claude-opus-4-5-20251101`.
- The raw REST caller gets no SDK schema transformation. `additionalProperties:false` must be
  explicit on the root story object and each character, scene, and prop object.
- Optional properties are supported and this single schema is well below the documented limit
  of 24 optional parameters.
- Semantic constraints such as trimmed non-empty strings, normalized name uniqueness, exact
  protagonist count, reference integrity, and the 12–16 product window still require
  application validation.
- Strict output has documented exceptions: `stop_reason:"refusal"` and
  `stop_reason:"max_tokens"` can return HTTP 200 and output that does not match the schema.
  Normal client tool completion uses `stop_reason:"tool_use"`.
- Current docs also warn that enum values can differ only in capitalization even under strict
  output. The normalizer therefore compares `role` and `kind` case-insensitively and emits the
  canonical lowercase values. Enums that differ by more than case are invalid.

Primary sources:

- https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works

### PASTE-READY SPEC TEXT

Add `strict:true` to the existing `emit_story` tool and keep the forced
`tool_choice:{type:"tool",name:"emit_story"}`. Make `props` required (`[]` valid), use
`type:"integer"` for scene/reference numbers, and add `additionalProperties:false` to every
object schema. Update the prompt's “exact structure” example to include `props`.

Inspect `stop_reason` before reading content:

1. `refusal` → typed 502 with the fixed refusal message.
2. `max_tokens` → typed 502 with the fixed truncation message.
3. Normal success requires `stop_reason:"tool_use"` and exactly one `tool_use` block named
   `emit_story`; missing, wrong, or multiple story tool blocks are typed invalid-story 502s.
4. Remove the text/regex/`JSON.parse` fallback from the production story path. With a strict,
   forced tool, prose is not a second success protocol.

Strict mode is defense one; `validateAndNormalizeStory` remains defense two for semantic rules
and the documented exceptional outputs. It returns a discriminated result:

```ts
type StoryValidationResult =
  | { ok: true; story: StoryOutput; warnings: StoryNormalizationWarning[] }
  | { ok: false; errors: Array<{ code: string; path: string }> };
```

Validation error values are internal. Logs may contain only safe validation codes/paths and
counts, never provider values or serialized output.

## G6 — REFINE-STORY

### DECISION

Defer explicitly: `refine-story` is outside PD and gets a named `PD-REFINE` release prerequisite
before PREL, because it has a different response (`refinementNotes`), text-JSON protocol, and
conflicting live scene-count instructions (same/similar 12–16 versus the `length` mode's 10–18);
reusing PD's count rule without a separate product decision would reject or silently reshape
existing refinement flows. PD makes no claim that refined stories are validated.

### PASTE-READY SPEC TEXT

**`PD-REFINE` follow-up (release prerequisite):** define refinement-specific scene-count and
image/ID-preservation semantics, then apply typed provider-output validation to
`refine-story`. It must receive its own D5 caller-shape check and D7 tests. Until it closes,
PD's strict-output guarantee applies only to initial `generate-story` output.

## ACCEPTANCE CRITERIA

- **[PD1] Strict request and schema pin.** The mocked Anthropic request contains exactly one
  `emit_story` tool with top-level `strict:true`, forced `tool_choice`, `props` in root
  `required`, integer scene/reference numbers, and `additionalProperties:false` at root and
  every character/scene/prop object. `props:[]` is representable. The prompt example also
  contains `props`. **D7:** base-red at `96cb2cc` must show the missing strict/AP/required pins;
  recorded mutations removing any nested AP pin, removing `props` from `required`, or changing
  an integer schema back to `number` must fail this criterion.

- **[PD2] Stop-reason protocol and no fallback.** `tool_use` plus exactly one matching block is
  the only success protocol. `refusal`, `max_tokens`, `end_turn`/missing reason, no story tool,
  wrong name, multiple story tools, and prose/malformed JSON without a tool all return 502
  `PROVIDER_OUTPUT_INVALID`; refusal and truncation use their distinct fixed Spanish messages.
  **D7:** base-red proves current 500/fallback behavior; mutations that parse text fallback,
  check content before `stop_reason`, or collapse refusal and truncation copy must fail.
  (Rebases T-D.10/T-D.11.)

- **[PD3] Required semantic story fields.** `props` omitted is 502; `props:[]` is valid.
  `title`, `summary`, `spiritualConnection`, and every character's
  `name/description/visualDescription` are strings non-empty after trim. There is at least one
  character and exactly one canonical `protagonist`. Character names are trimmed for display
  and unique by `NFKC → trim → collapse internal whitespace → toLocaleLowerCase("es-CL")`;
  `" Ana "` and `"ana"` collide. Role casing is normalized to the lowercase enum, but other
  values fail. **D7:** base-red covers each class; mutations removing trim, uniqueness, or exact
  protagonist count must fail. (Rebases T-D.1/T-D.2/T-D.6/T-D.7/T-D.8.)

- **[PD4] Scene window and numbering.** Counts 12 and 16 succeed; 11 and 17 return typed 502.
  A valid out-of-order `1..N` set is sorted. Duplicate, missing, fractional, zero, negative, or
  out-of-range scene numbers return 502. Every scene has trimmed non-empty `text` and
  `visualDescription`; optional `landmarkVisible`, when present, is boolean. No scene-count
  request field is introduced and no story is padded/truncated. **D7:** base-red at `96cb2cc`
  uses the current one-scene acceptance and broken-number cases; mutations widening a bound or
  skipping set equality must fail. (Rebases T-D.4/T-D.5.)

- **[PD5] Reference arrays and prop normalization.** Optional
  `characters[].appearsInScenes`, when present, contains unique in-range integers and is sorted;
  non-array, fractional, duplicate, or out-of-range values are fatal. Optional
  `scenes[].charactersInScene`, when present, is unique under the character-name key and every
  value resolves to a declared character; accepted values are rewritten to the declared display
  name. Each prop has non-empty `name/narrativeRole/visualDescription`, canonical lowercase
  `kind`, and an integer `sceneNumbers` array. Only duplicate and out-of-range prop scene
  numbers are dropped/sorted. A prop with two or more remaining numbers survives; one with fewer
  than two is dropped and adds exactly one `story:PROP_NOT_RECURRING` warning. A fractional or
  non-number prop reference is fatal rather than silently coerced. **D7:** base-red covers the
  malformed arrays and missing warning; mutations removing integer/range/name-reference checks
  or keeping a one-scene prop must fail. (Rebases T-D.3/T-D.9/T-D.14.)

- **[PD6] Typed status and exact envelopes.** Every provider-output failure in [PD2]–[PD5] is
  502 with exactly `success:false`, `code:"PROVIDER_OUTPUT_INVALID"`, fixed Spanish `error`, and
  conditional non-empty `skippedImages`/`warnings`. Tests cover: both additive fields together;
  each alone; both absent; and a planted provider token absent from response and logs. Malformed
  JSON is 400 client input; missing required request fields are 422 client input; neither is
  mislabeled provider output. Unexpected errors remain 500. **D7:** base-red proves the current
  500/no-code path; mutations reverting 502 to 500, dropping either additive field, exposing
  validation/provider values, or throwing typed errors into the generic catch must fail.
  (Rebases T-D.12 and the corrected T-D.1 status rule.)

- **[PD7] Warning aggregation.** On success, normalization warnings append after existing PC
  research warnings without changing the existing research entries or order; omit `warnings`
  only when the combined list is empty. On a rejected story, do not emit normalization warnings
  from the discarded story, but retain pre-Anthropic research warnings. **D7:** base-red proves
  no story warning exists; mutations replacing rather than appending PC warnings, leaking the
  prop name into copy, or retaining normalization warnings on a rejected story must fail.

- **[PD8] Corpus honesty and parity.** The Anthropic corpus stub is a valid 15-scene
  `tool_use` response. All six story cases retain their captured 200 status and every complete
  corpus outcome remains equal to the untouched baseline; the baseline blob stays
  `91ec703355f3584701fe25da484370e4ba57b156`. **D7:** this is coverage infrastructure already
  green at base, so use the exception: mutate the upgraded stub to one scene, omit `props`, or
  remove the protagonist role and show that the PD corpus comparison fails. No re-capture is an
  admissible fix.

- **[PD9] Frontend claim boundary.** PD edge tests prove `landmarkVisible` survives validation
  and the success response only. T-D.13 is not counted as PD green; the full response →
  `Story.scenes` → persistence/reload → scene-image request proof is added to `PC-UI`.
  **D7:** the later PC-UI wiring test must fail under mutations that drop the field in either
  the response mapper or the scene request builder.

- **[PD10] Gates and evidence.** Runtime is Deno `2.7.11`. Baseline at `96cb2cc`, independently
  rerun during this spec pass: `deno test --allow-all .` = **195 passed / 0 failed**;
  `deno lint .` = **95 problems**; `deno check .` = **46 diagnostics**. Executor runs the
  canonical commands from `supabase/functions/`, records every [PD1]–[PD9] base-red/mutation
  proof, and produces zero new lint/check identities under D6. Touched files pass
  `deno fmt --check`. No live Anthropic or Gemini call is part of PD.

**Seed mapping:** T-D.1→PD3/PD6; T-D.2→PD3; T-D.3→PD5; T-D.4/T-D.5→PD4;
T-D.6/T-D.7/T-D.8→PD3; T-D.9/T-D.14→PD5; T-D.10/T-D.11→PD2/PD6;
T-D.12→PD6; T-D.13→PC-UI, explicitly not PD.

## STRIKE/TIGHTEN

- Strike the gap premise “The editor carries a scene-count config” and any executor direction to
  add or honor a requested count. It is contradicted by both live request bodies.
- Strike “the corpus stub returns a valid story.” Replace it with G4's fidelity correction and
  no-recapture rule.
- Strike “the outer catch re-throws typed.” Typed errors must be mapped to `Response` inside the
  handler; rethrowing is the current route to an incorrect 500.
- Strike the production text/regex/`JSON.parse` success fallback. It defeats the single strict
  protocol and is unnecessary with forced strict tool use.
- Tighten `validateAndNormalizeStory(...): {story,warnings,errors}` to the discriminated result
  in G5 so callers cannot accidentally use a story that also has fatal errors.
- Tighten “integer, unique, in-range reference arrays” by distinguishing fatal reference
  corruption from the one authorized lossy rule: only duplicate/out-of-range **prop**
  `sceneNumbers` are dropped; fractional/wrong-type entries and invalid character references are
  fatal.
- Tighten the warning contract to the exact `source:"story"` union member and fixed Spanish copy
  in G3; do not overload PC's existing `source:"prop"` research meaning.
- Move T-D.13 and all `src/**` changes to the expanded `PC-UI` prerequisite; PD cannot claim them.
- Name `PD-REFINE` as a release prerequisite rather than implying `refine-story` parity.

NOTES (non-verdict): The current handler prompt says its exact JSON structure omits `props` while
the prose separately describes props. PD must make those two representations agree. Also retain
the planned stale cap-comment correction; it is comment-only and naturally rides the same
handler edit.
