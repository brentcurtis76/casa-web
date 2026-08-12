> **SUPERSEDED — DO NOT REVIEW FROM THIS FILE.**
> Kept only as the historical prompt for its round. The single current review
> prompt is `docs/plan/upgrade/prompts/P5c-codex-rereview-r5.md`.

SESSION: UPGRADE · P5c · r4 · RE-REVIEW

**Historical r4 prompt.** Its verdict is committed at `7d01fa4`; use the r5 prompt named
in the banner above for the amended-contract review.

---

## STOP — VERIFY YOU ARE ON THE RIGHT TREE BEFORE REVIEWING ANYTHING

**Your last verdict was round 2, committed as `f6a3c53`.** Two rounds of code have landed
since. A previous attempt at this re-review re-emitted the round-2 verdict verbatim, which
means it read a stale tree. Run these five checks first and **report the outputs at the
top of your review**:

```bash
git fetch origin && git checkout feat/mesa-md-guards && git pull --ff-only

git log --oneline | grep -c 6b98e74     # must be 1 — r3 code
git log --oneline | grep -c 7fb483b     # must be 1 — r4 code
grep -c 'round 4' docs/plan/upgrade/reviews/REVIEW-P5c.md   # must be 0 — you have not reviewed r4 yet
grep -c 'invitado de producción' \
  src/components/mesa-abierta/__tests__/MesaAbiertaSignup.mainDish.test.tsx   # must be >= 1
grep -c 'deepRender' \
  supabase/functions/create-mesa-matches/handler_test.ts    # must be 0 — you asked for its removal
```

**If any check fails, do not review — report the mismatch and stop.**
**If your output is about to say "round 2", or to raise the step-1 host path as a new
SHOULD-FIX, you are on a stale tree.** Both were fixed in `6b98e74`.

- **Parent:** `main`@`d5b16e8` · **Last content commit:** `fee5203`
- **Cumulative executor diff:** `b9675e6..<tip>` (`b9675e6` is the PM's bootstrap
  commit — contract, not executor work).
- **Code commits:** `56505ae` (r1) · `7b6f837` (r2) · `6b98e74` (r3) · `7fb483b` (r4).
- Your reviews so far: `ef40be9` (r1), `f6a3c53` (r2), both in
  `docs/plan/upgrade/reviews/REVIEW-P5c.md`.
- Anything above `fee5203` is docs-only. Verify rather than assume:
  `git diff --stat fee5203..<tip>`.

Use **Node v22.22.0** and the `deno` on your `PATH` (`/opt/homebrew/bin/deno` 2.7.11).
Clean worktree cut from `d5b16e8`.

---

## WHAT HAPPENED IN THE TWO ROUNDS YOU HAVE NOT SEEN

### r3 (`6b98e74`) — closed your round-2 SHOULD-FIX

Added `el anfitrión elegido en el paso 1 también puede excluirse`, driving **both
polarities**, and **removed `deepRender()`** as you ruled. Your round-2 mutation
(`preferredRole`-keyed, which survived 5/5) now falls.

### r4 (`7fb483b`) — the stop rule, not a finding

No verdict from you triggered this. §5 of `~/.claude/agent-workflow/LEAN-WORKFLOW.md`
says: **"Two consecutive Codex failures in the same defect category require a hypothesis
change or phase split before more code."** Your r1 `S1` and your r2 SHOULD-FIX **are the
same category** — *a dimension the tests never vary lets a mutation keyed on it survive*.
r3 was another serial patch and did not honour that rule. r4 does.

**There are therefore two separable things to judge**, and I want both ruled on:

1. whether the code is right, and
2. whether **r4 was legitimate work or unrequested scope growth**. It added a test you
   never asked for. If an executor should have returned `FINDINGS` instead of widening
   coverage on its own initiative, **say so** — that ruling matters more to this
   workstream than the diff does.

---

## THE HYPOTHESIS CHANGE, AND WHAT IT TURNED UP

Rather than wait for you to find the fourth instance, I enumerated the grid
`role × entry path × polarity` (8 cells) and checked it against **what production
actually does** — a command, not a memory:

```
MesaAbiertaSection.tsx:730   preferredRole={signupRole}
MesaAbiertaSection.tsx:53    const [signupRole, setSignupRole] = useState<'host'|'guest'>('guest')
```

**Production always passes `preferredRole`.** So `preferredRole === undefined` is a state
the application **never produces** — and it was the *only* entry path exercised by **P5a's
four guest tests** *and* by the host test I added in r3.

**Plainly: no test touched the real guest path**, which is most sign-ups. A condition on
`preferredRole === 'guest'` switches the opt-out off for **every real guest** and left all
six tests green. That is worse than what you found in r2, and it sat under both of your
reviews and all three of my rounds.

**Fixed without touching P5a's tests:**

1. `advanceToStep3ChoosingHostInStep1` now enters with `preferredRole="guest"` — the real
   "came in as a guest, changed my mind" path, and the only combination where a condition
   on the **prop** differs from one on the **state**. (r3 entered with the prop absent,
   which production never does.)
2. New test `el invitado de producción entra con preferredRole y conserva el opt-out`,
   **both polarities**.

---

## MUTATIONS — TEN. THE TWO NEW ONES ARE THE POINT

Both new ones **survived the r3 suite** and must now fall, and in each **only the new test
should fall** (1 failed / 6 passed against r3's set; 1/7 against r4's).

