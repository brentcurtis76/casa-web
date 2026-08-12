# REVIEW REQUEST — BILINGUE D1a round 4 (amended contract)

- Branch: `phase/d1a-method` · Base: `pilot/sop-v2`
- Worktree: `/Users/brentcurtis/dev/casa-pilot` · Git common dir: `/Users/brentcurtis/dev/casa-web/.git`
- Contract: `docs/plan/bilingue/prompts/D1a-r4.md` · Amendment: `docs/plan/bilingue/REPLAN-D1a.md`
- New criteria: **D1a.9, D1a.10, D1a.11**; new frozen decision **D-O**; new D1b deliverable **D1b.13**
- Cumulative attempt: **4** (re-planning did not reset the count)
- Risk tier: **STANDARD** — documentation-only, zero-line source diff, no schema/auth/PII surface

## What changed and why

Rounds 1–3 each fixed a real defect and each left behind an absolute safety claim that a bash text
heuristic cannot support. Codex FAILed on exactly that twice. The approved re-plan stops D1a from
trying to prove its exclusions are safe: it states each rule and the direction in which the rule is
wrong, makes the ambiguity branch explicit in code, and moves exclusion safety to enumeration in
D1b. Three changes, nothing else.

| # | Change | Criterion |
|---|---|---|
| 1 | Untested absolutes removed from the method artifacts; each exclusion rule now states its error direction and the named cases where that direction does not hold, including r3 [B1] | D1a.9 / A1 |
| 2 | Stage two rewritten as three named branches in `census.sh`; the two ambiguity branches keep and record a machine-readable reason | D1a.10 / A2 |
| 3 | The `Deno.test` textual check deleted with the claim it supported; `CENSUS-METHOD.md` now states that exclusion safety is established by enumeration in D1b | D1a.11 / A3 |

## Files changed

Method artifacts (`git diff --stat`, before the ledger entry and this file were written):

```
docs/plan/bilingue/evidence/CENSUS-METHOD.md    | 152 ++++++++++++++----------
docs/plan/bilingue/evidence/METHOD-MANIFEST.txt |   4 +-
docs/plan/bilingue/evidence/census.sh           |  57 ++++++++-
3 files changed, 143 insertions(+), 70 deletions(-)
```

Plus `docs/plan/bilingue/LEDGER.md` (r4 entry appended) and this review request.

`SURFACE-SCHEMA.md` and `wordlist-passB.txt` are unchanged and their manifest hashes are unchanged.

## The ambiguity branch, as implemented

`json_is_test_evidence` in `census.sh` now has three named branches. Ambiguity keeps and says why:

| Branch | Condition | Outcome | Reason |
|---|---|---|---|
| 1 | more than one file under `src/`/`supabase/` carries this basename | keep | `basename-collision` |
| 2 | no `.ts`/`.tsx` under those roots writes the basename as text | keep | `no-literal-referrer` |
| 3 | any non-test referrer → keep · every referrer is a test file → exclude | resolved | — |

Branch 2 is where a runtime-assembled path, a glob expansion and a referrer outside the referrer
roots all come to rest, indistinguishable from a genuinely unreferenced file. **The branch does not
detect those cases and the artifact no longer says it does.**

Each ambiguous keep is written once to **stderr** as `AMBIGUOUS_KEEP<TAB>path<TAB>reason=…`. stdout
carries census rows only, so the output shape D1b consumes is byte-identical to the reviewed one.
D1b captures stderr and enumerates it in `D1-exclusions.md` (D1b.13).

## Gates and acceptance evidence — verbatim

### Selection is unchanged (A4)

```text
$ bash docs/plan/bilingue/evidence/census.sh 2>/dev/null | /usr/bin/grep -c 'corpus_pd_base'
0

$ bash docs/plan/bilingue/evidence/census.sh 2>/dev/null | /usr/bin/grep -c 'elementos-fijos'
14

$ bash docs/plan/bilingue/evidence/census.sh 2>/dev/null | /usr/bin/grep -cE '_test\.|\.test\.|\.spec\.|__mocks__'
0
```

Stronger than the three counts: the full stdout of this round's script is byte-identical to that of
the round-3 script Codex reviewed. Reproducible from the repository root:

```text
$ export LC_ALL=en_US.UTF-8
$ /usr/bin/git show 98f4e51:docs/plan/bilingue/evidence/census.sh > /tmp/census-r3.sh
$ bash /tmp/census-r3.sh > /tmp/cs-r3.txt 2>/dev/null; echo "r3 exit=$?"
r3 exit=0
$ bash docs/plan/bilingue/evidence/census.sh > /tmp/cs-r4.txt 2>/dev/null; echo "r4 exit=$?"
r4 exit=0
$ /usr/bin/diff /tmp/cs-r3.txt /tmp/cs-r4.txt && echo "IDENTICAL"
IDENTICAL
```

