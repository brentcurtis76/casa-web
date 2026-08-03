CODEX REVIEW — PD ROUND 1/2 — phase/pd-contract@f3d25fc

VERDICT: FAIL

The main strict-tool implementation is sound, the corpus substitute is honest, and R1–R7 are
accepted. One consolidated remediation is nevertheless required before round 2: HTTP-200
Anthropic bodies that cannot be parsed as a message currently bypass
`ProviderOutputError`, return 500, and can echo provider-controlled text to the client. The
same remediation must add the missing exact status/code assertion for R3's body-stream
interruption branch.

## RUNTIME / GATES RE-RUN

Review target: clean `/private/tmp/casa-pd` worktree at `f3d25fc`, direct child of
`96cb2cc`; no live provider calls.

Runtime, verbatim:

```text
deno 2.7.11 (stable, release, aarch64-apple-darwin)
v8 14.7.173.7-rusty
typescript 5.9.2
```

Canonical head gates from `supabase/functions/`, verbatim summaries:

```text
ok | 295 passed | 0 failed (24s)
Found 94 problems
Checked 63 files
Found 46 errors.
GATE_EXIT test=0 lint=1 check=1
```

The non-zero lint/check exits are the captured repository baseline, not new failures. I
independently extracted D6 identities like-for-like:

```text
CHECK_IDENTITY_DELTA_BEGIN
CHECK_IDENTITY_DELTA_END
CHECK_ID_COUNTS base=46 head=46

LINT_IDENTITY_DELTA_BEGIN
error[no-control-regex]: Unexpected control character(s) in regular expression: \x0. @generate-story/handler.ts
LINT_IDENTITY_DELTA_END
LINT_ID_COUNTS base=95 head=94
```

The lint line is left-only in `comm`: one identity was removed and none added. Check identity
is `TS####` paired with its following normalized `file://.../supabase/functions/...`
location; lint identity is the multiplicity-preserving
`rule + message + normalized relative file`, with line/column excluded, exactly as D6
requires.

The base test gate was also rerun:

```text
ok | 195 passed | 0 failed (27s)
BASE_TEST_EXIT=0
```

Focused head suites:

```text
handler_contract_test.ts: ok | 67 passed | 0 failed (29ms)
corpus_parity_test.ts:    ok | 33 passed | 0 failed (79ms)
handler_research_test.ts: ok | 32 passed | 0 failed (9s)
TARGET_EXIT contract=0 corpus=0 research=0
```

`git diff --check 96cb2cc..f3d25fc` is clean. The three new files pass formatting:

```text
Checked 3 files
NEW_FMT_EXIT=0
```

The three pre-existing touched files fail whole-file `deno fmt --check` at both base and
head (`BASE_PREEXISTING_TOUCHED_FMT_EXIT=1`,
`PREEXISTING_TOUCHED_FMT_EXIT=1`), confirming the frozen criterion was not achievable
without unrelated restyling. The PM's line-level comparison records zero newly introduced
format deviations.

Current Anthropic documentation was rechecked on 2026-07-30. It still says that
`strict:true` is a top-level tool-definition property and guarantees schema-valid tool
inputs; the example uses explicit `additionalProperties:false`. It also confirms the
HTTP-200 `refusal` and `max_tokens` exceptions and the enum-casing exception:

- https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works

## RATIFICATIONS: R1–R7

### R1 — ACCEPT

The PD-base snapshot is an honest D5 substitute for the impossible comparison to the older
FASE F baseline. I independently ran the upgraded deterministic runner against the
**untouched `96cb2cc` handlers** and compared every complete outcome to
`corpus_pd_base.json`:

```text
"cases": 30,
"mismatches": 0
```

The comparison covers `status`, `code`, ordered `fetched`, `providerImages`, and
`providerCalls`, not status alone. At head, the committed parity suite independently passes
33/0. `corpus_baseline.json` is absent from the commit delta and recomputes to:

```text
91ec703355f3584701fe25da484370e4ba57b156
```

This proves the relevant property: PD changed no captured corpus outcome. Re-capturing the
older baseline would have been dishonest; the pinned PD-base capture is the correct remedy.

### R2 — ACCEPT

