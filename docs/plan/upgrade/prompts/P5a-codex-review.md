SESSION: UPGRADE · P5a · REVIEW

Final review of phase **P5a — Captura en el frontend** for **UPGRADE**
(La Mesa Abierta · opt-out del plato principal).

Read `docs/plan/upgrade/PLAN.md` for the acceptance criteria (§ "Phase P5a", criteria
**F1–F10**) and the frozen decisions (**D2, D8, D10**), then review branch
**`feat/mesa-md-form`** at its tip. Its parent is **`main`@`62e9158`**.

**This phase ran two rounds. Review both.**
- **r1** — `7bb090e`: the nine files of `F`, ten tests. Verified clean by the PM.
- **r2** — `2018e06`: **two tests only, zero production changes**, closing two coverage
  gaps found after r1. Authorised by a **plan amendment on 2026-08-10** (Decision Log)
  widening P5a from 10 to 12 tests and `vitest +10` to **`+12`**, and adding criteria
  **F9** and **F10**.

**F9 and F10 are not satisfied by a passing test — they are satisfied by a failing one.**
Each requires that a specific mutation to production code turns a specific test red.
Re-run both yourself; the PM did, and so did the executor:

```bash
# F9 — MesaAbiertaSignup.tsx:125,  `cannotBringMainDish,` → `cannotBringMainDish: false,`
#      must turn test 11 red.   Before r2 it left ALL TEN tests green and tsc silent.
# F10 — delete `setCannotBringMainDish(false)` from AddParticipantDialog.tsx:46
#      must turn test 12 red.
# Revert both. `git status` must end clean.
```

**Why r2 exists, in one line:** r1's code was correct, but the single wire carrying the
member's choice into the database was held by nothing but a code reading — the feature's
headline path could have been severed silently without a single test noticing.

You have final say on BLOCKING items. The phase does not close until you pass it.

Use **Node v22.22.0**. Run from a clean, dedicated worktree.

> **Cut your worktree from `62e9158`, not from an older `main`.** Between this phase's
> bootstrap and its execution, `main` absorbed **two** merges — P4 (`949b40a`) and
> `phase/E3a-slug` (`62e9158`, a different workstream). The executor's parent is
> `62e9158`. Comparing against `3851e40` will give you a bogus Vitest delta; that is
> exactly the trap the PM fell into when writing the executor prompt, described below.

---

## WHAT THIS PHASE IS

P1a/P1b added `mesa_abierta_participants.can_bring_main_dish BOOLEAN NOT NULL DEFAULT
TRUE` and applied it live. P4 wired the allocator so the matcher honours that flag —
an excluded carrier never receives `main_course`.

**But no human could set the flag.** Every row was `true` because that is the column
default; no UI wrote `false`. **P5a is the phase that lets a person say "no puedo traer
el plato principal" and have it reach the database.** It is nine files: one new pure
module that owns the polarity conversion, three forms that grow a switch, one `select`
that grows a column, and five test files.

No behaviour on the server changes. P5b writes the `admin-add-participant` server half;
until it lands, an admin-added participant still gets the column default. That is
expected and declared, not an omission.

---

## THE THING TO ATTACK FIRST — POLARITY

**This is the phase's whole risk surface and it deserves your first hour.** The value is
stored **positively** (`can_bring_main_dish`), presented **negatively** (`No puedo traer
el plato principal`), and the switch is **off by default**. Two inversions stacked on a
default. The failure mode is not a red test — it is **ten green tests written with the
same inversion as the code**, which is invisible to anything except reading the truth
table against the database's meaning.

| Switch | Meaning | `can_bring_main_dish` | Matcher may assign main course? |
|---|---|---|---|
| **OFF** (default) | "I can bring it" | **`true`** | yes |
| **ON** | "I cannot bring it" | **`false`** | never |

The anchor that cannot be argued with: **a new participant who touches nothing must land
as `can_bring_main_dish: true`, identical to every row that exists in production today.**
If the tests fix the default at `false`, the feature is backwards and every green test is
green about the wrong thing.

