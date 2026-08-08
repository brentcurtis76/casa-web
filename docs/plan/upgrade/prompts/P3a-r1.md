SESSION: UPGRADE · P3a · r1 · EXEC

You are the executor for **UPGRADE** (La Mesa Abierta · opt-out del plato principal), phase
**P3a — Seam: `handler.ts` en `create-mesa-matches`**, round **r1**. You have no prior
context. Everything you need is below or in the repo.

**The plan calls this the highest-risk session in the workstream.** Not because the thinking
is hard — it is a *move*, not a redesign — but because the file is 512 lines of untyped
matching logic, the tests need a Supabase double that does not exist yet, and the phase
promises **identical behaviour**. The whole value of P3a is that a reviewer can diff the moved
block and see nothing changed. Read the section **"THE ONE RULE THAT DECIDES THIS PHASE"**
before you write a line.

BRANCH: `feat/mesa-md-seam` — **does not exist yet**. Create it from **`main` with P2 already
merged in**:

```bash
cd /Users/brentcurtis/dev/casa-web        # or your own worktree of this repo
git fetch origin && git checkout main && git pull --ff-only
grep -c 'P2 | Módulo puro de asignación.*DONE' docs/plan/upgrade/PLAN.md   # must print 1
git checkout -b feat/mesa-md-seam
```

**That `grep` is a hard precondition, not a formality.** If it prints `0`, P2 has not been
merged yet — **stop and report `STATUS: BLOCKED`, one line, before doing anything else.**

Reason, and it is the same one that gated P2 behind P1: P2 is finished (Codex PASS) and
awaiting merge on `feat/mesa-md-alloc`, and that branch carries **five ledger entries plus
this prompt**. If you branch from a `main` without them and then append your own entry to
`docs/plan/upgrade/LEDGER.md`, the two branches fork the ledger and the merge conflicts. That
has already cost this workstream seven lost entries once (backlog **B-02**). P3a does not
depend on P2's *code* in any way — the dependency is purely about not forking the ledger.

Second check, cheap and worth it — confirm you are on the parent the gate numbers below were
measured on:

```bash
npx tsc -p tsconfig.app.json --noEmit | grep -c "error TS"    # must print 1039
```

**Never merge to `main`. Never push to `main`.** Push your own branch when you are done.

> If you are working in a git worktree, run `npm ci` first — a fresh worktree has no
> `node_modules`, and the gate will (correctly) exit 1 until it does.
> Use **Node v22.22.0** for Vitest and the gate. The baselines below were measured there, and
> a newer Node produces a different result — Codex hit exactly that in the P1 review.
> Note: `/Users/brentcurtis/dev/casa-web` itself is currently on `phase/E-infra-impl`
> (workstream **AUDIO**) with unrelated work in it. Do not disturb it — use a worktree, or
> check out `main` somewhere of your own.

---

## THE ONE RULE THAT DECIDES THIS PHASE

**Move the code. Do not improve it.**

You are cutting ~470 lines out of `index.ts` and pasting them into `handler.ts`. Inside that
moved block, the only edits allowed are the four mechanical ones listed in
**"THE FOUR EDITS YOU MAY MAKE"** below. Nothing else. Not a rename, not a type annotation,
not a tidied comment, not a fixed lint warning — **even though you will see several and they
will be tempting.**

Why this is not pedantry: the phase's hard rule is *conducta idéntica*, and the only practical
way anyone can verify that is to diff the moved block against the original and see it
unchanged. If you also fix eight diagnostics while moving it, the diff becomes unreadable and
"identical behaviour" stops being checkable at all. A clean move is what makes this phase
reviewable. The diagnostics are already logged as backlog **B-08** for a later phase — they
are not your job, and leaving them is the *correct* outcome, not a shortcut.

This is also the SOP's standing rule ("do not refactor adjacent code, do not improve while
you're in there"), but here it is load-bearing rather than housekeeping.

---

## WHAT YOU ARE BUILDING

Three files, `F` for the gate:

1. `supabase/functions/create-mesa-matches/handler.ts` — **new**. `createHandler(deps)` with
   an injectable `pick`. All request logic.
2. `supabase/functions/create-mesa-matches/index.ts` — **shrinks to a thin adapter** (D13).
   Env, dependencies, `serve`. Nothing else.
