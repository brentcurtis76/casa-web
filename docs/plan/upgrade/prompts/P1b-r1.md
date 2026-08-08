SESSION: UPGRADE · P1b · r1 · EXEC

You are the executor for **UPGRADE** (La Mesa Abierta · opt-out del plato principal),
phase **P1 — Esquema: columna + RPC de resumen**, round **r3**. You have no prior context.

**This round writes no source code and makes no database write.** Rounds 1 and 2 produced
zero defects: both scope files are finished and independently verified by the PM, and every
local gate is green. The only thing P1 lacks is proof that the migration behaves as the
frozen contract says against the live database — criteria **A3 through A8**.

Round 2 established that **both** agent-side write channels are shut: Claude Code's
permission classifier blocked `apply_migration` in r1, and in r2 the MCP server itself
answered `Cannot apply migration in read-only mode` (`supabase-casa` runs with
`--read-only`). So Brent applies the migration by hand. **You never attempt to apply it.**

BRANCH: `feat/mesa-md-schema`, already pushed. Verify before anything else:

```bash
cd /Users/brentcurtis/dev/casa-upgrade   # UPGRADE has its own worktree; casa-web is another workstream
git rev-parse --abbrev-ref HEAD          # feat/mesa-md-schema
git diff d9eebb0 -- supabase/migrations/20260806000000_mesa_main_dish_optout.sql src/integrations/supabase/types.ts
```

That diff **must be empty**. If it is not, stop and report `STATUS: FINDINGS`. **Never merge
to `main`. Never push to `main`. Do not edit either scope file.**

---

## STEP 0 — the gate. One read-only call. No write, ever.

> **The PM confirms this reads `1/1` before dispatching you.** Since 2026-08-08 the PM runs
> this query itself and only sends this prompt once PR3 has landed. A whole executor session
> is far too expensive a way to discover that a paste hasn't happened yet — it cost two. So
> STEP 0 is a **tamper check** now, not a discovery step. If it comes back `0/0` anyway,
> something changed between dispatch and now: stop in one call and say exactly that.

```sql
select
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='mesa_abierta_participants'
       and column_name='can_bring_main_dish') as column_exists,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='public' and p.proname='get_my_dinner_summary') as function_exists;
```

- **Both `1`** → the migration is applied. Go to STEP 1.
- **Both `0`** → **stop here.** Report `STATUS: BLOCKED`, one line: "migration not applied,
  nothing to verify." **Do not call `apply_migration`** — both of its gates are already
  proven shut and a third attempt only burns the round. Do not call it "to confirm".
- **Mixed (`1`/`0`)** → partial application. **Stop.** `STATUS: FINDINGS` with both numbers.
  Do not repair it; that is Brent's call on a production schema.

**Forbidden, absolutely:** `apply_migration`, `supabase db push` (D9), `psql`, the Supabase
CLI, editing `~/.claude.json` to strip `--read-only`, hunting for a service-role key or
database URL, and the `open-brain` MCP server (a *different* project,
`nnfwmjqrvyvtpfrxnkvz`). Never touch the 11 Life OS tables listed in `CLAUDE.md`.

---

## STEP 1 — A3, A4, A5

Reads, through `mcp__supabase-casa__execute_sql`. They work fine under the read-only user.
If the MCP returns only the last statement's rows, split into four calls and paste all four.

```sql
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema='public' and table_name='mesa_abierta_participants'
   and column_name='can_bring_main_dish';

select count(*) as rows_not_true
  from public.mesa_abierta_participants
 where can_bring_main_dish is distinct from true;

select p.prosecdef, p.proconfig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname='public' and p.proname='get_my_dinner_summary';

select has_function_privilege('anon',          'public.get_my_dinner_summary(uuid)', 'EXECUTE') as anon_can,
       has_function_privilege('authenticated', 'public.get_my_dinner_summary(uuid)', 'EXECUTE') as authed_can;
```

- **[A3]** `can_bring_main_dish / boolean / NO / true`, and `rows_not_true = 0` across all 31 rows.
- **[A4]** `prosecdef = true`, and `proconfig` shows `search_path=` **empty** (renders as
  `{"search_path="}`). Absent or non-empty `search_path` is BLOCKING, not a detail — an empty
  search_path is the whole reason this `SECURITY DEFINER` function is safe.
- **[A5]** `anon_can = false`, `authed_can = true`.

## STEP 2 — A6, A7, A8

