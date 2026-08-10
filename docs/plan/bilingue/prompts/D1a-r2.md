# EXECUTOR PROMPT — BILINGUE D1a round 2

> Loaded by `/exec BILINGUE D1a r2` from a **fresh** Claude Code session (Opus, `high` effort).
> Run from `/Users/brentcurtis/dev/casa-pilot`. Pilot phase under `docs/plan/SOP-PILOT.md`.
> This file is the complete instruction set for the round; the report format at the end
> extends the `/exec` default with the SOP-PILOT C2 self-review section.

---

You are the executor for CASA BILINGUE, phase D1a round 2. You have no prior context.
Round 1 was largely correct — the method lock held, the manifest verifies, and the inclusion
rule resolved both boundary probes. One BLOCKING finding remains.

BRANCH: `phase/d1a-method` (exists, HEAD `3984fbd`). Continue on it; commit as you go.
WORKTREE: `/Users/brentcurtis/dev/casa-pilot` — `node_modules` already installed by round 1.

## Read first

- `docs/plan/bilingue/PLAN.md` at `c842161` — frozen. Phase D1a, and decisions D-A, D-K, D-L, D-M.
- `docs/plan/bilingue/LEDGER.md` — the entry **"D1a round 1 — PM verification"** states the
  finding and exactly what the PM verified independently.
- The four method artifacts under `docs/plan/bilingue/evidence/`.

## The one BLOCKING finding — [B1] the census counts Deno test files

`census.sh` excludes tests with:

```
-not -path '*__tests__*' -not -name '*.test.*'
```

That catches the dot convention (`Foo.test.ts`) used under `src/`, but **not** the underscore
convention (`handler_test.ts`, `prompt_test.ts`) used throughout `supabase/functions/`.

Verified by the PM:

```bash
/usr/bin/find -E src supabase -regex '.*_test\.(ts|tsx)$' -not -path '*node_modules*' | /usr/bin/wc -l
# -> 22 files, and ZERO of them sit inside a __tests__ directory, so nothing excludes them.
```

They contribute 12 hits / 12 `no_accent_hits` to `PASS_B_SUMMARY`. Test files are not
user-visible copy surfaces. Locking this method would push the contamination into D1b and every
sizing decision downstream.

**This defect originated in `PLAN.md`'s own script, not in your round-1 work.** D1a is the correct
phase to fix it — the plan says a wrong method element is corrected here rather than in D1b.

## Scope — fix the exclusion and nothing else

1. **`census.sh`** — exclude the underscore test convention. Check for any other test or fixture
   naming convention present in the roots (`.spec.`, `_spec.`, `__mocks__`, `testHelpers`, …) and
   exclude what genuinely is not a copy surface. Justify each exclusion.
2. **`CENSUS-METHOD.md`** — state the full exclusion rule with every convention it covers, and why
   test files are excluded from a copy census.
3. **`METHOD-MANIFEST.txt`** — recompute `sha256` for every artifact you changed. All four entries
   must verify after your change.

## Explicitly out of scope

- Recording any count, total or file number in a prose artifact. **D-L still holds:** this phase
  produces a method, not results. You *will* run `census.sh` to check file selection (below) —
  that is verification, not a result to record. Do not write its numbers anywhere.
- Changing the roots, the character class, the word list, the schema, or the inclusion rule.
  Round 1 got those right and the PM verified them.
- Any change to `src/`, `supabase/`, or migrations (D-A).

## Acceptance criteria

- [A1] `census.sh` selects no file matching any test/spec convention present in the roots.
- [A2] `CENSUS-METHOD.md` documents the complete exclusion rule and the rationale.
- [A3] All four `METHOD-MANIFEST.txt` hashes verify against the files after your change.
- [A4] No prose artifact records a measurement result (D-L).
- [A5] `git diff --stat pilot/sop-v2...HEAD` lists only `docs/plan/bilingue/`.

## Test command

Note this **runs** the script. `bash -n` provably could not catch this class of defect — it is
how round 1 shipped it.

```bash
cd /Users/brentcurtis/dev/casa-pilot
bash docs/plan/bilingue/evidence/census.sh 2>/dev/null \
  | /usr/bin/grep -cE '_test\.|\.test\.|\.spec\.|__mocks__'   # expect: 0
cd docs/plan/bilingue/evidence && /usr/bin/grep -vE '^#' METHOD-MANIFEST.txt | /usr/bin/shasum -a 256 -c
cd /Users/brentcurtis/dev/casa-pilot && git diff --stat pilot/sop-v2...HEAD
npx tsc --noEmit; echo "tsc=$?"
```

Paste the real commands you ran and their real output (D-M) — if any invocation above needs
adjusting to work, adjust it and show the adjusted form.

## Rules

- Surgical. This is a one-line-class fix plus its documentation. Do not improve adjacent things.
- **D-M** — never describe a command in prose; paste the literal command and its literal output.
- **D-K** — absolute binary paths; `LC_ALL` exported once. `grep` and `find` may be shell
  functions in your environment; check with `type -a grep`.
- If excluding a convention would also drop a real copy surface, **STOP** and report
  `STATUS: FINDINGS` rather than guessing.

## When done

Append your round entry to `docs/plan/bilingue/LEDGER.md` with `ELAPSED`, `STAGE`, `EFFORT` and
`FIRST-PASS`, then output exactly this report:

```
## EXECUTOR REPORT — D1a round 2
STATUS: COMPLETE | BLOCKED | FINDINGS
CONTEXT PRESSURE: comfortable | tight | ran out — <at what point?>
BRANCH: <branch>   COMMITS: <sha…>
FILES CHANGED: <path (+x/-y) …>
WHAT I DID: <one bullet per acceptance criterion, mapped to A1–A5>
TEST COMMAND: <verbatim>
TEST OUTPUT: <verbatim tail, unedited>
ACCEPTANCE CRITERIA: <A1–A5: met / not met / partially — with reason>
DEVIATIONS FROM PROMPT: <or "none">
ASSUMPTIONS MADE: <or "none">
NOT DONE / OPEN:

PRE-SUBMISSION SELF-REVIEW (against the SOP §3.6 reviewer rubric)
- Acceptance criteria: <each ID, met/not met, how verified>
- Correctness / edge cases: <what I checked, what I could not>
- Frozen decisions: <which apply, why this does not violate them — D-L and D-M especially>
- Scope creep: <anything touched outside SCOPE, and why>
- Next-phase cost: <anything that makes D1b harder>
- Weakest part of this diff: <name it — the reviewer will find it anyway>
```
