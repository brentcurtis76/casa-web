SESSION: AUDIO · E3b · r1 · EXEC

You are the executor for AUDIO phase E3b, round 1. You have no prior context. The phase is FROZEN
(revision 20, three plan-review rounds). Do not redesign it.

FIRST — HARD PRECONDITION, fail-closed. E3b's contract depends on the `slug` column, the trigger
that assigns it, and `CANONICAL_ORIGIN`, all of which ship in E3a. Before writing a line:

    git merge-base --is-ancestor 6054d55 main && echo "E3a en main: OK" || echo "FALTA EL MERGE — parar"

If it says stop, report STATUS: FINDINGS and stop. Do not work around it.

BRANCH: `phase/E3b-pages`, from the current `main`. Record the exact parent SHA — the gate is
measured against it.

THE PLAN IS ON ANOTHER BRANCH:
    git show docs/plan-audio:docs/plan/audio/PLAN.md
Read `## Phase E3b` in full — especially «Paginación», «Fixtures» and the frozen mutation fixture.
The essentials are below but the phase body governs.

## WHAT TO BUILD — 8 files

1. `src/appRoutes.tsx` — two PUBLIC routes (flat `{path, element}` array; no ProtectedRoute; the
   catch-all `*` stays last).
2. `src/pages/Reflexiones.tsx` (new) — the index.
3. `src/pages/ReflexionEpisodio.tsx` (new) — player, download, and a copy/share control.
4. `src/lib/reflexiones/queries.ts` (new) — the keyset query and cursor, separate from UI.
5. `src/lib/reflexiones/__tests__/queries.test.ts` (new)
6. `src/pages/__tests__/Reflexiones.test.tsx` (new)
7. `tests/e2e/reflexiones.spec.ts` (new) — anonymous: positive case + the RLS fixture.
8. `tests/e2e/reflexiones-paginacion.spec.ts` (new) — E3b.2 and E3b.3 against local PostgREST.

## PAGINATION — keyset, not offset

Order `(published_at DESC, id ASC)`. Page 1 asks for 13, shows 12; the 13th is only the sentinel
saying there is more. Next page filters `published_at < pa OR (published_at = pa AND id > id)`,
i.e. `.or('published_at.lt.<pa>,and(published_at.eq.<pa>,id.gt.<id>)')`. Codex measured this exact
chain against this stack: `status=200, error=null, rows=1`. The cursor rides the URL as `desde`.

`desde` IS UNTRUSTED INPUT. Validate strictly before it touches `.or()`: the timestamp must parse
as a valid ISO date and the id as a UUID. Anything else — truncated encoding, bad UUID, injected
PostgREST grammar — discards the cursor and returns page 1. Never pass a dirty value to the filter.

## FIXTURE OWNERSHIP — mandatory, `fullyParallel: true` is on

Each spec owns an enumerated block and deletes ONLY its own ids, one by one. Never by range or
prefix:
  - `smoke-local.spec.ts` (exists, do not touch): `…8000-000000000001`
  - `reflexiones-paginacion.spec.ts`: `…8000-000000000101` … `…8000-000000000113`
  - `reflexiones.spec.ts` (RLS fixture): `…8000-000000000201`

## THE FROZEN TIE-BREAK FIXTURE — do not improvise it

All 13 rows share the SAME `published_at`, so ordering depends only on the tie-break. Insert them
with the one that sorts LAST first (`…0113`, then `…0101`…`…0112`) so physical order differs from
id order. Assert exact membership AND order: page 1 = `…0101`…`…0112` in that order, page 2 =
`…0113`. Not "each id appears once" — that is what let the mutation survive review.

## NULL FIELDS — decided, do not invent

`speaker` and `cover_url` are nullable and the seed's published row has NEITHER.
  - No preacher → omit the line entirely. No invented name, no "Anónimo".
  - No cover → neutral placeholder with the site name. Never a broken box or empty `alt`.
  - Same on both pages.

## ACCEPTANCE CRITERIA — all 13 are in the plan; these have teeth

