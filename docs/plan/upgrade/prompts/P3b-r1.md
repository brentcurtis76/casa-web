SESSION: UPGRADE · P3b · r1 · EXEC

You are the executor for UPGRADE (CASA · La Mesa Abierta · opt-out del plato
principal), phase **P3b**, round **1**. You have no prior context. Everything you
need is below or in the repo. Read this whole prompt before touching anything.

Repo: `/Users/brentcurtis/dev/casa-web`. Plan root: `docs/plan/upgrade/`.

---

## 0. PRECONDITION — CHECK THIS FIRST, BEFORE ANYTHING ELSE

P3b depends on P3a, whose branch must already be in `main`. Three executor sessions
died in this exact gate during P3a because they were dispatched before the merge
existed. Run this:

```bash
git fetch origin && git show origin/main:docs/plan/upgrade/PLAN.md | grep -c 'P3a | Seam.*DONE'
```

**If it prints `0`: STOP.** Do not create a branch, do not write code. Report
`STATUS: BLOCKED — P3a no está mergeada a main` and nothing else. This is the correct
outcome, not a failure.

**If it prints `1`:** continue. Also confirm the files you are about to edit exist:

```bash
ls supabase/functions/create-mesa-matches/handler.ts supabase/functions/create-mesa-matches/handler_test.ts
```

## BRANCH

`feat/mesa-md-core`, created from `main` **after** the check above passes:

```bash
git checkout main && git pull && git checkout -b feat/mesa-md-core
```

Commit as you go. Branch names in this repo are capped at 20 characters (Vercel DNS);
`feat/mesa-md-core` is 17. Do not rename it.

---

## 1. WHAT THIS PHASE IS

P3a cut a **seam**: it moved the whole `create-mesa-matches` request handler out of
`index.ts` into `handler.ts`, verbatim, with an injectable `pick`. It changed no
behaviour — Codex verified the move was 484 lines against 484 with only four lines
differing.

**P3b extracts the pure seating algorithm out of `handler.ts` into `matching.ts`.**
The seating loops — how many hosts to use, who sits with whom, the redistribution
pass, the waitlist — become a pure function. `handler.ts` keeps the HTTP guards, the
Supabase reads and writes, and the food assignment (food moves in P4, not here).

**Hard rule of this phase: the ten P3a goldens pass without modification.** That is
what makes the extraction verifiable. `git diff` on `handler_test.ts` must be empty.

This is a **refactor with zero behaviour change**. If you find yourself improving the
algorithm, you have left the phase.

## 2. FROZEN DECISIONS THAT BIND YOU

Copied from `docs/plan/upgrade/PLAN.md`. You may not violate these.

- **D11** — Pure modules never call `Math.random()`. Randomness enters only through an
  injected `pick(n)` returning an integer in `[0, n)`.
- **D13** — `index.ts` is a thin adapter; the logic lives in `handler.ts`; **the pure
  decision lives in `matching.ts`**. That last clause is this phase.
- **D8** — Gates are scoped to the files the phase touches. Details in §6.
- **D10** — All user-facing text in Spanish. (This phase adds none. `console.log`
  strings are operator logs, not user-facing: **move them verbatim, do not translate
  them**.)
- **D12** — No test touches the shared database, and no synthetic row is ever linked to
  `auth.users`. `matching.ts` is pure, so its tests need no double at all.

## 3. THE EXTRACTION — EXACT BOUNDARY

All line numbers are `supabase/functions/create-mesa-matches/handler.ts` at the tip of
`feat/mesa-md-seam` (536 lines). **Read the file before you cut.**

| Lines | What it is | Where it goes |
|---|---|---|
| 1–32 | header comment, `corsHeaders`, `SupabaseLike`, `HandlerDeps` | **stays** |
| 34–142 | `createHandler`, guard chain, month/idempotency/participants reads | **stays** |
| 143–167 | `hosts`/`guests` filter + the two `Response` guards for "no hosts"/"no guests" | **stays** (they build HTTP responses) |
| **169–360** | **the seating algorithm** | **→ `matching.ts`** |
| 362–526 | match/assignment inserts, participant updates, response, `catch` | **stays** |
| 528–536 | `shuffle` (Fisher–Yates over `pick`) | **→ `matching.ts`, exported** |

### 3.1 What the extracted block does, in order (169–360)

1. `shuffle` hosts and guests (170–171).
2. Capacity and people totals; a `console.warn` when capacity is short (176–185).
3. `MIN_PEOPLE_PER_DINNER = 5`, `TARGET_GUEST_SIDE_FOR_DINNER = 6` (188–192).
4. Build `hostStatus`: each host plus `currentGuests`, `currentGuestPeople`,
   `maxGuests`, `hostSidePeople`, `assignedGuests` (196–208).
