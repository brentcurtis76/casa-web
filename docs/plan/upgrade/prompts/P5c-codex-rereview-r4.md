SESSION: UPGRADE · P5c · r4 · RE-REVIEW

Re-review of phase **P5c — Guardas de cobertura huérfanas** after your `FAIL` on round 2.
**You have final say; the phase does not close until you pass it.**

- **Parent:** `main`@`d5b16e8` · **Last content commit:** `fee5203`
- **Cumulative executor diff:** `b9675e6..<tip>` (`b9675e6` is the PM's bootstrap
  commit — contract, not executor work).
- **Code commits:** `56505ae` (r1) · `7b6f837` (r2) · `6b98e74` (r3) · `7fb483b` (r4).
- Your reviews: `ef40be9` (r1), `f6a3c53` (r2), in
  `docs/plan/upgrade/reviews/REVIEW-P5c.md`.
- Anything above `fee5203` is docs-only (this prompt). Verify rather than assume:
  `git diff --stat fee5203..<tip>`.

Use **Node v22.22.0** and the `deno` on your `PATH` (`/opt/homebrew/bin/deno` 2.7.11).
Clean worktree cut from `d5b16e8`.

---

## READ THIS FIRST — WHERE THE STOP RULE PUTS US

**Two `FAIL` verdicts are on the board. A third forces stop-and-re-plan** under §5 of
`~/.claude/agent-workflow/LEAN-WORKFLOW.md`. That is not an argument for going easy; it
is the reason this round is shaped differently, and you should know it before you read
the diff.

The same section also says: **"Two consecutive Codex failures in the same defect category
require a hypothesis change or phase split before more code."** Your r1 `S1` and your r2
SHOULD-FIX **are the same category** — *a dimension the tests never vary lets a mutation
keyed on that dimension survive*. r3 did not honour that rule: it was another serial
patch. **r4 exists to honour it, and it ran without a verdict from you in between.**

So there are two things to judge, and they are separable:

1. whether the code is right, and
2. whether **r4 was legitimate work or unrequested scope growth**. It added a test you
   did not ask for. If you think an executor should have stopped and returned `FINDINGS`
   instead of widening coverage on its own initiative, **say so** — that ruling matters
   more to this workstream than the diff does.

---

## THE HYPOTHESIS CHANGE, AND WHAT IT TURNED UP

Instead of waiting for you to find the fourth instance, I enumerated the grid
`role × entry path × polarity` (8 cells) and checked it against **what production
actually does**, which is a command, not a memory:

```
MesaAbiertaSection.tsx:730   preferredRole={signupRole}
MesaAbiertaSection.tsx:53    const [signupRole, setSignupRole] = useState<'host'|'guest'>('guest')
```

**Production always passes `preferredRole`.** Therefore `preferredRole === undefined` is
a state the application **never produces** — and it was the *only* entry path exercised
by **P5a's four guest tests** *and* by the host test I added in r3.

**Stated plainly: no test touched the real guest path**, which is most of the sign-ups.
A condition on `preferredRole === 'guest'` switches the opt-out off for **every real
guest** and left all six tests green. That is worse than what you found in r2, and it was
sitting under both of your reviews and all three of mine.

**The fix, without touching P5a's tests:**

1. `advanceToStep3ChoosingHostInStep1` now enters with `preferredRole="guest"` — the real
   "I came in as a guest and changed my mind" path, and the only combination where a
   condition on the **prop** differs from one on the **state**. (In r3 it entered with the
   prop absent, which production never does.)
2. New test `el invitado de producción entra con preferredRole y conserva el opt-out`,
   **both polarities**.

---

## MUTATIONS — TEN NOW. THE TWO NEW ONES ARE THE POINT

