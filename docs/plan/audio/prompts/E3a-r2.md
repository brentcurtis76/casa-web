SESSION: AUDIO · E3a · r2 · EXEC

You are the executor for AUDIO phase E3a, round 2. You have no prior context. This is a
**remediation round with exactly one defect to fix**. Codex reviewed round 1 and returned FAIL
with a single BLOCKING finding; everything else passed. **Do not touch production code.**

BRANCH: `phase/E3a-slug`, already exists at `1d09b7d` (parent `4b44b5b`). Check it out and commit
on top. Do not rebase, do not squash, do not branch anew.

## THE DEFECT — one vacuous assertion

`src/lib/sermon-editor/__tests__/publishService.test.ts:361` asserts:

```ts
expect(recorded.selectCols.some((c) => c.includes('slug'))).toBe(true);
```

It is meant to prove criterion **E3a.12**: that the publishing UPDATE asks for `slug` back, i.e.
`.select('episode_number, slug')` at `publishService.ts:298`.

It proves nothing. The mock recorder at **line 54** pushes *every* `select()` call into one flat
`selectCols` array:

```ts
if (cols !== undefined) recorded?.selectCols.push(cols);
```

and the earlier draft lookup (`publishService.ts:153` and `:185`) also selects `slug`. So the
`.some()` is already satisfied before the UPDATE ever runs.

**Reproduced twice, by Codex and by the PM.** Mutate `publishService.ts:298` from
`.select('episode_number, slug')` to `.select('episode_number')` and **all 10 tests still pass**.

Why it matters, concretely: against real Supabase that mutation makes the publication response
omit `slug`, so `publishEpisode` throws *after* the episode is already published and cannot return
the canonical URL. D18 freezes the rule that **a wiring claim must go red when the wiring is cut**.

## WHAT TO DO

Make the publishing projection provable on its own. Distinguish the UPDATE's `select` from the
lookup's — record selects by query kind (e.g. a separate `updateSelectCols`, populated only when
the builder chain began with `.update()`), or assert the exact final projection. The shape is
yours; the requirement is not:

- **[A1]** With production code unchanged, the suite is green.
- **[A2]** With `publishService.ts:298` mutated to `.select('episode_number')` — **and nothing
  else changed** — at least one test goes **RED**. Paste the raw red output.
- **[A3]** The existing assertions still hold, unchanged in meaning. In particular
  `publishService.test.ts:329` (`selectCols[0]` contains `title`) must keep working, and the
  round-1 mutations must stay red: derive from `metadata.title`; omit `slug` from the UPDATE
  payload; build the result from the preference instead of the returned value.
- **[A4]** `src/lib/sermon-editor/__tests__/publishService.test.ts` is the **only** file changed.

## EXPLICITLY OUT OF SCOPE

- **Any production file.** `publishService.ts`, `slug.ts`, the migration, `types.ts`,
  `supabase/tests/slug.sql` — none of them change. Codex ruled the implementation correct.
- The `DROP TRIGGER IF EXISTS` NIT in the migration. Logged to backlog; leave it.
- `seed.sql`, `smoke-local.spec.ts`, `podcast-backfill/index.ts`.

## TEST COMMAND

```bash
npx vitest run --no-file-parallelism src/lib/sermon-editor
```

Then the gate over the one changed file, against parent `4b44b5b`:

```bash
./scripts/gates/changed-files-diagnostics.sh src/lib/sermon-editor/__tests__/publishService.test.ts
npm run build
```

You do not need the database for this round; no SQL or e2e behaviour changes.

## RULES

- Surgical. One file. Match the existing mock's style.
- Spanish for comments and messages, matching the file (D14).
- **Show the RED output of the A2 mutation**, not just the green suite. That red output *is* the
  deliverable; without it this round has proved nothing and repeats round 1's mistake.
- If tests are red for a reason you did not intend, iterate up to 3 times, then report
  `STATUS: BLOCKED` with the real error.
- Do not expand scope. If you spot something else wrong, put it under NOT DONE.

## WHEN DONE

The ledger lives on `docs/plan-audio`, a different branch — the PM writes it. Output only:

```
## EXECUTOR REPORT — E3a round 2
STATUS: COMPLETE | BLOCKED | FINDINGS
CONTEXT PRESSURE: comfortable | tight | ran out
BRANCH: phase/E3a-slug   COMMITS: <sha…>
FILES CHANGED: <path (+x/-y)>
WHAT I DID: <how you distinguished the two selects>
TEST COMMAND: <verbatim>
TEST OUTPUT (GREEN, unmutated): <verbatim tail>
TEST OUTPUT (RED, with the A2 mutation applied): <verbatim tail — this is the point of the round>
ROUND-1 MUTATIONS STILL RED: <the three, with their raw failures>
GATE D18: <diagnostics for the one file, base vs HEAD, plus build>
ACCEPTANCE CRITERIA: <A1–A4: met / not met>
DEVIATIONS FROM PROMPT: <or "none">
NOT DONE / OPEN:
```
