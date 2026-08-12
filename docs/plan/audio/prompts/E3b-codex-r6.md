SESSION: AUDIO · E3b · REVIEW (segunda re-review — cierre de fase)

Re-review of phase E3b for AUDIO (CASA podcast). You have final say on BLOCKING items; the phase
does not close until you pass it.

BRANCH: `phase/E3b-pages` @ `b89fe93`. PARENT SHA of the phase: `62e9158`.
Cumulative diff against the parent: **9 files, +1941/−9**.

## WHERE THIS STANDS — you have reviewed this phase twice and failed it twice

| SHA | Your verdict | What fell |
|---|---|---|
| `ea3adaf` | **FAIL** — 1 BLOCKING | `E3b.5`: `Date.parse()` normalises impossible dates instead of rejecting them |
| `2e7092a` | **FAIL** — 1 BLOCKING | `E3b.5` again: year `0000` and offsets `±16:00`–`±23:59` still reached `.or()` |
| `b89fe93` | ← you are here | |

Everything else came back MET both times: `E3b.1-4`, `E3b.6-15`, all declared mutations, the smoke
narrowing, scope and guards.

**ROUND ACCOUNTING, stated plainly.** SOP §1.5 allows 2 remediations after a Codex FAIL and **both
are spent** (r4 → your first FAIL, r5 → your second). The third commit, r6, is **not** a
remediation of a review finding: it fixes a defect the executor found and raised itself, and Brent
authorised touching the frozen spec explicitly. A further BLOCKING from you does not have a round
left under the cap and would need Brent's decision.

THE PLAN IS ON ANOTHER BRANCH: `git show docs/plan-audio:docs/plan/audio/PLAN.md`, section
`## Phase E3b`. The ledger is `git show docs/plan-audio:docs/plan/audio/LEDGER.md` — the last three
entries are r4, r5 and r6. Criterion `E3b.5b` was added in r23 and is your own first finding turned
into a contract line.

## THE THREE COMMITS UNDER REVIEW

**`2e7092a` (r4)** — removed `Date.parse()` from `esTimestampValido`. The regex now captures the
components and validity is decided on them: hour ≤ 23, minute/second ≤ 59, and
`esFechaDeCalendario`, which rebuilds the instant with `Date.UTC` and requires the rebuilt
components to equal the input ones. An impossible date always overflows, so it cannot round-trip.
`setUTCFullYear` is used because `Date.UTC` maps years 0-99 to 1900-1999.

**`af0b11c` (r5)** — your second finding. The r4 validator still used **`Date`'s** notion of
validity rather than **PostgreSQL's**. Both bounds were measured with `curl` against local
PostgREST, not read off documentation, and the measurement is written beside each constant:

    0000-01-01T00:00:00Z      → 400 22008     0001-01-01T00:00:00Z      → 200
    2026-01-01T00:00:00+15:59 → 200           2026-01-01T00:00:00+16:00 → 400 22009
    2026-01-01T00:00:00-15:59 → 200           2026-01-01T00:00:00-16:00 → 400 22009

⇒ `ANIO_MINIMO = 1`, `DESFASE_HORAS_MAXIMO = 15`.

**`b89fe93` (r6)** — a flake in `reflexiones-paginacion.spec.ts`, found by the executor, not by
you. `titulosEnPantalla` waited for `main ul li h2` and read. The page **unmounts the `<ul>`**
while `cargando` is true (`Reflexiones.tsx:155`), so between page 1 and page 2 that selector still
exists — as page 1's — the wait returned instantly, and the read landed in the re-render gap:
`página 2 = []`. The fix touches **only the wait**: not the fixture, not the 13 ids, not the
insertion order, not one assertion.

## WHAT WAS MEASURED — reproduce what you doubt, do not take it on trust

- **Both of your findings were reproduced before being fixed**, with `curl` against PostgREST, not
  assumed from your report.
- **A sweep, specifically so a third hole of the same shape does not come back:** 1056 candidates
  that pass the regex → **316 accepted by the validator → all 316 probed against PostgREST → zero
  that the database rejects.**
- **The sweep also found 49 in the opposite direction** — values PostgreSQL accepts and this
  validator rejects. They are exactly two families, **second `60` and hour `24`**, and both are
  **required by the r4 contract** (hour 24 was one of the two holes you named; `:60` was on the
  must-stay-rejected list). It is the safe direction — null cursor, page 1, no error — and
  PostgREST never emits either in a stored `published_at` because Postgres normalises on write.
  This is documented in the code so it does not read as an oversight. **Rule on whether you accept
  that divergence.**
- **The secular leap rule, measured:** `1900-02-29` and `2100-02-29` → 400; `2400-02-29` → 200.
  `Date`'s calendar agrees with PostgreSQL on all three, so `esFechaDeCalendario` already handled
  them. Fixed as test cases.
