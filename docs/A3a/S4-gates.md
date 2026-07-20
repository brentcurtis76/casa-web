# Subtask 4 — Cleanup and full gate sweep

Fork base: `02f790902bf719bff3c7d113fc63aac41674a2b4`
HEAD at run time: `2fb7861` (branch `a3-fix3-02f7909` via bridge worktree `bridge/task-1157`).
Base comparison worktree: `/tmp/casa-base-1157` (detached at base SHA, `npm install`ed with same lockfile).

## Cleanup

- `git rm tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo` — both were tracked at fork base and at HEAD before S4.
- `.gitignore` extended with `*.tsbuildinfo` so future `tsc -b` runs no longer stage a generated artifact.
- After running `tsc -b`, `tsc -p tsconfig.app.json --noEmit`, `npm run build`, and the vitest / playwright sweeps, the two tsbuildinfo files were re-created on disk and then re-removed. `git status` at commit time shows both remaining as staged deletions and no other generated artifacts present.

## Changed-file scope (HEAD vs fork base)

```
docs/A3a/S2-base-red.md                                                              (added)
src/components/liturgia-builder/editors/CuentacuentoEditor.tsx                       (modified)
src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.f4.integration.test.tsx  (added)
src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.approval.a3a.subtask5.test.tsx  (deleted)
src/hooks/useCuentacuentosDraft.ts                                                   (modified)
```

Plus the two tsbuildinfo deletions and the `.gitignore` addition committed in this subtask.

## Focused F4 integration tests — GREEN

Command: `npx vitest run src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.f4.integration.test.tsx`

Result: **12/12 passed** (1 file, 12 tests, ~2.6s).

## TypeScript — `npx tsc -p tsconfig.app.json --noEmit`

| | HEAD | Base |
|---|---|---|
| Exit code | 2 | 2 |
| Raw lines | 3986 | 3986 |
| Normalized identities (sorted unique `file:line:col TSxxxx message`) | 1037 | 1037 |
| Identities in HEAD not in Base | 7 | — |
| Identities in Base not in HEAD | 7 | — |

**Substance diff** (same normalization with the `line:col` stripped and absolute worktree paths canonicalized to `/WT/`) yields **458 substance-unique errors at both HEAD and base**, with **zero** substance additions and **zero** substance removals. Every identity mismatch is a pure line-shift artifact caused by lines inserted into `CuentacuentoEditor.tsx` and `useCuentacuentosDraft.ts`; the failing rule / message text is byte-identical.

Honest baseline: **~1037 pre-existing errors** at fork base, unchanged by this work.

## TypeScript — `npx tsc -b`

Same numbers as `tsc -p tsconfig.app.json --noEmit`:

| | HEAD | Base |
|---|---|---|
| Exit code | 2 | 2 |
| Raw lines | 3986 | 3986 |
| Substance-unique errors | 458 | 458 |
| Substance HEAD-not-in-Base | 0 | — |
| Substance Base-not-in-HEAD | 0 | — |

## Full `npx vitest run`

| | HEAD | Base |
|---|---|---|
| Test files failed / passed | 1 / 44 | 1 / 44 |
| Tests failed / passed | 6 / 559 | 6 / 554 |

Normalized failure set (`relative-test-file > suite > test-title`) — identical at HEAD and Base:

```
src/components/mesa-abierta/__tests__/MesaAbiertaDashboard.test.tsx > MesaAbiertaDashboard > shows pending status for unassigned participant
src/components/mesa-abierta/__tests__/MesaAbiertaDashboard.test.tsx > MesaAbiertaDashboard > shows assignment details for assigned guest
src/components/mesa-abierta/__tests__/MesaAbiertaDashboard.test.tsx > MesaAbiertaDashboard > shows assignment details for assigned host
src/components/mesa-abierta/__tests__/MesaAbiertaDashboard.test.tsx > MesaAbiertaDashboard > displays calendar button for assigned participants
src/components/mesa-abierta/__tests__/MesaAbiertaDashboard.test.tsx > MesaAbiertaDashboard > shows cancel button for non-cancelled participants
src/components/mesa-abierta/__tests__/MesaAbiertaDashboard.test.tsx > MesaAbiertaDashboard > displays mystery reminder for assigned participants
```

