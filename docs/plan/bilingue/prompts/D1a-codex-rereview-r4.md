# CODEX RE-REVIEW — BILINGUE D1a round 4 remediation

> Paste everything below the line into Codex (`gpt-5.6-sol`, `model_reasoning_effort = high`).
> Run from `/Users/brentcurtis/dev/casa-pilot`, branch `phase/d1a-method`.
> Re-review of the **cumulative** diff after your FAIL(5). Codex has final say on BLOCKING.

---

SESSION: BILINGUE · D1a · r4 remediation · RE-REVIEW

You FAILed D1a round 4 with 5 BLOCKING, 1 SHOULD-FIX and 1 NIT, and noted that **no re-plan is
needed — the amended contract is sound**. The same executor fixed the consolidated list in one
batch, per lean overlay §4.2. Re-review the cumulative diff.

Your verdict and the executor's triage of every item are committed at
`docs/plan/bilingue/reviews/D1a-r4-codex-review.md`. **All five BLOCKING were accepted; none were
disputed.** This is still cumulative attempt 4 — the remediation is not a fifth round.

## The ancestry changed, so read this before you run any git command

Your [B5] required rebuilding the phase ancestry without `98f4e51`. Brent authorised the history
rewrite. What happened:

```text
$ /usr/bin/git branch pilot/lean-v2 98f4e51      # preserved BEFORE the rebase
$ /usr/bin/git push origin pilot/lean-v2
$ /usr/bin/git rebase --onto f2be4f2 98f4e51 phase/d1a-method
$ /usr/bin/git push --force-with-lease origin phase/d1a-method
```

- `2f0924f` → `f306895`, `138d002` → `f1c87dd`, `6b9a27d` → `c0f8ee9`. The old SHAs are unreachable.
- **`98f4e51` still resolves** — it lives on `pilot/lean-v2`, local and pushed. The byte-identical
  census proof cites it and was re-run after the rebase.
- `docs/plan/SOP-PILOT.md` and `docs/plan/HANDOFF-PROCESS.md` are no longer on this branch. The
  base-gate baseline (118 lint errors, 15 failing tests at `d5b16e8`) that the gate-set
  justification cites is in `SOP-PILOT.md` **as of `98f4e51`**, i.e. on `pilot/lean-v2`.

## Read

- `docs/plan/bilingue/reviews/D1a-r4-codex-review.md` — your verdict, and the disposition of each item
- `docs/plan/bilingue/reviews/D1a-r4-review-request.md` — updated evidence
- `docs/plan/bilingue/LEDGER.md` — the r4 entry and the remediation entry appended after it
- `docs/plan/bilingue/PLAN.md` — D1a.9–D1a.11, D-O, D1b.13
- `docs/plan/bilingue/prompts/D1a-r4.md` — the round's contract and its out-of-scope list
- The four method artifacts under `docs/plan/bilingue/evidence/`

## Verify each fix, and try to break it

1. **[B1]** `CENSUS-METHOD.md`, the surviving importer probe. It is now stated as the one specifier
   shape the command searches, with the side-effect import you named, dynamic `import()`, runtime
   specifiers, re-export chains, `require`, aliased/extensionless specifiers and out-of-root
   importers all listed as unseen. Is the claim now exactly co-extensive with the command? Is any
   shape still missing from the disclosure?
2. **[B2]** Both halves. The "beyond the three" formulation is gone, replaced by a report of two
   searches over four literal substrings plus the statement that a convention using none of them
   would appear in neither. The `corpus_pd_base.json` paragraph no longer says "no name predicate
   could have reached it". Does either passage still generalise past its evidence?
3. **[B3]** The fourth predicate's own failure case — a production module whose basename legitimately
   ends in a space plus a digit. Stated where a reader will meet it, or buried?
4. **[B4]** The complete harness and unedited output now appear in both the review request and the
   ledger, with a `sha256` of the function text extracted from `census.sh`. **Run the harness
   yourself** and confirm the output and the hash reproduce. Does it genuinely exercise the branch,
   or does the scratch fixture differ from the live shape in a way that makes the test vacuous?
5. **[B5]** Confirm mechanically:

   ```bash
   cd /Users/brentcurtis/dev/casa-pilot
   /usr/bin/git diff --name-only pilot/sop-v2...HEAD | /usr/bin/grep -v '^docs/plan/bilingue/'
   /usr/bin/git branch -a --contains 98f4e51
   ```

   Is D1a.8/A7 now satisfied? Was anything lost in the rewrite — check that no evidence, citation or
   artifact on this branch now points at an unreachable object.
6. **[S1] was deferred**, with Brent's decision and the rationale recorded in the ledger backlog:
   the fix would touch `SURFACE-SCHEMA.md` and `wordlist-passB.txt`, both out of scope for r4 and
   both byte-identical to versions you passed, and D1b.8 anchors provenance at D1a's merge commit.
   Accept the deferral or restate it as BLOCKING — but if BLOCKING, say what integrity failure it
   causes that the manifest and merge anchor do not already prevent.
7. **[N1]** fixed — confirm.
8. **Regression check.** Selection must still be unchanged and the method lock must still verify:

   ```bash
   cd /Users/brentcurtis/dev/casa-pilot && export LC_ALL=en_US.UTF-8
   /usr/bin/git show 98f4e51:docs/plan/bilingue/evidence/census.sh > /tmp/census-r3.sh
   bash /tmp/census-r3.sh > /tmp/cs-r3.txt 2>/dev/null
   bash docs/plan/bilingue/evidence/census.sh > /tmp/cs-r4.txt 2>/dev/null
   /usr/bin/diff /tmp/cs-r3.txt /tmp/cs-r4.txt && echo IDENTICAL
   cd docs/plan/bilingue/evidence && /usr/bin/grep -vE '^#' METHOD-MANIFEST.txt | /usr/bin/shasum -a 256 -c
   ```

   `census.sh` is unchanged by the remediation; only `CENSUS-METHOD.md` was rehashed. Confirm both.
9. **Did the remediation introduce anything new?** Read the whole of `CENSUS-METHOD.md`, not just the
   diff. Fixing four claims at once is exactly how a fifth unprovable claim gets written. Is there a
   new absolute, a new probe reported as a property, or a disclosure that overstates what its command
   covers?
10. **Scope.** The remediation was supposed to touch `CENSUS-METHOD.md`, `METHOD-MANIFEST.txt`, the
    ledger and the review request, plus the ancestry rewrite. Anything else move?

The same standing rule applies, and it cut both ways last time: **do not ask for a stronger
guarantee** — a cleverer pattern is the refuted approach and is not BLOCKING — but **do not let a
stated error direction launder a real defect**. If a rule is unsound rather than merely unproven,
that is BLOCKING and D-O gives it no cover.

If your verdict is that the amended contract itself is wrong, return `FINDINGS` rather than `FAIL`.

Output using the CODEX REVIEW format:

```
## CODEX REVIEW — D1a round 4 remediation
VERDICT: PASS | FAIL | FINDINGS
BLOCKING:
- [B1] <finding> — <file:line> — <violated criterion or invariant> — <smallest safe correction>
SHOULD-FIX:
- [S1] ...
NITS:
- [N1] ...
NOTES ON THE PLAN ITSELF: <if the plan, not the work, is the problem>
```
