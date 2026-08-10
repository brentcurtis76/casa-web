SESSION: AUDIO · E3b · r2 · EXEC

You are the executor for AUDIO phase E3b, round 2. You have no prior context. This is a
**remediation round with exactly one defect to fix.** Round 1 was verified by the PM and is
otherwise clean: 8 files, correct scope, 38/38 unit tests, both contract specs green, all three
declared mutations red, gate D18 with zero new diagnostics, build green.

BRANCH: `phase/E3b-pages`, already exists at `d95b90d` (parent `62e9158`). Check it out and commit
on top. Do not rebase, do not squash, do not branch anew.

## THE DEFECT — the phase leaves the full Playwright suite red

Run the three specs together and one fails, every time:

    npx playwright test tests/e2e/smoke-local.spec.ts tests/e2e/reflexiones.spec.ts tests/e2e/reflexiones-paginacion.spec.ts
    → 1 failed, 5 passed — smoke step 1: "El entorno está sucio"

Run smoke alone and it is green. **Round 1's executor did nothing wrong**: they honoured the
fixture-id partition exactly and correctly refused to touch `smoke-local.spec.ts`, which was out of
scope, and escalated instead. **The plan was wrong, and it has been amended (revision 21, D24).**

Why it happens: `tests/e2e/smoke-local.spec.ts:126-129` does not assert about the ids it owns — it
asserts about the **whole table** (`anon debería ver sólo el baseline publicado`). With
`playwright.config.ts:47` set to `fullyParallel: true`, the pagination spec's 13 rows exist while
smoke is running. Partitioning ids fixes cleanup collisions; it cannot fix a global assertion.

## WHAT TO DO — narrow smoke's assertions to what it owns

Step 1 and step 7 of `tests/e2e/smoke-local.spec.ts` must assert over **only** these ids:
  - its own fixture `00000000-e2e0-4000-8000-000000000001`
  - the two baseline rows `00000000-e2e0-4000-9000-000000000010` (published) and
    `…-9000-000000000011` (draft)

Filter the query (or the result set) to those ids and keep the meaning intact:
  - **Step 1** must still prove that anon sees the published baseline and **NOT** the draft — that
    is the RLS assertion, and it is the real content of the step — and that smoke's own fixture is
    not present yet.
  - **Step 7** must still prove that smoke deleted exactly its own fixture and left both baseline
    rows intact.

Keep the failure messages in Spanish and as informative as they are now.

## EXPLICITLY OUT OF SCOPE — this is a file from a closed, Codex-passed phase

Change **nothing** in `smoke-local.spec.ts` except the assertions of steps 1 and 7. Do not touch:
  - the three-layer anti-production guard: `playwright.config.ts`, `tests/e2e/global-setup.ts`,
    `tests/e2e/helpers/guard.ts`;
  - smoke's journey, its login, or its cleanup contract;
  - any file from round 1 — `queries.ts`, the two pages, `appRoutes.tsx`, the tests, the two new
    specs. Round 1 is verified; leave it alone.
  - `supabase/seed.sql`, `publishService.ts`, the slug migration.

## ACCEPTANCE CRITERIA

- [A1] **E3b.14 — the whole suite is green:** `npx playwright test` in full, with `fullyParallel:
  true` still on. Raw output.
- [A2] The three specs together are green: smoke + reflexiones + reflexiones-paginacion. Raw output.
- [A3] **E3b.15 — the anti-production guard still bites, demonstrated not asserted.** Re-run case A
  from `E-infra-impl`: an explicit production URL must exit non-zero. Raw output.

      E2E_NO_ENV_FILE=1 VITE_SUPABASE_URL=https://mulsqxfhxxdsadxsljss.supabase.co \
        npx playwright test tests/e2e/smoke-local.spec.ts

  Expect exit ≠ 0 and the layer-1 message about the whitelist. **This matters because you are
  editing a file whose phase closed on that guard.**
- [A4] Smoke still fails when the environment really is dirty: seed a row inside smoke's own owned
  ids that should not be there, confirm step 1 still catches it, then remove it. The step must not
  become unconditionally true.
- [A5] `tests/e2e/smoke-local.spec.ts` is the **only** file changed in this round.
- [A6] Gate D18 over that one file against parent `62e9158`, plus `npm run build` green.

## TEST COMMANDS

    supabase db reset
    npx playwright test tests/e2e/smoke-local.spec.ts tests/e2e/reflexiones.spec.ts tests/e2e/reflexiones-paginacion.spec.ts
    npx playwright test
    ./scripts/gates/changed-files-diagnostics.sh tests/e2e/smoke-local.spec.ts
    npm run build

Local stack: API 54331, DB 54332. `.env.test` is gitignored and absent from a fresh worktree —
copy it from `.env.test.example`. Never commit it.

**Known environmental snag from round 1:** after `supabase db reset`, Kong sometimes holds a stale
upstream and returns 502 on every auth call. `docker restart supabase_kong_mulsqxfhxxdsadxsljss`
clears it. Not a code problem; do not chase it.

## RULES

- Surgical. One file, two steps' assertions.
- Spanish in all messages (D14).
- **A4 is the point of the round after A1**: a narrowed assertion that can no longer fail is worse
  than the bug. Show it still catching a genuinely dirty environment.
- Do not grade your own work in prose. Show the diff and the raw output.
- If tests are red for a reason you did not intend, iterate up to 3 times, then STATUS: BLOCKED.
- Do not expand scope. Anything else you spot goes under NOT DONE.

## WHEN DONE

The ledger lives on `docs/plan-audio`, a different branch — the PM writes it. Output only:

    ## EXECUTOR REPORT — E3b round 2
    STATUS: COMPLETE | BLOCKED | FINDINGS
    CONTEXT PRESSURE: comfortable | tight | ran out
    BRANCH: phase/E3b-pages   COMMITS: <sha…>
    FILES CHANGED: <path (+x/-y)>
    WHAT I DID: <how you narrowed each of the two steps>
    TEST OUTPUT — three specs together: <verbatim>
    TEST OUTPUT — full suite: <verbatim>
    GUARD CASE A (E3b.15): <verbatim, with exit code>
    A4 — smoke still catches a dirty environment: <verbatim>
    GATE D18: <diagnostics for the one file, base vs HEAD, plus build>
    ACCEPTANCE CRITERIA: <A1–A6: met / not met>
    DEVIATIONS FROM PROMPT: <or "none">
    NOT DONE / OPEN:
