CODEX REVIEW — UPGRADE P1 FINAL — feat/mesa-md-schema@9cc637b

VERDICT: PASS

No BLOCKING finding remains. A1–A11 are met, the deployed function matches D14, the
manual application preserved D9's substantive protections, and the two-file production
scope is safe to merge. P1a and P1b may close together at
`9cc637b7feeaf1abcd46bdd3dfd280d6fff609d8`.

RUNTIME:

- Node `v22.22.0`, npm `10.9.4` (the frozen baseline runtime)
- Deno `2.7.11`, TypeScript `5.9.2`
- Supabase CLI `2.110.0`

REVIEW TARGET AND SCOPE:

- Parent: `05dc4caf857ed4e93c662131d053672032da0cf6`
- Tip: `9cc637b7feeaf1abcd46bdd3dfd280d6fff609d8`
- Production diff: exactly two files, +43/-0:
  `supabase/migrations/20260806000000_mesa_main_dish_optout.sql` (+37) and
  `src/integrations/supabase/types.ts` (+6).
- The other six changed files are all under `docs/plan/upgrade/`; there is no
  out-of-scope production file and `git diff --check` is clean.

FINDINGS:

BLOCKING: none.

[S1] SHOULD-FIX — correct the verification-channel account in the plan and backlog
     `PLAN.md:448-456`; `LEDGER.md:1690-1706`
     The MCP-specific account is correct: `supabase_read_only_user` has no EXECUTE
     privilege and cannot assume `authenticated`. The broader statements are not. A
     linked Supabase CLI review login can assume `postgres` to select a caller UUID,
     set the JWT claim, then assume `authenticated` for a rollback-wrapped RPC read.
     I used that path to reproduce A6–A8 independently. This does not make it an
     appropriate production-write channel—the executor prompts correctly prohibited
     psql/CLI workarounds, and a superuser-capable temporary login is worse than Brent's
     explicit human application—but it does provide a reproducible read-only RPC
     verification path. Amend the stale “risk closed / SET ROLE unnecessary” paragraph
     and B-06 before a later phase relies on either claim. The ledger also says the
     combined four-case SQL block is present, but only its result table is committed;
     this review does not rely on that paste.

[N1] NIT — the amendment added four Decision Log rows, not five
     `PLAN.md:960`; `LEDGER.md:1432-1435`
     The four actual rows cover D9's manual application, the P1a/P1b split plus PR3,
     D8.2, and the manual migration-history row. No decision is missing because PR3 is
     combined with the split row; only the repeated count “five” is wrong.

LOW-CONFIDENCE (non-verdict): none.

## A1–A11

| Criterion | Ruling | Independent evidence |
|---|---|---|
| A1 | MET | The migration contains one additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, the frozen `CREATE OR REPLACE FUNCTION`, `REVOKE`, and `GRANT`; no destructive/data statement is present. |
| A2 | MET | PR1 and PR2 are already present in the parent plan with date 2026-08-06. The first production commit is `d9eebb0`, authored 2026-08-07T15:28:28-04:00. |
| A3 | MET | Live: `can_bring_main_dish / boolean / NO / true`; 31 participant rows and `rows_not_true = 0`. |
| A4 | MET | Live `pg_proc`: SQL, STABLE, owner `postgres`, `prosecdef = true`, and `proconfig = {search_path=""}`. |
| A5 | MET | Live effective privileges: anon false, PUBLIC false, authenticated true, review MCP user false. The ACL is `{postgres, authenticated, service_role}` for EXECUTE. |
| A6 | MET | Independent live calls as `authenticated`, in separate transactions: a host from another month returned count 0; the zero UUID returned count 0; both reported a non-null `auth.uid()`. |
| A7 | MET | Independent live host call returned exactly `(3d4d6709-e86e-4190-a491-9c74e14b00bf, 6, 1)`. Separate base-table arithmetic was host 1 + 4 guests + 1 guest `+1` = 6, with host mains 1 and guest mains 0. |
| A8 | MET | Independent live guest call returned the identical single row as A7. |
| A9 | MET | `types.ts` has exactly the six frozen declarations. `get_my_dinner_summary` is absent from the file and the `Functions` map is unchanged. |
| A10 | MET | Both diagnostic gates exited 0; build passed; Node-22 Vitest produced exactly the baseline six reds; Deno produced 409/0. Details below. |
| A11 | MET | Live migration history contains `20260806000000` but still omits `20260612000000` and `20260612000001`. P1 therefore was not applied by `supabase db push`. |

The A6–A8 production proof used only reads. Each case ran inside `BEGIN ... ROLLBACK`:
the temporary CLI login assumed `postgres` only to select the caller's `user_id`, set
`request.jwt.claims`, then assumed `authenticated` before invoking the function. No user
UUID was printed or committed, no ACL was changed, and no synthetic row was linked to
`auth.users`.

