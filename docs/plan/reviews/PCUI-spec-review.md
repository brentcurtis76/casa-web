# CODEX SPEC REVIEW — PC-UI — warnings UI + error parsing + T-D.13

**VERDICT: EXECUTABLE WITH THE TEXT BELOW**

The phase objective and topology are correct, but the draft is not executable verbatim. The
request cannot supply an honest all-research-failed denominator, `source:code` is not a unique
warning identity, and the T-D.13 persistence citations point at caller-side editor code rather
than the actual serialization/reload seam. The G-texts and acceptance criteria below replace the
draft decisions and T-U.1–T-U.9.

## Review basis and independent verification

- FE target: `pg-fix-d3fbd58`@`1b0cfed870ba2dbcd39cb9deabb9804542aca569`.
- Read-only edge reference: `phase/pb-storage-edge`@
  `10d1190321246595de14d55815804900670c1983`.
- `5f7b6bd` is an ancestor of the FE target; `db42745` is an ancestor of the edge target. The FE
  and edge targets are separate lineages with merge-base `2e9eeae`; neither is silently based on
  the other.
- I ran `jb list` before any worktree inspection. I did not check out a protected ref, create an
  executor branch, edit repository code, merge, push, deploy, or call a provider. Code evidence
  came from `git show` at the two pinned SHAs. The Node gate was rerun from a `git archive`
  snapshot of `1b0cfed`, not from an ambient repository working tree.
- Under Node `v22.22.0`, the pinned FE snapshot independently produced 66 files, 824 tests,
  818 passed / 6 failed; the six are exactly the named `MesaAbiertaDashboard` failures. TypeScript
  produced 1041 diagnostics. ESLint produced 159 problems (116 errors / 43 warnings). The fixture
  blob is `70204600a10ad1e43595da9a93856b4a6b34b459`.
- The PM's edge envelope/type account, zero FE warning consumption, shared invoke-error seam,
  four invoke callers, PFE notice semantics, broken response mapper, and top-level/per-entry
  `INVALID_IMAGE_REF` distinction are otherwise confirmed.

## STRIKES

Each strike below quotes the text to remove. The PM must verify each against the pinned code
before applying it.

### [S1] Strike the false persistence-location citation

Strike:

> `editorStateV1 write :3441-3495, restore :1318`

`CuentacuentoEditor.tsx:3441-3495` derives the authoritative patch, including its redundant
`landmarkVisible` record; it does not serialize `editorStateV1`. The actual write is in
`useCuentacuentosDraft.ts:1122-1160`, where the clean story and embedded `editorStateV1` are
built. Actual load/reconciliation is at `useCuentacuentosDraft.ts:1345-1365,1491-1519`; the
editor then consumes the loaded story at `CuentacuentoEditor.tsx:1244-1266`. Editor line 1318 is
only the beginning of a comment about restoring extended UI buffers. The broader premise remains
true and T-A3.5 pins it; only the cited seam was false.

### [S2] Strike the false warning-key uniqueness premise

Strike:

> `keyed source:code`

The edge emits one entry per failed research result. Two props, or two landmarks, can therefore
produce the same `source` and `code`; `source:code` is not a unique React key. Preserve response
order and multiplicity and use an occurrence-safe key (for example source + code + array index).
Do not deduplicate distinct server entries merely to manufacture key uniqueness.

### [S3] Strike the request-derived all-failed denominator

Strike:

> `derive "attempted research" from the request the editor just sent (location non-empty ⇒ location research; landmark research ditto; props-with-photos count ⇒ analysis calls) and banner when failures cover every attempt`

The final research set depends on server-side materialization. A requested prop/landmark can lose
all usable images to 404, timeout, unsupported bytes, size, or aggregate-budget degradation;
`analyzeImagesForVisualDescription` then returns `NO_IMAGES`, makes no provider call, and emits no
warning. The client sees the request and a failures-only warning array, not that post-materialize
denominator. Counting requested photo-bearing entities would classify some skipped analyses as
successful or failed when neither is true.

## BINDING G-TEXTS

### G1 — Base, topology, scope, and sequencing