The corrected corpus accounting is exact. My base-side reproduction yielded:

```text
story-minimal                         200
story-preview-prompt-only             200
story-with-prop-photos                200
story-with-many-prop-photos           200
story-builder-with-reference-photo    200
story-builder-at-the-UI-size-limit    413
```

Thus five story cases are 200, the intentional UI-size-limit case is 413 with zero provider
calls, the preview case does not reach Anthropic, and four cases reach Anthropic. PD8d pins
the status facts.

### R3 — ACCEPT

The semantic correction is right: malformed top-level JSON and a body stream interrupted
while being read are client-input failures, not image-reference failures. The remap is
strictly scoped to `generate-story` by the conjunction
`path === "body" && code === "INVALID_IMAGE_REF"`; `_shared/imageFetch.ts` and
`generate-scene-images` are untouched. The observed interrupted-stream envelope is:

```text
400 {"success":false,"code":"CLIENT_INPUT_INVALID","error":"La petición se interrumpió."}
```

This is **CONTRACT-COUPLED**. The opened PFE follow-up remains required. The implementation
also needs the D7 pin named in [B1]: the existing D4 story test asserts JSON/CORS and no
provider calls but does not assert the new `400/CLIENT_INPUT_INVALID` status/code.

### R4 — ACCEPT

Replace the impossible whole-file formatting clause with: every new file passes
`deno fmt --check`, and pre-existing touched files introduce zero new format-deviating
lines. The independent base/head whole-file checks and the PM's line-level measurement
support this substitute. Whole-file restyling would be unrelated churn.

### R5 — ACCEPT

M16 is genuinely redundant. Given `N` entries, the per-entry integer/range check restricts
every accepted number to `1..N`, and the duplicate check requires `N` distinct values; by
cardinality, the set must be exactly `1..N`. Deleting the final size check cannot change
behavior. Keeping it as a documented invariant/net is reasonable, but it must not be cited
as independently mutation-proven.

### R6 — ACCEPT

The `handler_research_test.ts` diff changes only `anthropicStory()` fixture fidelity:
message/tool IDs, `stop_reason:"tool_use"`, 15 valid scenes, and `props:[]`. No PC assertion
or expected warning/status moved. The PC suite remains 32/0, and the four story-producing PC
paths now exercise the real post-PD success protocol instead of failing on an impossible
fixture.

### R7(a) — ACCEPT

Emit one `PROP_NOT_RECURRING` warning per dropped prop. Each prop is a separate loss event;
preserving multiplicity tells the consumer how many recurring elements were omitted. The
fixed identical copy prevents provider-value leakage. Deduplicating would erase that count.

### R7(b) — ACCEPT

Canonicalize enum values by lowercasing only. Current Anthropic docs authorize a
case-insensitive comparison because casing can drift even in strict mode; they do not
authorize whitespace repair. `" protagonist"` differs by more than capitalization and
should fail closed. I additionally probed the implementation: a full-width
`"Ａｎａ"` collides with `"Ana"` under NFKC, while the leading-space role is rejected.

## CRITERIA: [PD1]–[PD10]

- **[PD1] MET.** The captured production request pins one forced `emit_story` tool,
  top-level `strict:true`, root-required `props`, integer scene/reference schemas, and
  `additionalProperties:false` at root and each character/scene/prop object. The prompt
  example now includes `props`, and `props:[]` succeeds.

- **[PD2] NOT MET.** The stop-reason ordering and tool-block protocol are correct for parsed
  message objects, and the production text fallback is gone. But an Anthropic HTTP-200 body
  that is malformed JSON, or valid JSON `null`, fails before the typed protocol gate and
  returns generic 500. See [B1].

- **[PD3] MET.** Required/trimmed prose and character fields, non-empty character list,
  exactly one protagonist, normalized-unique names, NFKC behavior, and lowercase enum
  canonicalization are implemented and exercised through the production handler.

- **[PD4] MET AS AMENDED BY R5.** The 12/16 bounds, 11/17 rejection, no padding/truncation,
  sorting, per-entry integer/range/duplicate checks, trimmed scene prose, and optional
  boolean `landmarkVisible` are covered. The final set-size check is correctly recorded as
  logically redundant rather than mutation-sensitive.

