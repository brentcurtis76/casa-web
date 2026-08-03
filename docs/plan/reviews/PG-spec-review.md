CODEX SPEC REVIEW — PG — vs phase/pb-storage-fe@5f7b6bd + phase/pb-storage-edge@10d1190

VERDICT: EXECUTABLE WITH THE TEXT BELOW

The frontend-only topology and the cancellation boundary are sound. The draft is not executable
verbatim. Two claimed test gaps are false: `pipelineRunnerA2.outcomes.test.ts:499-505` already
proves that a save-failed registry entry survives `cancel()` well enough to be retried, and it
does make a post-cancel status assertion (`done` after that retry). The narrower missing pin is
the immediate `running -> pending` normalization. The destructive-lifecycle summary is also
false for unmount: the editor's unmount cleanup only calls `cancelPipeline()`.

The proposed invalidation-time sweep needs one further binding. A prior run's abort rejection
must not unconditionally write `pending`: after `reserveRun` re-enqueues the same item id, that
late catch can overwrite the newer run's `running`, `persisting`, or `done`. Invalidation owns
the old run's normalization, and every old continuation must be status-silent after it loses its
run token. This review makes that ownership rule and its same-id proof explicit.

Everything below is binding executor scope. It replaces the PG draft's unresolved decisions,
the original T-G block, and the struck text identified at the end of this review. D1-D9 remain
frozen, including D5 capture, D6 delta gates at the `5f7b6bd` baselines, D7 base-red-or-named-
mutation evidence, D8 Spanish copy, and D9 no merge/deploy. PG extends around the reviewed,
frozen A2/A3/A4/A5a machinery; it does not redesign it.

## INDEPENDENT FACT CHECK

I ran the required `jb list` before any worktree action. I created no worktree, checked out no
ref, made no repository-code change, and reviewed repository code with `git show` at the two
pinned SHAs.

### Frontend — `5f7b6bd`

- `src/lib/cuentacuentos/concurrency.ts:15-33` confirms the retry gap. `shouldRetry` is consulted
  only in the catch at line 27; line 29 then performs a plain timer sleep, after which the loop
  invokes the next attempt without another cancellation decision. Defaults are two total
  attempts, 2,000 ms base delay, `4^attempt`, and less than 1,000 ms jitter
  (`concurrency.ts:19,22,28-29`). There is no cancellation primitive in this module.
- `runWithConcurrency` is a separate pool (`concurrency.ts:40-65`). Its only production caller
  is the PB draft-upload orchestrator at `src/hooks/useCuentacuentosDraft.ts:797-802`, with limit
  6 and default zero stagger. It is not the image-generation runner.
- `src/hooks/storyImagePipelineRunner.ts:921-928` confirms that `cancel()` nulls the token, sets
  `running=false`, aborts, and notifies. It changes neither item status nor the save-retry
  registry. Token-before-abort is explicit.
- The live worker stagger is runner-local: `storyImagePipelineRunner.ts:734-755` uses the plain
  timer helper at line 310, awaits `workerIndex * staggerMs` at line 744, then checks signal and
  token in the loop at lines 746-750. A cancel during stagger prevents dispatch after wake but
  cannot settle the stagger sleep early.
- Provider execution is exactly as stated at `storyImagePipelineRunner.ts:455-480`: the runner
  passes a signal to the task, but `retryWithBackoff` only asks `!signal.aborted` at catch time.
  Any rejection escaping the helper is written as `error`; an abort-caused rejection is
  therefore a phantom error today.
- The post-provider guard at `storyImagePipelineRunner.ts:484-486` is a silent return. Because
  `cancel()` does not normalize status, an abort-ignoring provider that resolves late leaves its
  old item `running`. The same silent-return strand exists after a displacing `runItems` for an
  old item not re-enqueued by the new run (`reserveRun`, lines 765-800).
- Applied persistence intentionally ignores run-token changes. `storyImagePipelineRunner.ts:
  548-597` completes a live persist as `done` or `save-failed`, with `PERSIST_STALE` returning
  `pending`; `pipelineRunnerA2.outcomes.test.ts:423-471` pins token-flip persistence. PG must
  preserve this A2 contract.
