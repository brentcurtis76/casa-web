# CASA Development Operating Procedures

> **Version**: 1.0.0
> **Last Updated**: 2026-02-04
> **Project**: CASA Church Website (React + TypeScript + Supabase)

---

## Quick Reference for Brent

```
START ANY SESSION:
"Read /docs/OPERATING_PROCEDURES.md and /docs/CURRENT_STATE.md. I want to: [task]"

AFTER COWORK SENDS PROMPT:
Tell CCVSC: "check the bridge"

AFTER CCVSC FINISHES:
Tell Cowork: "check for response"
```

---

## 1. Roles and Responsibilities

| Role | Who | Responsibilities |
|------|-----|------------------|
| **Approver** | Brent (Human) | Define what you want, approve/reject at decision points, relay between Cowork and CCVSC |
| **PM** | Cowork (Browser Claude) | Create plans, send prompts via CC-Bridge, ruthlessly review code, update state documents |
| **Developer** | CCVSC (Claude Code in VS Code) | Write code, run tests, follow prompts exactly, report via CC-Bridge |

### PM (Cowork) Mandate

**You are the quality gate.** CCVSC may cut corners, miss edge cases, or claim "tests pass" without proof. Your job is to NOT let subpar code reach production.

**Non-Negotiables:**
- [ ] No code ships without tests
- [ ] No `any` types without documented justification
- [ ] No `console.log` in production code
- [ ] No copy-paste patterns (demand extraction into utilities/components)
- [ ] No "tests pass" claims without showing actual output
- [ ] No skipped error handling
- [ ] No hardcoded values that should be config

**Default Stance:** Skeptical. Verify all claims. Reject vague responses. Better to do 3 rounds of fixes than ship broken code.

---

## 2. Workflow Phases

Every feature/task follows this flow:

```
PLAN → BUILD → TEST → REVIEW → SHIP
  ↑                      ↓
  ←──── REJECT ←────────←┘
```

### Phase 1: PLAN
- Cowork creates detailed implementation plan
- Identifies affected files, testing strategy, acceptance criteria
- Brent approves or requests changes

### Phase 2: BUILD
- Cowork sends prompt to CCVSC via CC-Bridge
- CCVSC implements the code
- CCVSC reports completion via CC-Bridge

### Phase 3: TEST
- CCVSC runs `npm test` and `npm run lint`
- E2E tests via `npm run test:e2e` if applicable
- Manual verification of critical paths

### Phase 4: REVIEW
- Cowork reviews code changes ruthlessly
- Checks for: types, tests, patterns, edge cases
- REJECT back to BUILD if issues found

### Phase 5: SHIP
- Final approval from Brent
- Commit with descriptive message
- Update CURRENT_STATE.md

---

## 3. CC-Bridge Protocol

The CC-Bridge enables file-based communication between Cowork and CCVSC.

### Directory Structure
```
casa-web/
├── .cc-bridge/
│   ├── prompt.json      # Cowork writes prompts here
│   ├── response.json    # CCVSC writes responses here
│   └── status.json      # Status tracking
```

### Communication Flow

```
1. Cowork → Creates prompt
     ↓
2. Cowork → Writes to .cc-bridge/prompt.json
     ↓
3. Brent → Tells CCVSC "check the bridge"
     ↓
4. CCVSC → Reads prompt.json
     ↓
5. CCVSC → Updates status.json to "working"
     ↓
6. CCVSC → Executes the task
     ↓
7. CCVSC → Writes to response.json
     ↓
8. CCVSC → Updates status.json to "done"
     ↓
9. Brent → Tells Cowork "check for response"
     ↓
10. Cowork → Reads response.json, reviews, continues
```

### Status Values
- `idle` - No active prompt
- `prompt_pending` - Prompt waiting for CCVSC
- `working` - CCVSC is processing
- `done` - Response ready
- `error` - Something went wrong

### Prompt Format (Cowork writes)
```json
{
  "id": "msg_1738700000000_abc123",
  "timestamp": "2026-02-04T20:00:00.000Z",
  "prompt": "The detailed task description...",
  "context": "Optional background info..."
}
```

### Response Format (CCVSC writes)
```json
{
  "id": "resp_1738700100000_xyz789",
  "prompt_id": "msg_1738700000000_abc123",
  "timestamp": "2026-02-04T20:05:00.000Z",
  "response": "The full response with code changes made...",
  "status": "success"
}
```

---

## 4. Ralph Wiggum Loop

For iterative tasks that need refinement until a quality bar is met.

### Format
```
/ralph-loop "[task description]" --max-iterations 25 --completion-promise "TASK_COMPLETE"
```

### How It Works
1. CCVSC receives the task with completion criteria checkboxes
2. CCVSC attempts the task
3. CCVSC self-evaluates against criteria
4. If not all criteria met → iterate (up to max-iterations)
5. When all criteria met → output "TASK_COMPLETE"
6. If max iterations reached without completion → report what's still failing

### Example Prompt for CCVSC
```markdown
## Task
Fix the TypeScript errors in the DonationModal component.

## Completion Criteria
- [ ] All TypeScript errors resolved (0 errors from tsc)
- [ ] No `any` types introduced
- [ ] Existing functionality preserved
- [ ] Tests still pass

## Instructions
1. Run `npx tsc --noEmit` to see current errors
2. Fix each error
3. Run tests with `npm test`
4. Check each criterion
5. If all pass, output "TASK_COMPLETE"
6. If any fail, iterate and try again

Max iterations: 25
```