### The ambiguity record (A2)

```text
$ bash docs/plan/bilingue/evidence/census.sh 3>&1 1>/dev/null 2>&3
AMBIGUOUS_KEEP	src/data/elementos-fijos/index.json	reason=basename-collision
```

`src/data/elementos-fijos/index.json` collides with `src/data/canciones/index.json`. It was kept
before this change and is kept now — the change is that the *reason* is now recorded rather than
emergent.

### The branches are capable of firing — falsification by construction

Branch 2 does not fire against the live tree, so all four outcomes were exercised in isolation on a
scratch tree, using the committed function extracted verbatim from `census.sh` rather than a retyped
copy. This is the complete harness, not an abridgement of one:

```bash
export LC_ALL=en_US.UTF-8
CENSUS=/Users/brentcurtis/dev/casa-pilot/docs/plan/bilingue/evidence/census.sh
SCRATCH=$(/usr/bin/mktemp -d)

# The four fixtures, one per outcome.
/bin/mkdir -p "$SCRATCH/src" "$SCRATCH/supabase/x"
printf '{"a":1}\n'                        > "$SCRATCH/src/orphan.json"    # nothing names it
printf '{"b":2}\n'                        > "$SCRATCH/src/dup.json"       # basename appears twice
printf '{"b":2}\n'                        > "$SCRATCH/supabase/x/dup.json"
printf '{"c":3}\n'                        > "$SCRATCH/src/fixture.json"   # only a test names it
printf 'import d from "./fixture.json";\n' > "$SCRATCH/src/thing_test.ts"
printf '{"d":4}\n'                        > "$SCRATCH/src/real.json"      # production names it
printf 'import d from "./real.json";\n'   > "$SCRATCH/src/prod.ts"

# Extract the committed function and its recorder verbatim from census.sh — not a retyped copy.
/usr/bin/sed -n '/^AMBIGUOUS_KEPT=$/,/^}$/p'              "$CENSUS" >  "$SCRATCH/fn.sh"
/usr/bin/sed -n '/^json_is_test_evidence()/,/^}$/p'       "$CENSUS" >> "$SCRATCH/fn.sh"
/usr/bin/shasum -a 256 "$SCRATCH/fn.sh" | /usr/bin/awk '{print "harness function sha256: " $1}'

cd "$SCRATCH"
FIND=/usr/bin/find; SORT=/usr/bin/sort; GREP=/usr/bin/grep; WC=/usr/bin/wc; AWK=/usr/bin/awk
TEST_PATH_ERE='(^|/)__tests__/|\.test\.[^/]+$|_test\.[^/]+$'
REFERRER_ROOTS=(src supabase)
. "$SCRATCH/fn.sh"

for f in src/orphan.json src/dup.json src/fixture.json src/real.json; do
  if json_is_test_evidence "$f"; then printf 'EXCLUDED\t%s\n' "$f"; else printf 'KEPT\t%s\n' "$f"; fi
done
/bin/rm -rf "$SCRATCH"
```

Unedited output, stdout and stderr interleaved, exit status included:

```text
harness function sha256: ca6e9ce7977e29692cef6e8572f4a2a483458cd4fa9662744033f087a4aab7ef
AMBIGUOUS_KEEP	src/orphan.json	reason=no-literal-referrer
KEPT	src/orphan.json
AMBIGUOUS_KEEP	src/dup.json	reason=basename-collision
KEPT	src/dup.json
EXCLUDED	src/fixture.json
KEPT	src/real.json
harness exit=0
```

Four fixtures, four outcomes: branch 2 (`orphan.json`, nothing names it), branch 1
(`dup.json`, basename appears under both roots), branch 3 exclude (`fixture.json`, named only by
`thing_test.ts`), branch 3 keep (`real.json`, named by `prod.ts`). The `sha256` line pins which text
was actually sourced, so the run cannot be confused with one against an edited copy of the function.

### No untested absolute survives (A1)

```text
$ /usr/bin/grep -rniE "never drop|drops no|every excluded file is a test|no other (test|fixture|spec)" docs/plan/bilingue/evidence/
docs/plan/bilingue/evidence//CENSUS-METHOD.md:198:Round 2 of this artifact stated: *"No other test, spec, mock or fixture convention occurs in the
```

The single hit is the quoted text of an explicitly retracted claim (`**That claim is retracted.**`
on the next line), which the contract permits.

### Method lock verifies (A5)

```text
$ cd docs/plan/bilingue/evidence && /usr/bin/grep -vE '^#' METHOD-MANIFEST.txt | /usr/bin/shasum -a 256 -c
CENSUS-METHOD.md: OK
census.sh: OK
SURFACE-SCHEMA.md: OK
wordlist-passB.txt: OK
```

### No measurement result in a prose artifact (A6)

