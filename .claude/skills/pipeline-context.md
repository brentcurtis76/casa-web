# CASA — Pipeline Context

## Architecture Overview
- SPA with client-side routing via react-router-dom 6.28 (createBrowserRouter)
- Auth via Supabase Auth with role-based access
- Data fetching: Raw Supabase client + useState/useEffect (NOT TanStack Query)
- 17 Edge Functions (Deno) for AI, payments, notifications, liturgy

## Core Features
1. **Presentation System** (PRIMARY)
   - Multi-window: PresenterView + OutputDisplay
   - BroadcastChannel API for real-time sync between windows
   - Supports liturgy slides, song lyrics, Bible readings, media
   - Must work on projector displays (large screens)

2. **Liturgy Management**
   - Liturgical calendar following Anglican traditions
   - Service planning with readings, songs, prayers
   - AI-powered content generation via Gemini API (Edge Functions)

3. **Song Repository**
   - Hymn/song database with chord charts
   - Transpose functionality
   - Song search and categorization

4. **Mesa Abierta** (Community Dinners)
   - Only feature with existing tests
   - Dinner event management and RSVPs

5. **Community Directory**
   - Member profiles and contact information
   - Pastoral care tracking

## Component Patterns
- 55 shadcn/ui components available — ALWAYS check before creating new ones
- Layout components in src/components/layout/
- Feature components organized by feature in src/components/
- Pages in src/pages/
- Hooks in src/hooks/

## Design Tokens
- Tailwind 3 standard config (tailwind.config.ts)
- Warm, respectful aesthetic appropriate for church context
- Accessible to older community members (adequate font sizes, contrast)
- Presentation mode: high contrast, large text for projection
- Custom "casa" grayscale palette (50-900)
- Fonts: Mont (Montserrat) for sans, Merriweather for serif

## Data Fetching Pattern
```typescript
// CORRECT — follow this pattern
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
// const { data } = useQuery({ queryKey: ['table'], queryFn: ... });
```

## RBAC — 11 Platform Roles
1. **General Admin** — Full access to all modules and features
2. **Liturgist** — Liturgy builder (create, edit, delete liturgies)
3. **AV Volunteer** — Presenter, Stem Player, Graphics Generator
4. **Worship Coordinator** — Musician calendar, songs, chord charts, stems
5. **Comms Volunteer** — Graphics Generator only
6. **Mesa Abierta Coordinator** — Mesa Abierta module only
7. **Financial Admin** — Administrative/Accounting module
8. **Concilio Member** — Financial reports (read-only), Church Leadership
9. **Equipo Pastoral** — Financial reports, Leadership, Liturgies
10. **Children Ministry Coordinator** — Children ministry module
11. **Children Ministry Volunteer** — Calendar availability, assigned lessons only

Every protected feature MUST check the user's role before granting access. Use the existing AuthContext pattern.

## Data Privacy
- Religious community data: member PII, pastoral records, attendance, financial data
- Handle member PII (names, emails, phone numbers) with care
- Pastoral records are sensitive — restrict to authorized roles only
- Financial data (tithes, offerings) requires access controls
- Synthetic data ONLY for development/testing — NEVER real member records
- AI Edge Functions must NOT receive real member PII in prompts

## Pipeline Flow (with DB Agent)
1. PM specs the task → `current-task.md`
2. Architect validates approach → `architect-review.md`
3. **DB agent designs migration (if schema changes needed)** → `db-report.md`
4. Developer implements application code (uses DB agent's migration file)
5. Security reviews code + migration SQL → `security-report.md`
6. UX Reviewer checks UI (if applicable) → `ux-report.md`
7. PM final review of all reports → `pm-review.md`
8. On APPROVE: Architect runs `supabase db push` (if migration exists), deploys to staging
9. QA tests staging → `qa-report.md`

## Quality Commands
- `npx tsc --noEmit` — TypeScript check
- `npm run lint` — ESLint
- `npm test` — Vitest
- `npm run build` — Vite production build

ALL four must pass before ANY task is reported complete.

## Supabase Shared Instance
- Project ref: mulsqxfhxxdsadxsljss
- URL: mulsqxfhxxdsadxsljss.supabase.co
- Shared with Life OS — tables for both apps coexist
- All schema changes must be additive
- DB agent owns all migrations — Developer does not write migration SQL
- Edge Functions: Deno runtime, deployed via Supabase CLI

## Deployment
- Vercel
- Auto-deploys on git push
- Staging: branch deploys (feature/* branches)
- Production: main branch

## Routes (current)
| Path | Page |
|------|------|
| `/` | Index (homepage) |
| `/mesa-abierta/dashboard` | Community dinner dashboard |
| `/mesa-abierta/admin` | Mesa Abierta admin |
| `/admin` | Admin dashboard |
| `/admin/events` | Events admin |
| `/admin/graphics` | Graphics generator |
| `/admin/liturgia/temporadas` | Liturgical seasons |
| `/admin/liturgia/oraciones` | Antiphonal prayers |
| `/admin/liturgia/canciones` | Songs |
| `/admin/liturgia/elementos-fijos` | Fixed liturgical elements |
| `/admin/liturgia/constructor` | Liturgy builder |
| `/admin/sermon-editor` | Sermon editor |
| `/presenter` | Live presentation |
| `/output` | Presentation output view |
| `/recursos/archivo` | Resource archive |
| `/profile` | User profile |
| `/reset-password` | Password reset |
| `/anuncios` | Announcement slideshow |

## Shared Types (src/types/shared/)
- `slide.ts` — Slide, SlideGroup, SlideType, VideoSettings, ExportOptions
- `song.ts` — Song types
- `story.ts` — Cuentacuentos story types
- `liturgy.ts` — Liturgy context and element types
- `fixed-elements.ts` — Fixed liturgical element types

## Edge Functions (supabase/functions/)
AI generation: generate-oraciones, generate-story, generate-illustration, generate-scene-images, refine-story
Bible: fetch-bible-passage
Liturgy: prayer-request, process-reflexion-pdf
Media: spotify-sermones, instagram-feed
Mesa Abierta: create-mesa-matches, match-participants, admin-add-participant
Notifications: send-mesa-notifications, send-mesa-whatsapp, whatsapp-signup, send-signup-confirmation
