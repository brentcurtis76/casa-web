# CODEX RE-REVIEW 3 — BILINGUE D1a round 4

> Paste everything below the line into Codex (`gpt-5.6-sol`, `model_reasoning_effort = high`).
> Run from `/Users/brentcurtis/dev/casa-pilot`, branch `phase/d1a-method`, head `b847510`.
> Third re-review of the cumulative diff. Codex has final say on BLOCKING.

---

SESSION: BILINGUE · D1a · r4 third re-review · RE-REVIEW

Your second re-review returned FAIL with 1 BLOCKING and 2 SHOULD-FIX, and confirmed [B2] fixed (the
literal harness reproduced every displayed line, including the SHA and `loop exit=0`), the re-export
disclosure accurate, the `census.sh` edit comment-only, selection byte-identical, and ambiguity
stderr, both manifest hashes, syntax, TypeScript, diff hygiene and remediation scope all passing.
**The BLOCKING was accepted; nothing was disputed.** Your verdict and the executor's triage are at
`reviews/D1a-r4-codex-review.md`.

Still cumulative attempt 4. No ancestry change — `b847510` sits on top of `381501d`.

## What changed since `381501d`

- **[B1] at all three sites.** `CENSUS-METHOD.md`'s stage-two introduction, its
  `corpus_pd_base.json` paragraph, and `census.sh`'s function header now say **only** that the path
  matches none of the four frozen stage-one predicates, and add explicitly that other predicates
  could match it. The general claim about convention-based predicates is gone.
- **The future-naming statement was checked before being written**, per your suggestion:
  `supabase/functions/generate-story/corpus_parity_test.ts:15` documents
  `deno run --allow-all _shared/zz_snap.ts generate-story/corpus_pd_base.json`, so the capture
  command takes its output path as an argument. The artifact cites that line instead of asserting
  anything about future names.
- **[S2] adopted.** The phrase-specific A1 grep is retired as the pre-submission check — it was the
  mechanism behind three rounds of this defect. The mandatory check is now your broad candidate
  scan, read as a manual-review list and never as proof. It returned 28 lines; all 28 were read
  individually and the full disposition is in `reviews/D1a-r4-codex-review.md`. Two prompted action:
  one promise that a review step is sufficient was reworded, and one inherited factual statement
  about three fixture helpers was verified with `find` rather than assumed.
- **[S1]** deferral unchanged.
- Both artefacts rehashed again in `METHOD-MANIFEST.txt`.

## Check

1. **[B1] at all three sites.** Is each now exactly the tested statement — none of the four frozen
   predicates match this path — with no residue of a broader claim? This is the fourth pass on the
   same sentence; the failure mode each time has been replacing an absolute with a marginally
   smaller one, so read the replacements as if they were new text, not as diffs.
2. **The `corpus_parity_test.ts:15` citation.** Verify the line says what the artifact says it says,
   and that the conclusion drawn from it — the next baseline's name is a caller's choice — does not
   itself overreach.
3. **The S2 scan as adopted.** Run it yourself:

   ```bash
   cd /Users/brentcurtis/dev/casa-pilot && export LC_ALL=en_US.UTF-8
   /usr/bin/grep -rniE '\b(all|every|none|no|never|only|cannot|nothing)\b[^.]{0,80}\b(exclude|excluded|drop|drops|keep|keeps|test|fixture|predicate|convention|referrer)' docs/plan/bilingue/evidence/
   ```

   The executor classified 24 hits as rule definitions, disclaimers, quoted retractions, reported
   search results or shell output, and acted on 2. **Do you agree with every classification?** A hit
   dismissed as a "rule definition" that is really a claim is the next instance of this defect.
4. **Regression.** Selection, stderr record, both new manifest hashes, `bash -n`, `tsc`, diff
   confinement, and the harness's extracted-function `sha256` (should still be `ca6e9ce7…`, since
   this round's `census.sh` edit is again comment-only, above both `sed` ranges).
5. **Did this pass introduce anything?** Fourth read of the same prose.
6. **Scope.** Expected surface: `CENSUS-METHOD.md`, `census.sh` (comment only),
   `METHOD-MANIFEST.txt`, `LEDGER.md`, `reviews/D1a-r4-codex-review.md`, and this prompt.

The standing rule is unchanged and still cuts both ways: **do not ask for a stronger guarantee** — a
cleverer pattern is the refuted approach and is not BLOCKING — but **do not let a stated error
direction launder a real defect.**

If your verdict is that the amended contract itself is wrong, return `FINDINGS` rather than `FAIL`.

Output using the CODEX REVIEW format:

```
## CODEX REVIEW — D1a round 4, third re-review
VERDICT: PASS | FAIL | FINDINGS
BLOCKING:
- [B1] <finding> — <file:line> — <violated criterion or invariant> — <smallest safe correction>
SHOULD-FIX:
- [S1] ...
NITS:
- [N1] ...
NOTES ON THE PLAN ITSELF: <if the plan, not the work, is the problem>
```
