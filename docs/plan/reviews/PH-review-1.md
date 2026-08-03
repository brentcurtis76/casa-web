# CODEX PHASE REVIEW — PH — ROUND 1/2

**TARGET:** `phase/ph-costs`@`9d96c412d27d44552f2a61e3958822b54127f0f1`  
**BASE:** `phase/pcui-warnings`@`8ceec7c12d30ab0686a281fcf539b67a2066a99f`  
**VERDICT: FAIL**

One blocking contract failure remains. Cover/end append preserves the selected index in live
editor state, but the generated snapshot returned by each factory contains only the options
array. The real persistence queue therefore writes the pre-append snapshot's `null` selection.
After an actual unmount/recovery, all four options return but the original chosen image is no
longer selected. This violates G6 and T-H.7, whose frozen wording requires both the complete
options array and the original valid selection to survive reload.

The rest of the production behavior, scope, gates, and evidence meets the frozen contract. This
is round 1 of 2. The complete consolidated remediation scope is the single blocking item [B1]
below.

## Review basis and hygiene

- I ran `jb list` and `git worktree list --porcelain` before inspection. The shared `casa-web`
  worktree was on the live M track with a pre-existing `.gitignore` edit; I did not touch it.
  Inspection, gates, and mutations used disposable detached worktrees.
- Target, local `phase/ph-costs`, and `origin/phase/ph-costs` resolve to `9d96c412d27…`.
  `merge-base(9d96c41, 8ceec7c)` is exactly `8ceec7c`. The range is the reported eight commits:
  `c5b068f`, `a5e0944`, `bd72e1f`, `0df3b9e`, `39e1736`, `d29beac`, `055b7c6`, and
  `9d96c41`.
- The range is 15 files, `+1845/-40`. The only production files are
  `src/lib/cuentacuentos/taskFactories.ts` and
  `src/components/liturgia-builder/editors/CuentacuentoEditor.tsx`.
- `supabase/**` has an empty diff. The PB fixture remains blob
  `70204600a10ad1e43595da9a93856b4a6b34b459`, and
  `useCuentacuentosDraft.a3.test.ts` remains blob
  `d458e413b62ea2f5fc21790879c6007ea7dbfdcb` at base and head.
- The package-lock blob is identical at base, r1, and head. Every Node run used exact Node
  `v22.22.0`. No provider call, Playwright run, merge, push, deploy, infra action, protected-ref
  checkout, edge edit, or shared-worktree edit occurred.
- All temporary probes were confined to disposable worktrees. Their tracked indexes were clean
  before testing; none is part of the reviewed target.

## Blocking finding

### [B1] Append omits the preserved selection from the generated persistence snapshot

Locations at `9d96c41`:

- `src/lib/cuentacuentos/taskFactories.ts:500-520` (cover)
- `src/lib/cuentacuentos/taskFactories.ts:578-591` (end)
- `src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.ph.persist.test.tsx:
  200-227`

Both factories correctly leave the selection ref and setter untouched on `append:true`, so the
selection survives in memory. They then return only:

```ts
return { coverOptions: nextOptions };
return { endOptions: nextOptions };
```

`buildSnapshotTask` passes that patch to `enqueueGeneratedSnapshot`. The queue merges it from
the previous generated snapshot, where the selection is still `null`; it cannot infer the
separately changed live selection. Thus the options are persisted but the current selection is
not.

The committed T-H.7 test selects index 1, appends 2→4, and verifies index 1 in memory. After the
real remount it verifies only that the same image remains *located* at array index 1. It never
verifies that index 1 is still selected. I added that missing assertion temporarily after
recovery:

```text
Expected: 1
Received: -1
```

That is a direct runtime failure under the production editor, real hook, real queue, cloned
persisted row, and remount without `initialStory`.

This is not excused by the factual PH-F2 backlog item. PH-F2 says the act of selecting alone does
not enqueue persistence; that pre-existing limitation can remain out of scope. The failing chain
is different: the user selects and then performs PH's new append, which does enqueue the
generated snapshot. G6 explicitly requires that snapshot/reload path to preserve the original
valid selection, and T-H.7 repeats the requirement as “misma selección/imagen elegida.”

