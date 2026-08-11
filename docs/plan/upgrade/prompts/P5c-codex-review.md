SESSION: UPGRADE · P5c · REVIEW

Final review of phase **P5c — Guardas de cobertura huérfanas** for **UPGRADE**
(La Mesa Abierta · opt-out del plato principal).

Read `docs/plan/upgrade/PLAN.md` for the acceptance criteria (§ "Phase P5c", criteria
**H1–H6**; the executor prompt adds **H7**) and the frozen decisions (**D1, D4, D7, D8,
D11, D12**), then review branch **`feat/mesa-md-guards`** at its tip.

- **Tip:** `adc641f` · **Parent:** `main`@`d5b16e8`
- **One round, one attempt.** The executor's diff is `b9675e6..adc641f`.
- `b9675e6` is the **PM's own** bootstrap commit (`PLAN.md`, `LEDGER.md`,
  `prompts/P5c-r1.md`). It is on the branch but is not executor work. Review it as
  contract, not as code.
- Code commit `56505ae`; ledger commit `adc641f`.

Use **Node v22.22.0**. Run from a clean, dedicated worktree cut from `d5b16e8`.

> **Use the `deno` on your PATH, and say which version you used.** On the executor's
> machine `deno` is **2.7.11** while `npx deno` is **2.9.5**. The gate script shells out
> to plain `deno`, so a review that reaches for `npx deno` may produce a different
> `deno lint` / `deno check` count and manufacture a phantom diagnostic delta.

---

## WHAT THIS PHASE IS, AND WHY IT IS UNUSUAL

**Every other phase in this plan builds something. This one pays debt and ships no
behaviour.** Four findings accumulated across P4 and P5a whose files sat in **no later
phase's `F`**, so "goes to the backlog" meant "unowned forever". Brent approved adding
P5c on 2026-08-11 rather than let them rot (Decision Log), and it runs **before P5b** so
the three remaining phases build on a tested contract instead of an assumed one.

The entire diff is **three tests and one comment**, four files:

1. `supabase/functions/create-mesa-matches/handler_test.ts` — +1 test (B-13)
2. `supabase/functions/create-mesa-matches/handler.ts` — **header comment only** (N1)
3. `src/components/mesa-abierta/__tests__/MesaAbiertaSignup.mainDish.test.tsx` — +1 (B-18)
4. `src/components/mesa-abierta/__tests__/MesaAbiertaAdmin.mainDish.test.tsx` — new, +1 (B-15)

**B-14 is deliberately out** — Brent accepted it as debt on 2026-08-11 (state (c) of the
three-state rule). Triggering it requires a caller to violate D11's contract, which
production's `pick` cannot do. If you think that acceptance is wrong, say so under NOTES
ON THE PLAN ITSELF — do not treat its absence from the diff as an omission.

---

## THE CENTRAL CLAIM, AND THE THING TO ATTACK FIRST

**No criterion here is satisfied by a green test. Each is satisfied by a red one.**
P5a r2 established this and P5c is built entirely on it: a passing test proves nothing
about what it guards. Re-run all three mutations yourself — the PM ran them on `main`
before writing the contract, and the executor ran them on the branch.

```bash
# H1 — handler.ts:346   `tablesWithShortfall,` → `tablesWithShortfall: [],`
#      must turn `el déficit real cruza el borde HTTP` red.
#      Before this phase it left create-mesa-matches at 28 passed / 0 failed.
cd supabase/functions && deno test --allow-all --no-check ./create-mesa-matches/

# H2 — MesaAbiertaSignup.tsx:373  wrap the switch block in `{rolePreference === 'guest' && ( … )}`
#      must turn `el anfitrión también puede excluirse` red.
#      Before this phase it left the file's tests all green.

# H3 — MesaAbiertaAdmin.tsx:239  delete `can_bring_main_dish` from the `select`
#      must turn `el fetch entrega can_bring_main_dish al diálogo de edición` red.
#      Before this phase it left all twelve P5a tests green.

# Revert all three. `git status` must end clean.
```

### H3's double is the load-bearing part of this diff — go at it first

`MesaAbiertaAdmin.mainDish.test.tsx` is the **first test in this repo to mount
`MesaAbiertaAdmin.tsx`** (2227 lines, 10 pre-existing `tsc` errors). Codex was explicit
when ratifying B-15 that having the file in `F` is not the same as mounting the seam, and
that **a weak version of this test is worse than none**, because it makes the gap look
closed.

The specific trap the executor claims to have avoided: **the Supabase double projects the
`select` column list, the way PostgREST does.** A double that returned the whole row
regardless would pass this test *with the seam broken* — functionally equivalent to
asserting that the `select` string contains the column, which is exactly the assertion the
executor prompt forbade.