- All nine production factories are zero-argument provider closures and discard
  `ProviderContext.signal`: `src/lib/cuentacuentos/taskFactories.ts:215,291,378,461,517,579,
  680,775,847` (five generates and four refines). The injected provider type at lines 78-86 has
  no signal parameter.
- `src/components/liturgia-builder/editors/CuentacuentoEditor.tsx:493-500` confirms the shared
  wrapper invokes `generate-scene-images` with `{body}` only. The component feedback wrapper at
  lines 647-656 reports `skippedImages` before the runner can inspect its token, so an
  abort-ignoring late success may leave a real notice after cancel.
- The pinned lock entry is `@supabase/functions-js` 2.90.1 (`package-lock.json:3275-3278`; the
  matching `@supabase/supabase-js` dependency is at lines 3327-3337). The installed 2.90.1
  declaration exposes `FunctionInvokeOptions.signal?: AbortSignal` at
  `node_modules/@supabase/functions-js/dist/module/types.d.ts:88-110`. No dependency change is
  needed.
- The character and scene collectors are state-derived, not status-derived:
  `CuentacuentoEditor.tsx:2584-2605` selects missing option arrays. The shared-predicate design
  for buttons and auto-kick is explicit at lines 2622-2626. Scene resume copy and count are at
  lines 4798 and 4852-4861.
- The cover/end collector is different. `CuentacuentoEditor.tsx:2607-2617` excludes
  `running`/`persisting` items at line 2611, so a cancel-stranded `running` cover/end item is not
  recollected until remount. The final-step comment says the step has no cancel button at lines
  6567-6569. The two existing Cancelar controls are the sheet banner at lines 4466-4474 and the
  scene banner at lines 4830-4838.
- Auto-kick is armed only by the committed approval path and consumed only after
  `tryStart(...).accepted` (`CuentacuentoEditor.tsx:2658-2668,2670-2717`). I found no existing
  cancel/auto-restart integration pin.
- The draft's destructive-lifecycle summary is only partly true. Delete performs
  invalidate -> cancel -> null story id -> epoch bump at `CuentacuentoEditor.tsx:1971-1977`, and
  regenerate performs the same sequence at lines 3833-3839. Unmount does not: line 982 calls
  only `cancelPipeline()`. Recovery accept/decline/repair invalidate the registry at lines
  1425, 1477, and 1489 but do not contain the claimed four-step sequence. These reviewed
  lifecycle paths remain frozen.
- The listed late-result pins exist: `pipelineRunnerA2.contract.test.ts:194-224,226-267,
  503-564,701-726`; `pipelineRunnerA2.integration.test.ts:877-964`;
  `storyImagePipelineRunner.test.ts:242-283,285-335`;
  `pipelineRunnerA2.outcomes.test.ts:423-471`; and `useStoryImagePipeline.test.ts:33-54`.
  None pins immediate cancel-time `running -> pending` or error clearing.
- The broader claim that there is no post-cancel status assertion is false.
  `pipelineRunnerA2.outcomes.test.ts:499-505` cancels after a save failure, retries the retained
  save, and asserts `done`. That test also proves registry survival across `cancel()` even
  though `pipelineRunnerA3.registry.test.ts` itself contains zero `cancel()` calls. It does not
  prove immediate running-item normalization, scoped count survival, or the approval gate.
- `src/lib/cuentacuentos/__tests__/concurrency.test.ts:46-89` has no cancellation case.

### Edge — `10d1190`

- `supabase/functions/generate-scene-images/handler.ts:624-639` accepts a `Request`, but the
  handler never reads `req.signal`. The only signal in the function is its own provider timeout
  at `handler.ts:80-94`.
- The handler materializes request images, dispatches Gemini, and returns base64 `images` plus
  the additive `skippedImages` report (`handler.ts:663-729,1343-1413`). It performs no DB or
  Storage persistence. `index.ts:23-31` constructs Supabase only for authz dependencies.
- Therefore a frontend abort can settle the client and prevent later client attempts, but it
  cannot recall a Gemini request already dispatched by this handler. It leaves no server-side
  persisted image or draft to orphan. PG correctly proposes no edge branch.

