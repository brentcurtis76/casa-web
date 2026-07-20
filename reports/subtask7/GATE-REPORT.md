# Subtask 7 — Gate Sweep Report (Full Validation)

Fork point: `97c49895c4c6310c671695cc7c45ce2ea7e20497`
HEAD (pre-commit): `2a93cfbcbe1c537a1ee84794b2c6dacdd372d72a`
Branch: `bridge/task-1155` → delivering to `a3-fix2-97c4989`

## Scope Compliance

Files changed vs fork (`git diff --name-only 97c4989...HEAD`, .ts/.tsx only):

- src/components/liturgia-builder/editors/CuentacuentoEditor.tsx
- src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.approval.a3a.subtask5.test.tsx
- src/hooks/__tests__/pipelineRunnerA2.integration.test.ts
- src/hooks/__tests__/pipelineRunnerA3a.subtask3.test.ts
- src/hooks/__tests__/useCuentacuentosDraft.a2.test.ts
- src/hooks/__tests__/useCuentacuentosDraft.a3.test.ts
- src/hooks/__tests__/useCuentacuentosDraft.a3a.subtask2.test.ts
- src/hooks/saveRetryRegistry.ts
- src/hooks/storyImagePipelineRunner.ts
- src/hooks/useCuentacuentosDraft.ts
- src/hooks/useStoryImagePipeline.ts
- src/lib/cuentacuentos/__tests__/taskFactories.test.ts
- src/lib/cuentacuentos/pipelineTaskAdapter.ts
- src/lib/cuentacuentos/taskFactories.ts

All under `src/hooks/`, `src/lib/cuentacuentos/`, `src/components/liturgia-builder/editors/`. No `package.json`, deployment config, schema, migration, edge function, Deno, or Mesa Abierta changes.

## Gate Results

| Gate | Command | Result | Delta vs baseline |
|---|---|---|---|
| App typecheck | `npx tsc -p tsconfig.app.json --noEmit` | **CLEAN** | HEAD has 1 fewer error (S5-fixed `useStoryImagePipeline.ts` TS2739 missing `isBusySaving`+`getSaveFailedCount`); zero new errors |
| Composite typecheck | `npx tsc -b` | **CLEAN** | Same delta: baseline−1 (S5 fix); zero new errors |
| Build | `npm run build` | **PASS** | Built in 6.38 s; 4976 modules; standard chunk-size warning only |
| Vitest full (non-watch) | `npx vitest run` | **PASS** vs baseline | 549/555 tests pass; 6 failures — all `MesaAbiertaDashboard.test.tsx` (baseline set); **zero A3/A3a failures** |
| Lint full | `npm run lint` | **CLEAN** | HEAD 159 problems (116/43) = baseline 159 problems (116/43); per-file diff on 14 changed files: only line-number shifts in `CuentacuentoEditor.tsx` (4 pre-existing findings); zero new findings |
| Whitespace | `git diff --check 97c4989...HEAD` | **PASS** | Exit 0, no output |
| Playwright E2E | `npx playwright test` | **RED (out-of-scope baseline)** | 5 pass, 88 skipped, 3 fail — all in `tests/e2e/mesa-abierta-signup.spec.ts` (baseline Mesa Abierta failures, no A3/A3a specs run) |

## Baseline Failure Identities

**Vitest — 6 MesaAbiertaDashboard failures** (identical to fork baseline):
1. `shows pending status for unassigned participant`
2. `shows assignment details for assigned guest`
3. `shows assignment details for assigned host`
4. `displays calendar button for assigned participants`
5. `shows cancel button for non-cancelled participants`
6. `displays mystery reminder for assigned participants`

All six fail on the same `waitFor(...) Recuerda el misterio` render assertion — baseline environment failure, not touched by this correction.

**Playwright — 3 mesa-abierta-signup failures** (out-of-scope):
1. `should display Mesa Abierta section`
2. `should show sign-up dialog when "Ser Invitado" is clicked`
3. `should show sign-up dialog when "Ser Anfitrión" is clicked`

Not covered by A3/A3a task scope. `.env.test` still absent (documented in CASA quality-gates memory).

## S7 Type Fixes Applied

To close pre-existing TS holes surfaced when running the required stricter typecheck command (`tsc -p tsconfig.app.json`, not root `tsc --noEmit`):

- `src/hooks/storyImagePipelineRunner.ts`: explicit `PERSIST_STALE: typeof PERSIST_STALE_SYMBOL` annotation to preserve unique-symbol identity through async returns.
- `src/lib/cuentacuentos/taskFactories.ts`: alias `StoryLocation = LocationInfo` so LOCATION fields satisfy `LocationInfo` at compile time.
- `src/hooks/__tests__/useCuentacuentosDraft.a2.test.ts`, `useCuentacuentosDraft.a3.test.ts`: retype `let opN: Promise<void>` → `Promise<EnqueueGeneratedSnapshotResult>` after S3 introduced `{ stale: true }` outcome.
- `src/hooks/__tests__/pipelineRunnerA2.integration.test.ts`: widen `makeEditorLikeTask.enqueue` signature to `(input: EnqueueGeneratedSnapshotInput) => Promise<EnqueueGeneratedSnapshotResult>`.
- `src/hooks/__tests__/pipelineRunnerA3a.subtask3.test.ts`: annotate `vi.fn(async (): Promise<PersistOutcome> => …)` on stale-persist mocks; drop invalid second generic on `buildSnapshotTask`; cast local `computePatch` return through `unknown as DraftPatch`.
- `src/lib/cuentacuentos/__tests__/taskFactories.test.ts`: fix `PropKind` fixture (`'object'` → `'prop'`) in both LOCATION fixture and matching `toMatchObject` assertion; retype `LOCATION` as `LocationInfo`; generic-type all 16 `vi.fn(...)` invocations to `vi.fn<InvokeGenerateSceneImages>(...)` including the `GUARD_CASES` interface field.

All fixes are test-only or A3/A3a-owned source. No runtime behavior change.

## Acceptance

- Both required TypeScript commands: **CLEAN delta**.
- Build: **PASS**.
- Vitest full: baseline failure set only (**zero new failures, zero A3/A3a failures**).
- Lint delta on changed files: **zero new findings**.
- `git diff --check`: **PASS**.
- Playwright: **RED — baseline mesa-abierta failures, out of A3/A3a scope, honestly labeled**.
