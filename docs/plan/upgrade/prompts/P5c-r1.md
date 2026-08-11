SESSION: UPGRADE · P5c · r1 · EXEC

You are the executor for UPGRADE (CASA · La Mesa Abierta · opt-out del plato
principal), phase **P5c**, round **1**. You have no prior context. Everything you need
is below or in the repo. Read this whole prompt before touching anything.

Worktree: `/Users/brentcurtis/dev/casa-upgrade`, already on the branch. Plan root:
`docs/plan/upgrade/`.

**You are adding three tests and editing one comment. No behaviour changes.**

---

## 0. PRECONDITION

```bash
cd /Users/brentcurtis/dev/casa-upgrade
git log --oneline -1                                          # tip of feat/mesa-md-guards
git status --short                                            # must be empty
git log --oneline -1 -- docs/plan/upgrade/prompts/P5c-r1.md   # must print a commit
git show main:docs/plan/upgrade/PLAN.md | grep -cE '^\| (P4|P5a) .*DONE'   # must print 2
```

If the tree is dirty, or either of the last two prints nothing / not `2`, report
`STATUS: BLOCKED` and stop.

## BRANCH

**Stay on `feat/mesa-md-guards`** (already created from `main`@`d5b16e8`). Commit on top.
Do not branch, rebase or squash.

---

## 1. WHY THIS PHASE EXISTS

Every other phase in this plan builds something. **This one pays debt.** Four findings
accumulated across P4 and P5a that no later phase could ever pick up, because their files
were not in any later phase's scope. Brent approved adding this phase on 2026-08-11
rather than let them rot (Decision Log).

Two of them are measured, live gaps — **verified on `main` today, not remembered**:

- **B-13** — replacing `tablesWithShortfall` with `[]` in the handler's HTTP response
  leaves `deno test` at **28 passed / 0 failed**. The existing tests only ever assert the
  **empty** case (`assertEquals(body.results?.tablesWithShortfall, [])`), so blanking the
  field keeps them all true. **D4 says a deficit is reported, never silently swallowed** —
  and P6, P7 and P8 are all going to consume this exact field.
- **B-18** — wrapping the main-dish switch in `rolePreference === 'guest'` leaves Vitest
  at **12/12**. All twelve of P5a's tests walk the wizard as a *guest*, so losing the
  **host's** opt-out is invisible. By **D7 the host is the first candidate for
  `main_course`**, so a host who cannot cook the main dish is the case that matters most.
  This code is **already deployed**.

Plus **B-15** (the admin fetch→dialog seam, whose failure mode is an admin silently
re-enrolling an excluded member while editing their phone number) and **N1** (a stale
comment). **B-14 is explicitly out** — Brent accepted it as debt.

---

## 2. SCOPE — four files

1. `supabase/functions/create-mesa-matches/handler_test.ts` — **+1 test** (B-13)
2. `supabase/functions/create-mesa-matches/handler.ts` — **the header comment only** (N1)
3. `src/components/mesa-abierta/__tests__/MesaAbiertaSignup.mainDish.test.tsx` — **+1** (B-18)
4. `src/components/mesa-abierta/__tests__/MesaAbiertaAdmin.mainDish.test.tsx` — **new, +1** (B-15)

`F` for the D8 gate is exactly these four.

**Do not change behaviour anywhere.** The only non-test edit in this whole phase is the
comment in §6. If a test seems to need a production change — a `data-testid`, an export,
a prop — **stop and report `STATUS: FINDINGS`**. That means the phase is mis-scoped, and
that is the PM's problem, not yours to work around.

---

## 3. EVERY CRITERION IS PROVED BY MUTATION, NOT BY GREEN

P5a r2 established this and it is now how coverage debt gets closed here: **a passing
test proves nothing about what it guards.** For each of H1, H2, H3 you must apply the
mutation by hand, show the test going **red**, revert, and paste the red output. `git
status` must be clean before you report. The PM will re-run all three.

---

## 4. H1 — B-13, the shortfall edge (`handler_test.ts`)

**Test name:** `el déficit real cruza el borde HTTP`

Build a table whose deficit **cannot** be rebalanced away, then assert the response
reports it.

The file's fixture helpers are already there — read them before writing:
`host(id, maxGuests, plusOne?, canBringMainDish?)` at `:55`,
`guest(id, plusOne?, canBringMainDish?)` at `:72`, `guests(n)` at `:84`,
`adminDouble(cfg)` at `:306`, `makeRequest()` at `:280`. The pattern for reading the
response body is `la comida proviene del allocator` at `:528` — copy its shape.

A fixture that should work, but **verify it rather than trusting me**: one host with five
guests where **nobody is willing** —

```ts
const db = adminDouble({
  participants: [
    host("h1", 6, false, false),
    ...Array.from({ length: 5 }, (_v, i) => guest(`g${i + 1}`, false, false)),
  ],
});
```

