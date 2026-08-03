CODEX REVIEW — M1 ROUND 1/2 — `feat/mat-ef`@`7f3600f`

VERDICT: PASS

M1 meets [A1]–[A11] and the frozen M-D2/M-D4/M-D5 contracts. The two prompt
extractions preserve the old behavior when the optional field is absent or empty, the
present-field prompts contain the normative blocks at the specified splice points, and
the Edge Function sanitizer implements the frozen seven-step algorithm. I found no
blocking correctness, contract, security, architecture, scope, or sequencing defect.

This PASS closes the phase-review requirement at round 1 of the 2-round §1.5 cap. M1 is
eligible for PM close/merge handling; merge and deployment remain Brent-authorized
separate actions under M-D8/D9.

## REVIEW TARGETS AND WORKTREE SAFETY

- I ran `jb list` before any repository operation.
- The active worktree was already on `feat/mat-ef` at exact target
  `7f3600f469a57a01e13937f8eb2c61d9a9c4281d`; I did not switch it. The known
  interactive-session risk was handled by running comparisons and mutations in two
  disposable detached worktrees at base and target. Both were removed afterward.
- The pre-existing `.gitignore` modification remained untouched. The active worktree
  ended with that as its sole dirty path.
- `main`, the merge-base, and the branch base are all exact
  `d79d32913a7efca6aa73c1250c380950a8744003`.
- The range contains exactly `5d69c0d`, `3900a39`, and `7f3600f`; local and remote
  branch tips match.
- The diff contains exactly the eight M1 files, `+1562/-295`; `deno.lock` is unchanged.
  `git diff --check` is clean.
- I made no provider call, deploy, branch switch, or code change. The only persistent
  file written by this review is this review file.

## INDEPENDENT GATE REPRODUCTIONS

Canonical runtimes were Deno `2.7.11` / V8 `14.7.173.7-rusty` / TypeScript `5.9.2`
and Node `v22.22.0`.

| Gate | `d79d329` | `7f3600f` | Ruling |
|---|---:|---:|---|
| `deno test --allow-all .` | 41 passed / 0 failed | 125 passed / 0 failed | clean delta; all 84 new tests green |
| `deno lint .` | 94 problems | 94 problems | zero new identities |
| `deno check .` | 46 errors | 46 errors | zero new identities |
| `npx tsc -p tsconfig.app.json --noEmit` | 1033 diagnostics | 1033 diagnostics | zero delta; 1033 is the real base |
| `npx eslint .` | 159 (114 errors / 45 warnings) | 159 (114 / 45) | identical |
| `npx vitest run --no-file-parallelism` | 261 passed / 6 failed | 261 passed / 6 failed | exactly the Mesa six at both SHAs |

The identity conclusion is stronger than count-only coincidence. No FE file changed. In
the Deno surface, all six new modules lint and type-check cleanly; checking the two
changed `index.ts` files alone yields the same six TypeScript errors at base and target,
and linting them yields the same eight pre-existing problems with only line-number
movement. Thus the full-tree equal counts do not conceal an added-and-removed trade.

## INDEPENDENT BEHAVIOR EVIDENCE

### Golden provenance and prompt bytes

I extracted the base builders directly from
`git show d79d329:supabase/functions/generate-children-lesson/index.ts`, executed them
with the committed fixture, and compared their runtime output independently with the
embedded literals and target builders:

- Generate system golden: exact; 2305 UTF-8 bytes; SHA-256
  `431b01f94f70d4cb6b61d7d55daae18458912ce258321662af2be51218d277fe`.
- Generate user golden: exact; 1120 UTF-8 bytes; SHA-256
  `3800d656337816aa856cf8d00af6fa0dc4b4b64e1e99585a9e3c1f54d9fb2a83`.
- Target generate output with the field absent and with `[]` is byte-equal to that base
  runtime output.

I repeated the extraction for refine. Its system literal equals the executed base
builder, and each of the eight `REFINE_USER_GOLDENS_BASE` entries equals the executed
base builder for its own `refinementType`. At the target, absent and `[]` remain
byte-equal to base for all eight types.

The present-field expectations are independent literals. Generate derives its expected
prompt from the verified base anchor and guards both that the anchor exists and that the
replacement changes the string. Refine does the equivalent for every type. The
only-difference assertions then remove the normative block/section and recover the base
prompt exactly. These are behavior assertions, not import/execution smoke tests.

### Mutation killability

- Removing the control-replacement call from the sanitizer produced exactly
  `38 passed / 1 failed`; V10 was the sole red test, with actual
  `papel\u0000rojo` versus expected `papel rojo`. V3 stayed green, as the frozen
  witness analysis predicts.
- Adding one unconditional byte at the generate splice produced exactly
  `3 passed / 5 failed`. Both absent/empty goldens, the all-noise golden, the A4 exact
  splice assertion, and the A4 only-difference assertion failed. This independently
  proves that A4's splice derivation and its no-op guard are non-vacuous.
- Both production files were restored and byte-verified against their target blobs:
  `_shared/availableMaterials.ts` = `bcdbe23bbc16a28191584a234def0f6b0cf24c21` and
  `generate-children-lesson/prompt.ts` =
  `b0c45dce63ee57b6ebb6f840ea5d228c7da4f420`.

### Extraction purity

The `index.ts` diffs contain only new prompt-module imports and deletion of declarations
moved into `prompt.ts`. No handler statement is edited. As an additional byte check:

- Generate from `const corsHeaders` through EOF has identical base/target Git hash
  `86cf0573039f0ef10551be8ce1410864fe21db07`.
- Refine from `function validateRefinedLesson` through EOF has identical base/target Git
  hash `bcd5ccf20f1ab2ff18da99e0683467b48cac7322`.

