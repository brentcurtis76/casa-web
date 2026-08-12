SESSION: AUDIO · E3c-fix · RE-REVIEW (r1 + r2 + r3 acumuladas)

Re-review of phase `E3c-fix` for AUDIO (CASA podcast). **You have failed this phase twice, both
times on the same defect class.** You have final say on BLOCKING items.

BRANCH: `phase/E3c-fix` @ `db8ed2ead6b66708122491aef66a5ee38ae6b8bd` — **unchanged since r1**.
Still no code diff, still correct by contract. No database mutation in r2 or r3.

Your verdicts are saved verbatim:
`reviews/REVIEW-E3c-fix-r1.md` · `reviews/REVIEW-E3c-fix-r2.md` (both on `docs/plan-audio`).

## ROUND ACCOUNTING — read this before you rule

Overlay §5: *"After three Codex FAIL verdicts, stop and re-plan."* **Two are spent.** A third
BLOCKING ends the remediation loop and forces a re-plan with Brent. That is not an argument for
leniency — if something is genuinely broken, fail it. It is context for weighing BLOCKING against
SHOULD-FIX.

Overlay §5 also requires a **hypothesis change** after two consecutive failures in one defect
category. It was made explicitly and is recorded in the ledger:

- **r2's hypothesis (wrong):** the defect lives in the criteria; fix `E3c.7`/`.8`/`.9`. You showed
  it also lived in the out-of-scope section, the "trap" section and the risk table — all active
  contract. r2 even asserted *"ninguna aserción negativa se apoya ya en el historial"* **without
  having swept for it**. That sentence was itself an unmeasured claim, which is the same sin.
- **r3's hypothesis:** the defect belongs to the whole document, not to three lines. Treated as a
  systematic sweep: `grep` the entire defect family across PLAN + LEDGER + evidence + prompts,
  classify every hit as **active** (rewrite) or **historical** (mark superseded), then **verify the
  sweep with a second `grep`** that must return only already-marked text.

## B1 — the three active PLAN sections, rewritten

**B1.1 — Out of scope.** No longer "las otras dos migraciones pendientes". It now says what is
true: **orphaned drift** — effects deployed, history row missing — and that what remains to decide
is not deploying them but **reconciling deployment with history**, which is their workstream's call.

**B1.2 — "La trampa"** replaced with a two-row table of measured behaviour:

| Command | What it actually does |
|---|---|
| `supabase db push` bare | **Aborts without applying anything**: `LegacyDbPushMissingRemoteError` |
| `supabase db push --include-all` | **This** is the one that would **reapply** the two WhatsApp migrations |

Still forbidden in this phase, but for the correct reason: not because `db push` deploys foreign
schema, but because `--include-all` would **reapply** already-deployed, unregistered migrations.
`20260612000000` is idempotent; **`20260612000001` has not been audited for it**, and duplicating
the cron would have observable effect.

**B1.3 — risk table §7** rewritten to name `--include-all` as the dangerous command, with the same
distinction.

**B1.4 — six supersession notes on historical material**, which is preserved unrewritten:

- `evidence/E3c-fix-drift.md` — header banner with a table of what stays valid vs what was refuted,
  plus an inline note on the refuted paragraph itself
- four ledger entries (`siguen sin aplicar`, `ajenas sin aplicar`, `TRES migraciones sin aplicar`)
- `prompts/E3c-fix-r1.md` — header listing its **three** refuted assertions

**Sweep verified:** the control `grep` over PLAN + LEDGER + evidence + prompts now returns only text
already marked `SUPERADO` / `REFUTADO` / `CORREGIDO` / `HISTÓRICO`. **Re-run it yourself** — that
verification is the load-bearing claim of this round, and r2 taught that asserting a sweep is not
the same as doing one.

## S1 — chronology narrowed to exactly what each source proves

New table at §1.1 of `evidence/E3c-fix-whatsapp-drift.md`:

| Object | Proven | By what | **Not** proven |
|---|---|---|---|
| Cron `wa_reminders_daily` | exists, active, running since **2026-06-12** | `cron.job_run_details`, dated, 62 runs | — |
| The 3 indexes | **created before `E3c-fix`** | OID ordering (wraparound caveat) | their exact date — an OID is a counter, not a calendar |
| The 9 columns | **exist now** | `information_schema.columns` | their creation date — `pg_attribute` has no timestamp, no prior snapshot |
| **That `E3c-fix` did not create them** | **proven, without depending on any date** | recorded statements, mirror contents, push transcript | — |

Two r2 claims withdrawn: that OIDs assign a date, and that consecutive OIDs prove "una sola
transacción". The §3 title now says "la fecha **del cron**". The inference that both migrations were
applied together on 2026-06-12 is now labelled **as an inference, not a measurement**.

And the point that matters: **the phase's scope ruling depends on no date at all** — you said so
yourself in r2, and the document now says it too.

## CHECK

1. **Re-run the sweep.** `grep -rniE "sin aplicar|pendiente|desplegar[ií]a" PLAN.md LEDGER.md
   evidence prompts | grep -iE "whatsapp|20260612|casa_wa|ajen"` — every hit should be either
   rewritten-active or explicitly marked superseded. **This is the claim to attack.**
2. **Is the active contract now internally consistent?** Out-of-scope, trap, risk table, `E3c.7`,
   `E3c.8`, `E3c.9` must all tell the same story about history vs schema.
3. **Do the supersession notes actually prevent misreading?** A future reader landing on
   `E3c-fix-drift.md` §2 or the r1 prompt must not walk away believing the WhatsApp DDL is absent.
4. **Is any *new* unmeasured claim introduced by r3's rewrites?** That is the failure mode of a
   third round: fixing prose by asserting something else that was never measured.
5. **Is S1's narrowing now correct, or has it over-corrected** — does the document still support the
   scope conclusion it needs to?
6. **Everything you already passed** (E3c.1-E3c.5, E3c.7, E3c.8, secret redaction, source scope):
   no database state and no source changed since r1, so it should reproduce identically.

## GATES — re-run, identical, Node v22.22.0

```
npm run build                          GREEN — ✓ built in 8.07s
npx vitest run --no-file-parallelism   6 failed | 1155 passed (1161) — same 6 MesaAbiertaDashboard
npm run lint                           161 problems (118 errors, 43 warnings)
npx tsc --noEmit                       exit 0, vacuous (--listFiles → 0 repo files)
D18 changed-files gate                 not applicable, F = ∅, not run
```

**Your Node observation is recorded in the ledger and is worth keeping:** your first run inherited
Node 26.5.0 and produced 15 failures; the frozen v22.22.0 reproduced 6/1155. **The base failure
count depends on the Node version**, so any base comparison in this repo has to pin it. That is a
genuinely useful finding and it did not come from the executor.

Review against the contract, not your preferences. Taste is a NIT. Only correctness, contract
violations, security and architectural violations are BLOCKING. Output using the CODEX REVIEW format.
