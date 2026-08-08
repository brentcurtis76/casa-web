SESSION: UPGRADE · P2 · REVIEW

Final review of phase **P2 — Módulo puro de asignación** for UPGRADE (La Mesa Abierta ·
opt-out del plato principal). You have final say on BLOCKING items. The phase does not close
until you pass it.

Repo: `/Users/brentcurtis/dev/casa-web`, currently on the branch under review,
`feat/mesa-md-alloc`@`621b0ab` (pushed to origin). There is a second worktree at
`/Users/brentcurtis/dev/casa-upgrade` on `feat/mesa-md-schema` (P1, already merged) — ignore it
or reuse it, but a fresh worktree needs `npm ci` before the gate will run. Use **Node v22.22.0**
for Vitest; a newer Node gives a different result, which you yourself caught in the P1 review.

Read `docs/plan/upgrade/PLAN.md` — frozen at revision 7, **amended again on 2026-08-08 with a
sixth Decision Log row** (see item 7 below) — and the P2 entries in
`docs/plan/upgrade/LEDGER.md`. There are three: the PM bootstrap, the executor's r1, and the
PM's independent verification.

## What shipped

Three new files, +1312 lines, zero deletions, nothing else in source touched:

- `supabase/functions/_shared/mainDish.ts` (437) — the canonical rule. Leaf module, zero
  imports, no `Math.random`. D1 quota, D7 host-first, and a bounded local search over guest
  swaps that is meant to satisfy the eleven D5 guarantees.
- `supabase/functions/_shared/mainDish_test.ts` (827) — 19 Deno tests over 11 fixtures, all
  driven through a reusable invariant verifier.
- `src/lib/mesa-abierta/__tests__/mainDishImport.test.ts` (48) — test 20, the cross-runtime
  import proof.

Nothing imports the module yet; P4 wires it. **No database, no network, no framework** — unlike
P1, every claim here is reproducible by you from a clean checkout, so hold it to that standard.

## The eight things I want you to attack hardest

**1. Guarantee 6 rests entirely on a reading of the code, and that is by design — so audit the
reading, not the tests.** D5's "Cómo se establecen" says no finite set of examples can
establish it. The argument is: in `findImprovingSwap` (`mainDish.ts:265-268`),
`after = before - d(receiver) - d(donor) + d(nextReceiver) + d(nextDonor)`, and the guard
`if (after > before - 1) continue` accepts only a strict decrease. The argument's load-bearing
premise is that **only those two tables change**. Verify that premise against
`balanceMainDishCarriers` (`:316-329`) rather than accepting it: the loop writes exactly
`working[receiverIndex]` and `working[donorIndex]`. If any path can change a third table's
deficit — or if `before`, captured once at the top of `findImprovingSwap`, can go stale within
a scan — G6 and therefore G7 both fall, and that is BLOCKING.

**2. The invariant verifier shares two functions with the module it verifies, and I am telling
you rather than letting you find it.** `verifyInvariants` recomputes deficits via
`deficitOf` → `requiredMainDishes(tablePeopleCount(table))` — both **imported from
`mainDish.ts`**. So a wrong quota or a wrong people-count would be invisible to tests 4–19,
because the verifier would be wrong the same way. The file says so in a comment and argues the
exposure is bounded because tests 1 and 2 pin those two functions independently (test 1 with a
15-row table, test 2 by construction). **Rule on whether that containment is real.** My
judgement was that it is — the shared surface is exactly two small pure functions, both pinned
by tests that do not use the verifier — but this is the kind of circularity that looks fine
until it isn't, and you are better placed than I am to say so.

**3. G8 is the guarantee that catches an implementation that under-assigns, so try to make it
under-assign.** `allocateTableFood` sets `mainDishCount = min(required, willing)`, hands the
host a main dish first when able, then draws the rest from a pool of willing guests. The claim
is that the `while (remaining > 0 && pool.length > 0)` loop can never exit with
`remaining > 0` — because `mainDishCount ≤ willing` and `willing` is exactly the host's
contribution plus `pool.length`. Check that arithmetic yourself for the case where the host is
excluded and for the case where `pool` is empty. If the loop can exit early, the module reports
a shortfall it did not have to have, satisfies every other guarantee, and is still wrong — that
is precisely the failure mode you raised in round 6 that put G8 in the plan.

**4. G5 is implemented more strictly than the plan words it, and coverage is the cost.** The
plan says "ningún intercambio deja a la mesa donante en déficit". The code enforces
`tableDeficit(nextDonor) !== 0 → reject`, which additionally forbids **every** swap between two
tables that are both in deficit, even when the total would drop. The executor declared this
himself and pointed at fixture F4. I ruled it a NIT: D5 explicitly requires no exhaustiveness,
and G10 exists so an honest shortfall is a correct answer. **Rule on it independently.** If you
think the plan's words permit a swap that leaves a donor no worse than it started, the
implementation is leaving reachable coverage on the table, and P4 will inherit it into
production. I would rather hear that now than after the first month's dinners.

