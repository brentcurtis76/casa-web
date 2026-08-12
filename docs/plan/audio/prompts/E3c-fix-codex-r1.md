SESSION: AUDIO · E3c-fix · REVIEW (primera review de la fase)

Review of phase `E3c-fix` for AUDIO (CASA podcast). You have final say on BLOCKING items; the phase
does not close until you pass it.

BRANCH: `phase/E3c-fix` @ `db8ed2ead6b66708122491aef66a5ee38ae6b8bd`. PARENT SHA: **the same commit**.

## READ THIS FIRST — THIS PHASE HAS NO CODE DIFF, AND THAT IS CORRECT

```
$ git diff db8ed2ead6b66708122491aef66a5ee38ae6b8bd --stat
(empty)
$ git rev-parse HEAD
db8ed2ead6b66708122491aef66a5ee38ae6b8bd
```

`phase/E3c-fix` is byte-identical to its parent. **Do not report the empty diff as a defect and do
not look for source changes — there are none by contract.**

What you are reviewing is a **state change to the deployed production database** and the evidence
that claims it happened. The artifact under review is:

- `git show docs/plan-audio:docs/plan/audio/evidence/E3c-fix.md` — the evidence, ~618 lines
- `git show docs/plan-audio:docs/plan/audio/PLAN.md`, section `## Phase E3c-fix` — the contract
- `git show docs/plan-audio:docs/plan/audio/LEDGER.md` — last entry is this round

**THE PLAN IS ON ANOTHER BRANCH** (`docs/plan-audio`), never on `main`. A checkout of `main` will
not find it.

## WHY THE PHASE EXISTS

`E3b` merged and deployed. The page queries `slug`. The column did not exist in the database.
`/reflexiones` served its **error** state in production. `main` was correct; nobody had written down
that **merging to `main` does not deploy schema**. That is the escaped defect this phase closes.

Database: `mulsqxfhxxdsadxsljss` — **shared with Life OS**. RISK tier: `HIGH`.

## WHAT WAS DONE, IN ONE PARAGRAPH

One migration — `20260808120000_church_podcast_episodes_slug.sql`, byte-verified by SHA-256 against
`db8ed2e` — was applied to the deployed database via `supabase db push --workdir <mirror>`, where
`<mirror>` is a scratchpad copy of the project holding **all 63 migrations minus the two WhatsApp
ones**. The repo was never modified. Version registered: exactly `20260808120000`, once. Production
went from `400` to `200` and the page now renders its empty state.

## THE TWO THINGS THAT DESERVE YOUR HARDEST LOOK

### 1. The mechanism is unconventional. Rule on it.

The contract forbade `supabase db push` bare, because it applies **all** pending migrations and two
of the three belong to another workstream (`20260612000000_casa_whatsapp_scheduling`,
`20260612000001_casa_wa_reminders_cron`). The executor's answer was a mirror project directory.

Interrogate specifically:

- **Did it register the right version, and only it?** The claim is that the CLI derives the version
  from the filename and writes the history row **in the same transaction** as the statements. If
  that is wrong, the row could be inconsistent with what actually ran.
- **Did anything from the other workstream get deployed?** `20260612000000` creates schema.
  Evidence §2C claims both are still pending. Verify against the database, not against the report.
- **Is the mirror a scope violation?** It copied 61 migration files out of the repo into a scratch
  directory and ran the CLI there. The repo is provably untouched (`git status` clean, 63 files
  still present). Say whether you accept the mechanism or consider it a contract breach.
- **Is there a cleaner mechanism the executor missed?** It ruled out `psql` (absent),
  MCP `apply_migration` (registers its own version ⇒ breaks E3c.1), MCP `execute_sql` (read-only
  role), and a direct `pg` connection (would require extracting the DB password from the keychain in
  plaintext — deliberately not done). `supabase migration repair` exists and is **not discussed in
  the evidence** — judge whether it was a better path and whether missing it matters now that the
  end state is verified.

### 2. `E3c.6` is DEFERRED — Brent decided this on 2026-08-12, after the r1 report

**Do not FAIL the phase for `E3c.6` being absent.** The criterion demanded a live falsifiable
trigger test (insert draft → publish → gets slug → mutation rejected with `23514` → delete row).
The executor could not run it and did not fake it:

```
insert into public.church_podcast_episodes … ;
ERROR:  42501: permission denied for table church_podcast_episodes

select current_user, current_setting('transaction_read_only');
current_user = supabase_read_only_user | transaction_read_only = off
```

The MCP writes are impossible by **role**, and every other privileged path registers a new
`schema_migrations` row, which would break `E3c.1` — the phase's central criterion. The executor
reported the contradiction instead of forcing it. Brent accepted the deferral. The amended criterion
is in the PLAN.

**What is legitimately yours to rule on here:**

- Is the accepted substitute honest? It is: `tgenabled='O'`, plus **SHA-256 equality between the
  deployed `prosrc` and the reviewed file body** for both functions, plus the 112 `E3a`/`E3b` tests
  passing. Verify the hashes yourself if you doubt them.
- **Is the stated blind spot the right one?** The evidence says the hash match is *static* and would
  survive a later `DISABLE TRIGGER`. Is there a further blind spot it failed to declare?
- Is the deferral recorded well enough that it cannot silently disappear? It must be reopenable.

## THE EIGHT LIVE CRITERIA — verify against the database, not the report

