> **CRITICAL — READ FIRST:** No bridge MCP exists in this session. Never search for `bridge_post_task` or similar tools. Use `jb post ... --project casa` via the bash tool. See "Bridge Mode" section below.

# CASA — Project Instructions

## Execution Modes

### Bridge Mode (DEFAULT — always, for every code task)
All tasks touching source files go through the bridge:

```bash
jb post "descriptive title" --project casa --type code --prompt "full description"
jb wait <task_id> --timeout 300
```

This applies to every code task regardless of:
- Task size or perceived simplicity
- Number of files involved
- Whether the task feels "trivial"
- Whether you think you could do it faster directly

The bridge uses the dynamic orchestrator (`pipeline-orchestrator.md`) with Haiku-generated agent manifests, independent Codex review, and Telegram notifications.

**Do NOT run `~/SecondBrain/pipeline/pipeline-start.md` inline.** That file is the legacy hardcoded sequence.

### Direct Execution (ONLY when Brent explicitly invokes it)
Trigger phrases, exact or near-exact:
- "skip the pipeline"
- "just edit it directly"
- "direct edit"
- "don't post to bridge"
- "inline only"
- "edit directly"

Without one of those phrases, DO NOT touch source files directly. Do not restructure the task to fit Direct Execution. Do not inline components to reduce file count. Post to bridge.

When Brent invokes Direct Execution:
1. Create a feature branch (≤20 chars, e.g. `fix/child-url`, `feat/lic-p6`)
2. Read `~/SecondBrain/SKILL-TRIGGERS.md` — if the task matches a skill trigger, read and follow that SKILL.md
3. Make the edits, run ALL quality gates (tsc, lint, build)
4. Commit with a clear message
5. Push to feature branch. If Brent approves, merge to `main` for auto-deploy.

### Hard Rule
If you're about to use the Edit or Write tool on source files and Brent has NOT used a Direct Execution trigger phrase, STOP. Post to bridge instead.

### Notes
- Documentation-only edits (CLAUDE.md, README.md, comments) do not require Bridge Mode
- If `jb` is not found: `export PATH="$HOME/.local/bin:$PATH"` and retry

---

> Church community platform for Iglesia Redentor.
> Full project context: `~/SecondBrain/projects/casa.md`

## Project Identity

- **Framework**: Vite SPA, React Router 6, TypeScript strict
- **Database**: Supabase (shared instance with Life OS)
- **Auth**: Supabase Auth with 11 RBAC roles
- **Hosting**: Vercel (auto-deploy on push to `main`)
- **Repo path**: `/Users/brentcurtis/Documents/CASA/casa-web`

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

Vercel auto-deploys on push to `main`. After all quality gates pass, merge the feature branch to `main` — deployment happens automatically. No manual `vercel` CLI commands (use git merge workflow only). Pushing/merging to `main` is permitted and is the standard deploy path.

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
