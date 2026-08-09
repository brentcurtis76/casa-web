SESSION: AUDIO · E3a · REVIEW

Final review of phase E3a for AUDIO (CASA podcast). You have final say on BLOCKING items; the
phase does not close until you pass it.

BRANCH: `phase/E3a-slug` @ `1d09b7d`. PARENT SHA: `4b44b5b` (a commit of `main`).
THE PLAN IS ON ANOTHER BRANCH: `git show docs/plan-audio:docs/plan/audio/PLAN.md`, section
`## Phase E3a`. It is FROZEN — it passed your own plan review at round 3 (r15 FAIL 6, r16 FAIL 3,
r17 PASS). Review the code against that contract, not against a design you would have chosen.

WHAT WAS BUILT — 7 files, +757/-39. The slug is a database invariant: a `BEFORE INSERT OR UPDATE`
trigger assigns it on publish, resolves uniqueness with `-2`…`-5`, falls back to
`reflexion-<episode_date>` when no publisher supplies a base, and freezes it (`23514`, never
`23505`). TypeScript only normalises and supplies a preference. `podcast-backfill/index.ts` is
deliberately untouched and gets its slug for free.

WHAT THE PM ALREADY VERIFIED INDEPENDENTLY — reproduce what you doubt, don't take it on trust:
- diff is exactly 7 files; the June 2026 migration and `podcast-backfill/index.ts` are absent from
  it; `seed.sql` and `smoke-local.spec.ts` are byte-identical to the parent.
- `supabase db reset` → 63 migrations; the unmodified seed's published baseline comes out with
  `slug = reflexion-2026-01-04`, the draft with NULL.
- `supabase/tests/slug.sql` → 11/11, including T11 (the step-6 CHECK fails before the backfill).
- **The three declared mutations were applied by the PM and all went red**, notably M3
  (`expected 'x' to be 'x-2'`) — the canonical-URL defect you raised as r16/B2.
- Gate D18 on both sides over the same 7 files: no diff, identical project totals
  (`tsc=1039 eslint=161 deno-lint=92 deno-check=48`), exit 0 both.
- `npm run build` green. Full suite: 6 red in `MesaAbiertaDashboard.test.tsx`, **the same 6 red on
  the parent SHA** — zero new.
- Smoke: `1 passed (14.4s)` with seed and spec unmodified.

CHECK
1. Does the code meet every one of E3a.1–E3a.16? Verify, don't take the ledger's word for it.
2. Run the tests. Do they test behaviour, or merely execute code? The three TS mutations and the
   SQL mutation are declared in the plan — kill them yourself.
3. **Concurrency.** The contract promises integrity always, a generic client retry, and explicitly
   does NOT promise every publisher succeeds. The trigger's `NOT EXISTS` is not atomic and the
   unique index is the arbiter. Is the implementation faithful to that, and is the accepted
   `podcast-backfill` risk still the one you ruled defensible?
4. Violations of frozen decisions: D9 (additive only — note the PM logged `DROP TRIGGER IF EXISTS`
   as a NIT; rule on it), D12 (immutability, and that unpublish→republish preserves the slug),
   D13, D14, D19 (canonical host).
5. Correctness, error handling, edge cases. Specifically: the backfill's `ROW_NUMBER()` has no cap
   of 5 (the executor's assumption 3, accepted by the PM); the trigger nulls `slug` for non-published
   rows; `publishEpisode` throws if the database returns no slug.
6. Scope creep — anything changed that was out of scope?
7. Anything that makes `E3b` (public pages `/reflexiones` and `/reflexiones/:slug`) harder.

The executor declared four deviations, all accepted by the PM: `slug` added to the select
alongside `title`; existing test stubs widened without changing any old assertion; the
`existingEpisodeNumber === null` guard removed from the retry condition but kept for whether to
recompute the number; work done in a private worktree. Rule on each.

Local stack is up: API 54331, DB 54332. `psql` is not on the host — use
`docker exec -i supabase_db_$(grep '^project_id' supabase/config.toml | cut -d'"' -f2) psql -U postgres -d postgres`.

Review against the contract, not your preferences. Taste is a NIT. Only correctness, contract
violations, security and architectural violations are BLOCKING. Output using the CODEX REVIEW format.
