# Base gate baseline — `pilot/sop-v2` @ `d5df247`

Recorded 2026-08-12 by the D1b-1 PM bootstrap, under the lean overlay §5 rule that a red
required gate must be reproduced on the phase's **base** before any executor is asked to
guess whether it is a branch regression.

- BASE SHA: `d5df2476967f81e841792abf0c68ec33fd3ac8a8` (`pilot/sop-v2`)
- CHECKOUT: `/Users/brentcurtis/dev/casa-pilot`
- OS: macOS Darwin 24.3.0 · LOCALE: `en_US.UTF-8` · `node --version` -> `v22.22.0`
- `npx tsc --version` -> `Version 5.9.3`
- `node_modules` present (360 entries); no `npm ci` needed at this SHA.

---

## Finding: `npx tsc --noEmit` type-checks ZERO files in this repository

The root `tsconfig.json` is a **solution file**: `"files": []` plus two project
`references`. Plain `tsc --noEmit` honours `files: []`, compiles nothing, and exits 0. It
does not traverse the references — that requires `tsc -b`.

```bash
cd /Users/brentcurtis/dev/casa-pilot
npx tsc --noEmit --listFiles | /usr/bin/wc -l
#        0

npx tsc -b --dry | head -5
# A non-dry build would build project '/Users/brentcurtis/dev/casa-pilot/tsconfig.app.json'
# A non-dry build would build project '/Users/brentcurtis/dev/casa-pilot/tsconfig.node.json'
```

`npx tsc --noEmit` completed in **0.40 s wall / 0.16 s user**. A 665-file check takes ~22 s
(below). The runtime alone was the tell.

**Consequence for this workstream:** every `npx tsc --noEmit; echo $? # -> 0 (clean base)`
recorded in `PLAN.md` "Verified current state", in D1a's test plan, and in D1b's test plan is
a **vacuous pass**. It never demonstrated a clean base and it cannot "catch a source file
leaked into the diff", which is the job `PLAN.md` assigns it. That job is done directly, and
deterministically, by the diff-confinement assertion (D1b.9) — see the amended D1b test plan.

## The real type check, and its base result

```bash
cd /Users/brentcurtis/dev/casa-pilot
npx tsc -p tsconfig.app.json --noEmit
```

- Files actually checked under `src/`: **665**
- Result: **FAIL** — **1,039 errors** across **122 distinct files**
- Wall time: ~22 s

Counted with:

```bash
npx tsc -p tsconfig.app.json --noEmit 2>&1 \
  | /usr/bin/grep -cE '^[^ ].*\(([0-9]+),([0-9]+)\): error TS'
#     1039
```

Representative failures, verbatim:

```text
src/types/shared/index.ts(9,1): error TS2308: Module './song' has already exported a member
  named 'SongTempo'. Consider explicitly re-exporting to resolve the ambiguity.
src/pages/SermonEditorPage.tsx(145,9): error TS2322: Property 'description' does not exist on
  type 'IntrinsicAttributes & AdminPageHeaderProps'.
src/pages/RecorderPopupPage.tsx(463,15): error TS2769: Argument of type
  '"church_leadership_recording_sessions"' is not assignable to parameter of type 'never'.
```

The third class is a stale generated Supabase type union — the table exists in the database
but not in the checked-in `Database` type. It is repository debt, unrelated to BILINGUE.

## Classification

This is a **base-red** condition under lean overlay §5, not a D1b-1 regression. D1b-1's source
diff is zero lines by frozen decision **D-A**, so it cannot cause, worsen, or fix any of the
1,039 errors.

Per §5 this is routed to a **bounded stabilization phase**, not absorbed into D1b-1's scope,
and it is **not** relabelled `PASS`. D1b-1's required gates are the ones in its own test plan;
`tsc` is not among them, and the reason is recorded here rather than left for each executor to
rediscover.

## Reuse rule

This baseline may be reused only while `d5df247`, `package-lock.json`, and the Node/TypeScript
versions above are unchanged. Re-measure otherwise.

## Blind spot

`tsconfig.node.json` was not separately measured; only `tsconfig.app.json` was. Neither
`npm run lint`, `npm test`, nor `npm run build` was run at this SHA — `docs/plan/SOP-PILOT.md`
on `pilot/lean-v2` records those as red at `d5b16e8` (a different commit, the `main`
worktree), and this phase does not require them.