- **[PD5] MET.** Character and scene references are fatal on corruption; only duplicate and
  out-of-range prop `sceneNumbers` are lossily removed. Surviving props require two valid
  references; dropped props warn; fractional/wrong-type references remain fatal.

- **[PD6] NOT MET.** Typed 502 envelopes correctly preserve conditional
  `skippedImages`/`warnings`, fixed Spanish copy, and safe validation summaries on the tested
  paths. The unparsed HTTP-200 provider-body path instead returns 500 and leaks a planted
  provider token in the client error. See [B1].

- **[PD7] MET.** Story warnings append after PC warnings on success, clean responses omit the
  key, and rejected stories discard their own normalization warnings while retaining
  pre-Anthropic research warnings.

- **[PD8] MET AS AMENDED BY R1/R2.** The baseline blob is pinned, the PD-base snapshot is a
  true base capture, base/head complete outcomes match, and M35 demonstrates the upgraded
  fixture is load-bearing.

- **[PD9] MET.** Edge tests prove both boolean values survive validation/response. The
  frontend/persistence/request wiring remains explicitly assigned to `PC-UI`; PD makes no
  end-to-end UI claim.

- **[PD10] NOT MET.** Runtime and D6 gates pass under R4; the recorded base-red and mutation
  evidence is otherwise credible. Completion is blocked because the missing malformed/null
  provider-body cases leave [PD2]/[PD6] unproved, and R3's interrupted-stream status/code
  delta lacks its own D7 assertion.

## FINDINGS

### [B1] HTTP-200 provider body parsing bypasses the typed boundary and leaks provider text

At `generate-story/handler.ts:1741`, `await response.json()` is outside any conversion to
`ProviderOutputError`. A malformed body throws `SyntaxError`; JSON `null` then throws while
reading `stop_reason`. Both reach the generic catch. Reproduced through the production
handler:

```text
malformed-json 500 {"success":false,"error":"Unexpected token 'o', \"not-json\" is not valid JSON"}
json-null 500 {"success":false,"error":"Cannot read properties of null (reading 'stop_reason')"}
```

With a fresh planted provider body:

```text
{"status":500,"body":"{\"success\":false,\"error\":\"Unexpected token 'L', \"LEAK_ME_PD_7f4c9a\" is not valid JSON\"}","leaked":true}
```

This violates [PD2]'s sole typed success/failure protocol, [PD6]'s
`PROVIDER_OUTPUT_INVALID` 502 mapping, and the prohibition on returning provider values.

**Required consolidated remediation before round 2:**

1. Convert an Anthropic HTTP-200 body that cannot be parsed as JSON, or whose parsed
   top-level value is not a message object, into
   `ProviderOutputError("INVALID_STORY", <safe module-literal detail>)` before any property
   access. Never propagate `response.json()`'s exception message.
2. Add production-handler tests for (a) malformed HTTP-200 provider JSON carrying both an
   obviously malformed planted value and a fresh token-shaped value, and (b) parsed JSON
   `null`. Require exact 502 `PROVIDER_OUTPUT_INVALID`, the fixed invalid-story Spanish
   message, and absence of the planted value from body and captured logs. These are
   base-red at `96cb2cc`.
3. In the same remediation, tighten the existing body-stream interruption test to assert
   exact HTTP 400 and `code:"CLIENT_INPUT_INVALID"` (plus its existing JSON/CORS/no-provider
   assertions). Record its base-red status/code change or an equivalent D7 mutation.

No broader provider-HTTP transport/API reclassification is requested.

No SHOULD-FIX or NIT findings beyond this consolidated blocker.

## LOW-CONFIDENCE / NOTES ON THE PLAN

The plan should explicitly add “HTTP-200 provider body parse failure or non-object top-level
JSON” to [PD2]/[PD6]. The current wording already implies the result, but naming the boundary
will prevent a future review from confusing a malformed successful response with the
separately out-of-scope Anthropic HTTP non-2xx transport/API path.

`PC-UI`, `PD-REFINE`, and the R3 PFE consumer follow-up remain release prerequisites exactly
as recorded. No other low-confidence item.
