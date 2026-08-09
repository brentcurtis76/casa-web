SESSION: UPGRADE · P3a · REVIEW

Final review of phase **P3a — Seam: `handler.ts` en `create-mesa-matches`** for **UPGRADE**
(La Mesa Abierta · opt-out del plato principal).

Read `docs/plan/upgrade/PLAN.md` for the acceptance criteria (§ "Phase P3a", criteria C1–C7)
and the frozen decisions (D8, D10, D11, D12, D13), then review branch **`feat/mesa-md-seam`**
at **`d65310b`**, whose parent is `main`@`1d6869d`.

You have final say on BLOCKING items. The phase does not close until you pass it.

Use **Node v22.22.0** and run from a clean worktree — see the ESLint warning below, it matters.

---

## WHAT THIS PHASE IS

`create-mesa-matches/index.ts` was a 512-line Edge Function with `serve()` at import time, so
nothing could test it. P3a cuts it into the seam five other functions in this repo already use:
`handler.ts` (all request logic, `createHandler(deps)` with an injectable `pick`), a 22-line
`index.ts` (env + client + `serve`), and `handler_test.ts` (10 goldens against an in-memory
Supabase double). **D13 requires this split. The phase changes no behaviour.**

**The hard rule is `conducta idéntica`, and the way it is established is that the move is
verbatim.** The PM verified this mechanically rather than by reading: reconstructing the
expected block from `1d6869d` (old `index.ts` lines 12–16 + 23–501, minus the env/client
stanza) and diffing it against the body of `handler.ts` gives **484 lines vs 484**, with
`diff -w` reporting **exactly four differing lines** — the four `shuffle(...)` calls that gained
a `, pick` argument. That is edit 3 of the four permitted edits, and nothing else changed.
**Please re-run that comparison yourself.** If it holds, most of C1–C5 follows from it; if it
does not, the phase's central claim is false and everything else is secondary.

---

## THREE THINGS YOU MUST BE TOLD, OR YOU WILL FAIL THIS PHASE FOR THE WRONG REASON

**1. `handler.ts` ships with 11 diagnostics on purpose. Six of them are displaced, not new.**

`index.ts` was never clean: at the parent it carried `(0)(0)(4)(6)` — 4 `deno lint` and 6
`deno check`. Eight of those ten were attached to code this phase moves, so they moved with it
into a file whose baseline was zero. The PM classified that as **displacement, not new
diagnostics**, under D8.4's existing manual-classification clause ("mismo mensaje, otra línea —
aceptable"), and recorded it as backlog **B-08** before the round started. Repairing them
inside the move was explicitly forbidden, because a moved block that also changed is a block
whose behaviour nobody can verify by diffing.

The end state, measured:

| File | tsc | eslint | deno lint | deno check |
|---|---|---|---|---|
| `handler.ts` | 0 | **1** | **2** | **8** |
| `index.ts` | 0 | 0 | 0 | 0 |
| `handler_test.ts` | 0 | 0 | 0 | 0 |

Of `handler.ts`'s 8 `deno check` + 1 eslint: **6 are displaced** (1× TS18046 `error.message`,
5× TS7006 on `g`/`guest`/`j`). **Three are genuinely new, and they are the PM's fault, not the
executor's** — a consequence of the prompt prescribing `HandlerDeps.supabase: SupabaseLike =
any`, which the injectable seam requires:

- 2× `TS7006` on `p` at `handler.ts:144–145`. In `index.ts`, `supabase` was the typed
  `createClient(...)` result, so `participants` had a contextual type and `p` inherited it; a
  *contextual* `any` does not trip `noImplicitAny`, a *bare* `any` does.
- 1× `@typescript-eslint/no-explicit-any` at `handler.ts:26`. The mandated
  `// deno-lint-ignore no-explicit-any` silences `deno lint`, not ESLint. Note
  `_shared/adminAuth.ts:13` — the exemplar the plan itself cites — carries the identical error.

All three are accepted as declared consequences of D13's seam. **P4's baseline is
`(0)(1)(2)(8)`.** If you think any of the 6 displaced ones is actually a *new* diagnostic in
disguise, say so — that is exactly the judgement D8.4 reserves for the reviewer.

**2. The Deno test command was amended mid-phase, and the amendment is the phase's one real
finding.** The executor discovered that `deno test` type-checks its import graph. The suite was
green with `index.ts` carrying 6 errors *only because no test imported it*. The moment
`handler_test.ts` imports `handler.ts`, those errors enter the graph and `deno test` refuses to
run **the entire suite** — zero tests, not zero failures. So "displace the diagnostics" and
"`deno test` → 438 passed" could not both be true.