The PM verified that a multi-statement `execute_sql` call shares one transaction, that
`set_config(…, true)` therefore persists across its statements, and that `auth.uid()` reads
it. **Do not use `SET LOCAL ROLE authenticated`** — denied to the read-only user, and
unnecessary: the function is `SECURITY DEFINER` and filters on `auth.uid()`, not RLS.

Fixture chosen because every user in that month belongs to exactly one of its two matches, so
"the same row" is unambiguous. Month `60a263e9-9412-41bc-bd9a-659c1df2cf0f`:

| match | total_people | main_dish_count |
|---|---|---|
| `3d4d6709-e86e-4190-a491-9c74e14b00bf` | **6** | **1** |
| `771bd494-bd2a-4240-9702-1584dfebb6b0` | **9** | **2** |

**[A6] — two callers, both expected to return 0 rows.**

```sql
select set_config('request.jwt.claims',
  (select json_build_object('sub', p.user_id)::text
     from public.mesa_abierta_matches m
     join public.mesa_abierta_participants p on p.id = m.host_participant_id
    where m.id = '0b75da06-c7d3-499a-8ee4-c3312f84d2be'), true) as ignored;
select auth.uid() is not null as claim_is_set,
       count(*) as rows_returned
  from public.get_my_dinner_summary('60a263e9-9412-41bc-bd9a-659c1df2cf0f');
```

Expected `claim_is_set = true`, `rows_returned = 0` — that caller hosts a dinner in a
*different* month. Repeat with `'00000000-0000-0000-0000-000000000000'` as the `sub`, also
expecting 0, so the criterion does not rest on one sample. **`claim_is_set = false` means
your claim never took and the 0 proves nothing** — report that, not the 0.

**[A7] — host of `3d4d6709…`:**

```sql
select set_config('request.jwt.claims',
  (select json_build_object('sub', p.user_id)::text
     from public.mesa_abierta_matches m
     join public.mesa_abierta_participants p on p.id = m.host_participant_id
    where m.id = '3d4d6709-e86e-4190-a491-9c74e14b00bf'), true) as ignored;
select * from public.get_my_dinner_summary('60a263e9-9412-41bc-bd9a-659c1df2cf0f');
```

Expected: exactly **1** row — `(3d4d6709-e86e-4190-a491-9c74e14b00bf, 6, 1)`.

**Show the manual D1 arithmetic**, not just the match — host + host's `+1` + each guest +
each guest's `+1`, laid out as a sum beside the RPC's answer:

```sql
select (select count(*) from public.mesa_abierta_assignments a
         where a.match_id = '3d4d6709-e86e-4190-a491-9c74e14b00bf') as guests,
       (select count(*) from public.mesa_abierta_participants hp
          join public.mesa_abierta_matches m on m.host_participant_id = hp.id
         where m.id = '3d4d6709-e86e-4190-a491-9c74e14b00bf' and hp.has_plus_one) as host_plus_ones,
       (select count(*) from public.mesa_abierta_assignments a
          join public.mesa_abierta_participants gp on gp.id = a.guest_participant_id
         where a.match_id = '3d4d6709-e86e-4190-a491-9c74e14b00bf' and gp.has_plus_one) as guest_plus_ones;
```

A7's whole point is that the SQL and the D1 rule agree. Quoting the SQL's own answer twice
does not show that.

**[A8] — a guest of that same match:**

```sql
select set_config('request.jwt.claims',
  (select json_build_object('sub', p.user_id)::text
     from public.mesa_abierta_assignments a
     join public.mesa_abierta_participants p on p.id = a.guest_participant_id
    where a.match_id = '3d4d6709-e86e-4190-a491-9c74e14b00bf'
    order by p.id limit 1), true) as ignored;
select * from public.get_my_dinner_summary('60a263e9-9412-41bc-bd9a-659c1df2cf0f');
```

Expected: **the same single row** as A7.

## STEP 3 — evidence, not criteria

**Not** acceptance criteria, and not pass/fail gates — the plan is frozen and no requirement
is being added to it. They are cheap evidence the reviewer will want:

- **V1 — what landed is what the repo says.**
  `select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public' and p.proname='get_my_dinner_summary';`
  Paste it. Flag any difference from the repo file beyond Postgres's own normalisation (it
  re-prints `AS $function$`, adds `DEFAULT` markers, may reflow whitespace — formatting, not
  drift). A difference in the **WHERE clause or the arithmetic** is `FINDINGS`.
