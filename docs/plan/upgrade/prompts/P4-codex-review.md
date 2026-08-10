SESSION: UPGRADE · P4 · REVIEW

Final review of phase **P4 — Cablear allocator en el núcleo** for **UPGRADE**
(La Mesa Abierta · opt-out del plato principal).

Read `docs/plan/upgrade/PLAN.md` for the acceptance criteria (§ "Phase P4", criteria
E1–E9) and the frozen decisions (**D1, D2, D3, D4, D5, D6, D7, D8, D10, D11, D12, D13,
D14**), then review branch **`feat/mesa-md-wire`** at **`e87392e`**. The only code commit
is **`0fad9ad`**; the other two are ledger. Its parent is `main`@`3851e40`.

You have final say on BLOCKING items. The phase does not close until you pass it.

Use **Node v22.22.0**. Run from a clean, dedicated worktree — the ESLint note at the
bottom matters and has bitten three phases running.

> `main` is currently checked out in the worktree `/Users/brentcurtis/dev/casa-p2-review`,
> and local `main`@`3851e40` is **one commit ahead of `origin/main`** (a PM bootstrap
> commit whose push was blocked). Cut your worktree from the local ref, not the remote,
> or the parent comparison will be against the wrong commit.

---

## WHAT THIS PHASE IS

P2 built the canonical main-dish rule as a pure leaf, `supabase/functions/_shared/mainDish.ts`
(19 tests, nothing imported it). P3a cut the handler out of `index.ts`. P3b extracted the
pure seating decision into `matching.ts`. **None of those three changed behaviour.**

**P4 wires P2's allocator into the live path, and it is the first phase of this plan that
WANTS to change behaviour.** Before it, `handler.ts` dealt food by shuffling
`["main_course","salad","drinks","dessert"]` round-robin: any carrier could draw the main
dish, an excluded one included, and a ten-person table got one main course by accident of
a shuffle. After it, food comes from `allocateAll` and nowhere else — quota `max(1,
ceil(personas/5))` (D1), never to an excluded carrier (D3), and an uncovered table is
**reported**, never silently swallowed (D4).

It is also the only phase in the plan with a **frozen golden allowlist**: of the ten
goldens in `handler_test.ts`, **exactly two** may change (the two food ones). Touching a
third was declared `FINDINGS` in advance.

---

## THE FOUR CLAIMS WORTH ATTACKING FIRST

The PM verified all of these independently. Re-run them; if any is false the phase's
central claim collapses and the rest is secondary.

### 1. The eight protected goldens are byte-identical

Not "still passing" — **byte-identical**. The PM audited by parsing test blocks rather
than reading, because the executor renamed the two allowlisted goldens and a name-based
audit would have been misleading. Reproduce it however you like; this is the PM's script:

```python
import re, subprocess
PROTECTED = [
 "OPTIONS 200 sin tocar la base",
 "sin admin rechaza antes de leer el body",
 "mes fuera de open se rechaza sin escribir",
 "plazo vigente se rechaza sin escribir",
 "golden: idempotencia sin escribir",
 "golden: capacidad en unidades; el +1 del anfitrión no consume cupo",
 "golden: el segundo pase redistribuye y la mesa parcial se conserva",
 "golden: sin cupo → lista de espera",
]
def blocks(text):
    out, i = {}, 0
    while True:
        m = re.search(r'Deno\.test\(', text[i:])
        if not m: break
        start = i + m.start(); j = start + len("Deno.test"); depth = 0
        while j < len(text):
            if text[j] == '(': depth += 1
            elif text[j] == ')':
                depth -= 1
                if depth == 0: break
            j += 1
        body = text[start:j+1]
        out[re.search(r'"((?:[^"\\]|\\.)*)"', body).group(1)] = body
        i = j + 1
    return out
def get(rev):
    return subprocess.check_output(
        ['git','show',f'{rev}:supabase/functions/create-mesa-matches/handler_test.ts']).decode()
a, b = blocks(get('3851e40')), blocks(get('0fad9ad'))
for n in PROTECTED: print(a[n] == b[n], n)
print("only in branch:", sorted(set(b)-set(a)))
print("only in parent:", sorted(set(a)-set(b)))
```

PM's result: all eight `True`; two names leave, six arrive; 10 tests → 14.

### 2. E6 vs E8 conflict — **the PM made a ruling here and you should challenge it**

The executor deleted `FOODS` and `referenceShuffle` from `handler_test.ts`. Both were used
**only** by the two allowlisted goldens; once those were rewritten the helpers were dead,
and `handler_test.ts` measures `deno lint (0)` in the baseline, so leaving them adds two
new `no-unused-vars` and breaks E8. **E6 as written and E8 cannot both be satisfied
literally.** The PM verified the conflict with a lint probe outside the repo (both
declarations are reported) and ruled: **the deletion falls within E6**, because the
criterion protects the eight goldens and caps the changed ones at two, both of which hold,
and a helper left dead by a permitted rewrite is a consequence of that rewrite rather than
a change of its own. No plan amendment was made.