- E3b.2 the real query against local PostgREST with the 13 rows, raw output, exact cleanup. If the
  nested `.or()` misbehaves: STATUS: FINDINGS and stop. Do not fall back to offset silently.
- E3b.3 the frozen fixture above, plus: after page 1, insert a row sorting BEFORE the cursor, then
  request page 2 and prove no repeat and no skip. Declare that the new row appears on reload.
- E3b.5 four hostile cursors → page 1, no raw error, no dirty query. Raw output of all four.
- E3b.8 publish an `8000` row (trigger assigns slug), unpublish it (D12 keeps the slug), request it
  anonymously by that slug → Spanish "not found"; an admin control proves the row still exists.
- E3b.10 a visible copy/share control producing literally
  `https://www.anglicanasanandres.cl/reflexiones/<slug>`, built from `CANONICAL_ORIGIN`.
- E3b.11 a stable Spanish error state — never a perpetual spinner or blank page.

## THREE DECLARED MUTATIONS — all must go RED, with raw output

1. Remove the `id` tie-break → E3b.3 fails on exact order (and the direct assertion that the second
   `.order('id', {ascending: true})` was issued).
2. Replace keyset with offset → the between-request insertion repeats a displayed row.
3. Change `CANONICAL_ORIGIN` to another string → E3b.10 fails on the literal URL.

## OUT OF SCOPE

- Real HTTP 404. `vercel.json` has a single rewrite; the Spanish "not found" is visual, HTTP 200.
  Wave 3 with E4-impl.
- `src/pages/NotFound.tsx` — it is in English, violates D14, and is the app-wide catch-all.
  Backlog, not this phase. E3b uses its own Spanish state.
- `publishService`, the slug migration, `supabase/seed.sql`, `smoke-local.spec.ts`.
- Search, filters, advanced player, public liturgy link, page-number pagination.

## TEST COMMANDS

    npx vitest run --no-file-parallelism src/lib/reflexiones src/pages
    supabase db reset
    npx playwright test tests/e2e/reflexiones.spec.ts tests/e2e/reflexiones-paginacion.spec.ts

Local stack: API 54331, DB 54332. `psql` is not on the host — use
`docker exec -i supabase_db_$(grep '^project_id' supabase/config.toml | cut -d'"' -f2) psql -U postgres -d postgres`.

## RULES

- Surgical. Match existing patterns.
- All visible text in Spanish (D14). No member PII (D13).
- Base-red or mutation evidence for every new test (D18). Paste the RED output.
- Gate: `scripts/gates/changed-files-diagnostics.sh` over the files you touch, against the recorded
  parent SHA. `npm run build` green.
- If tests are red, iterate up to 3 times, then STATUS: BLOCKED with the real error.
- If the plan is wrong, STOP CODING and report STATUS: FINDINGS. That is the correct outcome.

## WHEN DONE

The ledger lives on `docs/plan-audio`, a different branch — the PM writes it. Output exactly:

    ## EXECUTOR REPORT — E3b round 1
    STATUS: COMPLETE | BLOCKED | FINDINGS
    CONTEXT PRESSURE: comfortable | tight | ran out — <at what point?>
    BRANCH: <branch>   PARENT SHA: <the main you branched from>   COMMITS: <sha…>
    PRECONDITION: <result of the merge-base check>
    FILES CHANGED: <path (+x/-y) …>
    WHAT I DID: <one bullet per acceptance criterion, mapped to its ID>
    TEST COMMAND: <verbatim>
    TEST OUTPUT: <verbatim tail, unedited>
    THE THREE MUTATIONS, RED: <raw failure for each>
    GATE D18: <per-file diagnostics, base vs HEAD, plus build result>
    ACCEPTANCE CRITERIA: <E3b.1–E3b.13: met / not met / partially — with reason>
    DEVIATIONS FROM PROMPT: <or "none">
    ASSUMPTIONS MADE: <or "none">
    NOT DONE / OPEN:

If context runs short, cut WHAT I DID — never TEST OUTPUT, the mutations, or GATE D18.
