# CODEX FINAL REVIEW — PD-REFINE round 1

> Paste everything below the line into Codex (`gpt-5.6-sol`, `model_reasoning_effort = high`),
> run from `/Users/brentcurtis/dev/casa-web`.
>
> **Do not paste the C3 review alongside this.** A fresh-context Claude reviewer already passed
> this branch. Withholding its findings makes this a clean test of whether cross-family review
> catches anything a fresh same-family context did not — which is the one thing the published
> evidence on this cannot separate.

---

Final review of phase PD-REFINE for CASA. You have final say on BLOCKING items. The phase does
not close until you pass it.

REPO: `/Users/brentcurtis/dev/casa-web` — branch `phase/pd-refine` is checked out there.
REVIEW: `git diff a1f2ac2..HEAD` (3 commits: 5ffd59a, 87b0223, d05170e)

## What the phase was for

`supabase/functions/refine-story/` refines an existing children's story through the Anthropic API.
Before this phase it extracted JSON from the model's prose (```` ```json ```` fence regex, a
`/\{[\s\S]*\}/` fallback, a control-character strip, then `JSON.parse`) and validated three things:
`title` exists, `scenes` exists, `scenes` is an array. Every failure returned HTTP 500.

Its sibling `generate-story/` was hardened in an earlier phase with a forced `emit_story` tool
(`strict: true`), typed 502 provider-output errors, and a full structural validator. This phase
applies that contract to `refine-story` and extracts the shared pieces to
`_shared/storyContract.ts`.

## Acceptance criteria

- [A1] The provider request forces a `strict: true` tool call; no regex JSON extraction,
  control-char stripping, or bare `JSON.parse` of model text remains in the output path.
- [A2] `stop_reason` checked BEFORE content. REFUSAL / MAX_TOKENS / INVALID_STORY each return
  502 with distinct Spanish copy.
- [A3] A structurally invalid refined story returns 502 `INVALID_STORY` — never 500.
- [A4] Scene count has exactly one source of truth; `SYSTEM_PROMPT` and
  `REFINEMENT_INSTRUCTIONS.length` agree with it. (Before: the prompt said 12–16 in one place
  and 10–18 in another, and enforced neither.)
- [A5] Genuine server faults still 500 (missing `ANTHROPIC_API_KEY`, provider non-2xx). `OPTIONS`
  answered before authz; `requireLiturgyWriter` runs before `req.json()` and before any provider
  call.
- [A6] `generate-story`'s behaviour is UNCHANGED — the extraction was required to be a pure move
  with re-export.
- [A7] New contract tests for every failure mode, in `refine-story/handler_contract_test.ts`.

## Frozen decisions no phase may violate

- **D1** — paid functions run a fail-closed authz guard BEFORE body read, before any fetch, before
  any provider call. Denied ⇒ 403, backend error ⇒ 503, OPTIONS before auth.
- **D2** — thin `index.ts` (env + deps + serve) plus an importable `handler.ts` with injected deps.
- The model identifier stays a **bare alias** (`claude-opus-5`). A date-suffixed ID silently 404s
  the day it retires — that is how `process-reflexion-pdf` went down.
- Additive migrations only. This phase should contain **no DDL at all**.
- All user-facing copy in Chilean Spanish.

## Gate

```
cd /Users/brentcurtis/dev/casa-web/supabase/functions && deno test --allow-all --no-check .
```

`--no-check` is repo-sanctioned (upgrade LEDGER F-1): `deno check` covers the same graph
separately, and 3 pre-existing type errors in `create-mesa-matches/handler.ts` predate this phase.
`deno lint` reports 92 problems repo-wide, all pre-existing.

## Check

1. Does the code meet every acceptance criterion? Verify — do not take the ledger's word for it.
   `docs/plan/LEDGER.md` is in the diff and contains the implementer's own account; treat it as a
   claim, not evidence.
2. Run the tests. Do they test **behaviour**, or just execute code? Would they actually fail if the
   behaviour regressed? Mutate the source and check.
3. Any violation of the frozen decisions — especially D1's authz ordering, which is a security
   property.
4. Is A6 actually true? Verify both directions: nothing silently altered in the moved bodies, and
   nothing that `generate-story` exported at `a1f2ac2` is now missing. Note that re-exports appear
   as multi-line `export { … } from '…'` blocks.
5. Correctness, error handling, edge cases. Specifically: what does the new strict contract do to
   data that already exists and was valid under the old looser rules? What happens on a
   `max_tokens` cut? Will the Anthropic API actually accept the new tool schema under
   `strict: true` as written?
6. Scope creep. The implementer disclosed three deviations beyond the spec: moving
   `STORY_TOOL_SCHEMA` as well, rewriting the "Formato de Respuesta" prompt block, and changing a
   log line to counts-only. Judge each.
7. Anything that makes the next phase harder than it needs to be.

Review against the plan's contract, not your own preferences. Taste disagreements are NITs. Only
correctness, contract violations, security, and architectural violations are BLOCKING.

## Known and already decided — do not re-raise as blocking

- The strict contract makes some previously-refinable stories un-refinable. Measured directly
  against the live database: `cuentacuentos_drafts` holds **1 row** (15 scenes, in window, no
  `props` key — so that one draft would 502) and `liturgia_elementos` holds **0** stories of that
  shape. Brent has accepted this. Comment on the *handling* if you think it is wrong; the decision
  itself is made.
- The spec this executor was given contained two PM errors, which the executor caught and reported
  rather than working around: a stale test baseline (cited 325/0, real 446/0) and a gate command
  missing `--no-check`. Already logged against the PM.

## Output

```markdown
## CODEX REVIEW — PD-REFINE round 1
VERDICT: PASS | FAIL
WHAT I VERIFIED MYSELF: <commands run and what they returned>
BLOCKING:
- [B1] <finding> — <file:line> — <why it blocks>
SHOULD-FIX:
- [S1] ...
NITS:
- [N1] ...
TESTS I JUDGED WEAK: <named tests that would not catch a regression, and why — or "none">
NOTES ON THE PLAN ITSELF: <if the spec, not the code, is the problem>
```

VERDICT: PASS only if you would be willing to be held to this merging to a production branch.
