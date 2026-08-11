# RE-PLAN PROPOSAL — D1a (SOP §3.9)

Status: **PROPOSED, not applied.** `PLAN.md` is unchanged pending Brent's approval.
Date: 2026-08-11 · Raised by: PM · Trigger: SOP §1.5 caps both reached.

- Executor rounds: **3 of max 3** (r1, r2, r3)
- Codex phase-review rounds: **2 of max 2** (both FAIL)
- Codex's own verdict says the same: *"Under SOP §1.5 this FAIL requires a re-plan proposal, not
  executor round 4."*

---

## 1. What the plan got wrong, and the evidence

Each round fixed a real defect and each left an **absolute safety claim a text heuristic cannot
support**. That is the plan's error, not the executor's.

| Round | Defect found | How it was found |
|---|---|---|
| r1 | `-not -name '*.test.*'` missed the Deno `*_test.ts` convention | PM ran `census.sh`; `bash -n` could not have |
| r2 | `.json` test evidence has **no naming convention at all** (`corpus_pd_base.json`) | Codex ran the census |
| r3 | Referrer matching can **drop** real copy; the runner check accepts comments and strings | Codex constructed the counterexamples |

**[B1] verified.** The artifact guarantees the imprecision can "never drop" a copy surface. False.
If production reaches a JSON by a constructed or globbed path — no literal basename in any `.ts` —
while an unrelated test names that basename literally, every referrer is a test and the production
file is excluded. The live `index.json` collision is benign at `SOURCE_SHA` and does **not**
validate the general claim.

**I asserted the same false property** in the r3 verification ledger entry — "both branches fail
toward inclusion." It is the fourth property I have asserted in this workstream without testing it.

**[B2] verified by construction:**

```bash
printf '// Deno.test("x", () => {});\n' > a_test.ts   # PASSES — a comment counts as a test
printf 'const note = "Deno.test(";\n'    > b_test.ts   # PASSES — a string literal counts
printf 'Deno["test"]("x", () => {});\n'  > c_test.ts   # FAILS  — a real test is flagged non-test
```

A regex over text cannot distinguish code from comment or string. The check cannot do the job it
was written for.

## 2. The root cause

**D1a's contract asks for a proof that a bash text heuristic cannot deliver.** Its criteria demand
absolutes — "drops no copy surface", "every excluded file is a test" — and every heuristic has a
false-positive and a false-negative direction. Three rounds produced three correct fixes and three
new unprovable guarantees.

This is the same failure that killed six plan drafts — chasing provable completeness — reappearing
one level down. D-N already says the *inventory* is best-effort with a measured blind spot. **D1a's
method never got the same treatment**, and that is the gap.

## 3. Proposed amendment — re-scope D1a, do not split or drop it

**D1a stops trying to prove its exclusions are safe. It defines the rule and its error direction.
D1b — the phase that is allowed to produce results — emits the excluded-file list as evidence, and
that is where a reviewer confirms nothing real was dropped.**

Concretely:

1. **Drop absolute safety language from the method artifacts.** Replace "never drops" with the
   tested error direction and the named cases where the direction is not guaranteed.
2. **Make unresolved evidence fail toward inclusion as an explicit coded rule**, not an emergent
   property someone asserts. If referrer evidence is ambiguous — basename collision, no literal
   reference, dynamically constructed path — the file is **kept**, and the reason is recorded.
   This is Codex's own recommendation.
3. **Replace the textual runner check with evidence by enumeration.** Stop trying to prove "every
   excluded file is a test" with a regex. D1b emits the excluded set as a committed list; a
   reviewer reads it. A short derived list is checkable in a way a fragile regex is not.
4. **New D1b deliverable — `evidence/D1-exclusions.md`:** every path the method excluded, the rule
   that excluded it, and the evidence. This is the audit surface that replaces the guarantee.
5. **Extend D-N to the method, not just the inventory:** *no method artifact asserts a safety
   property it has not tested; every exclusion rule states its error direction and the cases where
   that direction does not hold.*

## 4. What this invalidates

**Blast radius is small — nothing downstream is built yet.**

- **D1a:** criteria A3/A4-shaped absolutes are removed; the runner-check requirement is dropped and
  replaced by rule + error direction. The roots, character class, word list, schema, inclusion rule,
  manifest and hygiene are all **untouched** — Codex passed every one of them across two reviews.
- **D1b-1 / D1b-2:** gain the `D1-exclusions.md` deliverable and a criterion that the excluded set
  is reviewed. Otherwise unchanged.
- **The re-plan gate and Appendix A/B:** unchanged.
- **No feature phase is affected** — none exists.

## 5. Decision Log entry, to apply on approval

| Date | Decision | Rationale | Raised by |
|---|---|---|---|
| 2026-08-11 | **D1a re-scoped: the method states its rule and error direction; D1b proves exclusion safety by enumeration.** D-N extended to method artifacts. | Three executor rounds and two Codex reviews established that a bash text heuristic cannot support the absolute safety claims D1a's criteria demanded. Both §1.5 caps reached. | PM, per Codex D1a review round 2 |

## 6. What Brent decides

1. **Approve this amendment** — I amend `PLAN.md`, then D1a runs one more round under the new
   contract. Note this restarts the executor-round count against an amended phase, which is the
   §3.9 pathway rather than a fourth round against the old one.
2. **Accept D1a as it stands**, logging a second §1.5 override, and carry both findings into D1b as
   known caveats.
3. **Backlog BILINGUE.**

PM recommendation: **1**. The amendment is small, both reviewers have converged on the same
remedy, and option 2 would ship a method whose artifact makes a claim we have proven false — which
is the specific thing this workstream keeps failing on.