**That ruling is the PM's, made on its own work's behalf. Say so if you disagree** — it is
exactly the kind of call that should not go unreviewed.

### 3. Does the suite actually bite, or does it merely execute?

P3b's lesson was that the mutation you choose measures what you already suspected, so the
PM ran three on scratchpad copies (the repo was not touched) and reports the counts:

| Mutation | Result |
|---|---|
| `balanceMainDishCarriers` returns its input unchanged (rebalance neutralised) | **3 red**, incl. handler test 12 |
| the fold-back into `hostStatus` removed (the three lines rewriting `assignedGuests` / `currentGuests` / `currentGuestPeople`) | **1 red** (`el reequilibrio se refleja en los invitados`) |
| food rotated among a table's guests — per-table `main_course` count unchanged, only who carries it | **4 red**, incl. both excluded-carrier tests |

**What the PM wants from you is a fourth mutation it did not think of.** Name a change to
`matching.ts` or `handler.ts` that these fourteen tests do **not** catch. In P3b that
question found a real gap (B-11) that the PM's own mutation had missed.

### 4. Nothing touched the database

E9 and D12. No `apply_migration`, no `execute_sql`, no `supabase functions deploy`, no
`supabase db push`. The diff is four files, all under
`supabase/functions/create-mesa-matches/`. The column this phase depends on
(`can_bring_main_dish`) was applied in P1b and is already live.

---

## THE ACCEPTANCE CRITERIA, AND WHAT THE PM MEASURED

| | Criterion | PM's measurement |
|---|---|---|
| E1 | Persisted food comes only from `allocateAll` | `grep -cE "allocateAll\|TableInput\|foodAssignments" handler.ts` → **0**; both `shuffle([...foodAssignments], pick)` calls and the `shuffle` import deleted; test 11 shows **two** main dishes at a six-person table, which the old rule could never produce |
| E2 | `mainDishCoverage[]` and `tablesWithShortfall[]` on the plan and in `results` | both present; asserted by test 11 |
| E3 | Rebalanced seating persisted; `guest_count` matches | tests 12, 13; mutations 1 and 2 above |
| E4 | No excluded carrier persisted with `main_course` | test 14, over host inserts and assignment rows |
| E5 | No aggregate column written (D14 is live) | `grep -cE "total_people\|main_dish_count" handler.ts` → **0** |
| E6 | Only goldens 5 and 6 changed | claim 1 above, plus the ruling in claim 2 |
| E7 | `deno test --allow-all --no-check .` → **456/0** | re-run by the PM: **456 passed, 0 failed** |
| E8 | Gate D8 over the four files: zero new diagnostics; build ok | reproduced character for character (below); `npm run build` → exit **0** |
| E9 | No migration, no SQL, no deploy | claim 4 above |

### The D8 gate, reproduced by the PM on the branch

Compare full raw messages against the parent, not counts. Baseline measured by the PM on
`main`@`c712e85` before dispatch; identical text on the branch, **line shifts only**
(`matching.ts` 98→157; `handler.ts` 31→32, 290→299, 343→356, 149/150→150/151):

```bash
bash scripts/gates/changed-files-diagnostics.sh \
  supabase/functions/create-mesa-matches/matching.ts \
  supabase/functions/create-mesa-matches/matching_test.ts \
  supabase/functions/create-mesa-matches/handler.ts \
  supabase/functions/create-mesa-matches/handler_test.ts
```

- `matching.ts` `(0,0,1,0)` — `no-unused-vars: TARGET_GUEST_SIDE_FOR_DINNER`
- `matching_test.ts` `(0,0,0,0)`
- `handler.ts` `(0,1,1,3)` — `no-explicit-any` on `SupabaseLike`; `no-unused-vars: count`;
  `TS18046` on `error`; 2× `TS7006` on `p`
- `handler_test.ts` `(0,0,0,0)`
- project totals `tsc=1039 eslint=161 deno-lint=92 deno-check=43` — **observation only**
  (D8.5), and identical to the pre-dispatch measurement

All five are pre-existing and catalogued as **B-08**; fixing them was explicitly out of
scope for this phase. **B-11** (the eight pure P3b tests do not pin the two initial
shuffles) was likewise held in the backlog by a PM decision at bootstrap, on the grounds
that P4 is the first behaviour-changing phase and the only one with a golden allowlist.
If you think either exclusion was wrong, that is a legitimate finding against the PM.

---

## DESIGN CHOICES THE PM APPROVED — review them, they were not in the plan