5. Sort by capacity, then the greedy loop that picks `hostsToUse` (217–247).
6. Split into `activeHosts` / `waitlistHosts`; surplus hosts become guests (249–263).
7. **First pass**: assign each guest to the least-full host with a free slot (269–297).
8. **Second pass**: redistribute away from hosts under the minimum; a host that cannot
   be emptied stays as the "leftover" dinner (299–348).
9. Clear the waitlist hosts' assignments; recompute totals (350–360).

### 3.2 What the write path needs back

Everything after line 362 consumes exactly these, so your return value must carry them:

- `hostStatus` — iterated at `:370`, filtered at `:425`, flat-mapped at `:441`. Each
  element needs `id`, `assignedGuests`, `currentGuestPeople`, `hostSidePeople`.
- `unassignedGuests` — ids written to the waitlist at `:454`.

`activeHosts` and `waitlistHosts` are **views into the same objects** as `hostStatus`
(`.slice()` copies the array, not the elements) and the code mutates through them.
Preserve that aliasing or the redistribution results will not appear in `hostStatus`.
This is the single most likely way to break the goldens.

### 3.3 `shuffle` and the `pick` call sequence — READ THIS TWICE

`shuffle` is called **four kinds of times** per successful run, in this order:

1. `:170` `shuffle([...hosts], pick)` — moves to `matching.ts`
2. `:171` `shuffle([...guests], pick)` — moves to `matching.ts`
3. `:375` `shuffle([...foodAssignments], pick)` — **stays** (host food, per host)
4. `:399` `shuffle([...foodAssignments], pick)` — **stays** (guest food, per host)

So **both files need `shuffle`**. Export it from `matching.ts` and import it into
`handler.ts`. Do **not** duplicate the implementation — goldens 5 and 6 compare against
a `referenceShuffle` reimplementation in `handler_test.ts:85`, and two copies of the
real one would be free to drift apart.

**The number and order of `pick` calls must not change.** The goldens pin the food
rule as `referenceShuffle(FOODS, pick)[j % 4]`; anything that adds, removes or reorders
a `shuffle` call changes what the handler produces. Keep the four calls where they are.

### 3.4 Naming the types — this is what makes `matching.ts` clean

`matching.ts` may not import `@supabase/supabase-js`, so it cannot inherit the client's
typing: **it has to declare its own input types.** That is not extra work bolted on, it
is what D1e requires, and it is why the diagnostics inside the moved block disappear
instead of travelling with it.

`handler_test.ts:28` already declares the exact shape the tests feed in — use it:

```ts
interface Participant {
  id: string;
  month_id: string;
  role_preference: "host" | "guest";
  has_plus_one: boolean;
  host_max_guests: number | null;
  status: string;
}
```

The production rows carry more columns (`select("*")`), so type the *input* as what the
algorithm actually reads, not as the whole table. `_shared/mainDish.ts` is the
established pattern in this repo for a pure module that names its inputs (`Carrier`,
`TableInput`) — read its first 60 lines and match its style. It measures
`(0)(0)(0)(0)` on the gate; so should yours.

In `handler.ts`, the values coming back from Supabase are `any`. Passing them into a
typed function is legal and needs no cast. If you do use one cast to type
`participants` at the boundary, document it in one line — do not scatter `any`.

## 4. SCOPE

**Files you may touch — exactly three:**

- `supabase/functions/create-mesa-matches/matching.ts` — **new**
- `supabase/functions/create-mesa-matches/matching_test.ts` — **new**
- `supabase/functions/create-mesa-matches/handler.ts` — delegate to `matching.ts`

Plus your own entry appended to `docs/plan/upgrade/LEDGER.md`.

## 5. EXPLICITLY OUT OF SCOPE

- **`handler_test.ts` — do not open it to edit it.** `git diff` on it must be empty
  (D4e). Read it if you need to understand the goldens; changing it is a phase failure.
- **`index.ts`** — P3a left it a 21-line adapter. It stays as it is.
- **`index 2.ts`** — a shadow file. The plan's non-goals forbid touching it.
- **Food assignment.** `foodAssignments`, the two food `shuffle` calls and the
  `host_food_assignment` write stay in `handler.ts`. P4 moves them.
- **The main-dish opt-out.** No `can_bring_main_dish`, no `mainDish.ts` import, no
  quota, no shortfall. That is P4. `matching.ts` in this phase knows nothing about food.
- **Improving the algorithm.** The greedy loop, the sorts, the redistribution and the
  `MIN_PEOPLE_PER_DINNER = 5` heuristics are moved as they are, bugs included.
