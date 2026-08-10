SESSION: AUDIO · E3b · r3 · EXEC

You are the executor for AUDIO phase E3b, round 3 — **the last one** (SOP §1.5 caps PM↔executor at
three). You have no prior context. Rounds 1 and 2 are verified by the PM and are **not** to be
touched. This round closes exactly two things, both of which are plan amendments made *because* of
round 2's FINDINGS.

BRANCH: `phase/E3b-pages`, at `e397057` (phase parent `62e9158`). Check it out and commit on top.
Do not rebase, squash, or branch anew.

## WHAT ROUND 2 ESTABLISHED — do not redo it

Round 2 narrowed steps 1 and 7 of `tests/e2e/smoke-local.spec.ts` to the ids the spec owns, and the
PM verified it: three specs green together, guard case A still exits 1, and the narrowed step 1
still catches a genuinely dirty environment. **That work stands.** Round 2 then returned FINDINGS
on two things it was not chartered to fix. Both are now in the plan (revision 22). They are yours.

## TASK 1 — step 5 has the identical defect (D24, extended)

`tests/e2e/smoke-local.spec.ts:192-197`, step 5, still asserts over the **whole** anon-visible
table:

    expect(filas.map((f) => f.id).sort()).toEqual([FIXTURE_DEL_TEST, BASELINE_PUBLICADO].sort());

That is the same construction D24 removed from steps 1 and 7. It passes today only on timing — the
browser login and navigation before step 5 give the pagination spec time to clean up — and the next
spec that seeds published rows breaks it again. Round 2 proved it by seeding one published row at
`…8000-000000000500`, a legitimate neighbour outside smoke's owned ids: step 1 passed, step 5 failed.

**Fix it the same way**: use the existing `soloLosPropios()` helper, keep the two status assertions
(`every(status === 'published')` and `not.toContain(BASELINE_BORRADOR)`) exactly as they are, and
keep the message Spanish.

**[A1]** With a legitimate neighbour row seeded **outside** smoke's owned ids, smoke alone is
**green** — where today it fails. Raw output, before and after.
**[A2]** With a dirty row seeded **inside** smoke's owned ids, step 5 still **fails**. A narrowed
assertion that can no longer fail is worse than the bug. Raw output.

## TASK 2 — measure E3b.14 as it is now written

The criterion used to say "the whole Playwright suite green". **That was unachievable and it was
the PM's error**: the suite is already red at the parent SHA, for reasons with nothing to do with
this phase. It now reads: **E3b adds no failure.** Two measurements, same command, same day:

**[A3]** The three specs `E3b` touches are green **together**, with `fullyParallel: true` on.
**[A4]** `npx playwright test` in full, run twice: once on HEAD, once on the **parent `62e9158`** in
a throwaway worktree. The HEAD failure set must be a **subset** of the parent's, compared **by test
name**, not by count. Paste both raw lists and state the comparison explicitly.

*The `financial-*` specs are known to vary between runs. If a `financial-*` test fails on HEAD but
not in your parent run, re-run the parent spec file alone before calling it a regression — and say
in the report that you did.*

## ALSO REQUIRED

**[A5]** Guard case A still bites — you are still editing the file whose phase closed on it:

    E2E_NO_ENV_FILE=1 VITE_SUPABASE_URL=https://mulsqxfhxxdsadxsljss.supabase.co \
      npx playwright test tests/e2e/smoke-local.spec.ts

Expect exit ≠ 0 and the layer-1 whitelist message. Raw output with the exit code.

**[A6]** `tests/e2e/smoke-local.spec.ts` is the **only** file changed in this round.
**[A7]** Gate D18 over that one file against parent `62e9158`, plus `npm run build` green.

## EXPLICITLY OUT OF SCOPE

- **The pre-existing suite failures.** `mesa-abierta-signup`, `rbac`, `recorder`, `financial-*` are
  red at the parent and are now a backlog item of their own. **Do not fix them, do not skip them,
  do not touch their files.** Measuring them is the whole of A4.
- Everything in `smoke-local.spec.ts` except step 5's assertion: not the guard
  (`playwright.config.ts`, `tests/e2e/global-setup.ts`, `tests/e2e/helpers/guard.ts`), not the
  journey, not the login, not the cleanup contract, not steps 1 and 7 as round 2 left them.
- Every file from rounds 1 and 2.

## TEST COMMANDS

    supabase db reset
    npx playwright test tests/e2e/smoke-local.spec.ts tests/e2e/reflexiones.spec.ts tests/e2e/reflexiones-paginacion.spec.ts
    npx playwright test
    ./scripts/gates/changed-files-diagnostics.sh tests/e2e/smoke-local.spec.ts
    npm run build

Stack: API 54331, DB 54332. `.env.test` is gitignored — copy it from `.env.test.example`, never
commit it. Seeding fixtures via PostgREST with the service-role key returns 403; round 2 used
`docker exec … psql` and that is fine for harness scaffolding, as long as you remove the rows.

## RULES

- Surgical. One file, one step's assertion.
- Spanish in all messages (D14).
- A2 and A4 are the round: the first proves the narrowing did not defang the check, the second
  proves the phase adds nothing red. Both need raw output, not a summary.
- If tests are red for a reason you did not intend, iterate up to 3 times, then STATUS: BLOCKED.
- **This is the last round.** If something cannot be closed here, report it under NOT DONE with
  what you measured; do not improvise a fix outside the charter.

## WHEN DONE

The ledger lives on `docs/plan-audio`, a different branch — the PM writes it. Output only:

    ## EXECUTOR REPORT — E3b round 3
    STATUS: COMPLETE | BLOCKED | FINDINGS
    CONTEXT PRESSURE: comfortable | tight | ran out
    BRANCH: phase/E3b-pages   COMMITS: <sha…>
    FILES CHANGED: <path (+x/-y)>
    WHAT I DID: <how you narrowed step 5>
    A1 — neighbour outside the owned ids: <before/after, verbatim>
    A2 — dirty row inside the owned ids still caught: <verbatim>
    A3 — three specs together: <verbatim>
    A4 — full suite, HEAD vs parent: <both lists, and the subset comparison by test name>
    A5 — guard case A: <verbatim, with exit code>
    GATE D18: <diagnostics for the one file, base vs HEAD, plus build>
    ACCEPTANCE CRITERIA: <A1–A7: met / not met>
    DEVIATIONS FROM PROMPT: <or "none">
    NOT DONE / OPEN:
