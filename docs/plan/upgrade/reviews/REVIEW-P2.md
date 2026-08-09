CODEX REVIEW — UPGRADE P2 FINAL — `feat/mesa-md-alloc`@`6363378`

VERDICT: PASS

P2 satisfies [B1]-[B9]. I found no blocking correctness, contract, security, or
architecture defect in the pure allocation module, its cross-runtime import, or its
verification. The source under review is the implementation commit `6af5071`; the
two later commits through the reviewed branch tip change only the P2 planning and
review record.

The phase may close and merge. The production-bundler proof remains intentionally
deferred to P6 under frozen decision D6; the P2 Vitest/TypeScript import proof is
real and does not misrepresent that deferred obligation.

## REVIEW TARGET AND SCOPE

- The review ran in a clean dedicated worktree at branch tip
  `63633789057f68a8a48b143fec1e1093818e7a5f`, matching
  `origin/feat/mesa-md-alloc`. The implementation's parent is
  `981c00fc1e16210811aa6206ce3d9a515ceaeae3`.
- The source delta from that parent is exactly the three P2 files frozen by the
  contract: `supabase/functions/_shared/mainDish.ts`,
  `supabase/functions/_shared/mainDish_test.ts`, and
  `src/lib/mesa-abierta/__tests__/mainDishImport.test.ts`.
- The additional branch-tip changes are confined to `docs/plan/upgrade`: the plan,
  ledger, and final-review prompt. No application, database, generated, or shared
  configuration file is hidden in the documentation commits.
- `mainDish.ts` is a canonical zero-import leaf. It imports no frontend, Deno,
  Supabase, database, network, clock, crypto, or entropy dependency. The only
  importers in P2 are the Deno unit suite and the frontend Vitest import proof.
- `git diff --check 981c00f..6363378` is clean. The unrelated shared-worktree
  changes observed during verification were not modified or included; all final
  evidence below was obtained from isolated clean worktrees with Node `v22.22.0`.

## ACCEPTANCE RULING

| Criterion | Final ruling | Independent basis |
|---|---|---|
| [B1] | **MET** | `requiredMainDishes(personas)` implements `max(1, ceil(personas / 5))`; direct cases cover 1–15 and the expression is unbounded rather than table-driven. |
| [B2] | **MET** | Host and guest `+1` values are included in people count; focused tests pin the formula and allocation consequences. |
| [B3] | **MET** | Host is selected first when willing, then guests are selected exclusively through injected `pick(n)`. |
| [B4] | **MET** | Excluded carriers never receive the main dish; each table gets exactly `min(required, willing)` main-dish assignments; shortages are reported. |
| [B5] | **MET** | Improving swaps preserve participants and table sizes, respect both capacities, preserve excluded status, never leave the donor deficient, and reduce total deficit by at least one. |
| [B6] | **MET** | All eleven D5 guarantees have executable coverage. Allocation/rebalancing tests use the shared invariant verifier, with separately pinned primitives and explicit non-vacuity witnesses for moves, shortages, surplus, host behavior, capacity, and repeated seeded runs. |
| [B7] | **MET** | Frontend Vitest imports the canonical leaf by its relative `.ts` path and executes it successfully; the TypeScript gate also accepts that exact import. |
| [B8] | **MET** | The exact scoped gate exits zero with all three files individually clean and global diagnostic counts equal the frozen P2 baselines. |
| [B9] | **MET** | Full Vitest adds exactly one passing test and preserves precisely the same six known failures as the clean parent; the full Deno suite and production build also pass. |

## LOAD-BEARING CORRECTNESS RULINGS

### G6/G7 — strict progress and no stale baseline

`findImprovingSwap` computes the pair's pre-swap deficit from the current table
state on every call. Candidate evaluation replaces only the receiver and donor
contributions, and accepts a swap only when the resulting global deficit is at
least one lower. `balanceMainDishCarriers` applies one accepted swap, constructs
fresh allocation objects for exactly those two tables, then calls the search again;
the next iteration therefore recomputes its baseline from the updated state. There
is no cached deficit spanning iterations and no third-table mutation or array alias.

The implementation also cannot return a nominal move without a unit-changing
assignment: the receiver gains the willing main-dish carrier and the donor receives
the receiver's former side dish. The explicit F4/F6 fixtures require real movement,
including a two-step improvement case, so these paths are not vacuous.

### G8 — exact assignment count

For each table, `mainDishCount` is exactly `min(requiredMainDishes(people),
willingCount)`. If the host is willing, host-first consumes one required slot and
the remaining willing-guest pool has enough members for every remaining slot. If
the host is excluded, the willing-guest pool itself contains exactly every eligible
candidate. Consequently, exhaustion cannot silently under-assign relative to that
minimum. The verifier recomputes this result independently for every allocation,
and adversarial generation confirmed the equality across empty, host-only, all-
excluded, surplus, shortage, capacity-constrained, and mixed tables.

