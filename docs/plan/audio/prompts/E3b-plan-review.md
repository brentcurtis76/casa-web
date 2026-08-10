SESSION: AUDIO · E3b · REVIEW

Adversarial plan review of **E3b** (revision 18) of the AUDIO plan (CASA podcast). You are the last
check before we spend an execution session. This is the first review of this contract.

WHERE THE PLAN LIVES: only on branch `docs/plan-audio`, never `main`. Read it with
`git show docs/plan-audio:docs/plan/audio/PLAN.md`, section `## Phase E3b`. Code is on `main`
(`3851e40` at time of writing); **`E3a` is DONE but NOT YET MERGED** — its code is on
`phase/E3a-slug@6054d55`, so read `slug`, the trigger and `CANONICAL_ORIGIN` there.

CONTEXT — E3b was a draft since r10 and carried five defects, all fixed in this revision:
1. **Pagination (your own r9/B5, the last open gap).** The draft said "by offset" and claimed the
   `id` tie-break "prevents overlap between pages". That is false: the tie-break makes the order
   deterministic, but offset still overlaps or skips rows when a publication lands between
   requests. **The contract now uses keyset** on `(published_at DESC, id ASC)`: page 1 asks for 13
   and shows 12, the 13th is a sentinel; the cursor is the last row's `(published_at, id)` and
   travels in the URL as `desde`. Declared cost: **no "page 3" URL**.
2. `E3b.8` asked for "the E0-gates SHA" — a unit retired in r10. Now the phase's own parent SHA.
3. The orphan line *"Depende de: nada, ni siquiera de E0-gates. Es lo primero que puede arrancar"*
   is deleted — it contradicted the wave table and is now materially false.
4. Synthetic fixtures no longer need inventing: `E-infra-impl`'s seed leaves the `9000` range, and
   since `E3a` the published row carries `slug = reflexion-2026-01-04` while the draft carries
   NULL — **the draft is exactly the negative case for the public RLS**.
5. The page uses `CANONICAL_ORIGIN` from `E3a` rather than repeating the D19 host.

ATTACK THESE FIRST
- **Is keyset actually specified correctly?** `published_at < pa OR (published_at = pa AND id > id)`
  against `ORDER BY published_at DESC, id ASC`. Check the boundary logic, the 13-row sentinel, and
  what happens when `published_at` is NULL (it is nullable in the schema — does the contract cover
  a published row whose `published_at` is somehow null, and can that exist given
  `published_episode_complete`?).
- **The PM did NOT measure PostgREST's nested `.or()` syntax against this stack**, deliberately, and
  says so in the ledger: `E3b.2` is the first criterion so the unit reports `FINDINGS` rather than
  silently falling back to offset. Is deferring that measurement to execution the right call here,
  or should the contract not freeze until it is measured? You have ruled on the opposite pattern
  before (D21: measure first). Say which applies.
- **E3b.3** is the criterion that carries the whole decision: repeated `published_at` plus an
  insertion between page 1 and page 2, proving neither repetition nor skip. If that criterion is
  weak, the pagination decision is not actually made.

ALSO ASSESS
1. Does the plan match reality? Check `src/appRoutes.tsx` (flat `{path, element}` array, catch-all
   `*` last), `vercel.json` (single rewrite — hence no real 404 until wave 3), and the RLS policy at
   `20260610090000_church_podcast_episodes.sql:73`.
2. Acceptance criteria: unverifiable, vague or self-graded? Do the two declared mutations kill?
3. Sizing: 7 files, 11 criteria. One session?
4. Is excluding `src/pages/NotFound.tsx` correct? It is in English, violating D14, and it is the
   app-wide catch-all; the contract sends translating it to backlog and requires E3b.8 to use its
   own Spanish state. Right call or dodge?
5. Anything that makes `E4-spike` (link preview) harder than it needs to be.

Taste is a NIT. Only correctness, contract violations, security and architectural violations are
BLOCKING. Output using the CODEX REVIEW format. VERDICT: PASS only if you would be held to this.
