# EXECUTOR PROMPT — PD-REFINE round 1

> Pilot phase 1 under `docs/plan/SOP-PILOT.md`. Paste everything below the line into a
> **fresh** Claude Code session (Opus, effort `xhigh`). It has no memory of the PM session.

---

You are the executor for CASA, phase PD-REFINE round 1. You have no prior context.
Everything you need is below or in the repo.

BRANCH: `phase/pd-refine` — create from `pilot/sop-v2` if it does not exist. Commit as you go.
Branch names must be ≤20 characters (Vercel preview DNS limit).

## CONTEXT YOU NEED

`refine-story` is the only story-producing edge function still parsing prose JSON out of the
model's text response. `generate-story` was hardened in phase PD; PD-REFINE was explicitly
deferred post-release by Brent on 2026-07-31 and is now being executed.

**Verified current state of `supabase/functions/refine-story/handler.ts`** (I read it; do not
re-derive, but do verify anything you intend to change):

- Provider call is a plain `messages` request with `thinking: { type: "disabled" }`,
  `max_tokens: 16000`, model `claude-opus-5` (bare alias — keep it; a date-suffixed ID once
  took down `process-reflexion-pdf`).
- Output handling, lines ~227–256: regex-matches a ```` ```json ```` fence, falls back to
  `/\{[\s\S]*\}/`, strips ASCII control characters, `JSON.parse`s, then validates **only**
  `refinedStory.title`, `refinedStory.scenes`, and `Array.isArray(refinedStory.scenes)`.
- Everything that fails throws into one `catch` that returns **HTTP 500**, including provider
  contract violations that are not server faults.
- Authz is already correct and must stay: `OPTIONS` is answered before the guard;
  `requireLiturgyWriter` runs before `req.json()` and before any provider call. Fail-closed.

**A real defect to resolve, not just carry over:** the prompt contradicts itself on scene
count. `SYSTEM_PROMPT` (line ~85) says *"MANTÉN el mismo número de escenas (o similar, entre
12-16)"*; `REFINEMENT_INSTRUCTIONS.length` (line ~66) says *"Mantén siempre entre 10 y 18
escenas."* `generate-story` uses `SCENE_COUNT_MIN = 12` / `SCENE_COUNT_MAX = 16`.

**The pattern to match — already shipped in `supabase/functions/generate-story/handler.ts`:**

- A forced tool call named `emit_story` declaring `strict: true` at the top level, with
  `additionalProperties: false` at the root and every nested object.
- `export type ProviderOutputReason = 'REFUSAL' | 'MAX_TOKENS' | 'INVALID_STORY'` with
  `PROVIDER_OUTPUT_MESSAGES` holding the Spanish user-facing copy for each.
- `class ProviderOutputError` — mapped to **502** inside the handler. Its comment states the
  reasoning explicitly: *a provider that returns garbage is not a server fault, and it is not
  the client's fault either, so neither 500 nor 4xx describes it.*
- `export function validateAndNormalizeStory(data: unknown): StoryValidationResult` where
  `StoryValidationResult = { ok: true; story: StoryOutput; warnings: StoryWarning[] } | { ok: false; errors: StoryValidationError[] }`.
  Named failure codes: `NOT_OBJECT`, `SCENE_COUNT_OUT_OF_RANGE`, `SCENE_NUMBER_INVALID`,
  `SCENE_NUMBER_DUPLICATE`, `SCENE_NUMBERS_NOT_EXACT`, `NAME_NOT_UNIQUE`, `SCENE_REFS_INVALID`,
  `SCENE_REF_NOT_INTEGER`.
- `stop_reason` is checked BEFORE content (test PD2d asserts exactly this).
- Test naming convention: `PD1a`…`PD1g` for the tool/schema contract, `PD2a`…`PD2i` for
  provider-output failure modes. See `generate-story/handler_contract_test.ts`.

## SCOPE

Bring `refine-story` under the same strict provider-output contract:

1. Replace prose-JSON extraction with a **forced, `strict: true` tool call**. The refinement
   payload is the story shape **plus** `refinementNotes` (a string describing the changes).
   No regex fence-matching, no control-character stripping, no bare `JSON.parse` of model text
   may remain in the output path.
2. Check `stop_reason` **before** content. Map REFUSAL / MAX_TOKENS / INVALID_STORY to a typed
   **502** carrying the shared Spanish copy.
3. Validate the refined story structurally before returning it. A structural failure is a 502
   `INVALID_STORY`, never a 500.
4. Resolve the scene-count contradiction to a **single source of truth**, and make the prompt
   text agree with whatever the validator enforces.

**Shared-code decision — make it, then flag it in your report.** `validateAndNormalizeStory`,
`ProviderOutputError`, `ProviderOutputReason`, `PROVIDER_OUTPUT_MESSAGES` and the scene-count
constants currently live inside `generate-story/handler.ts`, which is ~80 KB. `refine-story`
needs them. `_shared/` is this repo's established home for cross-function code
(`liturgyAuth.ts`, `imageFetch.ts`, `corpus.ts`), so the intended approach is:

> extract the needed pieces into `supabase/functions/_shared/storyContract.ts`, and
> **re-export them from `generate-story/handler.ts`** so that function's public surface and
> behaviour are completely unchanged.

This must be a **pure move**. `generate-story`'s existing suites must pass byte-identically.
If the extraction cannot be done without changing `generate-story`'s behaviour, or if it pushes
this phase past its size cap, **stop and report STATUS: FINDINGS** — do not force it.

## EXPLICITLY OUT OF SCOPE

- Any DDL, RLS, migration, bucket, or storage-policy change. None is required.
- The 5 live `upsert:true` call sites. Do not touch them; they belong to a separate decision.
- `refine-children-lesson` — same shape of problem, different phase. Leave it alone.
- Frontend/`src/` changes. Do not adjust callers to the new status codes in this phase.
- Model changes, new env vars, prompt rewrites beyond the scene-count fix, and any deploy.
- Refactoring adjacent code because you are already in the file.

## ACCEPTANCE CRITERIA — each independently verifiable

- [A1] The provider request forces a `strict: true` tool call; no regex JSON extraction,
  control-char stripping, or bare `JSON.parse` of model text remains in the output path.
- [A2] `stop_reason` is checked before content. REFUSAL / MAX_TOKENS / INVALID_STORY each
  return **502** with distinct Spanish copy.
- [A3] A structurally invalid refined story returns 502 `INVALID_STORY` — never 500.
- [A4] Scene count has exactly one source of truth; `SYSTEM_PROMPT` and
  `REFINEMENT_INSTRUCTIONS.length` agree with it. Grep proves no stale range survives.
- [A5] Genuine server faults still return 500 (missing `ANTHROPIC_API_KEY`, provider non-2xx).
  `OPTIONS` still answered before authz; `requireLiturgyWriter` still runs before `req.json()`
  and before any provider call.
- [A6] `generate-story`'s existing suites pass unchanged — the extraction altered no behaviour.
- [A7] New contract tests exist for every failure mode above, named `PDR1a…` / `PDR2a…`
  mirroring the PD convention.

## TESTS YOU MUST WRITE

`supabase/functions/refine-story/handler_contract_test.ts` — covering: strict tool declared and
forced; `stop_reason` precedence; each of the three 502 reasons with distinct copy; wrong tool
name; two tool blocks; missing tool block; structural validation failures; and the 500 cases
that must stay 500.

TEST COMMAND (verbatim, run from repo root):

```
cd supabase/functions && deno test --allow-all . && deno lint && deno check **/*.ts
```

Baseline for comparison: recent rounds recorded **deno test 325/0, lint 94, check 46** on
deno 2.7.11. Report your real numbers, before and after.

## RULES

- Surgical changes only. Match existing patterns. No bulk file modifications.
- All user-facing copy in **Spanish** (es-CL). Code, comments and commits in the repo's
  existing convention — commit messages in Spanish, matching recent history.
- Do not grade your own work in prose. Show the diff and the raw test output.
- If tests are red, iterate up to **3** times. If still red, report `STATUS: BLOCKED` with the
  real error. Never report a red build as complete.
- If you discover the plan is wrong — the extraction is not clean, the tool shape cannot carry
  `refinementNotes`, an assumption above is false — **STOP CODING** and report
  `STATUS: FINDINGS` with what you found and what you would propose instead. That is the
  correct outcome, not a failure. Do not work around a broken plan.
- Do not expand scope. If something out of scope is broken, note it under NOT DONE.

## WHEN DONE

Append your round entry to `docs/plan/LEDGER.md` using the pilot's instrumented format:

```
### <ISO date> — PD-REFINE round 1 — Opus (executor)
- CONTEXT PRESSURE: comfortable | tight | ran out — <at what point?>
- ELAPSED: <wall-clock minutes for this round>
- STAGE: executor <m>
- EFFORT: xhigh
- FIRST-PASS: n/a (set by the reviewer)
- ACTION / COMMITS / TESTS / FINDINGS RAISED / DECISIONS / BACKLOG ADDED / OPEN AFTER THIS ROUND
```

Then output exactly this report:

```markdown
## EXECUTOR REPORT — PD-REFINE round 1
STATUS: COMPLETE | BLOCKED | FINDINGS
CONTEXT PRESSURE: comfortable | tight | ran out — <one line: at what point?>
ELAPSED: <minutes>
BRANCH: <branch>   COMMITS: <sha…>
FILES CHANGED: <path (+x/-y) …>
WHAT I DID: <bullets, one per acceptance criterion, mapped to criterion ID>
TEST COMMAND: <verbatim>
TEST OUTPUT: <verbatim tail, unedited — before and after counts>
ACCEPTANCE CRITERIA: <A1–A7: met / not met / partially — with reason>
DEVIATIONS FROM PROMPT: <or "none">
ASSUMPTIONS MADE: <or "none">
NOT DONE / OPEN:

## PRE-SUBMISSION SELF-REVIEW
<Answer against the reviewer's rubric — the one you will actually be judged on.
Do not skip this and do not write "N/A" to get past it.>
- Acceptance criteria: <each ID, met/not met, and HOW you verified it — command or file:line>
- Correctness / error handling / edge cases: <what you checked; what you could NOT check>
- Frozen decisions (docs/plan/PLAN.md): <which apply here, and why this does not violate them>
- Security: <authz ordering, fail-closed behaviour, anything touching auth or PII>
- Scope creep: <anything touched outside SCOPE, and why>
- Next-phase cost: <anything you did that makes the next phase harder>
- Weakest part of this diff: <name it plainly — the reviewer will find it anyway>
```
