SESSION: TYPECHECK-GATE · REVIEW

Independent review of the branch `fix/typecheck-gate` (head `d5f61c0`, 3 commits off `main`
at `db8ed2e`). You have final say on BLOCKING items. This does not merge until you pass it.

Repo: `/Users/brentcurtis/dev/casa-web`, git common dir `/Users/brentcurtis/dev/casa-web/.git`.
The branch is checked out in the worktree
`/Users/brentcurtis/dev/casa-web/.claude/worktrees/great-fermi-33af52` — use that one.

```bash
cd /Users/brentcurtis/dev/casa-web/.claude/worktrees/great-fermi-33af52 && git log --oneline main..HEAD
```

Read `docs/plan/TYPECHECK-TRIAGE-db8ed2e.md` (added by this branch) first. It is the full
write-up and it is what you are auditing.

## Background

`npx tsc --noEmit` was listed in `CLAUDE.md` as a required Quality Gate and used as a gate in
many phase test plans. It type-checks **zero** files and exits 0 in ~0.4s: the root
`tsconfig.json` is solution-style (`"files": []` + `references`), plain `tsc` honours
`files: []` and does not traverse project references. Every "tsc passed, base is clean" claim
in this repo's plans and phase reviews is therefore vacuous. This branch replaces the gate,
triages what the real gate finds, and fixes nothing in `src/`.

## What shipped

Zero changes under `src/`. Eleven files:

- `package.json` — new `"typecheck": "tsc -b --force --noEmit"`; `typescript` floor `^5.5.3` → `^5.6.0`
- `package-lock.json` — one line, the recorded range; still resolves 5.9.3
- `CLAUDE.md` — Quality Gates names `npm run typecheck`, explains why bare `tsc` is vacuous, marks the gate KNOWN-RED at 1,039
- `.claude/agents/{developer,pm}.md`, `.claude/skills/pipeline-{context,dev,qa}.md`, `.skills/skills/casa-project/SKILL.md`, `docs/OPERATING_PROCEDURES.md` — the vacuous command replaced with `npm run typecheck`
- `docs/plan/TYPECHECK-TRIAGE-db8ed2e.md` — the triage

Measured on the branch: `npm run typecheck` → **exit 2, 1,039 errors, 120 files, ~23s**.

## Known gaps and weak spots — I am telling you rather than letting you find them

