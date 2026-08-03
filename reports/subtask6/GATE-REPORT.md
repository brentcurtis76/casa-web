# Subtask 6 — Final Scope Audit and Required Gates

Fork point: `97c49895c4c6310c671695cc7c45ce2ea7e20497`
HEAD (pre-report): `1449bfe39b619301b4a5882a6db2be867ccac398`
Branch: `bridge/task-1155` → delivering to `a3-fix2-97c4989`

## Scope Audit

Files changed vs fork (`git diff --name-only 97c4989...HEAD`):

- `docs/A3a_S1_BASELINE.md` — S1 baseline documentation
- `reports/subtask7/GATE-REPORT.md` — prior gate report
- `src/components/liturgia-builder/editors/CuentacuentoEditor.tsx` — F1
- `src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.approval.a3a.subtask5.test.tsx` — F4
- `src/hooks/__tests__/pipelineRunnerA2.integration.test.ts` — S7 test retypes
- `src/hooks/__tests__/pipelineRunnerA3a.subtask3.test.ts` — F3 runner
- `src/hooks/__tests__/useCuentacuentosDraft.a2.test.ts` — S7 test retypes
- `src/hooks/__tests__/useCuentacuentosDraft.a3.test.ts` — F2 identity race
- `src/hooks/__tests__/useCuentacuentosDraft.a3a.subtask2.test.ts` — F2 operation-start guard
- `src/hooks/saveRetryRegistry.ts` — F1 registry surface
- `src/hooks/storyImagePipelineRunner.ts` — F3 explicit stale-persist
- `src/hooks/useCuentacuentosDraft.ts` — F2 unconditional guard
- `src/hooks/useStoryImagePipeline.ts` — F1 registry surface
- `src/lib/cuentacuentos/__tests__/taskFactories.test.ts` — F5 nine-factory suite
- `src/lib/cuentacuentos/pipelineTaskAdapter.ts` — F5 adapter
- `src/lib/cuentacuentos/taskFactories.ts` — F5 nine task factories

All files land under `src/components/liturgia-builder/editors/`, `src/hooks/`, `src/lib/cuentacuentos/`, `docs/`, `reports/`. Verified absent from diff:
- `package.json` / `package-lock.json`
- `supabase/functions/**`
- `supabase/migrations/**`
- `supabase/config.toml`
- `src/components/mesa-abierta/**` and any Mesa Abierta production code
- Provider client implementations (`src/lib/gpt-image*`, `src/lib/imageGeneration*`, `src/lib/replicate*`, etc.)

No accidental out-of-scope changes; nothing removed.

## Gate Results (against final HEAD `1449bfe`)

| # | Gate | Command | Result |
|---|---|---|---|
| 1 | App typecheck | `npx tsc -p tsconfig.app.json --noEmit` | Baseline only — 14 pre-existing errors in out-of-scope files; **zero errors in A3/A3a files** |
| 2 | Composite typecheck | `npx tsc -b` | Same 14 baseline errors; **zero errors in A3/A3a files** |
| 3 | Production build | `npm run build` | **PASS** — 4976 modules transformed, built in 6.31 s |
| 4 | Full Vitest | `npx vitest run` | 549 pass / 6 fail — **six failures = exact baseline `MesaAbiertaDashboard.test.tsx` set** |
| 5 | Full lint | `npm run lint` | 159 problems (116 err / 43 warn) — **identical to baseline count** |
| 6 | Per-file lint (14 changed TS/TSX) | `npx eslint <14 files>` | Only `CuentacuentoEditor.tsx` reports 4 findings (2 err + 2 warn); other 13 files clean; findings match baseline identities (line-numbers shifted) |
| 7 | Whitespace | `git diff --check 97c4989...HEAD` | **PASS** (exit 0, no output) |
| 8 | Playwright E2E | `npx playwright test` | **RED** — 5 pass / 88 skipped / 3 fail, all failures are `tests/e2e/mesa-abierta-signup.spec.ts` baseline (out of A3/A3a scope) |

Root `npx tsc --noEmit` was NOT used as evidence, per spec.

## Focused Test Runs

| Category | Spec file(s) | Tests | Result |
|---|---|---|---|
| Real editor approval/finalization | `CuentacuentoEditor.approval.a3a.subtask5.test.tsx` | (included in 131-test A3/A3a batch) | **PASS** |
| Enqueue-before-change / start-after-change race | `pipelineRunnerA3a.subtask3.test.ts` (F3), `useCuentacuentosDraft.a3a.subtask2.test.ts` (F2) | (included in batch) | **PASS** |
| Post-start identity-change runner | `useCuentacuentosDraft.a3.test.ts` `A3a/S3 post-start identity change returns explicit stale after DB settle` | 1 | **PASS** |
| Nine production task factories | `src/lib/cuentacuentos/__tests__/taskFactories.test.ts` | **53** | **PASS** (all nine kinds — TITLE, SUMMARY, IDEAS, LOCATION, CHARACTER, SCENES, PROP, STYLE, SCENE_IMAGE) |
| All A3/A3a targeted (batched) | 7 specs above | **131** | **PASS** |

## Baseline Failure Identities (unchanged from S7 report)

**Vitest — 6 `MesaAbiertaDashboard.test.tsx` failures:**
1. `shows pending status for unassigned participant`
2. `shows assignment details for assigned guest`
3. `shows assignment details for assigned host`
4. `displays calendar button for assigned participants`
5. `shows cancel button for non-cancelled participants`
6. `displays mystery reminder for assigned participants`

All fail on `waitFor(...) /Recuerda el misterio/` — baseline environment issue, subset of the recorded exact-base set. Zero A3/A3a failures.

**Playwright — 3 `mesa-abierta-signup.spec.ts` failures:**
1. `should display Mesa Abierta section`
2. `should show sign-up dialog when "Ser Invitado" is clicked`
3. `should show sign-up dialog when "Ser Anfitrión" is clicked`

`.env.test` still absent (documented in CASA quality-gates memory). No A3/A3a Playwright specs exist to run.

## Per-file Lint Findings (`CuentacuentoEditor.tsx` only)

All four findings are pre-existing baseline; no F1 change introduced or displaced a lint identity:

- L1187:6 warn `react-hooks/exhaustive-deps` — missing dep `story`
- L1277:6 warn `react-hooks/exhaustive-deps` — missing dep `STYLE_PROMPTS`
- L1594:51 error `@typescript-eslint/no-explicit-any`
- L1601:43 error `@typescript-eslint/no-explicit-any`

Other 13 changed TS/TSX files: **zero lint findings**.

## F1–F5 Regression Check

No gate exposed an in-scope defect on top of the F1–F5 fixes already committed (`7c03fc6` F2 guard, `449c527` F3 runner, `0572bcc` F5 factories, `2a93cfb` F1+F4, `1449bfe` S7 type-hole closures). No additional source edits required.

## Acceptance

- Clean worktree after S6 report commit (only new file: `reports/subtask6/GATE-REPORT.md`).
- Final HEAD descends directly from `97c49895c4c6310c671695cc7c45ce2ea7e20497` (linear history, 6 commits).
- All required evidence corresponds to final committed HEAD.
- No protected ref moved; nothing pushed, merged, or deployed.
- HEAD Vitest failure identities are a subset of the recorded exact-base set (identical, 6/6).
- Zero new lint findings vs baseline (per-file and full).
- Playwright honestly labeled **RED** with exact cause (mesa-abierta-signup baseline, out of scope).
