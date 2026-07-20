# Subtask 7 — Gate Sweep Report

Fork: `12e4fccfa4a5f885cd780ac2bf55ab90e8df1412`
HEAD: `<see git rev-parse HEAD after final commit>`

## Scope Compliance

Only A3/A3a-owned tests and modules touched. No modifications to
`package.json`, deployment config, schemas, migrations, edge functions,
Deno files, Mesa Abierta, or unrelated code (verified with
`git diff --name-only 12e4fcc..HEAD` — 20 files, all under
`src/hooks/`, `src/lib/cuentacuentos/`, `src/components/liturgia-builder/editors/`).

## Unbounded Test Polling Audit

`while (...) await wait(0)` search across all A3/A3a-owned tests
(`src/**/__tests__/**`): **0 matches** — all polling replaced by
deferred signals or bounded `vi.waitFor` in earlier subtasks (S3, S6).

## Direct A3/A3a Deterministic Coverage

- T-A3.1–6: `useCuentacuentosDraft.a3.test.ts` (existing, 29 tests, all pass)
- T-A3a.1–3: `useCuentacuentosDraft.a3a.subtask6.test.ts`, `pipelineTaskAdapter.test.ts`, `recoverySnapshot.a3.test.ts`
- F1 enqueue-before-change / start-after-change race: `useCuentacuentosDraft.a3.test.ts` §A3a/S3 F1 (both pre-start and post-start stale variants)
- Real approval stale-write integration: `useCuentacuentosDraft.a3a.subtask6.test.ts`
- Production task builders: `pipelineTaskAdapter.test.ts` (all 9 editor builders — character/prop/scene/cover/end + 4 refines)
- Retry race + concurrent saving counter: `useCuentacuentosDraft.a3.test.ts` (dedicated blocks) + `pipelineRunnerA3a.subtask4.test.ts`
- Recovery fallbacks: `recoverySnapshot.a3.test.ts` + `useCuentacuentosDraft.a3.test.ts` mixed-narrative + invalid-image-refs cases
- Editor render smoke: `CuentacuentoEditor.smoke.test.tsx`

## Gate Results

| Gate | Result | Notes |
|---|---|---|
| Render / import smoke | **PASS** | 1/1 test |
| T-A3.1–6 | **PASS** | 29/29 tests |
| T-A3a.1–3 | **PASS** | included in A3 targeted run |
| F1 race (pre + post) | **PASS** | 2/2 explicit scenarios in a3 test |
| Real approval stale integration | **PASS** | subtask6 file, 12 tests |
| All targeted A3/A3a run | **PASS** | 105/105 tests, 7 files, 2.56 s |
| `npx tsc --noEmit` | **PASS (exit 0)** | Solution config no-op (see below) |
| Test-source typecheck inclusion | **PASS** | `tsc -p tsconfig.app.json --listFiles` proves test files typechecked; correction-owned tests emit **zero errors** at HEAD (fixed 3 pre-existing warnings in useCuentacuentosDraft.a3.test.ts + pipelineTaskAdapter.test.ts) |
| `npm run build` | **PASS (exit 0)** | 6.82 s |
| `npm run lint` (full) | **PROJECT-BASELINE** | 159 problems repo-wide, all outside correction scope |
| Changed-file lint (HEAD) | 2 err / 2 warn, all in CuentacuentoEditor.tsx | see `lint-changed-head.log` |
| Changed-file lint (baseline) | 2 err / 2 warn, all in CuentacuentoEditor.tsx | see `lint-changed-base.log` |
| **Changed-file lint delta** | **0 new findings** (normalized by rule + message, same 4 pre-existing) | |
| `git diff --check` | **PASS (exit 0)** | |
| Full Vitest | **PASS-as-subset** | 482 passed / 6 failed, 41 files (see baseline delta) |
| `npx playwright test` | **RED** | 5 passed / 3 failed / 88 skipped — see cause below |

### tsc-inclusion evidence

Root `npx tsc --noEmit` uses solution config (`tsconfig.json` with
`"files": []` + references) — without `--build`, it typechecks 0 files
and exits 0. This is pre-existing project behavior, not introduced.

Actual typecheck proof: `npx tsc -p tsconfig.app.json --noEmit --listFiles`
emits all `src/**/*.test.ts(x)` and correction-owned test paths (grep
recorded in `tsc-listfiles.txt`), and reports **zero errors on the seven
correction-owned test files** after this subtask's fixes.

## Vitest HEAD-vs-Baseline Delta

Baseline (fork SHA `12e4fcc`, per `reports/a3-baseline-failures.txt`):
6 failing tests, all in `src/components/mesa-abierta/__tests__/MesaAbiertaDashboard.test.tsx`:
1. shows pending status for unassigned participant
2. shows assignment details for assigned guest
3. shows assignment details for assigned host
4. displays calendar button for assigned participants
5. shows cancel button for non-cancelled participants
6. displays mystery reminder for assigned participants

HEAD failing set: **identical, same 6 tests, same file.**
- HEAD ⊆ Baseline: **YES** (equal-as-subset)
- All A3/A3a tests pass: **YES** (105/105 targeted + smoke)
- New failures: **0**

## Playwright — RED, exact cause

3 failures, all in `tests/e2e/mesa-abierta-signup.spec.ts`:
- `should display Mesa Abierta section`
- `should show sign-up dialog when "Ser Invitado" is clicked`
- `should show sign-up dialog when "Ser Anfitrión" is clicked`

Cause: `getByRole('button', { name: /Ser Invitado|Ser Anfitrión/i })` — element
not found within 5 000 ms on the deployed dev server. This is the
Mesa Abierta component UI and is **out of the correction scope**
(task explicitly forbids modifying Mesa Abierta). No waiver claimed —
Playwright is **RED**.

Additionally, `.env.test` is not present in the tree (per project
memory `casa-quality-gates-state.md` — pre-existing project state),
so any test requiring `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD`
would be skipped or fail regardless.

## Fixes Applied in Subtask 7

- `src/hooks/__tests__/useCuentacuentosDraft.a3.test.ts` L1606:
  replaced `() => 0 === 1` (statically-false TS2367) with `() => false`.
- `src/lib/cuentacuentos/__tests__/pipelineTaskAdapter.test.ts` L253–255, L349–356:
  typed the two `vi.fn()` mocks with an explicit
  `(result, identity) => DraftPatch | typeof APPLY_STALE | typeof APPLY_EPHEMERAL`
  signature so TS2322 no longer fires on the `Mock<() => symbol>` inference.

Both fixes are test-only, scope-owned, and change no production code.
