SESSION: AUDIO · E3a · REVIEW

Third review of E3a (revision 17), AUDIO plan. You failed r15 with six BLOCKING and r16 with three.
All nine were accepted; none was argued down. This round exists because Brent explicitly overrode
the SOP §1.5 two-round cap rather than accept-with-amendments. **Scope is narrow: confirm the six
r16 findings are closed, and say whether this can freeze.**

WHERE THE PLAN LIVES: only on branch `docs/plan-audio`, never `main`. Use
`git show docs/plan-audio:docs/plan/audio/PLAN.md` and `…/LEDGER.md`. Code is on `main`.

WHAT CHANGED SINCE r16 — nothing was measured again, deliberately: all six were wording and
criteria defects, not behaviour. Verify each landed and that none introduced a new problem.

- **B1** — the "client never sees a slug `23505`" claim is deleted. A new **«Concurrencia»**
  section promises exactly three things: integrity always (no published-without-slug, no
  duplicate, unique index — not `NOT EXISTS` — as arbiter); `publishService` retries the whole
  UPDATE generically so one mechanism covers both number and slug races; and **it does not promise
  every publisher succeeds**. New explicit decision: a transient `podcast-backfill` failure
  (no retry at `index.ts:353-367`) is **accepted** — batch admin operation, rerun recovers,
  integrity intact; adding retry there goes to backlog rather than pulling that edge function into
  this phase. **Judge that acceptance, not just its wording.**
- **B2** — new criteria E3a.11 (base derives from the *persisted* title A, not `metadata.title` B;
  requires adding `title` to the select at `publishService.ts:140`), E3a.12 (the UPDATE does
  `.select('episode_number, slug')`; a trigger-resolved `x-2` must surface as
  `PublishResult.slug === 'x-2'` with `canonicalUrl` ending `/x-2`), and E3a.13 (two-session
  concurrency: no duplicate, loser gets `23505`, reissue succeeds). Three declared mutations.
  Criteria went 14 → 16.
- **B3** — the stale "los cuerpos de E3a y E3b siguen … como borrador, no como contrato" line now
  covers only E3b; META revision is 17 in both places.
- **S1** — test command is now `docker exec … psql` with the container name derived from
  `project_id`; `psql` is genuinely absent from the host.
- **S2** — the SQL mutation now keeps `RETURN NEW` and sets `NEW.slug := NULL`.
- **S3** — the `1c4490f..1d6869d` delta is described in full.

ASSESS — only these
1. Is each of B1, B2, B3, S1, S2, S3 actually closed?
2. **B1's accepted risk:** is "a concurrent backfill invocation may fail and need a rerun" a
   defensible thing to freeze, or does it need retry/serialisation before execution?
3. **B2's new criteria:** are they genuinely falsifiable? Do the three declared mutations kill?
   Is anything else in the publish path still assertable-but-unasserted?
4. Did any amendment introduce a new contradiction? The document has been spliced repeatedly and
   r16/B3 was exactly that failure — check for others.
5. Freeze or not. If not, say plainly whether the remaining gap is worth a fourth round or should
   be carried into execution as a mandatory amendment, because there will not be an r18.

Do not re-litigate what you already ruled fixed in r16 (B1/B4/B6 of r15, the D22 correction, H4,
seed/smoke removal, parent-SHA strategy, sizing, plpgsql placement) unless an r17 edit broke it.

Taste is a NIT. Only correctness, contract violations, security and architectural violations are
BLOCKING. Output using the CODEX REVIEW format.
