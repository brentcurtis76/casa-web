# EXECUTOR PROMPT — BILINGUE D1a round 4 (amended contract)

> Loaded by `/exec BILINGUE D1a r4` from a **fresh** Claude Code session (Opus, `high` effort).
> Run from `/Users/brentcurtis/dev/casa-pilot`, branch `phase/d1a-method`.
> **This is not a fourth attempt at the old contract.** SOP §1.5's caps were both reached, a re-plan
> was written (`REPLAN-D1a.md`) and Brent approved it on 2026-08-11. The phase's criteria changed.
> This file is the complete instruction set; the report format extends the `/exec` default with the
> SOP-PILOT C2 self-review section.

---

You are the executor for CASA BILINGUE, phase D1a round 4. You have no prior context.

> **This workstream's docs exist only on `pilot/sop-v2` / the `casa-pilot` worktree** — not on
> `main`, not in the default `casa-web` checkout. If a path below seems missing, you are in the
> wrong checkout.

## What changed, and why this round is different

Rounds 1–3 each fixed a real defect and each left behind an **absolute safety claim that a bash
text heuristic cannot support**. Codex FAILed the phase twice on exactly that:

- r3 [B1] — the artifact guarantees the exclusion "never drops" a copy surface. **False.** If
  production reaches a `.json` by a constructed or globbed path — no literal basename anywhere in
  `.ts` — while an unrelated test names that basename literally, every referrer is a test and the
  **production file is excluded**.
- r3 [B2] — the `Deno.test` check cannot prove what it claims. Verified by construction:

```bash
printf '// Deno.test("x", () => {});\n' > a_test.ts   # PASSES — a comment counts as a test
printf 'const note = "Deno.test(";\n'    > b_test.ts   # PASSES — a string literal counts
printf 'Deno["test"]("x", () => {});\n'  > c_test.ts   # FAILS  — a real test is flagged non-test
```

**The amendment: D1a stops trying to prove its exclusions are safe.** It states the rule and its
error direction. D1b — which is allowed to produce results — enumerates what was excluded, and a
reviewer reads that list. New frozen decision **D-O** governs this.

## Read first

- `docs/plan/bilingue/REPLAN-D1a.md` — the approved proposal. Read this before the plan.
- `docs/plan/bilingue/PLAN.md` — Phase D1a criteria **D1a.9, D1a.10, D1a.11** are new; **D-O** is
  new; D1b.13 is new. Also D-A, D-B, D-K, D-L, D-M, D-N.
- `docs/plan/bilingue/LEDGER.md` — the r3 PM verification and the cap-reached triage entry.
- The four method artifacts under `docs/plan/bilingue/evidence/`.

## Scope — three changes, nothing else

1. **Remove every untested absolute from the method artifacts** (D1a.9). Search
   `CENSUS-METHOD.md` and `census.sh` for claims of the form "never drops", "drops no copy
   surface", "every excluded file is a test", "no other convention occurs". Each is either deleted,
   or replaced by a statement of the **error direction** plus the named cases where that direction
   does not hold. State the r3 [B1] counterexample explicitly as a case where the direction fails.
2. **Make the ambiguity branch explicit in code** (D1a.10). Today `json_is_test_evidence` keeps on
   "no referrer" and keeps on "any non-test referrer" as emergent behaviour. Make *keeping under
   ambiguity* a named, commented branch that records **why** the file was kept, so D1b can emit it.
   Ambiguous includes at minimum: no referrer found; the basename collides with another file in the
   scanned roots; the only references are non-literal. You need not detect constructed paths — you
   need to stop claiming they are handled.
3. **Delete the `Deno.test` textual check** (D1a.11) and the claim it supported. Do not replace it
   with a better regex — that is the refuted approach. What replaces it is D1b.13's enumeration,
   which is D1b's deliverable, not yours. Leave `CENSUS-METHOD.md` stating that exclusion safety is
   established by enumeration in D1b.

## Explicitly out of scope