- **V2 — nothing else moved.** Via `mcp__supabase-casa__execute_sql`:
  `select count(*), max(version) from supabase_migrations.schema_migrations;` and confirm
  `20260612000000` / `20260612000001` are **still absent**, and that
  `mesa_abierta_participants` still has **31** rows. Before this round the applied count was
  **59**, last `20260610233000`. Applying by hand from the SQL editor does **not** write a
  `schema_migrations` row, so **59 with `20260806000000` absent is the expected outcome** and
  is not a defect — record whichever you find. Anything else applied is `FINDINGS`.

## STEP 4 — tamper check

No file changed, so the local gates cannot have moved. Run the gate once as proof the branch
is what the PM verified:

```bash
bash scripts/gates/changed-files-diagnostics.sh \
  supabase/migrations/20260806000000_mesa_main_dish_optout.sql \
  src/integrations/supabase/types.ts \
  src/components/mesa-abierta/MesaAbiertaAdmin.tsx \
  > /tmp/p1r3-head.txt 2>/tmp/p1r3-head.err
echo "EXIT=$?"
```

`EXIT` must be `0`; stderr must read `tsc=1039 eslint=160 deno-lint=94 deno-check=46`.
**Never pipe a gate command through `tail`** — it reports tail's exit code, which masked a
real failure twice in this workstream. Do **not** re-run build, Vitest or Deno: verified in
r1, and no file has changed since.

---

## 🔒 PII — real church member data (D12 + `CLAUDE.md`)

**No names, no emails, no phone numbers, no addresses** in your report or ledger entry. Match
and month IDs are fine — they identify dinners, not people. Any `user_id` or
`participant_id` you cite must be **truncated to its first 8 hex characters**. Every query
above takes user IDs from subqueries so you never have to paste one; keep that property in
anything you write yourself.

## EXPLICITLY OUT OF SCOPE

Every source file, including r1's two. The `Functions` map of `types.ts` (D15). Pre-existing
diagnostics. The 6 red Vitest tests (P8's). The `CuentacuentoEditor` flake (backlog B-01 /
B-05) — re-running the suite to chase it is not your round. Deploying anything. Applying
`20260612000000` or `20260612000001`. Backfilling data. Touching any configuration file.

## RULES

- **This is the third and last executor round available under SOP §1.5.** Do not spend it on
  a channel that is already proven shut: if STEP 0 says the migration is not applied, stop in
  one call.
- Do not grade your own work in prose. Paste raw output.
- If any of A3–A8 comes back wrong — a non-empty `search_path`, `anon_can = true`, a row
  count disagreeing with the table above — that is `STATUS: FINDINGS`, not something to
  explain away. A wrong-but-green report against a production schema is the worst outcome
  available to this round.
- If the function is missing despite Brent having applied the SQL, or exists with an
  unexpected signature, report it verbatim rather than reasoning about what probably happened.

## WHEN DONE

Append your entry to `docs/plan/upgrade/LEDGER.md` and commit it on `feat/mesa-md-schema`
(**not** `main`, **not** any other branch — a P0 round lost seven ledger entries that way,
backlog B-02):

```markdown
### 2026-08-08 — P1b r1 — Claude Opus 5 (EXEC)
- SESSION: UPGRADE · P1b · r1 · EXEC
- CONTEXT PRESSURE:
- ACTION:
- COMMITS:
- TESTS:
- FINDINGS RAISED:
- DECISIONS:
- BACKLOG ADDED:
- OPEN AFTER THIS ROUND:
```

Then output exactly this report:

```markdown
## EXECUTOR REPORT — P1b round 1
STATUS: COMPLETE | BLOCKED | FINDINGS
CONTEXT PRESSURE: comfortable | tight | ran out — <one line: at what point?>
BRANCH: <branch>   COMMITS: <sha…>
FILES CHANGED: <path (+x/-y) …>   (expected: LEDGER.md only)
WHAT I DID: <bullets, one per acceptance criterion, each mapped to criterion ID>
TEST COMMAND: <verbatim>
TEST OUTPUT: <verbatim tail, unedited>
ACCEPTANCE CRITERIA: <A3–A8: met / not met / partially — with reason. A1, A2, A9, A10, A11
  were met in r1 and independently verified by the PM; restate as "met in r1", do not
  re-derive.>
DEVIATIONS FROM PROMPT: <or "none">
ASSUMPTIONS MADE: <or "none">
NOT DONE / OPEN:
```

Include verbatim: every raw A3–A8 result, V1, V2, and the gate exit code with its stderr
line. The PM will re-run all of it independently — a report is a claim, not evidence.