```bash
# R4a — hide the switch from every PRODUCTION guest.  MesaAbiertaSignup.tsx:373
#   {!(preferredRole === 'guest' && rolePreference === 'guest') && ( … )}
#
# R4b — force exclusion on production guests, payload side.  MesaAbiertaSignup.tsx:125
#   cannotBringMainDish: preferredRole === 'guest' && rolePreference === 'guest'
#                          ? true : cannotBringMainDish,

# --- the eight that must not have regressed ---
# H1   handler.ts:~349  `tablesWithShortfall,` → `tablesWithShortfall: [],`
# H2   MesaAbiertaSignup.tsx:373  `{rolePreference === 'guest' && ( … )}`
# H3   MesaAbiertaAdmin.tsx:239   delete `can_bring_main_dish` from the `select`
# B1a  handler.ts:~195  add `participants[0]` as a SECOND argument to console.warn
# B1b  handler.ts:~199  `.join(", ") + " " + JSON.stringify(participants[0]),`
# S1   MesaAbiertaSignup.tsx:125  `rolePreference === 'host' ? true : cannotBringMainDish`
# R3a  MesaAbiertaSignup.tsx:373  `{(preferredRole === 'host' || rolePreference === 'guest') && ( … )}`
#      — YOUR r2 mutation. Confirm it still falls now the helper uses preferredRole="guest".
# R3b  MesaAbiertaSignup.tsx:125  `preferredRole === undefined && rolePreference === 'host' ? true : …`

# Revert every one. `git status` must end clean.
```

**Note on R3b, against my own interest.** It keys on `preferredRole === undefined`, which
production never produces — a mutation that cannot affect users. It still falls, because
P5a's tests use that entry. **A mutation that only breaks an unreachable path is weak
evidence**; if you think R3b should be struck from the list, strike it.

---

## THE GRID — RULE ON WHETHER IT IS COMPLETE

The artifact I most want checked. If it is wrong, the phase fails a fourth time on the
same shape.

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

**Every production-reachable cell is covered.** Two questions I want answered, not assumed:

1. **Is `role × entry × polarity` the right factorisation**, or is the grid a comforting
   fiction with a missing fourth axis? Candidates I considered and did **not** cover:
   changing the role *back* (host → guest in step 1 after toggling — does
   `cannotBringMainDish` survive a role change?); navigating backwards from step 5; `open`
   toggling false→true remounting the wizard. I judged all three out of scope for a debt
   phase and none is B-18. **Tell me if that is wrong** — especially the first, which is
   real reachable behaviour that no test in this repo pins.
2. **Is covering unreachable cells 3–4 acceptable?** I left P5a's tests alone because the
   executor prompt forbids rewriting them. The result is four tests exercising a path
   production cannot produce. Cheap — but coverage theatre if counted as protecting users.

---

## WHAT CHANGED SINCE YOUR r2 RULINGS

- **Exact warning golden: kept**, as you ruled.
- **`deepRender()`: removed.** You called removal a NIT; I removed it anyway, having
  already disclosed in r2 that it never executes. Verified the golden alone still catches
  **both** PII leak shapes (B1a by arity, B1b by exact equality).
- **No production file changed in r3 or r4.** The phase still touches exactly the four
  files of `F`; the `handler.ts` comment is still the only non-test edit.

---

## GATES — RE-RUN, DO NOT TRUST

- **Deno:** tip `457 / 0`, parent `456 / 0`. **+1**.
- **Vitest:** tip **`1097 passed / 6 failed`** (1103) in 221s — the six of
  `MesaAbiertaDashboard.test.tsx` and nothing else. Parent `1093 / 6` (1099). **+4**.
  (Your environment measured different absolutes in r2 — 1087/14 vs my 1095/6, the B-10
  `localStorage` family. **The delta is the criterion, not the absolute**; report yours.)
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

**P5c's Vitest arithmetic has moved `+2` → `+4`** (`+3` at the end of r3). Plan total
1072 → **1074**. Deno unchanged at `+1`. The two extra tests come from your r2 SHOULD-FIX
and from the stop rule, not from scope I chose — **but the plan says `+2`, and a phase
that quietly outgrows its own arithmetic is exactly the drift D8 exists to catch.** Rule
on whether this is acceptable drift to record or a phase-boundary problem.

The three plan notes from your r1 remain open for the PM and are **not** fixable inside
this phase — do not re-raise them as code blockers: H7's boundary, formalising D8.2
("re-run the tip first"), and the `CLAUDE.md`/D8 gate carve-out for behaviour-free phases.

---

Review against the plan's contract, not your own preferences. Taste disagreements are
NITs. Only correctness, contract violations, security, and architectural violations are
BLOCKING.

**Two `FAIL` verdicts are on the board; a third forces stop-and-re-plan under §5.** That
is not a reason to go easy. It is a reason to be precise about the category: **if you find
a fifth instance of "an unvaried dimension", the right output is probably `FINDINGS` —
returning the phase to the PM — not a fourth `FAIL` for me to patch.** Three rounds of
serial patching is itself evidence that the contract, not the code, needs changing.

Output using the **CODEX REVIEW** format from the SOP:

```markdown
## CODEX REVIEW — P5c (round 4, cumulative)
STATE CHECKS: <the five outputs from the STOP block>
VERDICT: PASS | FAIL | FINDINGS
BLOCKING:
- [B1] <finding> — <file:line> — <why it blocks>
SHOULD-FIX:
- [S1] <finding> — <state (a) fixed now / (b) owning phase + criterion / (c) accepted debt + owner>
NITS:
- [N1] ...
RULING ON r4's LEGITIMACY: <correct, or should it have been FINDINGS?>
RULING ON THE GRID: <complete / missing axis>
NOTES ON THE PLAN ITSELF:
```

Append round 4 to `docs/plan/upgrade/reviews/REVIEW-P5c.md` — **append, do not rewrite
rounds 1–2** — and push it to `origin/feat/mesa-md-guards`.