`peopleCount` = 6 → `requiredMainDishes` = `max(1, ceil(6/5))` = **2**;
`willingCarriers` = 0 → `mainDishCount` = 0 → `shortfall` = **2**. One table, so there is
no donor to swap with and the deficit is structural.

Assert:
- `body.results.tablesWithShortfall` is **non-empty**, and contains
  `{ tableId: "h1", shortfall: 2 }` — the shape P6, P7 and P8 will read.
- The matching `mainDishCoverage` entry agrees (`requiredMainDishes` 2, `mainDishCount` 0).
- **The `console.warn` D4 emits carries only ids and numbers — no PII (D12).** It is at
  `handler.ts:192`. Capture it by stubbing `console.warn` for the duration of the test and
  restoring it afterwards; assert the message contains `h1` and `2` and nothing resembling
  a name, email or phone. **Nobody asserts this warning today** — that is half of what
  B-13 is about.

**Mutation for H1:** change `tablesWithShortfall,` to `tablesWithShortfall: [],` at
`handler.ts:346`. Your new test must go red. Revert.

**Test command:** `cd supabase/functions && deno test --allow-all --no-check .`
Baseline is **456 passed / 0 failed** across the tree, **28/0** for
`create-mesa-matches`. Target: **457 / 0** and **29/0**.

---

## 5. H2 — B-18, the host's opt-out (`MesaAbiertaSignup.mainDish.test.tsx`)

**Test name:** `el anfitrión también puede excluirse`

The file's existing `advanceToStep3()` renders as a **guest** — as a guest, step 3 needs
nothing. **A host does:** `canProceedFromStep3` at `MesaAbiertaSignup.tsx:53` requires
`hostAddress` to be non-empty, so you must fill `Dirección de tu hogar *` (`:301`) before
`Siguiente` will advance. Pass `preferredRole="host"` when rendering, or pick the host
card in step 1.

Assert: the switch is present for a host, defaults to off, and — driving the real submit
with the existing `participantInserts` capture — that turning it on lands
`can_bring_main_dish: false` in the row. Reuse `submitAndCaptureInsert()`.

**Mutation for H2:** wrap the switch block at `MesaAbiertaSignup.tsx:373` in
`{rolePreference === 'guest' && ( … )}`. Your new test must go red. Revert.

---

## 6. H3 — B-15, the admin seam (`MesaAbiertaAdmin.mainDish.test.tsx`, new)

**Test name:** `el fetch entrega can_bring_main_dish al diálogo de edición`

Mount `MesaAbiertaAdmin`, with the Supabase double returning one participant whose
`can_bring_main_dish` is `false`, open the edit dialog (the pencil button, `:1554`), and
assert the switch inside it renders **on**.

**This is the phase's hard part and its declared risk.** `MesaAbiertaAdmin.tsx` is 2227
lines, carries 10 pre-existing `tsc` errors, and **no test in this repo has ever mounted
it.** It queries `mesa_abierta_months`, `mesa_abierta_participants`, `profiles` and
`mesa_abierta_dietary_restrictions`; your mock must key on table name and satisfy all
four. The pattern that works for that shape is
`MesaAbiertaDashboard.test.tsx:1–52`.

**The escape hatch, and its exact limit:** if mounting the panel needs scaffolding out of
proportion — a router, an auth provider tree, a dozen chained query doubles — report
`STATUS: FINDINGS` with what you tried. **Do not substitute a weak assertion.** Asserting
that the `select` string contains `can_bring_main_dish` is *not* this test; that checks a
string, not the seam, and it would pass while the seam is broken. Codex was explicit that
having the file in scope is not the same as mounting the seam — a weak version of this
test is worse than none, because it makes the gap look closed.

**Mutation for H3:** delete `can_bring_main_dish` from the `select` at
`MesaAbiertaAdmin.tsx:239`. Your new test must go red. Revert.

---

## 7. H4 — N1, the stale comment (`handler.ts`)

`handler.ts:11–12` still reads:

```
 * The only injected seam is `pick`, which `shuffle` uses in place of
 * `Math.random` so tests can make the shuffles deterministic.
```

That stopped being true at P3b (which moved `shuffle` into `matching.ts`) and P4 (which
made `allocateAll` a second consumer of `pick`). Rewrite those two lines so they describe
the seam as it is. **Comment only — do not touch a line of code in this file except the
`tablesWithShortfall` mutation you will apply and revert.**

---

## 8. ACCEPTANCE CRITERIA

- **[H1]** Blanking `tablesWithShortfall` turns the new Deno test red. Shown and reverted.
- **[H2]** Hiding the switch from hosts turns the new Signup test red. Shown and reverted.
- **[H3]** Dropping the column from the admin `select` turns the new Admin test red.
  Shown and reverted.
