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

ALL must pass before any task is reported complete:
- `npx tsc --noEmit`
- `npm run lint`
- `npm test`
- `npm run build`
- `npx playwright test` (E2E)

## Hard Rules

- **Database is shared with Life OS** — only touch `church_*` prefixed tables. Verify table ownership before any schema change.
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
