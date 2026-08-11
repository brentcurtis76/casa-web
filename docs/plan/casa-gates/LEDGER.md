# LEDGER — CASA-GATES

## 2026-08-11 — G1 attempt 1 started

- STARTED: 2026-08-11T20:09:34Z
- ATTEMPT: 1
- RISK: HIGH
- BRANCH / BASE: `fix/casa-gates` / `d5b16e8fc71e3abfc3b4de19d7f51338b75b40f9`
- BASE GATES: type-check PASS; build PASS; lint FAIL (118 errors, 43 warnings);
  unit FAIL (15/1,099 across three files); Playwright stopped safely without
  `.env.test`.
- FIRST DIAGNOSIS: Node 26 global `localStorage` is undefined without a storage
  file; Mesa Abierta's test mock predates `.neq()` and array-returning participant
  query; the Cuentacuento failure passes when isolated and needs a full-suite
  scheduling check.
- HANDOFFS: 0
- CODEX: pending
- ESCAPED DEFECT: none

## 2026-08-11 — G1 attempt 1 completed

- COMPLETED: 2026-08-11T20:57:14Z
- ATTEMPT: 1
- RISK CONTAINMENT: `.env.test` stayed ignored and local-only; negative guard
  checks rejected missing and hosted configuration; the Vite bundle proved it
  was baked against `http://127.0.0.1:54331`. No production or Life OS data was
  queried, migrated, seeded, reset, or deployed.
- UNIT/LINT REPAIRS: installed deterministic in-memory browser storage for Node
  26; brought Mesa Abierta mocks and dates up to the current query contract;
  replaced explicit-any lint debt with narrow types or documented compatibility
  seams; fixed Cuentacuento test synchronization.
- PRODUCT DEFECTS FOUND AND FIXED:
  - Cuentacuento authoritative actions could race the initial draft lookup and
    misclassify a newly persisted row as an old recoverable draft.
  - Financial personnel mutations invalidated a filtered cache key incorrectly
    and treated service errors as mutation success.
  - Recorder finalization guessed with a 500 ms delay instead of awaiting the
    final MediaRecorder flush.
  - A clean repository reset lacked the `profiles` schema expected by the app,
    preventing local RBAC coverage.
- E2E REPAIRS: added only synthetic profile/Mesa seed data; restored the missing
  profiles migration; serialized stateful financial/RBAC scenarios; aligned
  stale Mesa locators and the recorder's fake PostgREST single-object contract.
- FINAL GATES:
  - `npx tsc --noEmit` — PASS
  - `npm run lint` — PASS (0 errors, 43 existing warnings)
  - `npm test -- --run --silent` — PASS (86 files, 1,099 tests, 29.50s)
  - `npm run build` — PASS (4,985 modules, 6.38s)
  - `npx playwright test --reporter=line` — PASS (80 passed, 20 skipped, 0 failed, 4.4m)
  - `supabase db reset` — PASS with every repository migration plus synthetic seed
- REVIEW: cumulative Codex diff review PASS; `git diff --check` PASS; no blocking
  findings. Remaining 43 lint warnings and build chunk-size notice are visible
  follow-up debt, not hidden or waived errors.
- HANDOFFS: 0
- CODEX: PASS
- ESCAPED DEFECT: none
