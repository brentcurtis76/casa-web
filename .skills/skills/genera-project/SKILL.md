# GENERA Project Skill

## ⛔ DELEGATION RULE — READ THIS FIRST

**Cowork does NOT edit GENERA/FNE files directly. EVER.**

All code changes, bug fixes, refactors, and file edits MUST go through `bridge_post_task` with `project='genera'`. This includes "quick fixes" and one-line changes. No exceptions.

Your role is to **diagnose, plan, and delegate** — not to write or edit code. If you find a bug, describe it clearly in the bridge task. If you know the fix, include it as guidance in the task prompt. But you do NOT touch the files yourself.

After posting, ALWAYS follow up with `bridge_wait_for_task` and report the result.

---

## Triggers

### Trigger Phrases
- "GENERA" / "genera project" / "FNE" / "FNE-LMS" / "FNE platform"
- "genera health" / "genera status"
- "learning management" / "student records" / "student portal"
- "course management" / "docente" / "estudiante" (in FNE project context)
- "GENERA issue" / "genera bug" / "genera task"
- `/genera`

### When NOT to Trigger
- User asks for a general **morning briefing** → use **daily-briefing** skill (it includes a one-line GENERA health summary; this skill is for focused GENERA queries)
- User asks about **CASA** or Iglesia Redentor → use **casa-project** skill
- User asks about a generic LMS or learning platform not specifically FNE/GENERA
- User asks about student data privacy in a general context (not FNE-specific)

### Priority
Trigger this skill whenever the user's primary focus is the GENERA/FNE project. If the user is asking for a morning roundup that mentions GENERA, use **daily-briefing** instead. GENERA and CASA are separate projects — never cross-contaminate context.

## MCP Dependencies
- `open-brain` (Supabase) — project context, decisions, deployment history
- `supabase-genera` — GENERA database queries, error logs (read-only)

## Project Context

| Field | Value |
|---|---|
| Framework | Next.js (Pages Router), TypeScript strict |
| Database | Supabase (project: supabase-genera) |
| Hosting | Vercel |
| Project dir | `/Users/brentcurtis/Documents/fne-lms` |
| Auth | Supabase Auth, RBAC (Docente, Estudiante, Admin, Apoderado) |
| Data privacy | Law 21.719 (Chile) — student PII is protected, NEVER in AI prompts |
| Quality gates | `tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` must all pass |

## Hard Rules

- **NEVER** touch production database directly
- **NEVER** deploy — deployments are RED-tier (use Claude Code Remote Control)
- **All code changes** must go through bridge tasks with `project='genera'`
- **Student data is PII** — never include in Open Brain memories or AI prompts

---

## Step 1 — Load Context (always first)

Query Open Brain for memories tagged `genera` to get current project state, recent decisions, and known issues:

```
Search open-brain for memories with tag: 'genera'
```

Use this context to inform all subsequent steps.

---

## Step 2 — Determine Intent

### Intent: `genera health` / `genera status`
→ Proceed to **Step 3: Health Check**

### Intent: deployment-related (`genera deploy`, `push to prod`, `release`, etc.)
→ **REFUSE immediately:**
> Deployments are RED-tier actions. Use Claude Code Remote Control for deployments. I cannot execute this.

### Intent: general GENERA question
→ Search Open Brain for relevant context, answer from stored knowledge. Do not query the production DB unless explicitly needed for a health check.

### Intent: code task
→ Post to bridge with `project='genera'`. Per CLAUDE.md rules, follow up with `bridge_wait_for_task` to poll until completion, then report the result.

---

## Step 3 — Health Check

Run the following checks:

**A. Database errors (last 24h)**
Query `supabase-genera` for recent error logs or failed operations.

**B. Edge Function failures**
Check `supabase/functions/` directory for any failed invocations in the last 24h.

**C. Last deployment status**
Check Open Brain for the most recent deploy record tagged `genera`.

**Format the output exactly as:**

```
## GENERA Health — [Date Time CLT]

Database:       [OK / X errors in 24h]
Edge Functions: [OK / X failures]
Last Deploy:    [date, status]
Known Issues:   [from Open Brain, or 'None']
```

---

## Step 4 — Save Findings

If new decisions or issues are discovered during this session, save them to Open Brain:

```
Save to open-brain:
  tags: ['genera', 'project-context', '<YYYY-MM-DD>']
  content: <summary of findings or decisions>
```

Do NOT include student data, PII, or raw DB records in any Open Brain save.