So: **is the projection real, or is it a mock shaped to make one mutation fail?** Check
`project()` and `queryBuilder()` in that file. Ask whether the double is faithful enough
that the test means what its name says, or whether it merely encodes the mutation.
Related questions worth your time:

- The chainable builder returns `this` for ~17 methods and is a thenable. Does it hide a
  failure — e.g. does an unexpected call silently resolve to `[]` and make some other part
  of the mount vacuously succeed?
- `single()` is wired to the admin-role check only; `maybeSingle()` returns `rows()[0]`.
  Is any real code path getting a wrong-shaped answer and passing anyway?
- The test uses `userEvent`, not `fireEvent`, because Radix tabs activate on `mouseDown`.
  Is the tab actually switching, or could the assertion pass from something incidental?

### H1's PII assertion

D4's `console.warn` (`handler.ts:191`) is asserted by nobody today — that is **half of
what B-13 is about**. The new test stubs `console.warn`, restores it in a `finally`, and
asserts the line carries only ids and numbers (**D12**). Because the handler does
`select("*")`, the executor put **synthetic** `full_name` / `email` / `phone` on the
fixture rows so that "carries no PII" is not vacuously true.

Judge two things: whether the synthetic PII is genuinely synthetic and in-memory (D12 —
nothing linked to `auth.users`, no member data committed), and whether the assertion
would actually catch a future change that logged a participant object.

Also verify the fixture's arithmetic independently rather than trusting the comment:
one host + five guests, nobody willing → `peopleCount` 6 → `requiredMainDishes`
`max(1, ceil(6/5))` = **2**, `willingCarriers` 0 → `shortfall` **2**, one table so no
donor exists and the deficit is structural.

---

## WHAT THE EXECUTOR MEASURED — RE-RUN IT, DO NOT TRUST IT

- **Deno, tip:** `457 passed / 0 failed`. Parent `456 / 0`. **+1**, matching the plan's
  arithmetic (`P5c +1`).
- **Vitest, tip (quiet run):** `1095 passed / 6 failed` (1101), 209s.
- **Vitest, parent `d5b16e8`** measured by the executor in a clean worktree:
  `1093 passed / 6 failed` (1099), 213s. **+2 exactly**, red set **identical** — the six
  of `MesaAbiertaDashboard.test.tsx`, the base D8.2 declares until P8.