Create one frontend branch, `phase/pcui-warnings`, from
`pg-fix-d3fbd58`@`1b0cfed`. There is no PC-UI edge branch. The edge contract at
`phase/pb-storage-edge`@`10d1190` is a read-only contract reference and is not changed, merged,
or deployed in this phase. PH is sequenced after PC-UI and must branch from PC-UI's reviewed
closing tip because both phases edit `CuentacuentoEditor.tsx`.

Permitted production changes are `src/lib/cuentacuentos/imageFeedback.ts` and
`src/components/liturgia-builder/editors/CuentacuentoEditor.tsx`. Focused tests and a purely
additive external-boundary test control are permitted if needed. No production persistence,
pipeline, task-factory, storage, lifecycle, `supabase/**`, PH, or refine-story contract change is
authorized. The existing PFE scene-path skipped-notice behavior remains frozen.

### G2 — Exact warning type and the single parser

Define and export the client warning shape from `imageFeedback.ts`:

```ts
export type WarningSource = 'location' | 'landmark' | 'prop' | 'story';

export interface EnvelopeWarning {
  source: WarningSource;
  code: string;
  message: string;
  httpStatus?: number;
  finishReason?: string;
}
```

`parseWarnings(value: unknown): EnvelopeWarning[]` is the only warning parser. It accepts only an
array. An entry survives only when it is a non-array object, `source` is one of the four closed
values, and `code` and `message` are non-blank strings. An optional `httpStatus`, when present,
must be a finite number; optional `finishReason`, when present, must be a string. A bad optional
field makes that entry malformed. Unknown properties are ignored and not copied. Invalid entries
are dropped without throwing; absent/non-array input returns `[]`.

Sources are closed because a new source changes UI meaning. Codes are intentionally
forward-compatible: any non-blank code is accepted for a known source because the server's
`message`, not a client code table, is authoritative. The parser preserves server order and
multiplicity, including repeated source/code pairs.

### G3 — Exact InvokeError extension and one consumption seam

Extend `InvokeError` exactly with:

```ts
readonly warnings: EnvelopeWarning[];
```

Its constructor receives `warnings: EnvelopeWarning[]`, and `buildInvokeError(status, body)`
sets it by calling the single `parseWarnings(b.warnings)`. Existing `status`, `code`, `field`,
`skippedImages`, refine-specific copy, and generic `Error <status>: <detalle>` behavior remain
unchanged.

`extractInvokeError` remains the sole `FunctionsHttpError.context` reader and retains defensive
`ctx.clone().json()` handling. Non-JSON, rejected JSON, or a throwing/consumed clone yields a
status-only `InvokeError` with `warnings:[]`; it never crashes. Because all four invoke sites
already call this function, none receives a second body parser. Success and preview handlers call
the same exported `parseWarnings(data.warnings)`; they do not open-code a validator.

### G4 — Warning state, notice placement, and lifecycle

Add warning state distinct from `skippedImages`. Render one non-blocking amber notice as a sibling
of the PFE skipped-images block in the editor's shared container, before `renderCurrentStep()`.
The fixed Spanish heading is **`Avisos de la generación`**. The notice uses `role="status"` and
`aria-live="polite"`, lists each accepted server `message` verbatim, and has a manual dismiss
control labeled **`Ocultar avisos de la generación`**. It does not derive copy from source/code,
interpolate request/provider fields, or substitute the story warning with a client constant.

Preview warnings use this same shared notice, above/outside the config step and prompt-preview
panel; there is no preview-only warning state or notice inside the prompt panel.

Every completed `generate-story` attempt—normal generation or prompt preview—replaces the whole
warning state on success or error. No warnings, malformed-only warnings, a non-HTTP/network error,
or an unreadable body replaces it with `[]`; warnings never accumulate across story attempts.
Manual dismissal clears it. Successful story deletion and the explicit regenerate/reset action
also clear it so an abandoned story's warning cannot survive into a new lifecycle. Scene-image
calls continue to affect only the existing `skippedImages` channel.

### G5 — Envelope coverage and notice/error coexistence

