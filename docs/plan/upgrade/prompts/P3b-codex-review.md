SESSION: UPGRADE · P3b · REVIEW

Final review of phase **P3b — Extraer `matching.ts` puro** for **UPGRADE**
(La Mesa Abierta · opt-out del plato principal).

Read `docs/plan/upgrade/PLAN.md` for the acceptance criteria (§ "Phase P3b", criteria
D1e–D6e) and the frozen decisions (D8, D10, D11, D12, D13), then review branch
**`feat/mesa-md-core`** at **`ebc9228`** (the only code commit is `79e662e`; the other two
are ledger), whose parent is `main`@`4b44b5b`.

You have final say on BLOCKING items. The phase does not close until you pass it.

Use **Node v22.22.0**. Run from a clean worktree — see the ESLint note below, it matters.

---

## WHAT THIS PHASE IS

P3a cut the seam: it moved the whole request handler out of `index.ts` into `handler.ts`,
verbatim, with an injectable `pick`. You passed it with zero findings.

**P3b extracts the pure seating algorithm out of `handler.ts` into `matching.ts`** — how
many hosts to use, who sits with whom, the redistribution pass, the waitlist. `handler.ts`
keeps the HTTP guards, the Supabase reads and writes, and the food assignment (food moves
in P4, not here). D13 requires this split: `index.ts` adapter → `handler.ts` logic →
`matching.ts` pure decision. **The phase changes no behaviour.**

**The hard rule is that P3a's ten goldens pass without modification**, and the way it is
established is that the move is verbatim. The PM verified this mechanically rather than by
reading, and **you should re-run both comparisons yourself** — if they hold, most of
D1e–D4e follows; if they do not, the phase's central claim is false and the rest is
secondary:

```bash
# 1. The moved block: main:handler.ts 169-360, dedented 4 spaces, vs matching.ts 75-266
git show main:supabase/functions/create-mesa-matches/handler.ts \
  | sed -n '169,360p' | sed 's/^    //' > /tmp/orig-block.txt
sed -n '75,266p' supabase/functions/create-mesa-matches/matching.ts > /tmp/new-block.txt
diff /tmp/orig-block.txt /tmp/new-block.txt

# 2. The write path: main:handler.ts 362-536 vs handler.ts 185-349
git show main:supabase/functions/create-mesa-matches/handler.ts \
  | sed -n '362,536p' > /tmp/orig-write.txt
sed -n '185,349p' supabase/functions/create-mesa-matches/handler.ts > /tmp/new-write.txt
diff /tmp/orig-write.txt /tmp/new-write.txt
```

The PM measured **192 lines vs 192 with zero differences** on the first — that is exact
`diff`, not `diff -w`, so not even whitespace moved. And **165 identical lines** on the
second, the only delta being that the 10-line `shuffle` no longer sits at the end of
`handler.ts` because it is now exported from `matching.ts`. This is a *stronger* result
than P3a, which had four differing lines for the `pick` injection.

---

## FOUR THINGS YOU MUST BE TOLD, OR YOU MAY FAIL THIS PHASE FOR THE WRONG REASON

**1. One `deno lint` diagnostic moves into a brand-new file, and that classification is the
judgement call of this phase.** `TARGET_GUEST_SIDE_FOR_DINNER` is declared and never used —
it documents the "aim for 6 guest-side people" heuristic. It sat at `handler.ts:192`, inside
the extracted block, and now sits at `matching.ts:98` carrying the byte-identical message
`no-unused-vars: \`TARGET_GUEST_SIDE_FOR_DINNER\` is never used`.

The PM classified it as **displacement** under D8.4's manual-classification clause ("mismo
mensaje, otra línea — aceptable") and **instructed the executor to move it verbatim** rather
than delete it, on the grounds that deleting dead code mid-extraction muddies the diff that
makes the phase verifiable at all. **A new file whose baseline is zero receiving a displaced
diagnostic is a harder call than P3a's**, where the destination file was also new but the
displacement was already an agreed, pre-registered backlog item (B-08). If you think a
diagnostic landing in a file that did not exist cannot be "displaced" by definition, say so —
that is exactly the judgement D8.4 reserves for the reviewer.

