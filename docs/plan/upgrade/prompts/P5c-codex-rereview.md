SESSION: UPGRADE · P5c · r2 · RE-REVIEW

Re-review of phase **P5c — Guardas de cobertura huérfanas** after your `FAIL(1)` on
round 1. **You have final say; the phase does not close until you pass it.**

- **Parent:** `main`@`d5b16e8` · **Last content commit:** `66e3a50`
- **Cumulative executor diff:** `b9675e6..<tip>` (`b9675e6` is the PM's bootstrap
  commit — contract, not executor work).
- **Code commits — the only ones that matter for review:** `56505ae` (r1) + `7b6f837`
  (r2). Ledger: `adc641f`, `66e3a50`.
- The branch tip sits **above** `66e3a50` because this prompt is itself committed to
  `docs/plan/upgrade/prompts/`. Anything above `66e3a50` is docs-only; verify that
  rather than assuming it (`git diff --stat 66e3a50..<tip>`).
- Your r1 review is committed at `ef40be9`,
  `docs/plan/upgrade/reviews/REVIEW-P5c.md`.

Use **Node v22.22.0** and the `deno` on your `PATH` (you used
`/opt/homebrew/bin/deno` 2.7.11 — same binary, please, and say so).
Clean worktree cut from `d5b16e8`.

---

## WHAT YOU FOUND, AND WHAT I DID WITH IT

**Both findings were accepted without argument. Neither was disputed, narrowed, or
deferred.** r2 changes **exactly two test files** — `handler_test.ts` and
`MesaAbiertaSignup.mainDish.test.tsx`. **No production file changed in r2**, and the
whole phase still touches only the four files of `F`. The comment in `handler.ts` is
still the only non-test edit in P5c.

### B1 (BLOCKING) — the D12 assertion was a façade

You were right, and the irony is worth stating: r1 put synthetic PII into the fixtures
*precisely* so the assertion would not be vacuous, then made it vacuous at the capture
step. `args.map(String).join(" ")` turns a participant into `"[object Object]"` before
the test ever looks at it.

The fix keeps the arguments **raw** (`unknown[][]`) and asserts the **shape of the call**,
not just its text:

- `warnCalls.length === 1`
- `warnCalls[0].length === 1` — **exactly one argument**
- `typeof warnCalls[0][0] === "string"`
- the **full exact message**, replacing the `includes("h1")` / `includes("2")` pair —
  which, as you noted, did not pin the numeral
- underneath, `deepRender()` (JSON with a `Deno.inspect` fallback for circular values)
  sweeping for every `PII` value and `@` across **everything** the logger received

### S1 (SHOULD-FIX, state (a) — fixed now, not deferred)

The host walk switched the toggle on before its only submit, so it could not separate
"the host **can** opt out" from "the host **is always** opted out". It now drives **both
polarities**, mirroring the guest test: untouched submit asserts
`can_bring_main_dish: true` (D2), toggled submit asserts `false`.

---

## RE-RUN ALL FIVE MUTATIONS — THE THREE ORIGINALS AND YOUR TWO

The two new ones are the point of this round. **Your r1 counter-mutations must now go
red, and the three originals must still go red.**

```bash
# --- your two, which were GREEN in r1 ---
# B1a  handler.ts:~195  add `participants[0]` as a SECOND argument to console.warn
#      r1: 1/1 green.  Expected now: red on arity (2 != 1).
# S1   MesaAbiertaSignup.tsx:125
#      `cannotBringMainDish: rolePreference === 'host' ? true : cannotBringMainDish,`
#      r1: 5/5 green.  Expected now: red — `true` expected, `false` received.

# --- the three originals, which must not have regressed ---
# H1   handler.ts:~349  `tablesWithShortfall,` → `tablesWithShortfall: [],`
# H2   MesaAbiertaSignup.tsx:373  wrap the switch block in `{rolePreference === 'guest' && ( … )}`
# H3   MesaAbiertaAdmin.tsx:239   delete `can_bring_main_dish` from the `select`

# Revert every one. `git status` must end clean.
```

**A second B1 leak shape I added myself, because your mutation only covers one.** A leak
can arrive as a second argument *or* embedded in the single string. Verify both:

```bash
# B1b  handler.ts, inside the existing console.warn, append to the string:
#        .join(", ") + " " + JSON.stringify(participants[0]),
#      Expected: red on the exact-message assertion. The failure output should print
#      the full leak, including "Ana Fulana" and "ana.fulana@example.invalid".
```

---

## ATTACK THE NEW ASSERTIONS — THREE THINGS I WANT JUDGED