3. `supabase/functions/create-mesa-matches/handler_test.ts` — **new**. 10 goldens.

Nothing else. In particular:

- **Do not touch `supabase/functions/_shared/testHelpers.ts`.** The Supabase double goes
  *inside* `handler_test.ts`. Putting it in `_shared/` would make `F` four files and change a
  file six other suites depend on.
- **Do not touch `supabase/functions/create-mesa-matches/index 2.ts`.** Yes, it is real, it is
  tracked, and it is a stale duplicate of an older version of this function carrying five
  diagnostics of its own. It is not yours to delete — that is a separate decision. Leave it
  exactly as it is and do not import from it.

---

## THE HOUSE PATTERN — already used by five functions in this repo

**You are not inventing this seam.** `generate-oraciones`, `generate-story`,
`generate-scene-images`, `refine-story` and `process-reflexion-pdf` already have exactly this
split — `handler.ts` + a thin `index.ts` + `handler_test.ts`. Match them.

`supabase/functions/generate-oraciones/index.ts` — the whole file, 27 lines, your template:

```ts
/**
 * CASA Oraciones Antifonales Generator Edge Function
 * ...
 * This file is the production entrypoint: it reads env vars, builds
 * dependencies, and starts the HTTP server. All request logic lives in
 * `handler.ts` so tests can import the handler without side effects.
 */

import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

import { createSupabaseAuthzDeps } from "../_shared/liturgyAuth.ts";
import { createHandler } from "./handler.ts";

const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const authzDeps = createSupabaseAuthzDeps(supabaseAdmin);

serve(createHandler({ anthropicApiKey, authzDeps }));
```

And the shape `handler.ts` exports, from `process-reflexion-pdf/handler.ts`:

```ts
export const corsHeaders = { /* ... */ };

export interface HandlerDeps { /* ... */ }

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> { ... }
```

**Use the import-map specifiers, not raw URLs.** `supabase/functions/import_map.json`:

```json
{
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2.38.4",
    "std/http/server.ts": "https://deno.land/std@0.168.0/http/server.ts",
    "@std/assert": "https://deno.land/std@0.224.0/assert/mod.ts"
  }
}
```

Today `create-mesa-matches/index.ts` imports those two by full URL, which is why it carries
two `no-import-prefix` lint errors. Writing the new `index.ts` against the import map removes
them. That is a *removal*, which the gate allows and welcomes — see the diagnostics section.

Your `HandlerDeps` should be:

```ts
// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

export interface HandlerDeps {
  supabase: SupabaseLike;
  /** Returns an integer in [0, n). Defaults to Math.random (D11). */
  pick?: (n: number) => number;
}
```

**That `// deno-lint-ignore no-explicit-any` comment is required.** `_shared/adminAuth.ts`
already does exactly this, for the same reason (staying compatible across supabase-js versions
imported by different functions). Without the ignore you introduce a brand-new
`no-explicit-any` diagnostic in `handler.ts` and fail your own gate.

---

## THE SOURCE YOU ARE SPLITTING

`supabase/functions/create-mesa-matches/index.ts`, 512 lines. Read it in full before you
start. The structure, with current line numbers:

