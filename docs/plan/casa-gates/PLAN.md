# PLAN — CASA-GATES

## META

- Status: DONE
- Branch: `fix/casa-gates`
- Base: `d5b16e8fc71e3abfc3b4de19d7f51338b75b40f9`
- Risk: HIGH — browser-test isolation protects a production database shared with Life OS
- Started: 2026-08-11T20:09:34Z

## Goal

Restore every mandatory CASA quality gate on the clean `main` baseline so feature
phases can close without waiving repository rules or repeatedly rediscovering the
same failures.

## Non-goals

- No unrelated feature development. Gate-exposed production defects may be fixed.
- No production database query, migration, seed, reset, or deployment.
- No Life OS table access.
- No merge to `main`.
- No removal or weakening of required gates.

## Frozen decisions

- Preserve the anti-production Playwright guard and use only the dedicated local
  Supabase ports documented in `.env.test.example`.
- Repair stale tests and test infrastructure before changing application code.
- Resolve ESLint errors with typed/mechanical corrections; do not silence whole
  rules repository-wide merely to obtain green output.
- Treat reproducible branch-only failures as defects. Record true environment
  blockers with exact commands and evidence.

## Phase index

| ID | Name | Status | Risk |
|---|---|---|---|
| G1 | Restore mandatory CASA gates | DONE | HIGH |

## Phase G1 — Restore mandatory CASA gates

### Scope

Test configuration and mocks, files reported by ESLint, isolated local E2E setup,
and this workstream's planning/evidence artifacts.

### Acceptance criteria

1. `npx tsc --noEmit` passes.
2. `npm run lint` exits zero without repository-wide rule suppression.
3. `npm test -- --run` passes the complete unit suite.
4. `npm run build` passes.
5. The Playwright guard rejects absent or non-local Supabase configuration.
6. `.env.test` remains ignored and contains only documented synthetic local values.
7. The isolated Supabase stack is reset/seeded without contacting production.
8. `npx playwright test` passes, or reports a specific external environment blocker
   after the guard and focused safety checks pass.
9. No migration, production data, Life OS table, merge, or deployment is touched.
10. The cumulative diff receives an independent Codex review before closure.

### Exact gates

```bash
npx tsc --noEmit
npm run lint
npm test -- --run
npm run build
npx playwright test
```

### Falsification record

```text
CLAIM: The unit failures are stale test/runtime infrastructure, not intended product behavior.
COUNTEREXAMPLE: A focused test still fails after current query contracts and browser storage are represented accurately.
CHECK: Run each failing file alone, then the full suite.
RESULT: Partially falsified. Most failures were stale infrastructure, but the full suite exposed a real mount-time Cuentacuento draft race. The product now blocks authoritative actions until the lookup settles, and all affected tests wait for the enabled state.
BLIND SPOT: Provider and browser timing outside the synthetic boundaries remains an operational concern, not a waived gate.

CLAIM: Browser tests can be run without risking the shared CASA/Life OS project.
COUNTEREXAMPLE: Playwright accepts a hosted or default local-project URL.
CHECK: Inspect and execute the three-layer guard before starting the local stack.
RESULT: Supported. Hosted URLs and absent environment values were rejected; the baked Vite bundle reported `http://127.0.0.1:54331`; a clean local reset and all Playwright tests completed there.
BLIND SPOT: Docker/Supabase availability is machine state, not guaranteed by repository code.
```

### Completion evidence

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS — 0 errors, 43 pre-existing warnings |
| `npm test -- --run --silent` | PASS — 86 files, 1,099 tests, 29.50s |
| `npm run build` | PASS — 4,985 modules, 6.38s |
| `npx playwright test --reporter=line` | PASS — 80 passed, 20 intentional skips, 0 failed, 4.4m |
| clean local migration/seed | PASS — `supabase db reset` on dedicated 5433x ports |
| anti-production guard | PASS — missing and hosted configuration rejected |
| cumulative Codex diff review | PASS — no blocking findings; `git diff --check` clean |

### Definition of done

All criteria have evidence, all mandatory gates are green, and the cumulative
Codex review returns PASS. G1 is complete.

### Rollback

Revert the commits on `fix/casa-gates`. No database or deployment rollback should
be necessary because production access is out of scope.
