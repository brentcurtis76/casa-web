# CASA — Project Instructions

## Execution Modes

### Direct Execution (DEFAULT)
Work directly by default — no trigger phrase required:

1. Create or continue a feature branch (≤20 chars, e.g. `fix/child-url`, `feat/lic-p6`)
2. Read `~/SecondBrain/SKILL-TRIGGERS.md` — if the task matches a skill trigger, read and follow that SKILL.md
3. Make the edits, run ALL quality gates (tsc, lint, build)
4. Commit with a clear message
5. Push the feature branch. Merge to `main` ONLY when Brent explicitly says to merge/ship/release — never automatically.

### Bridge Mode (ONLY when Brent explicitly selects it)
Post a bridge task only when Brent's current message explicitly asks for it ("use the bridge for this task", "post this to bridge", "run this through the pipeline"):

```bash
jb post "descriptive title" --project casa --type code --prompt "full description"
jb wait <task_id> --timeout 300
```

The bridge uses the dynamic orchestrator (`pipeline-orchestrator.md`) with Haiku-generated agent manifests, independent Codex review, and Telegram notifications.

Mentioning a Bridge task, reviewing a Bridge failure, or asking about Bridge status is NOT authorization to post another task.

**Do NOT run `~/SecondBrain/pipeline/pipeline-start.md` inline.** That file is the legacy hardcoded sequence.

### Notes
- If `jb` is not found: `export PATH="$HOME/.local/bin:$PATH"` and retry

---

> Church community platform for Iglesia Redentor.
> Full project context: `~/SecondBrain/projects/casa.md`

## Project Identity

- **Database**: Supabase (shared instance with Life OS)
- **Auth**: Supabase Auth with 11 RBAC roles
- **Hosting**: Vercel (auto-deploy on push to `main`)

## Multi-Agent Pipeline

This project uses the **Jake Pipeline** — a multi-agent workflow with multi-vendor LLM routing.

**Infrastructure lives in SecondBrain (single source of truth):**
- Agent skill files: `~/SecondBrain/pipeline/agents/` (pm, architect, db, dev, refactor, security, ux, qa)
- Router config: `~/SecondBrain/claude-code-router.yaml`
- Router implementation: `~/SecondBrain/claude_code_router.py`
- LLM clients: `~/SecondBrain/llm_clients.py`

**Do NOT** copy pipeline agents or router config into this repo. Edit them in SecondBrain — changes propagate automatically on next task run.

## Skills

On any user message, check if it matches a skill trigger. If it does, read `~/SecondBrain/SKILL-TRIGGERS.md` to find the correct SKILL.md path, then read and follow that SKILL.md.

Quick trigger keywords: daily briefing, receipt, expense, meeting confirmation, itinerary, financial report, genera, casa, youtube intel, file cleanup, pipeline status, code review, recommendations, implement finding, orchestrate.

Full trigger table: `~/SecondBrain/SKILL-TRIGGERS.md`

## Deployment

Vercel auto-deploys on push to `main`. When Brent explicitly approves a merge/ship/release, merge the feature branch to `main` (fast-forward when possible) — deployment happens automatically. No manual `vercel` CLI commands (use the git merge workflow only).

## Quality Gates

ALL must pass or be discharged by the narrow behaviour-free rule below before any task
is reported complete:
- `npx tsc --noEmit`
- `npm run lint`
- `npm test`
- `npm run build`
- `npx playwright test` (E2E)

**Behaviour-free exception.** A phase whose frozen contract changes only tests,
documentation and comments —no runtime source, dependency, migration, config, generated
artifact or E2E surface— may discharge a pre-existing red unit-test/lint gate or a
Playwright run that stops at the anti-production guard, but only when all of the
following are recorded:

1. the phase-specific changed-file gate proves zero new diagnostics;
2. the exact failure and exit are reproduced on the phase parent with the same runtime;
3. the phase plan explicitly classifies the work as behaviour-free and authorizes the
   discharge; and
4. the report includes the raw command and result.

Any runtime/E2E/config change loses this exception. Never bypass the Playwright guard,
invent credentials, reuse another local Supabase project or point E2E at production.

## Hard Rules

- **Database is shared with Life OS** — the CASA Supabase project (`mulsqxfhxxdsadxsljss`)
  holds both CASA's schema and Life OS's. **Never touch these 11 Life OS tables**, and
  verify ownership before any schema change:
  `goals`, `habits`, `habit_logs`, `health_logs`, `journal_entries`, `life_areas`,
  `lifeos_calendar_events`, `lifeos_tasks`, `meditation_logs`, `project_health`,
  `workout_logs`.
  Everything else in that project is CASA-owned and created by migrations in this repo —
  `church_*` (61 tables) plus `music_*`, `mesa_abierta_*`, `casa_*`, `liturgia*`,
  `graphics_*`, `cuentacuentos_*`, `sermon_*`, `presentation_*`, `financial_*` and others.
  (This rule previously read "only touch `church_*` prefixed tables". That was the naming
  convention when it was written, not the actual boundary: the music planning, RBAC and
  financial schemas all shipped outside `church_*`. Corrected 2026-08-06 after auditing
  all 128 tables in the project. Open Brain is a **separate** project,
  `nnfwmjqrvyvtpfrxnkvz`, and is not the shared one.)
- **Only additive migrations** — no DROP, TRUNCATE, or destructive ALTER.
- **Member PII is protected** — never in AI prompts, never in Open Brain. Use initials or role references.
- **Synthetic data only** for dev/testing.
- **Branch names ≤20 characters** for Vercel DNS limits.
- **Spanish is default language** for all CASA communication and output.

## RBAC Roles

Admin, Liturgist, AV Volunteer, Worship Coordinator, Musician, Small Group Leader, Member, Prayer Team, Finance Admin, Content Editor, Guest

## Memory & Context

- Source of truth: Open Brain (Supabase pgvector `memories` table)
- Query with tags: `['casa']` | Write back with tags: `['casa', 'project-context']`
- Member PII is NEVER stored in Open Brain

---

*Canonical project context: ~/SecondBrain/projects/casa.md*
