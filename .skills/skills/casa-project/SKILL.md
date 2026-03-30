# CASA Project Skill

## ⛔ DELEGATION RULE — READ THIS FIRST

**Cowork does NOT edit CASA files directly. EVER.**

All code changes, bug fixes, refactors, and file edits MUST go through `bridge_post_task` with `project='casa'`. This includes "quick fixes" and one-line changes. No exceptions.

Your role is to **diagnose, plan, and delegate** — not to write or edit code. If you find a bug, describe it clearly in the bridge task. If you know the fix, include it as guidance in the task prompt. But you do NOT touch the files yourself.

After posting, ALWAYS follow up with `bridge_wait_for_task` and report the result.

---

## Triggers

### Trigger Phrases
- "CASA" / "casa project" / "casa web"
- "Redentor" / "iglesia" / "church platform" / "church website"
- "liturgy" / "liturgy management" / "liturgy planning"
- "mesa abierta" / "presentación" / "presentation system"
- "oraciones" / "song repository" / "community directory"
- "casa health" / "casa status"
- `/casa`

### When NOT to Trigger
- User asks for a general **morning briefing** → use **daily-briefing** skill (it includes a one-line CASA health summary; this skill is for focused CASA queries)
- User asks about **GENERA/FNE** → use **genera-project** skill
- User wants to **confirm a meeting with a CASA contact** → use **meeting-confirmation** skill (that skill handles language detection; this skill may be consulted for contact preferences, but the flow is driven by meeting-confirmation)
- User mentions "casa" in Spanish meaning "house" in a non-project context

### Priority
Trigger this skill whenever the user's primary focus is the CASA church platform. If the user is asking for a morning roundup that mentions CASA, use **daily-briefing** instead. For meeting confirmations with congregation members, the driver skill is **meeting-confirmation** (this skill provides contact context).

---

## Project Context

**CASA** is a church community platform for Iglesia Redentor. It is a living system used by real congregation members — treat all data with pastoral care.

| Detail | Value |
|---|---|
| Framework | Vite SPA, React Router 6.28, TypeScript strict |
| Database | Supabase shared instance with Life OS (ref: `mulsqxfhxxdsadxsljss`) |
| Hosting | Vercel |
| Project dir | `/Users/brentcurtis/Documents/casa-web` |
| Auth | Supabase Auth, 11 RBAC roles |
| Design | Tailwind 3, shadcn/ui (55 components), Montserrat + Merriweather fonts |
| Quality checks | `tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, Playwright E2E |

**Key features:**
- Presentation System
- Liturgy Management
- Song Repository
- Mesa Abierta
- Community Directory

---

## Required MCP Dependencies
- `open-brain` (Supabase) — project context, congregation contacts, decisions
- `supabase-casa` — CASA database queries (read-only, ref: `mulsqxfhxxdsadxsljss`)

---

## Steps

### 1. Load Context
Query Open Brain for memories tagged `casa`:
```
Search Open Brain for: tag:casa
```
Surface: current project state, recent decisions, known issues, congregation context.

### 2. Determine Intent

| User says... | Action |
|---|---|
| `casa health` / `casa status` | Run Health Check (Step 3) |
| `casa deploy` / anything deployment-related | **REFUSE** — see RED-TIER rule below |
| Congregation / contact query | Search Open Brain for contact info and preferences |
| Code task | Post to bridge with `project='casa'` |
| Meeting / event query | Cross-reference with `google-calendar` if available |

---

### 3. Health Check

Query `supabase-casa` for:
- Recent error logs (last 24h)
- Edge Function status: `generate-oraciones`, `generate-story`, `mesa-abierta`
- Recent deployment record

Format the result as:

```
## CASA Health — [Date Time]
Database:       [OK / X errors in 24h]
Edge Functions: [OK / X failures]
Last Deploy:    [date, status]
Known Issues:   [from Open Brain, or 'None']
```

Save findings to Open Brain with tags: `['casa', 'health-check', YYYY-MM-DD]`.

---

### 4. Congregation Contacts

When handling any contact or communication task, always check Open Brain for:
- **Language preference** — default is **Spanish** for all CASA contacts
- **Communication channel** — WhatsApp, email, etc.
- **Relationship notes**

Never include member PII in AI prompts or Open Brain. Use initials or role references only.

---

### 5. Save Decisions

After any session that produces a decision, finding, or action item, save to Open Brain:
- Tags: `['casa', 'project-context', YYYY-MM-DD]`
- Include: what was decided, why, and any follow-up needed

---

## Hard Rules

### RED-TIER: NO DEPLOYMENTS
```
Deployments are RED-tier actions. Use Claude Code Remote Control for deployments.
Remember the FNE incident — always verify the Vercel project name before any deployment.
```
Do not deploy under any circumstances. Do not run `vercel`, `vercel --prod`, or trigger Vercel GitHub CI via any mechanism. Refuse clearly and remind the user to use Claude Code Remote Control.

### Database Safety
- **NEVER** touch production database directly — it is shared with Life OS
- **NEVER** run `DROP`, `TRUNCATE`, or destructive `ALTER` on any table
- Schema changes must be additive only
- `supabase-casa` MCP is read-only — use it for queries only

### Code Changes
- All code changes go through bridge tasks with `project='casa'`
- Run quality checks before marking any task complete: `tsc --noEmit && npm run lint && npm run build`

### Privacy
- Member PII never goes in AI prompts or Open Brain
- Use synthetic data only for development and testing

### Language
- Spanish is the default language for all CASA-related communication and output
- Switch to English only if the user explicitly requests it for a specific task

---

## Bridge Task Template

When posting a code task to the bridge:
```json
{
  "project": "casa",
  "task": "<description of what to do>",
  "context": "<relevant files, components, or constraints>"
}
```

After posting, always follow up with `bridge_wait_for_task` and report the result.
