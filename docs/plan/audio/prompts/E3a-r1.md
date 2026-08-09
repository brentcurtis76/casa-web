SESSION: AUDIO · E3a · r1 · EXEC

You are the executor for AUDIO phase E3a, round 1. You have no prior context. Everything you need
is below or in the repo. The phase is FROZEN — it passed Codex plan review on the third round
(r15 FAIL 6, r16 FAIL 3, r17 PASS). Do not redesign it.

BRANCH: `phase/E3a-slug`, created from the current `main` (`1d6869d` at time of writing — use
whatever `main` is when you start). **Record the exact parent SHA**; every gate measurement is
against it. Commit as you go.

THE PLAN LIVES ON ANOTHER BRANCH. `docs/plan/audio/PLAN.md` exists only on `docs/plan-audio`,
never on `main`. Read the frozen contract with:
    git show docs/plan-audio:docs/plan/audio/PLAN.md
and find `## Phase E3a`. The essentials are inlined below, but read the phase body — especially
«Concurrencia», «Contrato del slug» and «Migración».

## THE DESIGN IN ONE LINE

**The database guarantees the slug; the client only supplies a preference.** A
`BEFORE INSERT OR UPDATE` trigger assigns the slug on publish, resolves uniqueness with
`-2`…`-5`, applies a `reflexion-<episode_date>` fallback when no publisher supplies a base, and
freezes it once assigned (raising `23514`, never `23505`). This is why `podcast-backfill` needs no
change: it gets a slug for free.

## WHAT TO BUILD — 7 files

1. **A NEW migration** with a version above all 62 existing ones.
   `supabase/migrations/20260610090000_church_podcast_episodes.sql` is **read-only reference** —
   it is already in `schema_migrations`; editing it would be green locally and apply nothing to a
   deployed database. Order is mandatory and not negotiable:
   1. `ADD COLUMN IF NOT EXISTS slug TEXT`
   2. **Backfill** `published` rows with `slug IS NULL` → `reflexion-<episode_date>` + numeric
      tie-break
   3. `CHECK (slug IS NULL OR char_length(slug) BETWEEN 1 AND 80)`
   4. `CREATE UNIQUE INDEX idx_podcast_episodes_slug … WHERE slug IS NOT NULL`
   5. trigger function + `BEFORE INSERT OR UPDATE` trigger
   6. `CHECK (status <> 'published' OR slug IS NOT NULL)`
   Step 6 before step 2 **fails on a non-empty table** — that is measured, not theoretical.
2. `src/lib/sermon-editor/slug.ts` **(new)** — pure normalisation, no Supabase import:
   NFD → strip `\p{M}` → lowercase → `[^a-z0-9]+` → `-` → collapse → trim `-` → truncate ≤80 at the
   last `-` within budget, hard cut if there is none.
3. `src/lib/sermon-editor/publishService.ts` — supply the normalised base; **add `title` to the
   select at line 140** (today it selects `id, guid, episode_number`); make the publishing UPDATE
   `.select('episode_number, slug')`; return `slug` and `canonicalUrl`; retry the whole UPDATE
   generically on `23505` (recompute `max+1`, let the trigger re-derive).
4. `src/lib/sermon-editor/__tests__/slug.test.ts` **(new)**
5. `src/lib/sermon-editor/__tests__/publishService.test.ts` — **extend, do not rewrite.** The
   existing `retries once with a fresh max+1 on episode_number unique violation` (line 169) must
   keep passing.
6. `supabase/tests/slug.sql` **(new)**
7. `src/integrations/supabase/types.ts` — **add `slug` BY HAND** to `church_podcast_episodes`
   (`Row`, `Insert`, `Update`).

## EXPLICITLY OUT OF SCOPE

- **Do NOT regenerate `types.ts`.** §6 declares that its own unit; regeneration produces
  `+3749/-590` and reprints ~208 unrelated diagnostics. Surgical addition only.
- **Do NOT touch `supabase/functions/podcast-backfill/index.ts`.** The invariant covers it. Prove
  it with a test; do not modify it.
- **Do NOT touch `supabase/seed.sql` or `tests/e2e/smoke-local.spec.ts`.** Measured: with the
  trigger created by migration, the seed runs afterwards and gets its slug automatically. Both
  must stay byte-identical and still pass.
