# CODEX FINAL REVIEW — BILINGUE D1a round 4 (amended contract)

> Paste everything below the line into Codex (`gpt-5.6-sol`, `model_reasoning_effort = high`).
> Run from `/Users/brentcurtis/dev/casa-pilot`, branch `phase/d1a-method`, head `2f0924f`.
> Phase review (SOP §3.6). Codex has final say on BLOCKING.
>
> **HISTORICAL — this prompt produced the FAIL(5) verdict in `reviews/D1a-r4-codex-review.md`.**
> Its remedy [B5] rebuilt the phase ancestry, so the head it names no longer exists on the branch:
> `2f0924f`→`f306895`, `138d002`→`f1c87dd`. `98f4e51`, cited in check 5, is preserved on
> `pilot/lean-v2` and still resolves. The re-review prompt is `D1a-codex-rereview-r4.md`.

---

SESSION: BILINGUE · D1a · r4 · REVIEW

Final review of phase D1a for CASA BILINGUE, branch `phase/d1a-method` in
`/Users/brentcurtis/dev/casa-pilot`, head `2f0924f`. You have final say on BLOCKING; the phase does
not close until you pass it.

## Read this first — the contract changed

You reviewed this phase twice and FAILed both times. Your second verdict said a third executor round
was the wrong remedy and that SOP §1.5 required a re-plan. **That happened.** The PM wrote
`docs/plan/bilingue/REPLAN-D1a.md`, Brent approved it on 2026-08-11, and `PLAN.md` was amended.

**Review round 4 against the amended criteria, not the ones you failed.** Under §3.9 the round count
restarts against an amended phase, so this is round 1 of 3 against the new contract; cumulative
executor attempt 4.

What changed in the plan:

- **New frozen decision D-O** — no method artifact asserts a safety property it has not tested. Every
  exclusion rule states its error direction and the cases where that direction does not hold. Where
  evidence is ambiguous the rule fails toward inclusion **in code**. Exclusion safety is established
  by enumerating what was excluded, **never** by a pattern claiming to recognise what is safe to
  exclude.
- **D1a.9 / D1a.10 / D1a.11** — the three new criteria, quoted in `PLAN.md`.
- **D1b.13** — new deliverable `evidence/D1-exclusions.md`. This is where exclusion safety now gets
  established, and it is D1b's work, not D1a's.

Both of your round-3 BLOCKING findings were accepted as correct and drove the amendment. [B1] (the
"never drops" claim is false where production reaches a `.json` by a constructed path while a test
names that basename literally) and [B2] (a regex cannot tell `Deno.test(` in code from the same text
in a comment or a string) are the reason the phase was re-scoped.

Read, in this order:

- `docs/plan/bilingue/REPLAN-D1a.md` — the approved amendment
- `docs/plan/bilingue/PLAN.md` — Phase D1a, criteria D1a.9–D1a.11, decisions D-A, D-K, D-L, D-M,
  D-N, **D-O**, and D1b.13
- `docs/plan/bilingue/prompts/D1a-r4.md` — the round's contract, including its explicit
  out-of-scope list
- `docs/plan/bilingue/reviews/D1a-r4-review-request.md` — the executor's evidence, limits and
  self-named weakest point
- `docs/plan/bilingue/LEDGER.md` — the r4 executor entry and the two entries above it
- The four method artifacts under `docs/plan/bilingue/evidence/`

## What D1a is, so you review the right thing

D1a **locks a counting and classification method and deliberately produces no numbers.** D1b runs
it. A finding of the form "the inventory is incomplete" is out of scope. A finding of the form "the
method cannot produce a correct inventory" is in scope. As of the amendment, so is "the artifact
claims something it has not tested" — and its mirror, "the artifact hides a real unsoundness behind
a stated error direction".

## The one trap in this review

D-O cuts both ways, and the second edge matters more here.

- **Do not ask for a stronger guarantee.** "Detect constructed paths", "match `Deno['test']` too",
  "prove the excluded set contains only tests" — each is the refuted approach and would be the
  fourth unprovable guarantee in this phase. If your finding's fix is a cleverer pattern, it is not
  BLOCKING; say so and move on.
- **But do not let a stated error direction launder a real defect.** If a rule is unsound rather than
  merely unproven — it drops something real *systematically*, or the stated direction is itself
  wrong, or the documented case does not match what the code does — that is BLOCKING and the
  amendment gives it no cover.

## Check

1. **Are the untested absolutes actually gone (D1a.9)?** Read `CENSUS-METHOD.md` end to end, not
   just the diff. Does any surviving sentence assert a safety property with no command behind it?
   The executor kept the "no statically written `*_test` importer" check with limits attached and
   kept the naming-convention survey with a new failure-direction paragraph — is each now a tested,
   scoped claim, or is either still an absolute in disguise?