Consume warnings from successful story responses, successful preview responses, and
`InvokeError` bodies. The error path is status-agnostic and therefore covers typed 400, 422, and
502 plus generic 500 bodies. When an error body contains warnings, the shared notice and the
existing red error surface are both visible; neither replaces the other. An omitted warning key
renders no notice. `source:'story'` / `PROP_NOT_RECURRING` renders the exact server message like
every other accepted warning.

### G6 — All-failed product deviation

PC-UI does **not** implement an all-research-failed banner or any request-derived denominator.
Mixed degradation and all failures use the same non-blocking notice, with no severity, title,
color, or copy distinction. This is the recorded product deviation from PLAN-review [P4] for
Brent: the current response cannot support the distinction honestly. If Brent later wants it,
the edge must add an explicitly reviewed summary/denominator contract in a separate phase. No
such field or edge change rides in PC-UI.

### G7 — T-D.13 production behavior

In the structured `data.scenes` mapper, preserve only boolean values with the optional-field
semantics intact:

```ts
...(typeof scene.landmarkVisible === 'boolean'
  ? { landmarkVisible: scene.landmarkVisible }
  : {})
```

Both `true` and `false` must survive; absent/malformed values must not be coerced. No production
persistence or request-builder change is expected: the hook already persists/reloads the field,
and both normal/custom scene-data branches already forward it.

One new real-editor integration must carry a contract-valid mocked `generate-story` response
containing at least one `true` and one `false` through the production response mapper, production
Story, a production-hook draft write, an actual unmount/remount and draft recovery, and the
subsequent real editor action that invokes `generate-scene-images`. The recorded external-boundary
request bodies must contain the corresponding booleans. It must prove that persistence/reload
actually occurred rather than remounting from a prebuilt `initialStory`.

### G8 — T-D.13 evidence split and severing mutations

The real-editor chain in G7 is the integration bar. The retained T-A3.5 hook test remains
unchanged and required; it continues to pin the clean-story/`editorStateV1` round-trip but cannot
substitute for the editor chain. Existing task-factory tests likewise remain useful but cannot
prove that the editor supplied the field.

Required D7 evidence:

1. Base-red at `1b0cfed`: the new real-editor chain fails because the response mapper drops both
   booleans.
2. `M-D13-RESPONSE`: remove the mapper spread after the fix; the real-editor chain fails.
3. `M-D13-ROUNDTRIP`: after the production hook's load reconciliation, strip
   `landmarkVisible` from returned story scenes; the real-editor chain and retained T-A3.5 fail.
4. `M-D13-REQUEST`: remove the `landmarkVisible` spread from the normal scene request builder;
   the real-editor chain fails at the external invoke body.
5. `M-D13-PRECONDITION`: make the remount boundary return no persisted draft; the real-editor
   case must fail before its request assertion. This proves the reload portion is load-bearing.

All mutations are temporary, named, reverted, and followed by a clean tracked-state check.

### G9 — Exact PFE-F3 closure

Close PFE-F3 with positive consumer behavior, not a source-text grep:

- A top-level 400 `CLIENT_INPUT_INVALID` `generate-story` FunctionsHttpError with a unique
  Spanish `error` detail must reach the production editor's red surface exactly as
  `Error 400: <detalle>` through `extractInvokeError` → `buildInvokeError`.
- A top-level `INVALID_IMAGE_REF` code remains ordinary top-level error metadata: its backend
  `error` detail follows the same generic message path. It does not call
  `describeSkippedImage`, select the per-entry `REASONS.INVALID_IMAGE_REF` copy, or otherwise
  receive a top-level branch.
- `INVALID_IMAGE_REF` inside `skippedImages[]` continues to use the existing per-entry Spanish
  copy. That is the only code-based consumer of this value.

Required existing-true D7 mutations are: `M-F3-DETAIL`, discard `body.error` in
`buildInvokeError`; and `M-F3-TOPLEVEL`, add a forbidden top-level `INVALID_IMAGE_REF` message
branch. The focused unit checks and the real-editor 400 case must turn red as applicable.

### G10 — Test boundary, hygiene, gates, and residuals

