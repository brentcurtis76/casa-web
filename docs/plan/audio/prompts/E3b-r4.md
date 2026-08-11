SESSION: AUDIO · E3b · r4 · EXEC

You are the executor for AUDIO phase E3b, round 4. You have no prior context. This is a
**remediation round with exactly one defect to fix.** Codex's final review of the phase returned
FAIL with a single BLOCKING finding; everything else passed, including all three declared
mutations, the smoke narrowing, scope, guards and E3b.14.

*Round accounting, so nobody thinks a cap was blown: rounds 1-3 were the PM↔executor loop. This is
the first remediation after a Codex FAIL, which SOP §1.5 tracks separately with a cap of 2.*

BRANCH: `phase/E3b-pages`, at `ea3adaf` (phase parent `62e9158`). Check it out and commit on top.
Do not rebase, squash, or branch anew.

## THE DEFECT — `Date.parse()` normalises impossible dates instead of rejecting them

`src/lib/reflexiones/queries.ts:78`:

    export function esTimestampValido(valor: string): boolean {
      return RE_ISO_CON_ZONA.test(valor) && Number.isFinite(Date.parse(valor));
    }

The regex checks *shape*; `Date.parse()` was meant to check *validity*. It does not. It silently
rolls impossible calendar values over into the next month or day, returns a finite number, and the
function says `true`. Measured by Codex and reproduced by the PM:

| Input | `esTimestampValido` | What `Date.parse` turns it into |
|---|---|---|
| `2026-02-31T12:00:00+00:00` | **true** | `2026-03-03` |
| `2025-02-29T00:00:00Z` (not a leap year) | **true** | `2025-03-01` |
| `2026-04-31T00:00:00Z` | **true** | `2026-05-01` |
| `2026-01-01T24:00:00Z` | **true** | `2026-01-02T00:00:00` |

The **raw** string then reaches `.or()`, and local PostgREST answers:

    HTTP 400  {"code":"22008","message":"date/time field value out of range: \"2026-02-31T12:00:00+00:00\""}

That violates the frozen contract of `E3b.5`: anything invalid is discarded and the page falls back
to page 1, and the dirty value never reaches the filter. A malformed bookmark currently produces an
error instead of a graceful fallback.

**This is not an injection.** The character allowlist holds and Codex confirmed it. It is a
correctness and contract defect, not a security hole. Do not redesign the allowlist.

## WHAT IS ALREADY CORRECT — measured, do not "fix" it

These are already rejected and must **stay** rejected, and the currently passing zone and fraction
cases must **stay** passing:

    +99:99  → false      +25:00  → false      +00:61  → false
    :60 seconds → false  :99 seconds → false
    month 13 → false     day 32 → false       minute 60 → false
    -14:00 → true (a real offset)             fractional seconds → true

Only **day-of-month overflow** and **hour 24** slip through. Keep the fix that narrow.

## WHAT TO DO

Validate the calendar and time components **strictly, without relying on `Date.parse()`
normalisation**. The usual shape is: pull the components out of the match, rebuild the instant with
`Date.UTC(...)`, and require the rebuilt components to equal the input ones — a value that rolled
over will not round-trip. Add an explicit hour ≤ 23 check. The shape is yours; the requirement is not.

## ACCEPTANCE CRITERIA

- [A1] **E3b.5b:** the four cases in the table above each yield `esTimestampValido === false`, a
  `null` cursor, page 1, and **zero `.or()` calls**. Raw output for all four.
- [A2] **E3b.5 unchanged:** the four original hostile cursors still fall back to page 1 with zero
  `.or()` calls. Raw output.
- [A3] **No regression in what already worked:** the "already correct" list above still behaves as
  stated, including `-14:00` and fractional seconds still being **accepted**. Raw output.
- [A4] **Mutation declared:** restore `Number.isFinite(Date.parse(valor))` as the only validity
  check and at least one A1 case goes **RED**. Paste the raw red output — without it this round has
  proved nothing.
- [A5] The three specs together are still green, and the three round-1 mutations still red
  (tie-break, offset, canonical origin).
- [A6] Only `src/lib/reflexiones/queries.ts` and its test file change. Nothing else — not the pages,
  not smoke, not the specs from earlier rounds unless a test needs the new cases.
- [A7] Gate D18 over the changed files against parent `62e9158`, plus `npm run build` green.

## EXPLICITLY OUT OF SCOPE

- The character allowlist and the PostgREST grammar defence. Codex ruled them sufficient.
- Everything in `smoke-local.spec.ts`. Rounds 2 and 3 closed it and Codex passed it.
- The two pages, `appRoutes.tsx`, the pagination logic itself, the canonical URL control.
- The pre-existing suite redness (`mesa-abierta`, `rbac`, `recorder`, flaky `financial-*`).

## TEST COMMANDS

    npx vitest run --no-file-parallelism src/lib/reflexiones src/pages
    supabase db reset
    npx playwright test tests/e2e/smoke-local.spec.ts tests/e2e/reflexiones.spec.ts tests/e2e/reflexiones-paginacion.spec.ts
    ./scripts/gates/changed-files-diagnostics.sh src/lib/reflexiones/queries.ts src/lib/reflexiones/__tests__/queries.test.ts
    npm run build

Stack: API 54331, DB 54332. `.env.test` is gitignored — copy from `.env.test.example`, never commit.

## RULES

- Surgical. One function and its tests.
- Spanish in comments and messages (D14).
- **A4 is the round.** A validator that rejects more but whose test cannot tell the difference is
  not an improvement. Show the mutation red.
- If tests are red for a reason you did not intend, iterate up to 3 times, then STATUS: BLOCKED.
- If you find the plan is wrong, STOP and report STATUS: FINDINGS.

## WHEN DONE

The ledger lives on `docs/plan-audio`, a different branch — the PM writes it. Output only:

    ## EXECUTOR REPORT — E3b round 4
    STATUS: COMPLETE | BLOCKED | FINDINGS
    CONTEXT PRESSURE: comfortable | tight | ran out
    BRANCH: phase/E3b-pages   COMMITS: <sha…>
    FILES CHANGED: <path (+x/-y) …>
    WHAT I DID: <how you validate the components without Date.parse>
    A1 — the four impossible dates: <verbatim>
    A2 — the four original hostile cursors: <verbatim>
    A3 — nothing that worked broke, including -14:00 and fractions: <verbatim>
    A4 — MUTATION RED (Date.parse restored as the only check): <verbatim>
    A5 — three specs together + the three r1 mutations: <verbatim>
    GATE D18: <base vs HEAD, plus build>
    ACCEPTANCE CRITERIA: <A1–A7: met / not met>
    DEVIATIONS FROM PROMPT: <or "none">
    NOT DONE / OPEN:
