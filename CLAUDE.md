# CASA — Claude Code Instructions

> Read this file at the start of every session.

## Project Overview

Church community management platform for Comunidad Anglicana San Andrés (CASA). Progressive Anglican church in Santiago, Chile. Serves community members, volunteers, and ministry coordinators across 11 roles.

## Stack
- Vite + React 18.3.1 + TypeScript 5.5.3
- Tailwind CSS 3 + 55 shadcn/ui components
- Supabase 2.49.4 (SHARED with Life OS — mulsqxfhxxdsadxsljss.supabase.co)
- react-router-dom 6.28 with createBrowserRouter (data router API)
- TanStack Query installed but NOT USED — do not introduce it
- 17 Edge Functions (Deno runtime)

## Dev Server
Port: **8080** (configured in vite.config.ts)

## Pipeline

This project uses an autonomous sub-agent pipeline with 7 agents (PM, Architect, DB, Developer, Security, UX Reviewer, QA). Start tasks with `/pipeline-start`. State lives in `.pipeline/`. Context in `.claude/skills/pipeline-context.md`. Don't modify pipeline files unless you're a pipeline agent.

### Pipeline Task Reset
At the start of every NEW pipeline task (i.e., when PM creates a new `current-task.md`), the PM must reset:
- `.pipeline/iteration-count.txt` → set to `0`
- Delete any stale `qa-fixes-required.md`, `qa-report.md`, `architect-infra-report.md` from the previous task
- Previous task reports can be moved to `.pipeline/archive/` for history

### Agent Status Tracking
Every pipeline agent MUST update `.pipeline/agent-status.json` at the start and end of its work:

**On start:**
```json
{ "agent": "<agent-name>", "status": "running", "started": "<ISO timestamp>", "task": "<brief description>" }
```

**On completion:**
```json
{ "agent": "<agent-name>", "status": "complete", "started": "<ISO timestamp>", "completed": "<ISO timestamp>", "output_file": "<report filename>" }
```

**On failure/crash (if possible):**
```json
{ "agent": "<agent-name>", "status": "failed", "started": "<ISO timestamp>", "failed": "<ISO timestamp>", "error": "<what went wrong>" }
```

The next agent in the pipeline MUST read `agent-status.json` before starting. If the previous agent's status is `"running"` and has no `"completed"` timestamp, treat the report file as potentially incomplete and flag this in your own report.

## Report Size Limits

Pipeline agent reports can grow large over multiple iterations, consuming context window and degrading agent decision quality. Rules:

- **Max report size**: 200 lines per agent report. If findings exceed this, prioritize (CRITICAL/MUST FIX first) and write overflow to a separate file (e.g., `security-report-full.md`) with a reference in the main report.
- **Iteration reports are deltas**: On iteration 2+, reports should contain ONLY what changed since the last iteration. Reference the previous report for unchanged findings. Structure: "## New findings", "## Resolved findings (from iteration N-1)", "## Still open". Do NOT copy forward the full previous report.
- **PM reads deltas on iterations**: On iteration 2+, PM reads only the new qa-report.md and the delta sections of updated reports — not the full history. Previous iterations are in `.pipeline/archive/`.
- **Archive previous iterations**: Before starting iteration N, move iteration N-1's reports to `.pipeline/archive/iteration-N-1/`. This keeps the working `.pipeline/` directory clean and prevents agents from accidentally reading stale reports.

### Pipeline Agent Skills — Canonical Copy

Each pipeline agent (PM, Architect, DB, Developer, Security, UX, QA) has a dedicated skill file in `.claude/skills/` that defines its role, procedure, report format, and decision rules. There is also a `pipeline-orchestrator.md` that manages flow transitions.

These 8 skill files are **shared across three projects**: FNE, CASA (this project), and Life OS. The role behavior is identical — project-specific context comes from `pipeline-context.md`, which is unique to each project.

**Canonical copies** live in this project's `.claude/skills/` directory. When improving an agent skill (e.g., refining how the Security agent evaluates RBAC), update it here and then sync the change to the other two projects:
- FNE: `~/Documents/fne-lms-working/.claude/skills/`
- Life OS: `~/Documents/life-os/.claude/skills/`

Only `pipeline-context.md` should differ between projects. The 8 agent skill files (`pipeline-orchestrator.md`, `pipeline-pm.md`, `pipeline-architect.md`, `pipeline-db.md`, `pipeline-dev.md`, `pipeline-security.md`, `pipeline-ux.md`, `pipeline-qa.md`) must stay in sync.

## Quality Commands
```bash
npx tsc --noEmit       # TypeScript check
npm run lint           # ESLint
npm test               # Vitest unit tests
npm run build          # Vite production build
npm run test:e2e       # Playwright E2E (port 8080)
```

Run ALL checks before reporting any task complete.

## Critical Rules
1. NEVER run destructive Supabase migrations — database is shared with Life OS
2. NEVER read .env files — use .env.example for reference
3. NEVER modify files with " 2", " 3", " 4" suffixes — they are Lovable platform artifacts
4. NEVER introduce TanStack Query patterns — use raw Supabase client like existing code
5. Use existing shadcn/ui components (55 available) before creating custom ones
6. Follow existing code patterns — read before writing
7. Data fetching: Supabase client + useState/useEffect

## Data Privacy

This platform stores religious community data including member PII, pastoral care records, attendance, and financial information (tithes/offerings).
- Handle member PII (names, emails, phone numbers, addresses) with care
- Pastoral records are sensitive — restrict access to authorized roles
- Financial data (tithes, offerings) requires appropriate access controls
- NEVER use real community member data in development or testing — synthetic data only
- All new data collection should be evaluated for privacy impact
- AI features (Edge Functions) must NOT receive real member PII in prompts