Parser/type behavior may be proved in `imageFeedback.test.ts`. Every component-level claim—DOM
placement, preview, replace semantics, error coexistence, lifecycle clearing, PFE-F3 surface, and
T-D.13—must render the production `CuentacuentoEditor` and use the production
`useCuentacuentosDraft`, `imageFeedback`, parser, invoke-error seam, task factories, and toast
hook. Only external Supabase/auth/table/storage/function boundaries, browser primitives, and
timers may be mocked. A mocked hook/parser/editor wrapper or assertion over source/import text
does not meet this bar.

All client-owned copy is Spanish. Warning fixtures plant unique request/provider/extra-field
tokens and prove those do not render; an unknown code with a safe server message proves the UI
uses the message rather than the code. No log, live provider call, Playwright surface, or wire
change is part of the phase.

D6 is measured base and head under Node `v22.22.0` with serial Vitest. Base is 824 total / the
named Mesa six, TypeScript 1041 diagnostics, and ESLint 159 problems (116/43). Head may add tests
but may have only the same six failures and zero new TypeScript/ESLint identities. The fixture
blob stays `70204600a10ad1e43595da9a93856b4a6b34b459`; `supabase/**` diff is empty. Relevant
PFE/PB/PG suites and retained T-A3.5 stay green. Any regression is a finding, not authority to
patch those frozen phases. No merge, push, deploy, or infra action occurs (D9).

## REPLACEMENT ACCEPTANCE CRITERIA

These replace draft T-U.1–T-U.9 in full.

- **T-U.1 — Parser contract.** Unit tests cover every known source, both edge shapes, optional
  fields present/absent, unknown non-blank codes, extra-property stripping, order and duplicate
  preservation, mixed valid/invalid arrays, unknown source, blank/wrong required fields, wrong
  optional fields, non-array, null, and absent values. New parser/type tests are base-red at
  `1b0cfed`.
- **T-U.2 — InvokeError seam.** `buildInvokeError` carries parsed warnings without changing its
  existing status/code/field/skipped/refine/message behavior. Realistic context bodies at 400,
  422, 502, and 500 parse through production `extractInvokeError`; non-JSON, rejected JSON,
  throwing clone, and absent context never crash and produce status-only/no-warning behavior.
  Severing `buildInvokeError` → `parseWarnings` turns the focused tests red.
- **T-U.3 — Success notice.** A successful generation with research warnings renders the shared
  Spanish status notice and exact server messages; `source:'story'` renders its exact fixed
  message; absent/empty warnings render no notice. Manual dismissal removes it. DOM claims run
  through the real editor.
- **T-U.4 — Replacement and lifecycle.** Consecutive completed story attempts prove warning →
  empty clears, warning A → warning B replaces rather than appends, and warning → network/non-JSON
  error clears while the error remains visible. Regenerate/reset and successful delete clear the
  warning state. Scene-image responses do not alter it.
- **T-U.5 — Preview.** A successful prompt preview with warnings opens the real preview and
  renders the same shared notice outside/above the prompt panel. A following preview or normal
  generation replaces it under T-U.4. Preview error bodies use the same InvokeError warning
  path. Moving the notice inside the preview panel or adding a separate preview state fails.
- **T-U.6 — Error coexistence.** Real-editor cases for typed 400/422/502 and generic 500 bodies
  assert that accepted warnings and the exact existing error surface coexist. Omitted/malformed
  warnings do not manufacture a notice. A mutation that handles only 502 or only typed bodies
  fails.
- **T-U.7 — Forward code, multiplicity, and hygiene.** Known source + unknown code + safe Spanish
  message renders that message verbatim. Two identical source/code entries both render without a
  duplicate React-key warning. Planted request/provider/unknown-property tokens do not render.
  Mutating the UI to derive from code/source, interpolate extras, deduplicate, or key only by
  source/code fails.
- **T-U.8 — No all-failed distinction.** Mixed and all-warning fixtures render the same heading,
  role, color, and non-blocking structure. No client denominator, special banner, or edge field
  exists. A mutation adding request-count severity logic fails this criterion.