- **[H4]** `handler.ts`'s header describes the seam accurately.
- **[H5]** `deno test` **+1, 0 failures** (456 → 457). `vitest` **+2** (1093 → 1095), red
  set unchanged at the 6 of `MesaAbiertaDashboard.test.tsx`.
- **[H6]** Gate D8 over the four files: zero new diagnostics vs `main`@`d5b16e8`.
  `npm run build` exits 0.
- **[H7]** `git diff main..HEAD` touches only the four files of `F` plus `LEDGER.md`.

---

## 9. BASELINE — measured by the PM on `main`@`d5b16e8`

- **Vitest 1093 passed / 6 failed (1099).** The 6 are `MesaAbiertaDashboard.test.tsx`.
- **Deno 456 passed / 0 failed**; `create-mesa-matches` alone **28/0**.
- **This Vitest suite flakes hard under machine load.** Five sessions on identical
  commits have seen 6, 7, 8, 10 and 11 reds — always the `CuentacuentoEditor.*` family
  (B-05). **The total never varied.** Re-run before concluding anything; D8.2's parent
  rule cannot discriminate a loaded tip run from a quiet parent run.
- Gate D8 on your four files is **all zeros** today except `handler.ts`, which carries
  `eslint (1)` at `:31` (`no-explicit-any` on `SupabaseLike`), `deno lint (1)` at `:290`
  (`count` unused) and `deno check (3)`. All pre-existing (**B-08**), **none of them
  yours to fix**.

```bash
bash scripts/gates/changed-files-diagnostics.sh \
  supabase/functions/create-mesa-matches/handler.ts \
  supabase/functions/create-mesa-matches/handler_test.ts \
  src/components/mesa-abierta/__tests__/MesaAbiertaSignup.mainDish.test.tsx \
  src/components/mesa-abierta/__tests__/MesaAbiertaAdmin.mainDish.test.tsx
```

---

## 10. EXPLICITLY OUT OF SCOPE

- **B-14** — the unbounded `shuffle` index in `matching.ts`. **Brent accepted it as debt
  on 2026-08-11.** Triggering it requires a caller to violate D11's contract, which
  production's `pick` cannot do. Do not "just add a bounds check while you're there."
- Any behaviour change. Any production file other than `handler.ts`'s comment.
- The baseline diagnostics (B-08), `types.ts`, migrations, the database.
- The existing twelve Vitest tests and twenty-eight Deno tests — do not rewrite, rename
  or "strengthen" them.
- `* 2.tsx` duplicates, P6's coverage badge and override dialogs, P7, P8.

---

## 11. RULES

- Three tests and one comment. The value of this phase is that it is small.
- Spanish test names, matching §4–§6. Match the style of the file you are in.
- **Never weaken an assertion to make it pass.** See §6 — that is the specific temptation
  in this phase.
- Do not grade your own work in prose. Show the diff and the raw output.
- If tests are red, iterate up to 3 times, then `STATUS: BLOCKED` with the real error.
- **All three mutations reverted and `git status` clean before you report.**

---

## 12. WHEN DONE

Append your round entry to `docs/plan/upgrade/LEDGER.md` (append only — never reflow or
reorder it):

```markdown
### 2026-08-11 — P5c round 1 — <actor>
- SESSION: UPGRADE · P5c · r1 · EXEC
- CONTEXT PRESSURE:
- ACTION:
- COMMITS:
- TESTS: <deno command> → <counts> · <vitest command> → <counts>
- MUTATION EVIDENCE: <H1 · H2 · H3, each with its red output and proof of revert>
- FINDINGS RAISED:
- OPEN AFTER THIS ROUND:
```

Then output exactly this report:

```markdown
## EXECUTOR REPORT — P5c round 1
STATUS: COMPLETE | BLOCKED | FINDINGS
CONTEXT PRESSURE: comfortable | tight | ran out — <one line: at what point?>
BRANCH: feat/mesa-md-guards   COMMITS: <sha…>
FILES CHANGED: <path (+x/-y) …>
WHAT I DID: <bullets, mapped to H1–H7>
MUTATION EVIDENCE — H1: <red output, then proof of revert>
MUTATION EVIDENCE — H2: <red output, then proof of revert>
MUTATION EVIDENCE — H3: <red output, then proof of revert>
TEST COMMAND: cd supabase/functions && deno test --allow-all --no-check .
TEST OUTPUT: <verbatim tail>
TEST COMMAND: npx vitest run --no-file-parallelism
TEST OUTPUT: <verbatim tail>
GATE D8 OUTPUT: <whole output over the four files>
BUILD: <npm run build exit code>
GIT STATUS: <must be clean>
ACCEPTANCE CRITERIA: <H1–H7: met / not met — with reason>
DEVIATIONS FROM PROMPT: <or "none">
NOT DONE / OPEN:
```