## Key Architecture
- **Presentation system**: Multi-window (presenter + output). BroadcastChannel API for sync. DO NOT break this sync mechanism.
- **React Router v6**: createBrowserRouter with data loaders. Follow this pattern for new routes.
- **Edge Functions**: Deno runtime in supabase/functions/. NOT Node.
- **Auth**: Supabase Auth with role-based access via AuthContext.

## RBAC — 11 Roles
1. **General Admin** — Full access to all modules and features
2. **Liturgist** — Liturgy builder (create, edit, delete liturgies)
3. **AV Volunteer** — Presenter, Stem Player, Graphics Generator
4. **Worship Coordinator** — Musician calendar, songs, chord charts, stems
5. **Comms Volunteer** — Graphics Generator only
6. **Mesa Abierta Coordinator** — Mesa Abierta module only
7. **Financial Admin** — Administrative/Accounting module
8. **Concilio Member** — Financial reports (read-only), Church Leadership
9. **Equipo Pastoral** — Financial reports, Leadership, Liturgies
10. **Children Ministry Coordinator** — Children ministry module (lessons, calendar, inventory)
11. **Children Ministry Volunteer** — Calendar availability, assigned lessons only

## File Duplication Warning
This project originated from Lovable platform. Many files have " 2", " 3", " 4" suffix duplicates. These are artifacts — do not modify, import, or reference them.

## File Structure
```
casa-web/
├── src/
│   ├── components/    # React components (by feature)
│   │   ├── admin/           # Admin dashboard
│   │   ├── auth/            # Authentication (AuthContext)
│   │   ├── canciones/       # Song repository
│   │   ├── cuentacuentos/   # Children's story system
│   │   ├── liturgia/        # Liturgy form & editors
│   │   ├── liturgia-builder/# Liturgy constructor
│   │   ├── mesa-abierta/    # Community dinners
│   │   ├── presentation/    # Live presentation (55+ files)
│   │   ├── sermon-editor/   # Sermon audio editor
│   │   └── ui/              # 55 shadcn/ui components
│   ├── hooks/         # Custom hooks
│   ├── lib/           # Services & utilities
│   ├── pages/         # Page components
│   ├── integrations/  # Supabase client & types
│   └── types/         # Shared TypeScript types
├── supabase/
│   ├── functions/     # 17 Edge functions (Deno)
│   └── migrations/    # Database migrations
├── tests/
│   └── e2e/          # Playwright tests
└── .pipeline/        # Autonomous agent pipeline state
```

## Database Schema

CASA shares a Supabase instance (mulsqxfhxxdsadxsljss) with Life OS.

### CASA tables
- 17+ tables prefixed with `church_*` covering membership, worship, presentations, communication, and tracking
- Query Supabase MCP for the current full list

### Shared instance rules
- NEVER modify tables without `church_` prefix — they likely belong to Life OS
- All migrations prefixed with `casa_` in filename
- All migrations additive only — no DROP, no TRUNCATE
- DB agent verifies table ownership via Supabase MCP before any migration

### RLS
- All tables with member data MUST include RLS policies
- New tables storing member PII require privacy impact consideration

### Migrations
- DB agent designs all migrations (between Architect and Developer in pipeline)
- All migrations additive only — no DROP, no TRUNCATE
- `supabase db push --dry-run` required before actual push
- Migration files live in `supabase/migrations/`

## Ralph Wiggum Loop
For implementation tasks: execute → verify each criterion with actual command output → iterate if fail → only report done when ALL pass with proof.

## Development Standards

Key points:
- Follow existing code patterns
- Write tests for new functionality
- Use TypeScript strictly (no `any` without justification)
- Run `npm run lint` before committing
- Handle error cases
- Remove `console.log` before completing
- Show actual command output as proof — never claim "tests pass" without evidence

## Key Directories

- `/src/components` — React components (by feature)
- `/src/pages` — Page components
- `/src/lib` — Business logic and utilities
- `/src/hooks` — Custom React hooks
- `/src/types` — Shared TypeScript types
- `/supabase/functions` — Edge Functions (Deno)

## Before Making Changes

1. Read relevant existing code first
2. Check existing component patterns
3. Follow the existing patterns in the codebase

---

## CC-Bridge (Secondary Workflow)

The CC-Bridge is a communication bridge between Cowork and Claude Code for tasks that originate from Cowork — NOT from the pipeline. It is only relevant when Cowork sends a task.

**Only check CC-Bridge when explicitly told to** (e.g., "check the bridge"). Do NOT check it automatically on startup. The pipeline takes priority.

### When a CC-Bridge task is active

If told to check the bridge, read `.cc-bridge/status.json`. If `"status": "prompt_pending"`, read `.cc-bridge/prompt.json` and execute the task.

### Self-Iteration Prompts

Some CC-Bridge prompts require iteration until completion criteria are met. Look for:
- "Self-Iteration Required" sections
- "Do NOT respond until..." instructions
- Completion criteria checklists

When you see these, work until ALL criteria are satisfied. Do not respond with partial results.

### Reporting Back

After completing a CC-Bridge task, write results to:

1. `.cc-bridge/status.json`:
```json
{
  "status": "done",
  "prompt_id": "<use the id from prompt.json>",
  "updated": "<ISO timestamp>",
  "message": "Task completed successfully"
}
```

2. `.cc-bridge/response.json`:
```json
{
  "id": "<matching prompt_id>",
  "timestamp": "<ISO timestamp>",
  "status": "success",
  "summary": "<1-2 sentence summary>",
  "changes": ["files modified"],
  "needs_review": true,
  "next_steps": ["follow-up tasks"]
}
```

CC-Bridge reporting is only for CC-Bridge tasks. Pipeline tasks use `.pipeline/` reports.
