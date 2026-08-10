# LEDGER — BILINGUE

### 2026-08-10 — plan round 1 — PM (planner)

- SESSION: `BILINGUE · plan · PM`
- ELAPSED: ~35 min (approximate — measured from first tool call to PLAN.md write, 15:34→16:09;
  session start was not stamped)
- STAGE: planning 35m | fresh review 0m | triage 0m
- EFFORT: PM `high` (global default per SOP-PILOT C1)
- FIRST-PASS: pending — Codex plan review (SOP §3.2) has not run
- CONTEXT PRESSURE: comfortable — verification was ~20 targeted commands and queries, not a
  broad sweep. Reading `CuentacuentoEditor.tsx` (7,262 lines) was deliberately avoided; only
  line counts were taken from it.
- ACTION: created the plan root `docs/plan/bilingue/` (`PLAN.md`, `LEDGER.md`, `reviews/`,
  `evidence/`, `prompts/`) and drafted a **discovery-only** PLAN — six phases D1–D6 producing an
  evidence pack and a scope-decision memo. No feature phases were written; every one of them
  depends on an answer D1–D5 produces, and writing them now would repeat the failure that sank
  `docs/plan/PLAN-BILINGUE.md`.
- COMMITS: none — working tree only, pending Codex plan review
- TESTS: `npx tsc --noEmit` → exit 0, no output (run in `/Users/brentcurtis/dev/casa-web` on
  `phase/pd-refine`; `/Users/brentcurtis/dev/casa-pilot` has no `node_modules`).
  `bash string-census.sh` → 174 files, 1,414 non-comment Spanish-bearing lines.
- FINDINGS RAISED:
  - **Two corrections to the handoff brief.** (a) The "52 distinct `tipo` values" framing
    overstates the matrix: 52 = 18 fixed slugs (30 rows each) + 32 one-row `custom-<uuid>`
    instances of a single kind + `contenido-adicional` (1) + `anuncio-adicional` (1). The matrix
    needs 20 kind rows plus one `custom-*` rule. (b) `custom_content` is not used by `custom-*`
    types at all — all 54 populated rows are on the three `oracion-*` types, zero on `custom-*`.
  - **`published_resources` is stricter than the review characterised.**
    `UNIQUE (resource_type) WHERE is_active = true` is one active resource per type
    **system-wide**, not per liturgy. `resource_type` is CHECK-constrained to
    `{cuentacuento, reflexion}`.
  - **A ninth FK child of `liturgias` exists that no prior document names:**
    `church_podcast_episodes` (`ON DELETE SET NULL`).
  - **`slides` is a JSON object, not an array** (539/539 rows). `edited_slides` is populated on
    **zero** rows.
  - **`liturgias` UPDATE policy has no `WITH CHECK`** — `USING (auth.uid() = created_by)` only.
    Any "fixed at birth" rule cannot be enforced by the existing policy.
  - **Personal data is baked into cover pixels:** `Portadas.tsx:449` writes
    `subtitle: context.preacher` with `textBakedIn: true` at :458. No field-level PII census
    would find this.
  - **The string census is 1,414, not ~362 or ~516** — and the two prior numbers are
    irreconcilable because neither stated a comment policy. Excluding Spanish code comments
    changes the raw count by 3× (2,728 → 1,414); in `CuentacuentoEditor.tsx`, 434 of 596
    accent-bearing lines are comments. 567 of the 1,414 are edge-function AI prompts, which are
    generation instructions rather than extractable copy.
