# CASA — Project Instructions

## MANDATORY: No Direct Code Edits

**STOP. Do NOT use Edit, Write, or any file-modification tool on source files (.ts, .tsx, .js, .jsx, .css, .sql).**

When the user describes a bug, feature, or refactoring task, you MUST:

```bash
jb post "descriptive title" --project casa --type code --prompt "full description of the problem and what needs to change"
```

Then IMMEDIATELY:

```bash
jb wait <task_id> --timeout 300
```

This is not optional. This is not a suggestion. Do not explore the code first. Do not diagnose first. Do not create branches. Take the user's description, formulate a clear prompt, and post it to the pipeline. The pipeline agents (PM, Architect, Dev, Codex code review, QA) will handle the rest.

**The ONLY exceptions where you may edit files directly:**
- Brent explicitly says "skip the pipeline" or "just edit it directly"
- Typos in comments or markdown docs
- Config-only changes (env files, package.json version bumps)

If `jb` is not found, run: `export PATH="$HOME/.local/bin:$PATH"` and retry.

---

> Church community platform for Iglesia Redentor.
> Full project context: `~/SecondBrain/projects/casa.md`

## Project Identity

- **Framework**: Vite SPA, React Router 6, TypeScript strict
- **Database**: Supabase (shared instance with Life OS)
- **Auth**: Supabase Auth with 11 RBAC roles
- **Hosting**: Vercel (auto-deploy on push to `main`)
- **Repo path**: `/Users/brentcurtis/Documents/casa-web`

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

Vercel auto-deploys on push to `main`. Pushing to `main` is permitted after all quality gates pass.

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

## Key Features

- Presentation System (PresenterView + OutputDisplay, BroadcastChannel API)
- Liturgy Management
- Song Repository
- Mesa Abierta
- Community Directory

## Memory & Context

- Source of truth: Open Brain (Supabase pgvector `memories` table)
- Query with tags: `['casa']` | Write back with tags: `['casa', 'project-context']`
- Member PII is NEVER stored in Open Brain

---

*Canonical project context: ~/SecondBrain/projects/casa.md*