I also proved the smallest remediation direction in a temporary target mutation: returning the
live selection alongside each full options array made the strengthened real-remount assertion
pass:

```ts
return {
  coverOptions: nextOptions,
  selectedCover: selectedCoverRef.current,
};

return {
  endOptions: nextOptions,
  selectedEnd: selectedEndRef.current,
};
```

The exact implementation remains the executor's responsibility, but round 2 must cover all of
the following:

1. Include the live cover/end selection in the generated patch that persists the corresponding
   full options array. Append must carry the existing valid selection; replace must carry
   `null`. Preserve the current synchronous ref-before-setter ordering.
2. Strengthen the factory matrix to assert the full returned/enqueued patch for both cover and
   end: append includes the preserved selection, and replace includes `null`.
3. Strengthen the real-editor T-H.7 chain so that, after the actual remount/recovery without
   `initialStory`, it asserts both four options in order and the same option actually selected.
   Do not substitute “the image is still at the same array index” for selection state.
4. Record a D7 wiring mutation that removes or stales the selection field from the generated
   patch and makes the strengthened persistence test fail.
5. Re-run the focused PH suites, affected retained suites, and all D6 gates.

**CONTRACT-COUPLED: NO.** The remediation belongs to the existing frontend `DraftPatch` and
generated-snapshot path. It requires no wire-envelope, hook, runner, Storage, edge, lifecycle,
or Supabase-function change.

## Q1 — G1–G10

- **G1 MET.** Base, merge-base, one frontend branch, production scope, frozen-suite amendment,
  edge exclusion, and seven direct factory consumers are exact.
- **G2 MET.** Both generate requests send `count:2, modelTier:'pro'`; append uses the live ref,
  preserves order/multiplicity, writes ref before setter, and leaves selection untouched;
  replace writes the result and clears selection with the required generate-only setters.
- **G3 MET.** All four non-empty cover/end batch surfaces append. Both headers use exact `2 más`
  + `Sparkles` + title copy; both selectors use the exact additive label. Empty labels and
  sheets/scenes defaults remain unchanged.
- **G4 MET.** All four productive callsites state intent explicitly. The collector remains
  empty-only with `append:false`; no non-empty cover/end batch-replace surface exists.
- **G5 MET.** Both handlers use the literal live global guard
  `if (isApprovingRef.current || pipeline.isBusy()) return;`. The four batch surfaces follow the
  same global disabled envelope without changing the frozen runner.
- **G6 NOT MET.** Full options persist and reload, but the original valid selection does not;
  [B1].
- **G7 MET.** The executable cost model, populations, exclusions, and invocation accounting are
  accurate. The edge reference still defaults count to 2, caps fan-out at 4, uses one provider
  promise per effective image, and requires no PH edge change. The current
  [official Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) continues to support
  the published rounded image-output figures.
- **G8 MET.** The parameterized cover/end late-resolve cancellation matrix leaves both previous
  options and selection intact, performs no apply/persist/enqueue, returns the item to pending,
  and dispatches nothing afterward. PG behavior remains frozen.
- **G9 NOT MET IN FULL, solely through [B1].** Component claims use the production
  editor/hook/runner/factories/ImageSelector and mock only external boundaries. Copy is constant
  Spanish and mutation-sensitive against both malformed and lexically plausible planted tokens.
  However, the committed persistence assertion cannot fail when selection wiring is severed, so
  D7's “an assertion that cannot fail is a defect” rule is not met for that claim.
- **G10 MET.** D6 baselines, head failure set, identity-delta comparisons, production scope,
  `supabase/**`, fixture, and retained A3 test checks all pass.

## Q1 — T-H.1–T-H.12

- **T-H.1 MET:** count/tier are exact; the sweep has exactly four `4→2` behavior pins and three
  signature-only adaptations across seven direct factory constructions. Refines remain pro and
  count-less.
- **T-H.2 MET:** the cover/end factory matrix proves live-ref append ordering and selection
  preservation in memory, plus replace and guarded clear. Round 2 must extend its patch
  assertions per [B1], but the stated apply behavior itself is present.
- **T-H.3 MET:** collector empty/non-empty behavior and the four non-empty `append:true` callsites
  are pinned.