**1. THE FIX IS STILL INCOMPLETE AND I DID NOT CLOSE IT.** `CLAUDE.md` states that pipeline
agents live in `~/SecondBrain/pipeline/agents/` and are the single source of truth ("Do NOT
copy pipeline agents or router config into this repo"). Those files **still contain the
vacuous command**:

```
~/SecondBrain/pipeline/agents/dev.md:52    - TypeScript check: `npx tsc --noEmit`
~/SecondBrain/pipeline/agents/dev.md:172   [actual output of npx tsc --noEmit]
~/SecondBrain/pipeline/agents/qa.md:78     npx tsc --noEmit       # TypeScript check
~/SecondBrain/pipeline/agents/qa.md:133    $ npx tsc --noEmit
```

`~/SecondBrain/pipeline/pipeline-orchestrator.md:153` confirms the orchestrator reads
`pipeline/agents/pm.md` etc. from there. So **any bridge task still runs the vacuous gate**,
whatever this branch says. I deliberately did not edit SecondBrain: it is outside this repo,
those agents are shared across projects, and `npm run typecheck` does not exist in all of
them — so a blind substitution would break other projects. Rule on whether this branch can
merge with that gap open, and on what the correct cross-project fix is (per-project gate
lookup? a `typecheck` script convention enforced everywhere? something else?).

**2. The `--force` flag is justified by an argument I did not actually prove.** `CLAUDE.md`
claims `--force` means "the gate can never report a stale PASS". What I actually observed is
weaker: plain `tsc -b --noEmit` re-reported all 1,039 errors on a second consecutive run, so
the cache did **not** mask anything in the one case I tested. The `--force` justification is
therefore theoretical, and it costs ~23s on every run versus an incremental rebuild. Decide
whether `--force` is sound engineering or cargo cult, and whether "can never" is a defensible
word in a normative document on the evidence given.

**3. The whole review that produced commit `d5f61c0` was self-review.** Three findings
(propagation to agent files, the TS ≥ 5.6 floor, a wrong file count) were found by me, on my
own diff, with no independent pass. Assume the same blind spots persist and look for a fourth.

**4. Every triage number is a prediction, not a result.** The headline claim — "638 of 1,039
(61%) are one stale generated file" — comes from a regex classifier I wrote over the compiler
output (`SelectQueryError`, `mesa_abierta_`, table-name-in-`never` signatures), **not** from
regenerating the types and re-counting. Nothing was fixed, so nothing is verified. In
particular:
   - Group C (41 × TS2589 "excessively deep") is attributed to the same Supabase cause with
     the word "likely". That is a guess.
   - The step table in §5 promises −638 from one regeneration. If you think that number
     should not be in a document until someone has actually run the regeneration on a scratch
     branch and re-counted, say so — I think you may be right.

**5. Check my classifier for double-counting and misattribution.** It assigns each error block
to exactly one group by first-match precedence: dead-duplicate-file → Supabase → TS2589 →
framer-motion → `ringColor` → other. That precedence is a judgement call and it is load-bearing
for every percentage in §4. An error in a duplicate file that is *also* a Supabase error counts
as duplicate-file, not Supabase. Decide whether the grouping misleads.

**6. The deletion recommendation touches 18 git-tracked files and I have not executed it.**
`docs/plan/TYPECHECK-TRIAGE-db8ed2e.md` §Grupo E recommends `git rm` on 18 Finder-duplicate
files (`PresenterView 4.tsx`, `types 2.ts`, `setup 2.ts`, …), worth 134 errors. My evidence
that they are dead is a basename grep plus the absence of `import.meta.glob`/`require.context`
anywhere in `src/`. I confirmed `vitest.config.ts:10` loads only `./src/test/setup.ts` and
that `src/test/setup 2.ts` is byte-identical to it. Verify independently; a wrong call here
deletes real code.

## Also worth your attention

- **`CLAUDE.md` now says a phase must "record it as KNOWN-RED with the current count and
  confirm the count did not increase" — but names no command for counting and no per-file
  baseline.** A phase that legitimately touches `src/` can move that number in either
  direction. Is this protocol actually operable, or is it a rule that will be quietly ignored?
- **There is no CI workflow and no git hook in this repo** (no `.github/workflows`, no
  `.husky`). Every gate is run by a human or an agent reading a markdown file. Nothing
  mechanically prevents this drifting back. I proposed adding CI but did not, because it would
  go red immediately at 1,039.
- **`src/types/shared/index.ts:9` (TS2308, ambiguous `SongTempo` re-export) is a real
  ambiguity that predates this branch** and may already be changing which type wins at
  runtime for consumers. It is filed in the long tail; check whether it deserves to be.
- **`.skills/skills/genera-project/SKILL.md:48` was deliberately left on the old command** —
  different project, own TypeScript config. Confirm that was right.

## Reproduce everything

```bash
cd /Users/brentcurtis/dev/casa-web/.claude/worktrees/great-fermi-33af52
git checkout fix/typecheck-gate

# the vacuous gate
npx tsc --noEmit --listFiles | wc -l          # -> 0
npx tsc --noEmit; echo "exit=$?"              # -> exit=0

# the real gate
npm run typecheck > /tmp/tc.txt 2>&1; echo "exit=$?"          # -> exit=2
LC_ALL=C grep -cE '^[^ ].*\([0-9]+,[0-9]+\): error TS' /tmp/tc.txt   # -> 1039
LC_ALL=C grep -oE '^[^ (]+\([0-9]+,[0-9]+\)' /tmp/tc.txt | sed 's/(.*//' | sort -u | wc -l  # -> 120

# coverage claim in CLAUDE.md:86
npx tsc -p tsconfig.app.json --noEmit --listFiles 2>/dev/null \
  | LC_ALL=C grep "^$PWD/src/" | LC_ALL=C grep -vc node_modules   # -> 677

# the TS floor
npx -y -p typescript@5.5.3 tsc -b --force --noEmit; echo "exit=$?"
# -> error TS5094: Compiler option '--noEmit' may not be used with '--build'.  exit=1

# does -b really check BOTH projects when the first is red?
cp vite.config.ts /tmp/v.bak
printf '\nconst __probe: number = "no";\n' >> vite.config.ts
npm run typecheck 2>&1 | grep vite.config    # -> reported; total goes 1039 -> 1040
cp /tmp/v.bak vite.config.ts
```

Note: `grep` and `find` are zsh functions in this environment; call `/usr/bin/grep` with
`LC_ALL=C` if your counts do not reproduce.

## What I want back

A verdict of **PASS** or **BLOCKING**, and for each item above either a confirmation or a
correction. Rank anything you add by whether it lets a vacuous or wrong gate reach a phase
review — that is the failure this branch exists to prevent, and item 1 says it is not
prevented yet.

Do not fix anything. Report only. Do not merge to `main`.
