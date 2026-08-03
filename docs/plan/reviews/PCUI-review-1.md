# CODEX PHASE REVIEW — PC-UI — ROUND 1/2

**TARGET:** `phase/pcui-warnings`@`8ceec7c12d30ab0686a281fcf539b67a2066a99f`  
**BASE:** `pg-fix-d3fbd58`@`1b0cfed870ba2dbcd39cb9deabb9804542aca569`  
**VERDICT: PASS / CONFIRMED**

No blocking finding remains. The production change, committed evidence, independent gate runs,
base-red proof, and named severing probes meet G1–G10 and T-U.1–T-U.12. The four referred
decisions are ratified. This is round 1/2; because it passes, no remediation round or gate-5
escalation is triggered.

## Review basis and hygiene

- I ran `jb list` before creating worktrees. The shared `casa-web` worktree was dirty on the
  parallel M track and was not touched. All code inspection, tests, and mutations used disposable
  detached worktrees at the two pinned SHAs.
- Target, local phase ref, and `origin/phase/pcui-warnings` all resolve to `8ceec7c12d…`.
  `merge-base(8ceec7c, 1b0cfed)` is exactly `1b0cfed`. The target has the four reported commits.
- The delta is exactly seven files, `+1820/-4`. The only production files are
  `src/lib/cuentacuentos/imageFeedback.ts` and
  `src/components/liturgia-builder/editors/CuentacuentoEditor.tsx`.
- `supabase/**` has an empty diff. The fixture
  `src/lib/cuentacuentos/__tests__/pb_fe_base_185c370.json` remains blob
  `70204600a10ad1e43595da9a93856b4a6b34b459`. The retained
  `useCuentacuentosDraft.a3.test.ts` is byte-unchanged.
- The protected phase refs remain at their recorded SHAs; `main = origin/main = 7f3600f`.
  No merge, push, deploy, provider call, infra action, or protected-ref checkout occurred.
- The target and installed dependency lockfile blobs match. All canonical gate measurements below
  explicitly used Node `v22.22.0`.

## Q1 — G1–G10

- **G1 MET.** The topology, base, production scope, test-only additions, and PH sequencing are
  correct. There is no edge or frozen-phase production change.
- **G2 MET.** `WarningSource` is closed to the four specified values. `EnvelopeWarning` has the
  exact shape. `parseWarnings` is the sole parser: array-only; non-array-object entries only;
  non-blank required strings; finite-number/string optional validation; malformed-entry drop;
  unknown-property sanitization; forward-compatible codes; order and multiplicity preservation.
- **G3 MET.** `InvokeError` gains exactly `warnings: EnvelopeWarning[]` and
  `buildInvokeError` calls the one parser. Existing status/code/field/skipped/refine/generic
  message behavior is retained. `extractInvokeError` remains the sole context reader and its
  clone/json defensive fallbacks produce status-only errors with no warnings.
- **G4 MET.** Warning state is separate from `skippedImages`. The amber notice is a sibling in the
  shared container before the current step, with the exact Spanish heading/dismiss label,
  `role="status"`, `aria-live="polite"`, verbatim server messages, occurrence-safe keys, and
  manual dismissal. The six production state transitions cover preview success/error, generation
  success/error, successful deletion, and reset/regenerate. Scene-image responses do not alter it.
- **G5 MET.** Success, preview, typed 400/422/502, and generic 500 envelopes are covered. Warning
  and red error surfaces coexist. Omitted/malformed warnings create no notice, and the story
  warning renders its fixed server message.
- **G6 MET.** There is no denominator, all-failed banner, severity fork, alternate heading/color,
  or inferred edge field. Mixed and all-warning cases use the same notice.
- **G7 MET.** The structured response mapper preserves `true` and `false` only and omits absent or
  malformed values. The real-editor chain uses the production editor, hook, factories, parser,
  toast, approval path, actual unmount/remount recovery without `initialStory`, and normal
  per-scene `Regenerar` requests.
- **G8 MET.** Base-red and every required link/precondition mutation are recorded and independently
  reproduced below. The unchanged T-A3.5 test is supporting evidence and is not substituted for
  the real-editor chain.
- **G9 MET.** Positive consumer behavior proves the unique 400 `CLIENT_INPUT_INVALID` detail
  reaches the editor as `Error 400: <detalle>`. A top-level `INVALID_IMAGE_REF` stays on the
  generic backend-detail path, while the per-entry value alone uses `describeSkippedImage`.
  The evidence is behavioral, not a source grep.