That covers the complete `serve()` flows and their validations. The earlier unchanged
constants/declarations are also visible as context-only lines in the zero-context diff.

## ACCEPTANCE MATRIX

| Criterion | Ruling | Evidence |
|---|---|---|
| [A1] | MET | Exact immutable base and required runtimes established; I independently replayed all six base gates before judging the delta. The historical “recorded before edit” chronology is process evidence, while its substantive baseline is fully reproducible. |
| [A2] | MET | 125/0 target Deno tests; six new files lint/check clean; no new full-tree lint/check identity. |
| [A3] | MET | Independent `git show` execution proves all generate and refine goldens are real base output; absent and `[]` are strictly byte-equal. |
| [A4] | MET | Exact normative generate block and item order; anchor/no-op guards plus the `3/5` splice mutation prove sensitivity. |
| [A5] | MET | All eight refinement types are enumerated and each proves present, absent, empty, exact placement, and only-difference behavior. |
| [A6] | MET | V1–V11, lenient trust-boundary input, non-string dropping, every-vector fixed point, and canonical-output idempotence all pass. Code follows all seven M-D5 steps in order. |
| [A7] | MET | Both frozen D7 mutations reproduced with the required red outcomes; restores byte-verified. |
| [A8] | MET | Both index diffs are imports plus moved-declaration deletions; complete serve-flow suffixes are byte-identical. |
| [A9] | MET | Both request types declare `availableMaterials?: string[]`. |
| [A10] | MET | No FE file changed; tsc, ESLint, and serial Vitest reproduce exact base results. |
| [A11] | MET | Exactly the eight allowlisted files; no FE, authz, validation, model, packet, lockfile, config, migration, or deployment change. |

## BLOCKING FINDINGS

None.

## SHOULD-FIX

None.

## NITS

- `_shared/availableMaterials_test.ts:136-142` is titled “the cap counts canonical
  entries, not raw ones,” but its 60 distinct values precede all duplicates. That input
  does not itself distinguish the committed cap-after-dedupe implementation from an
  incorrect raw-first-60 cap. This is non-blocking because the production order is
  unambiguous and correct, the frozen A6/A7 evidence is met, and my independent witness
  `['m01', 'M01', 'm02', ..., 'm60']` returned 60 canonical entries through `m60`.
  If this suite is touched later, moving the duplicate ahead of the final distinct value
  would make the extra test's title self-proving.

## FROZEN-QUESTION ANSWERS

### Q1 — [A1]–[A11]

All are MET, for the reasons in the matrix above. No criterion is being waived on the
strength of the ledger or PM summary.

### Q2 — behavior tests, goldens, and A4 non-vacuity

The suites test exact behavior: full prompt bytes, exact block derivation and placement,
canonical vector outputs, fixed points, boundary idempotence, malformed inputs, and the
two named mutation failures. The embedded generate and refine literals are independently
confirmed base output. A4 is non-vacuous both constructionally (`anchor` inclusion plus
`expected != base`) and empirically under the splice mutation. The one over-broad extra
cap-test title is the NIT above; it does not undermine the required evidence or the
correct implementation.

### Q3 — M-D2/M-D4/M-D5

No violation.

- M-D2: absent and canonical-empty fields add no byte to either prompt.
- M-D4: the strict normative wording is present for generate and for every refine type.
- M-D5: control replacement precedes whitespace collapse; then trim/drop, UTF-16
  `.slice(0, 120)`, re-trim/drop, locale-less `toLowerCase()` dedupe with first-wins,
  and the 60-entry cap after dedupe. Input order is retained. An independent
  duplicate-before-the-60th-distinct probe confirms the cap ordering.

### Q4 — extraction purity

Confirmed. Each `index.ts` change is strictly imports plus moved-declaration deletion,
and each complete validation/serve suffix is byte-identical to base. There is no hidden
handler-flow edit.

### Q5 — PM-accepted deviations

- **D1 ACCEPTED.** The explicit UTF-16 code-unit scan is behaviorally identical to the
  frozen control ranges, does not touch surrogate code units, and avoids adding a new
  `no-control-regex` identity. V10 and the control-drop mutation prove the load-bearing
  behavior.
- **D2 ACCEPTED.** Commit-tree/private-index authorship is provenance machinery, not a
  product-tree deviation. The final ancestry is exact, contains three coherent commits,
  is pushed, and avoids switching the interactively occupied worktree.
- **D3 ACCEPTED.** Moving `RefinementType`, `LessonPhase`, and `CurrentLesson` is the
  necessary transitive type closure of `RefineRequest`; importing `CurrentLesson` back
  into `index.ts` is required by `RefinedLesson extends CurrentLesson`. It preserves the
  minimal extraction boundary rather than broadening it.

### Q6 — refine paragraph wrap

**Normative-as-written.** The plan labels the fenced prompt text normative, and the
explicit newline between “No propongas” and “materiales fuera…” is inside that frozen
block. The implementation and independent expected literal reproduce it exactly. It is
not an incidental formatting wrap to repair during M1.

### Q7 — scope creep

None. The eight-path allowlist is exact, all changes stay inside the three permitted
function directories, and every listed out-of-scope surface is untouched. There was no
deploy.

### Q8 — impact on M2/M3a/M3b

Nothing makes later phases harder than the frozen plan assumes. The exported request
types and pure builders give M2 the additive EF contract it expects; the sanitizer is a
stable trust boundary with the same frozen constants/semantics the FE copy must match;
and no FE component, service, persistence, routing, or UI choice has been pre-empted.
The accepted transitive refine types are local module closure, not a new cross-phase
dependency.