## REQUIRED GATES

I ran `npm ci` in both the parent and tip worktrees before the diagnostic gate. I
discarded an initial Node-v26 Vitest run and reran under the plan's frozen Node v22.22.0.

```text
changed-files-diagnostics parent: exit 0
  tsc=1041 eslint=160 deno-lint=94 deno-check=46

changed-files-diagnostics tip:    exit 0
  tsc=1039 eslint=160 deno-lint=94 deno-check=46

raw parent→tip diagnostic diff:
  removed: 2
  added:   0
  TS2339 MesaAbiertaAdmin.tsx:376 removed
  TS2353 MesaAbiertaAdmin.tsx:882 removed

npm run build: exit 0
npx vitest run --no-file-parallelism:
  78 files; 1036 passed / 6 failed = 1042
  failure set: exactly the six MesaAbiertaDashboard baseline tests

deno test --allow-all .:
  409 passed / 0 failed
```

This run meets even D8.2's original strict wording, so the amendment is not being used
to excuse an excess red in this review. The amendment is nevertheless legitimate: the
frozen plan explicitly allows logged amendments, Brent delegated the decision, and a
parent rerun is the correct causal control for an out-of-scope flake. The PM's structural
argument is also verified: `types.ts` contains seven `export type` declarations and no
runtime declaration; transforming it with esbuild produces a zero-byte module, and the
liturgia-builder tests do not import it.

## D9, PR3, AND MIGRATION HISTORY

RATIFIED. The literal `apply_migration` mechanism changed, but the change was authorized
and recorded before production application. The protections D9 exists to enforce all
survived:

- the schema change is additive;
- the migration was applied as one SQL-editor batch after PR1 and PR2;
- `supabase db push` was not used;
- the two older, unauthorized migrations remain unapplied; and
- the production objects and history row now agree with the repository.

The manual history row is appropriate. Live state is
`('20260806000000', 'mesa_main_dish_optout')`; `supabase migration list --linked`
recognizes it, and three older repaired rows in this project also legitimately have a
null statement array. Keeping this bookkeeping insert outside the migration preserved
the frozen D14 file. The function-through-GRANT block extracted from `PLAN.md` and the
migration compares byte-for-byte equal (1,449 bytes each).

## FUNCTION SECURITY AND CORRECTNESS

No security defect was found.

- It is `SECURITY DEFINER`, owned by `postgres`, with an empty `search_path`.
- Every table is `public`-qualified and `auth.uid()` is schema-qualified.
- Authorization is attached to every returned match: host ownership or an assignment
  whose guest participant has the caller's `user_id`.
- The guest branch uses `EXISTS`, so multiple assignments cannot multiply result rows.
- Passing an arbitrary month cannot bypass the caller predicate; A6 exercises two such
  attempts.
- The result contains only match ID and live aggregates—no participant PII.
- Anon and PUBLIC cannot execute; authenticated can. I reproduced the MCP user's
  permission-denied result as well as successful authenticated execution.
- Live `information_schema` has no persisted `total_people` or `main_dish_count` column.

`match_id` is genuinely unambiguous. It is an OUT name, but the body never refers to it
unqualified: the only column references are `a.match_id`, `a2.match_id`, and
`a3.match_id`; `m.id` supplies the first result column positionally. Production creation
and `pg_get_functiondef` confirm the parser stored that exact qualified body.

## SPLIT, DEPENDENCIES, AND SCOPE

The P1a/P1b split was a real diagnosis, not a way to hide code findings. The three early
rounds found no production defect; the authorized `apply_migration` channel was blocked.
Making the human action explicit as PR3 accurately modelled the workflow.

P1a was inert before P1b: outside the migration and `types.ts`, the repository has zero
`can_bring_main_dish` consumers, and the type file has no runtime output. P2 is a pure
allocator, P3a/P3b are seams/extraction, and P4 is the first phase that consumes the new
column. Requiring P1b before P4, P5a, P5b, and P8 is the correct graph. No later phase is
made harder by this two-file implementation.

D12 is respected in committed evidence. I found no member name, email, phone number, or
literal full user UUID. The full UUIDs present in prompts/ledger are month or match IDs;
caller UUIDs are selected inside SQL and never pasted. D14 persists no aggregate, and D15
leaves the incomplete `Functions` map untouched.

## FINAL CLOSE

- A1–A11: MET.
- D9/D12/D14/D15: CONFORMING.
- Function security: CONFORMING.
- Parent/tip diagnostics: CONFORMING, two removals and zero additions.
- Build/Vitest/Deno: CONFORMING.
- Scope and dependency graph: RATIFIED.
- BLOCKING findings: none.

P1a and P1b are approved for phase close and one PR at
`feat/mesa-md-schema@9cc637b`.
