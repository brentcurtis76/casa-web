CODEX REVIEW — PH ROUND 2/2 FINAL — phase/ph-costs@ccb34f7

VERDICT: PASS / CONFIRMED FIXED

The sole round-1 blocker, [B1], is fixed. Both cover/end GENERATE factories now carry the live
selection in the same generated patch as the full options array, reading the selection after
the guarded replace clear. The factory evidence pins the complete returned and enqueued patch;
the real-editor T-H.7 chain proves both the stored `selected_cover` value and the recovered
screen selection after a real remount without `initialStory`; and the required stale-read
mutation fails exactly the four replace cases.

The binding round-1 rulings remain closed. This final round judges only [B1], its permitted
related residue, the two referred decisions, and the updated gates. I found no new defect.

## REVIEW TARGETS AND METHOD

- Closing target: `phase/ph-costs` and `origin/phase/ph-costs` at
  `ccb34f7602be7d72f94031043e1e66cb28530fbd`.
- Round-1 target/parent: `9d96c412d27d44552f2a61e3958822b54127f0f1`.
- Frozen base and exact merge-base: `phase/pcui-warnings` at
  `8ceec7c12d30ab0686a281fcf539b67a2066a99f`.
- The remediation is exactly three commits. Its range is four files, +141/-23. The only
  production file is `src/lib/cuentacuentos/taskFactories.ts` (+11/-2); the other three are
  the permitted factory and T-H.7 evidence files.
- I ran `jb list` and the worktree map first. The shared `casa-web` checkout was on the live M
  track at `f5cfc7d` with its pre-existing `.gitignore` edit; I did not touch it. Inspection,
  gates, base-red, and mutation work used detached disposable worktrees at the pinned SHAs.
- Every Node execution used exact Node `v22.22.0`. No provider call, Playwright run, protected-ref
  checkout, merge, push, deploy, infrastructure action, or Supabase action occurred.
- The temporary base-red and mutation worktrees were returned to clean tracked state after the
  probes. The reviewed head/base worktrees remained clean throughout.

## Q1 — [B1] REMEDIATION MATRIX

| Item | Ruling | Independent evidence |
|---|---|---|
| [B1].1 — complete GENERATE patch and read ordering | **FIXED** | `makeCoverTask` and `makeEndTask` still write each options ref before its setter. On replace, the guarded `!== null` branch writes the selection ref to `null` before its setter. Only after that branch do the factories read `selectedCoverRef.current` / `selectedEndRef.current` into the returned patch. Append therefore carries the surviving valid selection; replace carries explicit `null`, including when no setter call was needed. The remediation diff has no refine hunk: `makeRefineCoverTask` and `makeRefineEndTask` retain their intentionally bare `{coverOptions}` / `{endOptions}` patches. |
| [B1].2 — complete returned and enqueued factory matrix | **FIXED** | `taskFactoriesPH.append.test.ts` expands from 18 to 22 cases. For cover and end, append and replace use whole-object `toEqual` assertions on the returned patch; the no-prior-selection replace cases also require an explicit null key. A separate four-case block runs each production factory's `apply` and `persist`, thereby exercising production `buildSnapshotTask`, and asserts the complete `patch` received by `enqueueGeneratedSnapshot`: full array plus selection for append, full replacement plus null for replace. The pristine 22-case matrix is green. |
| [B1].3 — real persistence/remount selection proof | **FIXED** | T-H.7 still drives the production editor, hook, queue, persisted-row clone, real unmount, and real recovery without `initialStory`. It now requires `persistedDraft().selected_cover === 1` before unmount and `selectedIndex() === 1` on the recovered screen, in addition to the four options in order and the original image at index 1. Thus the positional assertion no longer substitutes for actual selection state. The pristine case passes. |
| [B1].4 — D7 severing evidence | **FIXED** | At `9d96c41`, overlaying the strengthened PH matrix and T-H.7 evidence produced exactly **11 failed / 12 passed**: ten selection-bearing factory cases plus the real persistence case (`selected_cover` received `null`). At head, I reproduced [M2-PM] by capturing both selection refs before the guarded clear and returning those stale values. The 22-case matrix produced exactly **4 failed / 18 passed**: cover/end replace returned/enqueued stale `1` instead of `null`; all append and other cases stayed green. This proves the post-clear read order, not merely key presence, is load-bearing. The mutation was fully reverted. |
| [B1].5 — focused evidence and D6 gates | **FIXED** | The three modified focused files passed **76/76** at pristine head (53 legacy factory + 22 PH matrix + 1 real persistence/remount). Canonical full Vitest at base was 872 passed / 6 failed = 878; at head it was 925 passed / 6 failed = 931. Both failure sets are exactly the frozen six `MesaAbiertaDashboard` cases. TypeScript and ESLint identity gates are empty in both directions as detailed below. |

**Q1 answer: FIXED IN FULL.** The production patch, returned-patch assertions, queue boundary,
stored row, recovered UI state, base-red proof, and stale-read mutation form one continuous and
mutation-sensitive chain.

## Q2 — REMEDIATION RESIDUE SWEEP

The remediation is confined to [B1] and its permitted evidence:

- Round production diff: `taskFactories.ts` only. The only executable hunks are the two
  GENERATE return patches; the cover/end refine factories are unchanged.
- `supabase/**` is empty both for `9d96c41..ccb34f7` and `8ceec7c..ccb34f7`.
- The five ratified frozen-suite repairs have no remediation diff.
- The editor, hook, runner, collector, lifecycle, approval, manual upload/save flows,
  sheets/scenes behavior, cost model, wire contract, Storage behavior, and edge functions are
  untouched in this round.
- The PB fixture remains blob `70204600a10ad1e43595da9a93856b4a6b34b459` at base and head.
  `package-lock.json` remains blob `78669cd2b5969f825ce363057246f6821eb1cbad` at base, round-1
  target, and head.

No new remediation defect or disallowed residue was found.

## Q3 — REFERRED DECISIONS

### (a) Third divergence class in `taskFactories.test.ts`

**RATIFY.** The two changed `toEqual` assertions sit inside the already-authorized cover/end
GENERATE blocks and are mechanically forced by the production patch's new first-class key.
Leaving them at the old shape would make valid production output fail the retained factory suite.
The changes are the minimal full-patch assertions expressly permitted by the round-1 remediation;
they do not alter gestures, provider expectations, refine expectations, or any production scope.
This is properly recorded as a third patch-shape divergence class, but it is in-scope residue.

### (b) Round-1 a3 blob correction

**CONFIRM.** `d458e413b62ea2f5fc21790879c6007ea7dbfdcb`, quoted in
`PH-review-1.md`, is not an object in this repository. The correct blob is
`d458e4139eab89934c46ffd348963ae05dfc990a`, and it is exact at `8ceec7c`, `39e1736`,
`9d96c41`, and `ccb34f7`. This is a review-text transcription correction only; the substantive
byte-unchanged invariant always held.

## Q4 — EXISTING CONTRACT / NO UPLOAD-CATEGORY EXPANSION

**CONFIRM.** The remediation uses the existing draft contract:

- `selectedCover` and `selectedEnd` are first-class fields of `CuentacuentosDraftFull` through
  `CuentacuentosDraft`; `DraftPatch` is a partial of that full draft shape.
- `mergePatch` applies present patch keys, so the explicit selection key participates in the
  same generated-snapshot merge as the corresponding options key.
- The existing persistence mapping writes those values to `selected_cover` and `selected_end`.
- `categoriesFromPatch` decides cover/end upload work from `coverOptions` / `endOptions` only;
  it has no selection-key branch. Adding the selection key therefore creates no new upload
  category or provider/storage surface.

The fix is not contract-coupled and correctly required no hook, wire, runner, or edge change.

## Q5 — GATE CONCURRENCE

Canonical runs under Node v22.22.0:

```text
Focused modified files:      3 files, 76 passed / 0 failed
PH factory matrix:           22 passed / 0 failed

Base full Vitest:            68 files; 872 passed / 6 failed = 878
Head full Vitest:            73 files; 925 passed / 6 failed = 931
Failure set at both SHAs:    exactly the frozen MesaAbiertaDashboard six

TypeScript base/head:        1041 / 1041 diagnostics
distinct normalized IDs:    458 / 458
normalized multiset delta:   0 removed / 0 added

ESLint base/head:            159 / 159 problems (116 errors, 43 warnings)
normalized multiset delta:   0 removed / 0 added
```

TypeScript comparison used the frozen `npx tsc -p tsconfig.app.json --noEmit` command,
discarded positions, normalized detached-worktree paths including paths embedded inside
diagnostic messages, and compared sorted multisets in both directions. I additionally compared
the full multiline diagnostic blocks after the same path/position normalization; that stronger
comparison was also empty. ESLint identities are relative file + severity + rule + message,
with multiplicity retained and line/column discarded; both directions are empty.

## Q6 — FINAL PHASE VERDICT

**PASS / CONFIRMED FIXED.** Combining the binding round-1 rulings with this remediation:

- G1-G5, G7-G8, and G10 remain **MET** under the binding round-1 decision.
- G6 is now **MET**: the complete options array and the original valid selection survive the
  generated snapshot, persisted row, real remount, and recovery.
- G9 is now **MET IN FULL**: the previously missing selection-wiring/read-order claims are
  base-red and mutation-sensitive.
- T-H.1-T-H.6, T-H.8-T-H.10, and T-H.12 remain **MET** under the binding round-1 decision.
- T-H.7 is now **MET IN FULL** at the actual recovered-selection layer.
- T-H.11 is now **MET IN FULL** through the 11-failure base-red record and the exact 4-red
  stale-read mutation.

## FINAL CLOSE

- [B1] five-item remediation matrix: **FIXED IN FULL**.
- Third patch-shape divergence class: **RATIFIED**.
- Round-1 a3 blob correction: **CONFIRMED**.
- Existing-contract/no-new-upload-category check: **CONFIRMED**.
- Scope and residue: **CLEAN**.
- D6 gates: **CONCUR / SATISFIED**.
- G1-G10 and T-H.1-T-H.12: **MET IN FULL**.

PH is confirmed for final phase close at `phase/ph-costs@ccb34f7`. No blocking,
low-confidence, or newly routed gate-5 item remains.
