# CODEX RE-REVIEW 2 — BILINGUE D1a round 4

> Paste everything below the line into Codex (`gpt-5.6-sol`, `model_reasoning_effort = high`).
> Run from `/Users/brentcurtis/dev/casa-pilot`, branch `phase/d1a-method`, head `381501d`.
> Second re-review of the cumulative diff. Codex has final say on BLOCKING.

---

SESSION: BILINGUE · D1a · r4 second re-review · RE-REVIEW

Your re-review returned FAIL with 2 BLOCKING and 2 SHOULD-FIX, and confirmed everything else:
first-review B1, B3, B5 and N1 fixed, A7 satisfied, `98f4e51` reachable on `pilot/lean-v2`, stdout
byte-identical to r3, manifest/syntax/TypeScript/diff checks passing, and the harness genuinely
exercising all four branch outcomes. **Both BLOCKING were accepted; neither was disputed.** Your
verdict and the executor's triage are committed at `reviews/D1a-r4-codex-review.md`.

Still cumulative attempt 4. No ancestry change this time — `381501d` sits directly on top of the
head you reviewed (`0d2802f`).

## What changed since `0d2802f`

- **[B1]** The retracted absolute survived in two earlier places. `CENSUS-METHOD.md`'s stage-two
  introduction and `census.sh`'s stage-two comment header both still said a captured baseline
  "follows no naming convention, so no name predicate can reach it". Both now state that the live
  case matches none of stage one's four predicates, that a literal-basename predicate *would* reach
  it, that nothing fixes what the next baseline is called, and that stage two therefore classifies
  by referrers.
- **[B2]** The harness now ends with `printf 'loop exit=%s\n' "$?"` before cleanup, and was re-run.
  The pasted output shows `loop exit=0` — produced by the pasted script — and both evidence
  locations record that the previous `harness exit=0` line came from the invoking shell.
- **[S2]** The importer-probe disclosure is qualified: "a re-export chain **whose written
  specifiers do not end in `_test`**", and it now says explicitly that a direct
  `export { x } from './helper_test.ts'` *does* match.
- **[S1]** Deferral accepted by you; backlog entry retained unchanged.
- `METHOD-MANIFEST.txt` rehashes **both** `CENSUS-METHOD.md` and `census.sh` this time.

## Check

1. **[B1] at both sites, then sweep for a third.** `CENSUS-METHOD.md` and `census.sh`. Is either
   replacement still an absolute? Then grep the whole `evidence/` directory for any *other*
   surviving statement of a claim that was retracted elsewhere in the same artifact — that is the
   exact defect twice now, and the executor's own A1 grep missed it both times because it searched
   the retraction's phrasing rather than the claim's. Propose a phrasing-independent check if you
   see one.
2. **[B2] by running it.** Take the harness from `reviews/D1a-r4-review-request.md`, run it, and
   confirm every line of the pasted output — including `loop exit=0` and the `sha256` — is produced
   by that script. Is any line still unattributable to a command in it?
3. **The `census.sh` edit is claimed to be comment-only.** Verify rather than accept:

   ```bash
   cd /Users/brentcurtis/dev/casa-pilot && export LC_ALL=en_US.UTF-8
   /usr/bin/git diff 0d2802f 381501d -- docs/plan/bilingue/evidence/census.sh
   /usr/bin/git show 98f4e51:docs/plan/bilingue/evidence/census.sh > /tmp/census-r3.sh
   bash /tmp/census-r3.sh > /tmp/cs-r3.txt 2>/dev/null
   bash docs/plan/bilingue/evidence/census.sh > /tmp/cs-now.txt 2>/dev/null
   /usr/bin/diff /tmp/cs-r3.txt /tmp/cs-now.txt && echo IDENTICAL
   cd docs/plan/bilingue/evidence && /usr/bin/grep -vE '^#' METHOD-MANIFEST.txt | /usr/bin/shasum -a 256 -c
   ```

   Both new hashes correct? Selection and the stderr ambiguity record unchanged?
4. **[S2]** Is the qualification now accurate, or does it now overstate in the other direction?
5. **Did these fixes introduce anything?** Read `CENSUS-METHOD.md` whole. This is the third pass
   over the same prose; each pass is a chance to write a new claim while fixing an old one.
6. **Scope.** Expected surface this round: `CENSUS-METHOD.md`, `census.sh` (comment only),
   `METHOD-MANIFEST.txt`, `LEDGER.md`, `reviews/D1a-r4-codex-review.md`,
   `reviews/D1a-r4-review-request.md`, and this prompt. Anything else move?

The standing rule is unchanged and still cuts both ways: **do not ask for a stronger guarantee** — a
cleverer pattern is the refuted approach and is not BLOCKING — but **do not let a stated error
direction launder a real defect.**

If your verdict is that the amended contract itself is wrong, return `FINDINGS` rather than `FAIL`.

Output using the CODEX REVIEW format:

```
## CODEX REVIEW — D1a round 4, second re-review
VERDICT: PASS | FAIL | FINDINGS
BLOCKING:
- [B1] <finding> — <file:line> — <violated criterion or invariant> — <smallest safe correction>
SHOULD-FIX:
- [S1] ...
NITS:
- [N1] ...
NOTES ON THE PLAN ITSELF: <if the plan, not the work, is the problem>
```