Four conversion sites — check each against the table, in the code, not the tests:
`participantPayload.ts` (`!input.cannotBringMainDish`), `EditParticipantDialog`'s
`.update()`, `EditParticipantDialog`'s initialisation (`participant.can_bring_main_dish
=== false`, so `undefined` ⇒ off), and `AddParticipantDialog`'s edge-function body
(`canBringMainDish`, camelCase, **positive** — P5b will read exactly that name).

---

## WHAT THE PM VERIFIED INDEPENDENTLY — RE-RUN IT, DO NOT TRUST IT

- **Vitest, tip (after r2):** `1093 passed / 6 failed` (1099). Only red file is
  `MesaAbiertaDashboard.test.tsx` — the base D8.2 declares until P8. (r1's tip was
  1091/6; r2 adds exactly 2.)
- **Vitest, parent `62e9158`:** `1080 passed / 7 failed` (1087). Reds:
  `MesaAbiertaDashboard` (6) + `CuentacuentoEditor.f4.integration` (1, family B-05).
- **Delta = +12 exactly**, the twelve new tests, matching the amended arithmetic.
- **This suite flakes hard under machine load, on tip and parent alike.** Measured
  across four sessions on the *same* commits: 6, 7, 8, 10 and 11 reds. The extras are
  always the `CuentacuentoEditor.*` family (B-05). **The total (1099) never varied** —
  only the red list. Re-run before concluding anything, and note that **D8.2's parent
  rule cannot discriminate** when the parent run happens to be quiet and the tip run
  happens to be loaded; the real discriminator is a second tip run. That hole is
  recorded and is a live question for the plan, not something r2 fixed.
- **Gate D8 over all nine paths:** zero new diagnostics. Every message matches the
  parent character-for-character; only line numbers shift. Totals tsc=1039 eslint=161
  deno-lint=92 deno-check=43.
- **`npm run build` → exit 0.**

```bash
npx vitest run --no-file-parallelism
bash scripts/gates/changed-files-diagnostics.sh \
  src/lib/mesa-abierta/participantPayload.ts \
  src/lib/mesa-abierta/__tests__/participantPayload.test.ts \
  src/components/mesa-abierta/MesaAbiertaSignup.tsx \
  src/components/mesa-abierta/EditParticipantDialog.tsx \
  src/components/mesa-abierta/AddParticipantDialog.tsx \
  src/components/mesa-abierta/MesaAbiertaAdmin.tsx \
  src/components/mesa-abierta/__tests__/MesaAbiertaSignup.mainDish.test.tsx \
  src/components/mesa-abierta/__tests__/EditParticipantDialog.mainDish.test.tsx \
  src/components/mesa-abierta/__tests__/AddParticipantDialog.mainDish.test.tsx