### Bases, ancestry, fixtures, and supplied gate record

- `185c370` is an ancestor of `5f7b6bd`; `db42745` is an ancestor of `10d1190`; neither PG
  reference tip contains the other. This matches the PLAN PREL lineage block.
- The frozen blobs are exact: frontend capture
  `70204600a10ad1e43595da9a93856b4a6b34b459`, shared edge corpus
  `91ec703355f3584701fe25da484370e4ba57b156`, and PD story corpus
  `b73fa3c645e1f29b1c697fb1b7081001987a3d15`.
- Because the review instruction forbids reading a working tree for pinned code, I did not
  pretend to re-run gates on an unpinned checkout. The PM's supplied 2026-07-31 measurements are
  the frozen D6 baselines: FE Node v22.22.0, serial Vitest 760/6 (the Mesa six), tsc 1041, ESLint
  159; EDGE Deno 2.7.11, tests 325/0, lint 94, check 46. The executor must reproduce the FE
  baseline from exactly `5f7b6bd` before judging deltas.

## G1 — BASE, TOPOLOGY, AND SCOPE

Create exactly one branch, `phase/pg-cancellation`, from
`phase/pb-storage-fe`@`5f7b6bd`. Do not branch from `185c370`. Create no edge branch and touch no
path under `supabase/functions/**`.

Production scope is limited to:

- `src/lib/cuentacuentos/concurrency.ts`, only `retryWithBackoff` and its cancellation types;
- `src/hooks/storyImagePipelineRunner.ts`;
- `src/lib/cuentacuentos/taskFactories.ts`, only signal threading through the provider surface;
- `src/components/liturgia-builder/editors/CuentacuentoEditor.tsx`, only the shared invoke signal,
  the feedback wrapper's matching signature, and the cover/end Cancelar surface; and
- focused unit, runner, factory, and real-editor integration tests.

No status is added. `PipelineItemStatus` remains
`pending | running | persisting | done | error | save-failed`, and existing UI derivation from
those statuses plus `isRunning`/`isSaving` remains authoritative.

## G2 — CANCELLABLE RETRY CONTRACT

`retryWithBackoff` gains an optional cancellation input. A signal is preferred because the
runner already owns one; an `isCancelled` callback is acceptable only if it provides the same
observable contract. Existing callers that omit the input retain exact behavior.

The helper must:

1. check cancellation before attempt 0 and before every later provider dispatch;
2. replace the backoff timer with an abort-aware wait that removes its listener/timer on every
   settle path;
3. settle that wait promptly on cancellation, without advancing the residual timer;
4. check cancellation again after any normally completed wait and before dispatch; and
5. reject cancellation with one exported, dedicated `RetryCancelledError`. Cancellation is not
   represented by `shouldRetry=false`, by an arbitrary provider error, or by message matching.

If cancellation and the timer race in the same turn, no later attempt may dispatch once the
cancellation input is observable. The runner passes its run signal. `runWithConcurrency` and
all callers without a cancellation input are unchanged.

## G3 — INVALIDATION, STATUS OWNERSHIP, AND SAME-ID SAFETY

Cancellation normalization belongs to the synchronous invalidation points, not to stale
provider continuations.

- `cancel()` keeps token-before-abort order. After invalidating the token and before returning,
  it changes every currently `running` item to `pending`, clears its error text, leaves
  `persisting`, `done`, `error`, `save-failed`, and already-`pending` items unchanged, sets the
  runner idle, aborts the old controller, and notifies. It does not touch the save-retry
  registry.
- `reserveRun` displacement must perform the same `running -> pending` sweep for the displaced
  run. The sweep occurs after the old token loses ownership and before new tasks are installed
  or can publish status. The prior controller is then aborted. A new run may re-enqueue the
  same id and starts that id at `pending` under the new token.
- Every provider catch and every post-provider continuation is run-token-owned. If its token is
  no longer current, it performs no item-status write of any kind. The existing successful
  post-generate token guard therefore remains a silent return.