**2. `handler.ts` came out BELOW its baseline, and that is the predicted outcome, not a
surprise.** Baseline at the parent was `(tsc 0)(eslint 1)(deno lint 2)(deno check 8)`. It is
now **`(0)(1)(1)(3)`**. Nothing was repaired by hand. The prompt predicted this in advance:
once `matching.ts` names its own input types (which D1e forces, since it may not import
`@supabase/supabase-js` and so cannot inherit the client's typing) and returns a typed
`hostStatus`, the write path's `host.assignedGuests.map(...)` callbacks stop being implicit
`any` **on their own**. Five `TS7006` disappeared that way: `:333` (inside the moved block)
plus `:400`×2, `:419` and `:441` (write path, untouched by the executor).

D8.4 prohibits diagnostics that are *new*; it does not reward preserving old ones. The five
remaining messages in `handler.ts` are all from the parent table with only line shifts:

| Tool | Parent | Now | Message |
|---|---|---|---|
| eslint | `:26` | `:31` | `no-explicit-any` on `SupabaseLike` |
| deno lint | `:467` | `:290` | `count` is never used |
| deno check | `:520` | `:343` | TS18046 `'error' is of type 'unknown'` |
| deno check | `:144`,`:145` | `:149`,`:150` | TS7006 `p` implicitly any |

End state, measured by the PM:

| File | tsc | eslint | deno lint | deno check |
|---|---|---|---|---|
| `handler.ts` | 0 | 1 | 1 | 3 |
| `matching.ts` | 0 | 0 | **1** | 0 |
| `matching_test.ts` | 0 | 0 | 0 | 0 |

**The project totals corroborate this rather than merely coexisting with it**: `deno check`
went 48 → **43** (the five eliminated) and `deno lint` stayed at **92** (one displaced,
neither added nor removed). If those two numbers did not move exactly that way, something
would have been hand-edited.

**Consequence for P4, worth confirming: B-08 shrank on its own.** Its write-path half no
longer exists. Three diagnostics remain, not eleven, and **P4's `handler.ts` baseline is
`(0)(1)(1)(3)`**, not `(0)(1)(2)(8)`.

**3. The `deno test --no-check` amendment is the one you already blessed in P3a.** D8.3 and
this phase's D5e both read `deno test --allow-all --no-check .` (Decision Log, 2026-08-08).
You wrote then that it is coherent because `deno check .` still covers the full graph
including `_test.ts` files. Nothing in P3b revisits it; it is restated here only so the
command in D5e does not look invented. **D5e's target is 446 passed / 0 failed** (+8 on
P3a's 438).

**4. Two project-wide numbers are not portable between checkouts. Neither is a criterion.**
- **ESLint total.** The plan says 160, correct in a clean checkout; a checkout that has run
  `supabase start` reports **347**, because `eslint.config.js` does not ignore
  `supabase/.temp/` and the generated local Edge runtime there contributes 186 diagnostics in
  a single file (**B-09**). The PM measured 347 here.
- **Vitest.** The PM measured **1063 pass / 6 fail**, the six being the declared D8.2 base
  set in `MesaAbiertaDashboard.test.tsx`. You measured **1055 / 14** during P3a in your own
  checkout — the extra eight are `usePresentationState` failing on a missing `localStorage`
  (**B-10**), environment-dependent and reproducible on the parent. Three
  `CuentacuentoEditor.ph.*` files also flake under load (**B-05**). `F` contains no file
  Vitest loads, so any red is pre-existing by construction.

Per D8.5 both totals are observations, never criteria. The **per-file** counts decide D6e.

---

## ACCEPTANCE CRITERIA — verify each against the code, not the ledger

- **D1e** — `matching.ts` imports neither `@supabase/supabase-js` nor uses `Deno.env`.
  It in fact has **zero imports at all** — a leaf, like `_shared/mainDish.ts` from P2.
- **D2e** — no `Math.random()` in `matching.ts`. The composition-root default stays at
  `handler.ts:43` (`pick ?? (n => Math.floor(Math.random() * n))`), which is D11's
  prescribed shape.
- **D3e** — `grep -c "hostsToUse" supabase/functions/create-mesa-matches/handler.ts` → **0**.
- **D4e** — `git diff main..HEAD -- .../handler_test.ts` is **empty**. The ten P3a goldens
  pass unmodified.
- **D5e** — `cd supabase/functions && deno test --allow-all --no-check .` → **446 / 0**.
- **D6e** — the gate table above; `npm run build` exit 0.

Gate command:

```bash
./scripts/gates/changed-files-diagnostics.sh \
  supabase/functions/create-mesa-matches/handler.ts \
  supabase/functions/create-mesa-matches/matching.ts \
  supabase/functions/create-mesa-matches/matching_test.ts
```

---

## THE ONE DECLARED DEVIATION — it is the PM's error, not the executor's

The executor's prompt (§3.2, `prompts/P3b-r1.md`) claimed the write path consumes "exactly"
`hostStatus` and `unassignedGuests`. **That enumeration was incomplete and the PM has owned
it.** The response body at `main:handler.ts:496`–`502` also consumes `guestsAssignedCount`,
`hostsConvertedToGuests.length` and `allGuests.length`, and the goldens pin them —
`golden: sin cupo → lista de espera` asserts `guestsAssigned` and `guestsUnassigned`.

`SeatingPlan` therefore returns **five** members, not two. The executor returned the
**arrays** rather than the counts, which is what lets those three handler lines stay
verbatim. It did not stop with `FINDINGS`, correctly: the 169–360 cut was still clean and
only the PM's list was short. **Confirm that judgement was right** — specifically, that
returning `allGuests` and `hostsConvertedToGuests` in full does not leak seating state the
handler should not have, and that nothing downstream mutates them.

---

## WHERE TO PUSH HARDEST

1. **Are both moves really verbatim?** Re-run the two diffs above. This is the phase.
2. **Do the 8 tests test behaviour, or just execute code?** The PM ran a mutation test to
   answer this and you should decide whether it was sufficient: he copied `matching.ts` and
   `matching_test.ts` to a temp directory (the repo was not touched), broke the load-bearing
   aliasing by changing `hostStatus.slice(0, hostsToUse)` to
   `.slice(...).map(h => ({ ...h }))`, and the suite went from **8/0 to 4 passed / 4 failed**,
   including `el segundo pase redistribuye`. **Is one mutation enough?** If you can think of a
   behaviour-preserving-looking change these 8 tests would *not* catch, that is a real finding.
3. **The aliasing itself.** `activeHosts` and `waitlistHosts` are `.slice()` views into the
   same objects as `hostStatus`; the second pass mutates through them and the write path reads
   the result back from `hostStatus`. It is documented at `matching.ts:63–69`. Is relying on
   that aliasing acceptable in a module the plan calls "pure", or should the extraction have
   made the dataflow explicit? Note P4 will add main-dish rebalancing on top of this.
4. **The `pick` call sequence.** `shuffle` is exported from `matching.ts` (one
   implementation, imported by `handler.ts`) and called four times per run: hosts and guests
   in `matching.ts:76–77`, then host food and guest food in `handler.ts:198,222`. Confirm the
   **number and order are unchanged** from `main` — the goldens pin food as
   `referenceShuffle(FOODS, pick)[j % 4]`, so any reordering changes output. Also confirm the
   single `shuffle` export cannot drift from `handler_test.ts:85`'s local `referenceShuffle`
   in a way that would make both wrong together.
5. **Purity in the sense that matters.** `matching.ts` keeps its `console.log` calls (moved
   verbatim, D10: operator logs, not user-facing). Does it mutate its `hosts`/`guests`
   arguments? The doc comment at `:64` claims it does not.
6. **D12** — `matching_test.ts` uses no Supabase double, no `fetch`, no `auth.users` fixtures,
   because a pure function needs none. Confirm nothing sneaked in.
7. **Does this make P4 harder?** P4 adds `allocateAll` to `matching.ts`, persists food from
   it, and may change **only goldens 5 and 6** of P3a's ten. Is `SeatingPlan` the right shape
   to hang main-dish coverage and shortfall off, or has this extraction picked a boundary that
   P4 will have to re-cut?
8. **Scope creep** — `F` is three files. `index.ts`, `index 2.ts` (a tracked stale duplicate),
   `handler_test.ts` and `_shared/` were all to be left untouched. Confirm they were.

Review against the plan's contract, not your own preferences. Taste disagreements are NITs.
Only correctness, contract violations, security and architectural violations are BLOCKING.

Output using the CODEX REVIEW format:

```markdown
## CODEX REVIEW — P3b round 1
VERDICT: PASS | FAIL
BLOCKING:
- [B1] <finding> — <file:line> — <why it blocks>
SHOULD-FIX:
- [S1] ...
NITS:
- [N1] ...
NOTES ON THE PLAN ITSELF: <if the plan, not the code, is the problem>
```

Please also **commit and push** your review to `docs/plan/upgrade/reviews/REVIEW-P3b.md` on
the branch. Both the P2 and P3a reviews were left committed-but-unpushed (P2) or unstaged
(P3a) in the reviewer's worktree and the PM had to publish them.
