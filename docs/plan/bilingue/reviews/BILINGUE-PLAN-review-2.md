# CODEX PLAN REVIEW — BILINGUE discovery plan — round 1 of this plan (round 2 of the workstream)

Reviewer: Codex Sol
Date: 2026-08-10
Plan reviewed: `docs/plan/bilingue/PLAN.md` at `5ee2f17158d5c053abc3dfc729cb1f2d595882bd`
Prompt: SOP §3.2, issued from the planning session

**VERDICT: FAIL** — 10 BLOCKING · 5 SHOULD-FIX · 1 NIT. Verdict accepted by the PM; all ten
BLOCKING findings were independently verified before acceptance (see LEDGER round 2).

---

## WHAT THE REVIEWER VERIFIED ITSELF

- Clean worktree on `pilot/sop-v2` at exactly `5ee2f17158d5c053abc3dfc729cb1f2d595882bd`.
- Re-ran the census verbatim: prints 174 files / 1,402 lines, but only because the BSD `find`
  regex fails to exclude numbered duplicates. Correct exclusion gives **166 files / 1,402 lines**.
- Live database, read-only transaction: 30 liturgies, 574 elements, 52 distinct `tipo`, 83 songs;
  decomposition 18 × 30 + 32 one-row `custom-*` + 2 stragglers; `custom_content` 54 rows on the
  three prayer types only; `slides` 539 objects; `edited_slides` zero; `config` 80 rows / 11
  top-level keys; `published_resources` uniqueness global on active `resource_type`; nine direct FK
  children including `church_podcast_episodes`; `source_id` = 116 song slugs + 26 `cuentacuentos`
  ids with `story-` shape; 60 cover elements with images, 30 with `textBakedIn=true`.
- Recursive FK graph: beyond the nine direct children it reaches children materials, calendar,
  session assignments, attendance, and both packet-delivery tables.
- Recursive JSON shapes: **55 `slides` paths + 90 `config` paths = 145**.
- `custom-*` structure: four explicit `customType` values plus two rows with none, across eight
  config-key shapes. **Not one homogeneous kind.**
- Code checks re-run for builder paths, canonical JSON, PDFs, publication service, baked-cover
  behaviour, presentation files, `custom_content` usage.
- TypeScript against the target checkout using `casa-web`'s dependency installation; package and
  lockfile hashes match. Exit 0.
- No repository files or database rows were changed.

## BLOCKING

- **[B1] The string census makes false reproducibility and sizing claims.** `PLAN.md:114` uses a BSD
  `find` regex where `?` does not act as intended; the census includes the orphan files it claims to
  exclude. Correct exclusion changes 174/1,414 to 166/1,402. The `CuentacuentoEditor` figure is also
  reported as 434 of 601, not 596. More fundamentally, accent-bearing lines are a **lower-bound
  candidate set**, not an upper bound on inspection: `Guardar`, `Cancelar`, `Presentar`,
  `Error desconocido` are Spanish without accents, and `_shared/whatsapp/`, the builder page and the
  canonical JSON are outside the script entirely.
- **[B2] The "20 kinds plus one custom rule" correction is not true.** `PLAN.md:198` decomposes the
  52 slugs correctly but converts 32 identifiers into one semantic kind. Production has
  `title-slide` (12), `image-slide` (11), `text-slide` (5), `call-response` (2) and two untyped
  rows, across eight config shapes. D2.2 anticipates discovering this, yet the correction and the
  Decision Log already call homogeneity verified and size D2 from it.
- **[B3] D2 already exceeds its split trigger and stays too large after the proposed split.** 145
  normalized paths against a ~40 trigger at `PLAN.md:391`. A 21-row × 145-path matrix is thousands
  of cells. Pre-split now — scalar/core records, slide schemas, config/custom/story schemas.
- **[B4] The translation inventory is incomplete against the discovery goal.** D2 omits `orden`,
  timestamps, IDs/FKs and `edited_slides` from its stated columns, and never dispositions
  `liturgias.titulo`, `resumen`, `reflexion_texto`, `portadas_config`, `presentation_styles`,
  `liturgia_lecturas.cita/texto/version` or `liturgia_oraciones.tiempos`.
- **[B5] The downstream correction is right only at depth one.** D5 asks what happens to
  "everything hanging off a liturgy" and D5.6 promises indirect tables, but its verifier derives
  only direct children. The recursive graph additionally reaches
  `church_children_lesson_materials`, `church_children_calendar`,
  `church_children_session_assignments`, `church_children_attendance`,
  `church_children_packet_deliveries` and `music_packet_deliveries`.