Both new ones **survived the r3 suite** and must now fall, and in each only the new test
should fall (**1 failed / 6 passed** against the r3 test set; 1/7 against r4's).

```bash
# R4a — hide the switch from every PRODUCTION guest.  MesaAbiertaSignup.tsx:373
#   wrap the switch block in:
#   {!(preferredRole === 'guest' && rolePreference === 'guest') && ( … )}
#
# R4b — force exclusion on production guests, payload side.  MesaAbiertaSignup.tsx:125
#   cannotBringMainDish: preferredRole === 'guest' && rolePreference === 'guest'
#                          ? true : cannotBringMainDish,

# --- and the eight that must not have regressed ---
# H1   handler.ts:~349  `tablesWithShortfall,` → `tablesWithShortfall: [],`
# H2   MesaAbiertaSignup.tsx:373  wrap the switch in `{rolePreference === 'guest' && ( … )}`
# H3   MesaAbiertaAdmin.tsx:239   delete `can_bring_main_dish` from the `select`
# B1a  handler.ts:~195  add `participants[0]` as a SECOND argument to console.warn
# B1b  handler.ts:~199  `.join(", ") + " " + JSON.stringify(participants[0]),`
# S1   MesaAbiertaSignup.tsx:125  `rolePreference === 'host' ? true : cannotBringMainDish`
# R3a  MesaAbiertaSignup.tsx:373  `{(preferredRole === 'host' || rolePreference === 'guest') && ( … )}`
#      — YOUR r2 mutation. Confirm it still falls now that the helper uses preferredRole="guest".
# R3b  MesaAbiertaSignup.tsx:125  `preferredRole === undefined && rolePreference === 'host' ? true : …`

# Revert every one. `git status` must end clean.
```

**Note on R3b.** It keys on `preferredRole === undefined`, which production never
produces — so it is a mutation that cannot affect users. It still falls, because P5a's
tests use that entry. I am flagging it rather than counting it as a win: **a mutation
that only breaks an unreachable path is weak evidence**, and if you think R3b should be
struck from the evidence list, strike it.

---

## THE GRID — RULE ON WHETHER IT IS COMPLETE

This is the artifact I most want checked, because if it is wrong the phase will fail a
fourth time on the same shape.

| # | role | entry | polarity | covered by |
|---|---|---|---|---|
| 1 | guest | `preferredRole="guest"` (**production**) | untouched | r4 test |
| 2 | guest | `preferredRole="guest"` (**production**) | toggled | r4 test |
| 3 | guest | prop absent (**not reachable**) | untouched | P5a test 4 |
| 4 | guest | prop absent (**not reachable**) | toggled | P5a test 4 |
| 5 | host | `preferredRole="host"` (**production**) | untouched | r1 host test |
| 6 | host | `preferredRole="host"` (**production**) | toggled | r1 host test |
| 7 | host | `preferredRole="guest"` → step 1 (**production**) | untouched | r3/r4 test |
| 8 | host | `preferredRole="guest"` → step 1 (**production**) | toggled | r3/r4 test |

**Every production-reachable cell is covered.** Questions I want answered rather than
assumed:

1. **Is `role × entry × polarity` the right factorisation at all**, or is there a fourth
   axis that makes this grid a comforting fiction? Candidates I considered and did not
   cover: changing the role *back* (host → guest in step 1 after toggling the switch, i.e.
   does `cannotBringMainDish` survive a role change?); navigating backwards from step 5;
   `open` toggling false→true remounting the wizard. **I judged all three out of scope for
   a debt phase and none is B-18. Tell me if that judgement is wrong** — particularly the
   first, which is real reachable behaviour and which no test in the repo pins.
2. **Is covering unreachable cells 3–4 acceptable?** I left P5a's tests alone rather than
   retarget them, because the executor prompt forbids rewriting the existing tests. The
   result is four tests exercising a path production cannot produce. Cheap, but it is
   coverage theatre if it is counted as protecting real users.

---

## WHAT CHANGED SINCE YOUR r2 RULINGS

- **Exact warning golden: kept**, as you ruled.
- **`deepRender()`: removed.** You called it redundant and removal a NIT; I removed it,
  because I had already disclosed in r2 that it never executes. Verified the golden alone
  still catches **both** PII leak shapes (B1a by arity, B1b by exact equality).
- **No production file changed** in r3 or r4. The whole phase still touches exactly the
  four files of `F`, and the `handler.ts` comment is still the only non-test edit.

---

## GATES — RE-RUN, DO NOT TRUST

- **Deno:** tip `457 / 0`, parent `456 / 0`. **+1**.
- **Vitest:** tip **`1097 passed / 6 failed`** (1103) in 221s — the six of
  `MesaAbiertaDashboard.test.tsx` and nothing else. Parent `1093 / 6` (1099). **+4**.
- **Fifth consecutive run with no seventh red** (B-05).
- **Gate D8** vs `d5b16e8`: zero new diagnostics; the same five line-displacement deltas
  (+3). Totals identical: `tsc=1039 eslint=161 deno-lint=92 deno-check=43`.
- **`npm run build`** → exit 0.
- **Unchanged and already discharged by you in r1:** `npm run lint` (161 pre-existing,
  0 in `F`) and `npx playwright test` (anti-production guard, no `.env.test`).

```bash
npx vitest run --no-file-parallelism
cd supabase/functions && deno test --allow-all --no-check .
bash scripts/gates/changed-files-diagnostics.sh \
  supabase/functions/create-mesa-matches/handler.ts \
  supabase/functions/create-mesa-matches/handler_test.ts \
  src/components/mesa-abierta/__tests__/MesaAbiertaSignup.mainDish.test.tsx \
  src/components/mesa-abierta/__tests__/MesaAbiertaAdmin.mainDish.test.tsx
```

---

## PLAN DRIFT YOU SHOULD RULE ON

**P5c's Vitest arithmetic has moved `+2` → `+4`** (it was `+3` at the end of r3). Plan
total 1072 → **1074**. Deno unchanged at `+1`. The two extra tests come from your r2
SHOULD-FIX and from the stop rule, not from scope I chose — **but the plan says `+2`, and
a phase that quietly outgrows its own arithmetic is exactly the drift D8 exists to
catch.** Say whether this is acceptable drift to record, or a phase-boundary problem.

The three plan notes from your r1 remain open for the PM and are **not** fixable inside
this phase — do not re-raise them as code blockers: H7's boundary, formalising D8.2
("re-run the tip first"), and the `CLAUDE.md`/D8 gate carve-out for behaviour-free phases.

---

Review against the plan's contract, not your own preferences. Taste disagreements are
NITs. Only correctness, contract violations, security, and architectural violations are
BLOCKING.

**If you find a fifth instance of the same defect category, the right output is probably
not another `FAIL` for me to patch — it is `FINDINGS`, returning the phase to the PM.**
Three rounds of serial patching is itself the evidence that the contract, not the code,
is what needs changing.

Output using the **CODEX REVIEW** format from the SOP:

```markdown
## CODEX REVIEW — P5c (round 4, cumulative)
VERDICT: PASS | FAIL | FINDINGS
BLOCKING:
- [B1] <finding> — <file:line> — <why it blocks>
SHOULD-FIX:
- [S1] <finding> — <state (a) fixed now / (b) owning phase + criterion / (c) accepted debt + owner>
NITS:
- [N1] ...
RULING ON r4's LEGITIMACY: <was widening coverage without a verdict correct, or should it have been FINDINGS?>
RULING ON THE GRID: <complete / missing axis>
NOTES ON THE PLAN ITSELF:
```

Append round 4 to `docs/plan/upgrade/reviews/REVIEW-P5c.md` — **append, do not rewrite
rounds 1–2** — and push it to `origin/feat/mesa-md-guards`.