1. **`SeatingPlan` grew four fields, not two.** E2 names `mainDishCoverage` and
   `tablesWithShortfall`; the executor also added `dinners` (host + hostFood + guests each
   carrying their food) and `mainDishMoves`. Only the two E2 fields cross into the HTTP
   response. The PM approved: `dinners` is what makes the "food and seating come from
   different objects" failure structurally impossible — there are no two lists to cross in
   the write loop — and `mainDishMoves` is the only way tests 4 and 5 can assert "when a
   swap happens" rather than assume it.
2. **The `allocateAll` call lives in `matching.ts`, not `handler.ts`** (D13, and your own
   P3b ruling that `SeatingPlan` may grow these fields "sin devolver la decisión al
   handler"). `grep` in `handler.ts` for `allocateAll`/`TableInput` → 0.
3. **`matching.ts` is no longer a leaf.** One import, `../_shared/mainDish.ts`. D1e
   forbids `@supabase/supabase-js` and `Deno.env` there, not imports in general;
   `mainDish.ts` is itself a pure leaf measuring `(0,0,0,0)`. `grep` for
   `@supabase/supabase-js|Deno.env` in `matching.ts` returns 1 hit and it is the comment
   citing the decision.
4. **`allocateMainDish` mutates `hostStatus` deliberately**, so the three downstream
   participant updates (`assigned_role`, `status`, waitlist) read the same guest lists the
   assignment rows were written from. Mutation 2 above exists to prove that link.
5. **Hosts with no guests are not tables**: excluded before `allocateAll`, so they draw no
   `pick` and appear in no coverage entry. This matches the handler's long-standing skip.

---

## KNOWN, DECLARED, NOT DEFECTS

- **Vitest 1063 passed / 6 failed.** The six are `MesaAbiertaDashboard.test.tsx`, which
  **D8.2 names as the baseline until P8**, the phase that repairs them. The executor
  reported them as uncatalogued and opened a backlog item; the PM **withdrew it** after
  reproducing the count and re-reading D8.2. Confirm the withdrawal was right. Note this
  run had **no** B-05 `CuentacuentoEditor.ph.*` reds at all — first time in four phases;
  B-05 remains a flake, untouched.
- **NIT already logged:** `handler.ts:11–12` still says "the only injected seam is `pick`,
  which `shuffle` uses" — `shuffle` is no longer imported there. Two comment lines, left
  to keep the diff surgical, deferred to P7.
- **NIT, unrelated to P4:** `docs/plan/upgrade/reviews/REVIEW-P1.md` has been sitting
  **uncommitted** in the `casa-upgrade` worktree since 2026-08-08. P1's Codex review is
  not in the repo. Fourth time a review has failed to get published (P2 unpushed, P3a
  unstaged, P3b was the first that landed on its own). Worth a line in your review.

---

## WHAT TO CHECK

1. Does the code actually meet every acceptance criterion? **Verify; do not take the
   ledger's word for it** — two of the entries above are the PM grading its own prompt.
2. Run the tests yourself. Do they test behaviour or merely execute code? **Give the PM
   the fourth mutation** (claim 3).
3. Any violation of the frozen decisions? D1 (the quota), D3 (never to an excluded
   carrier), D4 (a deficit is reported), D5's guarantees as they survive the wiring, D7
   (host first when able), D11 (`pick` only), D12 (no synthetic row touches the shared
   database), D13 (the split), D14 (**no aggregate persisted**).
4. Correctness, error handling, security, edge cases. Specifically: a table where the host
   is excluded; a converted host (a host seated as a guest) who is excluded; a shortfall
   that no swap can fix; `pick` returning out-of-range values.
5. **PII.** `results` and the new `console.warn` must carry ids and numbers only — no
   names, no emails, no phones. Member PII never reaches a log line or an AI prompt.
6. Anything that makes **P5a, P6, P7 or P8** harder than it needs to be. P6, P7 and P8
   consume `mainDishCoverage` and `tablesWithShortfall` exactly as they come out of
   `results` today; if that shape is wrong for them, now is when it is cheap.
7. Scope creep — anything changed that was out of scope?

Review against the plan's contract, not your own preferences. Taste disagreements are
NITs. Only correctness, contract violations, security and architectural violations are
BLOCKING.

### The ESLint note

Three phases running, every measurement surprise has been the environment and not the
code. Run from a **clean, dedicated worktree**: a stray `supabase/.temp/` inflates the
ESLint count badly (the PM once measured 347 against Codex's 161). The per-file counts are
the only portable number; the project totals are an observation under D8.5.

---

Output using the **CODEX REVIEW** format:

```markdown
## CODEX REVIEW — P4 round 1
VERDICT: PASS | FAIL
BLOCKING:
- [B1] <finding> — <file:line> — <why it blocks>
SHOULD-FIX:
- [S1] ...
NITS:
- [N1] ...
NOTES ON THE PLAN ITSELF: <if the plan, not the code, is the problem>
```

Commit your review to `docs/plan/upgrade/reviews/REVIEW-P4.md` on `feat/mesa-md-wire`,
**stage it and push it**. Three of the last four reviews needed chasing.