| Lines | What |
|---|---|
| 1–3 | imports: `serve`, `createClient`, `requireMesaAdmin` |
| 5–9 | `corsHeaders` |
| 11–14 | **guard: OPTIONS** → 200 `"ok"`, before anything else |
| 17–21 | env reads + `createClient` — **this is the only part that stays in `index.ts`** |
| 23–24 | **guard: `requireMesaAdmin`** → returns `authResult.response` on failure |
| 26 | `await req.json()` — **after** the auth guard, deliberately |
| 28–36 | guard: `monthId` required → 400 |
| 41–49 | read month `.single()`; not found → `throw` |
| 51–59 | **guard: `month.status !== "open"`** → 400 |
| 61–72 | **guard: `registration_deadline` still in the future** → 400 |
| 75–92 | **guard: idempotency** — existing matches for the month → 400 |
| 98–116 | read participants (`pending`, `confirmed`); none → 400 |
| 121–144 | split hosts/guests; neither empty → 400 |
| 147–148 | `shuffle([...hosts])`, `shuffle([...guests])` ← **first `pick` calls** |
| 153–199 | capacity and people arithmetic |
| 204–222 | greedy `hostsToUse` loop |
| 228–240 | `activeHosts` / `waitlistHosts`; excess hosts converted to guests |
| 250–272 | first pass: assign guests to hosts |
| 278–325 | second pass: redistribute away from under-minimum dinners |
| 329–336 | clear waitlist hosts; recompute `guestsAssignedCount` |
| **343** | `try {` — **the write boundary. Everything above is reads only.** |
| 345 | `const foodAssignments = ["main_course", "salad", "drinks", "dessert"]` |
| 352–353 | `shuffle([...foodAssignments])[0]` → host's food |
| **355–366** | **first write**: `INSERT mesa_abierta_matches` |
| 376–385 | `shuffle([...foodAssignments])` then `[j % length]` per guest; `INSERT` assignments |
| 402–441 | `UPDATE` participants: hosts, guests, waitlist |
| 444–452 | `UPDATE` month status → `matched`, optimistic lock on `status = "open"` |
| 457–468 | inner `catch`: rollback — `DELETE` created matches |
| 470–491 | 200 response |
| 492–501 | outer `catch` → 500 |
| 505–512 | `function shuffle<T>(array: T[]): T[]` — Fisher–Yates |

**Everything from line 11 to line 501 moves to `handler.ts`, plus `corsHeaders` and
`shuffle`.** What stays in `index.ts` is lines 17–21 (env + client) and a `serve(...)` call.

### The guard order you must preserve (C5)

`OPTIONS` → `requireMesaAdmin` → `req.json()` → `monthId` → month exists → **status open** →
**deadline passed** → **idempotency** → participants. Every one of them returns before line
355, the first write. Tests 1–4 and 10 pin this down.

`requireMesaAdmin` comes from `../_shared/adminAuth.ts` — **do not change it, do not copy it.**
Its contract, for writing the tests:

```ts
export async function requireMesaAdmin(
  req: Request,
  supabaseAdmin: SupabaseAdminLike,
  corsHeaders: Record<string, string>,
): Promise<AdminAuthResult>   // { ok: true; user } | { ok: false; response }
```

It (a) 401s when there is no `Authorization` header, (b) calls
`supabaseAdmin.auth.getUser(token)` and 401s on error/no user, (c) queries
`.from("mesa_abierta_admin_roles").select("role").eq("user_id", user.id).single()` and 403s
when there is no row. Your double drives all three. Pass the injected `deps.supabase` straight
through to it.

---

## THE FOUR EDITS YOU MAY MAKE

Inside the moved block, exactly these and nothing else:

1. **Wrap it in the factory.** `serve(async (req) => { ... })` becomes
   `export function createHandler(deps: HandlerDeps) { return async (req: Request): Promise<Response> => { ... } }`.
2. **Take the client from deps instead of env.** Lines 17–21 leave the handler; inside, use
   `deps.supabase` wherever `supabase` was.
3. **Inject `pick` into `shuffle`.** See below.
4. **Add the `deno-lint-ignore` comment** on the `SupabaseLike` alias, as shown above.

### Edit 3 in full — the `pick` injection (D11)

`pick(n)` returns an integer in `[0, n)`. Current `shuffle`:

```ts
function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
```

`Math.floor(Math.random() * (i + 1))` yields an integer in `[0, i+1)`. So `pick(i + 1)` is the
**exact** substitution — same range, no off-by-one:

```ts
function shuffle<T>(array: T[], pick: (n: number) => number): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
```

And the default, which is what makes C2 true:

```ts
const pick = deps.pick ?? ((n: number) => Math.floor(Math.random() * n));
```

`shuffle` is called **four times** per successful request: hosts (147), guests (148), host food
per match (352), guest food per match (376). The last two run once *per host*, so the number of
`pick` calls depends on the fixture. That matters for your tests — see below.

---

## THE SUPABASE DOUBLE (D12)