- **T-H.4 MET:** header + selector for cover + end have exact copy/append behavior. Empty,
  sheets, and scenes controls remain compatible.
- **T-H.5 MET:** double clicks and both same-tick cross-item directions produce one invoke with no
  displacement. Running, persisting, refine, and approval make all four batch surfaces
  unavailable.
- **T-H.6 MET:** one-image partial results append without disturbing prior state; both zero-image
  response shapes retain state and use the existing FE error surface.
- **T-H.7 NOT MET:** options complete the real persistence/reload path, but the actual selection
  does not. The committed test's weaker positional assertion misses this; [B1].
- **T-H.8 MET:** one accepted batch equals one edge invocation with count 2; initial cover + end
  equals two invokes/four requested pro images. Provider fan-out is correctly attributed to the
  read-only edge code, not pretended to be observed by FE tests.
- **T-H.9 MET:** the cover/end late-resolve matrix covers the strongest new append boundary and
  preserves PG's broader frozen matrix.
- **T-H.10 MET:** four refines, sheets/scenes/prop, upload, collector, lifecycle, notices, hook,
  runner, PB, PG, PFE, and PC-UI behavior remain compatible.
- **T-H.11 NOT MET IN FULL, solely through [B1]:** the other required base-red/mutation records,
  runtime, reverts, copy hygiene, and component boundary are sound, but selection persistence is
  not pinned by a severing mutation. Round 2 must supply that D7 proof.
- **T-H.12 MET:** full serial Vitest has only Mesa-six; TypeScript/ESLint identity deltas are
  empty; production diff, blobs, edge exclusion, and operational restrictions are exact.

## Independent D7 record

All probes used Node `v22.22.0` in disposable worktrees and left the reviewed target unchanged.

1. **R1 production removal under the committed r1 evidence.** At `39e1736`, I restored only the
   two production files from exact base `8ceec7c` and kept the committed tests. Factory append
   produced **16 failed / 2 passed**; r1 concurrency produced **6 failed / 3 passed**. Aggregate:
   **22 failed / 5 passed**, with the old destructive/racy behavior exposed.
2. **Strong-form item-only guard.** At head, I replaced both global handler guards with
   same-item status guards covering pending/running/persisting. Concurrency produced exactly
   **2 failed / 10 passed**: cover→end and end→cover same-tick. This reproduces [S3] in the
   required strong form.
3. **R2 matrix base-red at r1.** I ran the head concurrency matrix with r1 editor production.
   It produced exactly **3 failed / 9 passed**: the sibling cover/end visual state and the
   approval-disabled headers.
4. **PH-F1 pfe2 split experiment.** Keeping the new wait but restoring the invalid old payload
   gave **4/4 green**. Keeping valid PNG bytes but removing the wait gave **2 failed / 2 passed**,
   exactly B2a/B2b. Therefore actionability after the failure window, not the valid-byte change
   alone, is the green-maker.
5. **PH-F1 production boundary probe.** A temporary `pbBoundary` test parked cover/end, injected
   an upsert error after scene approval, resolved both into `save-failed`, waited for the real
   next control to become actionable, cleared the error, and clicked append. The invocation
   count advanced from 1 to 2. Production closes the run after the failure window; no product
   change is needed for the old “never closes” claim.
6. **Selection round-trip probe.** Adding the literal post-recovery selected-index assertion to
   the committed real-editor persistence test failed `expected 1 / received -1`. Including the
   live selection in each factory's generated patch made that same assertion pass. This is the
   load-bearing reproduction for [B1].

## Q2 — frozen-question decisions

### (a) Dated G1 frozen-suite scope amendment

**RATIFY.** The amended scope is precise and was held: exactly the five declared retained-suite
files changed; the seven stale selector-handle widenings are exact; the pfe2 repair is exactly
three hunks (valid PNG fixture, handle widening, wait for actionability). No assertion,
expectation, or user gesture changed. The amendment repairs legacy harness assumptions without
opening frozen production scope.

### (b) [B1-PM] global G5 visual reading

**RATIFY.** G5's imperative guarantee is global and live, and the visual affordance must match
it. Header disablement during approval/global running and additive `regenerateDisabled` for the
two cover/end selectors close enabled-looking inert states. Sheets/scenes pass neither additive
prop and retain their output.