- **The residual diagnostics in `handler.ts`'s write path** (`:26` `no-explicit-any`,
  `:467` `count` unused, `:520` `TS18046`). Backlog B-08 owns them; P4 is their phase.
  If some of them vanish as a side effect of your typed return value, that is fine and
  expected — see §6. Do not go hunting for them.
- No migration, no `apply_migration`, no `execute_sql`, no `functions deploy`.

## 6. THE GATE — MEASURED BASELINE, DO NOT RE-DERIVE IT

I measured all of this myself on `feat/mesa-md-seam`@`5a0bf59` (Node v22.22.0). Compare
against these numbers; if your parent measurement disagrees, say so in the report
instead of adjusting silently.

**Deno suite:** `cd supabase/functions && deno test --allow-all --no-check .` →
**438 passed / 0 failed**. Your target is **446 / 0** (+8).

> `--no-check` is deliberate and was decided mid-P3a with a Decision Log row: `deno test`
> type-checks its import graph, which duplicates step 4 of the gate below and, while any
> imported file carries pre-existing diagnostics, *refuses to run the suite* instead of
> reporting failures. Type coverage is not reduced — `deno check .` still walks the whole
> tree including `_test.ts` files. **Do not "fix" this by dropping `--no-check`.**

**Per-file diagnostics** — run the committed gate script, which prints raw messages per
file for tsc / ESLint / `deno lint` / `deno check`:

```bash
bash scripts/gates/changed-files-diagnostics.sh supabase/functions/create-mesa-matches/handler.ts supabase/functions/create-mesa-matches/matching.ts supabase/functions/create-mesa-matches/matching_test.ts
```

`handler.ts` baseline is **`(tsc 0)(eslint 1)(deno lint 2)(deno check 8)`**:

| Tool | Line | Message | Inside the moved block? |
|---|---|---|---|
| eslint | `:26` | `no-explicit-any` on `SupabaseLike` | no — stays |
| deno lint | `:192` | `TARGET_GUEST_SIDE_FOR_DINNER` is never used | **yes — moves** |
| deno lint | `:467` | `count` is never used | no — stays |
| deno check | `:520` | TS18046 `'error' is of type 'unknown'` | no — stays |
| deno check | `:333` | TS7006 `g` implicitly any | **yes — moves** |
| deno check | `:144`, `:145` | TS7006 `p` implicitly any | frontier |
| deno check | `:400` ×2, `:419`, `:441` | TS7006 `guest`, `j`, `g`, `g` | no — write path |

**The rule (D8.4): zero NEW diagnostics. Removals are allowed and welcome.**

Concretely, what I expect to happen and why you should not be alarmed by it: once
`matching.ts` names its types and returns a typed `hostStatus`, the write path's
`host.assignedGuests.map(...)` callbacks at `:400`, `:419` and `:441` stop being
implicit `any` **on their own**. `handler.ts` should therefore come out *below* its
baseline. That is a pass, not a deviation. What is BLOCKING is any message that was not
there before.

**Targets:**
- `matching.ts` → `(0)(0)(0)(0)`, except that if you move
  `TARGET_GUEST_SIDE_FOR_DINNER` verbatim (you should — it documents the heuristic) it
  brings its `no-unused-vars` with it. **Declare that one as a displacement**, quoting
  the identical message. One displaced diagnostic, nothing else.
- `matching_test.ts` → `(0)(0)(0)(0)`. No exceptions; it is a new file you wrote.
- `handler.ts` → **no message that is not in the table above.** Fewer is fine.

**Build:** `npm run build` → exit 0.

**Vitest:** `npx vitest run --no-file-parallelism`. This phase touches no file Vitest
covers, so the count should not move. Report what you get. Known noise, already
triaged, do **not** chase any of it: 6 failures in `MesaAbiertaDashboard.test.tsx`
(the declared base until P8); 3 flaky `CuentacuentoEditor.ph.*` files under load
(B-05); and 8 `usePresentationState` failures from a missing `localStorage` that appear
in some checkouts and not others (B-10). If you see a red **outside** those and outside
your three files, re-run the suite on the parent commit — if it reproduces there, it is
pre-existing; note it and move on.

## 7. ACCEPTANCE CRITERIA — verbatim from PLAN.md, with how to check each

- **[D1e]** `matching.ts` imports neither `@supabase/supabase-js` nor uses `Deno.env`.
  → `grep -cE "supabase-js|Deno\.env" supabase/functions/create-mesa-matches/matching.ts` → `0`
