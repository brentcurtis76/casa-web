# CASA — Project Rules

> Church community platform for Iglesia Anglicana del Redentor.
> Vite + React + TypeScript + Tailwind/shadcn + Supabase.

---

## Who Are You?

If you are **Cowork**: you diagnose, plan, and delegate. You do NOT edit files. Read the Cowork section below.

If you are **Claude Code**: you execute tasks. Read the Claude Code section below.

Both: read Hard Rules and Project Context regardless.

---

## Cowork Rules

**You do NOT edit files in this project. EVER.**

All code changes, bug fixes, refactors — including one-line fixes — go through `bridge_post_task` with `project='casa'`.

Your job:
1. Investigate the issue (read files, check logs, trace the bug)
2. Describe the root cause and the fix clearly
3. Post it via `bridge_post_task` with enough context for Claude Code to execute
4. Follow up with `bridge_wait_for_task` and report the result

You may READ any file for diagnosis. You may NOT write, edit, or create files.

### Bridge Task Format

```json
{
  "project": "casa",
  "task": "<what to do>",
  "context": "<relevant files, root cause, suggested fix>"
}
```

---

## Claude Code Rules

When executing a task:
1. Create a feature branch (≤20 chars, e.g. `fix/child-url`)
2. Make the changes
3. Run ALL quality gates before reporting complete:
   - `npx tsc --noEmit`
   - `npm run lint`
   - `npm run build`
4. Commit with a clear message
5. Report result back through the bridge

If any quality gate fails, fix the issue before reporting complete. Never skip gates.

---

## Hard Rules

### NO DEPLOYMENTS
Deployments are RED-tier. Do not run `vercel`, `vercel --prod`, or trigger Vercel CI. Refuse clearly. The user deploys manually or through a controlled process.

### Database Safety
- Supabase instance is SHARED with Life OS — destructive changes affect both
- NEVER run `DROP`, `TRUNCATE`, or destructive `ALTER`
- Schema changes must be additive only
- DB agent owns all migrations — do not write migration SQL directly

### Privacy
- Member PII never goes in AI prompts, commits, or logs
- Synthetic data only for dev/testing
- AI Edge Functions must NOT receive real member PII

### Branch Naming
- MUST be ≤20 characters (e.g., `feat/lic-p6`, `fix/auth-bug`)
- Vercel preview URLs include the branch name — long names cause DNS failures

---

## Project Context

### Architecture
- **Framework**: Vite SPA, React Router 6.28 (`createBrowserRouter`)
- **Language**: TypeScript strict mode
- **Database**: Supabase (shared instance, ref: `mulsqxfhxxdsadxsljss`)
- **Auth**: Supabase Auth, 11 RBAC roles via AuthContext
- **Hosting**: Vercel (auto-deploys on push to `main`)
- **UI**: Tailwind 3, shadcn/ui (55 components — check before creating new ones)
- **Fonts**: Montserrat (sans), Merriweather (serif)

### Data Fetching Pattern (FOLLOW THIS)
```typescript
const [data, setData] = useState<Type[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchData = async () => {
    const { data, error } = await supabase.from('table').select('*');
    if (error) console.error(error);
    else setData(data);
    setLoading(false);
  };
  fetchData();
}, []);

// WRONG — do NOT use TanStack Query even though it's installed
```

### RBAC Roles (11)
General Admin, Liturgist, AV Volunteer, Worship Coordinator, Comms Volunteer, Mesa Abierta Coordinator, Financial Admin, Concilio Member, Equipo Pastoral, Children Ministry Coordinator, Children Ministry Volunteer. Every protected feature MUST check the user's role via AuthContext.

### Component Structure
- Layout: `src/components/layout/`
- Features: `src/components/` (by feature)
- Pages: `src/pages/`
- Hooks: `src/hooks/`
- Shared types: `src/types/shared/`

### Core Features
1. **Presentation System** — Multi-window PresenterView + OutputDisplay, BroadcastChannel API, projector support (1920x1080+)
2. **Liturgy Management** — Anglican calendar, service planning, AI content generation via Gemini (Edge Functions)
3. **Song Repository** — Hymn/song database, chord charts, transpose
4. **Mesa Abierta** — Community dinner management, RSVPs (has existing tests)
5. **Community Directory** — Member profiles, pastoral care

### Edge Functions (supabase/functions/)
AI generation: generate-oraciones, generate-story, generate-illustration, generate-scene-images, generate-children-lesson, refine-story
Bible: fetch-bible-passage
Liturgy: prayer-request, process-reflexion-pdf
Media: spotify-sermones, instagram-feed
Mesa Abierta: create-mesa-matches, match-participants, admin-add-participant
Notifications: send-mesa-notifications, send-mesa-whatsapp, whatsapp-signup, send-signup-confirmation