### (c) R1 executor assumptions

- **Guarded `!== null` clear: RATIFY.** It reaches the same required null postcondition while
  avoiding a redundant setter; ref and setter remain synchronized whenever a stale selection
  exists.
- **Non-empty-only title: RATIFY.** The title describes append and is truthful only in the
  non-empty state. Frozen empty labels remain exactly unchanged.

### (d) R2 batch-surfaces-only reading of [B1-PM]

**RATIFY.** G5 names the header and `ImageSelector` regenerate batch controls. Retry-save and
manual-upload controls are per-item recovery/input controls, not batch-generation spend
surfaces. Leaving their established envelopes intact is the correct compatibility choice.

### (e) [PH-F1] record and corrected mechanism

**RATIFY / CONFIRM.** The seven handle widenings and pfe2's deterministic harness repair are
sound. My two-part pfe2 experiment reproduces the correction: the run does close when the
failure window finishes, and the wait for actionability is necessary. My real-boundary
save-failed probe confirms the next append dispatches after closure. The earlier “run never
closes” statement remains struck; no production fix follows from it.

### (f) Cost model

**RATIFY.** The executable unit is successful first-attempt image output, not a bill or ceiling.
The arithmetic is consistent:

```text
minimum: 26 flash × $0.0672 + 4 pro × $0.1344 = $2.2848 ≈ $2.28
typical: 42 flash × $0.0672 + 4 pro × $0.1344 = $3.3600
saving:   4 pro × $0.1344                         = $0.5376 ≈ $0.54
append:   2 pro × $0.1344                         = $0.2688 ≈ $0.27
```

Using the published rounded per-image figures yields the documented typical `$3.35`; using the
token-exact figures yields `$3.36`. Populations and exclusions are explicit. No cost UI, hard
cap, warning, or knob is required.

### PH-F2 boundary

**RATIFY THE FACT, STRIKE ITS USE AS A WAIVER.** Selection alone still does not persist and may
remain a backlog item. It does not waive G6/T-H.7 for the selection→append→generated-snapshot
sequence. That in-phase sequence is [B1].

## Q3 — gates and compatibility

Independent canonical runs:

```text
BASE  npx vitest run --no-file-parallelism
      68 files; 872 passed / 6 failed = 878

HEAD  npx vitest run --no-file-parallelism
      73 files; 921 passed / 6 failed = 927
```

The six failures at both SHAs are exactly the frozen `MesaAbiertaDashboard` cases: calendar,
mystery, guest assignment, host assignment, cancel button, and pending status. The complete head
run also establishes that all retained PB/PG/PC-UI/PFE non-Mesa suites are green.

TypeScript produced 1041 diagnostics at base and head. After normalizing both disposable
worktree paths and positions and comparing sorted identity multisets in both directions, there
were zero base-only and zero head-only identities. ESLint produced 159 findings at both SHAs
(116 errors / 43 warnings); file + severity + rule + message identity multisets likewise had
zero differences in either direction.

The full head run is authoritative for the focused suite total. One earlier combined focused run
had a setup timeout in the large surfaces harness under local contention; the isolated rerun was
15/15 and the subsequent canonical full run was green. This is a measurement artifact, not a
product or committed-test failure.

## Consolidated remediation — round 2/2 scope

The sole remediation is [B1]: carry the live selected cover/end value in the generated patch and
prove it survives the real persistence/remount chain. The permitted related changes are the
minimal factory patch assertions, the strengthened T-H.7 reload assertion, and its named
selection-wiring mutation evidence.

Do not alter the hook, pipeline runner, edge, Storage behavior, wire contract, collector,
refines, lifecycle, approval, manual upload/save flows, sheets/scenes behavior, cost model, or
the ratified frozen-suite repairs. Re-run all D6 gates and keep the same scope/blob checks. Round
2 is final under the stated cap.

## Final close decision

**FAIL at `9d96c41`. Do not close PH.** G6 and T-H.7 are not satisfied until the actual selected
option, not merely the image's array position, survives append persistence and real recovery.
All other reviewed requirements are confirmed; round 2 should be confined to [B1].