- **Gate D8 over the four paths:** zero new diagnostics. Five differences, all **line
  displacement** (+3, exactly the growth of H4's comment) with byte-identical messages:
  `eslint` 32→35, `deno lint` 299→302, `deno check` 356/151/150→359/154/153. Project
  totals **identical** parent and tip: `tsc=1039 eslint=161 deno-lint=92 deno-check=43`.
- **`npm run build` → exit 0.**

```bash
npx vitest run --no-file-parallelism
cd supabase/functions && deno test --allow-all --no-check .
bash scripts/gates/changed-files-diagnostics.sh \
  supabase/functions/create-mesa-matches/handler.ts \
  supabase/functions/create-mesa-matches/handler_test.ts \
  src/components/mesa-abierta/__tests__/MesaAbiertaSignup.mainDish.test.tsx \
  src/components/mesa-abierta/__tests__/MesaAbiertaAdmin.mainDish.test.tsx
```

### The seventh red — the executor's reasoning is yours to break

The **first** full tip run gave **7 reds**: the six known plus
`CuentacuentoEditor.ph.surfaces` T-H.4. Read literally, D8.2's parent rule makes that
**BLOCKING** — it did not appear in the parent run. The executor argued it is **B-05**
(the documented load flake) on three measurements:

1. the red tip run took **363s** against the parent's **213s** — i.e. a loaded machine,
   which is B-05's stated condition;
2. the file **in isolation and quiet** gives `15/15` on **both** parent and tip, three
   runs each;
3. the full tip suite **re-run quiet** gives `1095/6` in **209s**, without T-H.4 and with
   the parent's exact red set.

Plus the structural argument: nothing in the diff is imported by that file.

**P5a's review already flagged this exact hole** — D8.2's parent rule cannot discriminate
a quiet parent run from a loaded tip run, and the real discriminator is a second tip run.
Decide whether the executor's three measurements discharge it or whether a literal reading
of D8.2 should block. If you think the rule needs amending rather than interpreting, that
belongs under NOTES ON THE PLAN ITSELF — it has now cost two phases.

### Two `CLAUDE.md` gates are not green

Both were reproduced identically at the parent and neither is attributable to this phase:

1. **`npm run lint` exits non-zero, 161 problems** — B-09's number for a clean worktree.
   **0 attributable to `F`.** D8 makes totals an observation, not a criterion.
2. **`npx playwright test` cannot even list.** The layer-1 anti-production guard aborts
   without `.env.test`, because without `VITE_SUPABASE_URL` the E2E client falls back to
   the **production** literal and would write to the database shared with Life OS.
   Standing up a local Supabase is outside this phase and forcing it would violate D12
   and the repo's hard rules. This phase changes no behaviour, so there is no E2E surface.

Judge whether "no behaviour change, therefore no E2E surface" is an acceptable discharge
or whether the repo's gate list needs an explicit carve-out written down.

---

## THE DECLARED DEVIATION

**H7 as written is not satisfiable.** It requires `git diff main..HEAD` to touch only the
four files of `F` plus `LEDGER.md`. But `main..HEAD` necessarily contains `b9675e6`, the
PM's own commit that created the phase (`PLAN.md`, `prompts/P5c-r1.md`). The executor read
it against the executor diff instead: `git diff b9675e6..adc641f` is **exactly** the four
files of `F`. Verify that, and judge whether the reading is right.

The phase's **declared risk did not materialise**: mounting `MesaAbiertaAdmin.tsx` needed
three mocks and a chainable builder, no router and no auth-provider tree. The escape hatch
(`FINDINGS` rather than a weak assertion) was therefore never taken. Confirm that the
scaffolding really is proportionate and that no weak assertion crept in instead.

---

## THE QUESTION THAT HAS PAID OFF SINCE P4

Exhibiting our own mutations proves less than this: **name a change these three tests
would not catch.** It found B-13, B-15 and B-18 — the three this phase exists to close.
Run it again on the new tests themselves.

Specifically, these are *coverage* tests, so the failure mode to hunt is a test that
looks like it guards a seam but guards a mock:

- What could break in the `fetch → dialog` path that H3 stays green through? The test
  asserts the **inbound** direction only; the **save** path back out of the dialog
  (`.update()` with `can_bring_main_dish: !cannotBringMainDish`) is not touched here.
  Is that gap acceptable, or is it the same shape of hole as B-15 itself?
- Could H1 pass while `tablesWithShortfall` carried a wrong `shortfall` number, or while
  the warning fired the wrong number of times?
- Could H2 pass while the host's value reached the row by a different route than the one
  the feature actually uses?

Say whether each is BLOCKING, SHOULD-FIX or noise. **Under the three-state rule adopted
on 2026-08-11, every SHOULD-FIX must be assigned one of: (a) fixed now, (b) an owning
phase with a named criterion, or (c) explicitly accepted as debt with an owner.** The
phase does not close with an item in none of the three — that rule exists precisely
because this workstream's backlog swallowed four items across four phases, which is why
P5c had to be invented.

---

## ALSO CHECK

1. Every criterion **H1–H7** against the code, not the ledger. H1–H3 are the mutation
   checks above; they are not met by reading.
2. **H4** — does `handler.ts`'s new header actually describe the seam as it is after P3b
   and P4? (`shuffle` lives in `matching.ts`; `matching.ts` passes the same `pick` to both
   `shuffle` and `allocateAll`.) And is it **only** a comment — no code touched?
3. **Zero behaviour change anywhere.** The only non-test edit in the whole phase is that
   comment. Any production edit beyond it is BLOCKING.
4. **Scope creep**: exactly four files. No `types.ts`, no migration, no database, no
   `matching.ts` (that is B-14, out), no `* 2.tsx` duplicate, nothing from P6/P7/P8.
5. **D12**: no synthetic row linked to `auth.users`, no real member data anywhere in the
   diff, no committed evidence containing member data.
6. **D10**: Spanish test names and comments, matching the style of the file they live in.
7. Do the new tests assert **behaviour**, or merely execute code? In particular the
   `aria-checked` assertions and the wizard navigation in H2 — the host path requires
   `Dirección de tu hogar *` before `Siguiente` enables, so confirm the test is really
   walking a host and not silently falling back to the guest branch.
8. Anything that makes **P5b, P6, P7 or P8** harder. P6, P7 and P8 all consume
   `results.tablesWithShortfall`; confirm the shape H1 pins is the one they will read.

Review against the plan's contract, not your own preferences. Taste disagreements are
NITs. Only correctness, contract violations, security, and architectural violations are
BLOCKING.

Output using the **CODEX REVIEW** format from the SOP:

```markdown
## CODEX REVIEW — P5c (round 1)
VERDICT: PASS | FAIL
BLOCKING:
- [B1] <finding> — <file:line> — <why it blocks>
SHOULD-FIX:
- [S1] <finding> — <state (a) fixed now / (b) owning phase + criterion / (c) accepted debt + owner>
NITS:
- [N1] ...
NOTES ON THE PLAN ITSELF: <if the plan, not the code, is the problem>
```

Commit your review to `docs/plan/upgrade/reviews/REVIEW-P5c.md` on the branch and push it.
Five of the six previous reviews needed the PM to chase the file into the repo.