**There is no query double in this repo. You are writing the first one.** I checked:
`_shared/testHelpers.ts` has auth-deps fixtures (`makeAuthzDeps`), an `AUTH_HEADER`, a `fetch`
spy, log capture and image byte fixtures — **no query builder**. `wa-webhook`'s `makeSupabase()`
is a real client factory, not a double. The six existing `handler_test.ts` suites all test
functions whose dependency is an *authz backend* or the *network*, never the database. So there
is nothing to copy; build it in `handler_test.ts`.

**Never touch the real database, and never link synthetic rows to `auth.users` (D12).** The
double is in-memory and that is the whole point.

Exact call shapes the handler makes — build for these and no more:

*Reads*
```
.auth.getUser(token)                                                    -> { data: { user }, error }
.from("mesa_abierta_admin_roles").select("role").eq(..).single()        -> { data }
.from("mesa_abierta_months").select("*").eq("id", id).single()          -> { data, error }
.from("mesa_abierta_matches").select("id").eq("month_id", id)           -> { data, error }   (awaited directly)
.from("mesa_abierta_participants").select("*").eq(..).in("status", [..])-> { data, error }   (awaited directly)
```

*Writes — none of these may run in tests 1–4 or 10*
```
.from("mesa_abierta_matches").insert({..}).select().single()            -> { data, error }
.from("mesa_abierta_assignments").insert([..])                          -> { error }
.from("mesa_abierta_participants").update({..}).in("id", ids)           -> { error }
.from("mesa_abierta_months").update({..}).eq("id",id).eq("status","open") -> { error, count }
.from("mesa_abierta_matches").delete().in("id", ids)                    -> awaited (rollback)
```

So the builder must be **chainable and awaitable**: `select`, `eq`, `in`, `single`, `insert`,
`update`, `delete` each return the builder, and the builder is a thenable that resolves to the
configured result. Record every operation in an ordered log so a test can assert *"zero writes
happened"* — that is what tests 1–4 and 10 turn on.

**On size, so you do not raise a false alarm:** the plan says to report `FINDINGS` if the double
"outgrows the code it tests". The code it tests is ~470 lines. A double of 100–200 lines is
comfortably inside that and is **not** a FINDINGS trigger. Only raise it if you find yourself
past roughly the size of `handler.ts` itself.

### Making the goldens deterministic

With `pick` injected you control every shuffle. The simplest lever that removes all
call-order bookkeeping is a **constant** `pick`:

```ts
const pick = () => 0;
```

Then `shuffle(["main_course","salad","drinks","dessert"])` is a pure function of the input —
work it out by hand once and assert the literal. You are free to use a scripted sequence
instead if a test needs it, but if you do, remember `shuffle` runs four-plus times per request
and the sequence is consumed in the order listed above. Order bugs here are the likeliest way
to burn a round.

Tests 5 and 6 must assert the *rule*, not a magic string: guest food is
`shuffle([...FOODS], pick)[j % 4]` and host food is `shuffle([...FOODS], pick)[0]`, with the
same `pick` the handler got.

---

## THE DIAGNOSTICS — MEASURED FOR YOU, AND THE PART MOST LIKELY TO TRIP YOU

I ran the gate on the parent commit so you do not have to discover this mid-round.

**`index.ts` is not a clean file today. It carries 10 diagnostics:**

```
=== supabase/functions/create-mesa-matches/handler.ts
--- tsc (0)  --- eslint (0)  --- deno lint (0)  --- deno check (0)
=== supabase/functions/create-mesa-matches/index.ts
--- tsc (0)  --- eslint (0)  --- deno lint (4)  --- deno check (6)
  index.ts(1,22): no-import-prefix: Inline 'npm:', 'jsr:' or 'https:' dependency not allowed
  index.ts(2,29): no-import-prefix: Inline 'npm:', 'jsr:' or 'https:' dependency not allowed
  index.ts(169,10): no-unused-vars: `TARGET_GUEST_SIDE_FOR_DINNER` is never used
  index.ts(444,34): no-unused-vars: `count` is never used
  TS18046: 'error' is of type 'unknown'.            at index.ts:497:16
  TS7006: Parameter 'g' implicitly has an 'any' type.      at index.ts:310:72
  TS7006: Parameter 'g' implicitly has an 'any' type.      at index.ts:396:43
  TS7006: Parameter 'g' implicitly has an 'any' type.      at index.ts:418:77
  TS7006: Parameter 'guest' implicitly has an 'any' type.  at index.ts:377:62
  TS7006: Parameter 'j' implicitly has an 'any' type.      at index.ts:377:69
=== supabase/functions/create-mesa-matches/handler_test.ts
--- tsc (0)  --- eslint (0)  --- deno lint (0)  --- deno check (0)
[gates] totales del proyecto: tsc=1039 eslint=160 deno-lint=94 deno-check=46
```