- If a provider rejection is caught while its signal is aborted, or the error is the dedicated
  `RetryCancelledError`, cancellation wins over a genuine-error race: it is not an `error`.
  If the run still owns the item, normalize it to `pending`; if ownership was already lost,
  remain silent because the invalidation sweep already normalized the old run.
- A genuine provider rejection while the signal is live becomes `error` only if that run token
  still owns the item. This token check is required independently of error classification.

The same-id rule is load-bearing. After a displacing run re-enqueues id X, an old abort
rejection or late success for X may not overwrite the new run's `pending`, `running`,
`persisting`, `done`, `error`, or `save-failed`. No implementation that merely adds
`setStatus(id, 'pending')` in the old catch satisfies PG.

`persisting` is excluded from both sweeps. Once apply has produced the retained snapshot, the
frozen A2 path continues to `done`, `save-failed`, or `pending` on `PERSIST_STALE`; cancellation
must not abort, suppress, or reclassify that persistence.

## G4 — TRANSPORT SIGNAL AND ABORT CLASSIFICATION

Extend the internal `InvokeGenerateSceneImages` surface atomically so it receives the runner's
`AbortSignal`. All nine factory providers must accept `ctx` and pass `ctx.signal` to the
injected invoke. The component feedback wrapper must accept and forward the same signal, and
`invokeGenerateSceneImagesRequest` must pass the identical signal instance as
`supabase.functions.invoke('generate-scene-images', {body, signal})`.

Do not create a second controller in the factory or wrapper, do not translate the signal into a
boolean snapshot, and do not change request bodies or response envelopes. No dependency update
is authorized.

Honesty is binding: tests, comments, and UI copy may say that cancel aborts the client request,
settles local waiting, and prevents future dispatches. They may not say that it recalls an
already-dispatched edge request, refunds spend, or proves server-side cancellation.

## G5 — THE SEVEN BOUNDARIES

The target boundary matrix is:

1. **Queued/pre-attempt:** never picked up after invalidation; remains `pending`.
2. **Stagger:** abort-aware wait settles promptly; the worker dispatches nothing; item remains
   `pending`; run completion does not wait for residual stagger.
3. **Backoff:** cancellation settles the wait and prevents attempt N+1; item is `pending`, with
   no error text.
4. **Provider in flight:** the same signal reaches the invoke. A signal-respecting rejection is
   cancellation, not error. An abort-ignoring late resolve/reject is discarded and cannot write
   status after losing its token.
5. **Post-generate/pre-apply:** the unchanged token guard discards the result; the invalidation
   sweep already owns the status.
6. **Persisting:** never interrupted by user cancel or run displacement; completes under A2.
7. **Destructive lifecycle with persist in flight:** unchanged A4/A5a identity/epoch semantics
   continue to govern stale commit and drain.

Thus queued, staggered, backoff, in-flight, and post-generate cancelled work is `pending`.
Applied work persists. Pre-cancel `error` and `done` remain unchanged. No cancellation status is
introduced.

## G6 — UI, RESUME, REGISTRY, AND NOTICE DECISIONS

### Resume

Keep the state-derived collectors. Do not add a status-only resume list. Once cancellation has
returned unapplied work to `pending`, missing character/scene options continue to drive the
existing `Generar ... faltantes (N)` actions. Cover/end becomes collectible because the false
`running` strand is removed; line 2611 itself need not be deleted.

Auto-kick intent is not re-armed by cancel. A user cancel must not spontaneously restart the
same batch. Only an existing explicit, still-unconsumed approval intent may start work under the
frozen A9a rules; a consumed/null intent remains consumed/null.

### Cover/end Cancelar

Add the missing user control. While the cover/end step has an active pipeline run, render one
enabled button whose visible Spanish label and accessible name are exactly `Cancelar`, and wire
it directly to `pipeline.cancel`. It must remain available while the active cover/end item is
in provider/backoff/stagger, not only while a particular card reports `running`. It must not
cancel `persisting` work. Do not redesign the cover/end cards, generate/refine controls, or
finalization gate.

### Registry and destructive lifecycle

User Cancelar performs no epoch bump, no story-id nulling, and no registry invalidation.
Save-failed entries, their identity-scoped count, save-only retry, `Reintentar guardado`, and
the approval gate survive. The existing outcomes test is retained; PG adds the scoped/UI proof.

