SESSION: AUDIO · E3a · REVIEW

Adversarial review of the **E3a** unit of the AUDIO plan (CASA podcast — internal listening
loop). You are not here to be agreeable: you are the last check before we burn execution time.

WHERE THE PLAN LIVES — read this first or you will not find it.
The AUDIO plan is **only on the branch `docs/plan-audio`**, never on `main`. Read it with
`git show docs/plan-audio:docs/plan/audio/PLAN.md`, or cut a worktree of that branch. Same for
`docs/plan/audio/LEDGER.md`. An executor already burned a session hunting for these on `main`.

WHAT TO REVIEW
- `## Phase E3a — slug: contrato, DB y publishService`, rewritten in full in revision 15.
- Decision **D22** in §3, and the four new rows dated 2026-08-08 in §8.
- The ledger entry `2026-08-08 — plan round 15`.
Everything else in the plan is out of scope for this review: `E2`, `E-infra-spike` and
`E-infra-impl` are DONE and closed; `E3b` and `E4-spike` are still explicitly drafts.

THE CODE IS ON `main@1c4490f`. Read it, not just the plan. The files E3a touches:
`src/lib/sermon-editor/publishService.ts`, `src/lib/sermon-editor/__tests__/publishService.test.ts`,
`supabase/migrations/20260610090000_church_podcast_episodes.sql`, `supabase/seed.sql`,
`tests/e2e/smoke-local.spec.ts`, `src/integrations/supabase/types.ts`.

CONTEXT YOU NEED
E3a was demoted to a draft by your own r9/B2, which listed seven gaps in the slug contract. Six
belonged to E3a and are closed in this revision — **five by decision, the sixth by measurement**.
The seventh (offset pagination overlap) is E3b's and stays in the drafts block.

The measurement is the load-bearing part, so attack it first. The PM ran it on the local stack
built by `E-infra-impl` (Postgres 15.8, `lc_messages = en_US.UTF-8`), using a throwaway column and
index, and concluded: `PostgrestError` has no `constraint` field (only `details`, `hint`, `code`
and the inherited `message`); the **index name** travels in `message`; the **column name** travels
in `details`; `INSERT` and `UPDATE` produce identical shapes. Raw bodies are pasted in the phase
body. **Reproduce it yourself** — `supabase start` then `supabase db reset` brings the stack up on
API 54331 / DB 54332.

ASSESS
1. Does the plan match reality? Anything it assumes about the code that isn't true?
2. **Is the hueco-6 measurement sound, and does the contract it produces actually follow from it?**
   Substring-matching an identifier inside `message` — does that hold under every path this code
   takes, including a locale change or a Postgres major upgrade?
3. Are the five reasoned decisions (huecos 1-5) actually closed, or merely worded to look closed?
   Hueco 1 in particular claims the CHECK cannot be violated *by construction* — verify the
   arithmetic.
4. H1-H4: are they real, and is the fix complete? H1/H2 claim this phase would otherwise break
   `supabase db reset` for the whole repo. Confirm or refute.
5. Acceptance criteria: any unverifiable, vague, or self-graded? Do the two declared mutations
   (E3a.7, E3a.8) actually go red when reverted?
6. Sizing: 9 files and a regenerated `types.ts`. Is this one session's work, or is it two phases?
7. Anything that makes E3b harder than it needs to be.

Review against the plan's contract, not your preferences. Taste is a NIT. Only correctness,
contract violations, security and architectural violations are BLOCKING.

Output using the CODEX REVIEW format. VERDICT: PASS only if you would be willing to be held to
this contract.