### G5 — donor deficit and attainable coverage

The search requires the donor's post-swap deficit to be zero, matching frozen G5.
This does not discard an attainable improving swap between two initially deficient
tables. An equal-people swap keeps both quotas and the pair's total number of willing
main-dish carriers fixed; while both remain below quota, their combined deficit is
therefore invariant. A strict decrease is impossible until one side ceases to be
deficient. The stronger-looking guard is thus equivalent to the reachable progress
condition in this model, not a coverage loss.

### Invariant-verifier independence

The shared verifier imports only `requiredMainDishes` and `tablePeopleCount`, and
those two primitives are pinned separately before the verifier-backed allocation
cases. It independently reconstructs participant identity, willing status,
capacities, actual dish counts, shortages, move replay, and global conservation.
It does not reuse the allocator's selection, swap, deficit, or shortfall helpers.
This is sufficient containment rather than circular confirmation of the algorithm
under test.

Tests 4–19—the allocation and rebalancing surface governed by [B6]—all reach the
verifier directly or through the fixture runner. The phrase “EVERY test below” in
the test-file header overstates that mechanically because primitive tests 1–3 are
deliberately direct; it does not create a coverage hole in the contracted surface.

### Determinism and injected selection

The implementation has no `Math.random`, clock, crypto, ambient state, or unordered
collection traversal. All variability passes through `pick(n)`. Every production
call site supplies `n > 0`: guest selection is guarded by a non-empty pool and side
selection uses the three-element side-food list. For contract-valid picks in
`[0, n)`, output is repeatable. Repeated seeded runs and an additional 2,000-case
adversarial probe found no nondeterminism, invariant violation, input mutation, or
shortfall mismatch.

## ARCHITECTURE, SCOPE, AND PLAN RULING

- The module preserves the frozen P4-facing pure API and requires no premature P4
  integration, database access, enum change, alias, barrel export, or bundler
  configuration. Deriving quota from table people rather than accepting a second
  mutable quota field maintains one canonical D1 rule.
- `Food` includes the existing database value `none` for type parity but the
  allocator never emits it. No schema, RLS, migration, generated type, Edge entry
  point, or runtime behavior outside the canonical leaf changed.
- The P2 diff contains synthetic fixture identities only and no member PII. The
  module has no user-facing copy, so D10 introduces no untranslated surface.
- The 2026-08-08 plan amendment is legitimate under the frozen change-control rule.
  It corrects the obsolete absolute Vitest baseline from 1,036 to the observed clean
  parent value of 1,062, records B-07, preserves the historical value and exact six-
  failure identity, and changes neither an acceptance criterion nor a gate outcome.
  The branch result of 1,063 is the required `+1` delta, not a self-serving relaxation.

## INDEPENDENT RUNS

| Check | Result |
|---|---:|
| Exact scoped gate for the three P2 files | **exit 0** |
| Per-file TypeScript / ESLint / Deno lint / Deno check | **0 / 0 / 0 / 0** for every file |
| Global diagnostic identities | **TypeScript 1039 / ESLint 160 / Deno lint 94 / Deno check 46** |
| Deno suite from `supabase/functions` | **428 passed / 0 failed**; all 19 P2 tests pass |
| Full Vitest at clean parent `981c00f` | **1,062 passed / 6 failed**; 80 files |
| Full Vitest at reviewed tip `6363378` | **1,063 passed / 6 failed**; 81 files |
| Vitest failure identity | **unchanged**: the same six `MesaAbiertaDashboard` cases |
| `npm run build` | **exit 0** |
| Additional deterministic adversarial probe | **2,000 generated configurations passed** |

The build's existing Browserslist, Tailwind ambiguity, and chunk-size warnings do
not originate in the P2 source delta. The build is corroborating regression evidence,
not the P6 production-import proof.

## BLOCKING FINDINGS

None.

## SHOULD-FIX

None.

## NITS

### [N1] Invalid `pick` results are normalized rather than rejected

`boundedIndex` clamps or wraps values outside the D11 precondition instead of
failing fast. This is not a P2 correctness defect: D11 defines callers to return an
integer in `[0, n)`, all current call sites use positive `n`, and contract-valid
callers retain exact deterministic behavior. A future integration could choose to
throw on an invalid injected picker to expose its own bug sooner.

### [N2] The verifier header is broader than its literal use

The test comment says every test below calls the shared verifier, while primitive
tests 1–3 intentionally do not. Tests 4–19—the allocation and rebalancing cases to
which [B6] applies—do invoke it, so this is documentation precision only.

## FINAL RULING

P2 PASS. [B1]-[B9] are met, all frozen guarantees remain enforced, and there is no
remaining release-safety reason to hold the phase. The phase can be marked complete
and `feat/mesa-md-alloc` can merge; P6 retains the expressly deferred production
Vite-consumption proof.