- DECISIONS: D-A (no source changes) · D-B (every claim carries its command) · D-C (every phase
  ships a verify script) · D-D (record shapes and counts, never personal-data values) · D-E
  (discovery describes, never prescribes) · D-F (Brent's product decisions stand).
  L1–L8 from `PLAN-BILINGUE.md` are explicitly **not** carried forward.
- BACKLOG ADDED:
  - Orphan duplicate source files with spaces in the name (`UniversalSlide 2.tsx`,
    `PresenterView 2/3/4.tsx`, `SlidePreview 2.tsx`, `types 2/3.ts`) — excluded from all counts,
    not this workstream's to fix.
  - `music_packet_deliveries` at 0 rows and `church_children_packet_deliveries` at 1 suggest the
    delivery paths are barely exercised and probably under-tested.
- OPEN AFTER THIS ROUND:
  - PLAN.md is **not frozen.** It needs Codex plan review (SOP §3.2) before any phase runs.
  - Largest unverified item, assigned to D2 as its top risk: whether the 32 `custom-*` rows are
    homogeneous. Their `custom_content` is null, so their text is in `slides` or `titulo` and I
    did not establish where.
  - Not run this round: `npm run lint`, `npm test`, `npm run build`. Only `npx tsc --noEmit`.
  - Blocking on Brent, carried forward for D6 rather than asked now: the default English Bible
    translation, and the English liturgical texts for the six canonical elements in
    `src/data/elementos-fijos/`.

### 2026-08-10 — plan round 2 — PM (planner)

- SESSION: `BILINGUE · plan · PM` (same session as round 1; plan not yet frozen)
- ELAPSED: ~40 min (16:09 → ~16:49; verification 25m, rewrite 15m)
- STAGE: triage + independent verification 25m | rewrite 15m | fresh review 0m
- EFFORT: PM `high`
- FIRST-PASS: **no** — Codex FAIL on draft 1 (`5ee2f17`), 10 BLOCKING · 5 SHOULD-FIX · 1 NIT.
  Review stored at `reviews/BILINGUE-PLAN-review-2.md`.
- CONTEXT PRESSURE: comfortable — triage was ~8 targeted commands and queries.
- ACTION: verified all ten BLOCKING findings independently before accepting any, then rewrote
  `PLAN.md` end to end. Phase count 6 → 8 (D2 pre-split into D2a/D2b/D2c). Three new frozen
  decisions (D-G, D-H, D-I); D-C rewritten; D-F narrowed.
- COMMITS: (this round) — see git log for the draft-2 SHA
- TESTS: verification commands only; no gates re-run this round (zero source diff).

- **VERIFIED BEFORE ACCEPTING — all ten BLOCKING confirmed:**
  - **[B1] My own census was broken in exactly the way I was criticising.** The orphan exclusion
    silently failed inside the script: dumping the script's own file list gives 21 files for
    `liturgia-builder` where the same `find` run directly gives 19. Corrected totals **166 files /
    1,402 copy-lines** (was 174 / 1,414) — matching the reviewer's numbers exactly. Rewrote the
    filter to `grep -vE` on the stream, which has no `find -regex` dialect ambiguity. Also accepted
    the metric correction: accent-bearing lines are a **lower-bound candidate set**, not an upper
    bound — `Guardar`, `Cancelar`, `Presentar` are Spanish without accents.
  - **[B2] Confirmed — and this was the worst of it.** Draft 1's Decision Log called `custom-*`
    homogeneity verified while its own risk section admitted I had not looked. Query:
    `title-slide` 12 · `image-slide` 11 · `text-slide` 5 · `call-response` 2 · untyped 2. Five
    shapes. The "20 kinds" correction is retracted; the matrix is 25 rows minimum.
  - **[B3] Confirmed: 145 normalized JSON paths** (`slides` 55 + `config` 90) against my ~40 split
    trigger. I had counted 11 *top-level* config keys and let that imply a small surface.
  - **[B5] Confirmed: 15 tables in the recursive FK closure, not 9.** Depth 2 adds
    `church_children_calendar`, `church_children_lesson_materials`,
    `church_children_packet_deliveries`, `music_packet_deliveries`; depth 3 adds
    `church_children_attendance`, `church_children_session_assignments`.
  - **[B4] [B6] [B7] [B8] [B9] [B10]** accepted on reading — each is an internal contradiction in
    draft 1 rather than an empirical claim. [B6] is the sharpest: D-C promised shell verification of
    database facts a shell script cannot reach.
- **WHERE I DID NOT DEFER:** the reviewer's stated *cause* for [B1] ("`?` is not acting as intended
  … the listed orphan command returns no files") is not what I observe — standalone it returns 18
  files. The failure is real but reproduces only inside the script. Conclusion and corrected numbers
  accepted; diagnosis noted as not matching. On `CuentacuentoEditor` the review says 434 of 601;
  I measure 434 of 596 and 596 stands. Neither changes anything.

- DECISIONS (new this round):
  - **D-G** — UI locale and liturgy content language are independent axes. This is `L1` from the
    failed plan, re-frozen on its merits rather than inherited; it is the only one of L1–L8 carried
    forward, and D1's whole taxonomy rests on it. ([S2])
  - **D-H** — the PII classification is fixed in the plan, not chosen by an executor, and member PII
    never reaches a translation provider, AI prompt or log. ([B8])
  - **D-I** — an unresolved fact that materially changes feasibility, scope or phase count blocks
    D6; `UNVERIFIED` is for details only. Each phase reports `BLOCKS-D6` items. ([B9])
  - **D-C rewritten** — verification is two named mechanisms and the plan claims only what each can
    do: `D<n>-verify.sh` diffs the document against committed JSON fixtures (mechanical); refreshing
    fixtures from the database is a documented manual MCP step, because `psql` is not installed.
    The shell script proves document↔evidence, not evidence↔database. ([B6])
  - **D-F narrowed** — "translate rather than regenerate" applies to generated devotional prose
    only, not Bible text, canonical liturgical texts, songs or assets. ([S1])
  - **D2 pre-split** into D2a (scalars, all four liturgy tables), D2b (55 `slides` paths),
    D2c (90 `config` paths + `custom_content` + the five `custom-*` shapes). ([B3] [B4])
  - **Document-only gate set defined and justified** — `git diff --stat`, `D<n>-verify.sh`,
    `npx tsc --noEmit`. `lint`/`test`/`build`/Playwright deliberately excluded: on a zero-line
    source diff they re-test the base branch, not the phase. `tsc` is kept because it catches a
    source file that leaked in. Gates run against the phase commit in `casa-pilot` after `npm ci`,
    not in another checkout. ([S4])
  - **D6.9 split** into a script-checkable half (structural symmetry of the options template) and an
    explicitly non-mechanical half (a fresh-context neutrality read). The plan no longer claims
    every criterion is executable. ([B10])
  - **D4 now depends on D3** ([S3]); external feasibility — Bible redistribution rights and English
    WhatsApp template lead time — added as D6.8 ([S5]).
- BACKLOG ADDED: `src/data/elementos-fijos/` is 6 content files + `index.json`; phrase it as
  "6 canonical documents / 46 slides" ([N1] — applied, not deferred).
- OPEN AFTER THIS ROUND:
  - PLAN.md draft 2 is **not frozen.** Needs Codex plan review round 2. Loop cap: SOP §1.5 allows
    2 Codex rounds before Brent decides — this is round 2 of 2.
  - Still unverified, each assigned to its phase: whether `npm ci` succeeds in `casa-pilot`; the
    contents of the 90 `config` paths; whether `church_podcast_episodes` holds language-dependent
    content; the Bible redistribution rights position.
  - Blocking on Brent, carried to D6: default English Bible translation; English liturgical texts
    for the six canonical elements.
