CODEX REVIEW — M3b ROUND 1/2 — `feat/mat-wire`@`8e25390`

VERDICT: FAIL

The principal M3b behavior is correct, the PM's gate record is reproducible, and all
three requested dispositions are ACCEPTED. In particular, the checked production tree
contains the corrected canonical-key/free-slot cap predicate, not the tail-truncation-
blind predicate found during execution.

One cross-context quick-add interleaving is still unsafe. A stale save unconditionally
clears the shared repeat-save ref in `finally`, even when a newer context has already
claimed that ref for its own in-flight save. I reproduced the resulting third insert
through the real `inventoryService` boundary. This violates the M-D6 guard and exposes
exactly the additional masked-guard case the frozen question asks for. It is BLOCKING
because Brent's merge makes this inventory-writing feature live.

This is round 1 of the two-round §1.5 cap. M3b needs one consolidated production-plus-
test remediation and a final round-2 review; merge remains blocked.

## REVIEW TARGETS AND WORKTREE SAFETY

- The shared `casa-web` worktree was already on exact target
  `8e25390182492687a6b337ae3f58d386cba4d9f9`; I did not switch it.
- Local and remote `feat/mat-wire` both resolve to `8e25390`. `main`, `origin/main`,
  and the merge-base are exact `b7b27e9b7f082f8d85a28065e800243466cdebf4`.
- The range is exactly four commits: `e16e05b`, `2477e17`, `de60702`, and `8e25390`.
  Its diff is exactly the two allowlisted files, `+1484/-28`; `git diff --check` is
  clean.
- `MaterialsStepView.tsx`, `materialsList.ts`, `inventoryService.ts`, the publish,
  lesson, calendar, and publication services, and both children Edge Functions have
  empty diffs from `b7b27e9`. No service, EF, ExportPanel, or admin surface moved.
- The pre-existing `.gitignore` modification remained untouched and is still the sole
  dirty path in the shared repository.
- Base-red, mutations, and the adversarial save probe ran only in disposable detached
  worktrees. Both worktrees were removed. No branch, application file, provider,
  deploy, or plan file was changed; this review is the only persistent file written.

Canonical runtime for every reported Node command was `v22.22.0`; I discarded the
ambient Node 26 runtime before running evidence.

## BLOCKING FINDING

### [B1] A stale save can release a newer context's repeat-save guard

`ChildrenActivityDialog.tsx:529-575` captures the materials context for each quick-add
save. A reset correctly clears `savingExtraRef` at line 295, allowing the new context
to save. The new save then claims the ref at line 536. The defect is line 571: every
older save executes `savingExtraRef.current = null` unconditionally in `finally`, even
when that older operation no longer owns the ref.

The failing interleaving is:

1. Start and defer an inventory insert in liturgy context A.
2. Change liturgy, which resets all M3b state, enter the materials step in context B,
   and start a second deferred save.
3. Settle A's stale insert. Its context checks correctly suppress stale UI/toast state,
   but its `finally` erases B's live ref ownership.
4. Click the save action for another extra in B while B's first save is still pending.

In a disposable addition to the committed real-stack suite, the third click reached
the real `inventoryService` Supabase insert boundary. The desired at-most-two assertion
failed exactly **1 test / 21 passed**: three insert payloads were recorded. This is not
the already-fixed React batching issue; the current ref guard works for two same-tick
clicks until an obsolete owner clears it.

Required consolidated remediation:

1. Give every save attempt a unique ownership token (an object or symbol is sufficient)
   and store that owner in the ref. In `finally`, clear the ref only when it still equals
   that attempt's owner. Comparing only the material name is insufficient because the
   same name may be added again after a context reset.
2. Preserve the intended reset behavior: abandoning a context must release its guard so
   the new context can save, while a later stale completion must not release the new
   owner's guard. The active owner's normal success/failure must still clear both ref
   and visible `savingExtra` state.
3. Add the focused deferred-save regression through the existing real
   `inventoryService`/Supabase boundary and retain the current same-tick two-button
   witness. The new case must prove the stale settlement admits no third insert and the
   active save can still settle normally.

This is an M-D6/[A6] correctness defect and a D7 proof gap, not a NIT.

## THREE DISPOSITION RULINGS

### 1. [A11] line budget — ACCEPTED deviation

The literal range is `+1484/-28`, above `~600`, but production is only `+421/-28`
(net `+393`). The entire overage is the 1063-line suite. Its topology is materially
stronger than required: all 21 cases use the real publish, canonical-list, lesson,
calendar, publication, age-group, and inventory stack. Given the two-file cap and
file-scoped mocks, the dispatcher is the cost of keeping that proof in the one permitted
suite. The executor reported comfortable context pressure, so the sizing cap's risk
purpose was met. Scope and gates remain exact. I accept the numerical overage without
amending the frozen plan.