- **[B6] D-C does not provide the executable defence the plan claims.** D2-, D3-, D4- and D5-verify
  are each required to re-derive SQL-backed facts. A shell script cannot call an MCP and no SQL
  runner is specified. Raw pasted results are evidence but do not mechanically compare themselves
  with the document. D3's runtime PII query directly contradicts the claimed shell/SQL separation.
- **[B7] Live drift and read-only verification are internally contradictory.** D5 says drift is
  reported while its Definition of Done and D6 require every verifier to exit 0 — so a legitimate
  production row blocks D6. Counts also cannot prove nothing was modified: update-in-place or
  delete-plus-insert preserve counts. Use a read-only role/transaction and distinguish timestamped
  observations from structural invariants.
- **[B8] D3 does not enforce its privacy goal.** Grepping only current celebrant and preacher values
  cannot establish that no PII escaped; reachable data includes delivery emails, volunteer/musician/
  user IDs, podcast speakers, arbitrary announcements, prayer text, JSON content, phone-number paths
  and possible prompt/log payloads. D3 also lets the executor invent the definition of "personal
  data" — that definition and the provider/logging boundary must be fixed before the census.
- **[B9] Material unknowns can still be marked Done.** D1/D2 allow `UNVERIFIED`, D5 allows
  publication behaviour to stay `UNVERIFIED`, D4.7 has an explicit escape, and nothing says an
  unresolved scope- or cost-affecting fact blocks D6. The workstream can close without producing the
  verified inventory in its goal.
- **[B10] D6.7 is not an independently runnable criterion.** A grep finds the word "recommend" but
  cannot detect an implicit recommendation via asymmetric framing, omitted costs, ordering or loaded
  language. A fresh human reviewer *can* judge neutrality, so it is not unenforceable — but it is
  semantic review, not D-C verification, and executor self-rereading is self-grading. Either define
  a mechanically checkable symmetric structure and acknowledge the residual human judgment, or drop
  the claim that every criterion is executable.

## SHOULD-FIX

- **[S1]** D-F's blanket "translate rather than regenerate" is over-broad — it conflicts with D2's
  `re-fetch` and `human-select` dispositions, Bible editions, curated canonical texts, song
  replacement and D4's recomposition outcomes. Narrow it to the generated prose Brent decided about.
- **[S2]** Freeze UI locale and liturgy language as independent product axes. D1 already depends on
  the distinction and the prior review found `L1` sound.
- **[S3]** D4 is not independent of D3 as claimed: D4.6 requires a cross-reference to D3.
- **[S4]** Gate handling is not credible. Running gates in an arbitrary checkout with dependencies
  does not test the phase commit. The phase commands also omit `npm run build`, Playwright and Deno
  edge tests despite listing broader project gates. Run against the same SHA, or explicitly define
  and justify a document-only gate set.
- **[S5]** External feasibility is absent: Bible rights/attribution for the ten frozen translations,
  and approved English WhatsApp templates plus approval lead time.

## NITS

- **[N1]** `src/data/elementos-fijos/` contains seven files: six content files plus `index.json`.
  "Six canonical documents / 46 slides" is accurate; "6 files" is ambiguous.

## MISSING PHASES

The discovery-only boundary is sound; omitting the eleven feature phases is not a dodge. What is
missing is discovery work required by the narrower goal:

1. A complete stored-field contract covering `liturgias`, elements, readings, prayers and
   language-dependent descendant records — not just `liturgia_elementos`.
2. A recursive downstream graph and policy inventory, not direct FKs plus selected examples.
3. A PII/dataflow audit following values into prompts, providers, logs, notifications, assets and
   derived records.
4. External dependency feasibility: Bible redistribution/attribution and English WhatsApp templates.

These can be added by splitting and expanding D2/D3/D5; they do not require four new top-level
phases.

## FROZEN DECISIONS THE REVIEWER DISPUTES

- **D-A** sound. **D-B** sound in principle, but the current commands do not meet it.
- **D-C** wrong as written — it promises automation the phase test plans cannot perform.
- **D-D** sound for evidence handling; add the broader rule that member PII never reaches
  translation providers, AI prompts or logs.
- **D-E** sound for D1–D5; applying it to D6 requires an explicit human-neutrality review rather
  than pretending neutrality is script-verifiable.
- **D-F** freeze the product decisions individually, and narrow "translate rather than regenerate"
  to its intended content class.

**Also freeze now:** UI locale and liturgy content language are independent axes; the formal PII
classification used by D3; and that any unresolved fact materially changing feasibility, scope or
phase count blocks D6 rather than being accepted as `UNVERIFIED`.
