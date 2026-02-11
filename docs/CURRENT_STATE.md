# CASA Project Current State

> **Last Updated**: 2026-02-04
> **Updated By**: Cowork (Workflow Setup)

---

## Active Work

*Currently nothing in active development. Ready for new tasks.*

| Task | Status | Owner | Notes |
|------|--------|-------|-------|
| - | - | - | - |

---

## Recently Completed

| Task | Completed | Notes |
|------|-----------|-------|
| Development Workflow Setup | 2026-02-04 | Created OPERATING_PROCEDURES.md, CURRENT_STATE.md, CLAUDE.md, .cc-bridge directory |

---

## Priorities (Backlog)

*Add items here as they come up. Mark priority with P0/P1/P2.*

| Priority | Task | Notes |
|----------|------|-------|
| - | - | - |

---

## Key Files Reference

### Core Application
| File | Purpose |
|------|---------|
| `src/main.tsx` | Application entry point |
| `src/App.tsx` | Root component with routing |
| `src/integrations/supabase/client.ts` | Supabase client configuration |

### Major Features
| Feature | Location | Notes |
|---------|----------|-------|
| La Mesa Abierta | `src/components/mesa-abierta/` | Community meals matching system |
| Liturgy System | `src/components/liturgy/` | Church liturgy management |
| Prayer Requests | `src/components/prayers/` | Prayer request forms |
| Donations | `src/components/donation/` | Donation modal |
| Contact | `src/components/contact/` | Contact forms |
| Calendar | `src/components/calendar/` | Event calendar |

### Supabase Functions
| Function | Location | Purpose |
|----------|----------|---------|
| instagram-feed | `supabase/functions/instagram-feed/` | Instagram integration |
| prayer-request | `supabase/functions/prayer-request/` | Prayer request handling |
| spotify-sermones | `supabase/functions/spotify-sermones/` | Spotify sermon integration |
| whatsapp-signup | `supabase/functions/whatsapp-signup/` | WhatsApp signup |

### Configuration
| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite configuration |
| `tailwind.config.ts` | Tailwind CSS configuration |
| `tsconfig.json` | TypeScript configuration |
| `playwright.config.ts` | E2E test configuration |

---

## Known Issues

*Document any known bugs or technical debt here.*

| Issue | Severity | Notes |
|-------|----------|-------|
| - | - | - |

---

## Environment Notes

### Development
- Node.js required
- Supabase local or cloud instance
- Environment variables in `.env` (see `.env.example`)

### Deployment
- Frontend: Vercel
- Backend: Supabase Cloud
- Domain: [Add production URL]

---

## Session Log

*Brief log of recent sessions for context continuity.*

### 2026-02-04
- Set up development workflow
- Created operating procedures documentation
- Created CC-Bridge communication directory
- Created CLAUDE.md for CCVSC instructions

---

## Notes for Next Session

*Leave notes here for context that should carry over.*

- Workflow is now set up and ready to use
- Start sessions with: "Read /docs/OPERATING_PROCEDURES.md and /docs/CURRENT_STATE.md. I want to: [task]"
- CC-Bridge MCP server already exists at `../cc-bridge-mcp-server/` - may need to configure in CCVSC

---

*This document should be updated at the end of every session.*
