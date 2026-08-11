SESSION: AUDIO · E3b · REVIEW (re-review tras tu FAIL)

Re-review of phase E3b for AUDIO (CASA podcast). You have final say on BLOCKING items; the phase
does not close until you pass it.

BRANCH: `phase/E3b-pages` @ `2e7092a`. PARENT SHA of the phase: `62e9158`.
**YOU ALREADY REVIEWED `ea3adaf` AND RETURNED FAIL** — 1 BLOCKING, 0 SHOULD-FIX, 0 NIT. `E3b.1-4`
and `E3b.6-15` came back MET; only `E3b.5` fell. `2e7092a` is the single remediation commit on top.

THE PLAN IS ON ANOTHER BRANCH: `git show docs/plan-audio:docs/plan/audio/PLAN.md`, section
`## Phase E3b`. Read it there — it is not on `main` and not on this branch. The r23 revision added
criterion **`E3b.5b`**, which is your own B1 turned into a contract line. The ledger entry for this
round is `git show docs/plan-audio:docs/plan/audio/LEDGER.md` (last entry, `E3b round 4 — EXEC`).

Round accounting, so no cap looks broken: r1-r3 were the PM↔executor loop (cap 3, spent). This is
the **first remediation after a Codex FAIL**, which SOP §1.5 counts separately with a cap of 2.

## WHAT YOU FOUND, AND WHAT WAS DONE ABOUT IT

Your B1: `queries.ts:78` validated with `RE_ISO_CON_ZONA.test(valor) &&
Number.isFinite(Date.parse(valor))`. The regex checked shape; `Date.parse()` was meant to check
validity and does not — it normalises `2026-02-31` into `2026-03-03`, returns a finite number, and
the function said `true`. The raw string then reached `.or()` and PostgREST answered
`400 {"code":"22008"}`, violating the `E3b.5` contract that a dirty cursor degrades to page 1.

The fix removes `Date.parse()` from the validator entirely. The regex now captures the components
and validity is decided on them:

- hour ≤ 23 (the second hole: hour 24 rolled into the next day), minute and second ≤ 59;
- offset within ±23:59, which is what already rejected `+25:00`, `+99:99` and `+00:61`;
- `esFechaDeCalendario`, which rebuilds the instant with `Date.UTC` and **requires the rebuilt
  components to equal the input ones** — an impossible date always overflows, so it cannot
  round-trip. The year is applied with `setUTCFullYear` because `Date.UTC` maps years 0-99 to
  1900-1999.

The character allowlist and the PostgREST-grammar defence are untouched, as you ruled.

## WHAT THE EXECUTOR MEASURED — reproduce what you doubt, do not take it on trust

- **Defect reproduced before the fix**, not assumed: the four cases returned `true` in node, and
  `curl` against local PostgREST with `2026-02-31T12:00:00+00:00` inside the `.or()` returned
  **HTTP 400**.
- **`E3b.5b`** — the four impossible dates each give `esTimestampValido=false`, `null` cursor,
  page 1 (one episode rendered) and `llamadas .or() = []`. Raw output in the test log.
- **`E3b.5` unchanged** — the four original hostile cursors still decode to `null`, zero `.or()`.
- **No regression** — a new 12-case table fixes what already worked. Still rejected: `+99:99`,
  `+25:00`, `+00:61`, second 60 and 99, month 13, day 32, minute 60. Still **accepted**: `-14:00`,
  fractional seconds, leap-year Feb 29, Dec 31.
- **Declared mutation, red** — restoring `Number.isFinite(Date.parse(valor))` as the only check
  puts all four `E3b.5b` cases red (`expected true to be false`), 4 failed | 38 passed. The 12
  regression cases **stayed green under the mutation**, which is the executor's evidence that the
  fix is narrow.
- **The three r1 mutations re-verified red today**, not inherited: dropping the `id` tie-break
  (vitest), keyset→offset (`[PAG] 101` reappears on page 2), `CANONICAL_ORIGIN` → `mutacion.invalid`.
- Three specs together after `supabase db reset`: **6 passed**.
- Gate D18 on the two changed files against `62e9158`: **0/0/0/0**. Project totals measured in a
  worktree of the parent and identical on both sides: `tsc=1039 eslint=161 deno-lint=92
  deno-check=43`. `tsc --noEmit` exit 0, `npm run build` green.
- Full suites: `npm test` → 6 failed | 1130 passed, the 6 being `MesaAbiertaDashboard`, identical
  one-for-one at the parent. `npx playwright test` → **7 failed | 22 skipped | 76 passed (4.2m)**:
  `financial-personnel:115`, `mesa-abierta-signup` ×3, `rbac` ×2, `recorder` — the same set the PM
  measured at the parent on 2026-08-09. None touch `reflexiones` or `smoke-local`.

## CHECK

1. **Is B1 actually dead?** Kill it yourself: the four cases, plus anything else you can think of
   that `Date.parse()` normalised and this validator might still let through. Day-of-month
   overflow and hour 24 were the two holes you identified — are they the only two that existed?
2. **Did the fix overshoot?** A validator that rejects more is not automatically better. `-14:00`
   and fractional seconds must still be accepted, and so must every real `published_at` PostgREST
   emits for a `timestamptz`. Look for values the old validator accepted and the new one rejects.
3. **The mutation.** Restore `Number.isFinite(Date.parse(valor))` as the only check and confirm the
   new tests actually go red. A test that cannot tell the difference proves nothing.
4. **The weakest point, declared by the executor rather than hidden:** the `exec()` destructuring
   has a positional hole — `[, anio, mes, dia, hora, minuto, segundo, , desfaseHoras,
   desfaseMinutos]` — because the offset sign is captured and skipped. Adding a capture group to
   the regex would shift the indices silently. The executor argues the 12 regression cases would
   catch it and chose not to churn the diff after the full gates had run. Rule on that: NIT,
   SHOULD-FIX, or BLOCKING.
5. **`esFechaDeCalendario`'s `setUTCFullYear` step.** Is the two-step construction correct for
   every year the regex admits (`0000`-`9999`), and does the overflow detection survive it? A
   leap-year Feb 29 rebuilt through the year-2000 pivot is the interesting case.
6. **Scope.** Only `src/lib/reflexiones/queries.ts` and its test file may change. Confirm the pages,
   `appRoutes.tsx`, `smoke-local.spec.ts` and the earlier specs are byte-identical to `ea3adaf`.
7. **The rest of the phase.** You passed `E3b.1-4` and `E3b.6-15` at `ea3adaf`. Re-check anything
   this commit could plausibly have disturbed — nothing else should have moved, but the cumulative
   diff against `62e9158` is what you are approving.
8. Frozen decisions: D13 (no member PII), D14 (Spanish in visible text and in comments), D18, D24.

Local stack is up: API 54331, DB 54332. `.env.test` is gitignored — copy from `.env.test.example`,
never commit it. `psql` is not on the host — use
`docker exec -i supabase_db_$(grep '^project_id' supabase/config.toml | cut -d'"' -f2) psql -U postgres -d postgres`.

The suite is red from before this phase and that redness is documented, not new. Judge it against
the parent SHA, not against zero.

Review against the contract, not your preferences. Taste is a NIT. Only correctness, contract
violations, security and architectural violations are BLOCKING. Output using the CODEX REVIEW format.
