SESSION: AUDIO · E3c-fix · RE-REVIEW (r1 + r2 acumuladas)

Re-review of phase `E3c-fix` for AUDIO (CASA podcast). You failed this phase once. You have final
say on BLOCKING items; the phase does not close until you pass it.

BRANCH: `phase/E3c-fix` @ `db8ed2ead6b66708122491aef66a5ee38ae6b8bd` — **unchanged since your r1**.
PARENT SHA: the same commit. **There is still no code diff, and that is correct by contract.**

Your r1 verdict is saved verbatim at
`git show docs/plan-audio:docs/plan/audio/reviews/REVIEW-E3c-fix-r1.md`.

## WHAT CHANGED — documentation only, on `docs/plan-audio`

Nothing was executed against the database in r2. No source file changed. The remediation is
corrections to claims plus new measurement. Read:

- `git show docs/plan-audio:docs/plan/audio/evidence/E3c-fix.md` — §2C (corrected), §5.1 (extended),
  §8 (scoped), §10.1 (what changed), §11 (new weak point)
- `git show docs/plan-audio:docs/plan/audio/evidence/E3c-fix-whatsapp-drift.md` — **new**
- `git show docs/plan-audio:docs/plan/audio/PLAN.md`, `## Phase E3c-fix` — `E3c.7`/`E3c.8`/`E3c.9` rewritten
- `git show docs/plan-audio:docs/plan/audio/LEDGER.md` — last entry is r2

## B1 — you were right, and it was validated before anything was rewritten

The 9 columns and 3 indexes of `20260612000000` are in the deployed database with no history row.
The r1 evidence read "pending in `schema_migrations`" as "DDL absent". Those are different claims.

### B1.1 — chronology, which is what you asked for

You asked for a pre-E3c snapshot or database/audit logs. There is no saved snapshot, but there is a
**dated audit log**: `cron.job_run_details`.

```
select count(*), min(start_time)::date, max(start_time)::date,
       count(*) filter (where status='succeeded') from cron.job_run_details where jobid=1;

62 ejecuciones | primera = 2026-06-12 | ultima = 2026-08-12 | 62 correctas
```

First execution **2026-06-12** — the date in both migration filenames, two months before E3c.

Corroborated independently by OID ordering (global monotonic counter):

| Object | OID | Origin |
|---|---|---|
| table `church_podcast_episodes` | 454973 | migration `20260610090000` (Jun 10) |
| `idx_music_musicians_phone` | 455068 | WhatsApp |
| `idx_church_children_volunteers_phone` | 455069 | WhatsApp |
| `idx_music_notification_logs_external_id` | 455070 | WhatsApp |
| `podcast_episode_slug_length` | 456530 | **E3c-fix, today 14:26 UTC** |
| `idx_podcast_episodes_slug` | 456531 | **E3c-fix, today 14:26 UTC** |
| `assign_podcast_episode_slug` | 456533 | **E3c-fix, today 14:26 UTC** |

The three WhatsApp indexes are consecutive — one transaction, in file order — 95 OIDs after a
Jun-10 table and **1,460 OIDs below** everything E3c created today. The wraparound caveat is stated
in the evidence. **Attack this if you think OID ordering is not sound here.**

### B1.2 — history vs schema now separated

`E3c.7` no longer claims anything about deployed schema. The surviving claim is narrower — *E3c-fix
deployed nothing foreign* — and rests on three sources **independent of migration history**:

- recorded statements of `20260808120000`: **10 total, 9 touch podcast, 0 touch WhatsApp**
- the mirror project **did not contain** the two files (`63 → 61`)
- both dry-runs and the push named exactly one migration

### B1.3 — drift recorded and handed off

`evidence/E3c-fix-whatsapp-drift.md`. **It found more than your r1 did:** the effects of
`20260612000001` are *also* deployed — cron job `wa_reminders_daily`, `0 18 * * *`, **active**,
firing a daily `http_post` at the `wa-reminders` edge function. Your r1 documented only
`…000000`'s objects. The doc also resolves the apparent contradiction with the earlier PM
measurement that `app.wa_reminders_url` is empty (it is; the GUC is not set at database level, so
the cron was created under conditions where the guard did not fire — the evidence declines to
speculate which).

**The cron command is deliberately truncated everywhere** — it carries `WA_REMINDERS_CRON_SECRET`
in its headers. Confirm that redaction is complete and correct.

### B1.4 — nothing touched

No apply, no `migration repair`, no rollback, no disabling the cron. The handoff doc names
`migration repair --status applied` as the likely fix **for its owning workstream** and states why
AUDIO must not run it: only someone who can confirm the deployed objects still match today's files
should touch that history.

## S1 — closed by measurement, not by adding a caveat

`prosrc` covers only the body. The missing attributes were measured:

| Function | `prosecdef` | Owner | ACL | `prokind` |
|---|---|---|---|---|
| `assign_podcast_episode_slug` | **false** (INVOKER) | `postgres` | standard Supabase | `f` |
| `church_podcast_episode_slug_body` | **false** (INVOKER) | `postgres` | standard Supabase | `f` |

Neither escalates privileges.

## CHECK — what is actually yours to rule on now

1. **Is the chronology sound?** This is the crux of the re-review. `cron.job_run_details` dates
   `20260612000001`'s effects. It does **not** directly date `20260612000000`'s columns and indexes
   — those rest on OID ordering plus the fact that both migrations share a date and a workstream.
   **Say whether you accept that, or whether the columns need their own dated evidence.** This is
   the weakest joint in the r2 argument and it is flagged rather than hidden.
2. **Is the corrected `E3c.7` now claiming only what it measures?** It should assert migration-history
   state and nothing else.
3. **Does any other claim in the phase still infer schema state from history?** That was the defect
   class; check it is gone everywhere, not just where you pointed.
4. **Is the drift handoff actionable and correctly scoped** — does it give the WhatsApp workstream
   what it needs without AUDIO having made a decision that is not AUDIO's?
5. **Is the secret redaction complete** across evidence, ledger, PLAN and prompts?
6. **Re-check the deferral of `E3c.6`** is still recorded and reopenable (Brent's decision, unchanged).
7. Everything you already passed in r1 — re-check only what r2's rewrites could have disturbed.
   **No database state changed between r1 and r2**, so E3c.1-E3c.5 should reproduce identically.

## GATES — re-run on the same tree, identical results

```
npm run build                          GREEN — ✓ built in 9.54s
npx vitest run --no-file-parallelism   6 failed | 1155 passed (1161) — same 6 MesaAbiertaDashboard
npm run lint                           161 problems (118 errors, 43 warnings) — identical
npx tsc --noEmit                       exit 0, vacuous (--listFiles → 0 repo files)
D18 changed-files gate                 not applicable, F = ∅, not run
```

You already ruled the red suite does not independently block this phase. Nothing changed there.

Review against the contract, not your preferences. Taste is a NIT. Only correctness, contract
violations, security and architectural violations are BLOCKING. Output using the CODEX REVIEW format.