**Eight of those ten are attached to code that moves.** The 6 `deno check` errors and the 2
`no-unused-vars` all sit inside the block going to `handler.ts`. When the block moves, they
move with it — into a file whose baseline is zero.

**This is expected and it is allowed. Do not "fix" them.** It is a declared displacement:
same messages, new file, project totals unchanged. The PM measured it in advance and Codex
will be told. Silently repairing them would violate the one rule of this phase and make the
move impossible to verify. They are backlog **B-08**.

The two `no-import-prefix` errors stay behind in `index.ts` — and **disappear** when you write
the new `index.ts` against the import map. A removal, which the gate allows.

**So the exact end state you should expect and must report:**

| File | tsc | eslint | deno lint | deno check |
|---|---|---|---|---|
| `handler.ts` | 0 | 0 | **2** (the two `no-unused-vars`) | **6** (TS18046 + 5× TS7006) |
| `index.ts` | 0 | 0 | **0** | **0** |
| `handler_test.ts` | 0 | 0 | **0** | **0** |

Project totals should read `tsc=1039 eslint=160 deno-lint=92 deno-check=46` — `deno-lint`
drops by 2 because of the import map; nothing else moves.

**Anything outside that table is a new diagnostic and is BLOCKING.** In particular
`handler_test.ts` must come out completely clean: a `no-explicit-any` in your double, an unused
import, an implicit `any` in a helper — each is a real failure of your own gate. Write the
double with explicit types.

If the measured output differs from the table above, **report it verbatim and do not paper over
it.** A mismatch is information, not a thing to tidy away.

---

## ACCEPTANCE CRITERIA — from the plan, each independently verifiable

- **[C1]** `handler.ts` calls neither `serve()` nor `Deno.env`.
  Verify: `grep -c "serve(\|Deno\.env" supabase/functions/create-mesa-matches/handler.ts` → `0`.
- **[C2]** `createHandler` accepts `pick`, and its default preserves current behaviour
  (`Math.floor(Math.random() * n)`).
- **[C3]** The 10 goldens pass against an in-memory Supabase double (D12) — no real database,
  no `auth.users` linkage.
- **[C4]** Coverage includes **food** (tests 5, 6) and **partial redistribution** (test 8).
- **[C5]** The authorization, status, deadline and idempotency guards remain in the same order
  and all of them return before any write (tests 1–4, 10).
- **[C6]** `deno test` → **+10 tests, 0 failures**. Measured baseline on the parent is
  **428 passed / 0 failed**, so the tip must read **438 passed / 0 failed**.
- **[C7]** Gate D8 over `F` = the three files, matching the table above. `npm run build` exits 0.

---

## TESTS YOU MUST WRITE — all 10, named as in the plan

1. `OPTIONS 200 sin tocar la base` — 200 + CORS, zero operations recorded on the double.
2. `sin admin rechaza antes de leer el body` — no `Authorization` → 401, and `req.json()` was
   never called. Spy on it (e.g. a `Request` whose `json` throws, or a counting wrapper).
3. `mes fuera de open se rechaza sin escribir` — `status: "closed"` → 400, zero writes.
4. `plazo vigente se rechaza sin escribir` — `registration_deadline` in the future → 400,
   zero writes.
5. `golden: comida de invitados = shuffle([...4])[j % 4]`
6. `golden: comida del anfitrión = shuffle([...4])[0]`
7. `golden: capacidad en unidades; el +1 del anfitrión no consume cupo` — a guest with
   `has_plus_one` consumes **one** slot, and the host's own `+1` consumes none.
8. `golden: el segundo pase redistribuye y la mesa parcial se conserva` — a dinner under
   `MIN_PEOPLE_PER_DINNER` gives its guests away; when they cannot all be placed, the
   remainder **stays** as the leftover dinner. Note `guest_count` is written from
   `assignedGuests.length` **after** redistribution (line 362) — assert the post-redistribution
   value.
