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

### 2026-08-10 — plan round 3 — PM (triage; loop cap reached)

- SESSION: `BILINGUE · plan · PM`
- ELAPSED: ~20 min (triage + verification only; no rewrite — decision is Brent's)
- STAGE: triage + independent verification 20m | rewrite 0m | fresh review 0m
- EFFORT: PM `high`
- FIRST-PASS: **no** — Codex FAIL on draft 2 (`98ab364`), 8 BLOCKING · 3 SHOULD-FIX · 0 NIT.
  **SOP §1.5 cap reached (2 Codex rounds). Decision goes to Brent: accept / re-plan / backlog.**
- CONTEXT PRESSURE: comfortable
- ACTION: verified the disputed and cheap-to-check findings; wrote no draft 3. Per SOP §3.9 the
  amendment is proposed, not applied, until Brent approves.
- COMMITS: ledger only; `PLAN.md` remains at draft 2 (`98ab364`)

- **I WAS WRONG TO CONTRADICT THE REVIEWER ON [B1], AND THE CAUSE MATTERS.**
  Round 2 I recorded that the reviewer's diagnosis was wrong because
  `find src -regex '.* [0-9]\.tsx?'` returned 18 for me. It does — **under zsh**, which is what
  this session's shell runs. Under `bash`, which is what the script's shebang selects, the same
  command returns **0**; `find -E` returns 18. The reviewer was right and I generalised a result
  from one shell to all shells. That is the same error class as the finding itself — an
  unreproducible result asserted as universal — committed while correcting it.
- **The 596 vs 601 disagreement does not resolve, and that is the real finding.** My 596 is stable
  across `grep -c`, `grep | wc -l`, `LC_ALL=C`, `LC_ALL=en_US.UTF-8`, and a widened character class;
  no decomposed/combining accents are present; total non-ASCII lines are 683. The reviewer's 601
  sits between the two, so their class is wider than mine and narrower than all non-ASCII, but I
  cannot reproduce it. **Two parties cannot reproduce each other's census — which is exactly the
  problem the census exists to solve.** This is a stronger argument for [R2-S1] (freeze the method
  at byte level: character class, locale, shell, tokenisation) than either number is for itself.
- **[R2-B1] confirmed and it is the fourth inventory fact I asserted without checking.**
  `blank-slide` is a fully supported custom subtype — `types/shared/liturgy.ts`,
  `CustomElementPicker`, `CustomElementEditor`, `customElementToSlides.ts`, `exportService.ts`,
  `ConstructorLiturgias.tsx` and its test — with **zero production rows**. Declared-literal counts:
  `call-response` 16, `title-slide` 12, `blank-slide` 12, `text-slide` 11, `image-slide` 11.
  My "five shapes" came from data alone and missed the code-only sixth.
- **[R2-B7] confirmed — a mechanical regression I introduced.** The rewrite dropped
  **Definition of done** and **Rollback** from D2a, D2b, D2c, D3, D4 and D5, and Rollback from D6.
  Draft 1 had them; the SOP §2.1 skeleton requires them.
- **[R2-B6] confirmed — I added the D3/D4 dependency in the wrong direction.** Responding to [S3] I
  made D4 depend on D3. It is backwards: D3's dataflow audit must *consume* D4's asset inventory,
  so D4 precedes D3.
- **[R2-B3] and [R2-B8] confirmed against my own document.** I rewrote D-C to promise only what each
  mechanism can do, then left D3.10 ("shell verifier reads live PII") and D5's test plan ("re-runs
  live counts") violating it. And several "Verified current state" rows cite `find` / `count(*)` /
  "recursive CTE recorded in D5" rather than the exact command D-B demands.
- **[R2-B2] [R2-B4] [R2-B5] accepted on reading.** Field/path dispositions need `(path, kind)`
  resolution via explicit default + exceptions; D6 can pass against stale fixtures without a
  provenance and refresh requirement; `BLOCKS-D6` is circular while executors choose whether to
  apply the label.

- **PATTERN, STATED PLAINLY:** across three drafts I have asserted an inventory fact without
  checking it four times — `custom-*` homogeneity, the `find -regex` behaviour, D-C's consistency
  with its own phase test plans, and the code-declared custom subtypes. Each was caught by one
  command. Another draft written the same way will produce a fifth. The proposed amendment is
  therefore structural, not another pass: **the plan should stop asserting inventory facts beyond
  what is needed to size a phase, and convert them into acceptance criteria that require the
  executor to derive them.** A plan that asserts less cannot be wrong in this way.
- WHAT IS *NOT* WRONG: the reviewer states twice that the discovery-only boundary is sound and that
  no new top-level phase is required. All eight findings are repairs inside the existing eight
  phases. This is a materially different position from `PLAN-BILINGUE.md`, which needed 11 missing
  phases and had two frozen decisions disputed.
- OPEN AFTER THIS ROUND: **Brent decides** — accept draft 2 with the eight findings as D1's opening
  corrections; approve a targeted draft 3 (SOP §1.5 override, logged); or backlog BILINGUE.
  `PLAN.md` is not frozen and no phase may start until he does.

### 2026-08-10 — plan round 4 — PM (draft 3)

- SESSION: `BILINGUE · plan · PM`
- ELAPSED: ~30 min (rewrite; verification done in round 3)
- STAGE: rewrite 30m | fresh review 0m | triage 0m
- EFFORT: PM `high`
- FIRST-PASS: **no** (round 3's FAIL stands as the measurement). Draft 3 awaits Codex round 3.
- CONTEXT PRESSURE: comfortable
- ACTION: Brent chose option B past the SOP §1.5 cap and directed that **Codex review draft 3
  rather than take the override** — the recorded reason being that Codex has caught 4 of 4 of the
  PM's unverified assertions while the PM caught 0 before submitting, so removing the review stage
  would optimise the wrong variable. Rewrote `PLAN.md` end to end. Phases 8 → 9.
- COMMITS: see git log for the draft-3 SHA
- TESTS: none re-run this round (zero source diff; verification was round 3)

- **THE STRUCTURAL CHANGE, which is the point of this draft.** Across drafts 1–2 the PM asserted an
  inventory fact without checking it four times — `custom-*` homogeneity, `find -regex` behaviour,
  D-C's consistency with its own test plans, and the code-declared custom subtypes. Fixing eight
  instances would have produced a fifth. Draft 3 therefore **asserts less**: a fact appears only if
  a phase's *size* depends on it, and everything an executor could derive became an acceptance
  criterion with the derivation command attached (**D-J**). `blank-slide` is the argument — had D2c
  said "union live shapes with code-declared shapes, by these two commands", the plan would have
  been right without the PM knowing the answer.
- **THE VERIFIED-STATE TABLE SHRANK TO TEN SIZING FACTS.** Deliberately no longer asserted, each now
  a derivation criterion: the element-kind taxonomy, the `custom-*` shape set, the PII field list,
  baked-asset counts, the `source_id` contract, per-table row counts, and the surface
  classification. Draft 2 asserted several and was wrong about two.

- FIXES, by finding:
  - **[R2-B1]** D2c's shape inventory is now the **union** of a live query and a code grep, both
    printed, both required to run. Untyped rows characterised individually rather than folded in.
  - **[R2-B2]** New resolution schema across D2a–D2d: every field/path carries a **default
    disposition plus kind-keyed exceptions**, and **every observed `(field, kind)` pair must
    resolve through exactly one**. The verify enumerates pairs and fails on unresolved or
    doubly-resolved ones. This is the deepest fix in the draft and the load-bearing new mechanism.
  - **[R2-B3]** D-C tightened: **shell verifiers never touch the database.** Every DB fact reaches a
    fixture through the MCP step. D3's leak check is split into a shell-side pattern scan (email /
    phone / WhatsApp shapes) and a manual MCP value cross-check recording only a boolean.
  - **[R2-B4]** Mandatory fixture provenance header — project ref, `query_sha256`, `captured_at`,
    `transaction_read_only`, `captured_by` — plus a **required refresh at D6**; `D6-verify.sh` fails
    on any fixture predating the D6 branch point.
  - **[R2-B5]** D-I strengthened: every `UNVERIFIED` carries `materiality: BLOCKS-D6 | DETAIL`,
    reviewer-approved, verify fails on a missing field, D6 fails on an unclassified entry.
  - **[R2-B6]** **D4 now precedes D3**, and D4.6 emits an explicit asset hand-off list that D3.6
    must consume in full.
  - **[R2-B7]** **Definition of done and Rollback restored on all nine phases.**
  - **[R2-B8]** Appendix A carries every command and query in full, runnable as written; the
    abbreviated citations are gone.
  - **[R2-S1]** D1's first deliverable is `CENSUS-METHOD.md`, pinning shell, `LC_ALL`, character
    class as codepoints, comment regex, extensions incl. `.json`, tokenisation, case-folding, the
    stopword list as a committed file, and the union policy — **before any counting**.
  - **[R2-S2]** D6.7 names all eight verifiers explicitly; "D1–D5" banned as shorthand.
  - **[R2-S3]** D3 scope now includes `published_resources.published_by` and non-FK
    notification-recipient sources.
- NEW PHASE: **D2d** — `liturgias.portadas_config`, `liturgias.presentation_styles`,
  `liturgia_oraciones.tiempos`, `cuentacuentos_drafts.story`. Draft 2 had no home for these four
  JSON columns, and `presentation_styles` is precisely the column that cannot be dispositioned
  atomically (overlay content translates; ids, geometry, visibility, scope and styling copy).
- **THE 596 vs 601 DISPUTE IS ABANDONED, NOT WON.** The PM's 596 is stable across five methods, two
  locales and a widened character class, with no combining accents in the file and 683 total
  non-ASCII lines; 601 is not reproducible here. Rather than assert either, V6n records the
  disagreement itself as the finding and **no line total in the plan is load-bearing.** Two parties
  unable to reproduce each other's count is exactly what the census exists to prevent.
- **AND THE PM WAS WRONG ABOUT `find -regex`, AS RECORDED IN ROUND 3.** Under `bash` — the script's
  shebang — the orphan filter returns 0; under `zsh` it returns 18. V10 records it and D1.1 requires
  the shell be pinned.
- DECISIONS: **D-J** (derived lists beat asserted lists; union live data with code declarations) ·
  D-C tightened · D-I strengthened · fixture provenance protocol · `(field, kind)` resolution
  schema · D2d added · D4 before D3 · census method frozen before counting.
- OPEN AFTER THIS ROUND:
  - `PLAN.md` draft 3 is **not frozen.** Codex round 3, by Brent's direction.
  - Unrun and assigned rather than asserted: whether `npm ci` succeeds in `casa-pilot`; the contents
    of the 90 `config` paths and D2d's four columns; whether `church_podcast_episodes` holds
    language-dependent content; the Bible redistribution position.
  - Weakest points, named: D6.10(b) neutrality read is not script-closable; the `(field, kind)`
    coverage enumeration is new, load-bearing across four phases, and has never been run.
  - Blocking on Brent, carried to D6: default English Bible translation; English liturgical texts.
