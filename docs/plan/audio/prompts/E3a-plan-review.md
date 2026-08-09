SESSION: AUDIO · E3a · REVIEW

Adversarial review of **E3a, revision 16** of the AUDIO plan (CASA podcast). You failed revision
15 with six BLOCKING findings. All six were accepted. This is the re-review.

WHERE THE PLAN LIVES — read this first or you will not find it.
Only on branch `docs/plan-audio`, never on `main`. Use
`git show docs/plan-audio:docs/plan/audio/PLAN.md` and `…/LEDGER.md`, or cut a worktree.

WHAT CHANGED, AND WHY IT IS NOT THE SPLIT YOU RECOMMENDED
You proposed splitting E3a in two while keeping client-side slug assignment. Brent chose a
different route: **the database now owns the slug.** A `BEFORE INSERT OR UPDATE` trigger assigns
it on publish, resolves uniqueness with `-2`…`-5`, applies a `reflexion-<episode_date>` fallback
when no publisher supplies a base, and freezes it (D12) raising `23514` — never `23505`. TypeScript
keeps only normalisation.

The claim is that this **dissolves three of your six findings** rather than patching them:
- **B2** — `podcast-backfill/index.ts:353` gets a slug without that file being touched at all.
- **B3** — the client never sees a slug `23505`, so the `message`-parsing dependency is deleted,
  not gated.
- **B5** — there are no two counters to coordinate; one retry re-issues the UPDATE and the trigger
  re-derives.
B1, B4 and B6 are accepted as amendments: new migration file with a version above the existing 62,
an explicit upgrade-path backfill test, and a surgical `slug` addition instead of regenerating
`types.ts`.

**Attack that claim first.** If the invariant does not actually close B2/B3/B5, say so.

ON B3 SPECIFICALLY — I got it wrong and you should check my correction.
Revision 15 asserted `details` carries `Key (<column>)=…`. That measurement used `service_role`,
which bypasses RLS. Re-measured as the authenticated `admin@e2e.local`: `details` is **null**,
exactly as you said. D22 is corrected in §3 and records the method failure. Verify the correction
is complete and that nothing else in the plan still leans on the old claim.

WHAT ELSE TO VERIFY — the phase body lists these as measured, on the authenticated path:
- repeated base → `x`, `x-2`, `x-3`; publish with **no slug supplied** → `reflexion-<date>`;
  fallback also de-duplicates; 80-char base in collision → 42 chars, never over 80.
- **the repo's `seed.sql`, unmodified, with the trigger already created, self-resolves** — which
  is why H1 and H2 were *removed* from scope. This reverses revision 15. Check it.
- the `published ⇒ slug NOT NULL` CHECK **fails** if added before the backfill (H4 stands).
Reproduce what matters. The stack is up: API 54331, DB 54332, `supabase db reset` is green.

STATE OF THE TREE. `main` moved during the session to `1d6869d` (UPGRADE's P2). `1c4490f` is still
an ancestor and the delta touches only `supabase/functions/_shared/mainDish*.ts` — nothing E3a
needs; still 62 migrations. E3a therefore **pins no parent SHA**: it branches from the `main` in
force on the day it starts and records it, as `E-infra-impl` did. Confirm that is sound rather
than evasive.

DO NOT treat `supabase/migrations/20260610090000_church_podcast_episodes.sql` as a file E3a edits
— revision 15's prompt said that and it was the confusion behind B1. It is read-only reference.

ASSESS
1. Does the invariant genuinely close B2, B3 and B5, or does it move the problem?
2. Are B1, B4 and B6 properly amended?
3. Is plpgsql the right home for uniqueness here? The trigger's `NOT EXISTS` is not atomic; the
   plan says the unique index remains the arbiter and promises no duplicates rather than
   determinism under concurrency. Is that honest and sufficient?
4. Acceptance criteria: unverifiable, vague or self-graded? Do the two declared mutations kill?
5. Is removing `seed.sql` and `smoke-local.spec.ts` from scope actually safe?
6. Sizing: 7 files, 14 criteria. One session?
7. Anything that makes E3b harder.

Taste is a NIT. Only correctness, contract violations, security and architectural violations are
BLOCKING. Output using the CODEX REVIEW format. VERDICT: PASS only if you would be held to this.