Do not edit the reviewed delete, regenerate, recovery, finalization, story-replacement, or
unmount lifecycle sequences to make them look uniform. A4/A5a remains authoritative. PG's new
runner `cancel()` semantics naturally apply when an existing path already calls it; that is not
authority to add invalidations or epoch changes.

### Notice residue

Accept post-cancel notice residue. If an already-dispatched, abort-ignoring request later returns
real `skippedImages`, `invokeSceneImagesWithFeedback` continues to add them through PFE's frozen
accumulate-and-deduplicate path. Do not add run-liveness coupling to suppress them. A cancelled
request that returns no envelope produces no invented notice.

## G7 — REAL EDITOR INTEGRATION BAR

The component criteria below render the production `CuentacuentoEditor` with the production
`useStoryImagePipeline`, production runner, production task factories, and production invoke
wrappers. `use-toast` runs real.

Only external boundaries may be mocked: Supabase auth/table/storage, paid function invocation,
timers, and browser file input. Do not mock the hook, runner, factories, collectors, toast hook,
editor child components, or cancellation helpers; do not call extracted callbacks directly;
do not substitute a test-only wrapper; and do not use source-text/import assertions as runtime
proof. This is the PB G7 boundary-list literalism applied to PG.

Component assertions must observe user-visible status/count/control changes and exact calls at
the paid-invocation boundary. Runner/factory unit suites remain necessary for races that the
component cannot deterministically expose, but they do not replace this integration bar.

## G8 — EXPLICIT RESIDUALS AND FROZEN MACHINERY

The following remain out of scope and must be reported as residuals, not silently changed:

- `runWithConcurrency` and every PB Storage upload/fail-closed logical write;
- the four manual Storage save callbacks in the editor;
- direct `generate-story` preview/generation and `refine-story` invokes at editor lines
  1702, 1734, and 1865, which have no cancel surface;
- all `supabase/functions/**`, request/response envelopes, edge auth, model logic, and corpus;
- deletion, recovery, replacement, finalization, unmount, epoch, and save-retry invalidation
  semantics governed by A2/A3/A4/A5a; and
- deploy, merge, cross-merge, branch push to `main`, or provider call.

PG may add a signal parameter to the internal invoke type only. It may not reopen A2's
applied-work-persists rule, A3 registry identity/revision semantics, A4/A5a destructive
lifecycle, PB immutable uploads, or PFE notice accumulation.

## REPLACEMENT ACCEPTANCE CRITERIA

- **T-G.1 — Retry cancellation primitive.** With fake timers, prove directly against
  `retryWithBackoff`: already-cancelled before attempt 0 dispatches zero and rejects with
  `RetryCancelledError`; cancellation during backoff after attempt 0 settles without advancing
  the residual timer and dispatches no attempt 1; cancellation becoming observable at normal
  timer completion is rechecked before dispatch. Prove listener/timer cleanup on success,
  provider failure, timeout completion, and cancellation. Mutations removing the pre-attempt
  check, post-wait check, early abort settle, dedicated error, or cleanup each fail. Changed
  cases are base-red at `5f7b6bd`.

- **T-G.2 — Retry compatibility control.** With no cancellation input, the same retryable
  failure dispatches exactly twice and completes normally; `shouldRetry=false` still dispatches
  once; attempt/delay/jitter behavior is unchanged. A mutation that makes cancellation support
  alter an existing caller fails. These are existing-true controls with named D7 mutations.

- **T-G.3 — Runner backoff and single-item parity.** For both a multi-item run and a one-item
  `runItems` run, attempt 0 fails retryably, cancel during its backoff, and settle without
  advancing residual time. Provider count remains one, item is immediately and finally
  `pending`, error is cleared, and apply/persist/enqueue/upsert are zero. Re-running that missing
  item dispatches it normally. Base-red on provider count/status; mutations omitting the runner
  signal or treating the one-item path differently fail.