| | Claim |
|---|---|
| **E3c.1** | `20260808120000` registered **exactly once**, no invented versions. `60 → 61` total. Zero duplicate versions across all 61. `name = church_podcast_episodes_slug` |
| **E3c.2** | `church_podcast_episodes` 18 → 19 columns; new one is `slug text`, nullable, position 19 |
| **E3c.3** | Six objects, read from `pg_constraint`/`pg_indexes`/`pg_proc`/`pg_trigger`, **`0/6` before → `6/6` after**: both CHECKs, the partial unique index, both functions, the trigger |
| **E3c.4** | The page's exact query: `400 (42703)` → **`200`**, body `[]` (table is empty, and that is correct) |
| **E3c.5** | `/reflexiones` renders the **empty** state, not the error state — verified on the **DOM**, since the SPA shell returns `200` either way |
| **E3c.6** | **DEFERRED** — see above |
| **E3c.7** | After reconciliation, `db push --include-all --dry-run` lists pending = **exactly** the two WhatsApp migrations, **not** `20260808120000` |
| **E3c.8** | No Life OS table touched |
| **E3c.9** | The evidence file itself |

**E3c.8 deserves a specific look.** The executor's argument is unusual and, if correct, unusually
strong: the *only* write in the entire phase was the SHA-verified migration file, and **every other
statement ran through a role that cannot write** — the same `42501` that killed `E3c.6` is what
guarantees `E3c.8`. Decide whether you accept that as proof. The 11 Life OS tables are `goals`,
`habits`, `habit_logs`, `health_logs`, `journal_entries`, `life_areas`, `lifeos_calendar_events`,
`lifeos_tasks`, `meditation_logs`, `project_health`, `workout_logs`.

## GATES — one is RED, and it is reported red on purpose

```
npm run build                          GREEN — ✓ built in 7.27s, 4988 modules transformed
npx vitest run --no-file-parallelism   RED   — 6 failed | 1155 passed (1161)
npm run lint                           161 problems (118 errors, 43 warnings)
npx tsc --noEmit                       exit 0 — but VACUOUS
```

- The 6 failures are all `MesaAbiertaDashboard.test.tsx`, a **base-red family** named in the
  contract. **Zero** failures in `reflexiones`/`slug`/`podcast`: the 112 tests that encode the slug
  contract pass **against the newly applied schema**, which is the real signal in this phase.
- **The base comparison is stronger than usual and you should check it:** the tree measured **is**
  `db8ed2e` — same SHA, same lockfile, same `node_modules`. There is no branch to regress.
- `lint` at `161` is the exact project total recorded at `E3b` close. Zero delta.
- **`tsc --noEmit` exits 0 while checking ZERO of the repo's own files** (`--listFiles | grep -v
  node_modules | wc -l` → `0`). The executor recorded it as a measurement and explicitly refused to
  offer it as evidence of type safety. Confirm that framing is honest.
- D18's changed-files gate **does not apply** (`F = ∅`) and **was not run**; the evidence says so
  rather than reporting a green gate it never executed.
- e2e was not run — the contract makes it conditional and there is no source diff.

**The executor did not relabel the red gate.** It states both readings: under overlay §5 a red
required gate is `BLOCKED`; under this contract's own wording ("cero fallos nuevos respecto de
`db8ed2e`") it is met. **Rule on which governs.** If you hold that the red `mesa-abierta` family
blocks this phase, say so plainly — but weigh that those 6 failures are unrelated to AUDIO, predate
the phase, and that the alternative is leaving production broken.

## CHECK

1. **Verify the end state against the database itself.** Every claim in §3–§6 of the evidence is a
   query you can re-run. Do not take the pasted output on trust.
2. **The reconciliation is the crux.** If `schema_migrations` were wrong, a future `db push` would
   retry a **non-idempotent** migration and die with `42710 duplicate_object` (the `ADD CONSTRAINT`
   at `:39` and `:146` have no guards). Confirm `E3c.1` and `E3c.7` really close that.
3. **Confirm nothing from the other workstream shipped.** This is the highest-consequence way this
   phase could have gone wrong.
4. **`E3c.5` needs the DOM.** A `curl` returning `200` proves nothing here. If you verify it, verify
   it rendered.
5. **Partial application.** The migration is not wrapped in an explicit transaction by the file
   itself. `E3c.2`/`E3c.3` exist to detect a half-applied state object by object. Confirm the
   verification is genuinely per-object and not inferred from "no error".
6. **Scope creep.** Confirm: no episodes seeded, `index.html`/`vercel.json`/meta/canonical/404
   untouched (that is `E4`), no `DROP`/`TRUNCATE`/destructive `ALTER`, no merge or push to `main`.
7. **Evidence honesty.** This is a phase whose entire output is a document. Look for confidence
   prose standing in for raw output, for gates claimed but not run, and for the failure modes it
   declares versus the ones it quietly skips. The evidence's own §11 names two weak points — judge
   whether that list is complete.
8. Frozen decisions in play: **D9** (additive only), **D12** (slug immutability), **D13** (no member
   PII — the table is empty; the one synthetic row was never created), **D23**, **D26**, and the
   repo hard rule on the 11 Life OS tables.

Tools on the host: `supabase` CLI `2.110.0`, `node v22.22.0`, **`psql` absent**. The MCP
`supabase-casa` reads as `supabase_read_only_user`. The anon key is in
`src/integrations/supabase/client.ts:6` and is publishable.

Review against the contract, not your preferences. Taste is a NIT. Only correctness, contract
violations, security and architectural violations are BLOCKING. Output using the CODEX REVIEW format.
