# EXECUTOR PROMPT — BILINGUE D1a round 3

> Loaded by `/exec BILINGUE D1a r3` from a **fresh** Claude Code session (Opus, `high` effort).
> Run from `/Users/brentcurtis/dev/casa-pilot`. Pilot phase under `docs/plan/SOP-PILOT.md`.
> This file is the complete instruction set for the round; the report format at the end extends
> the `/exec` default with the SOP-PILOT C2 self-review section.

---

You are the executor for CASA BILINGUE, phase D1a round 3. You have no prior context.

Codex final-reviewed round 2 and returned **FAIL** with two BLOCKING findings. Both were
independently confirmed by the PM. Round 2 was otherwise passed on every other check — the
manifest, the hygiene, the inclusion rule, the schema, the output shape and the scope-creep call
were all accepted. **Fix exactly these two things.**

BRANCH: `phase/d1a-method` (exists). Continue on it; commit as you go.
WORKTREE: `/Users/brentcurtis/dev/casa-pilot`. `node_modules` is installed.

> **This workstream's docs exist only on `pilot/sop-v2` / this worktree**, not on `main` and not in
> the default `casa-web` checkout. If a path below seems missing, you are in the wrong checkout.

## Read first

- `docs/plan/bilingue/PLAN.md` — Phase D1a, and frozen decisions **D-A, D-B, D-K, D-L, D-M, D-N**
- `docs/plan/bilingue/LEDGER.md` — the D1a r2 PM verification and the r3 triage entry
- `docs/plan/bilingue/prompts/D1a-r2.md` — the previous round's contract
- The four method artifacts under `docs/plan/bilingue/evidence/`

## [B1] The census still selects a test-only fixture

`supabase/functions/generate-story/corpus_pd_base.json` is selected by **both** passes. It is a
captured baseline whose **only** importer is a test:

```bash
/usr/bin/grep -rn "corpus_pd_base" src supabase '--include=*.ts' '--include=*.tsx'
# -> only supabase/functions/generate-story/corpus_parity_test.ts
```

This falsifies `CENSUS-METHOD.md`'s claim that no other test/fixture convention occurs in the roots.

**Do not fix this with another name predicate.** `corpus_pd_base.json` is not named `*_test.*`, is
not in a `__tests__` directory, and follows no naming convention at all. A name-based rule cannot
catch it, and the next one like it will be named differently again.

The PM enumerated the full extent so you are not fixing one instance blind — **exactly 8 `.json`
files are selected**, and only this one is test evidence:

```bash
# 7 × src/data/elementos-fijos/*.json  -> imported by production modules (liturgy.ts,
#                                         FixedElementsList.tsx, ElementoFijoEditor.tsx,
#                                         ConstructorLiturgias.tsx, SceneSelector.tsx,
#                                         fixedElementToSlides.ts) — CORRECTLY INCLUDED
# 1 × supabase/functions/generate-story/corpus_pd_base.json -> only corpus_parity_test.ts — EXCLUDE
```

`supabase/functions/_shared/corpus_baseline.json`, `deno.json` and `import_map.json` are **not**
selected (only `_shared/whatsapp` is a root, not `_shared`). Confirm that yourself; do not assume it.

**What to build:** an exclusion rule for data files based on **who imports them**, not on their
name — a `.json` in the roots whose only importers are test files is test evidence and is excluded.
Implement it so it is derivable and re-runnable, state it in `CENSUS-METHOD.md` with its command and
literal output, and **retract the falsified "no other fixture convention occurs" claim** rather than
narrowing it silently.

If you conclude an importer-based rule cannot be implemented cleanly in `census.sh`, say so and
report `STATUS: FINDINGS` with what you would propose instead. Do not fall back to hardcoding the
filename — that is a name predicate wearing a disguise.

## [B2] A frozen-contract violation: an asserted claim with no command behind it

`CENSUS-METHOD.md` states two things and supplies one command:

> "Every selected `*_test.ts` was confirmed to be a test — each declares `Deno.test` — and no
> non-test module in `src/` or `supabase/` imports any `*_test` module"

The recorded command checks only static `from ..._test` imports. **It does not prove the
`Deno.test` assertion at all.** D-B and D-M require every claim to carry the exact executed command
with its literal output. Codex confirmed the claim is *true* — that is not the issue; the missing
evidence is.

**What to build:** the command that actually establishes it, with literal output, in the artifact.
It must cover every file the `*_test.*` predicate excludes, and it must fail loudly rather than
silently if any excluded file does not declare a test runner. Note the limit the PM flagged and
state it: an importer search cannot catch a test file that itself emits user-visible copy.

