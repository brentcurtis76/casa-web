SESSION: UPGRADE · P1 · REVIEW

Final review of phase **P1** for UPGRADE (La Mesa Abierta · opt-out del plato principal),
covering **P1a and P1b together** — they share the branch `feat/mesa-md-schema` and close as
one PR. You have final say on BLOCKING items. The phase does not close until you pass it.

Repo: `/Users/brentcurtis/dev/casa-web`. The branch is checked out in its own worktree at
`/Users/brentcurtis/dev/casa-upgrade` — use that one; `casa-web` itself is currently on
another workstream's branch.

Read `docs/plan/upgrade/PLAN.md` (frozen at revision 7, **amended 2026-08-08** — five new
Decision Log rows) and the P1 entries in `docs/plan/upgrade/LEDGER.md`. There are ten: three
executor rounds, four PM verifications, the amendment, PR3, and the close.

## What shipped

Two files, +43 lines, zero deletions:

- `supabase/migrations/20260806000000_mesa_main_dish_optout.sql` — `ADD COLUMN
  can_bring_main_dish BOOLEAN NOT NULL DEFAULT TRUE` plus the D14 `get_my_dinner_summary`
  contract with its `REVOKE`/`GRANT`.
- `src/integrations/supabase/types.ts` — six declarations, nothing in the `Functions` map (D15).

Applied to production `mulsqxfhxxdsadxsljss` on 2026-08-08.

## The seven things I want you to attack hardest

**1. The evidence chain for A6–A8 is weaker than for everything else, and I am telling you
rather than letting you find it.** No agent in this setup can execute
`get_my_dinner_summary`: the MCP server connects as `supabase_read_only_user`, which is not
in the function's ACL (`{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`)
and is not a member of `authenticated`. That exclusion is *correct* — it is exactly what A5
asserts — but it means A6, A7 and A8 were run by **Brent, by hand, in the Supabase SQL
editor**, and the PM recorded his paste. Neither an executor nor the PM produced that output.
If you think that is not good enough for a phase to close, say so; you can have Brent re-run
the block (it is in the ledger entry of 2026-08-08, four labelled cases, all reads, wrapped in
`begin … rollback`).

**2. The PM got A6–A8's feasibility wrong once already, so check whether the same flaw
infects its other claims.** In the P1 r1 prompt the PM declared the A6–A8 risk "closed". What
it had actually tested was (a) that `set_config('request.jwt.claims', …, true)` persists
across statements, and (b) that the D14 **body**, pasted as an ordinary `SELECT`, returns the
expected row — which the read-only user can do because it is just reads over base tables.
Neither is `EXECUTE` on the function. A later Docker rehearsal ran as **superuser**, where the
ACL does not bite. Both checks routed around the exact barrier that later blocked the round.
**Go looking for the same class of error elsewhere in the PM's verifications.**

**3. Challenge the PM's A10 ruling.** D8 point 2 originally required the red Vitest set by
name to equal the baseline six. The PM measured **7 reds on the untouched parent commit**
(flake B-05: three `CuentacuentoEditor.ph.*` files under load), ruled A10 met anyway on the
grounds that the excess is not attributable to P1, and then **amended D8 point 2** to
"attributable reds do not grow; a red outside `F` is settled by re-running on the parent". The
PM's structural argument is that `types.ts` has zero runtime exports — seven `export type`
declarations, nothing else — so it is erased at transform and cannot move those tests. Verify
that claim, and rule on whether amending a frozen criterion mid-phase was legitimate or
self-serving.

**4. Was splitting P1 a real diagnosis or a rationalisation?** Three executor rounds were
consumed with **zero findings against the code**; all three died against the write channel.
The PM diagnosed that the plan modelled PR1 and PR2 as human gates but treated the
application itself as agent work, and split P1 into P1a (files) and P1b (apply + verify) with
PR3 as a third human gate. Check the dependency graph in the phase index is right, and that
P1a really is inert — the PM claims `git grep can_bring_main_dish` shows zero consumers
outside `types.ts` and the migration.

**5. D9 says "un único `apply_migration`". It was applied by hand from the SQL editor.**
That deviation has a Decision Log row dated 2026-08-08, written *before* the application, not
after. Judge whether the substance of D9 survives. Note the blast-radius argument that
justified banning `supabase db push`: it would also have applied `20260612000000` and
`20260612000001`, which PR2 did not cover. Verify those two are **still unapplied** — the PM
says they are, and that this is the proof the application was surgical.

**6. The migration ledger row was added by hand.** The SQL editor does not write
`supabase_migrations.schema_migrations`, so PR3 included a separate `insert … on conflict do
nothing` for `('20260806000000','mesa_main_dish_optout')`. The PM decided this on Brent's
delegation. Is it right, and is it recorded honestly? The migration file itself was
deliberately **not** touched — verify it is still byte-identical to the frozen D14 contract in
`PLAN.md`.

**7. The one thing nobody could test in production.** `match_id` is both an OUT parameter of
the function and a column of `mesa_abierta_assignments`. If Postgres found that ambiguous the
function would not create. The PM established it creates cleanly by applying the migration
file verbatim in a throwaway Postgres with synthetic data (D12), and production creation later
confirmed it. Satisfy yourself the body is genuinely unambiguous rather than accidentally
working.

## Verify, don't take the ledger's word for it

1. Every acceptance criterion A1–A11 against the code and the live schema, not the report.
2. Run the gate yourself: `bash scripts/gates/changed-files-diagnostics.sh` over the migration,
   `types.ts` and `src/components/mesa-abierta/MesaAbiertaAdmin.tsx`, on the parent commit and
   on the tip. **Check the exit code; never pipe it through `tail`.** A fresh worktree has no
   `node_modules` — run `npm ci` first or the gate will (correctly) exit 1.
   Expected: two removals, zero additions, `tsc 1041 → 1039`.
3. Any violation of the frozen decisions — especially D9, D12 (no member data in committed
   evidence; check the ledger entries for leaked names, emails, phones or full user UUIDs),
   D14 (no aggregate is ever persisted) and D15 (nothing in the `Functions` map).
4. Security of the shipped function: `SECURITY DEFINER` with `search_path = ''`, every object
   schema-qualified, every row constrained by `auth.uid()`, anon revoked. Try to break it.
5. Anything that makes P2, P3a, P3b or P4 harder than it needs to be.
6. Scope creep — anything changed that was out of scope. Expected: two source files, the rest
   is `docs/plan/upgrade/`.

Review against the plan's contract, not your preferences. Taste disagreements are NITs. Only
correctness, contract violations, security and architectural violations are BLOCKING.

Output using the CODEX REVIEW format. Write your review to
`docs/plan/upgrade/reviews/REVIEW-P1.md`.
