# CODEX REVIEW — AUDIO · E3c-fix · ROUND 1

**Guardada literalmente por el ejecutor el 2026-08-12.** Revisión de `phase/E3c-fix` @ `db8ed2e`.
Respuesta del ejecutor: ronda r2, ver `LEDGER.md` y §10.1 de `evidence/E3c-fix.md`.

---

**VERDICT: FAIL — 1 BLOCKING, 1 SHOULD-FIX, 0 NIT**

The AUDIO repair itself is deployed correctly: the target migration is reconciled, all six slug objects exist, the API returns `200 []`, and production renders the empty state. The blocker is the claimed proof that no WhatsApp schema shipped.

## BLOCKING

### [B1] E3c.7 confuses migration history with deployed schema, and production falsifies that inference

The contract says the two WhatsApp versions remaining pending proves "que no se desplegó nada ajeno" (PLAN.md:1508). The evidence similarly says the two migrations remain unapplied (E3c-fix.md:590).

The history half is correct:

- Remote history contains 61 versions.
- `20260808120000` occurs exactly once with `name=church_podcast_episodes_slug`.
- `20260612000000` and `20260612000001` have no history rows.
- `db push --include-all --dry-run` lists exactly those two versions.

But the schema conclusion is false. A fresh production schema dump contains the complete material output of `20260612000000_casa_whatsapp_scheduling.sql`:

- WhatsApp opt-in/suppression columns on `music_musicians`.
- WhatsApp columns on `church_children_volunteers`.
- `read_at` and `failure_reason` on `music_notification_logs`.
- `idx_music_musicians_phone`.
- `idx_church_children_volunteers_phone`.
- `idx_music_notification_logs_external_id`.

Those objects occur in no other repository migration. Therefore, "pending history row" does not mean "DDL absent"; the database already has unrecorded WhatsApp schema drift.

This does **not** prove the E3c executor created those objects. The mirror dry-run and successful push output name only the AUDIO migration, and the recorded AUDIO history row contains only the expected slug statements. The problem is that the phase's highest-risk negative scope claim is not currently demonstrable, while the evidence presents it as demonstrated.

Required before PASS:

1. Establish whether the WhatsApp DDL predates the E3c execution window, using a saved pre-E3c schema snapshot or database/audit logs.
2. Correct the plan/evidence/ledger to distinguish:
   - migration-history status; and
   - actual deployed schema state.
3. Record the orphaned WhatsApp schema drift with its owning workstream.
4. Do not apply, repair, or roll back those WhatsApp migrations from AUDIO.

If dated evidence shows the objects pre-existed E3c, the mirror mechanism is sufficient to clear the phase-level scope concern. Without that chronology, E3c.7/E3c.9 and the requested "nothing from another workstream shipped" assurance remain open.

## SHOULD-FIX

### [S1] The static E3c.6 substitute has a broader metadata blind spot than documented

The evidence correctly says matching `prosrc` hashes would survive a disabled trigger. It should also record that `prosrc` does not cover function metadata such as `SECURITY DEFINER`, owner/ACL, or every execution attribute.

The current production dump is reassuring: both functions have the expected languages, volatility/search path, ordinary invoker semantics, and `postgres` ownership. This is not a current defect, but the substitute's stated coverage is narrower than its prose suggests.

## Criteria

| Criterion | Result |
|---|---|
| E3c.1 | PASS — 61 versions; target exactly once; correct name and stored statements |
| E3c.2 | PASS — 19 columns; `slug text`, nullable, position 19 |
| E3c.3 | PASS — two checks, partial unique index, two functions, trigger |
| E3c.4 | PASS — exact public query returns `HTTP 200`, `[]`, count 0 |
| E3c.5 | PASS — rendered DOM shows the empty state, not the error state; zero articles/errors |
| E3c.6 | DEFERRED — accepted per Brent's explicit decision; reopening condition is recorded |
| E3c.7 | FAIL — pending set is correct, but its "nothing foreign deployed" inference is false |
| E3c.8 | PASS for the recorded AUDIO migration statements; global negative assurance remains subject to B1 |
| E3c.9 | FAIL pending correction of the WhatsApp schema claim |

## Mechanism ruling

The mirror mechanism is acceptable and not a scope violation.

Supabase CLI v2.110.0 parses the version/name from the filename and appends the migration-history insert to the same implicitly transactional batch as the migration statements. Production's history row also stores the exact expected statement array.

`migration repair` was not a cleaner substitute. It only inserts/deletes migration-history records without executing the DDL; Supabase documents that behavior explicitly. It would be appropriate only after applying the SQL through another privileged channel, which was the unavailable part here.

## Gates reproduced with Node v22.22.0

- Exact branch/SHA: `phase/E3c-fix @ db8ed2e`; diff against parent empty; worktree clean.
- Build: PASS — 4,988 modules, 7.13s.
- AUDIO tests: PASS — 112/112.
- Full Vitest: RED — 6 failed, 1,155 passed; all six are the known `MesaAbiertaDashboard` parent failures.
- Lint: 161 problems exactly — 118 errors, 43 warnings.
- `tsc --noEmit`: exit 0, but `--listFiles` confirms zero repository files; correctly treated as vacuous.
- D18 changed-file gate: correctly not applicable because `F=∅`.
- e2e: optional here and correctly reported as not run.

The red full suite does not independently block E3c: the governing phase contract requires zero new failures relative to `db8ed2e`, and HEAD is literally that same commit.

**Final count: 1 BLOCKING / 1 SHOULD-FIX / 0 NIT. Phase remains open.**