**1. Is the exact-message golden the right instrument, or is it brittle?**
It pins D4's warning byte-for-byte. That is what makes B1b fail, and it is the repo's
idiom — but a benign rewording in P6/P7 breaks it. Say whether you want it kept as-is,
loosened to a structural assertion, or paired with something more durable. **I would
rather be told now than have P7 discover it.**

**2. `deepRender()` never actually fires — is that acceptable, or is it dead weight?**
I am disclosing this rather than letting you find it. While the exact-message assertion
stands, it catches **both** leak shapes first, so the deep sweep is never reached. It is
defence-in-depth for the day someone relaxes the golden, not an independently exercised
guard. The ledger says so explicitly so nobody counts it twice. Rule on whether an
unexercised backstop belongs in this file at all, or whether it should be deleted as
unreachable code that gives false comfort — **a test helper that never runs is exactly
the kind of thing this phase exists to delete, so I will not defend it if you say cut it.**

**3. Does the two-polarity host walk actually close S1, or is there a third case?**
The guest path already covers both polarities (pre-existing test 4). The host path now
does too. Ask whether a mutation exists that discriminates host from guest and still
survives both — e.g. something keyed on `preferredRole` versus `rolePreference`, or on
the step-3 branch rather than the payload.

---

## AND THE STANDING QUESTION

**Name a change these tests would not catch.** It has produced something every round
since P4 — B-13, B-15, B-18, then your B1 and S1. Run it once more on the r2 state.

Under the three-state rule, any SHOULD-FIX you raise must land in (a) fixed now,
(b) an owning phase with a named criterion, or (c) accepted debt with an owner. **The
phase does not close with an item in none of the three.**

---

## GATES — RE-RUN, DO NOT TRUST

- **Deno:** tip `457 / 0`, parent `456 / 0`. **+1**.
- **Vitest:** tip **`1095 passed / 6 failed`** (1101) in 216s — the six of
  `MesaAbiertaDashboard.test.tsx` and nothing else. Parent `1093 / 6` (1099). **+2**.
- **The seventh red did not reappear.** That is now the third consecutive measurement
  pointing at load (B-05) rather than the commit, consistent with your own repetition.
- **Gate D8** vs `d5b16e8`: zero new diagnostics; the same five **line-displacement**
  deltas (+3) with byte-identical messages. Totals identical:
  `tsc=1039 eslint=161 deno-lint=92 deno-check=43`. `handler_test.ts` remains 0/0/0/0 —
  confirm `deepRender`'s `Deno.inspect` call added no `deno lint` or `deno check`
  diagnostic.
- **`npm run build`** → exit 0.
- **Unchanged from r1 and already discharged by you:** `npm run lint` (161 pre-existing,
  0 attributable to `F`) and `npx playwright test` (anti-production guard, no
  `.env.test`, identical at parent and tip).

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

## YOUR THREE PLAN NOTES ARE ACCEPTED AND ROUTED TO THE PM

They are recorded in the ledger for `/pm-boot`. **Do not re-raise them as code blockers
against P5c** — none is fixable inside a phase that ships three tests and a comment. Do
re-raise any of them under NOTES ON THE PLAN ITSELF if you think the routing is wrong:

1. **H7 is mis-scoped.** It should name the `b9675e6..adc641f` boundary, not `main..HEAD`,
   which necessarily contains the PM's bootstrap commit.
2. **D8.2 should formalise "re-run the tip first; compare to the parent only if it
   persists."** Its current literal punishes a loaded tip against a quiet parent. It has
   now cost two phases.
3. **The conflict between `CLAUDE.md`'s absolute gate list and D8 needs an explicit
   carve-out for behaviour-free phases**, rather than being reinterpreted every review.

---

Review against the plan's contract, not your own preferences. Taste disagreements are
NITs. Only correctness, contract violations, security, and architectural violations are
BLOCKING.

Output using the **CODEX REVIEW** format from the SOP:

```markdown
## CODEX REVIEW — P5c (round 2, cumulative)
VERDICT: PASS | FAIL
BLOCKING:
- [B1] <finding> — <file:line> — <why it blocks>
SHOULD-FIX:
- [S1] <finding> — <state (a) fixed now / (b) owning phase + criterion / (c) accepted debt + owner>
NITS:
- [N1] ...
NOTES ON THE PLAN ITSELF: <if the plan, not the code, is the problem>
```

Append round 2 to `docs/plan/upgrade/reviews/REVIEW-P5c.md` — **append, do not rewrite
round 1** — and push it to `origin/feat/mesa-md-guards`.