- **T-U.9 — T-D.13 real-editor chain.** One contract-valid response with both boolean values
  traverses production response mapping → Story → production persistence → real reload → actual
  scene-image invokes. The persisted payload, recovered editor state, and final invoke bodies are
  each observed at external boundaries. The test has no `initialStory` shortcut on remount.
- **T-U.10 — T-D.13 evidence.** Base-red and all five G8 proofs are recorded. T-A3.5 remains
  byte-unchanged and green normally, turns red under `M-D13-ROUNDTRIP`, and is reported as
  supporting—not replacing—the real-editor chain. Existing task-factory tests remain green.
- **T-U.11 — PFE-F3 closure.** The production editor surfaces a unique Spanish top-level 400
  `CLIENT_INPUT_INVALID` detail exactly through the real context parser. Focused tests prove a
  top-level `INVALID_IMAGE_REF` also preserves backend detail while a per-entry one uses
  `describeSkippedImage`. `M-F3-DETAIL` and `M-F3-TOPLEVEL` fail. No source grep is counted as
  consumer evidence.
- **T-U.12 — Gates and scope.** All focused suites, relevant PFE/PB/PG suites, retained T-A3.5,
  full serial Vitest, TypeScript identity diff, and ESLint identity diff meet G10. Production diff
  is confined to G1; `supabase/**` is empty; the fixture blob is unchanged; all base-red/mutation
  logs name the exact SHA, runtime, mutation, failing assertion, revert, and clean-state check.

## FINAL ANSWERS TO Q1–Q7

### Q1 — Base/topology

**CONFIRM with G1.** One FE branch `phase/pcui-warnings` from `1b0cfed`; no edge branch; edge
`10d1190` is read-only; PH waits for the reviewed PC-UI tip and continues from it.

### Q2 — Placement and semantics

Use one sibling notice in the shared container, adjacent to the existing skipped-images notice
and before the current step. Replace the entire warning set after every completed
`generate-story` attempt, including preview and error. Preview warnings render in that shared
notice above/outside the prompt-preview panel, not inside it. Preserve multiplicity, use
occurrence-safe keys, provide manual dismissal, and clear on story reset/delete.

### Q3 — Parser tolerance and InvokeError shape

Sources are closed to `location|landmark|prop|story`; codes are forward-compatible non-blank
strings. Required and optional field rules, sanitization, order/multiplicity, and the exact
`InvokeError.warnings: EnvelopeWarning[]` extension are G2/G3. There is one parser in
`imageFeedback.ts`; both `buildInvokeError` and success/preview consumers call it.

### Q4 — All-failed banner

Drop the distinction and record G6's product deviation for Brent. The client cannot derive the
post-materialization denominator. PC-UI adds neither request-derived inference nor edge data. A
future stronger banner requires a separately reviewed additive edge contract.

### Q5 — T-D.13 evidence

G7's real-editor end-to-end test is mandatory. T-A3.5 remains unchanged as the focused
persistence/reload unit layer; task-factory tests remain supporting unit evidence. Neither
replaces the component chain. The link mutations are response mapper, hook reload result, and
scene request builder, plus the reload-precondition mutation; exact forms are in G8.

### Q6 — PFE-F3 closure

The exact closure is G9/T-U.11: a real 400 `CLIENT_INPUT_INVALID` editor surface through the
production context parser, positive top-level detail passthrough for `INVALID_IMAGE_REF`, retained
per-entry code copy, and the two named existing-true mutations. A grep claiming no top-level read
does not close it.

### Q7 — Completeness

T-U.1–T-U.12 replace the draft set. The additions the draft missed are duplicate warning
identity/multiplicity, lifecycle clearing, full 400/422/502/500 component coverage, explicit
sanitization of unknown properties, load-bearing reload preconditions, the unit-versus-real-editor
split, exact PFE-F3 mutations, accessibility, and correct head-versus-base D6 semantics.

## FINAL CLOSE

With [S1]–[S3] PM-verified and applied, and G1–G10 plus T-U.1–T-U.12 incorporated as the
authoritative PC-UI spec, the phase is **EXECUTABLE**. Without that replacement text, it is not.
This spec review is outside the executor-review cap; the first executor-branch review remains
round 1 under the operating gates.
