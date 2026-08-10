SESSION: UPGRADE · P5a · r2 · EXEC

You are the executor for UPGRADE (CASA · La Mesa Abierta · opt-out del plato
principal), phase **P5a**, round **2**. You have no prior context. Everything you need
is below or in the repo. Read this whole prompt before touching anything.

Worktree: `/Users/brentcurtis/dev/casa-upgrade`, already on the branch. Plan root:
`docs/plan/upgrade/`.

**This is a small round: you are adding exactly two tests and changing no production
code.** Round 1 was verified clean — zero BLOCKING — and its code is correct. Do not
re-litigate it.

---

## 0. PRECONDITION

```bash
cd /Users/brentcurtis/dev/casa-upgrade
git log --oneline -1                       # expect the tip of feat/mesa-md-form
git status --short                         # must be empty
git log --oneline -1 -- docs/plan/upgrade/prompts/P5a-r2.md   # must print a commit
```

If the tree is dirty or that last command prints nothing, report
`STATUS: BLOCKED` and stop.

## BRANCH

**Stay on `feat/mesa-md-form`.** Do not branch, do not rebase, do not squash. Commit on
top. Round 1's commits (`7bb090e` code, `1f566d4` ledger) and the PM's review commits
stay exactly as they are.

---

## 1. WHY THIS ROUND EXISTS

Round 1 shipped correct code. But the PM ran a mutation and found that **the single most
important wire in this feature is held by nothing but a code reading**:

```
Replace   cannotBringMainDish,          (MesaAbiertaSignup.tsx:125)
with      cannotBringMainDish: false,
```

That mutation severs the member's switch from the database — every member is recorded as
`can_bring_main_dish: true` no matter what they chose — and it leaves **all ten tests
green and produces zero `tsc` diagnostics**. Measured, twice, by two different sessions.

The UI would still look right: the switch toggles, the step-5 summary updates. Only the
database would be wrong, silently, for everyone. That is the exact failure class this
whole plan exists to prevent (D4: never swallow silently).

A second, smaller one: deleting `setCannotBringMainDish(false)` from
`AddParticipantDialog`'s `resetForm` leaves test 10 green and lets the switch leak from
one admin-added participant into the next.

**Brent approved a plan amendment on 2026-08-10** (Decision Log) widening P5a from 10 to
12 tests and `vitest +10` to **`+12`**, adding criteria **F9** and **F10**. This round
closes them. The amendment is deliberately narrow: two tests, no production code, and
**B-15 is explicitly not in it** — that one belongs to P6.

---

## 2. SCOPE — two test files, two new tests, zero production changes

You may modify **only** these two files:

1. `src/components/mesa-abierta/__tests__/MesaAbiertaSignup.mainDish.test.tsx` → add
   **test 11**
2. `src/components/mesa-abierta/__tests__/AddParticipantDialog.mainDish.test.tsx` → add
   **test 12**

**Do not touch any production file.** Not `MesaAbiertaSignup.tsx`, not
`participantPayload.ts`, not `AddParticipantDialog.tsx`, nothing under
`src/components/mesa-abierta/*.tsx`. If you find yourself needing a production change to
make a test work — a `data-testid`, an exported helper, a prop — **stop and report
`STATUS: FINDINGS`**. That would mean the amendment was mis-scoped, and that is the PM's
problem to fix, not yours to work around.

`F` for the D8 gate this round is exactly those two test files.

---

## 3. TEST 11 — the one that matters

**File:** `MesaAbiertaSignup.mainDish.test.tsx`
**Name:** `el estado del switch llega al insert`

Drive the wizard's real submit and assert on the payload handed to `.insert()`.

The existing file already gets to step 3 via `advanceToStep3()` and to step 5 via
`advanceToStep5()`; reuse them. Step 5 renders the submit button — find it by role and
its Spanish label as rendered (read the component; do not guess the string).

You need a local `vi.mock` of `@/integrations/supabase/client` that **captures the
insert payload**. The global mock in `src/test/setup.ts` cannot be used: its terminators
resolve to `undefined`, so `const { data, error } = await …single()` throws. The working
capture pattern is in the sibling file
`EditParticipantDialog.mainDish.test.tsx:10–27` — a module-scope array plus a factory
that closes over it. Adapt it for the signup chain, which is
`.from(...).insert(payload).select().single()` and must resolve to
`{ data: { id: … }, error: null }`.

The component also inserts dietary restrictions afterwards and calls `profiles.update`;
your mock must not throw on those paths. Keying the factory on the table name, as the
dashboard test does, is the straightforward way.

**Assert both polarities in the one test:**

- submit with the switch untouched → captured payload has `can_bring_main_dish: true`
- submit with the switch toggled on → captured payload has `can_bring_main_dish: false`

**The bar this test must clear — verify it yourself, it is criterion F9.** After it is
green, apply the mutation by hand, confirm the test goes **red**, then revert:

```bash
# in MesaAbiertaSignup.tsx:125 change  `cannotBringMainDish,`  to  `cannotBringMainDish: false,`
npx vitest run --no-file-parallelism src/components/mesa-abierta/__tests__/MesaAbiertaSignup.mainDish.test.tsx
git checkout -- src/components/mesa-abierta/MesaAbiertaSignup.tsx    # revert, always
```

**Paste that red output into your report.** A test that does not go red under that
mutation does not close F9, however green it is otherwise. Make sure `git status` is
clean afterwards — the revert is not optional, and the PM will check.

