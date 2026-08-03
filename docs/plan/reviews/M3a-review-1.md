CODEX REVIEW — M3a ROUND 1/2 — `feat/mat-view`@`c99564d`

VERDICT: FAIL

The production component implements the frozen M3a behavior correctly and remains
genuinely inert. The scoped suite is otherwise strong: its copy, cap, M-D12 ordering,
callback, quantity, loading/error/empty, extras, and zero-selection assertions are
falsifiable, and I found no vacuous assertion. One load-bearing test-honesty gap
remains, however: the [A8] test says it proves the 120-unit UTF-16 boundary but uses
ASCII-only inputs, so an incorrect code-point implementation survives all 19 tests.
That leaves [A8]'s frozen unit and [A9]/D7 incompletely proved.

This is round 1 of the 2-round §1.5 cap. M3a needs one consolidated test-only repair
and a final round-2 review. No production change is requested.

## REVIEW TARGET AND WORKTREE SAFETY

- The shared worktree was already on exact target
  `c99564dd9c2ac549f279cbdfd5401d96bab95b97`; I did not switch it. I ran `jb list`
  before creating any review worktree or applying any mutation.
- `feat/mat-view` and `origin/feat/mat-view` both resolve to the target. `main`,
  `origin/main`, and the merge-base all resolve to
  `60e9160dbc47bfc15a00777b26f3a0259c047558`.
- The range is exactly one commit and exactly the two allowlisted new files,
  `+573/-0`; `git diff --check` is clean.
- The pre-existing `.gitignore` modification remained untouched and is still the
  sole dirty path in `casa-web`.
- The adversarial mutation ran in a disposable detached worktree, which was removed.
  I made no branch, provider, deploy, source, plan, or other persistent change. This
  review is the only file written.

## BLOCKING FINDING

### [B1] The [A8] test does not distinguish UTF-16 code units from code points

Production is correct at `MaterialsStepView.tsx:185`: JavaScript `name.length` counts
UTF-16 code units, so the hint appears when the M-D5 limit will abbreviate the name.
The test at `MaterialsStepView.test.tsx:276-286`, however, uses only 121 ASCII `A`s
and 120 ASCII `B`s. For those inputs, UTF-16 units, Unicode code points, and grapheme
counts are identical.

I changed only the production predicate in a detached target worktree from
`item.name.length` to `[...item.name].length`, an incorrect code-point count. The
committed suite still passed **19/19**. I then added a review-only discriminating
witness: 61 supplementary-plane emoji (122 UTF-16 units, 61 code points) versus 60
emoji (120 units). With the same mutant, exactly that added probe failed and the
original 19 still passed.

This is a real gap because M-D5 deliberately freezes the unit to UTF-16 code units,
and [A8] expressly requires the hint at that unit boundary. The executor's 42 killed
mutations establish broad sensitivity but do not cover this plausible wrong
implementation.

Required round-2 remediation:

1. Extend the existing [A8] case (or add one focused case) with a surrogate-pair
   witness that proves 122 UTF-16 units gets the hint and 120 units does not.
2. Re-run the code-point-count mutation and record the expected red result.
3. Keep production and every other M3a behavior unchanged; remain inside the same
   two-file allowlist.

## INDEPENDENT GATES

Canonical gate runtime was Node `v22.22.0`.

| Check | Result |
|---|---:|
| Scoped `MaterialsStepView.test.tsx` | 19/19 passed |
| `tsc -p tsconfig.app.json --noEmit` | 1033 diagnostics; no `MaterialsStepView` identity |
| `eslint .` | 159 (114 errors / 45 warnings); both new files clean |
| Full Vitest serial | 6 failed / 338 passed; exact Mesa-six + all 19 M3a tests |
| Supplementary `npm run build` | PASS; existing chunk-size and stale-Browserslist warnings only |
| Code-point-count mutation | 19/19 still passed — [B1] survivor |
| Same mutation + surrogate-pair probe | exactly 1 failed / 19 passed — probe alone red |

The full-tree gate identities match the frozen baseline. The two new files add no
TypeScript or ESLint identity, and the only additional Vitest outcomes are the 19 new
passes.

## ACCEPTANCE MATRIX