D8 point 3 and C6 are now **`deno test --allow-all --no-check .`** (Decision Log, 2026-08-08,
Brent's call). The justification, which the PM verified and you should too: **this loses no type
coverage**, because D8 point 4 already runs `deno check .` over the whole functions tree and
that command enumerates `_test.ts` files — `deno check create-mesa-matches/handler_test.ts` on
its own surfaces all 8 handler errors. The type-check inside `deno test` was duplication, not
additional coverage. **If you disagree that coverage is preserved, that is a BLOCKING finding
and the plan needs revisiting.**

**3. The project-wide ESLint total is not portable, so do not treat a mismatch as a regression.**
The plan's figure is **160**, correct in a clean checkout. A checkout that has run
`supabase start` reports **347**, because `eslint.config.js` does not ignore `supabase/.temp/`
and the generated local Edge runtime there contributes **186** diagnostics in one file. That
cost the executor a misattributed finding. Filed as **B-09**. Per D8.5 the totals are an
observation, never a criterion; the **per-file** counts in the table above are the portable
numbers and the ones that decide C7.

---

## ACCEPTANCE CRITERIA — verify each against the code, not the ledger

- **C1** — `handler.ts` calls neither `serve()` nor `Deno.env`.
- **C2** — `createHandler` accepts `pick`; the default preserves behaviour. The substitution is
  `Math.floor(Math.random() * (i + 1))` → `pick(i + 1)`; confirm the range is identical and
  there is no off-by-one.
- **C3** — 10 goldens pass against an in-memory double (D12: no real database, no `auth.users`
  linkage, no mutation of the shared instance).
- **C4** — food covered by tests 5 and 6, partial redistribution by test 8.
- **C5** — the authorization → status → deadline → idempotency guards keep their order and all
  return before the first write. Tests 1 and 2 assert `db.ops.length === 0`; tests 3, 4 and 10
  assert `db.writes().length === 0`; test 2 also asserts `req.json()` was never called.
- **C6** — `cd supabase/functions && deno test --allow-all --no-check .` → **438 passed / 0
  failed** (+10).
- **C7** — the gate table above; `npm run build` exit 0.

Gate command:

```bash
./scripts/gates/changed-files-diagnostics.sh \
  supabase/functions/create-mesa-matches/handler.ts \
  supabase/functions/create-mesa-matches/index.ts \
  supabase/functions/create-mesa-matches/handler_test.ts
```

Vitest: `npx vitest run --no-file-parallelism` → **1063 / 6**, the six being the declared D8.2
base set in `MesaAbiertaDashboard.test.tsx`. `F` contains no file Vitest loads, so any red is
pre-existing by construction. Three `CuentacuentoEditor.ph.*` files flake under load (**B-05**)
and can add a seventh.

---

## WHERE TO PUSH HARDEST

1. **Is the move really verbatim?** Re-run the 484-line comparison. This is the phase.
2. **Does the double test behaviour, or just execute code?** It is ~130 lines, hand-written in
   `handler_test.ts` (nothing reusable existed — `_shared/testHelpers.ts` has no query double).
   Do the goldens pin the *rule* — guest food `= shuffle([...FOODS], pick)[j % 4]`, host food
   `= [0]` — or do they assert magic strings that would survive a logic change? On
   `referenceShuffle` the PM already settled the circularity question: it is **defined locally
   at `handler_test.ts:85`, not imported** — the file imports only `assertEquals` and
   `createHandler`. So it cannot drift silently with `handler.ts`. But it is a **line-for-line
   re-implementation**, which pins today's behaviour rather than independently validating the
   algorithm; a shared conceptual error would pass both. For a phase whose mandate is
   `conducta idéntica` the PM judged that the right instrument. Say so if you disagree.
3. **Test 8, partial redistribution.** `guest_count` is written from `assignedGuests.length`
   *after* redistribution. Does the test actually exercise the leftover-dinner branch, or only
   the clean-move branch?
4. **D11** — no `Math.random()` reachable from a pure path except through the injected default.
5. **D10** — every user-facing string moved byte-identical, including the Spanish deadline
   message.
6. **Does this make P4 harder?** P4 wires the allocator into `handler.ts` and inherits the
   `(0)(1)(2)(8)` baseline.
7. **Scope creep** — `F` is three files. `index 2.ts` (a tracked stale duplicate with 5
   diagnostics of its own) and `_shared/testHelpers.ts` were to be left untouched. Confirm they
   were.

Review against the plan's contract, not your own preferences. Taste disagreements are NITs.
Only correctness, contract violations, security and architectural violations are BLOCKING.

Output using the CODEX REVIEW format:

```markdown
## CODEX REVIEW — P3a round 1
VERDICT: PASS | FAIL
BLOCKING:
- [B1] <finding> — <file:line> — <why it blocks>
SHOULD-FIX:
- [S1] ...
NITS:
- [N1] ...
NOTES ON THE PLAN ITSELF: <if the plan, not the code, is the problem>
```

Please also commit your review to `docs/plan/upgrade/reviews/REVIEW-P3a.md` on the branch — the
P2 review had to be committed by the PM because it was left unstaged in the reviewer's worktree.