### Critical Rule
CCVSC must **EXECUTE** the commands and verify, not just claim completion. If CCVSC says "tests pass" without showing output, REJECT and demand proof.

---

## 5. Quality Standards

### TypeScript Standards
```typescript
// BAD - Avoid
const data: any = response;
function process(items: any[]) { }

// GOOD - Explicit types
interface ApiResponse {
  data: User[];
  pagination: Pagination;
}
const data: ApiResponse = response;
function process(items: User[]) { }
```

### Component Standards
```typescript
// BAD - Inline magic values
<div style={{ marginTop: 16, padding: '12px 24px' }}>

// GOOD - Design tokens/constants
<div className="mt-4 px-6 py-3">
```

### Error Handling
```typescript
// BAD - Swallowed errors
try { await fetch() } catch { }

// GOOD - Meaningful handling
try {
  await fetch()
} catch (error) {
  console.error('Failed to fetch:', error);
  toast.error('Unable to load data. Please try again.');
  throw error; // Re-throw if caller needs to handle
}
```

### Test Requirements
- Unit tests for all utility functions
- Component tests for complex interactions
- E2E tests for critical user flows
- Test both happy path and error cases

---

## 6. Code Review Checklist

Before approving any code from CCVSC, verify:

### Functionality
- [ ] Code does what was requested
- [ ] Edge cases handled
- [ ] Error states handled
- [ ] Loading states handled (if UI)

### Code Quality
- [ ] No `any` types (or documented justification)
- [ ] No `console.log` in production code
- [ ] No commented-out code
- [ ] No duplicate code (extract if repeated 2+ times)
- [ ] Meaningful variable/function names

### Testing
- [ ] Tests exist for new code
- [ ] Tests actually run (show output)
- [ ] Tests cover error cases
- [ ] E2E tests for user-facing features

### TypeScript
- [ ] Strict mode passes (`npx tsc --noEmit`)
- [ ] Proper interfaces/types defined
- [ ] No type assertions without justification

### Security
- [ ] No secrets hardcoded
- [ ] User input validated
- [ ] SQL queries use parameterized queries
- [ ] Auth checks in place

### Performance
- [ ] No unnecessary re-renders
- [ ] Large lists virtualized
- [ ] Images optimized
- [ ] No N+1 queries

---

## 7. Emergency Procedures

### Build Broken
1. `npm run build` fails
2. CCVSC to run and fix immediately
3. Do not proceed with other tasks until build passes

### Tests Failing
1. `npm test` fails
2. Determine if new code broke it or pre-existing
3. Fix before shipping new features

### Production Down
1. Check Vercel deployment logs
2. Check Supabase status
3. Rollback to last working commit if needed
4. Document incident in CURRENT_STATE.md

### Stuck State
If CC-Bridge gets stuck:
1. Clear bridge files: delete `.cc-bridge/*.json`
2. Re-send the prompt
3. If persistent, check CCVSC can access the files

---

## 8. Tech Stack Reference

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **TanStack Query** - Data fetching
- **React Router** - Navigation
- **Framer Motion** - Animations

### Backend
- **Supabase** - Database, Auth, Storage
- **Edge Functions** - Serverless functions (Deno)

### Testing
- **Vitest** - Unit/component tests
- **Playwright** - E2E tests
- **Testing Library** - Component testing utilities

### Deployment
- **Vercel** - Frontend hosting
- **Supabase** - Backend hosting

### Commands
```bash
# Development
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build

# Testing
npm test             # Run unit tests
npm run test:ui      # Vitest UI
npm run test:e2e     # Run Playwright tests

# Quality
npm run lint         # Run ESLint
npx tsc --noEmit     # Type check
```

---

## 9. File Organization

```
casa-web/
├── docs/
│   ├── OPERATING_PROCEDURES.md  # This file
│   ├── CURRENT_STATE.md         # Living project state
│   └── SECURITY_AND_SCALABILITY_AUDIT.md
├── .cc-bridge/                  # Bridge communication
├── src/
│   ├── components/              # React components
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── layout/              # Layout components
│   │   └── [feature]/           # Feature-specific components
│   ├── hooks/                   # Custom React hooks
│   ├── lib/                     # Utilities
│   ├── pages/                   # Page components
│   └── integrations/            # External service integrations
├── supabase/
│   └── functions/               # Edge functions
├── tests/
│   └── e2e/                     # Playwright tests
└── CLAUDE.md                    # Instructions for CCVSC
```

---

## 10. Session Checklist

### Starting a Session
1. [ ] Read this document
2. [ ] Read CURRENT_STATE.md
3. [ ] Confirm what you want to accomplish
4. [ ] Cowork creates a plan

### During a Session
1. [ ] Follow the workflow phases
2. [ ] Use CC-Bridge for communication
3. [ ] Review code changes before approving
4. [ ] Update CURRENT_STATE.md as you go

### Ending a Session
1. [ ] Ensure all tests pass
2. [ ] Commit completed work
3. [ ] Update CURRENT_STATE.md with:
   - What was completed
   - What's in progress
   - Any blockers or notes
4. [ ] Clear CC-Bridge if session complete

---

*This document is your source of truth. When in doubt, refer back here.*
