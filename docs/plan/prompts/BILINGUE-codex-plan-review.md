# CODEX PLAN REVIEW — PLAN-BILINGUE v2

> Paste below the line into Codex (`gpt-5.6-sol`, `model_reasoning_effort = high`).
> Run from `/Users/brentcurtis/dev/casa-pilot` (branch `pilot/sop-v2` — it has both the plan
> and the merged code).

---

Adversarial review of `docs/plan/PLAN-BILINGUE.md` for CASA. You are not here to be agreeable —
you are the last check before we burn execution time on a bad plan. This plan is **not frozen**.
Nothing has been built from it.

REPO: `/Users/brentcurtis/dev/casa-pilot` (branch `pilot/sop-v2`)
PLAN: `docs/plan/PLAN-BILINGUE.md`
SOP the plan runs under: `docs/plan/SOP-PILOT.md` and `docs/plan/AGENT-WORKFLOW.md` §1
Prior art on the same codebase: `docs/plan/PLAN.md` (the closed cuentacuentos overhaul) and
`docs/plan/LEDGER.md`

## What the plan is for

CASA is a Spanish-language Anglican church platform (Vite 5 + React Router 6 SPA, Supabase,
Deno edge functions, Vercel). The goal is bilingual liturgies:

1. Choose the language when a liturgy is created; everything downstream honours it.
2. Translate an existing liturgy into the other language as an independent duplicate.
3. Let an English-speaking staff member operate the **liturgy builder** without reading Spanish.

## Read the actual codebase, not just the plan

The plan contains a "Verified current state" table asserting specific facts — file counts, string
counts, row counts, schema shapes, which edge functions carry Spanish prompts, which song table is
live. **Check them.** They were gathered by the planner and some are explicitly estimates. You have
the repo; you can also query the database through the `supabase-casa` MCP server if it is available
to you.

Facts most worth re-deriving, because the phase sizing rests on them:
- "~362 candidate Spanish strings across 36 builder files" — the plan admits this is a **regex
  estimate, not a count**. If it is materially wrong, B4a–B4d are mis-sized.
- "`music_songs` is the live catalog with 83 rows; `church_songs` has 0 rows and no readers."
- "7 edge functions carry hardcoded Spanish system prompts."
- "`liturgias` has no language column; `liturgia_elementos.source_id` exists with unknown semantics."

## Assess

1. **Does the plan match reality?** Anything it assumes about the code that isn't true?
2. **Sequencing.** Any phase depending on something a later phase builds? The plan claims three
   independent tracks and one join at B9 — is that right? It also claims B8 and B10 should start
   first despite their numbers.
3. **Sizing.** Any phase too large for a single session, or that leaves the tree broken? The SOP
   caps a phase at ≤10 files, ≤~600 net lines, one architectural concern, ending green and
   mergeable, with acceptance criteria fitting in ≤15 independently checkable lines.
4. **Acceptance criteria.** Any that are unverifiable, vague, or self-graded? B3.2 is claimed to be
   the load-bearing test of the whole plan — is it actually specified well enough to be written?
5. **Test plans.** Do they test behaviour, or merely that code runs?
6. **Missing phases — spend real effort here.** See below.
7. **Architecture.** The plan freezes eight decisions, L1–L8. Any you think is wrong? Say so now;
   it is cheaper here than in review. L1 (UI language and content language as independent axes),
   L3 (canonical liturgical texts curated, never machine-translated) and L8 (songs selected, never
   translated) are the ones that would be most expensive to reverse.

## Where the planner believes this plan is weakest — start here

The planner's own self-review is at the bottom of the document. Do not take its word for any of it;
do use it as a map of where to dig.

- **Unverified surfaces.** Nobody has checked whether **print/PDF export**, **presentation-mode
  slide rendering**, or **email/WhatsApp notification copy** emit Spanish independently of the
  builder. If any do, the plan is missing phases and cannot meet its stated goal. **A reviewer that
  only checks the phases that were written will not find the phases that were not.** This is the
  single highest-value thing you can do.
- **B9** joins every track, and its main risk is unresolved: `liturgia_elementos.source_id` already
  exists and nobody knows what it means. It may already encode a copy relationship that conflicts
  with the planned `origen_liturgia_id`.
- **Cover images may have Spanish text baked in.** Unverified. If true, B9.5 ("reuse images, do not
  regenerate") is wrong for those element types.
- **Element types look homogeneous in the schema and are not.** v1 of this plan would have
  machine-translated licensed worship-song lyrics; that was caught by querying actual rows, not by
  reading the schema. Ask what else that reasoning error hides — `custom-<uuid>` types, for
  instance, carry arbitrary user-authored content and appear ~35 times.

## Constraints the plan must respect

- Additive migrations only. No DROP, TRUNCATE, destructive ALTER, no column renames.
- The CASA Supabase project is **shared with Life OS**. Eleven Life OS tables are untouchable:
  `goals`, `habits`, `habit_logs`, `health_logs`, `journal_entries`, `life_areas`,
  `lifeos_calendar_events`, `lifeos_tasks`, `meditation_logs`, `project_health`, `workout_logs`.
- Branch names ≤20 characters (Vercel preview DNS).
- Existing quality gates must stay green: `npx tsc --noEmit`, `npm run lint`, `npm test`,
  `npm run build`, Playwright. Edge functions: `cd supabase/functions && deno test --allow-all --no-check .`
- Member PII never enters AI prompts or logs.

## Output — exactly this

```markdown
## CODEX PLAN REVIEW — PLAN-BILINGUE v2
VERDICT: PASS | FAIL
WHAT I VERIFIED MYSELF: <the commands and queries you ran, and what they returned — including
which of the plan's asserted facts you re-derived and whether they held>

BLOCKING:
- [B1] <finding> — <which phase or decision> — <why it blocks>

SHOULD-FIX:
- [S1] ...

NITS:
- [N1] ...

MISSING PHASES: <work the goal requires that no phase covers — or "none found, and here is what
I checked to be able to say that">

FROZEN DECISIONS I DISAGREE WITH: <L1–L8, with reasoning — or "none">
```

VERDICT: **PASS only if you would be willing to be held to this plan** — that is, if you would
accept being the reviewer of every phase it produces, on the basis that the plan told the truth
about the codebase and did not omit required work.