- **T-G.4 — Abort-aware stagger.** Three tasks, concurrency 3, stagger 400: cancel before worker
  1 or 2 wakes. Those workers dispatch zero, all unstarted items are `pending`, and run
  completion settles after abort without advancing either residual stagger. The early-settle
  half is base-red. Mutations restoring plain sleep, dropping the wake-time token/signal check,
  or touching `runWithConcurrency` fail the focused proof/diff audit.

- **T-G.5 — Nine factories and transport.** Parameterize all nine production factories. Each
  built task passes the exact runner-supplied signal instance to the injected invoke. Through
  the production editor wrapper, assert `supabase.functions.invoke` receives the same instance
  in `{body, signal}`. Severing any one factory fails exactly its case; severing the feedback or
  request wrapper fails the boundary case. Request bodies and response parsing remain equal.
  This is base-red at `5f7b6bd`.

- **T-G.6 — In-flight abort and race classification.** A signal-respecting invocation rejects
  on abort: cancel produces `pending`, never `error`, with no later dispatch/apply/persist/
  enqueue/upsert. Repeat with a genuine provider failure queued in the same cancellation race;
  cancellation wins when `signal.aborted` is observable. A live-signal genuine failure remains
  `error`. Mutations classifying by error name/message, reporting all abort-adjacent failures as
  error, or swallowing live genuine failures fail. Changed cases are base-red.

- **T-G.7 — Abort-ignoring late completion.** Exercise both late resolve and late reject after
  user cancel. Existing zero apply/persist/enqueue/commit/upsert assertions remain, and the item
  is immediately and finally `pending` with no error. Mutations removing the invalidation sweep
  or allowing any stale catch/continuation status write fail. The status half is base-red.

- **T-G.8 — Displacement and same-id ownership.** Start old run items X and Y, then displace
  with a new run that re-enqueues X but not Y. Y is synchronously `pending`. Drive old X through
  both abort rejection and late success while the new X is separately observed at `pending`,
  `running`, `persisting`, and terminal status; the old continuation never changes the new
  status or task. Applied persistence from the new X completes. Mutations omitting the
  `reserveRun` sweep, sweeping after new installation, or removing token ownership from either
  catch or success guard fail. This is base-red and is the required same-id hazard proof.

- **T-G.9 — Persist and registry survival.** (a) Cancel during `persisting`: persist receives no
  cancellation, completes, and yields `done`; rejection yields the existing identity-scoped
  `save-failed`. (b) With a save-failed entry, user cancel preserves the exact entry, scoped
  count, `retrySaves`/`retryItem` behavior, and approval block; save-only retry still uses zero
  provider calls. (c) Pre-existing `error` and `done` items survive cancel unchanged. Retain the
  existing outcomes pin at lines 499-505. Named mutations that sweep `persisting`, abort
  persist, invalidate registry, reset every status, or unblock approval fail. These are
  existing-true/frozen behavior and use D7 mutation evidence.

- **T-G.10 — Real scene-batch cancellation and resume.** Under G7, start a production scene
  batch, click the real `Cancelar`, and prove invocation pickup stops; cancelled unapplied
  scenes rejoin the exact `Generar escenas faltantes (N)` count. Clicking it dispatches only
  scenes still missing options, preserves already applied work, and no auto-kick spontaneously
  restarts after cancel. The status/count half is base-red. Mutations to option-derived
  collection, cancel normalization, or auto-kick consumption fail.

- **T-G.11 — Real cover/end control and collectability.** Under G7, while a cover/end run is in
  stagger, backoff, and in-flight provider states, the step exposes one enabled `Cancelar`
  control. Clicking it calls the production cancel path, prevents future sibling dispatch,
  returns unapplied cover/end items to a collectable/idle UI state without remount, and leaves a
  `persisting` sibling alone. The finalization gate no longer strands on a cancelled `running`
  item. Mutations removing the control, keying it only to one card's `running` status, retaining
  the false busy strand, or cancelling persist fail. This is base-red where the control/status
  changes.

- **T-G.12 — User versus destructive lifecycle.** Under the real editor stack, user Cancelar
  causes zero epoch bumps, story-id nulls, or registry invalidations. Existing delete and
  regenerate A4 tests retain their exact ordering; recovery, finalization, story replacement,
  and unmount remain byte/behavior compatible except for the runner's in-scope status
  normalization when they already call cancel. Mutations adding lifecycle operations to user
  cancel or deleting one from a frozen destructive flow fail. Do not create a false test that
  expects unmount to perform the delete/regenerate four-step sequence.

