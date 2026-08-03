CODEX REVIEW — M3a ROUND 2/2 FINAL — `feat/mat-view`@`b7b27e9`

VERDICT: PASS

Round-1 [B1] is CLOSED. The new focused case proves the frozen UTF-16-code-unit
boundary with a supplementary-plane witness, and the exact incorrect implementation
that survived round 1 now fails only that witness. The prior ASCII boundary case stays
green, production remains byte-identical to `c99564d`, and the `+25/-0` remediation
contains no vacuous assertion, shared-fixture mutation, mock leakage, or unrelated
residue.

This is the final round under the §1.5 two-round cap. The binding round-1 rulings remain
closed: production is correct at `MaterialsStepView.tsx:185`; [A1]-[A7], [A10], and
[A11] are MET; all seven deviations remain ACCEPTED; and the assumptions and M3b
readiness notes stand. With [B1] repaired, [A8] and [A9] are now FULLY MET. M3a is
eligible for PM close and Brent-authorized dormant merge handling.

## REVIEW SCOPE AND WORKTREE SAFETY

- The shared `casa-web` worktree was already on exact target
  `b7b27e9b7f082f8d85a28065e800243466cdebf4`; I did not switch it.
- `feat/mat-view` and `origin/feat/mat-view` both resolve to `b7b27e9`. `main` and
  `origin/main` remain `60e9160dbc47bfc15a00777b26f3a0259c047558`.
- `c99564d..b7b27e9` is exactly one commit and one file,
  `src/components/liturgia-builder/__tests__/MaterialsStepView.test.tsx`, `+25/-0`.
  `git diff --check` is clean. The additions begin after the closing brace of the
  untouched ASCII case, so every pre-existing test and assertion is byte-unchanged.
- The production blob is `71c4758d23818b3e9eff6c9c0c346055a9190b31` at both
  revisions, and a direct checkout diff of `MaterialsStepView.tsx` is empty.
- The pre-existing `.gitignore` modification remained untouched and is still the sole
  dirty path in the shared worktree.
- The mutation ran only in a disposable detached worktree. I reversed it with an exact
  patch, verified clean tracked state and the production blob, reran the scoped suite,
  and removed the worktree. No branch, application source, provider, deploy, or plan
  file was changed. This review is the only persistent file written.

Per the prompt, this round judges only the [B1] remediation matrix and permitted
related residue; it does not reopen the binding round-1 rulings.

## [B1] REMEDIATION MATRIX

| Item | Ruling | Independent evidence |
|---|---|---|
| R1 — discriminating UTF-16 witness | **CLOSED** | The new case at `MaterialsStepView.test.tsx:296-311` is immediately after the untouched ASCII case. `String.fromCodePoint(0x1f3a8)` produces one supplementary code point occupying two UTF-16 units; 61 repetitions measure 122 units / 61 code points, while 60 measure 120 / 60. The case requires exactly one hint, locates it in the 122-unit row's own label, and expressly excludes it from the 120-unit row's label. A byte scan finds no U+1F3A8 literal, and there is no `\u{...}` escape; the witness is constructed only through `String.fromCodePoint`. |
| R2 — mutation red and restore green | **CLOSED** | In the detached worktree I changed only `item.name.length` to `[...item.name].length`. The scoped result was exactly **1 failed / 19 passed**, and the sole failure was `[A8] la pista cuenta unidades UTF-16, no puntos de código`. A separate filtered run of the original ASCII 121/120 case passed. After reversing the mutant, the suite returned to **20/20** and the production blob matched `c99564d` exactly. |
| R3 — production and scope unchanged | **CLOSED** | The range is additions-only in the test file. `MaterialsStepView.tsx` has an empty diff and identical blob, no other allowlisted or non-allowlisted file changed, and every earlier test remains outside the added hunk. |

## TEST-HONESTY AND RESIDUE AUDIT

The three new behavioral assertions are independently meaningful:

- `getAllByText(...).toHaveLength(1)` detects both loss of the 122-unit hint and an
  off-by-one hint on the exactly-120-unit row;
- the positive `closest('label')` assertion binds the sole hint to the 122-unit name,
  so a misplaced hint cannot satisfy the case; and
- the explicit negative on the 120-unit row pins the boundary locally instead of
  relying only on the view-wide count.

The code-point mutant demonstrates that the first positive path is load-bearing; an
incorrect `[...name].length` count produces no hint and fails the new case. The
original ASCII case remaining green isolates the discrimination to the new witness,
exactly as [B1] required.

There is no fixture leakage. `astral`, `units122`, and `units120` are case-local;
`renderView` creates fresh callback spies and props on every call; the case adds no
mock, hook, timer, global mutation, or shared collection mutation. Both rows receive
unique ids and local names, and Testing Library's exact text lookup identifies the
60-character span rather than its 61-character sibling. I found no assertion that
cannot fail and no defect in the `+25` lines.

## INDEPENDENT GATES

Canonical runtime was Node `v22.22.0`. The ambient login shell initially exposed Node
26.5.0; I discarded that run and explicitly selected the pinned runtime for every
reported gate and mutation result.

| Check | Result |
|---|---:|
| Scoped `MaterialsStepView.test.tsx` | 20/20 passed |
| Code-point mutant, full scoped suite | exactly 1 failed / 19 passed — new witness only |
| Code-point mutant, original ASCII case | 1/1 passed; 19 skipped |
| Restore-green scoped suite | 20/20 passed |
| Production blob after restore | exact `71c4758d…` identity with `c99564d` |
| `tsc -p tsconfig.app.json --noEmit` | 1033 diagnostics; zero `MaterialsStepView` mentions |
| `eslint .` | 159 (114 errors / 45 warnings); zero `MaterialsStepView` mentions |
| Full Vitest serial | 6 failed / 339 passed; exact six `MesaAbiertaDashboard` failures |

The gate identities therefore remain frozen: the sole behavioral delta from round 1
is the one new passing witness.

## ACCEPTANCE RULING

- **[A8] FULLY MET — behavior and proof.** Correct production uses JavaScript string
  `.length`, hence UTF-16 code units. The committed ASCII case retains the 121/120
  threshold proof, and the supplementary-plane case now distinguishes that unit from
  code points (and, for this witness, graphemes).
- **[A9] FULLY MET.** The formerly surviving code-point implementation is killed by
  exactly the new case, restore-green is clean, production identity is exact, and the
  frozen TypeScript, ESLint, and Mesa-six identities acquire no new failure.

Together with the binding round-1 rulings, M3a meets [A1]-[A11] in full.

## BLOCKING FINDINGS

None.

## SHOULD-FIX

None.

## NITS

None.

## FINAL QUESTION ANSWERS

### Q1 — Is [B1] closed as intended?

**Yes.** The 61/60 supplementary witness distinguishes 122/120 UTF-16 units from
61/60 code points, and the incorrect code-point mutation fails only the new witness.

### Q2 — Did the `+25` introduce a defect?

**No.** Every assertion is falsifiable and row-specific, all data and spies remain
case-local, and there is no fixture, mock, timer, or global-state leakage into other
cases.

### Q3 — Are [A8] and [A9] now fully met?

**Yes — behavior plus the frozen UTF-16 and mutation-proof requirements.**

FINAL CAP RULING: M3a PASS. No gate-5 escalation is required.