2. **Does every exclusion rule state its error direction and where it fails?** Stage one's four
   predicates, stage two, the naming survey. Is the r3 [B1] case stated accurately — including that
   the basename-collision branch does *not* cover it?
3. **Is the ambiguity branch real (D1a.10)?** Read `json_is_test_evidence` in `census.sh`. Three
   branches, both ambiguity branches keeping, a reason recorded per path. Is the classification
   correct? Is the branch ordering right — should collision be tested before referrers or after?
   Can a file take a branch whose recorded reason misdescribes why it was kept?
4. **Is the `Deno.test` check gone with its claim (D1a.11)?** Anything left in the artifacts that
   still asserts a file is or is not a test on textual evidence?
5. **Did selection change?** The executor claims stdout is byte-identical to the r3 script, not just
   that three counts match. Reproduce it:

   ```bash
   cd /Users/brentcurtis/dev/casa-pilot && export LC_ALL=en_US.UTF-8
   /usr/bin/git show 98f4e51:docs/plan/bilingue/evidence/census.sh > /tmp/census-r3.sh
   bash /tmp/census-r3.sh > /tmp/cs-r3.txt 2>/dev/null
   bash docs/plan/bilingue/evidence/census.sh > /tmp/cs-r4.txt 2>/dev/null
   /usr/bin/diff /tmp/cs-r3.txt /tmp/cs-r4.txt && echo IDENTICAL
   ```

   Then attack it: is there a `.json` in the roots whose classification *should* have changed and
   did not, or one whose branch is a coincidence of this tree rather than the rule working?
6. **The stderr channel — the executor named it as the weakest part.** The ambiguity record goes to
   stderr so the reviewed stdout stays byte-identical, but `census.sh 2>/dev/null` discards it, and
   that is exactly what the round's own test command runs. Is that acceptable given D1b.13 requires
   the list in `D1-exclusions.md`, or does D1a.10's "recorded" require a durable sink? Rule on it
   explicitly — the executor deferred the mechanical enforcement to `D1b-verify.sh`.
7. **D-K hygiene in the new code.** The collision branch adds `/usr/bin/find | /usr/bin/awk |
   /usr/bin/wc | /usr/bin/awk`. Absolute paths throughout? Any locale-dependent comparison not
   pinned? The executor chose exact `$NF ==` matching over `find -name "$base"` to avoid glob
   semantics in a basename — right call, or is there a case it breaks?
8. **D-L / D-M.** `METHOD-MANIFEST.txt` hashes verify (confirm). No measurement result in a prose
   artifact. Every claim in the review request and ledger carries its literal command and literal
   output rather than a prose summary of one.
9. **A7 / D1a.8 — rule on this.** `git diff --name-only pilot/sop-v2...HEAD` also lists
   `docs/plan/HANDOFF-PROCESS.md` and `docs/plan/SOP-PILOT.md`. `git log` attributes both to
   `98f4e51 docs(plan): activate lean workflow v2`, committed onto this phase branch before r4
   began; they are workflow-process documents, not source, schema or configuration. The executor
   declined to rewrite another owner's commit and flagged it instead. Is D1a.8 satisfied by the
   branch as constituted, or does `98f4e51` have to move?
10. **`PLAN_SHA` staleness.** All five artifacts pin `c842161` (the freeze commit), not `f2be4f2`
    (the approved amendment). Updating it would touch `SURFACE-SCHEMA.md` and `wordlist-passB.txt`,
    both out of scope for r4, and rehash artifacts you already passed. BLOCKING, SHOULD-FIX, or
    correct as is?
11. **Scope.** The contract allowed three changes. Did the executor make exactly those three, or
    did anything else move? Note that `SURFACE-SCHEMA.md` and `wordlist-passB.txt` are byte-identical
    to the versions you passed.
12. **Next-phase cost.** Anything here that makes D1b harder than it needs to be — particularly
    whether `D1-exclusions.md` (D1b.13) is actually reachable from what this method now emits. The
    executor notes D1b must derive the *excluded* list itself, since `census.sh` records ambiguous
    keeps only.

Review against the amended contract, not your preferences. Taste disagreements are NITs. Only
correctness, contract violations, security and architectural violations are BLOCKING.

If your verdict is that the amended contract is itself wrong, return `FINDINGS` rather than `FAIL` —
that routes to another re-plan, not to another executor round.

Output using the CODEX REVIEW format:

```
## CODEX REVIEW — D1a round 4
VERDICT: PASS | FAIL | FINDINGS
BLOCKING:
- [B1] <finding> — <file:line> — <violated criterion or invariant> — <smallest safe correction>
SHOULD-FIX:
- [S1] ...
NITS:
- [N1] ...
NOTES ON THE PLAN ITSELF: <if the plan, not the work, is the problem>
```