- **T-G.13 — Accepted notice residue.** Under G7, an abort-ignoring dispatched invocation that
  resolves after cancel with a real `skippedImages` entry still produces the existing Spanish
  notice; duplicates remain deduplicated and prior notices accumulate. The result never applies
  as an image. A normal abort without an envelope adds no notice. A mutation suppressing a real
  late report by run-liveness, replacing instead of accumulating, or allowing the image result
  through fails. This is existing-true behavior pinned by named mutation, not claimed base-red.

## GATES AND EVIDENCE

Frontend only:

- Base must be exactly `5f7b6bd`; record `git rev-parse HEAD`, parentage, clean start state, and
  Node version (reference v22.22.0).
- Reproduce the D6 baseline before implementation: `npx vitest run --no-file-parallelism` =
  760 tests / 6 named `MesaAbiertaDashboard` failures, tsc = 1041 diagnostics, ESLint = 159
  problems. Apply identity-delta comparison in both directions; do not accept a lower raw count
  as proof. Use the existing load/flaky precedent before declaring a regression.
- Run focused concurrency, runner, factory, A2 outcome/contract/integration, A3 registry,
  auto-kick, and G7 production-editor suites. Record every base-red and every named mutation
  command and failure verbatim. T-G.1-T-G.13 behavior changes without base-red evidence are
  FINDINGS; existing/frozen behavior without its named mutation is also a FINDING.
- Prove `supabase/functions/**` diff empty. Prove the three frozen blob SHAs remain exact,
  including FE capture `70204600a10ad1e43595da9a93856b4a6b34b459`.
- Diff-audit production scope: no `runWithConcurrency`, Storage upload, manual save, direct
  story/refine invoke, lifecycle, wire-envelope, corpus, or status-union change. A PB suite
  regression is a FINDING, not authority to patch PB machinery.
- No Playwright surface is required. No live provider call is allowed.

No edge gate is opened because there is no edge branch. The PM's `10d1190` gate record and the
two corpus blobs are reference facts only. No gate authorizes merge, deploy, cross-merge, branch
push to `main`, or release (D9).

## STRIKE / REPLACE

### Strike 1 — registry survival and post-cancel assertions

STRIKE:

> Registry survival across `cancel()` specifically is UNPINNED (the A3 suite contains zero
> `cancel()` calls).

REPLACE WITH:

> The A3 registry suite contains zero `cancel()` calls, but registry survival across cancel is
> already pinned indirectly at `pipelineRunnerA2.outcomes.test.ts:499-505`: after `cancel()`, the
> retained save-failed entry is retried save-only and the item becomes `done` with no new
> provider call. PG retains that pin and adds the missing exact-entry, scoped-count, approval-
> gate, and `retrySaves` proof.

Reason: the named suite inventory is true; the conclusion that survival is unpinned is false.

### Strike 2 — literal absence of post-cancel status assertions

STRIKE:

> **Existing pins (do not re-derive; none assert post-cancel item STATUS):**

REPLACE WITH:

> **Existing pins:** the late-result cancellation tests do not assert immediate cancel-time
> normalization of a `running` item. One existing outcome test does assert a post-cancel status:
> `done` after save-only retry (`pipelineRunnerA2.outcomes.test.ts:499-505`). PG's missing,
> base-red status claim is specifically synchronous/final `running -> pending` with error clear
> for unapplied cancelled work.

Reason: “none” is literally false and obscures the narrower gap PG must close.

### Strike 3 — destructive lifecycle including unmount

STRIKE:

> Destructive lifecycle (A4/A5a, built+reviewed): delete (:1969-1978), replace (:3830-3840),
> unmount (:982) run `invalidateSaveRetries(identity)` → `cancelPipeline()` →
> `storyIdRef=null` → `bumpDraftEpoch()`.

REPLACE WITH:

> Destructive lifecycle remains frozen. Delete (`CuentacuentoEditor.tsx:1971-1977`) and
> regenerate (`:3833-3839`) run invalidate -> cancel -> null story id -> epoch bump. Unmount
> (`:982`) only calls `cancelPipeline()`. Recovery accept/decline/repair invalidate at
> `:1425/:1477/:1489`; they do not run that four-step sequence. PG changes none of these
> lifecycle call sites.

Reason: the draft assigns delete/regenerate's sequence to unmount and uses “replace” too broadly.
That factual error must not become authority to reopen A4/A5a.

### Strike 4 — unconditional abort-catch status write

STRIKE decision 4 in full:

> **Cancelled ⇒ `pending`, normalized at INVALIDATION points, not at late resolution.**
> `cancel()` — and `reserveRun`'s displacement of a prior run — synchronously sweep the item
> map: every `running` item reverts to `pending` (error text cleared); `persisting` items are NOT
> touched (A2: applied work persists to `done`/`save-failed`). The post-generate token guard
> KEEPS returning without a status write — a stale resolution must never stomp a newer run's
> status for the same re-enqueued item id. An abort-caused provider rejection
> (`RetryCancelledError`, or any rejection caught while `signal.aborted === true`) also lands
> `pending`, never `error` — even when a genuine failure raced the cancel (the state-derived
> resume re-offers it either way). Genuine pre-cancel `error`/`done` items keep their status.

REPLACE WITH G3 in full.

Reason: invalidation-time normalization is correct, but saying the later abort catch “also lands
`pending`” without a run-token ownership condition is unsafe. A stale catch can overwrite a
newer same-id run. G3 makes invalidation the owner and makes all stale continuations silent.

### Strike 5 — original acceptance criteria

STRIKE T-G.1-T-G.10 in the draft and replace them with T-G.1-T-G.13 above.

Reason: the old set lacked direct pre-attempt/post-wait retry proof, timer/listener cleanup,
reserveRun same-id ownership, late rejection, exact status-sweep preservation, real cover/end
control states, and a mutation pin for the accepted notice residue. It also mislabeled registry
survival as wholly unpinned.

## FINAL ANSWERS TO THE FROZEN QUESTIONS

- **Q1:** Confirm `phase/pg-cancellation` from `phase/pb-storage-fe`@`5f7b6bd`, frontend-only,
  with no edge branch. PREL alone later integrates reviewed lineage tips. G1 is binding.
- **Q2:** Confirm invalidation-time sweep and the silent successful token guard. `reserveRun`
  displacement must sweep the displaced run, not only `cancel()`. For same-id re-enqueue, the
  sweep occurs before new task installation and every old catch/continuation is token-owned and
  silent after displacement. An unconditional late `setStatus(id, 'pending')` is forbidden.
- **Q3:** Confirm cancellation-wins classification: dedicated `RetryCancelledError` or a caught
  rejection while the run signal is aborted is never `error`, even when a genuine failure races
  cancel. Tightening: status may be written only while the run still owns the item; otherwise
  the invalidation sweep has already normalized it and the catch is silent. A live-signal,
  token-owned genuine failure remains `error`.
- **Q4:** Confirm every named exclusion: Storage uploads and `runWithConcurrency`, four manual
  save callbacks, direct story/refine invokes, all edge code, and destructive lifecycle remain
  out. G8 records each residual. Nothing in PG reopens A2/A3/A4/A5a or PB.
- **Q5:** Cover/end Cancelar is in. G6 defines one enabled step-level `Cancelar` available for
  stagger/backoff/provider activity, wired to the production cancel path, without cancelling
  persistence or redesigning finalization.
- **Q6:** Accept post-cancel notice residue. A dispatched abort-ignoring response reported a real
  drop; PFE accumulation/dedup remains frozen. T-G.13 pins the accepted residue and ensures the
  image result itself remains discarded.
- **Q7:** The original T-G.1-T-G.10 set is not complete or fully mutation-honest. Replace it with
  T-G.1-T-G.13. G7 binds every component case to the production editor/hook/runner/factories and
  permits only literal external-boundary mocks; `use-toast` runs real. Each behavior change is
  base-red at `5f7b6bd`, and each already-true/frozen claim has a named mutation.