- The roots, character class, word list, schema, inclusion rule, manifest design, hygiene, output
  shape. **Codex passed every one of these across two reviews.** Do not touch them.
- The stage-two exclusion *behaviour* — `corpus_pd_base.json` must stay excluded and all seven
  `elementos-fijos` JSONs must stay retained. You are changing what the artifact **claims**, and
  making one branch explicit — not changing what it selects.
- Recording any count, total or file number in a prose artifact (**D-L**).
- Any change to `src/`, `supabase/`, or migrations (**D-A**).
- Writing `D1-exclusions.md`. That is D1b.13.

## Acceptance criteria

- [A1] No method artifact contains an untested absolute safety claim (D1a.9). Every exclusion rule
  states its error direction and the cases where it does not hold, including r3 [B1]'s.
- [A2] The ambiguity branch is explicit and commented in `census.sh`, records a reason, and keeps
  (D1a.10).
- [A3] The `Deno.test` textual check and its claim are gone; `CENSUS-METHOD.md` states that
  exclusion safety is established by enumeration in D1b (D1a.11).
- [A4] Selection is unchanged: `corpus_pd_base` → 0, `elementos-fijos` → 14, test shapes → 0.
- [A5] All four `METHOD-MANIFEST.txt` hashes verify.
- [A6] No prose artifact records a measurement result (**D-L**).
- [A7] `git diff --stat pilot/sop-v2...HEAD` lists only `docs/plan/bilingue/`.

## Test command

```bash
cd /Users/brentcurtis/dev/casa-pilot && export LC_ALL=en_US.UTF-8
bash docs/plan/bilingue/evidence/census.sh 2>/dev/null | /usr/bin/grep -c 'corpus_pd_base'   # expect 0
bash docs/plan/bilingue/evidence/census.sh 2>/dev/null | /usr/bin/grep -c 'elementos-fijos'  # expect 14
bash docs/plan/bilingue/evidence/census.sh 2>/dev/null | /usr/bin/grep -cE '_test\.|\.test\.|\.spec\.|__mocks__'  # expect 0
/usr/bin/grep -rniE "never drop|drops no|every excluded file is a test|no other (test|fixture|spec)" \
  docs/plan/bilingue/evidence/   # expect no match, or only inside an explicit retraction
cd docs/plan/bilingue/evidence && /usr/bin/grep -vE '^#' METHOD-MANIFEST.txt | /usr/bin/shasum -a 256 -c
cd /Users/brentcurtis/dev/casa-pilot && git diff --name-only pilot/sop-v2...HEAD | /usr/bin/grep -v '^docs/plan/bilingue/'
npx tsc --noEmit; echo "tsc=$?"
```

Paste the real commands and their real output (**D-M**).

## Rules

- Surgical. Three changes. Everything else in this method has been reviewer-approved twice.
- **D-O** — do not replace one untested guarantee with another. If you find yourself writing a
  cleverer pattern to prove a file is safe to exclude, stop: that is the refuted approach.
- **D-M** — never describe a command in prose; paste the literal command and its literal output.
  *(The PM has broken this twice in ledger entries. It is easy to do.)*
- **D-K** — absolute binary paths; `LC_ALL` exported once. `grep`/`find` are shell functions here.
- **D-L** — recompute the hash of any artifact you change.
- If removing a claim would leave the method genuinely unsound rather than merely unproven, that is
  a real finding — **STOP** and report `STATUS: FINDINGS`.

## When done

Append your round entry to `docs/plan/bilingue/LEDGER.md` with `ELAPSED`, `STAGE`, `EFFORT` and
`FIRST-PASS`, then output exactly this report:

```
## EXECUTOR REPORT — D1a round 4
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
- Frozen decisions: <which apply — D-O, D-L and D-M especially>
- Scope creep: <anything touched outside SCOPE, and why>
- Next-phase cost: <anything that makes D1b harder>
- Weakest part of this diff: <name it — the reviewer will find it anyway>
```