- Public pages (`E3b`), GUID trigger, `DELETE` prohibition, HTTP 404.

## KNOWN TRAP — Codex flagged this specifically

The mock builder in `publishService.test.ts` **ignores `_payload` and `_cols`**. The three declared
B2 mutations will NOT go red until you strengthen the mock or add equivalent spies. Budget for it.

## ACCEPTANCE CRITERIA — read all 16 from the frozen plan; these are the ones with teeth

- **E3a.1** `supabase db reset` green, `N → N+1` measured against the recorded parent SHA (62 → 63).
- **E3a.2** the migration is a NEW file; `git diff` shows the June 2026 one untouched.
- **E3a.5** an UPDATE to `published` **supplying no slug** — the exact shape of
  `podcast-backfill/index.ts:353` — yields a valid slug. Raw output.
- **E3a.10** the step-6 CHECK **before** the backfill fails. Demonstrate it; do not assert it.
- **E3a.11** persisted title A vs `metadata.title` B ⇒ base derives from **A**.
- **E3a.12** trigger resolves `x-2` over preference `x` ⇒ `PublishResult.slug === 'x-2'` and
  `canonicalUrl` ends `/x-2`, host `https://www.anglicanasanandres.cl`.
- **E3a.13** two concurrent sessions on the same base ⇒ no duplicate, loser gets `23505`, reissue
  succeeds. Raw output from both.
- **E3a.14** `db reset` green and `smoke-local.spec.ts` green **with both files unmodified**.
- **E3a.9** upgrade path: `supabase db reset --version <previous> --no-seed` → insert `published`
  rows without slug, **including two that collide** → `supabase migration up --local` → unique,
  stable, valid slugs and both CHECKs standing → finish with a clean reset.

## TEST COMMANDS

```bash
supabase db reset
npx vitest run --no-file-parallelism src/lib/sermon-editor
# psql is NOT on the host; the client lives in the container
docker exec -i supabase_db_$(grep '^project_id' supabase/config.toml | cut -d'"' -f2) \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/slug.sql
npx playwright test tests/e2e/smoke-local.spec.ts
```

The local stack is already up (API 54331, DB 54332). If not: `supabase start`.

## RULES

- Surgical changes only. Match existing patterns. No bulk edits.
- **Additive migrations only** — no DROP, TRUNCATE or destructive ALTER (D9, and a hard project rule).
- **Never touch the 11 Life OS tables** listed in `CLAUDE.md`.
- All UI and user-facing text in **Spanish** (D14). No member PII anywhere (D13).
- Every new test needs base-red or mutation evidence (D18). Paste the RED output, not just green.
- Gate: `scripts/gates/changed-files-diagnostics.sh` over the files you touch, against the
  recorded parent SHA. `npm run build` must be green.
- Do not grade your own work in prose. Show the diff and the raw output.
- If tests are red, iterate up to 3 times, then report `STATUS: BLOCKED` with the real error.
- **If you find the plan is wrong** — the schema won't support this, an assumption is false —
  STOP CODING and report `STATUS: FINDINGS`. That is the correct outcome, not a failure.

## WHEN DONE

Do **not** try to write the ledger: it lives on `docs/plan-audio`, a different branch, and the PM
appends it. Output exactly this report:

```
## EXECUTOR REPORT — E3a round 1
STATUS: COMPLETE | BLOCKED | FINDINGS
CONTEXT PRESSURE: comfortable | tight | ran out — <at what point?>
BRANCH: <branch>   PARENT SHA: <the main you branched from>   COMMITS: <sha…>
FILES CHANGED: <path (+x/-y) …>
WHAT I DID: <one bullet per acceptance criterion, mapped to its ID>
TEST COMMAND: <verbatim>
TEST OUTPUT: <verbatim tail, unedited>
GATE D18: <per-file diagnostics, base vs HEAD, plus build result>
ACCEPTANCE CRITERIA: <E3a.1–E3a.16: met / not met / partially — with reason>
DEVIATIONS FROM PROMPT: <or "none">
ASSUMPTIONS MADE: <or "none">
NOT DONE / OPEN:
```

Two reports in this workstream have arrived truncated, costing the PM a full re-measurement each
time. **If you are running short on context, cut WHAT I DID — never TEST OUTPUT or GATE D18.**