9. `golden: sin cupo → lista de espera` — guests beyond capacity get `status: "waitlist"`.
10. `golden: idempotencia sin escribir` — existing matches for the month → 400, zero writes.

TEST COMMAND, verbatim:

```bash
cd supabase/functions && deno test --allow-all .
```

Gate, verbatim, from the repo root:

```bash
./scripts/gates/changed-files-diagnostics.sh \
  supabase/functions/create-mesa-matches/handler.ts \
  supabase/functions/create-mesa-matches/index.ts \
  supabase/functions/create-mesa-matches/handler_test.ts
npm run build
npx vitest run --no-file-parallelism
```

**On Vitest:** `F` contains no file Vitest loads — P3a touches nothing under `src/`. So by
construction any red is pre-existing and D8.2 is satisfied; run it, record the counts as an
observation, and move on. Do not chase reds.

I measured the parent: **1063 passed / 6 failed**, and the 6 are all in
`src/components/mesa-abierta/__tests__/MesaAbiertaDashboard.test.tsx` — exactly the base set
D8.2 declares (P8 repairs them). That run came out clean, but the three
`CuentacuentoEditor.ph.*` files flake under load (backlog **B-05**) and can add a seventh on an
unchanged tree. If you see 7, it is that; note it and carry on.

---

## RULES

- **Move, don't improve.** Re-read "THE ONE RULE" above. Only the four listed edits.
- Surgical changes only. No bulk file modifications. Match the existing handler pattern.
- Do not grade your own work in prose. Show the diff and the raw test output.
- If tests are red, iterate up to 3 times. If still red, report `STATUS: BLOCKED` with the real
  error — never report a red build as complete.
- If you discover the plan is wrong (the seam cannot be cut where the plan says, a guard cannot
  be preserved, the double has to outgrow the handler): **STOP CODING** and report
  `STATUS: FINDINGS` with what you found and what you would propose instead. That is a correct
  outcome, not a failure. Do not work around a broken plan.
- Do not expand scope. If something out of scope is broken, note it under NOT DONE.
- All user-facing text stays in **Spanish** (D10). The error strings you move are already
  written; move them byte-for-byte, including the Spanish deadline message on line 67.
- **Context.** The plan flags this as the session most likely to run out of room. If you feel
  it going, stop and report `CONTEXT PRESSURE: ran out` with exactly where — the PM will split
  the phase. Do not rush the last third; a half-moved handler is worse than a reported split.
  A sensible order is: (1) move the code and get `deno check` clean-by-displacement, (2) build
  the double, (3) tests 1–4 and 10 (the cheap guard tests), (4) tests 5–9 (the goldens).
  Commit after each step so nothing is lost.

---

## WHEN DONE

Append your round entry to `docs/plan/upgrade/LEDGER.md` in this format:

```markdown
### 2026-08-08 — P3a r1 — <model> (EXEC)
- SESSION: UPGRADE · P3a · r1 · EXEC
- CONTEXT PRESSURE:
- ACTION:
- COMMITS:
- TESTS: <command> → <pass/fail, counts>
- FINDINGS RAISED:
- DECISIONS:
- BACKLOG ADDED:
- OPEN AFTER THIS ROUND:
```

Then output exactly this report:

```markdown
## EXECUTOR REPORT — P3a round 1
STATUS: COMPLETE | BLOCKED | FINDINGS
CONTEXT PRESSURE: comfortable | tight | ran out — <one line: at what point?>
BRANCH: feat/mesa-md-seam   COMMITS: <sha…>
FILES CHANGED: <path (+x/-y) …>
WHAT I DID: <bullets, one per acceptance criterion, each mapped to C1…C7>
TEST COMMAND: <verbatim>
TEST OUTPUT: <verbatim tail, unedited>
GATE OUTPUT: <verbatim, all three files, plus the project totals line>
ACCEPTANCE CRITERIA: <C1: met / not met / partially — with reason>
DEVIATIONS FROM PROMPT: <or "none">
ASSUMPTIONS MADE: <or "none">
NOT DONE / OPEN:
```