---

## 4. TEST 12

**File:** `AddParticipantDialog.mainDish.test.tsx`
**Name:** `resetForm devuelve el switch a apagado`

Toggle the switch on, submit successfully, and assert the switch is back to
`aria-checked="false"` afterwards — `resetForm()` runs on a successful submit
(`AddParticipantDialog.tsx:145`). The existing test 10 already has the
`functions.invoke` mock and the submit helper; reuse them.

Same bar (F10): deleting `setCannotBringMainDish(false)` from `resetForm` must turn this
test red. Verify it by mutation, revert, and paste the red output.

---

## 5. ACCEPTANCE CRITERIA

- **[F9]** Mutating `cannotBringMainDish` → `false` at the builder call site turns test
  11 red. Demonstrated with pasted output, and reverted.
- **[F10]** Deleting the `resetForm` reset turns test 12 red. Demonstrated and reverted.
- **[F7′]** `npx vitest run --no-file-parallelism` → **1093 passed / 6 failed** (1099),
  i.e. `+2` on round 1's 1091/6. The 6 red stay `MesaAbiertaDashboard.test.tsx`.
- **[F8′]** Gate D8 over the two test files: zero diagnostics. `npm run build` exits 0.
- **[F11]** `git diff` against round 1's tip touches **only** the two test files.

---

## 6. BASELINE — measured by the PM on this branch

- **Vitest at round 1's tip: 1091 passed / 6 failed (1097).** Your target is 1093/6.
- **The suite flakes on both this branch and its parent**, in the B-05
  `CuentacuentoEditor.*` family. The PM saw 7 failures on one tip run and 6 on the next;
  a third session saw 11 under load. **If you see extra reds, re-run before concluding
  anything** — and note D8.2's parent rule is weak here, because a quiet parent run
  against a loaded tip run proves nothing. Neither of your two files imports anything
  those tests touch. Isolate with:
  ```bash
  npx vitest run --no-file-parallelism \
    src/components/mesa-abierta/__tests__/MesaAbiertaSignup.mainDish.test.tsx \
    src/components/mesa-abierta/__tests__/AddParticipantDialog.mainDish.test.tsx
  ```
- Gate D8 over the two test files was **all zeros** in round 1. Keep it there.

```bash
bash scripts/gates/changed-files-diagnostics.sh \
  src/components/mesa-abierta/__tests__/MesaAbiertaSignup.mainDish.test.tsx \
  src/components/mesa-abierta/__tests__/AddParticipantDialog.mainDish.test.tsx
```

---

## 7. EXPLICITLY OUT OF SCOPE

- **Any production file.** See §2.
- **B-15** — the `fetchParticipants` select seam. It is real, it is logged, and it
  belongs to **P6**, whose scope already contains `MesaAbiertaAdmin.tsx`. Adding a third
  test here is exactly the widening the amendment was written to avoid.
- **The existing ten tests.** Do not rewrite, rename, strengthen or "tidy" them. They
  passed review.
- Baseline diagnostics (B-08), `types.ts`, `supabase/functions/**`, migrations, the
  database, `* 2.tsx` duplicates.

---

## 8. RULES

- Two tests. Nothing else. This round's whole value is that it is small.
- Spanish test names, matching §3 and §4. Match the style of the file you are editing.
- **Never weaken an assertion to make it pass.** If test 11 cannot be made to fail under
  the mutation without touching production code, that is `STATUS: FINDINGS`.
- Do not grade your own work in prose. Show the diff and the raw output.
- If tests are red, iterate up to 3 times, then `STATUS: BLOCKED` with the real error.
- **Both mutations must be reverted and `git status` must be clean before you report.**

---

## 9. WHEN DONE

Append your round entry to `docs/plan/upgrade/LEDGER.md` (append only — never reflow or
reorder it), in this format:

```markdown
### 2026-08-10 — P5a round 2 — <actor>
- SESSION: UPGRADE · P5a · r2 · EXEC
- CONTEXT PRESSURE:
- ACTION:
- COMMITS:
- TESTS: <command> → <counts>
- MUTATION EVIDENCE: <F9 red output · F10 red output · both reverted>
- FINDINGS RAISED:
- OPEN AFTER THIS ROUND:
```

Then output exactly this report:

```markdown
## EXECUTOR REPORT — P5a round 2
STATUS: COMPLETE | BLOCKED | FINDINGS
CONTEXT PRESSURE: comfortable | tight | ran out — <one line: at what point?>
BRANCH: feat/mesa-md-form   COMMITS: <sha…>
FILES CHANGED: <path (+x/-y) …>
WHAT I DID: <bullets, mapped to F9, F10, F7′, F8′, F11>
MUTATION EVIDENCE — F9: <the pasted red output, then proof of revert>
MUTATION EVIDENCE — F10: <the pasted red output, then proof of revert>
TEST COMMAND: npx vitest run --no-file-parallelism
TEST OUTPUT: <verbatim tail, unedited>
GATE D8 OUTPUT: <whole output over the two test files>
BUILD: <npm run build exit code>
GIT STATUS: <must be clean>
ACCEPTANCE CRITERIA: <F9, F10, F7′, F8′, F11: met / not met — with reason>
DEVIATIONS FROM PROMPT: <or "none">
NOT DONE / OPEN:
```
