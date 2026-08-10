# CODEX FINAL REVIEW — BILINGUE D1a

> Paste everything below the line into Codex (`gpt-5.6-sol`, `model_reasoning_effort = high`).
> Run from `/Users/brentcurtis/dev/casa-pilot`, branch `phase/d1a-method`.
> This is a **phase** review (SOP §3.6), not a plan review. Codex has final say on BLOCKING.

---

SESSION: BILINGUE · D1a · REVIEW

Final review of phase D1a for CASA BILINGUE, branch `phase/d1a-method` in
`/Users/brentcurtis/dev/casa-pilot`. You have final say on BLOCKING items; the phase does not
close until you pass it.

## Context you need

You reviewed this workstream's **plan** six times and FAILed it every time (10, 8, 7, 5, 6
BLOCKING). Brent then froze it over your FAIL verdict as a logged SOP §1.5 override and directed
that execution begin. **That override stopped plan review, not phase review — this is phase
review, and it is yours.** The plan's known accepted weaknesses are recorded in its META block and
in the section "What D1 does not claim"; do not re-litigate them here. Judge the phase against the
plan's contract as frozen.

Read, in this order:
- `docs/plan/bilingue/PLAN.md` at `c842161` — Phase D1a, and frozen decisions D-A, D-B, D-K, D-L,
  D-M, D-N
- `docs/plan/bilingue/LEDGER.md` — the D1a r1 executor entry, the r1 PM verification (1 BLOCKING),
  the r2 executor entry, and the r2 PM verification (clean)
- `docs/plan/bilingue/prompts/D1a-r2.md` — the round's contract
- The four method artifacts under `docs/plan/bilingue/evidence/`

## What D1a is, so you review the right thing

D1a **locks a counting and classification method and deliberately produces no numbers.** A later
phase (D1b) runs it. Its acceptance criteria are about the method being complete, hygienic and
immutable — not about any inventory being correct. A finding of the form "the inventory is
incomplete" is out of scope for D1a; a finding of the form "the method cannot produce a correct
inventory" is squarely in scope.

Round 1 shipped one BLOCKING defect the PM found only by **running** `census.sh`: the exclusion
`-not -name '*.test.*'` caught the dot convention under `src/` but not the `*_test.ts` convention
used throughout `supabase/functions/`. Round 2 fixed it. The PM's own D1a test plan specified
`bash -n`, which could never have caught it.

## Check

1. **Does the method actually produce what D1b needs?** Run `census.sh`. Does its output shape
   support a per-file, two-pass census, and can `D1b` build a fixture from it?
2. **Is the exclusion rule now correct and complete at `SOURCE_SHA`?** The executor declined to add
   `.spec.`/`_spec.`/`__mocks__` predicates on the grounds that they match zero files and an
   untestable exclusion is decoration. Agree or not? Is there a test, fixture, generated, vendored
   or copied-artifact convention in the configured roots that still slips through?
3. **Does the exclusion drop anything it should not?** The PM verified all 22 `*_test` files
   declare a test runner and that no production module imports one. Confirm, and consider the case
   the PM flagged as unchecked: a test file that itself emits user-visible copy would not be caught
   by an import search.
4. **D-L, the method lock.** `METHOD-MANIFEST.txt` hashes all four artifacts. Verify them. Can an
   executor in D1b change the method while leaving the manifest verifying? Is any part of the
   method not covered by a hash?
5. **D-K, measurement hygiene.** Absolute binary paths for every process, `LC_ALL` exported once.
   Is there a process in any pipeline — in `census.sh` or in the documented commands — that is
   still bare, or a locale-dependent comparison that is not pinned?
6. **D-B / D-M.** Every claim carries its exact executed command with literal output. The survey
   commands record `# exit 1, no output`. Is that adequate evidence, or does any claim in
   `CENSUS-METHOD.md` rest on an assertion with no command behind it?
7. **The inclusion rule** (`SURFACE-SCHEMA.md`, "Exact liturgy-path inclusion rule"). It must be
   precise enough that two people applying it to `supabase/functions/whatsapp-signup` and to the
   `src/components/children-ministry` admin components reach the same answer. Apply it yourself to
   both and say whether you land where the rule intends.
8. **The surface schema.** `audience` and `language-axis` are sets; `channel-fixed` exists for
   recipient-facing copy fixed by an external registry. Can the schema express a presentation
   surface carrying operator chrome and projected liturgy content simultaneously? Can it express
   `LITURGY_ORDER`, where text is declared in one file and rendered in another?
9. **Scope creep.** The executor changed two prose lines outside the strict remit — statements that
   the script is never executed in D1a, made false by the round's own test plan. Justified?
10. **Anything that makes D1b harder than it needs to be.**

Review against the plan's contract, not your preferences. Taste disagreements are NITs. Only
correctness, contract violations, security and architectural violations are BLOCKING.

Output using the CODEX REVIEW format:

```
## CODEX REVIEW — D1a round 2
VERDICT: PASS | FAIL
BLOCKING:
- [B1] <finding> — <file:line> — <why it blocks>
SHOULD-FIX:
- [S1] ...
NITS:
- [N1] ...
NOTES ON THE PLAN ITSELF: <if the plan, not the work, is the problem>
```