### 2. Declared M3b/M4 mutation survivors — ACCEPTED as architecture-masked

I independently reproduced both survivors:

- passing raw checked names plus extras from the dialog leaves **21/21 green**, because
  the frozen M2 service re-canonicalizes at its boundary;
- force-including `availableMaterials: []` leaves **21/21 green**, because M2
  contractually canonicalizes and omits an empty result.

Neither makes the committed production wrong. The dialog visibly exercises its own
canonical result through the 3-row/2-effective counter and both cap witnesses, and the
static call site passes that derived result. For [A5], the honest behavioral control is
M4b: making the effective list include inventory regardless of the checked set fails
exactly the zero-selection test (**1 red / 20 green**). Defense in depth necessarily
masks the two boundary perturbations; the disclosure is accurate and acceptable.

### 3. Mid-round cap-predicate repair — VERIFIED and ACCEPTED

The committed `fitsUnderCap` obtains the candidate's canonical key from the real M-D5
implementation, admits canonical-empty/duplicate names without consuming a slot, and
admits a distinct name only while `current.length < 60`. It does not compare two capped
lists. That is the required repair for the 61st-distinct tail-truncation blind spot.

My `fitsUnderCap => true` mutation fails exactly the two over-cap cases. The executor's
finding and correction are exemplary §1.6-adjacent honesty.

## ACCEPTANCE MATRIX

| Criterion | Ruling | Independent evidence |
|---|---|---|
| [A1] | MET | Base `b7b27e9` independently reproduces 1033 tsc diagnostics, ESLint 159 (114/45), and Vitest 6 failed / 339 passed. |
| [A2] | MET | Continuar stages and enters materials with zero invoke/persistence; Regenerar enters the same step and its eventual body names only `Medianos`. Final-tip base-red is 21/21 red. |
| [A3] | MET | Deferred fetch keeps Generar disabled; success, empty, over-cap canonical-distinct, bulk, and explicit error fallback behave as frozen. Removing `!inventorySettled` gives exactly 3 red; unconditional cap admission gives exactly 2 red. |
| [A4] | MET | The designated noncanonical fixture proves exact literal UI effective list = invoke body = real lesson insert snapshot. Only client and toast are mocked. |
| [A5] | MET | Zero selection shows the escape copy and omits the key from invoke and persisted JSON. M4b is exactly 1 red; the M4 survivor is accepted above. |
| [A6] | **NOT MET** | Payload defaults, failed-save usability, terminal migration, and ordinary simultaneous-click protection work, but [B1] breaks guard ownership after a context transition. |
| [A7] | MET | Canonical/case-insensitive inventory match checks the row with no insert/toast drift; duplicate extra remains a no-op. |
| [A8] | MET as specified | Liturgy change and resetAll clear the M3b UI state; old inventory promises cannot unlock or contaminate the active context, including same-liturgy close/reopen. [B1] is the separate quick-add ownership gap under [A6]. |
| [A9] | MET | Footer states are exactly Continuar / Volver / Generar / Generando…; the rest of the touched copy is Spanish. |
| [A10] | MET, stronger topology | Exactly two `vi.mock` declarations, for the Supabase client and toast. Every case drives the real collaborator stack. |
| [A11] | MET with accepted line-budget deviation | Gate identities and two-file scope are clean; the numerical overage is accepted under disposition 1. |

## TEST-HONESTY AND DISPATCHER AUDIT

The boundary declaration is truthful: the only `vi.mock` calls are the client at line
204 and toast at line 219. There is no collaborator-module replacement. The dispatcher
records terminal operation, payload, filters, and limit; awaits list builders; covers
the actual lesson/material/calendar/publication paths; and throws on every unmodelled
table. Lesson and inventory assertions are taken from recorded Supabase payloads after
the real services build them, not arguments to service stubs.

Its deliberate simplifications—canned successful rows and no independent assertion of
every `.select()`/`.order()` argument—do not make the changed M3b assertions vacuous.
The relevant services are byte-unchanged, `getInventory()` still performs the frozen
name-ascending query, exact invoke/insert bodies are captured, and the literal expected
canonical list plus raw-list inequality prevents [A4] from collapsing into a shared-
helper tautology.

The committed 21 assertions are otherwise falsifiable. The base-red split is complete;
the M-D10, cap, zero-selection, repeat-click, context-token, ci-match, notice, category-
order, and Regenerar controls all turn red in the declared directions. The two honest
survivors are explained above. [B1] is the one missing adversarial interleaving: the
existing repeat-save case has one context, while the context battery defers inventory
fetches rather than inventory inserts.

