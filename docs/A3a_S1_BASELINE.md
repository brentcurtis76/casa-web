# A3a Subtask 1 — Preflight & Baseline

## Environment
- Working dir: `/Users/brentcurtis/SecondBrain/worktrees/casa-1155`
- Current branch (bridge-isolated): `bridge/task-1155`
- Initial HEAD: `97c49895c4c6310c671695cc7c45ce2ea7e20497`
- Worktree cleanliness: clean (no `git status --porcelain` output)

## Protected ref SHAs (recorded for final verification)
- `main` = `134351339db4284d59fb67718e6fc330cccf73d5`
- `feat/phase-a` = `e3968d24b08dbff0b16fca4c077f347b473372d2`
- `a3-preserve-e3968d2` = `e3968d24b08dbff0b16fca4c077f347b473372d2`
- `a3-fix-12e4fcc` = `12e4fccfa4a5f885cd780ac2bf55ab90e8df1412`
- `a3-review-97c4989` = `97c49895c4c6310c671695cc7c45ce2ea7e20497`
- `a3-fix2-97c4989` = `97c49895c4c6310c671695cc7c45ce2ea7e20497` (matches required base)

## Base Vitest baseline (pristine run at HEAD 97c4989)
Command: `npx vitest run`

Totals: **6 failed** / **482 passed** / **488 tests**; **1 failed** / **40 passed** / **41 test files**.

All 6 failures are inside `src/components/mesa-abierta/__tests__/MesaAbiertaDashboard.test.tsx`:

1. FAILED — `MesaAbiertaDashboard > shows pending status for unassigned participant`
2. FAILED — `MesaAbiertaDashboard > shows assignment details for assigned guest`
3. FAILED — `MesaAbiertaDashboard > shows assignment details for assigned host`
4. FAILED — `MesaAbiertaDashboard > displays calendar button for assigned participants`
5. FAILED — `MesaAbiertaDashboard > shows cancel button for non-cancelled participants`
6. FAILED — `MesaAbiertaDashboard > displays mystery reminder for assigned participants`

Passing in the same file: `MesaAbiertaDashboard > shows empty state when user has no participation`.

Baseline matches the expected "exactly six MesaAbiertaDashboard failures" requirement.

## Notes
- No source files were modified in this subtask.
- Isolation: work continues on `bridge/task-1155`; none of the protected refs above will be committed to or moved. Bridge delivery fast-forwards these commits back to `a3-fix2-97c4989`.