```text
$ /usr/bin/grep -rnE '^\s*[A-Za-z ]+\s*=\s*[0-9]+|files=|copy=|TOTAL' docs/plan/bilingue/evidence/CENSUS-METHOD.md docs/plan/bilingue/evidence/SURFACE-SCHEMA.md
(exit 1, no output)
```

### Syntax and type gates

```text
$ bash -n docs/plan/bilingue/evidence/census.sh; echo "bash -n=$?"
bash -n=0

$ npx tsc --noEmit; echo "tsc=$?"
tsc=0
```

**Gate set.** This is the document-only gate set defined and justified for this workstream in
`LEDGER.md` (D1a bootstrap, `[S4]`): `git diff --stat`, the verify/manifest check, and
`npx tsc --noEmit`. `npm run lint`, `npm test`, `npm run build` and Playwright are deliberately
excluded on a **zero-line source diff**, where they re-test the base branch rather than the phase;
`tsc` is retained precisely because it catches a source file that leaked in. The CASA base is red
today — 118 lint errors, 15 failing tests at `d5b16e8` — recorded in `SOP-PILOT.md` as of `98f4e51`,
which after the A7 remediation below lives on `pilot/lean-v2` rather than on this branch. Repository
debt routed to a stabilization phase, not a result of this diff.

### Diff confinement (A7) — **met, after the r4 review**

The first submission of this round left `docs/plan/HANDOFF-PROCESS.md` and `docs/plan/SOP-PILOT.md`
in the phase diff. They arrived in `98f4e51 docs(plan): activate lean workflow v2`, a workflow
commit made on this branch before r4 began. Codex ruled [B5] that ownership and
documentation-only content preserve **D-A** but do not satisfy **D1a.8**'s explicit branch
confinement, and that the phase ancestry had to be rebuilt without it. Brent authorised the history
rewrite; the commit was preserved before it was moved.

```text
$ /usr/bin/git branch pilot/lean-v2 98f4e51
$ /usr/bin/git push origin pilot/lean-v2
$ /usr/bin/git rebase --onto f2be4f2 98f4e51 phase/d1a-method
Successfully rebased and updated refs/heads/phase/d1a-method.

$ /usr/bin/git diff --name-only pilot/sop-v2...HEAD | /usr/bin/grep -v '^docs/plan/bilingue/'
(exit 1, no output)

$ /usr/bin/git branch -a --contains 98f4e51
  pilot/lean-v2
  remotes/origin/pilot/lean-v2
```

`98f4e51` is preserved on `pilot/lean-v2`, pushed, so the workflow-activation work is not lost and
**every citation to that SHA in this file and in `LEDGER.md` still resolves** — including the
byte-identical census proof, re-run after the rebase and still `IDENTICAL`. Only this round's three
commits were replayed; they touch `docs/plan/bilingue/` only, so the replay was conflict-free.

## Known limits of this diff, stated rather than defended

1. **Branch 2 (`no-literal-referrer`) is unexercised by the live tree.** It was verified by
   construction on a scratch tree, not by the repository at `SOURCE_SHA`.
2. **The over-exclusion case from r3 [B1] is documented, not fixed.** A production `.json` reached
   only by a constructed path, whose basename an unrelated test names literally, is still excluded.
   The method now says so; D1b's `D1-exclusions.md` is where a reviewer would catch it. Making the
   method detect it is out of scope by **D-O** — it would be a new untested guarantee.
3. **`PLAN_SHA` in all five artifacts still points at `c842161`**, the freeze commit, not at
   `f2be4f2`, the approved amendment. Codex raised this as [S1]. **Deferred by Brent's decision on
   2026-08-12:** updating it would touch `SURFACE-SCHEMA.md` and `wordlist-passB.txt`, both
   explicitly out of scope this round, and would rehash two artifacts Codex has already passed —
   whose byte-identity is itself worth keeping. D1b.8 anchors integrity to D1a's merge commit, so
   provenance resolves there. Recorded as backlog in `LEDGER.md`, not silently dropped.
4. **D1b must derive the excluded-path list itself.** `census.sh` records ambiguous *keeps* only, per
   the round's scope. The standalone stage-two command already committed in `CENSUS-METHOD.md`
   produces the excluded set, so D1b.13 is reachable without another D1a round.

## Weakest part of this diff

The stderr channel. It is the right choice for keeping the reviewed stdout shape byte-identical, but
it is a weaker contract than a file: a D1b executor who runs `census.sh 2>/dev/null` — exactly what
this round's own test command does — silently discards the ambiguity record. `CENSUS-METHOD.md`
states that D1b must capture it, and D1b.13 requires the list, so the requirement is written down in
two places; nothing mechanically enforces it. A `D1b-verify.sh` assertion that the captured
ambiguity log exists would close that, and belongs to D1b.
