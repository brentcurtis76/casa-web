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