- **[D2e]** No `Math.random()` in `matching.ts` (D11).
  → `grep -c "Math\.random" supabase/functions/create-mesa-matches/matching.ts` → `0`
  Note `handler.ts` keeps its `pick` default `?? ((n) => Math.floor(Math.random() * n))`
  at `:38` — that is the composition root and stays.
- **[D3e]** `handler.ts` no longer contains the seating loops.
  → `grep -c "hostsToUse" supabase/functions/create-mesa-matches/handler.ts` → `0`
- **[D4e]** `git diff` on `handler_test.ts` is **empty**.
  → `git diff --stat main..HEAD -- supabase/functions/create-mesa-matches/handler_test.ts`
  prints nothing.
- **[D5e]** The 8 new tests pass; `deno test --allow-all --no-check .` → **446 / 0**.
- **[D6e]** Gate D8 over `F` = the three files (§6). `npm run build` exit 0.

## 8. TESTS YOU MUST WRITE — 8, in `matching_test.ts`

Use these names. They are fixed by the plan's test plan; keep them in Spanish to match
the P3a goldens.

1. `determinista para pick fija` — same input + same `pick` → identical result twice.
2. `capacidad en unidades` — a guest with `+1` consumes **one** slot, not two.
3. `el +1 del anfitrión no consume cupo` — host-side `+1` sits on the host side and
   leaves `maxGuests` untouched.
4. `anfitriones sobrantes → invitados` — hosts beyond `hostsToUse` are converted and
   seated as guests, and their own `assignedGuests` end up empty.
5. `se elige el mayor número de anfitriones que cumple el mínimo` — the greedy loop
   picks the largest `numHosts` satisfying both conditions, not the first that fits.
6. `el segundo pase redistribuye` — a host under `MIN_PEOPLE_PER_DINNER` is emptied
   into hosts with spare slots, and no guest ends up in two dinners.
7. `la última mesa puede quedar bajo el mínimo` — when redistribution cannot place
   everyone, the leftover host keeps its guests. This is intended behaviour, not a bug.
8. `el plan incluye la lista de espera` — guests with no seat come back in the
   unassigned list.

Assert on returned values. `matching.ts` is pure: **no Supabase double, no `fetch`, no
fixtures linked to `auth.users`** — that is the whole point of extracting it.

Test 6 is the one that catches the aliasing mistake in §3.2. Write it early.

**TEST COMMAND (verbatim):**

```
cd supabase/functions && deno test --allow-all --no-check .
```

## 9. RULES

- Surgical changes only. No bulk edits. Match the surrounding style.
- **Move the code, don't rewrite it.** Comments and `console.log` strings travel
  verbatim with the block they document. The reviewer will diff the moved block against
  `handler.ts` at `5a0bf59`; the closer that diff is to "same lines, new home", the
  cheaper this phase is. P3a passed Codex with zero findings precisely because that
  comparison was mechanical.
- Do not grade your own work in prose. Show the diff and the raw test output.
- If tests are red, iterate up to **3** times. If still red, report `STATUS: BLOCKED`
  with the real error. Never report a red build as complete.
- **If you discover the plan is wrong** — the boundary doesn't cut cleanly, the goldens
  can't pass without touching `handler_test.ts`, a criterion contradicts another —
  **stop coding and report `STATUS: FINDINGS`** with what you found and what you would
  propose. This is the correct outcome, not a failure. P3a's executor did exactly this
  and it was the right call. Do not work around a broken plan, and do not change a
  frozen criterion on your own authority.
- Do not expand scope. If something out of scope is broken, note it under NOT DONE.

## 10. WHEN DONE

Append your round entry to `docs/plan/upgrade/LEDGER.md` (append **only**; never
reflow, reorder or edit anyone else's entries — the file is shared and append-only),
then output exactly this report:

```markdown
## EXECUTOR REPORT — P3b round 1
STATUS: COMPLETE | BLOCKED | FINDINGS
CONTEXT PRESSURE: comfortable | tight | ran out — <one line: at what point?>
BRANCH: <branch>   COMMITS: <sha…>
FILES CHANGED: <path (+x/-y) …>
WHAT I DID: <bullets, one per acceptance criterion, mapped to D1e…D6e>
TEST COMMAND: <verbatim>
TEST OUTPUT: <verbatim tail, unedited>
GATE TABLE: <per-file (tsc)(eslint)(deno lint)(deno check) for the three files,
             each difference vs. the baseline in §6 classified as
             displacement or new>
ACCEPTANCE CRITERIA: <D1e…D6e: met / not met / partially — with reason>
DEVIATIONS FROM PROMPT: <or "none">
ASSUMPTIONS MADE: <or "none">
NOT DONE / OPEN:
```
