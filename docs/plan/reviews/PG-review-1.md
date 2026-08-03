CODEX REVIEW — PG ROUND 1/2 — phase/pg-cancellation@d3fbd58

VERDICT: FAIL

The production cancellation design is sound and the branch meets the frozen behavior contract
except for one required integration proof. The real-editor T-G.11 case does not place a
cover/end item in `persisting` when the user cancels, so it cannot prove the G7 requirement that
a persisting sibling is left alone. I reproduced the gap with a mutation: changing the
invalidation sweep to reset `persisting` as well as `running` still leaves the current editor
case green, while the runner-level T-G.9 case correctly turns red. G7 expressly says runner
tests do not replace the component integration bar.

This is round 1 of 2. The complete consolidated remediation scope is the single blocking item
below.

## REVIEW TARGETS AND RUNTIMES

- Target: `d3fbd585be440517d27a9862266e19b7e6624152`.
- Exact base and merge-base: `5f7b6bdb5095351a2da3f4d5e530f16673e6c626`.
- The range is exactly four commits: `180678e`, `3825901`, `1c3db15`, and `d3fbd58`.
- Runtime used for every Node reproduction: Node `v22.22.0`.
- I ran `jb list` before creating two disposable detached worktrees. I did not check out or
  modify either protected branch.
- Production diff is confined to the four G1 files. `supabase/functions/**` is empty in the
  range, and the FE fixture remains blob
  `70204600a10ad1e43595da9a93856b4a6b34b459` at both SHAs.
- No provider call was made. Temporary probes were reverted and both detached worktrees were
  clean before removal.

## FOCUSED REPRODUCTIONS

At the target, the four PG suites passed under serial Vitest:

```text
concurrencyPG.cancel.test.ts                 9/9
pipelineRunnerPG.cancellation.test.ts       25/25
taskFactoriesPG.signal.test.ts              19/19
CuentacuentoEditor.pg.cancel.test.tsx        10/10
TOTAL                                       63/63
```

The wider PB regression surface I ran also passed: seven files, 135/135. This includes the
shared boundary consumers, immutable upload tests, PB criteria/capture/no-delete tests, and the
A3 draft-hook suite.

My full canonical target run reproduced the frozen D6 failure set exactly:

```text
npx vitest run --no-file-parallelism
66 files: 65 passed, 1 failed
823 tests: 817 passed, 6 failed
```

The six failures are exactly the named pre-existing `MesaAbiertaDashboard` cases. My raw
like-for-like checks also reproduced 1041 TypeScript diagnostics at base and head, and ESLint
159 problems (116 errors, 43 warnings) at base and head. I therefore concur with the PM's
position-normalized, worktree-path-normalized identity comparison: zero identities added in
either direction.

### Independent base-red proof

Against exact base `5f7b6bd`, I added a temporary one-case runner probe that started one scene,
observed `running`, called the production `cancel()`, and required synchronous `pending`. It
failed exactly:

```text
Expected: "pending"
Received: "running"
```

The probe was deleted immediately afterward.

### Independent mutations

**M-SOL-1 — remove the `reserveRun` displacement sweep.** The runner suite produced exactly
8 failures / 17 passes. The eight failures were the T-G.8 matrix: old X ending by abort-reject
or late success while new X was `pending`, `running`, `persisting`, or `done`. Each failed on
the displaced sibling Y remaining `running` instead of `pending`. The mutation was reverted.

**M-SOL-2 — incorrectly sweep `persisting` as well as `running`.** The current real-editor
T-G.11 case named “cancelar NO interrumpe el trabajo ya aplicado” still passed. In the same
mutant, runner T-G.9a failed immediately:

```text
Expected: "persisting"
Received: "pending"
```

This is the load-bearing reproduction for [B1]: the unit layer detects the bad behavior, but
the required G7 editor proof does not. The mutation was reverted.

## BLOCKING FINDINGS

### [B1] T-G.11's persisting-sibling claim is not proved under the real-editor bar

Locations at `d3fbd58`:

- `src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.pg.cancel.test.tsx:
  432-472`
- `src/hooks/__tests__/pipelineRunnerPG.cancellation.test.ts:562-615`
- `src/hooks/storyImagePipelineRunner.ts:474-480,990-1003`

T-G.11 requires, under G7, a real cover/end run that leaves a `persisting` sibling alone when
the user clicks the real `Cancelar`. G7 then says runner/factory unit suites remain necessary
but “do not replace this integration bar.”

The editor case at lines 432-472 waits until cover options are already visible, records the
number of completed upserts, optionally clicks `Cancelar`, and checks only that the applied
options remain. It does not defer the production draft persistence boundary, does not observe
the cover card in `Guardando...`, and does not establish that cover is `persisting` at click
time. On the normal fast mock path, persistence has already completed. M-SOL-2 proves the
consequence: the exact forbidden mutation passes this editor case.

The T-G.9a/T-G.9a-bis runner cases correctly prove the core runner behavior, and the existing
editor case correctly proves applied work is not visually reverted. Those are both valuable,
but together they are not the frozen T-G.11/G7 proof.

Required remediation:

1. Add a deterministic, opt-in defer/gate at the permitted external Supabase persistence
   boundary used by the real editor. If `pbBoundary.ts` is extended, keep the extension purely
   additive: default behavior byte-equivalent, reset clears it, and all PB suites remain green.
2. In the production-editor T-G.11 flow, park one cover/end item in a real `persisting` state
   while a sibling keeps the cover/end run active, then click the single real `Cancelar`.