| Criterion | Ruling | Evidence |
|---|---|---|
| [A1] | MET | Executor/PM chronology records the base gates; I independently replayed the target gates and confirmed the frozen identities. |
| [A2] | MET | Imports are limited to React, shadcn UI, Lucide, brand-kit, pure materials constants, and type-only children-ministry types. There is no fetch, effect, Supabase, service, toast, or provider access; local state is only the draft input. |
| [A3] | MET | Fixed category order is `craft → book → supply → equipment → other`; checked state is prop-controlled; the unsorted fixture proves parent order is preserved inside categories. |
| [A4] | MET | At cap, all unchecked inventory boxes and `Agregar` are disabled, checked rows remain toggleable, and the exact cap line renders. The named cap-disable mutation is sensitive. |
| [A5] | MET | Both bulk callbacks carry the correct booleans and the counter renders the prop value over the shared 60 constant. |
| [A6] | MET | Loading, error, and empty copy match the frozen Spanish text exactly, with mutually appropriate list/empty behavior. |
| [A7] | MET | The input has `maxLength=120`, sends the raw typed value, clears after add, renders extras in entry order, dispatches save by name, and exposes the saving spinner/disable state. |
| [A8] | BEHAVIOR MET; REQUIRED PROOF NOT MET | Production uses UTF-16 units and the 121/120 threshold is correct, but the ASCII-only test does not prove the frozen unit; [B1]. |
| [A9] | NOT MET | The recorded mutation battery is broad, and every committed assertion is capable of failing, but the load-bearing code-point mutant survives all 19 tests. |
| [A10] | MET | Every specified user-facing string is Spanish and has an exact committed assertion; gates add no new identity. |
| [A11] | MET | Exactly the two listed files changed. The sole import is from the test in the pair; no application module imports the component. |

## TEST-HONESTY AUDIT

- **Assertions:** I found no assertion that cannot fail. Positive and negative cap,
  checkbox, badge, state, spinner, and zero-note claims all observe distinct DOM or
  callback behavior.
- **D8 copy table:** every phase string is pinned exactly: context, intro, loading,
  error, empty, five headers, both bulk labels, counter, cap line, input placeholder,
  `Agregar`, extras heading, save action, long-name hint, and zero-selection note. I
  found no copy mutation hole comparable to [B1].
- **M-D12:** category-header order and complete checkbox document order are asserted;
  the deliberately unsorted craft input proves the view does not take ownership of
  within-category sorting. Extras are mapped in entry order, and the first save-button
  callback assertion also makes that order observable.
- **121/120 boundary:** `>` versus `>=`, 121 versus 120, hint removal, and hint
  relocation are covered by the current case. Only the unit distinction is missing.
- **Overall section order:** the production DOM follows the phase sequence (context,
  intro, state/list, counter, cap line, input, extras, zero note). The suite does not
  pin every cross-section relative position, but the frozen acceptance criteria only
  demand deterministic category/row/extra ordering; I do not treat a whole-view
  positional snapshot as required evidence.

## PM-ACCEPTED DEVIATIONS

- **D1 ACCEPTED.** Suppressing `Generarás para:` for an empty `groupNames` array avoids
  an empty context sentence and changes no specified non-empty behavior.
- **D2 ACCEPTED.** Trim-non-empty gating prevents a callback the M-D5 parent would
  necessarily drop. A valid add still passes the raw typed value and clears the field.
- **D3 ACCEPTED.** Accessible names on Radix checkboxes are production-appropriate and
  keep repository test IDs out of the component. They do not alter the props contract.
- **D4 ACCEPTED.** Extras being checked and disabled is the only honest representation
  under the frozen props, which provide save but no toggle/remove callback. The backlog
  observation correctly owns any future removal affordance.
- **D5 ACCEPTED.** Keeping the counter, input, extras, and zero note usable under
  `loadError` implements the explicit unconstrained fallback and preserves one-offs.
- **D6 ACCEPTED.** `Seleccionar todos` remaining enabled at cap does not bypass the
  disabled row controls. M3b owns M-D12 first-60 canonical-distinct bulk selection and
  effective-list construction; that binding belongs in its tests.
- **D7 ACCEPTED.** The supplementary production build is a harmless strengthening and
  passes. Its existing warnings are unrelated to M3a.

## ASSUMPTIONS AND M3b READINESS

- The component correctly owns fixed category grouping and DOM rendering order while
  the parent owns inventory response/name order inside each category. The unsorted
  fixture locks that boundary.
- Quantity badges render only for `quantity > 0`. Zero-quantity rows remain normal,
  enabled selectable rows; the zero-quantity `Pegamento` callback case and the absence
  of `x0` jointly prove M-D1 behavior.
- The props are sufficient for M-D10 gating: `isLoading`/`loadError` render the step,
  while the dialog footer and its first-fetch-settled eligibility remain parent-owned.
- Cap flow is sufficient: `capReached` and `effectiveCount` are derived parent state;
  item and bulk callbacks let M3b enforce first-60 canonical-distinct selection without
  duplicating M-D5 in the view.
- `savingExtra: string | null` is sufficient under M3b's frozen case-insensitive extra
  dedupe invariant. The parent must still guard repeat inserts and, on success, move
  the name from extras into the checked inventory group per M-D6; none of that belongs
  in this presentational component.
- No prop or local-state choice makes M3b harder than frozen. The component is exported
  but unreferenced by the application and therefore inert until M3b wires it.

## SHOULD-FIX

None beyond [B1].

## NITS

None.

FINAL CAP RULING: M3a is not yet eligible for close/merge handling. Apply the single
test-only UTF-16 witness remediation and return for round 2/2 final review.