Subset property: **HEAD failures ⊆ Base failures** (equal set of six MesaAbiertaDashboard tests). HEAD adds **+5 net passing tests** (the S2 F4 integration file replaces the older approval suite and contributes 12 focused F4 cases; the old approval file was removed).

## `npm run build` — GREEN

`vite v5.4.21 building for production`, `4976 modules transformed`, `built in 8.19s`. Exit 0. Only warnings are the standard "chunks larger than 500 kB" advisories, present at fork base as well.

## ESLint on the changed lintable files

Command run in both trees against the same three currently-existing files (`CuentacuentoEditor.tsx`, `f4.integration.test.tsx`, `useCuentacuentosDraft.ts`; base additionally lints the deleted `approval.a3a.subtask5.test.tsx`).

| | HEAD | Base |
|---|---|---|
| Exit code | 1 | 1 |
| Findings | 2 errors + 2 warnings | 2 errors + 2 warnings |

Normalized findings (rule + message text) — identical between HEAD and base, all from `CuentacuentoEditor.tsx` and unchanged by S1–S3:

```
CuentacuentoEditor.tsx  react-hooks/exhaustive-deps  React Hook useEffect has a missing dependency: 'story'.
CuentacuentoEditor.tsx  react-hooks/exhaustive-deps  React Hook useCallback has a missing dependency: 'STYLE_PROMPTS'.
CuentacuentoEditor.tsx  @typescript-eslint/no-explicit-any  Unexpected any. Specify a different type
CuentacuentoEditor.tsx  @typescript-eslint/no-explicit-any  Unexpected any. Specify a different type
```

The new F4 integration test file contributes **zero new findings**.

## `git diff --check` — GREEN

`git diff --check 02f790902bf719bff3c7d113fc63aac41674a2b4..HEAD` exits 0. No whitespace / conflict-marker issues in the fork-to-HEAD range.

## Playwright — RED (pre-existing, unrelated to F4)

Command: `npx playwright test --reporter=list`

| | HEAD | Base (mesa-abierta only) |
|---|---|---|
| Tests total | 96 | 7 |
| Passed | 5 | 2 |
| Failed | 3 | 3 |
| Skipped | 88 | 2 |

Exact HEAD failing identities (all in `tests/e2e/mesa-abierta-signup.spec.ts`):

```
Mesa Abierta Sign-up Flow > should display Mesa Abierta section
Mesa Abierta Sign-up Flow > should show sign-up dialog when "Ser Invitado" is clicked
Mesa Abierta Sign-up Flow > should show sign-up dialog when "Ser Anfitrión" is clicked
```

Cause: DOM never renders the "La Mesa Abierta" landing section under the current app shell (no auth env), so the anchor text and both role buttons are absent — `toBeVisible` times out at 5s. The exact same three tests fail at fork base with the same locators and errors. This is a pre-existing E2E baseline documented in memory (`.env.test` and public-marketing-page rendering blockers); not caused by S1–S3.

88 remaining tests skipped because they require an authenticated admin session (`TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` from an absent `.env.test`). Skips are also pre-existing.

**Verdict:** Playwright is **RED** (pre-existing 3/96 failures, 88/96 skipped for env reasons). Not converted to green. No F4-introduced Playwright regression.

## Final worktree state at commit

- `git diff --check` clean at fork base .. HEAD.
- Staged: `deleted: tsconfig.app.tsbuildinfo`, `deleted: tsconfig.node.tsbuildinfo`, `.gitignore` (adds `*.tsbuildinfo` rule), plus this report and the recreated `tsbuildinfo` files removed again from the working tree.
- Scope diff still limited to the F4 files listed above plus this docs report and the gitignore + tsbuildinfo cleanup.
- No source correction was needed in S4: all HEAD-vs-base gate deltas are line-shift artifacts or additions on the passing side. No F4 regression detected, so no F4 source or test change was introduced in this subtask.