- **The flake was attributed by measurement, not by argument** — four full-suite runs:

  | run | tree | pagination |
  |---|---|---|
  | r4 #1 | `2e7092a` | passed |
  | r5 #1 | `af0b11c` | **failed** |
  | r5 #2 | `af0b11c` | **failed** |
  | r4 #2 | `2e7092a`, reverted on purpose | **failed** |

  It fails on r4's tree with none of r5 in it, so the defect dates from r1 and only surfaces under
  `fullyParallel`. It is not data contention: both specs already delete only their own ids (D24).
- **After the fix, three consecutive full runs**, pagination absent from the failure list in all
  three, with `página 2 = ["[PAG] 113","[BASELINE] Reflexion publicada"]` each time — 6, 7 and 15
  failures respectively, all pre-existing families. **The third was a degraded run** (15 failures,
  5 did not run, `financial-*` collapsing under contention) **and pagination held anyway.**
- **Mutations, all re-verified on the final tree:** restoring `Date.parse()` as the only check
  kills 11 tests; reverting `ANIO_MINIMO`/`DESFASE_HORAS_MAXIMO` to `Date`'s bounds kills the 5 new
  boundary cases; dropping the `id` tie-break kills the wiring test and the e2e exact-order
  assertion; keyset→offset yields *"[PAG] 112 se repite ⇒ la paginación es por offset"*; changing
  `CANONICAL_ORIGIN` reddens `E3b.10`. **None dies by timeout** — that was the specific risk of the
  r6 wait change and it was checked.
- Gate D18 over every changed file against `62e9158`: **0/0/0/0**, project totals identical to the
  parent measured in a worktree of it — `tsc=1039 eslint=161 deno-lint=92 deno-check=43`.
  `tsc --noEmit` exit 0, `npm run build` green. `npm test` → 6 failed | 1143 passed, the 6 being
  `MesaAbiertaDashboard`, identical one-for-one at the parent.

## CHECK

1. **Is `E3b.5` finally closed?** This is your third look at the same criterion. Attack the
   validator directly: find any string that passes `RE_ISO_CON_ZONA`, is accepted by
   `esTimestampValido`, and that PostgREST answers non-200 for. The executor's sweep says there is
   none across 316 accepted values; break it or confirm it.
2. **Over-rejection.** The other failure mode of a tightened grid is rejecting legitimate values.
   Every real `published_at` PostgREST emits for a `timestamptz` must still round-trip (`E3b.4`).
   The two deliberate exclusions are `:60` and hour `24` — confirm those are the only ones and that
   they cannot appear in a stored `published_at`.
3. **Kill the mutations yourself**, especially the two new ones. A validator that rejects more but
   whose tests cannot tell the difference proves nothing.
4. **The r6 wait change is the most dangerous edit in this diff and should get your hardest look.**
   It touches a spec the PLAN freezes. Verify: (a) the fixture, the 13 ids, the insertion order and
   every assertion are byte-identical to `af0b11c`; (b) the wait does **not** anchor on the content
   the test asserts, which would hollow out the assertion; (c) both spec mutations still die by
   their own message and not by timeout; (d) the `waitForResponse` filter matches by table and not
   by `or=`, which is what keeps the offset mutation's message intact.
5. **`E3b.14`.** With the flake gone the executor claims HEAD's failure set is back to the parent's
   pre-existing families. Judge that against the parent SHA, not against zero — the suite is red
   from before this phase and that redness is documented.
6. **A self-declared weak point, unchanged since r4 and never ruled on:** the `exec()`
   destructuring has a positional hole — `[, anio, mes, dia, hora, minuto, segundo, ,
   desfaseHoras, desfaseMinutos]` — because the offset sign is captured and skipped. Adding a
   capture group would shift the indices silently. The executor argues the boundary and regression
   cases would catch it and declined to churn the diff after full gates had run. NIT, SHOULD-FIX or
   BLOCKING — say which.
7. **Scope.** r4 and r5 touch only `src/lib/reflexiones/queries.ts` and its test file; r6 touches
   only `tests/e2e/reflexiones-paginacion.spec.ts`. Confirm the pages, `appRoutes.tsx`,
   `reflexiones.spec.ts` and `smoke-local.spec.ts` are unchanged since `ea3adaf`.
8. **The rest of the phase**, which you passed at `ea3adaf`: re-check only what these three commits
   could plausibly have disturbed. The cumulative diff against `62e9158` is what you are approving.
9. Frozen decisions: D13 (no member PII), D14 (Spanish in visible text and comments), D18, D19, D24.

Local stack: API 54331, DB 54332. `.env.test` is gitignored — copy from `.env.test.example`, never
commit it. `psql` is not on the host — use
`docker exec -i supabase_db_$(grep '^project_id' supabase/config.toml | cut -d'"' -f2) psql -U postgres -d postgres`.

Review against the contract, not your preferences. Taste is a NIT. Only correctness, contract
violations, security and architectural violations are BLOCKING. Output using the CODEX REVIEW format.
