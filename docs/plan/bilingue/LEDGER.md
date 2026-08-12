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

### 2026-08-10 — plan round 5 — PM (triage; third FAIL, second time past the §1.5 cap)

- SESSION: `BILINGUE · plan · PM`
- ELAPSED: ~15 min (triage only; no draft 4 — decision is Brent's)
- STAGE: triage + root-cause 15m | rewrite 0m | fresh review 0m
- EFFORT: PM `high`
- FIRST-PASS: **no** — Codex FAIL on draft 3 (`eaed6f5`), 7 BLOCKING · 1 SHOULD-FIX · 0 NIT.
  Review at `reviews/BILINGUE-PLAN-review-4.md`. Trajectory across the workstream:
  **11 → 10 → 8 → 7 BLOCKING.** All findings valid each time.
- CONTEXT PRESSURE: comfortable
- ACTION: root-caused the recurring failure. Wrote no draft 4.
- COMMITS: ledger + review only; `PLAN.md` stays at draft 3 (`eaed6f5`)

- **ROOT CAUSE FOUND, AND IT IS THE INSTRUMENT, NOT THE JUDGEMENT.**
  `grep` and `find` resolve to **shell functions** injected by
  `~/.claude/shell-snapshots/snapshot-zsh-*.sh` in this session — not to `/usr/bin/grep` and
  `/usr/bin/find`. The wrappers change the answer. Measured with the real binaries:

  | command | `LC_ALL=C` | `LC_ALL=en_US.UTF-8` |
  |---|---|---|
  | `/usr/bin/grep -cE '[áéíóúñüÁÉÍÓÚÑÜ¿¡]' CuentacuentoEditor.tsx` | **601** | **596** |

  Identical in zsh and bash. **Both numbers are correct; locale is the variable — exactly what
  the reviewer said.** My "five methods all agree at 596" was an artifact of the wrapper.
  `find -regex '.* [0-9]\.tsx?'` likewise returns 18 through the wrapper and **0** through
  `/usr/bin/find` in both shells; `find -E` returns 18 everywhere.
  **I published three different wrong diagnoses of the same 8-file discrepancy** — first the
  regex dialect, then bash-vs-zsh, then implicitly a PATH difference — because my measurements
  were never reproducible outside this harness and I kept defending them as if they were.
- **SECOND ROOT CAUSE: commands written into the plan were not executed.** Each was one run from
  being right — Appendix V4 returns **8** JSONB columns, not the 4 D2d scopes; V5's literal query
  returns **19** rows, not 15 (15 needs an unstated `min(depth)` reduction); V2/V3 return
  `count(distinct path)` only, so the `(path, kind)` fixture D2b/D2c require **cannot be built
  from the query the plan supplies**; V6's 166-file census has no command in the appendix at all.
- **ALL SEVEN BLOCKING ACCEPTED.** [D3-B1] D-J is half-implemented — seven criteria say "by a
  recorded command" without supplying one, which is the unreviewed-assertion problem D-J exists to
  remove. [D3-B3] "kind" is undefined: raw `tipo` gives 1,205 slides pairs, collapsing custom
  UUIDs to `customType` gives 617, and 617 still merges the two structurally distinct untyped
  rows; D2b also depends on D2a while needing D2c's taxonomy. [D3-B4] the supplied grep matches
  unrelated `prayer-response`/`liturgy-response` rather than the `CustomElementSubtype`
  declaration. [D3-B5] D3 runs its verifier *before* the manual MCP cross-check it must validate,
  and D6.6 applies MCP refresh to filesystem fixtures, which is impossible. [D3-B6] D2d's
  four-column scope is not what V4 returns. [D3-B7] D3 consumes D5's closure without depending on
  D5 — the same dependency bug as D3/D4, one phase over.
- SETTLED BY THE REVIEWER: D-I is a real gate; D4→D3 with an explicit hand-off is correct;
  Definition of done and Rollback present on all nine phases; structural neutrality plus a human
  read is an acceptable contract; the discovery-only boundary remains sound.
- DECISIONS: two process fixes recorded to memory, both mechanical and both bigger than BILINGUE —
  (1) every count in a plan must be taken with the absolute binary path and a pinned locale, and
  the invocation recorded verbatim; when a reviewer's number disagrees, suspect the instrument
  before defending the number. (2) every command written into a plan must be **executed** and its
  real output pasted before the plan ships.
- OPEN AFTER THIS ROUND: **Brent decides, second time past the cap.** Draft 4 under the two process
  fixes, or freeze a repaired D1 alone and convert the deadlock into execution. `PLAN.md` is not
  frozen and no phase may start.

### 2026-08-10 — plan round 6 — PM (draft 4: one phase, not nine)

- SESSION: `BILINGUE · plan · PM`
- ELAPSED: ~25 min (executing commands 10m, rewrite 15m)
- STAGE: rewrite 25m | fresh review 0m | triage 0m
- EFFORT: PM `high`
- FIRST-PASS: **no** (round 5's FAIL stands). Draft 4 awaits Codex review of D1 alone.
- CONTEXT PRESSURE: comfortable
- ACTION: Brent chose to freeze one repaired phase rather than attempt draft 4 of nine, saying he
  lacked the visibility to judge between the options. `PLAN.md` rewritten to **D1 only** plus a
  re-plan gate. D2–D6 are not planned; their inputs are preserved in Appendix B.
- COMMITS: see git log for the draft-4 SHA
- TESTS: every command in the plan executed; outputs pasted into the plan itself.

- **THE TWO PROCESS FIXES, APPLIED RATHER THAN PROMISED:**
  - **D-K (new):** absolute binary paths, exported `LC_ALL`, invocation recorded verbatim, and
    *suspect the instrument before defending the number*. Written to memory — it invalidates every
    count taken in this repo through the wrapped shell, not only BILINGUE's.
  - **D-B extended:** a command in a plan must have been **executed**. Draft 4 is the first draft
    where that is true of every command it contains.
- **WHAT EXECUTING THEM CHANGED.** The census moved from 166 files / 1,402 lines to
  **180 files / 1,418 lines**, purely because three surfaces were silently missing
  (`ConstructorLiturgiasPage.tsx`, `data/elementos-fijos`, `_shared/whatsapp`) and `.json` was not
  covered. The locale question is settled and **demonstrated, not asserted**: `LC_ALL=C` returns
  601 and `en_US.UTF-8` returns 596 on `CuentacuentoEditor.tsx`, and the five extra lines under `C`
  are emoji and a middot (`🚨`, `✅`, `·`) whose UTF-8 lead bytes collide with the accent class.
  `en_US.UTF-8` is therefore the correct semantic and is pinned.
- **THE SINK-BASED SURFACE DERIVATION WORKS AND IS NOW IN THE PLAN, EXECUTED.** It returns **19
  emitting surfaces**, including `canvasCompositor.ts` and `slideRenderer.tsx` — two the PM never
  named across three drafts — and `whatsapp-signup`, which is probably out of the liturgy path and
  is assigned to D1 for triage. This replaces draft 3's seven criteria that said "by a recorded
  command" without supplying one ([D3-B1]).
- **NEW DELIVERABLE, D1.9 — `D1-SUMMARY.md`.** One page, plain language, readable by someone who
  has not read the codebase. Brent said he felt too blind to judge between the options; an
  inventory he cannot read does not fix that, so the summary is a deliverable rather than a
  courtesy. It is explicitly **not** script-checkable and the plan says so.
- **APPENDIX B PRESERVES WHAT THE REVIEWS ALREADY PRODUCED** — JSON path counts, `(path, kind)`
  pair counts, custom shapes incl. `blank-slide`, the 8 JSONB columns, the FK closure, the
  `published_resources` uniqueness, the missing `WITH CHECK`, the baked-in preacher name — each
  labelled **input, not fact**, requiring re-derivation under D-K. Recorded so the next planner
  does not repay for them.
- DECISIONS: plan one phase not nine · D-K · D-B extended to executed-commands · `en_US.UTF-8`
  pinned as census locale · D2–D6 replaced by a re-plan gate · `D1-SUMMARY.md` as a deliverable ·
  `BLOCKS-D6` renamed `BLOCKS-REPLAN` since D6 is no longer planned.
- OPEN AFTER THIS ROUND:
  - `PLAN.md` draft 4 is **not frozen.** Codex reviews D1 alone.
  - Weakest point, named: D1.3's derivation is only as good as the sink regex. A surface emitting
    text by a route the regex misses will not be caught by any criterion.
  - Unverified: whether `npm ci` succeeds in `casa-pilot`. It is D1's first step and a BLOCKED
    report if it fails.
  - Still Brent's and now deferred to the re-plan with real data in hand: full feature vs
    English-creation-only; default English Bible translation; English liturgical texts.

### 2026-08-10 — plan round 7 — PM (draft 5: D1 splits into D1a + D1b)

- SESSION: `BILINGUE · plan · PM`
- ELAPSED: ~30 min (executing 12m, rewrite 18m)
- STAGE: rewrite 30m | fresh review 0m | triage 0m
- EFFORT: PM `high`
- FIRST-PASS: **no** — Codex FAIL on draft 4 (`e0c9342`), 5 BLOCKING · 4 SHOULD-FIX · 1 NIT.
  Review at `reviews/BILINGUE-PLAN-review-5.md`. Trajectory: **11 → 10 → 8 → 7 → 5.**
- CONTEXT PRESSURE: comfortable
- COMMITS: see git log for the draft-5 SHA

- **FIRST ROUND WHERE EVERY NUMERIC CLAIM REPRODUCED FOR THE REVIEWER.** Census 180/1,418;
  601 vs 596; the five C-only line numbers exactly; 0 without `find -E` and 18 with; all 19
  sink files. The instrument fix (D-K) worked. That is the pilot's first clean measurement round.
- **[D4-B2] CONFIRMED, AND IT IS THE BIG ONE.** The sink regex had `sendTemplate` but not
  `sendText`, and missed a live human-facing emission:
  `supabase/functions/wa-webhook/index.ts` ~137 sends `"¡Gracias! Quedó registrada tu respuesta."`
  over WhatsApp. It also missed `src/lib/whatsapp/templates.ts`, the approved-template registry —
  which hardcodes `language: 'es'` and whose own header notes that editing a body triggers
  **24–48h WhatsApp re-approval.** That is a lead-time constraint on any English rollout, not a
  string. Corrected regex: **62 liturgy-path files, against 19.** My derivation was wrong by 3×.
- **[D4-B4] Pass B was never actually frozen** — the word list ended in an ellipsis, and the same
  executor would have written the method and run it. Now committed in full, and **executed**:
  338 hits over 135 files, of which **285 sit on lines with no accent at all** — 285 lines of
  Spanish copy Pass A cannot see, ~20% above its 1,418. The "lower bound" claim is now measured.
- **[D4-B3] A file is not a surface.** One file emits on several language axes
  (`CuentacuentoEditor.tsx` has toast copy *and* story content); `downscaleImage.ts` matches a
  canvas sink and emits no text. New seven-field surface record — path · symbol/line ·
  sink/channel · audience · text-origin · language-axis · reason — with many records per file
  expected. This also corrects the sizing: D1's real work is triaging 62 sink files plus 180
  census files, not "producing four documents".
- **[D4-B1] Draft 4 claimed every command was executed and omitted the census command itself** —
  the one that mattered most. Now inline in full. D-K also extended: absolute paths for *every*
  process in a pipeline (draft 4 still used bare `wc`, `sort`, `cut`, `comm`) and `LC_ALL`
  **exported once** rather than prefixed on the first command only.
- **[D4-B5] The shrink dropped Brent's product decisions.** Restored as **Appendix A** — scope,
  independent copies, language fixed at creation, the ten Bible translations, songs uploaded not
  translated, and the narrowed "translate rather than regenerate". These are decisions, not failed
  methodology, and a fresh planner must not reopen them.
- **I WAS WRONG ON [D4-S2] AND THE REVIEWER WAS RIGHT.** I claimed all five C-locale extras collide
  on lead bytes. Measured per line: 🚨 matches continuation byte `9a` (shared with `Ú`=c39a), ✅
  matches `9c` (shared with `Ü`=c39c), and only `·` matches a lead byte `c2` (shared with `¿`,`¡`).
  Conclusion unchanged; explanation corrected.
- **THE STRUCTURAL FIX: D-L, method before measurement.** D1 splits — **D1a locks the method and
  produces no numbers**, is Codex-reviewed and merged first; **D1b runs the locked method**.
  `D1a.6` makes "no counts present" a greppable criterion, and `D1b.1`/`D1b.8` require `census.sh`
  to be byte-identical to D1a's merged version. An executor cannot tune a method frozen in a
  previous phase, which is what review 5 asked for and what no verify script could otherwise catch.
- DECISIONS: D-L (method before measurement) · D-J extended (a derivation wrong once is a
  *candidate floor*, paired with a call-path audit) · D-K extended to every process + source SHA +
  OS/locale recorded · surface record schema · Appendix A restores Brent's product decisions ·
  `D1-SUMMARY.md` needs **recorded** human acceptance, not merely to exist.
- OPEN AFTER THIS ROUND:
  - `PLAN.md` draft 5 is **not frozen.** Codex reviews D1a and D1b.
  - Weakest point, named: **D1b.4**, the call-path audit. The regex output will look complete, and
    the audit is the only thing between that appearance and another 3× miss. No script can tell a
    shallow audit from a real one.
  - Unverified: whether `npm ci` succeeds in `casa-pilot`; whether the D1b.4 audit fits one session.
  - Brent's, deferred to the re-plan with real data: full feature vs English-creation-only; default
    English Bible translation; English liturgical texts.

### 2026-08-10 — plan round 8 — PM (triage; sixth review, findings rose)

- SESSION: `BILINGUE · plan · PM`
- ELAPSED: ~15 min (triage + verification; no draft 6 pending Brent's call)
- STAGE: triage 15m | rewrite 0m | fresh review 0m
- EFFORT: PM `high`
- FIRST-PASS: **no** — Codex FAIL on draft 5 (`e89db76`), 6 BLOCKING · 1 SHOULD-FIX · 0 NIT.
  Trajectory: **11 → 10 → 8 → 7 → 5 → 6.** First round where findings ROSE.
- CONTEXT PRESSURE: comfortable
- COMMITS: ledger + review only; `PLAN.md` stays at draft 5

- **[D5-B1] PASS B DOES NOT REPRODUCE, AND THE REVIEWER IS RIGHT.** Verified: I ran Pass B over
  **135** files (9 roots) while the plan describes "the same file set as Pass A plus
  `src/lib/whatsapp`" — which is **185**. The run silently omitted
  `src/pages/ConstructorLiturgiasPage.tsx`, `src/data/elementos-fijos`, `src/hooks/presentation`
  and all twelve edge-function directories. The reviewer's 185/376/316 is correct for the described
  method; my 135/338/285 is correct for the method I actually ran. **Both numbers are honest; the
  prose is not.**
- **THIS IS THE THIRD CONSECUTIVE DRAFT WITH THE SAME CLASS OF ERROR**, and it happened in the
  draft whose central claim was that every command had been executed. Instrument: fixed. Execution:
  mostly fixed — Pass A and the sink derivation both reproduce exactly. What remains is narrower and
  more insidious: **I run a command, then describe it in prose, and the prose drifts from the run.**
  The only mechanical fix is to stop describing commands at all — paste the literal script and its
  literal output, no summary.
- **[D5-B4] A SECOND MISSED SURFACE, CONFIRMED.** `src/types/shared/liturgy.ts:261` defines
  `LITURGY_ORDER` with user-visible Spanish labels — `'Portada Principal'`,
  `'Oración de Invocación'`, `'Primera canción'` — imported by `ConstructorLiturgias.tsx:50`. Both
  derivations miss it: it is outside every census root and matches no sink pattern, because it is a
  **declaration**, not an emission. After `wa-webhook` in round 7, that is two concrete misses found
  by review rather than by the method.
- **[D5-B3] MY OWN "NO RESULTS" GREP IS SELF-DEFEATING.** `census.sh` contains the literals
  `files=`, `copy=` and `TOTAL` in its `printf`, so D1a.6 flags the method source it is meant to
  protect — measured: 2 hits. And it misses ordinary result formats (`There were 338 matches.`,
  a Markdown row, `{"count":338}`). Another check written and never run.
- **[D5-B2] The lock covers only `census.sh`.** `CENSUS-METHOD.md`, `wordlist-passB.txt`,
  `SURFACE-SCHEMA.md`, the inclusion rule and the audit procedure all remain mutable in D1b. The
  reviewer is also right that D-L overclaims: the split gives **method immutability after review**,
  not proof that measurement never happened — this base plan already publishes preliminary totals.
- **[D5-B5]** `language-axis` and `audience` are scalars and cannot express presentation surfaces
  (operator chrome + projected liturgy content) or WhatsApp copy (recipient-facing, fixed channel
  language, following neither axis). **[D5-B6]** 62 sink files ∪ 180 census files = **211 unique**
  (215 with `lib/whatsapp`) — already past the ~200 split trigger before execution starts.
  **[D5-S1]** Bible redistribution/attribution feasibility was dropped from the handoff; only the
  WhatsApp half survived.

- **THE STRUCTURAL DIAGNOSIS, STATED PLAINLY.** D1 claims *"an inventory of every emission."* That
  claim cannot be discharged by any pre-specified method. Six reviews have each found another
  surface the method misses, because **finding surfaces is the work** — a root list plus a regex is
  provably incomplete in advance, and the reviewer said so outright: trace every candidate origin to
  a sink, "or explicitly admit sampling and stop claiming an inventory of every emission." Six
  drafts have tried to specify completeness. That is the loop, and it is not converging: findings
  went 5 → 6.
- OPEN AFTER THIS ROUND: **Brent decides.** PM recommendation is one further draft that changes
  D1's *contract* — from "every emission" to a best-effort inventory with a **measured** blind spot
  and a growth mechanism — and that pastes literal scripts with literal output and no prose
  description of any command. Bounded: if that draft fails, run D1 anyway with the findings as
  recorded caveats rather than continuing to buy reviews.

### 2026-08-10 — plan round 9 — PM (PLAN FROZEN by Brent; §1.5 override logged)

- SESSION: `BILINGUE · plan · PM`
- ELAPSED: ~20 min
- STAGE: corrections 20m | fresh review 0m | triage 0m
- EFFORT: PM `high`
- FIRST-PASS: n/a — no further plan review will be run. **Final plan-review record: 6 reviews,
  6 FAILs, findings 11 → 10 → 8 → 7 → 5 → 6.**
- CONTEXT PRESSURE: comfortable
- ACTION: Brent said "run it". **PLAN.md is frozen over a FAIL verdict — a logged SOP §1.5
  override.** The reviewer does not agree the plan is ready and that disagreement stands on the
  record. Before freezing, all six review-6 BLOCKING findings were **corrected in place**, because
  one of them ([D5-B3]) made an acceptance criterion provably unsatisfiable and an executor must
  not be sent into a phase carrying it. None of the corrections is a new PM assertion; each is a
  reviewer-confirmed fact the PM independently verified.
- COMMITS: see git log for the frozen SHA

- CORRECTIONS APPLIED AT FREEZE:
  - **[D5-B1]** Pass B's two file sets recorded side by side — 135 (run) vs 185 (described),
    338/285 vs 376/316 — with D1b.11 requiring the **185-file** set. The surviving finding is
    unchanged: Pass A cannot see ~300 lines of Spanish copy, ~20% above its own 1,418.
  - **[D5-B2]** New `evidence/METHOD-MANIFEST.txt` with `sha256` of every method artifact; D1b.8
    verifies all of them against D1a's merge commit, not `census.sh` alone.
  - **[D5-B3]** D1a.6's grep rewritten: it applies only to the prose artifacts, **excludes
    `census.sh`** (which necessarily contains its own format strings and tripped the old grep
    twice), and independent diff review is named as the authoritative check.
  - **[D5-B4]** `src/types/shared/liturgy.ts` added to roots, and the schema gains a
    `declaration/registry in source` text-origin for text declared in one file and rendered in
    another.
  - **[D5-B5]** `language-axis` and `audience` are now **sets**, plus a new `channel-fixed` axis for
    recipient-facing copy whose language is fixed by an external registry — approved WhatsApp
    templates follow neither the operator locale nor the liturgy language.
  - **[D5-B6]** D1b **pre-split**: D1b-1 (recipient-facing channels) and D1b-2 (operator-facing +
    declarations), with D1b-2 owning reconciliation, the combined fixture, `D1-verify.sh` and the
    summary. 211 unique candidates were already past the old trigger before execution.
  - **[D5-S1]** Bible redistribution and attribution rights restored to Appendix B — availability
    via bolls.life is not permission, and storing translation text in slides and exports is a
    different act from fetching it for display.
- NEW FROZEN DECISIONS:
  - **D-M** — never describe a command in prose; paste the literal script and its literal output.
    This is the last surviving form of the failure behind six FAILed reviews.
  - **D-N** — D1 produces a **best-effort inventory with a measured blind spot**, not a
    proven-complete one, and every artifact states what the method cannot see.
  - **D-L corrected** — the phase split buys method immutability after review; it does **not** prove
    measurement never happened, and the plan no longer claims it does.
- **ACCEPTED RISK, ON THE RECORD:** D1's inventory is a floor that grows, not a closed set. Any
  later phase assuming D1 found everything is built on a false premise. New section
  "What D1 does not claim" states this in the plan itself rather than only here.
- PHASE SEQUENCE NOW: **D1a** (lock the method, no numbers) → **D1b-1** (output channels) →
  **D1b-2** (UI/render/declarations + reconciliation + summary) → re-plan gate.
- OPEN AFTER THIS ROUND: D1a executor prompt issued. Phase reviews (SOP §3.6) still apply — the
  override stops *plan* review, not per-phase review.

### 2026-08-10 — D1a round 1 — EXEC

- SESSION: `BILINGUE · D1a · r1 · EXEC`
- ELAPSED: ~30 min
- STAGE: contract/setup 5m | method implementation 20m | verification/reporting 5m
- EFFORT: executor `high`
- FIRST-PASS: **yes** — the required test command passed on its first run.
- CONTEXT PRESSURE: comfortable
- ACTION: committed the D1a counting, classification, boundary, and audit methods without running
  `census.sh` or recording a census result. The locked set comprises `CENSUS-METHOD.md`, `census.sh`,
  `SURFACE-SCHEMA.md`, `wordlist-passB.txt`, and `METHOD-MANIFEST.txt`.
- COMMITS: `f4cea2c` (method artifacts); ledger commit follows this entry.
- FROZEN DECISIONS: D-A confined the diff to `docs/plan/bilingue/`; D-B and D-M are satisfied by the
  literal gate invocation and output below; D-K fixes absolute measurement processes and the locale;
  D-D prevents source-line values in census output; D-G keeps locale and content language separate;
  D-I fixes `UNVERIFIED` materiality; D-J and D-N make the sink search a candidate floor with an
  extension path; D-L is preserved because the census implementation was syntax-checked only.
- ACCEPTANCE: A1–A8 met. The method pins both passes and their shared selector; the complete Pass B
  list is committed; the script includes every frozen root plus `src/lib/whatsapp`; the schema defines
  the complete record with set-valued audience and language axis; the inclusion predicate requires a
  concrete text-flow chain; prose contains no run output; every artifact carries provenance; the diff
  is documentation-only.
- WEAK POINT: the static call-path audit remains dependent on executor discipline at dynamic and
  runtime boundaries. The locked procedure requires unresolved branches to become reviewer-approved
  `UNVERIFIED` records and forbids treating the candidate regex as complete.

```bash
cd /Users/brentcurtis/dev/casa-pilot && npm ci && \
  bash -n docs/plan/bilingue/evidence/census.sh && \
  git diff --stat pilot/sop-v2...HEAD && \
  npx tsc --noEmit; echo "tsc=$?"
```

```text
added 538 packages, and audited 539 packages in 7s

90 packages are looking for funding
  run `npm fund` for details

23 vulnerabilities (7 moderate, 14 high, 2 critical)

To address issues that do not require attention, run:
  npm audit fix

To address all issues possible (including breaking changes), run:
  npm audit fix --force

Some issues need review, and may require choosing
a different dependency.

Run `npm audit` for details.
npm warn allow-scripts 8 packages have install scripts not yet covered by allowScripts:
npm warn allow-scripts   @swc/core@1.15.8 (postinstall: node postinstall.js)
npm warn allow-scripts   core-js@3.47.0 (postinstall: node -e "try{require('./postinstall')}catch(e){}")
npm warn allow-scripts   esbuild@0.25.12 (postinstall: node install.js)
npm warn allow-scripts   fsevents@2.3.2 (install: (install scripts present))
npm warn allow-scripts   esbuild@0.21.5 (postinstall: node install.js)
npm warn allow-scripts   fsevents@2.3.3 (install: (install scripts present))
npm warn allow-scripts   esbuild@0.27.2 (postinstall: node install.js)
npm warn allow-scripts   fsevents@2.3.3 (install: (install scripts present))
npm warn allow-scripts
npm warn allow-scripts Run `npm approve-scripts --allow-scripts-pending` to review, or `npm approve-scripts <pkg>` to allow.
 docs/plan/bilingue/evidence/CENSUS-METHOD.md    | 198 ++++++++++++++++++++++++
 docs/plan/bilingue/evidence/METHOD-MANIFEST.txt |  12 ++
 docs/plan/bilingue/evidence/SURFACE-SCHEMA.md   | 140 +++++++++++++++++
 docs/plan/bilingue/evidence/census.sh           | 157 +++++++++++++++++++
 docs/plan/bilingue/evidence/wordlist-passB.txt  |  56 +++++++
 5 files changed, 563 insertions(+)
tsc=0
```

### 2026-08-10 — D1a round 1 — PM verification

- SESSION: `BILINGUE · plan · PM`
- ELAPSED: ~20 min (independent verification)
- STAGE: executor (see executor entry) | PM verification 20m | triage 0m
- EFFORT: PM `high`
- FIRST-PASS: **no** — 1 BLOCKING found in PM verification. Phase is NOT clean; r2 required.
- WHAT I VERIFIED MYSELF (not taken from the report):
  - Re-ran the gate: diff confined to `docs/plan/bilingue/` (6 files, +634), `tsc=0`.
  - **Verified all four manifest `sha256` values by recomputing them.** All match. The method lock
    is real, not decorative.
  - **A6 held:** grepped both prose artifacts for recorded-result shapes — no matches. The census
    was not run for the record. D-L survived contact with an executor.
  - **A3 held:** `census.sh` line 39 includes `src/types/shared/liturgy.ts`; line 54 defines
    `PASS_B_ROOTS=("${PASS_A_ROOTS[@]}" src/lib/whatsapp)` — the 185-file set, not the 135 the PM
    used. `export LC_ALL=en_US.UTF-8` once at line 11; all six external binaries absolute; **zero**
    bare external processes.
  - **A4 held and exceeded:** `audience` and `language-axis` are typed "non-empty set";
    `channel-fixed` and `declaration/registry in source` are defined; the schema explicitly says
    presentation chrome and projected content have independent axes and "do not collapse a mixed
    presentation into one value."
  - **A5 held — the criterion I called hardest.** My first grep looked in `CENSUS-METHOD.md` and
    found nothing; the rule is in `SURFACE-SCHEMA.md:55`. **Both named probes are resolved:**
    `whatsapp-signup` text is included only if it participates in the keyed reminder/status/reply
    chain (onboarding, consent and marketing excluded); `children-ministry` admin text only if it
    flows into the builder UI or a child packet (text on `/admin/ninos` alone excluded). Shared
    data, module name, import and route are each explicitly declared insufficient.
  - **A2 held:** 49 words, and no `...`/`…`/`etc.` in any artifact.

- **[B1] BLOCKING — the locked census counts Deno test files.**
  `bash -n` only parses; **I ran `census.sh`, and that is the only reason this was found.**
  It exits 0 and works — and its output includes `handler_test.ts`, `prompt_test.ts`,
  `handler_contract_test.ts` and others. The exclusion is `-not -name '*.test.*'`, which catches the
  dot convention used under `src/` but **not the underscore convention `*_test.ts` used throughout
  `supabase/functions/`**. Measured: **22 `_test.ts` files in `src`+`supabase`, none inside a
  `__tests__` directory**, so nothing else excludes them; they contribute **12 hits / 12 no-accent
  hits** to `PASS_B_SUMMARY files=186 hits=381 no_accent_hits=320`. Test files are not user-visible
  copy surfaces. Locking this method means D1b's numbers and every downstream sizing decision
  inherit the contamination, and fixing it afterwards invalidates the lock.
- **THIS DEFECT IS MINE, NOT THE EXECUTOR'S.** `-not -name '*.test.*'` came from the script in
  PLAN.md; the executor implemented the specification faithfully. My own measurements
  (185/376/316) carry the same contamination. D1a is the correct phase to fix it — it is the method
  phase, and the plan already tells the executor to correct a wrong method element here rather than
  in D1b.
- **THE D1a TEST PLAN I WROTE WAS INSUFFICIENT.** It specified `bash -n`, which cannot detect a
  wrong file set. Corrected for r2: run the script, inspect the selected file list, and assert no
  test file appears. Recorded because the same gap would recur in any future method-lock phase.
- FINDINGS: BLOCKING 1 ([B1]) · SHOULD-FIX 0 · NIT 0.
- OPEN AFTER THIS ROUND: D1a r2 prompt issued. Executor round 2 of max 3.

### 2026-08-10 — D1a round 2 — EXEC

- SESSION: `BILINGUE · D1a · r2 · EXEC`
- ELAPSED: ~25 min
- STAGE: locate plan/prompt 6m | convention survey 7m | fix + docs 8m | verification/reporting 4m
- EFFORT: executor `high`
- FIRST-PASS: **yes** — every command in the prompt's test block passed on its first run.
- CONTEXT PRESSURE: comfortable
- ACTION: closed [B1]. `census.sh` now carries `-not -name '*_test.*'` on both selectors, so the
  Deno underscore convention used throughout `supabase/functions/` is excluded alongside the dot
  convention used under `src/`. `CENSUS-METHOD.md` states the complete four-predicate exclusion rule
  and why a test file is not a copy surface. `METHOD-MANIFEST.txt` carries recomputed `sha256` for
  the two changed artifacts; all four entries verify.
- COMMITS: `734c8f6` (method fix); ledger commit follows this entry.
- SURVEY BEFORE FIXING: over the candidate set produced by the frozen roots and the extension
  filter, every path whose name contains `test` in any case is covered by `__tests__`, `*.test.*` or
  `*_test.*`; `.spec.`, `_spec.`, `__mocks__` and `test/`/`tests/` directory segments match nothing.
  The `*Fixtures.ts` helpers all sit inside `src/lib/cuentacuentos/__tests__/` and were already
  excluded. No predicate was added for a convention that matches no file — against a SOURCE_SHA-locked
  tree such an exclusion could not be justified against any file, and the extension rule governs a
  convention that appears later.
- NO COPY SURFACE WAS DROPPED: every selected `*_test.ts` declares `Deno.test`, and no non-test
  module under `src/` or `supabase/` imports a `*_test` module. Both checks are pasted into
  `CENSUS-METHOD.md` as literal commands.
- FROZEN DECISIONS: D-A — diff is `docs/plan/bilingue/` only, no source, schema or DB change.
  D-K — every process in every command is an absolute binary path and `LC_ALL` is exported once;
  `type -a grep` confirms `grep` and `find` are shell functions in this environment, so the absolute
  paths are load-bearing rather than ceremonial. D-L — the census was run **only** to verify file
  selection; no count, total or file number appears in any prose artifact, and the two prose
  artifacts that previously claimed the script is never executed in D1a were corrected to say what
  actually happens. D-M — every command below is literal, with its literal output.
- ACCEPTANCE: A1–A5 met.
- WEAK POINT: the fix is verified by a negative assertion — that the census output contains no
  test-shaped path. That proves the excluded set is clean; it does not prove the *retained* set is
  complete. A root that should have been configured and was not would produce the same zero.

```bash
cd /Users/brentcurtis/dev/casa-pilot
export LC_ALL=en_US.UTF-8
bash docs/plan/bilingue/evidence/census.sh 2>/dev/null \
  | /usr/bin/grep -cE '_test\.|\.test\.|\.spec\.|__mocks__'
cd docs/plan/bilingue/evidence && /usr/bin/grep -vE '^#' METHOD-MANIFEST.txt | /usr/bin/shasum -a 256 -c
cd /Users/brentcurtis/dev/casa-pilot && git diff --stat pilot/sop-v2...HEAD
npx tsc --noEmit; echo "tsc=$?"
```

```text
0
CENSUS-METHOD.md: OK
census.sh: OK
SURFACE-SCHEMA.md: OK
wordlist-passB.txt: OK
 docs/plan/bilingue/LEDGER.md                    | 121 +++++++++++++++
 docs/plan/bilingue/evidence/CENSUS-METHOD.md    | 198 ++++++++++++++++++++++++
 docs/plan/bilingue/evidence/METHOD-MANIFEST.txt |  12 ++
 docs/plan/bilingue/evidence/SURFACE-SCHEMA.md   | 140 +++++++++++++++++
 docs/plan/bilingue/evidence/census.sh           | 157 +++++++++++++++++++
 docs/plan/bilingue/evidence/wordlist-passB.txt  |  56 +++++++
 docs/plan/bilingue/prompts/D1a-r2.md            | 128 +++++++++++++++
 7 files changed, 812 insertions(+)
tsc=0
```

The `git diff --stat` above was captured before this entry was committed, so its line counts predate
it. Re-run at the round-2 HEAD it lists the same seven paths, every one under `docs/plan/bilingue/`:

```bash
cd /Users/brentcurtis/dev/casa-pilot && git diff --name-only pilot/sop-v2...HEAD \
  | /usr/bin/grep -v '^docs/plan/bilingue/'
```

```text
(exit 1, no output)
```

- OPEN AFTER THIS ROUND: D1a awaits PM verification of round 2. Executor round 2 of max 3.

### 2026-08-10 — D1a round 2 — PM verification — PHASE CLEAN

- SESSION: `BILINGUE · plan · PM`
- ELAPSED: ~15 min (independent verification)
- STAGE: executor (see executor entry) | PM verification 15m | triage 0m
- EFFORT: PM `high`
- FIRST-PASS: **no** for the phase (r1 carried 1 BLOCKING); **r2 is clean on PM verification.**
- WHAT I VERIFIED MYSELF, by running it rather than reading it:
  - **[A1]** Ran `census.sh` and grepped its output for `_test.|.test.|.spec.|__mocks__` → **0**.
    Verified against the script's *output*, not its predicate — reading the predicate is the
    failure mode that produced r1.
  - **[A3]** `shasum -a 256 -c` at HEAD → **4/4 OK**. The lock survives the edit.
  - **[A5]** `git diff --name-only pilot/sop-v2...HEAD | grep -v '^docs/plan/bilingue/'` → empty.
  - **[A4]** Grepped both prose artifacts for result shapes → none. **The method lock held for a
    second round**, this time under pressure: the round's own test plan required running the
    script, and nothing it printed reached an artifact.
  - **The safety argument for the exclusion, checked independently rather than accepted:** all
    **22** `*_test.(ts|tsx)` files under `src`+`supabase` declare a test runner — none is a
    disguised copy surface; **no non-test module imports a `*_test` module**; and
    `.spec`/`_spec`/`__mocks__` match **zero** files, so declining to add defensive predicates is
    sound rather than lazy.
  - The `census.sh` diff is exactly `-not -name '*_test.*'` on both selectors plus a corrected
    header comment. No drive-by changes.
- **A CLAIM OF MINE THAT WAS WRONG:** my first pass reported the survey commands as carrying no
  output, contradicting the executor's [A2]. They do — recorded as `# exit 1, no output`, which
  satisfies D-B (command plus output) without recording a count, so D-L holds. My grep was too
  narrow. The executor's resolution of that D-B/D-L tension is better than the one I would have
  specified, and naming the three fixture helpers instead of counting them is the same instinct.
- **SCOPE CREEP — self-reported, and I agree with the call.** Two prose lines claiming the script
  "is never executed in D1a" were made false by this round's own test plan. Correcting them beats
  shipping a false statement inside a hash-locked method. Reverts cleanly if a reviewer disagrees.
- FINDINGS: BLOCKING 0 · SHOULD-FIX 0 · NIT 0.
- **PHASE STATUS: clean, ready for Codex final review (SOP §3.6).** Not marked DONE — only Codex
  passing does that. Brent's §1.5 override stopped *plan* review; per-phase review is untouched.
- STALE AFTER THIS ROUND: every preliminary census total the PM published — 166/1,402, 180/1,418,
  185/376/316, 186/381/320 — now includes excluded test files. **None may be carried into D1b**;
  D1b re-derives from the locked method. Recorded here because those numbers are scattered across
  PLAN.md and six review documents.
- WORKFLOW DEFECT FOUND BY THE EXECUTOR, FIXED: `/exec BILINGUE D1a r2` did not resolve the plan —
  no `workstreams.md` row, and `docs/plan/bilingue/` does not exist in the default `casa-web`
  checkout. It exists **only** on `pilot/sop-v2` in the `casa-pilot` worktree. The executor
  recovered because the prompt file names the worktree, but that is luck, not design — the same
  hazard `workstreams.md` already documents for AUDIO. A row has been added.

### 2026-08-11 — D1a Codex review round 1 — PM triage

- SESSION: `BILINGUE · plan · PM`
- ELAPSED: ~20 min
- STAGE: Codex review (external) | PM triage + verification 20m
- EFFORT: PM `high` · Codex `high`
- FIRST-PASS: **no** — Codex **FAIL**, 2 BLOCKING · 0 SHOULD-FIX · 0 NIT. Codex round 1 of max 2.
- **BOTH BLOCKING VERIFIED BY THE PM, NOT ACCEPTED ON READING:**
  - **[B1] confirmed.** `supabase/functions/generate-story/corpus_pd_base.json` is selected by both
    passes; its only importer is `corpus_parity_test.ts`. I enumerated the full extent rather than
    the single instance: **exactly 8 `.json` files are selected — 7 are `src/data/elementos-fijos/*`
    with production importers and correctly included; 1 is this fixture.**
    `_shared/corpus_baseline.json`, `deno.json` and `import_map.json` are *not* selected, because
    only `_shared/whatsapp` is a root, not `_shared`.
  - **[B2] confirmed.** `CENSUS-METHOD.md` makes two claims — that every excluded `*_test.ts`
    declares `Deno.test`, and that nothing imports a `*_test` module — and supplies one command,
    which establishes only the second. Codex independently found the first claim *true*; the
    violation is the missing evidence, which is exactly what D-B and D-M exist to prevent.
- **[B1] IS A CLASS THE r2 FIX COULD NOT CATCH, AND THAT IS THE LESSON.** `corpus_pd_base.json`
  carries no naming convention at all — not `*_test.*`, not `__tests__`. Every exclusion in the
  method so far is name-based, and no name-based rule can catch it. r3 must build an
  **importer-based** rule for data files. Note the causal chain: adding `.json` to the census in
  draft 4 — to pick up the canonical liturgical texts — is what pulled this in. A widening in one
  place opened a hole in another, and only running the census exposed it.
- **I VIOLATED D-M IN THE r2 VERIFICATION ENTRY.** That entry states the 22-file `Deno.test` finding
  and the importer finding in prose, without pasting the commands — the same omission Codex is
  blocking [B2] on, committed in the entry where I credited the executor for avoiding it. D-M is
  easy to keep in a plan and hard to keep in a ledger. Recorded rather than quietly fixed.
- **PLAN AMENDED (frozen plan, Decision Log entry added).** Codex's NOTES ON THE PLAN is correct:
  `D1b.11` named the literal **185**-file Pass B set, which r2's test exclusion invalidated — along
  with every other census total published in this plan and its six reviews. D1b.11 now cites the set
  **definition** (Pass A roots ∪ `src/lib/whatsapp`, under the locked exclusions) and states plainly
  that the definition controls and the figure does not. Left as written, that criterion would have
  been either unpassable or — worse — passable against the wrong set.
- WHAT CODEX PASSED, so r3 does not reopen it: output shape suitable for a JSON fixture; the
  zero-match `.spec.`/`_spec.`/`__mocks__` predicates correctly declined as decoration; all four
  hashes verify and no method component sits outside them; D1a's merge commit is a sound trust
  anchor; binaries and locale handling hygienic; `# exit 1, no output` adequate for genuinely
  command-backed negative claims; the inclusion rule lands correctly on both `whatsapp-signup` and
  children-ministry admin when Codex applied it itself; the schema expresses mixed presentation axes
  and declaration-to-renderer chains like `LITURGY_ORDER`; and r2's two-line scope creep justified.
- FINDINGS: BLOCKING 2 (both to r3) · SHOULD-FIX 0 · NIT 0.
- OPEN AFTER THIS ROUND: `prompts/D1a-r3.md` issued. Executor round 3 of max 3 — **if r3 does not
  clear Codex, the SOP requires a re-plan proposal rather than a fourth round.**

### 2026-08-11 — D1a round 3 — executor

- SESSION: `BILINGUE · D1a · r3 · EXEC`
- ELAPSED: ~35 min
- STAGE: read plan/prompt/artifacts 8m | [B1] rule design + implementation 12m | [B2] check +
  negative controls 8m | artifact prose 5m | verification + commit 2m
- EFFORT: executor `high`
- FIRST-PASS: **yes** — both BLOCKING closed in one pass, no iteration on a red gate.
- COMMIT: `012826d`. Files: `census.sh` (+46/-12), `CENSUS-METHOD.md` (+152/-14),
  `METHOD-MANIFEST.txt` (+4/-4).

**[B1] — the exclusion is now referrer-based, and the falsified claim is retracted.**

`census.sh` gains a second exclusion stage, `json_is_test_evidence`, applied to `.json` paths that
survive the four `find` name predicates. A `.json` is excluded when at least one `.ts`/`.tsx` under
`src/`+`supabase/` names it **and every** file that names it is a test file. A `.json` that nothing
names is **kept** — the safe direction of the rule is to include, because an unreferenced data file
may still be loaded through a runtime-assembled path.

"Names it" is basename containment, not import resolution. That is looser than an import graph on
purpose: it counts `fixedElementFile: 'la-paz.json'` and `fetch('/data/elementos-fijos/index.json')`,
neither of which is an `import`, and a looser referrer set can only ever *keep* a data file. The
imprecision runs toward including a real surface, never toward dropping one.

The classification, run standalone against the roots:

```bash
export LC_ALL=en_US.UTF-8
ROOTS=$(/usr/bin/sed -n '/^PASS_A_ROOTS=(/,/^)/p' docs/plan/bilingue/evidence/census.sh \
  | /usr/bin/grep -vE '^(PASS_A_ROOTS=\(|\))' | /usr/bin/tr -d ' ')
/usr/bin/find -E $(echo $ROOTS) src/lib/whatsapp -type f -name '*.json' \
  -not -path '*__tests__*' -not -name '*.test.*' -not -name '*_test.*' | /usr/bin/sort -u \
| while IFS= read -r f; do
    refs=$(/usr/bin/grep -rlF --include='*.ts' --include='*.tsx' -- "${f##*/}" src supabase \
      | /usr/bin/sort -u || true)
    [ -n "$refs" ] || { printf 'NO REFERRER (kept): %s\n' "$f"; continue; }
    printf '%s\n' "$refs" \
      | /usr/bin/grep -qvE '(^|/)__tests__/|\.test\.[^/]+$|_test\.[^/]+$' \
      || printf 'TEST EVIDENCE (excluded): %s\n' "$f"
  done
```

```text
TEST EVIDENCE (excluded): supabase/functions/generate-story/corpus_pd_base.json
```

The PM's enumeration was confirmed rather than assumed, by running `census.sh` before the change:
`_shared/corpus_baseline.json`, `deno.json` and `import_map.json` never appear in its output, since
only `_shared/whatsapp` is a root.

The retraction is written as a retraction, not a narrowing. `CENSUS-METHOD.md` now quotes the round-2
sentence, marks it retracted, names what falsified it, and states the narrower claim the survey
actually supports — that no further *naming* convention occurs, which says nothing about test data.
The "fixture helpers that do exist" paragraph carried the same overreach implicitly and now says
plainly that those three are not the whole population.

**[B2] — the `Deno.test` claim now has a command, and the command is shown to be capable of failing.**

The artifact split one paragraph making two claims into two claims each carrying its own command.
The new check enumerates the excluded set from the committed roots rather than a written-down list,
refuses to pass vacuously when that set is empty, and exits non-zero naming any offender:

```bash
export LC_ALL=en_US.UTF-8
ROOTS=$(/usr/bin/sed -n '/^PASS_A_ROOTS=(/,/^)/p' docs/plan/bilingue/evidence/census.sh \
  | /usr/bin/grep -vE '^(PASS_A_ROOTS=\(|\))' | /usr/bin/tr -d ' ')
EXCLUDED=$(/usr/bin/find -E $(echo $ROOTS) src/lib/whatsapp -type f -regex '.*\.(ts|tsx|json)$' \
  -name '*_test.*' | /usr/bin/sort -u)
[ -n "$EXCLUDED" ] || { printf 'FAIL: the *_test.* predicate excludes nothing here — the claim would pass vacuously\n'; exit 1; }
NOT_A_TEST=$(printf '%s\n' "$EXCLUDED" | while IFS= read -r f; do
  /usr/bin/grep -qE '(^|[^[:alnum:]_$.])Deno\.test[[:space:]]*[({]' "$f" || printf '%s\n' "$f"
done)
[ -z "$NOT_A_TEST" ] || { printf 'FAIL: excluded by *_test.* but declares no Deno.test runner:\n%s\n' "$NOT_A_TEST"; exit 1; }
printf 'OK: every file the *_test.* predicate excludes declares a Deno.test runner\n'
```

```text
OK: every file the *_test.* predicate excludes declares a Deno.test runner
```

A green check that cannot go red is not evidence. Both failure modes were exercised. Against a
synthetic `*_test.ts` with no runner:

```text
FAIL: excluded by *_test.* but declares no Deno.test runner:
impostor_test.ts
(exit 1)
```

and against an empty excluded set (`-name '*_zzznone_test.*'`):

```text
FAIL: the *_test.* predicate excludes nothing here — the claim would pass vacuously
(exit 1)
```

The vacuous-pass guard is the one that matters for D1b: without it, a future roots edit that stops
matching any test file would turn this check green while proving nothing.

The limit is stated in the artifact rather than left implied — a declared runner plus an absent
importer show these are tests and that no production module pulls their strings in, but neither
shows a test emits nothing to a user by another route. An importer search cannot close that; it is a
D-N blind spot, recorded as one.

- SCOPE: no change to the roots, character class, word list, schema or inclusion rule. No file under
  `src/`, `supabase/` or `supabase/migrations/` touched (D-A). `git diff --name-only
  pilot/sop-v2...HEAD | /usr/bin/grep -v '^docs/plan/bilingue/'` → exit 1, no output, re-run at the
  committed HEAD rather than before the commit.
- D-L HELD under the same pressure as r2: `census.sh` was run repeatedly to verify selection and
  nothing it printed reached an artifact. Self-checked with
  `/usr/bin/grep -nE '(files=|hits=|[0-9]{2,} (files|lines|matches)|total)'` over both prose
  artifacts — the only hit is the sentence that declares the rule. One draft phrase, "classifies one
  path as test evidence", was reworded to "the following path" before committing: a count of results
  is a result.
- D-L method lock: both changed artifacts rehashed, all four verify.
- WEAKEST PART, named before the reviewer names it: basename containment will misclassify if a test
  fixture ever shares a basename with a production data file in another directory — the collision
  would find a production referrer and keep the fixture. That fails toward inclusion, so it inflates
  rather than drops, but it is a real imprecision and it is the price of not building an import
  graph in bash.
- OPEN AFTER THIS ROUND: D1a awaits PM verification of round 3, then Codex final review round 2 of
  max 2. Executor round 3 of max 3 — no fourth round is available under the SOP.

### 2026-08-11 — D1a round 3 — PM verification — CLEAN

- SESSION: `BILINGUE · plan · PM`
- ELAPSED: ~20 min (independent verification)
- STAGE: executor (see executor entry) | PM verification 20m
- EFFORT: PM `high`
- FIRST-PASS: **no** for the phase (r1 and r2 each carried findings); **r3 clean on PM verification.**
- WHAT I VERIFIED MYSELF, by running rather than reading:
  - `corpus_pd_base` → **0** selected. `elementos-fijos` → **14** (7 files × 2 passes). Test shapes
    → **0**. Manifest → **4/4 OK**. Diff → confined. `tsc` → 0.
  - **[A2] the fix is genuinely importer-based.** `/usr/bin/grep -rn "corpus_pd_base\|corpus_parity"
    census.sh` → no match: **the filename is hardcoded nowhere.** Read `json_is_test_evidence`
    directly — it returns *keep* when there is no referrer and *keep* when any referrer is a
    non-test path, excluding only when every referrer is a test. **Both branches fail toward
    inclusion**, which is the correct direction for a copy census.
  - **[A4] the `Deno.test` check is properly built, not merely present.** It derives the excluded
    set from the committed roots rather than a transcribed list, **refuses to pass vacuously on an
    empty set**, and exits non-zero naming any non-conforming file. The executor demonstrated it
    failing against a synthetic file rather than asserting it could.
- **THEIR SELF-FLAGGED WEAKNESS IS LIVE, AND I CHECKED WHETHER IT BITES.** The referrer match is by
  basename, and a collision exists at SOURCE_SHA: `src/data/canciones/index.json` and
  `src/data/elementos-fijos/index.json`. It causes **no wrong outcome** — both are production data
  with non-test referrers, and `src/data/canciones` is not a census root, so it is not selected at
  all. The limit is documented in the artifact. Under D-N this is a stated blind spot that fails
  toward inclusion, not a defect. Recorded because "theoretical" was the executor's word for it and
  it is not theoretical.
- SCOPE CREEP — one line, same shape as r2 and the same call: the "fixture helpers that do exist"
  sentence carried the identical overreach that `corpus_pd_base.json` had just falsified.
  Retracting one while leaving its twin would ship a known-false line inside a hash-locked artifact.
  I agree with the judgement; it reverts cleanly.
- THEIR `NOT DONE` ITEMS ARE CORRECTLY SCOPED, not evasions: the referrer search covers `src/` and
  `supabase/` only (a `.json` referenced solely from a build script or CI reads as unreferenced and
  is **kept**); stage two deliberately applies to `.json` alone, because excluding a `.ts` on
  referrer evidence could drop real copy; and `lint`/`test`/`build`/Playwright were not run, which
  matches the plan's document-only gate set — flagged rather than silently omitted.
- FINDINGS: BLOCKING 0 · SHOULD-FIX 0 · NIT 0.
- **PHASE STATUS: clean, ready for Codex final review round 2 (of max 2).** Not marked DONE — only
  Codex passing does that. If Codex FAILs again the SOP requires a re-plan proposal, not a fourth
  executor round.

### 2026-08-11 — D1a Codex review round 2 — PM triage — BOTH §1.5 CAPS REACHED

- SESSION: `BILINGUE · plan · PM`
- ELAPSED: ~20 min
- STAGE: Codex review (external) | PM triage + verification 20m
- EFFORT: PM `high` · Codex `high`
- FIRST-PASS: **no** — Codex **FAIL**, 2 BLOCKING · 0 SHOULD-FIX · 0 NIT.
  **Executor rounds 3 of 3. Codex rounds 2 of 2. Both caps reached** — SOP §1.5 requires a re-plan
  proposal, and Codex's own verdict says so. **No round 4 was issued.**
- **BOTH BLOCKING VERIFIED, AND ONE OF THEM CONVICTS ME:**
  - **[B2] confirmed by construction.** Built the three cases and ran the committed regex:
    `// Deno.test("x", …)` **passes** (a comment counts as a test), `const note = "Deno.test(";`
    **passes** (a string literal counts), `Deno["test"]("x", …)` **fails** (a real test is flagged
    non-test). A regex over text cannot separate code from comment or string, so the check cannot
    do the job it was written for.
  - **[B1] confirmed on the claim, not the instance.** The artifact guarantees the imprecision can
    "never drop" a copy surface. False: if production reaches a JSON by a constructed or globbed
    path — no literal basename anywhere in `.ts` — while an unrelated test names that basename
    literally, every referrer is a test and the **production file is excluded**. The live
    `index.json` collision is benign at SOURCE_SHA and does not validate the general claim.
  - **I ASSERTED THE SAME FALSE PROPERTY.** My r3 verification entry says "both branches fail
    toward inclusion". It does not. That is the **fourth** property I have asserted in this
    workstream without testing it — after the `find -regex` diagnosis, "all five methods agree at
    596", and D-C's consistency with its own phase test plans. Each was one command from being
    caught. The pattern is not carelessness about facts I checked; it is confidence about
    properties I never checked at all.
- **ROOT CAUSE — the plan's, not the executor's.** D1a's criteria demand absolutes ("drops no copy
  surface", "every excluded file is a test") from a bash text heuristic, and every heuristic has a
  false-positive and a false-negative direction. Three rounds produced three correct fixes and three
  new unprovable guarantees. **This is the same failure that killed six plan drafts — chasing
  provable completeness — one level down.** D-N already grants the *inventory* a measured blind
  spot; the *method* never got the same treatment, and that is the gap.
- **RE-PLAN PROPOSAL WRITTEN: `REPLAN-D1a.md`. `PLAN.md` deliberately NOT amended** — §3.9 requires
  Brent's approval first. Proposal in brief: D1a stops trying to prove its exclusions are safe and
  instead states the rule plus its error direction; unresolved evidence fails toward inclusion as an
  **explicitly coded rule** rather than an asserted property; the textual runner check is replaced
  by **evidence by enumeration** — D1b emits `D1-exclusions.md` listing every excluded path with the
  rule and evidence, which a reviewer can actually read; and D-N is extended to method artifacts.
- WHAT CODEX PASSED AND THE AMENDMENT DOES NOT TOUCH: `corpus_pd_base.json` correctly excluded and
  all seven `elementos-fijos` JSONs correctly retained **for the right reason** (genuine production
  referrers, not the canciones collision); all four manifest hashes verify including the new
  stage-two logic; the limited referrer roots and JSON-only scope are acceptable as documented; and
  the D1b.11 amendment is correct — the set definition now controls.
- FINDINGS: BLOCKING 2 (both to the re-plan) · SHOULD-FIX 0 · NIT 0.
- OPEN AFTER THIS ROUND: **Brent decides** — approve the amendment and run D1a once more under the
  new contract; accept D1a as it stands with a second logged §1.5 override and carry both findings
  into D1b as caveats; or backlog. `PLAN.md` unchanged and D1a not marked DONE either way.

### 2026-08-11 — D1a re-plan APPROVED and applied — PM

- SESSION: `BILINGUE · plan · PM`
- ELAPSED: ~20 min
- STAGE: amendment 20m | fresh review 0m | triage 0m
- EFFORT: PM `high`
- FIRST-PASS: n/a — plan amendment, not a review round.
- ACTION: Brent approved option 1 of `REPLAN-D1a.md`. `PLAN.md` amended under SOP §3.9.
- **AMENDMENT APPLIED:**
  - **New frozen decision D-O** — the same treatment D-N gives the inventory now applies to the
    method: no method artifact asserts a safety property it has not tested; every exclusion rule
    states its error direction and where that direction fails; ambiguous evidence fails toward
    inclusion **in code**; exclusion safety is established by enumerating what was excluded, never
    by a pattern claiming to recognise what is safe to exclude.
  - **D1a.9** — untested absolutes forbidden; error direction and its failure cases required.
  - **D1a.10** — the ambiguity branch becomes an explicit, commented, reason-recording branch in
    `census.sh` rather than emergent behaviour someone asserts.
  - **D1a.11** — no textual check may claim to prove a file is or is not a test. The r3 regex was
    refuted by construction; a better regex is the same mistake.
  - **D1b.13** — new deliverable `evidence/D1-exclusions.md`: every excluded path with its rule and
    evidence, **plus every file kept under the D1a.10 ambiguity branch with its reason**. This is
    the audit surface that replaces the guarantee — an over-inclusion is as much a finding as an
    exclusion, and a reviewer can read a short derived list where they could not audit a regex.
- **WHAT THE AMENDMENT DELIBERATELY DOES NOT TOUCH:** roots, character class, word list, schema,
  inclusion rule, manifest design, hygiene, output shape, and the stage-two exclusion *behaviour*.
  Codex passed every one across two reviews. r4 changes what the artifact **claims** and makes one
  branch explicit — it does not change what the census selects.
- **THE GENERAL LESSON, RECORDED BECAUSE IT OUTLIVES THIS PHASE:** this workstream has now failed
  the same way at two levels. Six plan drafts chased a provably complete *inventory*; three
  executor rounds chased a provably safe *method*. Both are unprovable in advance, and in both
  cases the fix was the same — state the error direction, make the safe default explicit, and move
  the proof to the artifact that can actually show its work. D-N and D-O are the same decision
  applied one level apart.
- OPEN AFTER THIS ROUND: `prompts/D1a-r4.md` issued under the amended contract. Round counting
  restarts against the amended phase (§3.9), so r4 is round 1 of 3 against the new criteria.

### 2026-08-11 — D1a round 4 (amended contract) — EXECUTOR

- SESSION: `BILINGUE · D1a · r4 · EXEC` — `/exec BILINGUE D1a r4`, durable executor conversation
  under the lean overlay (`~/.claude/agent-workflow/LEAN-WORKFLOW.md`, ACTIVE 2026-08-11).
- STARTED: 2026-08-11T21:28:50Z
- ENDED: 2026-08-11T21:41:00Z
- ELAPSED: ~12 min
- STAGE: locate contract + read plan/replan/artifacts 4m | implement 5m | verify + evidence 3m
- EFFORT: executor Opus `high`
- ATTEMPT: **4 cumulative** for D1a (round 1 of 3 against the amended criteria, §3.9)
- RISK: STANDARD — documentation-only, zero-line source diff, no schema/auth/PII surface.
- HANDOFFS: 1 (Brent pasted `/exec BILINGUE D1a r4`)
- FIRST-PASS: pending Codex.
- WORKTREE: `/Users/brentcurtis/dev/casa-pilot`, common dir `/Users/brentcurtis/dev/casa-web/.git`,
  branch `phase/d1a-method`, base `pilot/sop-v2`. Verified before editing, not inferred from the
  folder name.
- FILES CHANGED (`git diff --numstat`): `evidence/CENSUS-METHOD.md` (+90/-62) ·
  `evidence/census.sh` (+51/-6) · `evidence/METHOD-MANIFEST.txt` (+2/-2) ·
  `reviews/D1a-r4-review-request.md` (new) · this `LEDGER.md` entry.
- **THE THREE CHANGES, AND NOTHING ELSE:**
  - **[A1 / D1a.9]** Untested absolutes removed. The four stage-one predicates now state their error
    direction (over-exclusion) and two named cases where it fails: a production module named
    `*_test.ts` or living in `__tests__/`, and a test that itself writes to a user-visible sink.
    Stage two states its error direction and quotes the r3 [B1] case verbatim as a block — a
    production `.json` reached by a constructed or globbed path whose basename an unrelated test
    names literally **is excluded**. Round 3's "can only ever keep a data file" is retracted in the
    artifact. The naming survey gained a "where this survey's direction does not hold" paragraph.
  - **[A2 / D1a.10]** `json_is_test_evidence` rewritten as three named, commented branches.
    Branch 1 `basename-collision` (exact `$NF ==` comparison, not a `-name` glob, so a bracket in a
    basename cannot be read as a pattern) and branch 2 `no-literal-referrer` both **keep** and call
    `record_ambiguous_keep`, which emits `AMBIGUOUS_KEEP<TAB>path<TAB>reason=…` **once per path** to
    stderr. stdout is untouched, so the reviewed output shape is byte-identical.
  - **[A3 / D1a.11]** The `Deno.test` textual check and both of its output blocks are deleted, along
    with "excluding the convention drops no copy surface". The replacement section is titled
    *Exclusion safety is established by enumeration, not by pattern*, records Codex's three-line
    refutation, states explicitly that no cleverer pattern replaces it (**D-O**), and points at
    D1b.13. The importer check survives, restated with its limits (dynamic `import()`, runtime
    specifiers, re-export chains, importers outside the two roots) instead of as a guarantee.
- **SELECTION IS UNCHANGED, PROVEN BY THE STRONGEST AVAILABLE FORM (D-M):** not the three counts
  alone but full stdout equality against the script Codex reviewed.

  ```text
  $ export LC_ALL=en_US.UTF-8
  $ /usr/bin/git show 98f4e51:docs/plan/bilingue/evidence/census.sh > /tmp/census-r3.sh
  $ bash /tmp/census-r3.sh > /tmp/cs-r3.txt 2>/dev/null; echo "r3 exit=$?"
  r3 exit=0
  $ bash docs/plan/bilingue/evidence/census.sh > /tmp/cs-r4.txt 2>/dev/null; echo "r4 exit=$?"
  r4 exit=0
  $ /usr/bin/diff /tmp/cs-r3.txt /tmp/cs-r4.txt && echo "IDENTICAL"
  IDENTICAL
  ```

- GATES:

  ```text
  $ bash docs/plan/bilingue/evidence/census.sh 2>/dev/null | /usr/bin/grep -c 'corpus_pd_base'
  0
  $ bash docs/plan/bilingue/evidence/census.sh 2>/dev/null | /usr/bin/grep -c 'elementos-fijos'
  14
  $ bash docs/plan/bilingue/evidence/census.sh 2>/dev/null | /usr/bin/grep -cE '_test\.|\.test\.|\.spec\.|__mocks__'
  0
  $ bash docs/plan/bilingue/evidence/census.sh 3>&1 1>/dev/null 2>&3
  AMBIGUOUS_KEEP	src/data/elementos-fijos/index.json	reason=basename-collision
  $ /usr/bin/grep -rniE "never drop|drops no|every excluded file is a test|no other (test|fixture|spec)" docs/plan/bilingue/evidence/
  docs/plan/bilingue/evidence//CENSUS-METHOD.md:198:Round 2 of this artifact stated: *"No other test, spec, mock or fixture convention occurs in the
  $ cd docs/plan/bilingue/evidence && /usr/bin/grep -vE '^#' METHOD-MANIFEST.txt | /usr/bin/shasum -a 256 -c
  CENSUS-METHOD.md: OK
  census.sh: OK
  SURFACE-SCHEMA.md: OK
  wordlist-passB.txt: OK
  $ bash -n docs/plan/bilingue/evidence/census.sh; echo "bash -n=$?"
  bash -n=0
  $ npx tsc --noEmit; echo "tsc=$?"
  tsc=0
  ```

  The single grep hit is the quoted text of an explicitly retracted claim, which the contract allows.
  Gate set is the document-only set defined at D1a bootstrap ([S4]): `lint`/`test`/`build`/Playwright
  stay excluded on a zero-line source diff. The CASA base is red today (118 lint errors, 15 failing
  tests at `d5b16e8`), recorded in `SOP-PILOT.md` as of `98f4e51` — which after the [B5] remediation
  lives on `pilot/lean-v2`, not on this branch. Repository debt, not this diff.
- **BRANCH CAPABILITY VERIFIED BY CONSTRUCTION**, because branch 2 never fires against the live tree.
  Complete harness, then its unedited output (D-M — no prose stands in for either):

  ```bash
  export LC_ALL=en_US.UTF-8
  CENSUS=/Users/brentcurtis/dev/casa-pilot/docs/plan/bilingue/evidence/census.sh
  SCRATCH=$(/usr/bin/mktemp -d)

  /bin/mkdir -p "$SCRATCH/src" "$SCRATCH/supabase/x"
  printf '{"a":1}\n'                        > "$SCRATCH/src/orphan.json"
  printf '{"b":2}\n'                        > "$SCRATCH/src/dup.json"
  printf '{"b":2}\n'                        > "$SCRATCH/supabase/x/dup.json"
  printf '{"c":3}\n'                        > "$SCRATCH/src/fixture.json"
  printf 'import d from "./fixture.json";\n' > "$SCRATCH/src/thing_test.ts"
  printf '{"d":4}\n'                        > "$SCRATCH/src/real.json"
  printf 'import d from "./real.json";\n'   > "$SCRATCH/src/prod.ts"

  /usr/bin/sed -n '/^AMBIGUOUS_KEPT=$/,/^}$/p'        "$CENSUS" >  "$SCRATCH/fn.sh"
  /usr/bin/sed -n '/^json_is_test_evidence()/,/^}$/p' "$CENSUS" >> "$SCRATCH/fn.sh"
  /usr/bin/shasum -a 256 "$SCRATCH/fn.sh" | /usr/bin/awk '{print "harness function sha256: " $1}'

  cd "$SCRATCH"
  FIND=/usr/bin/find; SORT=/usr/bin/sort; GREP=/usr/bin/grep; WC=/usr/bin/wc; AWK=/usr/bin/awk
  TEST_PATH_ERE='(^|/)__tests__/|\.test\.[^/]+$|_test\.[^/]+$'
  REFERRER_ROOTS=(src supabase)
  . "$SCRATCH/fn.sh"

  for f in src/orphan.json src/dup.json src/fixture.json src/real.json; do
    if json_is_test_evidence "$f"; then printf 'EXCLUDED\t%s\n' "$f"; else printf 'KEPT\t%s\n' "$f"; fi
  done
  printf 'loop exit=%s\n' "$?"
  /bin/rm -rf "$SCRATCH"
  ```

  ```text
  harness function sha256: ca6e9ce7977e29692cef6e8572f4a2a483458cd4fa9662744033f087a4aab7ef
  AMBIGUOUS_KEEP	src/orphan.json	reason=no-literal-referrer
  KEPT	src/orphan.json
  AMBIGUOUS_KEEP	src/dup.json	reason=basename-collision
  KEPT	src/dup.json
  EXCLUDED	src/fixture.json
  KEPT	src/real.json
  loop exit=0
  ```

  Every line of that output is printed by a command in the script above. The first revision of this
  block showed a `harness exit=0` line that came from the invoking shell rather than the harness —
  caught as [B2] of the re-review, corrected by adding the `printf 'loop exit=%s\n'` line and
  re-running. The `sha256` pins which text was sourced; it is unchanged across both runs because the
  re-review's [B1] edit touched only the comment block *above* the extracted range.
- **A7 / D1a.8 — initially NOT MET; resolved in the same round, see the remediation entry below.**
  The first submission's `git diff --name-only pilot/sop-v2...HEAD` also listed
  `docs/plan/HANDOFF-PROCESS.md` and `docs/plan/SOP-PILOT.md`, both from
  `98f4e51 docs(plan): activate lean workflow v2`, committed onto this phase branch before r4 began.
  The executor declined to rewrite another owner's commit unilaterally and referred it to the
  reviewer. Codex ruled it BLOCKING [B5].
- OPEN / DEFERRED:
  - `PLAN_SHA` in all five artifacts still points at `c842161` (freeze), not `f2be4f2` (amendment).
    Raised by Codex as [S1] and **deferred by Brent 2026-08-12** — see the backlog entry below.
  - D1b must derive the *excluded* path list itself; `census.sh` records ambiguous keeps only, per
    the round's scope. The standalone stage-two command in `CENSUS-METHOD.md` produces it.
  - **Weakest point, named before the reviewer names it:** the ambiguity record lives on stderr. It
    keeps the reviewed stdout byte-identical, but `census.sh 2>/dev/null` — what this round's own
    test command runs — silently discards it. Two documents require D1b to capture it; nothing
    mechanically enforces it. A `D1b-verify.sh` assertion would close that, and belongs to D1b.
    *(Codex agreed in its NOTES: durable capture is enforceable in D1b's verifier.)*
- REVIEW REQUEST: `docs/plan/bilingue/reviews/D1a-r4-review-request.md`
- CODEX: **FAIL(5)** — `reviews/D1a-r4-codex-review.md`. Remediated in the same conversation, below.
- ESCAPED DEFECT: n/a — not yet passed.

### 2026-08-12 — D1a round 4, Codex FAIL remediation — EXECUTOR (same conversation)

- SESSION: `BILINGUE · D1a · r4 · EXEC` — the same durable executor conversation, per lean overlay
  §4.2: a consolidated blocker list is fixed by the same executor, not a fresh one.
- STARTED: 2026-08-11T22:05Z · ENDED: 2026-08-12T00:12Z
- ATTEMPT: still **4 cumulative** — this is the remediation of round 4, not a fifth round.
- CODEX VERDICT REMEDIATED: FAIL, 5 BLOCKING + 1 SHOULD-FIX + 1 NIT. Full text and executor triage
  in `reviews/D1a-r4-codex-review.md`. **All five accepted; none disputed.** Codex's own note: *"No
  re-plan is needed. The amended contract is sound."*
- FIXES:
  - **[B1]** `CENSUS-METHOD.md` — the importer probe is now reported as the single specifier shape
    it searches (`from '…_test'` / `from '…_test.ts'`, two roots, SOURCE_SHA). Named as unseen: the
    side-effect import `import './helper_test.ts';` Codex supplied, dynamic `import()`, runtime
    specifiers, re-export chains, `require`, aliased/extensionless specifiers, out-of-root
    importers. No replacement regex was written — that is the refuted approach (**D-O**).
  - **[B2]** Two laundered absolutes removed. "No test, spec or mock naming convention beyond the
    three already excluded occurs…" is replaced by a report of the two searches and their four
    literal substrings, plus the explicit statement that a convention using none of them would
    appear in neither search. "No name predicate could have reached it" is corrected: a predicate
    naming the basename literally *could* have; what the name lacks is a convention to key on.
  - **[B3]** The fourth stage-one predicate now carries its own named failure case — a production
    module whose basename legitimately ends in a space plus a decimal digit (`Slide 2.tsx`) is
    over-excluded, because the predicate reads shape, not provenance.
  - **[B4]** The placeholder harness (`. <function extracted…>`, `for f in …; do … done`) is
    replaced by the complete runnable script and its unedited output, in **both** the review request
    and this ledger, with `harness function sha256:` pinning the exact text sourced from `census.sh`.
  - **[B5]** Phase ancestry rebuilt, by the first remedy Codex named, with Brent's explicit
    authorisation for the history rewrite:

    ```text
    $ /usr/bin/git branch pilot/lean-v2 98f4e51
    $ /usr/bin/git push origin pilot/lean-v2
    $ /usr/bin/git rebase --onto f2be4f2 98f4e51 phase/d1a-method
    Successfully rebased and updated refs/heads/phase/d1a-method.
    $ /usr/bin/git diff --name-only pilot/sop-v2...HEAD | /usr/bin/grep -v '^docs/plan/bilingue/'
    (exit 1, no output)
    $ /usr/bin/git branch -a --contains 98f4e51
      pilot/lean-v2
      remotes/origin/pilot/lean-v2
    ```

    `98f4e51` was pushed to its own branch **before** the rebase, so the workflow-activation work is
    not lost and every citation to that SHA — including the byte-identical census proof — still
    resolves. Only r4's three commits were replayed; they touch `docs/plan/bilingue/` only, so the
    replay was conflict-free. Commit SHAs changed: `2f0924f`→`f306895`, `138d002`→`f1c87dd`,
    `6b9a27d`→`c0f8ee9`.
  - **[N1]** "two conventions" → "the two test-module conventions this repository uses, across three
    path shapes".
- **BACKLOG — [S1] `PLAN_SHA` provenance, deferred by Brent 2026-08-12.** All five artifacts label
  `c842161` (the freeze) as `PLAN_SHA` although three of them were modified under the `f2be4f2`
  amendment. Codex classed it SHOULD-FIX and noted the manifest and D1a merge anchor preserve
  integrity. Deferred because the fix touches `SURFACE-SCHEMA.md` and `wordlist-passB.txt` — both
  out of scope for r4, both byte-identical to versions Codex has passed, and that byte-identity is
  itself worth keeping. **D1b.8 anchors integrity to D1a's merge commit, which is where provenance
  resolves.** Recorded here so it is deferred, not dropped.
- GATES AFTER REMEDIATION (all re-run against the rebased head):

  ```text
  $ /usr/bin/git show 98f4e51:docs/plan/bilingue/evidence/census.sh > /tmp/census-r3.sh
  $ bash /tmp/census-r3.sh > /tmp/cs-r3.txt 2>/dev/null
  $ bash docs/plan/bilingue/evidence/census.sh > /tmp/cs-r4c.txt 2>/dev/null
  $ /usr/bin/diff /tmp/cs-r3.txt /tmp/cs-r4c.txt && echo IDENTICAL
  IDENTICAL
  $ /usr/bin/grep -rniE "never drop|drops no|every excluded file is a test|no other (test|fixture|spec)" docs/plan/bilingue/evidence/
  docs/plan/bilingue/evidence//CENSUS-METHOD.md:212:Round 2 of this artifact stated: *"No other test, spec, mock or fixture convention occurs in the
  $ cd docs/plan/bilingue/evidence && /usr/bin/grep -vE '^#' METHOD-MANIFEST.txt | /usr/bin/shasum -a 256 -c
  CENSUS-METHOD.md: OK
  census.sh: OK
  SURFACE-SCHEMA.md: OK
  wordlist-passB.txt: OK
  $ /usr/bin/grep -rnE '^\s*[A-Za-z ]+\s*=\s*[0-9]+|files=|copy=|TOTAL' docs/plan/bilingue/evidence/CENSUS-METHOD.md docs/plan/bilingue/evidence/SURFACE-SCHEMA.md
  (exit 1, no output)
  $ bash -n docs/plan/bilingue/evidence/census.sh; echo "bash -n=$?"
  bash -n=0
  $ npx tsc --noEmit; echo "tsc=$?"
  tsc=0
  ```

  `census.sh` is unchanged by this remediation — its manifest hash is the same as at first
  submission; only `CENSUS-METHOD.md` was rehashed.
- HANDOFFS: 2 (Brent pasted the Codex verdict; Brent authorised the history rewrite).
- CODEX: pending re-review of the cumulative diff.

### 2026-08-12 — D1a round 4, Codex re-review FAIL(2) remediation — EXECUTOR (same conversation)

- SESSION: `BILINGUE · D1a · r4 · EXEC` — same durable executor conversation (lean overlay §4.2).
- STARTED: 2026-08-12T12:26Z · ENDED: 2026-08-12T12:41Z
- ATTEMPT: still **4 cumulative**. Second remediation of round 4, not a fifth round.
- CODEX VERDICT: **FAIL(2)** + 2 SHOULD-FIX + 0 NIT. Full text and triage in
  `reviews/D1a-r4-codex-review.md`. Both BLOCKING accepted; neither disputed. Codex confirmed as
  fixed: first-review B1, B3, B5, N1; A7 satisfied; `98f4e51` reachable; stdout byte-identical;
  manifest, `bash -n`, `tsc` and diff checks passing; and that the harness genuinely exercises all
  four branch outcomes.
- FIXES:
  - **[B1]** The retracted absolute survived in two places I did not fix when I fixed the third:
    `CENSUS-METHOD.md`'s stage-two introduction and `census.sh`'s stage-two comment header both
    still said a captured baseline "follows no naming convention, so no name predicate can reach
    it". Both now state the tested version: the live case matches none of stage one's four
    predicates, a literal-basename predicate *would* reach it, nothing fixes what the next baseline
    is called, and stage two therefore classifies by referrers. **Lesson worth keeping: a claim
    retracted in one paragraph is not retracted in the artifact. Grep the phrasing, not the
    section.**
  - **[B2]** The harness printed no exit status; `harness exit=0` came from the invoking shell and
    was pasted as if the script had produced it. This is the same failure class as D-M's original
    violation — evidence that reads as literal but is not. The harness now ends with
    `printf 'loop exit=%s\n' "$?"` before cleanup and was re-run; every line of the pasted output is
    now produced by a command in the pasted script, in both evidence locations, and both record what
    the earlier revision got wrong.
  - **[S2]** The importer-probe disclosure understated the probe: a direct
    `export { x } from './helper_test.ts'` *does* match the shown regex. Now qualified to "a
    re-export chain whose written specifiers do not end in `_test`", with the matching case named.
  - **[S1]** Deferral accepted by the reviewer; backlog entry retained unchanged.
- **THE `census.sh` EDIT IS COMMENT-ONLY, VERIFIED TWO WAYS** — stdout still byte-identical to the
  r3 script, and the `sha256` of the function text the harness extracts is unchanged, because both
  `sed` ranges start below the edited comment block:

  ```text
  $ bash <harness>   # see the full script and output above; unchanged run
  harness function sha256: ca6e9ce7977e29692cef6e8572f4a2a483458cd4fa9662744033f087a4aab7ef
  ```

- GATES (re-run in full; both changed artifacts rehashed in `METHOD-MANIFEST.txt`):

  ```text
  $ /usr/bin/git show 98f4e51:docs/plan/bilingue/evidence/census.sh > /tmp/census-r3.sh
  $ bash /tmp/census-r3.sh > /tmp/g3.txt 2>/dev/null
  $ bash docs/plan/bilingue/evidence/census.sh > /tmp/g4.txt 2>/dev/null
  $ /usr/bin/diff /tmp/g3.txt /tmp/g4.txt && echo "IDENTICAL"
  IDENTICAL
  $ bash docs/plan/bilingue/evidence/census.sh 3>&1 1>/dev/null 2>&3
  AMBIGUOUS_KEEP	src/data/elementos-fijos/index.json	reason=basename-collision
  $ /usr/bin/grep -rniE "never drop|drops no|every excluded file is a test|no other (test|fixture|spec)|no name predicate|follows no naming convention" docs/plan/bilingue/evidence/
  docs/plan/bilingue/evidence//CENSUS-METHOD.md:217:Round 2 of this artifact stated: *"No other test, spec, mock or fixture convention occurs in the
  $ cd docs/plan/bilingue/evidence && /usr/bin/grep -vE '^#' METHOD-MANIFEST.txt | /usr/bin/shasum -a 256 -c
  CENSUS-METHOD.md: OK
  census.sh: OK
  SURFACE-SCHEMA.md: OK
  wordlist-passB.txt: OK
  $ /usr/bin/grep -rnE '^\s*[A-Za-z ]+\s*=\s*[0-9]+|files=|copy=|TOTAL' docs/plan/bilingue/evidence/CENSUS-METHOD.md docs/plan/bilingue/evidence/SURFACE-SCHEMA.md
  (exit 1, no output)
  $ /usr/bin/git diff --name-only pilot/sop-v2...HEAD | /usr/bin/grep -v '^docs/plan/bilingue/'
  (exit 1, no output)
  $ bash -n docs/plan/bilingue/evidence/census.sh; echo "bash -n=$?"
  bash -n=0
  $ npx tsc --noEmit; echo "tsc=$?"
  tsc=0
  ```

  The A1 grep was **widened** for this run to also probe the two phrasings Codex found surviving
  (`no name predicate`, `follows no naming convention`). The single remaining hit is the quoted text
  of the explicit retraction.
- HANDOFFS: 1 (Brent pasted the re-review verdict).
- CODEX: pending second re-review of the cumulative diff.

### 2026-08-12 — D1a round 4, Codex re-review 2 FAIL(1) remediation — EXECUTOR (same conversation)

- SESSION: `BILINGUE · D1a · r4 · EXEC` — same durable executor conversation (lean overlay §4.2).
- STARTED: 2026-08-12T12:50Z · ENDED: 2026-08-12T13:04Z
- ATTEMPT: still **4 cumulative**. Third remediation of round 4.
- CODEX VERDICT: **FAIL(1)** + 2 SHOULD-FIX + 0 NIT. Confirmed fixed: [B2] — the literal harness
  reproduced every displayed line including the SHA and `loop exit=0` — and the re-export
  disclosure. Confirmed passing: comment-only `census.sh` edit, byte-identical selection, ambiguity
  stderr, both manifest hashes, syntax, TypeScript, diff hygiene, remediation scope.
- **[B1] — THE SAME DEFECT, THIRD STATEMENT, AND THE PATTERN IS NOW THE FINDING.** Each round I
  replaced an absolute with a slightly smaller absolute: "no name predicate can reach it" became "no
  *convention-based* predicate can reach it", which `corpus_*_base.json` refutes just as plainly.
  Only the four frozen predicates were ever tested. All three sites — `CENSUS-METHOD.md` stage-two
  intro, the `corpus_pd_base.json` paragraph, and `census.sh`'s function header — now say only that
  the path matches **none of the four frozen stage-one predicates**, and add explicitly that other
  predicates could match it.
- **The future-naming statement was checked before it was written** (D-B), rather than asserted:

  ```text
  $ /usr/bin/grep -n "zz_snap" supabase/functions/generate-story/corpus_parity_test.ts
  15://     deno run --allow-all _shared/zz_snap.ts generate-story/corpus_pd_base.json
  ```

  The capture command takes its output path as an argument, so the next baseline's name is a
  caller's choice. The artifact cites that line instead of claiming anything about future names.
- **[S2] ADOPTED — the A1 grep is retired as the pre-submission check, because it was the mechanism
  behind three rounds of this defect.** A phrase-specific grep only ever finds the phrasing already
  known to be wrong. The mandatory check is now a broad candidate scan read as a manual-review list,
  never as proof:

  ```text
  $ /usr/bin/grep -rniE '\b(all|every|none|no|never|only|cannot|nothing)\b[^.]{0,80}\b(exclude|excluded|drop|drops|keep|keeps|test|fixture|predicate|convention|referrer)' docs/plan/bilingue/evidence/ | /usr/bin/wc -l
        28
  ```

  All 28 lines were read individually this round. 24 are rule definitions, disclaimers, quoted
  retractions, reported search results or shell output — none assert an untested property. Two
  prompted action: "A reviewer confirms nothing real was dropped…" was reworded to "That list, not
  this artifact, is where a reviewer checks whether anything real was dropped"; and the inherited
  three-fixture-helper statement was verified rather than assumed —
  `/usr/bin/find src supabase -type f -name '*[Ff]ixtures*.ts'` returns exactly those three paths,
  all inside `__tests__/`, so it holds unchanged. Full disposition in
  `reviews/D1a-r4-codex-review.md`.
- **[S1]** Deferral still accepted; backlog unchanged.
- GATES (full re-run; both artifacts rehashed again):

  ```text
  $ cd docs/plan/bilingue/evidence && /usr/bin/grep -vE '^#' METHOD-MANIFEST.txt | /usr/bin/shasum -a 256 -c
  CENSUS-METHOD.md: OK
  census.sh: OK
  SURFACE-SCHEMA.md: OK
  wordlist-passB.txt: OK
  $ /usr/bin/diff /tmp/h3.txt /tmp/h4.txt && echo "IDENTICAL"
  IDENTICAL
  $ bash docs/plan/bilingue/evidence/census.sh 3>&1 1>/dev/null 2>&3
  AMBIGUOUS_KEEP	src/data/elementos-fijos/index.json	reason=basename-collision
  $ bash <harness> 2>&1 | /usr/bin/head -1
  harness function sha256: ca6e9ce7977e29692cef6e8572f4a2a483458cd4fa9662744033f087a4aab7ef
  $ /usr/bin/grep -rnE '^\s*[A-Za-z ]+\s*=\s*[0-9]+|files=|copy=|TOTAL' docs/plan/bilingue/evidence/CENSUS-METHOD.md docs/plan/bilingue/evidence/SURFACE-SCHEMA.md
  (exit 1, no output)
  $ /usr/bin/git diff --name-only pilot/sop-v2...HEAD | /usr/bin/grep -v '^docs/plan/bilingue/'
  (exit 1, no output)
  $ bash -n docs/plan/bilingue/evidence/census.sh; echo "bash -n=$?"
  bash -n=0
  $ npx tsc --noEmit; echo "tsc=$?"
  tsc=0
  ```

  The extracted-function `sha256` is unchanged again — this round's `census.sh` edit is also
  comment-only, above the two `sed` ranges.
- HANDOFFS: 1 (Brent pasted the re-review verdict).
- CODEX: pending third re-review of the cumulative diff.

### 2026-08-11 — D1a CLOSED — Codex PASS — PM phase close (SOP §3.8)

- SESSION: `BILINGUE · plan · PM`
- ELAPSED: ~20 min (verification + close-out)
- STAGE: Codex review (external) | PM verification + close 20m
- EFFORT: PM `high` · Codex `high`
- FIRST-PASS: **no** — but **PASS at last**, at `1809ed5` (remediation `b847510`).
  **The first PASS anywhere in this workstream**, after six failed plan reviews and three failed
  phase reviews. Cumulative executor attempts on D1a: 4 (r1–r3 old contract, r4 amended).
- WHAT I VERIFIED MYSELF BEFORE CLOSING — this is the moment a PM rubber-stamps, so none of it is
  taken from the review:
  - Manifest **4/4 OK**. Selection unchanged: `corpus_pd_base` **0**, `elementos-fijos` **14**,
    test shapes **0**. Diff confined. Fast-forward into `pilot/sop-v2` confirmed possible.
  - **The ambiguity branch works in practice, not just in prose.** `census.sh` stderr emits
    `AMBIGUOUS_KEEP  src/data/elementos-fijos/index.json  reason=basename-collision` — the exact
    collision I found during r3 verification and then wrongly waved through as "fails toward
    inclusion in both branches". The code now surfaces what my prose asserted away. That is D-O
    doing its job, and it is the clearest evidence the amendment was the right call.
  - **Branch surgery checked, not assumed.** `98f4e51` ("activate lean workflow v2") is **out of
    the phase ancestry** and preserved on `pilot/lean-v2`, local and remote. The SOP-PILOT rewrite I
    flagged before r4 therefore does not sit inside this phase's diff.
- **BACKLOG — [S1]** the five method artifacts record `PLAN_SHA=c842161`, the pre-amendment freeze,
  rather than `f2be4f2`. Deferred by Brent, accepted by the reviewer: `METHOD-MANIFEST.txt` locks
  the bytes and D1b.8 anchors provenance to D1a's merge commit. Carry into D1b's close, not later.
- **D1b RE-READ IN LIGHT OF WHAT WAS BUILT (§3.8 step 5) — one amendment made:**
  - **New [D1b.14]: capture `census.sh`'s stderr.** The ambiguity records go to stderr, not stdout.
    **`2>/dev/null` discards precisely the evidence D1b.13 requires** — and that redirect appears in
    several commands published in this workstream, including my own verification commands and the
    r4 test block. Left unstated, D1b would have produced an exclusions document missing every
    ambiguity-kept path, and the verify script would have passed.
  - Checked and **not** amended: D1b.3's 62-file sink figure carries **no** `_test.` contamination
    (measured: 0), unlike the census totals — so it stands, unlike D1b.11's stale 185.
  - D1b.12 (blind spot) and D1b.13 (exclusions) overlap; not merged, because 12 is about what the
    method cannot see and 13 about what it chose to drop. Different questions.
- **DEVIATION FROM §3.8's CLOSE SCRIPT, DELIBERATE:** the standard teardown removes the phase
  worktree. **`casa-pilot` must not be torn down** — it is not a per-phase worktree, it is where
  this entire workstream's plan, ledger, reviews and prompts live (§1.8: keep worktrees per active
  workstream). Only the branch is disposable, and only after merge.
- FINDINGS: BLOCKING 0 · SHOULD-FIX 1 (→ backlog) · NIT 0.
- **PHASE STATUS: DONE.** `PLAN.md` updated with the date and passing SHA.
- OPEN AFTER THIS ROUND: merge `phase/d1a-method` into `pilot/sop-v2` (fast-forward), then D1b-1
  begins from the merged, hash-locked method. D1b.8 uses the **merge commit** as its provenance
  anchor, so the merge must land before D1b starts.

### 2026-08-11 — PM session handoff (SOP §4: the PM session is disposable)

- SESSION: `BILINGUE · plan · PM` — **this session ends here.**
- ELAPSED: ~9h wall clock across 9 plan rounds, 4 executor rounds, 3 phase reviews, one §3.9
  re-plan and one phase close.
- WHY NOW: SOP §4 says re-bootstrap when a PM session gets heavy or starts agreeing too easily.
  Both apply. The measurable signal is not fatigue, it is **four properties asserted without being
  tested** — the `find -regex` diagnosis, "five methods all agree at 596", D-C's consistency with
  its own phase test plans, and "both branches fail toward inclusion". Each was one command from
  being caught; each was caught by someone else. A successor reading the files cold does not
  inherit that.

**STATE, verified at handoff:**
- `pilot/sop-v2` = `dee6a1a`, **D1a merged** (fast-forward). `phase/d1a-method` still exists and
  can be deleted; **do not remove the `casa-pilot` worktree** — it is the workstream's home, not a
  phase worktree.
- D1a is **DONE**, Codex PASS at `1809ed5`. Method artifacts are hash-locked by
  `METHOD-MANIFEST.txt` and verify 4/4.
- Next: **D1b-1** (recipient-facing channels), then D1b-2 (operator-facing + reconciliation +
  summary). No executor prompt exists for either — writing D1b-1's is the successor's first job.

**OPEN ITEMS THE FILES DO NOT ALREADY ANSWER:**
1. **Which SOP governs D1b?** A commit `98f4e51` "activate lean workflow v2" rewrote
   `docs/plan/SOP-PILOT.md` (−291/+162) and `HANDOFF-PROCESS.md`. It was moved **off** this branch
   to `pilot/lean-v2` so it would not sit inside D1a's diff. **I never read it.** D1a ran under the
   old SOP-PILOT (C1–C4). Resolve this before writing D1b-1: if C2's self-review block or C4's
   ledger fields changed, the executor prompt must match the version actually in force.
2. **Backlog [S1]** — the five method artifacts record `PLAN_SHA=c842161`, the pre-amendment freeze,
   not `f2be4f2`. Deferred by Brent, accepted by Codex. Close it at D1b's close, not later.
3. **[D1b.14] is new and easy to lose:** the D1a.10 ambiguity records go to **stderr**.
   `2>/dev/null` appears in several commands published in this workstream, including mine.
4. **Every census total published anywhere in `PLAN.md` and the six reviews is stale** — 166/1,402,
   180/1,418, 185/376/316, 186/381/320. All predate the test-file and fixture exclusions. D1b
   re-derives from the locked method. Carry none of them forward.

**WHAT I WOULD TELL MY SUCCESSOR IN ONE LINE:** the two decisions that finally worked — D-N and
D-O — both say the same thing, that you cannot prove completeness or safety in advance and should
state the error direction instead. Everything in this ledger before them is the cost of learning it
twice.

### 2026-08-12 — D1b-1 PM bootstrap — contract completed and dispatched

- SESSION: `BILINGUE · D1b-1 · PM` — successor to the session that closed D1a.
- STARTED: 2026-08-12T09:40-04:00 · ENDED: 2026-08-12T10:05-04:00
- ATTEMPT: **r1** for D1b-1 (cumulative; D1a's four rounds do not carry over — different phase).
- RISK: **DISCOVERY**, per `pilot/lean-v2:docs/plan/SOP-PILOT.md` ("inventory work whose
  completeness cannot be established is DISCOVERY"). The overlay's HIGH falsification pass was run
  anyway: this workstream has six failed plan reviews and three failed phase reviews, all from
  untested assertions, and the cost of the pass is minutes.
- HANDOFFS: 1 (PM → executor).
- WORKFLOW: lean overlay **ACTIVE** — `git rev-parse --path-format=absolute --git-common-dir` ->
  `/Users/brentcurtis/dev/casa-web/.git`.
- AUTHORITATIVE CHECKOUT: `/Users/brentcurtis/dev/casa-pilot`, `pilot/sop-v2` = `d5df247`,
  clean, ahead 1 of origin. **The `/pm-boot` was issued from `casa-web` on `plan/bilingue`, which
  has no `docs/plan/bilingue/` directory at all** — the registry's branch hazard note is accurate
  and cost nothing this time only because it was read first.

**CONTRACT FALSIFICATION PASS — six claims, three refuted.**

```text
CLAIM:  [D1b.8]'s "D1a's merge commit" exists and can anchor provenance.
CHECK:  git rev-parse phase/d1a-method -> dee6a1a; --is-ancestor pilot/sop-v2 -> true.
RESULT: REFUTED. The merge was a fast-forward; there is no merge commit. Amended to name
        dee6a1a, the commit at which the four artifacts entered pilot/sop-v2.
BLIND SPOT: a later rebase moves the SHA. The manifest hashes are the real lock, and they
        verify 4/4 at HEAD; git diff dee6a1a..HEAD -- evidence/ is empty.

CLAIM:  The D1b-1/D1b-2 split table partitions the work.
CHECK:  PLAN.md split table vs [D1b.5] vs SURFACE-SCHEMA.md:39.
RESULT: REFUTED. The table gave "declarations/registries" to D1b-2 while [D1b.5] demands
        src/lib/whatsapp/templates.ts — text-origin=declaration, sink=WhatsApp — in D1b-1.
        Amended: partition by sink/channel, which the schema already makes scalar with one
        record per sink. text-origin partitions nothing.
BLIND SPOT: a record whose sink cannot be determined from source has no home in either phase.
        It becomes UNVERIFIED with materiality, and D1b-2 reconciles.

CLAIM:  npx tsc --noEmit gates this repo and passes clean on the base.
CHECK:  npx tsc --noEmit --listFiles | wc -l -> 0.  Root tsconfig.json is a solution file
        ("files": [], two references); plain tsc honours files:[] and compiles nothing. 0.4s.
        npx tsc -p tsconfig.app.json --noEmit -> 665 files, 1,039 errors, 122 files, ~22s.
RESULT: REFUTED, and it was refuted for D1a too — every "tsc -> 0 (clean base)" in this plan
        and in D1a's test plan was a vacuous pass. Removed from D1b's gates; the job it was
        given (catch a leaked source file) is done by the two git diff assertions.
        Base-red under overlay §5 -> bounded stabilization phase, NOT this phase's scope.
        Recorded: evidence/BASE-GATES-d5df247.md.
BLIND SPOT: tsconfig.node.json not separately measured. lint/test/build not run at d5df247.

CLAIM:  census.sh runs unmodified from this checkout.
CHECK:  bash census.sh -> exit 0, 3.6s. PASS_A files=168 hits=1242; PASS_B files=173 hits=369
        no_accent_hits=308. stderr: one AMBIGUOUS_KEEP (elementos-fijos/index.json).
        Manifest shasum -c -> 4/4 OK.
RESULT: SUPPORTED.
BLIND SPOT: census.sh hard-pins SOURCE_SHA=e0c9342 and aborts on a dirty src/supabase tree.
        Verified identical and clean at d5df247. An untracked file under src/ or supabase/ —
        casa-web currently has supabase/.branches/ — would break it. Flagged in the prompt.

CLAIM:  The 62-file candidate floor still reproduces.
CHECK:  the literal SURFACE-SCHEMA.md block at d5df247 -> 154 repo-wide, 62 liturgy path.
RESULT: SUPPORTED. [D1b.3]'s figure stands, as the D1a close predicted.

CLAIM:  [D1b.13]'s exclusions document is tractable in one phase.
CHECK:  250 candidates under the roots -> 174 after stage one -> 173 after stage two.
RESULT: SUPPORTED. 77 excluded paths across four rules, plus one ambiguous keep.
```

- **SIZING RUN, EXPLICITLY NOT THE PHASE'S OUTPUT.** The totals above are recorded in PLAN.md
  §"Sizing" under that label, and the contract requires the executor to re-derive from the locked
  method. Publishing PM totals as fact is the failure that produced four stale number sets in this
  plan; publishing them as sizing, labelled and SHA-stamped, is what stops the next PM re-running
  them blind. D-L was never a claim that no measurement happened — PLAN.md says so in the decision
  itself.
- **PREVIOUS PM'S OPEN ITEM 1 — RESOLVED.** `git show pilot/lean-v2:docs/plan/SOP-PILOT.md` is v2,
  ACTIVE from 2026-08-11: the executable rules live at `~/.claude/agent-workflow/LEAN-WORKFLOW.md`
  and SOP-PILOT is now CASA-specific gates and history, not another copy of the workflow. So D1b
  runs under the shared overlay; v1's C1–C4 are superseded. **Hazard left standing:** the v1 file is
  still physically at `docs/plan/SOP-PILOT.md` on `pilot/sop-v2`. Not merged, because that diff
  would land outside `docs/plan/bilingue/` and break [D1b.9]. The prompt tells the executor which
  file governs.
- OPEN ITEMS 2–4 from the handoff: **[S1]** carried to D1b-2's close, recorded in the contract ·
  **[D1b.14]** promoted to a first-class D1b-1 criterion with `2>/dev/null` named as BLOCKING ·
  **stale totals** superseded in writing by the sizing table.
- ARTIFACTS WRITTEN: `PLAN.md` (D1b-1 contract, D1b-2 outline, META, [D1b.8], D1b test plan, split
  table, 4 decision-log rows) · `evidence/BASE-GATES-d5df247.md` · `prompts/D1b1-r1.md` · this entry.
- GATES: none required of the PM. No source file was read for edit and none was written.
- CODEX: n/a — dispatch, not review.

---

### 2026-08-12 — D1b-1 round 1 — EXECUTOR — submitted for Codex review

```text
PHASE:    D1b-1 — recipient-facing channels (PDF · email · WhatsApp · file download · print)
STARTED:  2026-08-12T14:05:58Z
ENDED:    2026-08-12T14:26:35Z
ATTEMPT:  1 (cumulative for this phase)
RISK:     DISCOVERY
HANDOFFS: 1 (PM prompt -> executor). Same conversation holds the phase under the lean overlay.
WORKTREE: /Users/brentcurtis/dev/casa-pilot   COMMON DIR: /Users/brentcurtis/dev/casa-web/.git
BRANCH:   phase/d1b1-output   BASE: pilot/sop-v2 @ 0fd80f2   ARTIFACTS: 46f11e3
GATES:    shasum -a 256 -c METHOD-MANIFEST.txt      -> 4/4 OK, exit 0   PASS
          bash census.sh > raw 2> stderr            -> exit 0, 3.24s     PASS
          candidate floor (literal SINKS block)     -> 154 / 62          PASS
          git diff --stat pilot/sop-v2...HEAD       -> docs/plan/bilingue/ only, 6 files  PASS
          git diff --quiet e0c9342 -- src supabase  -> exit 0            PASS
          (lint/test/build/Playwright/tsc excluded by contract: source diff is zero lines by D-A;
           npx tsc --noEmit compiles zero files — evidence/BASE-GATES-d5df247.md)
CODEX:    pending
ESCAPED DEFECT: n/a — no PASS yet
```

- **Every reference value in the contract's §9 reproduced exactly**, so nothing needed reporting
  under D-K: Pass A 168/1242 · Pass B 173/369/308 · 1 `AMBIGUOUS_KEEP`
  (`src/data/elementos-fijos/index.json`, `basename-collision`) · floor 154 repo-wide / 62 liturgy ·
  15 `children-ministry` admin files in the 62 · 250 → 174 → 173, i.e. 76 stage-one + 1 stage-two = 77
  exclusions. No stale total from `PLAN.md` or the six plan reviews was carried forward.
- **OUTPUT: 35 records** — 14 `PDF`, 9 `WhatsApp`, 8 `email`, 4 `file download`, **0 `print`**. All
  seven schema fields present on all 35, no blanks, checked mechanically. 7 records carry
  `UNVERIFIED`, each with `materiality:` — six on recipient-facing email, one on the music packet PDF.
- **`print` yields no records.** Three probes (`window.print`/`.print()`/`react-to-print`/`printJS`,
  `@media print`, a `print` dependency in `package.json`) all return nothing at SOURCE_SHA. Recorded
  as what the probes searched, not as a proven absence.
- **TRIAGE of the 62:** 16 `D1b-1` · 17 `D1b-2` · 29 `no surface`. A `diff` proves the triage table
  covers exactly the candidate floor. Of the 29: 3 are regex false positives with no emission
  (`downscaleImage.ts` as [D1b1.4] anticipated, plus `liturgyService.ts` and `useCuentacuentosDraft.ts`,
  whose `download` matches are Supabase **storage reads**), and 26 emit but fall outside the inclusion
  boundary.
- **BOTH NAMED BOUNDARY PROBES DECIDED BY EVIDENCE CHAIN, BOTH EXCLUDED** ([D1b1.5]). The 15
  `children-ministry` admin components have exactly one importer outside their directory,
  `ChildrenMinistryPage.tsx`, routed as `/admin/ninos`; the builder's children path imports
  `@/lib/children-ministry/*` **services**, and the packet email composes from `church_children_*`
  rows, not from component literals. `whatsapp-signup` has one caller, `InstagramFeed.tsx:76`, a public
  marketing section, and the email it sends asks an administrator to add a contact to a broadcast list
  — it touches no keyed reminder/status/reply chain. Chains were recorded before the verdicts.
- **AUDIT YIELD ([D1b1.7]), stated in two halves because they are different answers.** At *file* level
  the reverse audit swept the whole repository for the five channels' terminal calls, independently of
  the floor's path filter: 24 files, 8 not in the 62, and all 8 fail clause 1 — so the path filter
  dropped no in-scope file at this commit. At *record* level it found four emissions the floor pointed
  nowhere near: `wa-reminders`' `formatDateEs` Spanish months and `"voluntario"` fallback substituted
  into an approved template as `{{2}}`/`{{3}}` (file in the 62 only via `templateName`, `PASS_A hits=0`);
  the literal `Reflexión` at `UniversalSlide.tsx:486` rasterised into the projection PDF (file in the
  62 only via `toDataURL`, a D1b-2 token); the preacher name baked into cover pixels at
  `Portadas.tsx:315,449` (file in the 62 only via `toast(`); and — not a record, because the schema
  records emissions — the opt-out keyword grammar at `_shared/whatsapp/payload.ts:42`, which is not in
  the 62 at all and is the receiving half of the `opt_in_bienvenida` template's promise.
- **BLIND SPOT MEASURED, NOT ASSERTED** ([D1b1.11], D-N/D-O). The Pass A gap is worst precisely on this
  phase's channels because the edge functions are written without accents:
  `send-children-service-packet/index.ts` carries a complete Spanish email and scores `PASS_A hits=0`;
  `send-music-service-packet/index.ts` scores `1` over 606 lines; `wa-reminders/index.ts` and
  `packetGenerationService.ts` both score `0` while emitting Spanish. Seven blind spots are recorded
  with their error directions; six fail toward under-reporting.
- **WEAKEST POINT, self-declared:** the boundary exclusion of `OracionesAntifonalesGenerator.tsx` +
  `SlideGenerator.tsx`. They reach `/admin/liturgia/oraciones`, persist to the legacy `liturgias`
  table, and the builder has its own prayer path (`editors/OracionEditor.tsx:326`) — but
  `SlideGenerator` downloads prayer PNGs/PDFs with Spanish names and paints text with 4 `fillText`
  calls. If a reviewer reads clause 1's "prayer" bullet more broadly, both become `D1b-1` and gain
  records **in this phase**. The pair moves together; nothing else does.
- **SCHEMA OBSERVATION, for the reviewer to rule on (D-I).** `language-axis` offers `UI copy`
  (operator locale) and `stored-or-output copy` (liturgy language), and neither describes an email to a
  musician or a children's volunteer. Rather than force a fit or return FINDINGS, those six records —
  plus the packet PDF that reaches the same recipients by signed link — carry
  `UNVERIFIED (materiality: BLOCKS-REPLAN)`, on the ground that resolving the axis could require a
  per-recipient language column, i.e. a data-shape change. **This is the materiality call most in need
  of review.** Stated as an observation about the schema, not a proposal to change it (D-E).
- **CONTRACT IMPERFECTIONS RECORDED, NOT BLOCKING.** (1) The triage vocabulary has no label for "emits,
  but outside the boundary" — 26 of the 62 are in that state and `no surface` is misleading for them;
  D1b-2's contract should add a fourth label. (2) [D1b.8] cannot be discharged here because
  `D1-verify.sh` is D1b-2's and producing it here is BLOCKING; the hash check it mandates was run
  anyway (4/4) and the anchor `dee6a1a` is recorded. (3) See the schema observation above.
- **PRIVACY:** no personal-data value anywhere in the diff (D-D). PII-bearing emissions are recorded by
  field name and position. Two source files hardcode a personal Gmail destination
  (`whatsapp-signup/index.ts:49`, `prayer-request/index.ts:49`); recorded as a shape, address not
  reproduced. No database access. Nothing merged, pushed to `main`, or deployed.
- **`2>/dev/null` audit:** one occurrence in the whole diff, `D1-exclusions.md:269`, and it is prose
  stating that the redirect is forbidden. No command in any artifact uses it ([D1b1.2]).
- ARTIFACTS: `evidence/D1-surfaces-output.md` · `evidence/fixtures/D1-census.json` ·
  `evidence/D1-census-raw.txt` · `evidence/D1-census-stderr.txt` · `evidence/D1-sink-triage.md` ·
  `evidence/D1-exclusions.md` · `reviews/D1b1-r1-review-request.md`.
- NOT DONE, BY CONTRACT: `D1-verify.sh` · `D1-SUMMARY.md` · the combined surfaces document ·
  `slide render` and `toast/UI` records · the `LITURGY_ORDER` seed — all D1b-2's. Backlog **[S1]**
  stays open to D1b-2's close.
- HANDED TO D1b-2: the 17 `D1b-2` files, the toast/slide-render halves of `ExportPanel`, `Portadas`,
  `UniversalSlide` and `send-core`, and one audit find outside the 62 —
  `_shared/whatsapp/phone.ts` emits six Spanish rejection reasons that reach an operator toast through
  `describePacketSendResult`.
- NEXT: independent Codex review of the cumulative diff `pilot/sop-v2...phase/d1b1-output`. Findings
  return to the same executor conversation as one batch (lean overlay §4.2).