3. Assert at the UI/boundary level that the persisting item remains in the saving state through
   cancel, its persistence is not aborted, it completes normally, and its applied options
   remain; assert the unapplied sibling is normalized/recollectable and no future invocation is
   dispatched.
4. Re-run M-SOL-2 (or the equivalent named mutation that includes `persisting` in the cancel
   sweep) and record that the new real-editor case fails. The normal case must pass.
5. Re-run the four PG suites, the affected PB suites, and the D6 gates. Do not change production
   behavior unless the deterministic integration case reveals a real defect.

CONTRACT-COUPLED: NO. This is a test-evidence remediation. It must not change any wire envelope,
Storage behavior, lifecycle sequence, or production PB machinery.

## CONSOLIDATED REMEDIATION — ROUND 2/2 SCOPE

The sole remediation item is [B1]: make T-G.11's persisting-sibling assertion a deterministic
real-editor/G7 proof and pin it with the persisting-sweep mutation. The permitted related
residue is only an additive external-boundary test control needed to park persistence, plus the
new/adjusted T-G.11 assertions and their evidence.

Do not alter the cancellation production design, `runWithConcurrency`, Storage upload logic,
manual save callbacks, direct story/refine invokes, lifecycle call sites, response envelopes,
edge code, fixture, corpus, or status union. Round 2 is final under the stated cap.

## RATIFICATION / STRIKE DECISIONS

### Q2 — executor findings referred by the PM

- **F2 / T-G.10 count-half: RATIFY.** Scene collection and the missing count are option/state
  derived at base. The base-red part is the card status/spinner normalization; the count is a
  compatible existing-true control that verifies resume still derives from missing work. The
  cover/end collectability change is separately base-red under T-G.11.
- **F5 / cancellation-wins while owned: RATIFY.** In production, `cancel()` and `reserveRun`
  invalidate ownership before aborting, so the owned-and-aborted catch arm is defensive. It is
  nevertheless a correct implementation of G3 and T-G.6c validly pins the dedicated
  `RetryCancelledError` branch. Live-signal genuine failures remain `error`.
- **F7 / additive `pbBoundary.ts` extension: RATIFY.** The invoke log and optional per-call
  handler are test-only and additive. With no handler, the old constant response path is
  preserved; reset clears the new log/control. My wider PB run was 135/135.
- **F8 / runner substitution for T-G.11 persisting sibling: STRIKE.** Runner T-G.9 proves the
  behavior but cannot replace G7. M-SOL-2 demonstrates that the current editor case is not
  sensitive to the forbidden persisting sweep. This is [B1].

### Q3 — PM-ratified findings

- **F1: CONCUR.** Replacing the self-caught vacuous T-G.12 proof is correct D7 practice.
- **F3: CONCUR.** T-G.2b/2d fail at base only because the dedicated class does not exist; the
  load-bearing compatibility controls are T-G.2a/2c and remain existing-true.
- **F4: CONCUR.** T-G.8-orden is constructionally green under sweep removal, while the eight
  matrix cases detect removal and the separate placement mutation detects ordering.
- **F6: CONCUR.** Error clearing is defensive but is an explicit G3 invariant.
- **F9: CONCUR.** `EXISTING_DRAFTS_URL` is the correct real-editor fixture because PB correctly
  rejects synthetic data URLs on the fail-closed path.

## FROZEN-QUESTION ANSWERS

### Q1 — verdict by G and T-G

- **G1: MET.** Exact base/topology, four production files, no edge diff, unchanged status union.
- **G2: MET.** Pre-dispatch checks, abort-aware backoff, cleanup, post-wait check, dedicated
  error, and omitted-signal compatibility are present and focused-green.
- **G3: MET.** Both invalidation points sweep only `running`; displacement ordering and stale
  catch/success token ownership are correct. M-SOL-1 pins the load-bearing same-id rule.
- **G4: MET.** All nine factories and both wrapper links forward the identical signal into
  `{body, signal}` without changing bodies/envelopes or overstating server cancellation.
- **G5: MET.** The seven boundary behaviors are implemented; persistence remains un-aborted.
- **G6: MET in production behavior.** Resume stays state-derived, cover/end has one run-keyed
  Spanish `Cancelar`, registry/lifecycle semantics are preserved, and notice residue remains.
- **G7: NOT MET IN FULL.** The real stack and allowed mocks are used, but its required
  persisting-sibling integration proof is missing; [B1].
- **G8: MET.** Every named residual remains untouched.

T-G.1 through T-G.10 are MET. **T-G.11 is NOT MET IN FULL** solely for the missing real-editor
persisting-sibling proof. T-G.12 and T-G.13 are MET. The blocker is evidentiary; I found no
contrary production behavior.

### Q4 — gates

CONCUR. My full serial Vitest run reproduced 823 total / 6 named Mesa failures; raw tsc was
1041 at both SHAs; raw ESLint was 159 (116/43) at both SHAs; focused PG was 63/63 and the wider
PB selection was 135/135. Together with the PM's normalized identity comparison, D6 is met.

### Q5 — scope and coupling

Confirmed: no wire-contract change, no production PB-machinery change, no lifecycle call-site
change, no edge change, and no reopening of A2/A3/A4/A5a. The only PB-adjacent change is the
ratified additive test-boundary instrumentation. `runWithConcurrency`, immutable uploads,
manual saves, direct story/refine invokes, recovery/deletion/replacement/finalization/unmount,
epoch handling, and save-retry invalidation remain frozen.