## FROZEN DECISIONS, LEGACY BEHAVIOR, AND RELEASE SAFETY

- **M-D7:** both generation entries route through `materials`; Volver preserves the
  in-session checkboxes; Regenerar stages exactly one group. No bypass remains.
- **M-D10:** `inventorySettled` and the context token prevent unconstrained generation
  while the active first fetch is pending. Empty and explicit error settlement are the
  intended escape hatches.
- **M-D12:** fixed category order, response/name order within category, extras entry
  order, pre-check, bulk selection, counter, and generated effective-list construction
  share one path. The first-60 canonical-distinct repair is present and mutation-proven.
- **M-D6/[S4]:** exact insert defaults, nullable fields, current-user/null authorship,
  ci-match behavior, saved-extra migration, success/failure copy, and one-name
  generation are correct. Only cross-context guard ownership fails.
- **[S5]:** the state reset and stale-fetch contract are correctly tokenized and tested.
  The same ownership discipline now needs to be applied to quick-add `finally` per [B1].
- **D8:** the new user-facing copy is Spanish and the frozen footer/error/notice strings
  are exact.

The refine, refine-confirm, and results handlers/rendering have no changed diff hunks.
Their guards, feedback retention, refreshes, toasts, and confirmation flow remain as at
`b7b27e9`. The pre-existing generation result/toast logic is preserved; only its entry
is staged behind the materials step. There is no separate legacy dialog suite, so this
ruling comes from direct old/new hunk inspection plus the clean full Vitest identity,
not from claiming nonexistent regression coverage.

The no-materials path is otherwise safe: empty inventory enables generation, fetch
failure shows the explicit unconstrained fallback, and Quitar selección produces no
`availableMaterials` key in either invoke or persisted content. The release blocker is
the inventory-writing quick-add race in [B1]; I found no second release-safety defect.

## INDEPENDENT RUNS

| Check | Base `b7b27e9` | Target `8e25390` |
|---|---:|---:|
| Scoped M3b suite | n/a | 21/21 passed |
| Final-tip suite with base dialog | 21/21 failed | n/a |
| `tsc -p tsconfig.app.json --noEmit` | 1033 | 1033; the same six pre-existing dialog identities, line-shifted only |
| `eslint .` | 159 (114 errors / 45 warnings) | 159 (114/45); both changed files individually clean |
| Full Vitest serial | 6 failed / 339 passed | 6 failed / 360 passed |
| Drop M-D10 gate | n/a | 3 failed / 18 passed |
| Cap always admits | n/a | 2 failed / 19 passed |
| M4 force-include empty key | n/a | 21/21 passed, accepted survivor |
| M4b ignore checked set | n/a | exactly 1 failed / 20 passed |
| M3b pass raw names/extras | n/a | 21/21 passed, accepted survivor |
| New stale-save ownership probe | n/a | exactly 1 failed / 21 passed; 3 inserts observed instead of 2 |

The six full-suite failures at both revisions are exactly the frozen
`MesaAbiertaDashboard` identities.

## SHOULD-FIX

None beyond [B1].

## NITS

None.

## FROZEN-QUESTION ANSWERS

### Q1 — [A1]-[A11]

[A1]-[A5] and [A7]-[A11] are met, with [A11]'s numerical overage accepted as
requested. [A6] is not met because the repeat-save ref lacks owner-safe release.

### Q2 — test honesty

The mock boundary and dispatcher are honest, and I found no assertion that cannot fail.
The two declared survivors are genuinely downstream-masked. I did find the requested
third guard gap: the suite never interleaves a stale old-context save completion with a
new-context save, and that probe exposes [B1].

### Q3 — frozen decisions

M-D7, M-D10, M-D12, the substantive M-D6/[S4] semantics, the specified [S5] fetch/reset
battery, and D8 copy are correct. M-D6's repeat-save guard remains incomplete only in
the cross-context ownership case.

### Q4 — existing dialog behavior

Refine, refine-confirm, results, their guards, and their toasts are preserved by direct
diff inspection. The generation path retains its existing result/refresh/error logic
behind the new staging step.

### Q5 — scope

Exactly the two M3b files changed. `MaterialsStepView`, all M2 services including
`materialsList`, inventory service, and both EFs are byte-unchanged.

### Q6 — release safety

Empty/error/zero-selection escape hatches are intact, but [B1] makes release unsafe:
an obsolete save can admit a concurrent third inventory insert in the active context.

FINAL CAP RULING: M3b FAIL round 1/2. Apply the single consolidated [B1] remediation
and return for round 2/2 FINAL review. Merge remains blocked until then.