- **G10 MET.** Both new editor suites mock only `@/integrations/supabase/client`; the editor, hook,
  parser, invoke-error seam, factories, and toast hook run for real. Browser `fetch` and the
  Supabase/auth/table/storage/functions boundary are the only other controlled boundaries. The
  Spanish-copy hygiene plantings and D6/scope gates pass.

## Q1 — T-U.1–T-U.12

- **T-U.1 MET:** every source, both edge shapes, optional presence/absence, future codes,
  sanitization, duplicate/order preservation, mixed invalidity, bad source/required/optional
  fields, arrays-as-entries, and absent/null/non-array inputs are covered.
- **T-U.2 MET:** warnings travel through `buildInvokeError` without altering retained fields or
  copy. Real editor cases exercise 400/422/502/500 contexts plus non-JSON, absent context,
  throwing clone, and rejected JSON. The final commit closes both named defensive gaps.
- **T-U.3 MET:** success, fixed story copy, empty/omitted behavior, dismissal, accessibility, and
  shared-container placement are component-tested.
- **T-U.4 MET:** A→B replacement, warning→empty, network/non-JSON clearing with error retained,
  reset/regenerate, successful delete, and scene-channel independence are component-tested.
- **T-U.5 MET:** preview uses the one shared notice outside the prompt panel and participates in
  the same success/error/replacement semantics.
- **T-U.6 MET:** real-editor 400/422/502/500 coexistence and omitted/malformed negatives are
  covered; the status-agnostic production seam is load-bearing.
- **T-U.7 MET:** an unknown code renders safe server copy; duplicate source/code entries both
  render without a React-key warning; request/provider/unknown-property tokens and optional
  metadata do not render.
- **T-U.8 MET:** mixed and all-warning fixtures have identical heading, role, style, color, and
  structure, with no client denominator language or logic.
- **T-U.9 MET:** the one contract-valid response carries true/false/absent through response
  mapping, persisted production payload, actual remount/recovery, and external request bodies.
  There is no `initialStory` shortcut on remount.
- **T-U.10 MET:** the exact base-red and five G8 proofs are below. T-A3.5 is byte-unchanged,
  normally green, and turns red with the post-reconciliation round-trip severing. Task-factory
  suites remain green.
- **T-U.11 MET:** the real editor supplies the required 400 consumer proof; focused cases preserve
  top-level backend detail and the per-entry-only copy. Both named mutation directions are
  sensitive.
- **T-U.12 MET:** focused, frozen-family, full serial, TypeScript, ESLint, scope, blob, and clean
  mutation requirements pass.

Independent green runs at head:

```text
PC-UI focused:                           3 files, 77 passed / 0 failed
Relevant PFE/PB/PG + T-A3.5/factories: 15 files, 266 passed / 0 failed
```

## Independent base-red and mutation record

All probes ran at target `8ceec7c12d…` under Node `v22.22.0`, were temporary and named, were
reverted immediately, and ended with `git status --porcelain` empty.

1. **BASE-RED-PCUI:** restore both production files from exact base `1b0cfed` beneath the committed
   three-suite evidence: exactly **47 failed / 30 passed**. Restore: clean.
2. **M-D13-RESPONSE:** remove the response-mapper spread: exactly the real-editor case fails at
   the persisted `true` assertion (`pcui.d13.test.tsx:210`). Restore: clean.
3. **M-D13-ROUNDTRIP:** strip `landmarkVisible` only after the hook's A3/S5 reconciliation and run
   the real-editor chain plus retained T-A3.5: exactly **2 failed / 30 passed**, at the recovered
   request and T-A3.5 landmark assertions. Restore: clean.
4. **M-D13-ROUNDTRIP-NAIVE control:** strip inside/before reconciliation: **32/32 green**. The
   redundant `editorStateV1.landmarkVisible` record heals the story tree. This confirms the F1
   two-channel record and explains why the binding mutation must be placed after reconciliation.
   Restore: clean.
5. **M-D13-REQUEST:** remove the normal request-builder spread used by per-scene `Regenerar`:
   exactly the real-editor case fails at the final external-body assertion
   (`pcui.d13.test.tsx:255`). Restore: clean.