```

### One D8 check specific to this phase

Five of `MesaAbiertaAdmin.tsx`'s ten `tsc` errors are
`SelectQueryError<"column 'email' does not exist on 'mesa_abierta_participants'.">`.
P5a adds `can_bring_main_dish` **to that same `select`**. Because that column *is* in
`types.ts`, the five messages must stay character-for-character identical and still name
`email`. They do. **If you can make them name `can_bring_main_dish` instead, that is a
new diagnostic, BLOCKING under D8.4, and it means `types.ts` disagrees with the live
schema** — a much bigger finding than this phase.

---

## THE DEVIATION, AND WHY THE PM ACCEPTED IT

The executor prompt (§3.1 of `prompts/P5a-r1.md`) prescribed `status: string` in
`buildParticipantInsert`'s return type. The executor narrowed it to `status: 'pending'`,
because the widened `string` breaks the `.insert()` overload and introduces a new TS2769.

The PM corroborated the mechanism without editing code: `EditParticipantDialog.tsx(104,11)`
already carries a pre-existing
`TS2322: Type 'string' is not assignable to type '"pending" | "confirmed" | "cancelled" | "waitlist"'`
— same table, same column, same cause. **The PM's prescribed signature was wrong and
applying it verbatim would have been BLOCKING.** The executor measured both variants with
the gate before deciding and declared it.

Judge whether the narrowing is right, and whether anything else in the prompt was
followed into a hole rather than questioned.

---

## THE SHOULD-FIX ALREADY FOUND — AND THE ONE YOU SHOULD LOOK FOR

Since P4, the question that yields more than exhibiting our own mutations is: **name a
change these tests would not catch.** The PM ran it and found one:

**S1 / B-15 — deleting `can_bring_main_dish` from `fetchParticipants`'s `select` leaves
all ten tests green.** Verified as a real mutation on the tree, then reverted. No test
mounts `MesaAbiertaAdmin`, so the seam admin→dialog is covered by reading only. The
failure mode is not cosmetic: without the field the dialog receives `undefined`,
initialises the switch off, and **saving persists `can_bring_main_dish: true`** — an
admin editing an excluded participant's phone number silently re-enrols them for the
main dish.

The PM deliberately did **not** fix it in P5a: the plan fixes this phase's test plan at
ten tests and its arithmetic at `vitest +10`, and widening a frozen phase is how phases
get expensive. It is logged as **B-15**, recommended to **P6**, which already has
`MesaAbiertaAdmin.tsx` in its `F` and already mounts the panel.

**Three are now spent — B-15, plus B-16 and B-17 which r2 closed. Find a fourth.**
Name a change to this diff that the **twelve** tests do not catch, and say whether it is
BLOCKING, SHOULD-FIX, or noise. The tests are strong where they aim — test 3 compares the
whole row with `toEqual`, test 8 re-renders with a different participant and covers
`false`/`true`/`undefined`, test 10 asserts the wrong field names are absent, tests 11
and 12 are pinned by mutation — so look at what they do not aim at.

**One standing question worth your judgement, beyond this phase.** Twice now this
workstream has produced backlog items whose file appears in no later phase's `F` — P4
left B-13 and N1 that way, and r1 left B-16 and B-17 until the amendment rescued them.
B-13, B-14 and P4's N1 are **still unowned**. The PM's read is that "SHOULD-FIX goes to
the backlog" assumes a backlog with an exit, and this one has none. If you see a cleaner
structural answer than "widen some later phase's `F`", say so under NOTES ON THE PLAN
ITSELF — that is a plan problem, not a code one.

---

## ALSO CHECK

1. Every acceptance criterion F1–F8 against the code, not the ledger.
2. Do the tests test **behaviour**, or just execute code? These are the repo's first
   tests to drive a Radix `Switch`; check the `aria-checked` assertions are real and
   that the step-3/step-5 wizard navigation is not asserting on something incidental.
3. Any violation of **D2** (polarity), **D8** (file-scoped gate), **D10** (Spanish).
4. Scope creep: exactly nine files should have changed. No `types.ts`, no
   `supabase/functions/**`, no migration, no database, no `* 2.tsx` duplicate, no
   admin override dialog or coverage badge (those are P6), and exactly two edits inside
   the 2227-line `MesaAbiertaAdmin.tsx`.
5. **Anything that makes P5b, P6, P7 or P8 harder.** P5b in particular consumes
   `body.canBringMainDish` from `AddParticipantDialog`; confirm the name and polarity
   it will read are the ones being sent.
6. Any user-facing string that is not Spanish, or that drifts from the plan's fixed copy
   (`No puedo traer el plato principal` / `Te asignaremos ensalada, bebidas o postre en
   su lugar`).

Review against the plan's contract, not your own preferences. Taste disagreements are
NITs. Only correctness, contract violations, security, and architectural violations are
BLOCKING.

Output using the **CODEX REVIEW** format from the SOP:

```markdown
## CODEX REVIEW — P5a round 1
VERDICT: PASS | FAIL
BLOCKING:
- [B1] <finding> — <file:line> — <why it blocks>
SHOULD-FIX:
- [S1] ...
NITS:
- [N1] ...
NOTES ON THE PLAN ITSELF: <if the plan, not the code, is the problem>
```

Commit your review to `docs/plan/upgrade/reviews/REVIEW-P5a.md` on the branch and push
it. Four of the five previous reviews needed the PM to chase the file into the repo;
`REVIEW-P1.md` sat uncommitted until this phase's bootstrap swept it up.