## Explicitly out of scope

- Any change to the roots, the character class, the word list, the schema, or the inclusion rule.
  Codex accepted all of them.
- Recording any count, total or file number in a prose artifact (**D-L**). You will run `census.sh`
  to verify selection — that is verification, not a result to record.
- Any change to `src/`, `supabase/`, or migrations (**D-A**).
- Re-opening anything Codex passed. This is a two-item round.

## Acceptance criteria

- [A1] `corpus_pd_base.json` is not selected by either pass; the seven `elementos-fijos` JSONs
  still are.
- [A2] The exclusion is **importer-based, not name-based**, and is stated in `CENSUS-METHOD.md`
  with its command and literal output.
- [A3] The falsified "no other test, spec, mock or fixture convention occurs" claim is retracted or
  restated to something the evidence supports.
- [A4] The `Deno.test` claim carries a command that actually proves it, with literal output, and
  fails loudly on a non-conforming file.
- [A5] All four `METHOD-MANIFEST.txt` hashes verify after your changes.
- [A6] No prose artifact records a measurement result (**D-L**).
- [A7] `git diff --stat pilot/sop-v2...HEAD` lists only `docs/plan/bilingue/`.

## Test command

```bash
cd /Users/brentcurtis/dev/casa-pilot && export LC_ALL=en_US.UTF-8
bash docs/plan/bilingue/evidence/census.sh 2>/dev/null | /usr/bin/grep -c 'corpus_pd_base'   # expect 0
bash docs/plan/bilingue/evidence/census.sh 2>/dev/null | /usr/bin/grep -c 'elementos-fijos'  # expect > 0
bash docs/plan/bilingue/evidence/census.sh 2>/dev/null | /usr/bin/grep -cE '_test\.|\.test\.|\.spec\.|__mocks__'  # expect 0
cd docs/plan/bilingue/evidence && /usr/bin/grep -vE '^#' METHOD-MANIFEST.txt | /usr/bin/shasum -a 256 -c
cd /Users/brentcurtis/dev/casa-pilot && git diff --name-only pilot/sop-v2...HEAD | /usr/bin/grep -v '^docs/plan/bilingue/'   # expect no output
npx tsc --noEmit; echo "tsc=$?"
```

Paste the real commands you ran and their real output (**D-M**). Adjust any invocation that needs
it and show the adjusted form.

## Rules

- Surgical. Two findings. Do not improve adjacent things — the last round's scope creep was
  accepted only because the lines it touched had been made false by the round's own test plan.
- **D-M** — never describe a command in prose; paste the literal command and its literal output.
  *(The PM violated this in the r2 verification ledger entry. It is easy to do; check yourself.)*
- **D-K** — absolute binary paths for every process; `LC_ALL` exported once. `grep` and `find` may
  be shell functions here — check `type -a grep`.
- **D-L** — the method lock. If you change a method artifact, recompute its hash.
- If a fix would drop a real copy surface, **STOP** and report `STATUS: FINDINGS`.

## When done

Append your round entry to `docs/plan/bilingue/LEDGER.md` with `ELAPSED`, `STAGE`, `EFFORT` and
`FIRST-PASS`, then output exactly this report:

```
## EXECUTOR REPORT — D1a round 3
STATUS: COMPLETE | BLOCKED | FINDINGS
CONTEXT PRESSURE: comfortable | tight | ran out — <at what point?>
BRANCH: <branch>   COMMITS: <sha…>
FILES CHANGED: <path (+x/-y) …>
WHAT I DID: <one bullet per acceptance criterion, mapped to A1–A7>
TEST COMMAND: <verbatim>
TEST OUTPUT: <verbatim tail, unedited>
ACCEPTANCE CRITERIA: <A1–A7: met / not met / partially — with reason>
DEVIATIONS FROM PROMPT: <or "none">
ASSUMPTIONS MADE: <or "none">
NOT DONE / OPEN:

PRE-SUBMISSION SELF-REVIEW (against the SOP §3.6 reviewer rubric)
- Acceptance criteria: <each ID, met/not met, how verified>
- Correctness / edge cases: <what I checked, what I could not>
- Frozen decisions: <which apply, why this does not violate them — D-B, D-L and D-M especially>
- Scope creep: <anything touched outside SCOPE, and why>
- Next-phase cost: <anything that makes D1b harder>
- Weakest part of this diff: <name it — the reviewer will find it anyway>
```