6. **M-D13-PRECONDITION:** make the opt-in persistence boundary return no stored row on remount:
   the real-editor case fails at recovery (`pcui.d13.test.tsx:222`) before any final request
   assertion. Restore: clean.
7. **M-F3-DETAIL:** discard `body.error` in `buildInvokeError`: the focused generic-message unit,
   real-editor 400, and top-level `INVALID_IMAGE_REF` cases all turn red. Restore: clean. The PM's
   independent **M-F3-TOPLEVEL** result (exactly the named “nada ramifica en él” case) is
   consistent with the committed positive/negative pair and is accepted.

The PM's independently clean **M-U4-REGEN** one-red result and the executor's remaining hygiene /
status-coverage mutations are consistent with the audited production paths and committed cases.

## Q2 — referred ratifications

### (a) D2 approval-path persistence — RATIFY

The literal G7 phrase “production-hook draft write” describes the required seam, not a mandate to
use a less complete user path. `handleGenerate` only installs the story in editor state; the real
approval sequence (`Aprobar cuento` → select the generated sheet → `Aprobar personajes`) executes
the production authoritative draft-write path through the production hook. The test observes the
production payload at the external upsert boundary, then recovers the JSON-cloned row on a real
remount. That is strictly more production behavior than a direct hook-only write. After recovery,
per-scene `Regenerar` exercises the normal request builder targeted by M-D13-REQUEST. Ratified.

### (b) D3 real debounce waits — RATIFY

G10 permits timers to be mocked but does not require it. Waiting for the real 2-second debounce is
honest, exercises actual scheduling, and is bounded by the case timeout. It weakens neither the
behavioral claim nor mutation sensitivity. Ratified.

### (c) additive `persistDraftRow` boundary control — RATIFY

The control is test-only, opt-in, and defaults false. In its default state the prior boundary
behavior is unchanged except for inert false branches. When enabled, the draft upsert stores the
exact production payload, adds the simulated `updated_at`, JSON-clones it as a `jsonb` analogue,
and serves that stored row back; the test does not author the recovered story. `resetBoundary`
returns the flag to false and clears the stored row. This is the appropriate F7/`upsertGate`
standard for round-trip fidelity and stays within G1/G10. Ratified.

### (d) F1 two-channel record — CONFIRM

The PLAN record is accurate. My post-reconciliation mutation produced exactly the required two
reds; moving the same conceptual strip inside reconciliation produced 32/32 green because the
A3/S5 `editorStateV1.landmarkVisible` channel restored both booleans. Expected-green at the naive
placement is healing by the second persisted channel, not insensitive tests.

## Q3 — D6 gates

**CONCUR.** Pure detached base and head checkouts, identical lockfile/dependencies, explicit Node
`v22.22.0`, and like-for-like commands produced:

```text
Vitest base:  66 files; 818 passed / 6 failed = 824 total
Vitest head:  68 files; 872 passed / 6 failed = 878 total
Failure sets: exactly the same six MesaAbiertaDashboard cases

TypeScript base/head: 1041 / 1041 diagnostics
position/worktree-normalized multiset delta: 0 removed / 0 added, both directions

ESLint base/head: 159 / 159 problems (116 errors / 43 warnings)
rule + message + relative-file multiset delta: 0 removed / 0 added, both directions
```

As a method check, an initial ambient Homebrew Node 26 invocation reproduced the PLAN's eight
additional base-identical `localStorage` failures at both SHAs. It was discarded and rerun with
the explicit canonical v22.22.0 binary; it is not part of the gate result.

## Q4 — scope and coupling

**CONFIRMED.** Production is confined to the two G1 files. No PFE/PB/PG/A2/A3/A4/A5a production
file or behavior is changed; the relevant frozen suites are green. `supabase/**` is untouched,
and the PC/PD edge remains a read-only reference at `10d1190`. The warning fixtures reproduce the
edge's seven reason strings, three source strings, envelope-neutral consequence clause, and fixed
`PROP_NOT_RECURRING` copy. No wire key, envelope, source set, denominator, or edge behavior is
added or changed. The pre-existing PFE skipped-notice channel remains separate and retains its
scene-path accumulation/dedup semantics.

## FINAL CLOSE

**PASS / CONFIRMED at `phase/pcui-warnings`@`8ceec7c`.** G1–G10 and T-U.1–T-U.12 are met in full;
D2, D3, the additive `persistDraftRow` control, and F1's record are ratified. No consolidated
remediation is warranted.
