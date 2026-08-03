CODEX REVIEW — PC ROUND 2/2 FINAL — phase/pc-research@04dd3d0

VERDICT: PASS

RUNTIME / GATES RE-RUN:

```text
deno 2.7.11 (stable, release, aarch64-apple-darwin)
v8 14.7.173.7-rusty
typescript 5.9.2
```

- Review target: clean dedicated worktree `/private/tmp/casa-pc` on
  `phase/pc-research` at `04dd3d08aad79864c4cd545f7b50746c36bdb74d`.
  `merge-base(7d3baaf,04dd3d0)` is exactly
  `7d3baaf5c5e83bd4cba3f71145f787a2277eb54c`; the range contains four commits.
- Range/scope, verbatim:

  ```text
   3 files changed, 241 insertions(+), 9 deletions(-)
  supabase/functions/_shared/corpusRunner.ts
  supabase/functions/generate-story/handler.ts
  supabase/functions/generate-story/handler_research_test.ts
  ```

- `deno test --allow-all .` from `supabase/functions/`, verbatim terminal
  summary:

  ```text
  ok | 195 passed | 0 failed (22s)
  ```

- `deno test --allow-all generate-scene-images/corpus_test.ts`, verbatim:

  ```text
  ok | 31 passed | 0 failed (163ms)
  ```

- `deno test --allow-all generate-story/handler_research_test.ts` after all
  review mutations were reverted, verbatim:

  ```text
  ok | 32 passed | 0 failed (9s)
  ```

- D6 lint comparison: ran `deno lint .` at base `7d3baaf` in a temporary
  detached worktree and at `04dd3d0`. Both ended with `Found 95 problems`.
  I parsed each diagnostic as
  `error[rule] + message + normalized path below supabase/functions`, removed
  line/column, sorted while retaining multiplicity, and compared counts per
  identity:

  ```text
  lint multiset: 95<->95; delta EMPTY
  ```

- D6 check comparison: ran `deno check .` at both commits; both ended with
  `Found 46 errors.` I stripped ANSI, buffered every `TS#### [ERROR]` until
  the following `at file://` location (so grouped TS blocks under one location
  are handled), paired every buffered code with that normalized relative
  location including line/column, decoded path escapes, then `sort -u` and
  compared:

  ```text
  check identities: 46<->46; delta EMPTY
  ```

- `git diff --check 7d3baaf..04dd3d0` returned no output and exit 0.
- `corpus_baseline.json` has blob
  `91ec703355f3584701fe25da484370e4ba57b156` at capture commit `b1a9c6d`,
  base `7d3baaf`, and tip `04dd3d0`.
- The temporary base worktree was removed. Every production/test mutation was
  reverted with `apply_patch`; final `git diff --exit-code` returned 0 and
  `git status --short --branch` returned only `## phase/pc-research`.
- No authenticated provider call was made. The only network request was an
  unauthenticated GET of Google's public v1beta discovery document.

MATRIX:

1. [B1] — FIXED.
   - `safeFinishReason()` now returns a raw string only when it is a member of
     the closed `PROVIDER_FINISH_REASONS` set; any other non-empty string maps
     to `DESCONOCIDO`, and missing/non-string values remain absent. Every later
     log and response path reads the sanitized local, not the provider field.
     Taxonomy remains `MAX_TOKENS` → `OUTPUT_TRUNCATED`, `STOP` + text → `ok`,
     and every other value (including `DESCONOCIDO`) → `OUTPUT_BLOCKED`.
   - I re-ran the exact round-1 `CODEXSOL_PC_SECRET` plant and a fresh
     old-regex-valid plant, `CODEXSOL_FRESH_SECRET`, in a temporary
     production-handler test. Neither appeared in captured logs or the
     serialized response; every resulting warning reported `DESCONOCIDO`.
     Verbatim summary:

     ```text
     CODEX-R1 and fresh enum-shaped provider tokens reach neither log nor response ... ok (5ms)
     ok | 1 passed | 0 failed | 32 filtered out (8ms)
     ```

   - Restoring the old `/^[A-Z_]{1,40}$/` classifier made PC6h fail with
     `log leaked enum-shaped provider token` and showed
     `SIGNEDTOKEN_ENUM_SHAPE` in both research log lines. The mutation was
     reverted.
   - I re-fetched
     `https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta`
     without credentials. It reported revision `20260728`. A mechanical,
     order-sensitive comparison gave:

     ```text
     production=21 live=21 test_nonterminal=19
     live vs production: IDENTICAL (including order)
     live non-STOP/non-MAX_TOKENS vs hand-transcribed test: IDENTICAL (including order)
     ```

   - PC3d does not import or reference the production set: its only dependency
     is the separately declared `DOCUMENTED_BLOCKING_REASONS`. It spells all
     19 non-`STOP`/non-`MAX_TOKENS` discovery values itself and asserts that
     each value survives classification while taking `OUTPUT_BLOCKED`.
   - I traced the non-STOP and unknown paths through messages, logs, result
     objects, warning construction, and the outer error envelope. Provider
     response text is discarded on these paths; only the allowlisted enum or
     `DESCONOCIDO` can reach `finishReason`.

2. [S1] — FIXED.
   - Production warning copy is exactly
     `No se pudo incorporar esa información.` The obsolete story-generated
     claim remains only in explanatory comments and a negative assertion, not
     in an emitted string.
   - PC6i drives preview, successful-story, and downstream-error envelopes,
     requires two warnings on each, requires the neutral clause, and rejects
     `El cuento se generó`.
   - Mutating production back to the old sentence made PC6i fail on the preview
     envelope with:

     ```text
     preview: expected the envelope-neutral clause
     FAILED | 0 passed | 1 failed | 31 filtered out
     ```

     The mutation was reverted. The warning object shape and frozen failure
     code set are unchanged.

3. [N1] — FIXED.
   - PC3f supplies one `thought:true` part followed by two visible text parts.
     It requires the two visible strings to appear joined and in order in the
     production prompt, requires the thought string to be absent, and verifies
     the result remains a successful no-warning response.
   - Dropping the thought filter made PC3f fail with
     `a thought part must never reach the prompt`. Keeping the filter but
     restricting extraction to the first visible part made it fail with
     `both visible parts must reach the prompt joined`. Both mutations were
     reverted.

4. Q4 — FIXED.
   - Commit `04dd3d0` changes only `_shared/corpusRunner.ts`; it adds
     `finishReason:"STOP"` to the successful Gemini candidate. No corpus
     expectation or baseline file moved.
   - Temporary response instrumentation showed the five non-rejected story
     corpus cases each returned status 200 with `warnings:[]`. Removing only
     the new `finishReason` line kept their statuses at 200 but produced
     `OUTPUT_BLOCKED` warnings in all five, with counts `1, 1, 3, 7, 2`.
     This directly confirms that the line flips the five cases from degraded
     research to successful research while the captured outcome remains
     unchanged. Instrumentation and mutation were reverted.
   - The focused corpus is `31/31` green and the baseline blob remains the
     capture blob above.

FINDINGS:

- BLOCKING: none.
- SHOULD-FIX: none.
- NIT: none.

CONTRACT-COUPLED: No new issue. The warnings object shape and frozen failure
code set are unchanged; only the already-sanctioned message copy changed.

LOW-CONFIDENCE (non-verdict): none.

NOTES ON THE PLAN:

- No plan amendment. Per the review scope, I did not run the authenticated
  [PC7] provider canary; it remains Brent's separate phase-close gate.