**5. `boundedIndex` silently clamps a `pick` that violates D11.** `mainDish.ts:343-347` catches
NaN, negatives and out-of-range and returns a valid index anyway. It is documented as a trust
boundary because `pick` is caller-injected. But clamping is also how a broken caller's bug
survives to production undetected — P4 injects the real `pick`. Judge whether defensive
clamping or a thrown error is right here, and whether "never called with `n <= 0`" is actually
guaranteed by the two call sites.

**6. Determinism (G11) and the fixtures' non-vacuity.** Test 19 asserts same-input-same-`pick`
gives the same result using a seeded LCG. Satisfy yourself the module has no other entropy —
no `Date`, no iteration over a `Set`/`Map` whose order could vary, no `sort` with an unstable
comparator. Separately: tests 4, 5, 6, 7, 9, 11 and 12 carry non-vacuity assertions
(`movesSeen > 0`, `excludedCarriersSeen > 0`) so a fixture table that stopped exercising a
guarantee fails instead of passing green. **Check the guarantees that have no such assertion**
— if any of tests 8, 10, 13–18 can pass vacuously on all 11 fixtures, that guarantee is
untested and the suite is quieter than it looks.

**7. I amended the frozen plan during my own verification round. Judge whether that was
legitimate.** You challenged exactly this in the P1 review (item 3) and were right to. This
time: the plan's "Aritmética de tests" projects Vitest absolutes from a base of 1036 measured
at `1732bee`. I measured the real parent (`main`@`981c00f`) at **1062 pass / 6 fail** — 26
tests arrived from other workstreams, not from this plan. I added a dated note correcting the
projection to 1094/1100, kept the deltas and the historical baseline table untouched, and wrote
a Decision Log row. Nothing was unblocked by it: D8 point 2 compares attributable reds against
the parent and point 5 records totals as observation only. **But it is still the PM editing a
frozen document in the same round it is grading**, which is the shape of a self-serving
amendment even when the content is not.

**8. Scope and the deferred proof.** Expected diff: exactly three new source files plus
`docs/plan/upgrade/`. B3 asserts nothing imports the module from any
`supabase/functions/**/index.ts`; B8 deliberately does **not** prove `vite build` resolves the
cross-runtime import — D6 defers that to P6, the first production consumer. Check that the
deferral is honestly recorded and not a gap dressed as a decision, and that the relative
specifier `../../../../supabase/functions/_shared/mainDish.ts` needs no alias, tsconfig entry
or build step, as claimed.

## Verify, don't take the ledger's word for it

1. **Every acceptance criterion B1–B9 against the code**, not the report. I marked all nine
   `[x]` in `PLAN.md` on my own verification; treat those checkmarks as a claim to test.
2. **Run the gate yourself** on the tip:
   `bash scripts/gates/changed-files-diagnostics.sh` over the three files. Check `$?`
   explicitly; **never pipe it through `tail`**, which has masked a real failure twice here.
   Expected: exit 0, `(0)(0)(0)(0)` for each file, project totals
   `tsc=1039 eslint=160 deno-lint=94 deno-check=46`.
3. **Run the suites yourself.** `deno test --allow-all .` from `supabase/functions/` → expect
   **428 pass / 0 fail** (409 + 19). `npx vitest run --no-file-parallelism` → expect
   **1063 pass / 6 fail** on the tip and **1062 / 6** on the parent; I measured both by full
   checkout, not by moving files aside. The 6 reds are `MesaAbiertaDashboard.test.tsx`, P8's to
   fix. Three `CuentacuentoEditor.ph.*` files flake under load (backlog B-05) and did not fire
   in either of my runs — if they fire in yours, D8 point 2 as amended settles it against the
   parent.
4. **Violations of the frozen decisions**: D6 (leaf module, zero imports), D11 (no
   `Math.random`, randomness only via injected `pick`), D5 (the eleven guarantees), D10
   (user-facing text — none here, but check), D12 (no member data anywhere in the committed
   files or ledger entries).
5. **The aliasing failure class this code has had before.** `index.ts:305` documents a past fix
   for "un invitado en dos cenas". G9 exists because of it. I checked that
   `balanceMainDishCarriers` captures `receiver` and `donor` before writing and that
   `swappedTable` returns fresh objects, so the second call still reads the original list —
   confirm, or break it.
6. **Anything that makes P3a, P3b or P4 harder than it needs to be.** P4 wires this module into
   `matching.ts` and may change only goldens 5 and 6. If the API shape forces P4 to touch more,
   say so now — the API is frozen from here.

Two judgement calls I made that you should overturn if you disagree: the executor derived
`requiredMainDishes` per table rather than storing it on `TableInput` (the plan's prose mentions
it as a field; the frozen text only fixes `maxGuestUnits`), and `Food` includes the DB enum's
`"none"` member which the module never emits. I accepted both.

One inaccuracy I found and did not treat as blocking: the test file's header comment says
"EVERY test below calls it" of the verifier. Tests 1–3 do not, and should not — they are pure
contract tests that allocate nothing. B6 only requires the allocation and rebalancing tests,
and all sixteen of those (4–19) do call it. The comment overstates; the code does not.

Review against the plan's contract, not your preferences. Taste disagreements are NITs. Only
correctness, contract violations, security and architectural violations are BLOCKING.

Output using the CODEX REVIEW format. Write your review to
`docs/plan/upgrade/reviews/REVIEW-P2.md`.
