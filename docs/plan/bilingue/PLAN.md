# PLAN — BILINGUE, discovery workstream

META
- REPO / ROOT: `casa-web`. Plan docs live on branch `pilot/sop-v2`, checked out at
  `/Users/brentcurtis/dev/casa-pilot`.
- PLAN ROOT: `docs/plan/bilingue/`. **Never write BILINGUE entries into `docs/plan/LEDGER.md`** —
  that file is shared by CUENTOS and MATERIALES, both appending concurrently.
- BRANCH CONVENTION: `phase/<id>-<slug>`, base `pilot/sop-v2`, ≤20 chars.
- PLAN FROZEN: **NO — draft 3, 2026-08-10.** Draft 1 (`5ee2f17`) FAIL, 10 BLOCKING. Draft 2
  (`98ab364`) FAIL, 8 BLOCKING (`reviews/BILINGUE-PLAN-review-3.md`). SOP §1.5's 2-round cap was
  reached; Brent authorised draft 3 **and** directed that Codex review it rather than override.
- SOP: `~/.claude/agent-workflow/AGENT-WORKFLOW.md`. Amendments: `docs/plan/SOP-PILOT.md`.
- SUPERSEDES: nothing. `docs/plan/PLAN-BILINGUE.md` is history only.

---

## What changed in draft 3, and why it is not just another pass

Across drafts 1 and 2 I asserted an inventory fact without checking it **four times** — `custom-*`
homogeneity, `find -regex` behaviour, D-C's consistency with its own test plans, and the
code-declared custom subtypes. Each was caught by one command. Fixing eight instances would produce
a fifth.

**So this draft asserts less.** A fact appears in this plan only if a phase's *size* depends on it.
Everything else — every list, every taxonomy, every count that an executor could derive — is now an
**acceptance criterion with the derivation command attached**, not a statement of the answer.

The `blank-slide` miss is the argument. Draft 2 listed five `custom-*` shapes from production data
and missed a sixth that exists in seven source files with zero rows. Had D2c said *"union the live
shapes with the code-declared shapes, by these two commands"*, the plan would have been right
without my knowing the answer. **A plan that asserts less cannot be wrong in this way.**

---

## Goal

Produce the verified inventory a bilingual-liturgy feature plan can be built on, and put the scope
decision in front of Brent with costs attached. This plan **does not build the feature.**

Feature phases are deliberately absent: each depends on an answer D1–D5 produces. Both reviewers
agreed the discovery-only boundary is sound and that no new top-level phase is required.

## Non-goals

- **Any source change, schema change, or database write.** Discovery is read-only.
- Deciding scope (D6 presents; Brent decides), choosing an i18n library, translation provider or
  storage model, or writing the feature plan.

---

## Verified current state — sizing facts only

Every row's exact command is in **Appendix A**, keyed by ID. Nothing here is recalled. Anything an
executor could derive has been moved into a phase criterion instead of asserted here.

| ID | Sizing fact | Value | Why the plan needs it |
|---|---|---|---|
| V1 | Liturgies · elements · distinct `tipo` | 30 · 574 · 52 | scopes every DB phase |
| V2 | `liturgia_elementos.slides` normalized paths | **55** | sizes D2b |
| V3 | `liturgia_elementos.config` normalized paths | **90** | sizes D2c |
| V4 | Other JSON columns in the liturgy path | `liturgias.portadas_config`, `liturgias.presentation_styles`, `liturgia_oraciones.tiempos`, `cuentacuentos_drafts.story` | **these have no home in D2b/D2c** — they size D2d |
| V5 | Recursive FK closure of `liturgias` | **15 tables** (9 direct, +4 at depth 2, +2 at depth 3) | sizes D5 |
| V6 | Census surfaces / candidate lines | **166 files** (line total is **disputed — see V6n**) | sizes D1 |
| V6n | The line count does **not** reproduce between reviewers | PM measures 1,402; Codex measures a different total; on `CuentacuentoEditor.tsx` PM gets 596 accent-bearing lines across five methods and two locales, Codex gets 601 | **This is the finding, not the number.** Two parties cannot reproduce each other's census — which is what the census exists to prevent. D1 freezes the method byte-for-byte before counting. No line total in this plan is load-bearing. |
| V7 | `psql` is not installed | `which psql` → not found | forces the two-mechanism verification model (D-C) |
| V8 | `casa-pilot` has no `node_modules` | 0 entries | forces `npm ci` before gates |
| V9 | `npx tsc --noEmit` passes on the base | exit 0 | makes the source-leak gate meaningful |
| V10 | Shell dialects differ on `find -regex` | under `bash` the orphan filter returns 0; under `zsh`, 18; `find -E` returns 18 in both | **draft 2's census was wrong because of this, and so was my rebuttal of the finding** — D1 must pin the shell |

**Facts deliberately NOT asserted here**, each now a derivation criterion: the element-kind
taxonomy, the `custom-*` shape set, the PII field list, the baked-asset counts, the `source_id`
contract, per-table row counts, and the surface classification. Draft 2 asserted several of these
and was wrong about two.

---

## Frozen architectural decisions

| # | Decision | Rationale |
|---|---|---|
| **D-A** | **No phase modifies source, schema or configuration, and no phase writes to the database.** Diffs confined to `docs/plan/bilingue/**`. | Code in the diff means the executor answered a question by changing the answer. |
| **D-B** | **Every claim carries the exact command or query that produced it, in full, runnable as written.** Abbreviations (`find`, `count(*)`, "the recursive CTE") do not satisfy this. A claim without one is labelled `UNVERIFIED` in place. | Draft 2 violated this inside its own verified-state table. |
| **D-C** | **Two mechanisms, and each claims only what it can do.** (1) `D<n>-verify.sh` is **pure shell — it never touches the database.** It diffs the evidence document against committed JSON fixtures and re-runs filesystem/grep claims. (2) **Every database fact reaches a fixture through the manual MCP step**, which runs the recorded query in a read-only transaction and writes the result plus a provenance header. The shell script proves *document ↔ fixture*; the MCP step proves *fixture ↔ database*. Neither claims the other's job. | `psql` is absent (V7) and a shell script cannot call an MCP. Draft 2 stated this correctly and then let D3.10 and D5's test plan violate it. |
| **D-D** | **Discovery records paths, shapes and counts — never personal-data values**, in documents, fixtures, ledger entries or prompts. Examples are synthetic or redacted to shape. | Discovery reads exactly the fields the feature must protect. |
| **D-E** | **D1–D5 describe; they never prescribe.** They record what is true and what options cost. They do not choose. | A discovery phase that recommends gets its recommendation frozen without review. |
| **D-F** | Brent's product decisions stand: liturgy output **and** builder UI; independent copies, no sync; language fixed at birth, duplication the only route to the other language; ten English Bible translations; English songs uploaded, never machine-translated. **"Translate rather than regenerate" applies to generated devotional prose only** — not Bible text (re-fetched), canonical liturgical texts (curated), songs (re-selected) or assets (recomposed). | Decided 2026-08-10; narrowed in draft 2. |
| **D-G** | **UI locale and liturgy content language are independent axes.** Either can be set without changing the other. | D1's taxonomy rests on this; carried forward from the failed plan's `L1` on its merits. |
| **D-H** | **The PII classification is fixed here, not chosen by an executor.** Personal data = any value identifying or contactable to a natural person: names (celebrant, preacher, presenter, volunteer, musician, member, podcast speaker), contact details (email, phone, WhatsApp number), auth identifiers (`created_by`, `published_by`, any `*_by` / `user_id` / `volunteer_id` / `musician_id`), free text authored by or about an identified person, and any of these rendered into an asset or a log line. **Member PII never reaches a translation provider, an AI prompt, or a log.** | A census scoped by the definition it was meant to test proves nothing. |
| **D-I** | **Every `UNVERIFIED` entry carries `materiality: BLOCKS-D6 \| DETAIL`.** The verify script fails on any `UNVERIFIED` lacking the field. The classification is approved by the phase's independent reviewer, not self-applied. D6 fails on any unclassified entry and on any open `BLOCKS-D6`. | Draft 2 let executors choose whether to raise the blocking label, which is circular. |
| **D-J** | **Where the plan could assert a list and instead requires derivation, the derivation is the contract.** An executor that copies a list out of this plan rather than running the command has not met the criterion. Where a derivation must union *live data* with *code declarations*, both commands are named and both must run. | `blank-slide` exists in seven source files with zero production rows. Data-only enumeration misses real behaviour; code-only enumeration misses legacy rows. |

**Not carried forward:** L2–L8 from `PLAN-BILINGUE.md`. L1 is re-frozen on its merits as D-G.

---

## Phase index

| ID | Name | Status | Branch | Depends on |
|----|------|--------|--------|-----------|
| D1 | Surface inventory + frozen-method census | TODO | `phase/d1-surfaces` | — |
| D2a | Scalar columns, four liturgy tables + JSON delegation register | TODO | `phase/d2a-scalars` | D1 |
| D2b | `liturgia_elementos.slides` — 55 paths | TODO | `phase/d2b-slides` | D2a |
| D2c | `liturgia_elementos.config`, `custom_content`, custom shapes | TODO | `phase/d2c-config` | D2a |
| D2d | The other four JSON columns | TODO | `phase/d2d-json` | D2a |
| D4 | Asset reality — text baked into pixels | TODO | `phase/d4-assets` | D1 |
| D3 | PII dataflow audit and translator boundary | TODO | `phase/d3-pii` | D1, **D4** |
| D5 | Downstream policy — the recursive table closure | TODO | `phase/d5-downstream` | D1 |
| D6 | Scope decision memo and re-plan input pack | TODO | `phase/d6-scope` | all |

**Sequencing.** D1 first. Then D2a, D4 and D5 in parallel. D2b/D2c/D2d follow D2a and are parallel
to each other; **D3 follows D4**, because D3's dataflow audit consumes D4's asset inventory — an
asset discovered after the PII audit closed would leave the audit incomplete. D6 joins everything.

*(Draft 2 had this dependency backwards.)*

### The gate set

No phase changes source, so the full project suite would re-test the base branch, not the phase.
The **document gate set**, run in `casa-pilot` at the phase commit after `npm ci`:

```bash
git diff --stat pilot/sop-v2...HEAD          # must list only docs/plan/bilingue/
bash docs/plan/bilingue/evidence/D<n>-verify.sh
npx tsc --noEmit                              # catches a source file that leaked into the diff
```

`npm run lint`, `npm test`, `npm run build` and Playwright are excluded deliberately. If `npm ci`
fails, report BLOCKED — do not run gates in a different checkout.

### The fixture protocol (D-C, mandatory for every DB-derived fact)

Every fixture under `evidence/fixtures/` opens with a provenance header:

```json
{"_provenance": {
  "project_ref": "mulsqxfhxxdsadxsljss",
  "query_sha256": "<sha256 of the exact query text>",
  "captured_at": "<ISO-8601>",
  "transaction_read_only": true,
  "captured_by": "<SESSION line>"
}, "rows": [ ... ]}
```

The MCP step runs `SET TRANSACTION READ ONLY;` before the query and records that it did.
`D<n>-verify.sh` checks the header is present and well-formed, that `query_sha256` matches the
query text committed in the evidence document, and that the document's tables agree with `rows`.
**It does not and cannot check the fixture is current** — that is the refresh step, required again
at D6.

---

## Phase D1 — Surface inventory + frozen-method census

**One question:** which code paths emit user-visible text, and does each follow the operator's
locale or the liturgy's language (D-G)?

**Scope** — `evidence/D1-surfaces.md`, `evidence/census.sh`, `evidence/D1-verify.sh`, fixtures.

**The census method is frozen before any counting** (this is the phase's first deliverable, and
V6n is why). `evidence/CENSUS-METHOD.md` must pin, and `census.sh` must implement:
shell (`#!/usr/bin/env bash`, and `find -E` or a `grep -vE` stream filter — never bare
`find -regex`, per V10) · `LC_ALL` · the exact character class as codepoints · comment-line
regex · file extensions **including `.json`** · tokenisation and case-folding for the second pass ·
the stopword/verb list as a committed file · and whether the two passes are unioned or reported
separately. Both passes report; **neither is presented as "the" count.**

Surfaces requiring a row, each classified **UI copy** / **stored-or-output copy** / **generation
instruction**: the four PDF generators, music and children packets, WhatsApp (including
`supabase/functions/_shared/whatsapp/`), presentation mode, the seven liturgy-content edge
functions, `src/pages/ConstructorLiturgiasPage.tsx`, and `src/data/elementos-fijos/*.json`. This
list is a floor; D1 derives the ceiling.

**Out of scope:** how any surface should be made bilingual (D-E); non-liturgy surfaces; fixing the
orphan `* N.tsx` duplicates.

**Acceptance criteria**
- [D1.1] `CENSUS-METHOD.md` pins every element listed above; `census.sh` implements it; the shell is
  declared and the `find -regex` trap (V10) is demonstrably avoided.
- [D1.2] Both passes run from a clean checkout; both outputs pasted verbatim with the commit SHA.
- [D1.3] The surface list is **derived**, not copied from this plan (D-J), by a recorded command;
  the floor list above is a subset of the result or the document says why not.
- [D1.4] Every path in the document exists — `D1-verify.sh` exits non-zero on any miss.
- [D1.5] Every surface classified against D-G with a one-line reason. No blank rows.
- [D1.6] The document states, adjacent to the numbers, that the accent pass is a **lower bound**
  and why (`Guardar`, `Cancelar` are Spanish without accents).
- [D1.7] Every `UNVERIFIED` carries `materiality:` (D-I).
- [D1.8] Document gate set passes; raw output pasted.

**Test plan:** `bash evidence/D1-verify.sh` — asserts every path exists, re-runs both passes, diffs
totals against `fixtures/D1-census.json`, and fails on any `UNVERIFIED` without `materiality:`.
Then `git diff --stat pilot/sop-v2...HEAD` and `npx tsc --noEmit`.

**Definition of done:** all criteria checked, `D1-verify.sh` exits 0, gates green, reviewer has
approved every `materiality:` classification, branch mergeable.

**Risks / unknowns:** the presentation module renders liturgy content inside operator chrome and may
need both classifications — if the taxonomy cannot express that, add a category and say why. The
stopword pass will produce false positives; report precision rather than tuning until the number
looks good.

**Rollback:** delete the branch. Nothing outside the plan tree was touched.

---

## Phase D2a — Scalar columns, four liturgy tables + JSON delegation register

**One question:** for every scalar column a liturgy owns, what happens on duplication — and which
phase owns each JSON column's interior?

**Scope** — `evidence/D2a-scalars.md` covering all scalar columns of `liturgias`,
`liturgia_elementos`, `liturgia_lecturas` and `liturgia_oraciones`, plus a **delegation register**
naming every JSON column in those tables and the phase that dispositions its interior. No JSON
column is dispositioned atomically; `presentation_styles` alone mixes translatable overlay content
with copied identifiers and styling, so an atomic verdict would be wrong either way.

**The disposition vocabulary**, used by D2a–D2d: **translate** · **re-fetch** · **copy verbatim** ·
**clear** · **human-select** · **regenerate**.

**The resolution schema**, used by D2a–D2d and the fix for the deepest defect in draft 2: a single
disposition per field is insufficient, because `source_id`, `titulo` and shared slide paths resolve
differently for songs, readings, canonical texts, announcements and generated prose. Each field or
path therefore carries **a default disposition plus an explicit exception list keyed by element
kind**, and **every observed `(field, kind)` pair must resolve** through exactly one of them.

**Out of scope:** JSON interiors (D2b/D2c/D2d); designing the copy mechanism, transaction or RPC.

**Acceptance criteria**
- [D2a.1] The column list is derived into `fixtures/D2a-columns.json` via the MCP step and diffed
  against the document. A column in one and not the other fails the verify.
- [D2a.2] Every scalar column carries a default disposition plus its exception list; every observed
  `(column, kind)` pair resolves through exactly one. The verify enumerates pairs and fails on any
  unresolved or doubly-resolved pair.
- [D2a.3] The delegation register names every JSON column in the four tables and its owning phase;
  a JSON column with no owner fails the verify.
- [D2a.4] The `source_id` contract is **derived**, not inherited (D-J): the join is run fresh and
  its result pasted. Prior documents claim 116 song slugs + 26 cuentacuentos ids — treat that as a
  hypothesis to test, not a fact to repeat.
- [D2a.5] `edited_slides` is dispositioned with both its population count **and** whether code reads
  it, each with its command.
- [D2a.6] Every **clear** carries a one-line reason.
- [D2a.7] No personal-data value anywhere (D-D). Every `UNVERIFIED` carries `materiality:` (D-I).
- [D2a.8] Document gate set passes.

**Test plan:** `bash evidence/D2a-verify.sh` — fixture-header validation, column-list diff,
`(column, kind)` coverage enumeration, vocabulary check, no-blank-cell check, `materiality:` check.
Then `git diff --stat` and `npx tsc --noEmit`.

**Definition of done:** criteria checked, verify exits 0, gates green, `materiality:` classifications
reviewer-approved, branch mergeable.

**Risks:** six dispositions are my taxonomy, not one the codebase implies — a field needing a
seventh is a finding worth having, not a criterion to force-fit.

**Rollback:** delete the branch.

---

## Phase D2b — `liturgia_elementos.slides`: 55 paths

**One question:** what is in the `slides` object, and what happens to each path on duplication?

**Scope** — `evidence/D2b-slides.md`, organised **by path** with kind-keyed exceptions (a dense
55 × kinds grid would be thousands of cells and is not the artifact). Each path carries a default
disposition plus exceptions, per D2a's resolution schema.

The enumeration query — note the **single** recursive term, since Postgres rejects two references
to a recursive CTE — is in Appendix A as `V2`. Run it; do not copy its result from this plan (D-J).

**Out of scope:** `config`, `custom_content` (D2c); other tables' JSON (D2d); scalars (D2a).

**Acceptance criteria**
- [D2b.1] The path set is derived into `fixtures/D2b-paths.json` via the MCP step and diffed against
  the document. Drift in the path count is reported with both values.
- [D2b.2] **Every observed `(path, kind)` pair resolves** through exactly one default or exception.
  The verify enumerates the pairs from the fixture and fails on any unresolved pair — this is the
  coverage check, and it is what makes the by-path organisation safe rather than merely smaller.
- [D2b.3] The pair count is stated. If it materially exceeds the path count — many paths shared
  across many kinds — the document says so, since that is what determines the real work.
- [D2b.4] Paths holding text are distinguished from paths holding ids, URLs, ordering or styling.
- [D2b.5] Asset-bearing paths are cross-referenced to D4 by path name.
- [D2b.6] Code-declared paths with zero production rows are included, derived by a recorded grep and
  unioned with the live set (D-J).
- [D2b.7] No personal-data value (D-D); every `UNVERIFIED` carries `materiality:` (D-I).
- [D2b.8] Document gate set passes.

**Test plan:** `bash evidence/D2b-verify.sh` — fixture-header validation, path-set diff,
`(path, kind)` coverage enumeration, vocabulary check, `materiality:` check. Then `git diff --stat`
and `npx tsc --noEmit`.

**Definition of done:** criteria checked, verify exits 0 including the coverage enumeration, gates
green, classifications reviewer-approved, branch mergeable.

**Risks / split trigger:** if the resolved pair count exceeds ~700, split by top-level `slides` key
and report — do not truncate. This trigger is on **pairs**, not paths, because draft 2's
path-based trigger measured the wrong thing.

**Rollback:** delete the branch.

---

## Phase D2c — `liturgia_elementos.config`, `custom_content`, and the custom shapes

**One question:** what is in `config` and `custom_content`, and how many distinct custom shapes
exist across data *and* code?

**Scope** — `evidence/D2c-config.md`: the `config` path set (Appendix A `V3`), each dispositioned
per D2a's schema; the `custom_content` contract; and the custom-shape inventory.

**The custom-shape inventory is derived, not given** (D-J). Draft 2 asserted five shapes from
production data and missed `blank-slide`, which exists in source with zero rows. The inventory is
the **union** of:

```sql
-- live shapes
select coalesce(config->>'customType','(untyped)') as shape, count(*)
from liturgia_elementos where tipo like 'custom-%' group by 1 order by 2 desc;
```
```bash
# code-declared shapes
grep -rhoE "'[a-z]+-(slide|response)'" src --include='*.ts' --include='*.tsx' | sort | uniq -c | sort -rn
```

Untyped rows are characterised by their actual slide shape, not folded into a declared type they do
not claim.

**Out of scope:** `slides` (D2b); other tables' JSON (D2d); scalars (D2a).

**Acceptance criteria**
- [D2c.1] The `config` path set derived into a fixture and diffed; every observed `(path, kind)`
  pair resolves (coverage enumeration, as D2b.2).
- [D2c.2] The custom-shape inventory is the **union of live and code-declared** shapes, both
  commands run and both outputs pasted. A shape present in code with zero rows is included and
  marked as such.
- [D2c.3] Untyped custom rows are characterised individually by slide shape; the document states
  whether they are legacy data or corruption, or marks it `UNVERIFIED` with `materiality:`.
- [D2c.4] `custom_content`'s contract states what its populated rows hold **structurally** — shape
  only, no values (D-D) — with the query that establishes both the population and the shape.
- [D2c.5] Paths that are ids, URLs or styling are **copy verbatim** with a reason.
- [D2c.6] Every `UNVERIFIED` carries `materiality:` (D-I).
- [D2c.7] Document gate set passes.

**Test plan:** `bash evidence/D2c-verify.sh` — fixture-header validation, path-set and shape-set
diffs, coverage enumeration, `materiality:` check. Then `git diff --stat` and `npx tsc --noEmit`.

**Definition of done:** criteria checked, verify exits 0, gates green, classifications
reviewer-approved, branch mergeable.

**Risks / split trigger:** same pair-count trigger as D2b (~700). The two untyped rows may be
corruption rather than a shape; either answer is acceptable, asserting the convenient one is not.

**Rollback:** delete the branch.

---

## Phase D2d — The other four JSON columns

**One question:** what is inside the JSON columns that D2b and D2c do not cover?

This phase exists because draft 2 had no home for them: `liturgias.portadas_config`,
`liturgias.presentation_styles`, `liturgia_oraciones.tiempos`, and `cuentacuentos_drafts.story`
(V4). `presentation_styles` is the reason atomic dispositions fail — it mixes translatable overlay
content with copied identifiers, positions, visibility, scope and styling.

**Scope** — `evidence/D2d-json.md`: the path set for each of the four columns, each dispositioned
per D2a's schema, with kind-keyed exceptions where the column varies by element kind.

**Out of scope:** `liturgia_elementos.slides`/`config` (D2b/D2c); scalars (D2a); designing the copy
mechanism.

**Acceptance criteria**
- [D2d.1] All four columns covered; the path set for each derived into a fixture via the MCP step
  and diffed against the document.
- [D2d.2] `presentation_styles` is dispositioned **per path**, distinguishing overlay content from
  identifiers, geometry, visibility, scope and styling. A single verdict for the column fails.
- [D2d.3] Code-declared paths with zero production rows are unioned in by a recorded grep (D-J) —
  overlay content in particular may be declared in types but unpopulated.
- [D2d.4] `tiempos` and `story` paths holding prose are distinguished from structural paths.
- [D2d.5] Every path resolves through a default or an exception; coverage enumerated by the verify.
- [D2d.6] No personal-data value (D-D); every `UNVERIFIED` carries `materiality:` (D-I).
- [D2d.7] Document gate set passes.

**Test plan:** `bash evidence/D2d-verify.sh` — fixture-header validation, four path-set diffs,
coverage enumeration, `materiality:` check. Then `git diff --stat` and `npx tsc --noEmit`.

**Definition of done:** criteria checked, verify exits 0, gates green, classifications
reviewer-approved, branch mergeable.

**Risks:** `cuentacuentos_drafts.story` may be the largest of the four and may belong in its own
phase; splitting it out and reporting is correct behaviour if the pair count runs high.

**Rollback:** delete the branch.

---

## Phase D4 — Asset reality: text baked into pixels

**One question:** which images carry text in their pixels, and what does the generator do?

**Runs before D3**, which consumes its inventory.

**Scope** — `evidence/D4-assets.md`: every image-bearing surface in the liturgy path; per surface,
the image's origin, whether text is composited into pixels or overlaid at render, and how many
existing assets are affected. The cover generator characterised from source.

Known entry points, to be **derived and extended**, not copied (D-J): `Portadas.tsx` sets
`textBakedIn` and a `subtitle` drawn from liturgy context; `templateCompositor.ts` branches on the
flag; `types/shared/slide.ts` declares it; `GraphicsGeneratorV2.tsx` defaults it. Prior documents
claim 60 cover elements with images and 30 baked — a hypothesis to test.

**Out of scope:** designing a fix (D-E); non-liturgy image pipelines; creating, modifying or
deleting any asset; the PII reading of baked-in names (that is D3, which this phase feeds).

**Acceptance criteria**
- [D4.1] The image-bearing surface list is derived by a recorded command, not copied.
- [D4.2] The baked-in-text asset count is derived into a fixture via the MCP step; not inherited.
- [D4.3] Generator behaviour is described with file:line references that `D4-verify.sh` confirms
  still contain the cited symbol, matched **within a ±10-line window** so an unrelated upstream edit
  does not fail the phase.
- [D4.4] Per surface: does producing the same asset in another language require regeneration,
  recomposition, or nothing?
- [D4.5] Story covers and liturgy covers are distinguished — different pipelines.
- [D4.6] **The document emits an explicit hand-off list for D3**: every asset path that can carry
  personal data in pixels, so D3 consumes a complete inventory rather than discovering one later.
- [D4.7] Read-only is asserted by mechanism, not by counts — a count cannot detect update-in-place.
  If storage objects cannot be enumerated read-only, the claim is `UNVERIFIED` with `materiality:`.
- [D4.8] Every `UNVERIFIED` carries `materiality:` (D-I).
- [D4.9] Document gate set passes.

**Test plan:** `bash evidence/D4-verify.sh` — windowed symbol assertions, fixture-header validation,
asset-count diff, hand-off list non-empty-or-justified, `materiality:` check. Then `git diff --stat`
and `npx tsc --noEmit`.

**Definition of done:** criteria checked, verify exits 0, gates green, the D4.6 hand-off list is
committed, classifications reviewer-approved, branch mergeable.

**Risks:** whether a Spanish-baked cover is *acceptable* on an English liturgy is a taste question —
D4 records the fact, Brent decides at D6. Image storage location is unestablished, which is why
D4.7 has an explicit escape.

**Rollback:** delete the branch.

---

## Phase D3 — PII dataflow audit and translator boundary

**One question:** where does personal data *flow*, and what must never leave the system?

**Consumes D4's hand-off list** (D4.6).

**Scope** — `evidence/D3-pii.md`:
- **Field census** across the tables in D5's closure plus `liturgias`, **plus non-FK sources**:
  `published_resources.published_by`, and the notification-recipient records supplying musician,
  volunteer and WhatsApp contact data. These sit outside the FK closure and draft 2 missed them.
- **Dataflow** — per PII-bearing field, where its value can travel: AI prompts, translation
  providers, email, WhatsApp, PDFs, images (from D4.6), logs, derived records.
- **Translator boundary** — every field bucketed **sendable** / **never** / **redact-first**, with a
  reason. Descriptive (D-E).

**Out of scope:** designing redaction, placeholders or provider selection; non-liturgy PII.

**Acceptance criteria**
- [D3.1] The column list for every in-scope table is derived into a fixture via the MCP step and
  diffed against the triage.
- [D3.2] Every column triaged against **D-H's** definition, quoted rather than restated.
- [D3.3] Free-text fields identified with populated-row counts.
- [D3.4] The announcement path is covered — unbounded operator-authored text.
- [D3.5] The dataflow section covers every destination listed above per PII field; a destination
  that is not applicable is stated as such rather than omitted.
- [D3.6] D4.6's hand-off list is consumed in full: every asset path on it is triaged here.
- [D3.7] Non-FK sources (`published_resources.published_by`, notification recipients) are included.
- [D3.8] Every field bucketed sendable / never / redact-first with a reason. None unbucketed.
- [D3.9] Prompt-injection surface noted: which free-text fields reach an AI prompt.
- [D3.10] **Existing D-H violations are raised immediately as `BLOCKS-D6`**, not filed. If a current
  prompt already receives celebrant or preacher data, Brent needs that during the phase.
- [D3.11] **Leak check, in two layers, neither of which violates D-C.** (a) `D3-verify.sh` is pure
  shell and scans the plan tree for *value-shaped* strings — email, phone and WhatsApp-number
  patterns — failing on any hit. (b) The manual MCP step cross-checks the tree against actual
  values in a read-only transaction and records **only a boolean result plus provenance**, never a
  value. Draft 2 put (b) inside the shell script, which cannot reach the database.
- [D3.12] Document gate set passes.

**Test plan:** `bash evidence/D3-verify.sh` — fixture-header validation, column-list diff, bucket
completeness, D4.6 hand-off coverage, the shell-side pattern leak scan, `materiality:` check. Then
the manual MCP value cross-check, recorded as a boolean. Then `git diff --stat` and
`npx tsc --noEmit`.

**Definition of done:** criteria checked, verify exits 0, both leak layers run and recorded, gates
green, classifications reviewer-approved, branch mergeable.

**Risks:** phone numbers may live in JSON paths rather than columns, so the field census alone will
not find them — the dataflow pass is what catches that. The pattern scan will produce false
positives on synthetic examples; that is the correct direction to fail.

**Rollback:** delete the branch.

---

## Phase D5 — Downstream policy: the recursive table closure

**One question:** what happens to everything hanging off a liturgy when a second liturgy in another
language exists?

**Scope** — `evidence/D5-downstream.md`: one row per table in the recursive FK closure of
`liturgias` (V5 sizes it at 15; the executor derives the set, per D-J), plus `published_resources`,
which has no FK but is keyed by `liturgy_id`. Per row: depth and FK path, current count, delete
behaviour, whether it holds language-dependent content, and the disposition options —
**copy / translate / detach / clear** — with cost and consequence. Options, not a choice (D-E).

**Out of scope:** designing language-aware uniqueness or a migration; choosing dispositions;
notification copy (D1).

**Acceptance criteria**
- [D5.1] The table set is the **recursive** closure, derived into `fixtures/D5-graph.json` via the
  MCP step and diffed. A table in the graph but not the document fails the verify.
- [D5.2] Each row states depth and the FK path from `liturgias`.
- [D5.3] Each row states count, delete behaviour and language-dependence, each with its query.
- [D5.4] Each row lists ≥2 dispositions with consequences; a single-option row says why.
- [D5.5] The `published_resources` uniqueness behaviour is characterised: what a user sees today and
  what they would see if a second-language resource were activated. **Observed or `UNVERIFIED` with
  `materiality:`** — never inferred from the index definition alone, and never established by
  publishing a test resource (D-A wins over any criterion).
- [D5.6] **Structural claims and observations are separated.** Table set, FK paths and delete
  behaviour are invariants — the verify fails on change. Row counts are timestamped observations —
  the verify reports old and new and does **not** fail. This is what lets D6 require exit 0 without
  a legitimate production insert blocking the workstream.
- [D5.7] Read-only is evidenced by the fixture provenance header (`transaction_read_only: true`),
  not by comparing counts — counts cannot detect update-in-place.
- [D5.8] Every `UNVERIFIED` carries `materiality:` (D-I).
- [D5.9] Document gate set passes.

**Test plan:** `bash evidence/D5-verify.sh` — fixture-header validation including the read-only
flag, recursive table-set diff (fails on structural drift), count comparison (reports, never fails),
`materiality:` check. Then `git diff --stat` and `npx tsc --noEmit`.

**Definition of done:** criteria checked, verify exits 0 on invariants, gates green, classifications
reviewer-approved, branch mergeable.

**Risks:** a zero-row table is weak evidence about behaviour — read the code path rather than
concluding from the count. Barely-exercised delivery paths are probably under-tested, which is a
finding for the next plan, not this one.

**Rollback:** delete the branch.

---

## Phase D6 — Scope decision memo and re-plan input pack

**One question:** given D1–D5, what are the options, what does each cost, and what must Brent decide?

**Scope** — `evidence/D6-scope-memo.md`, in a **fixed symmetric structure** so neutrality is partly
structural rather than purely tonal. Every option carries every heading, in the same order:

```
### Option <X> — <name>
- Surfaces touched:            (from D1)
- Stored fields/paths affected:(from D2a–D2d, as resolved pairs)
- Downstream tables affected:  (from D5)
- PII exposure introduced:     (from D3)
- Asset work implied:          (from D4)
- Estimated phases:            (n, at ≤10 files / ≤600 net lines — ESTIMATE, not measured)
- Human-dependency blockers:
- Original BLOCKING findings removed / reduced / intact: (B1–B11 by ID)
- Open questions this option leaves:
- Strongest argument against this option:
```

Options: **A — full feature** (English creation + duplication); **B — English creation only**. A
third is welcome if the evidence suggests one. Plus the questions only Brent can answer — known
already: the default English Bible translation, and the English liturgical texts for the canonical
elements in `src/data/elementos-fijos/`.

**Out of scope:** recommending an option (D-E); writing the feature plan; re-opening D-F.

**Acceptance criteria**
- [D6.1] Every option uses the template with every heading present and non-empty.
- [D6.2] Every claim traces to a D1–D5 evidence file by filename and section; an untraceable claim
  is removed or promoted to a new finding with its own command.
- [D6.3] All eleven original BLOCKING findings addressed by ID (B1–B11) under each option.
- [D6.4] Questions for Brent are numbered, each tagged with the phase it blocks, each answerable
  without reading the codebase — no question that a query could answer.
- [D6.5] The memo states which findings **surprised** the workstream — where reality differed from
  what the handoff or any review assumed. Highest-value output for the next planner.
- [D6.6] **Every fixture is refreshed before the verifiers run** — the MCP step re-runs each
  recorded query in a read-only transaction and rewrites provenance headers. `D6-verify.sh` fails on
  any fixture whose `captured_at` predates the D6 branch point. Draft 2 could pass against stale
  fixtures; this closes it.
- [D6.7] All **eight** verifiers exit 0, named explicitly so a missing one is visible:
  `D1-verify.sh`, `D2a-verify.sh`, `D2b-verify.sh`, `D2c-verify.sh`, `D2d-verify.sh`,
  `D4-verify.sh`, `D3-verify.sh`, `D5-verify.sh`. "D1–D5" is not an acceptable shorthand after
  the D2 split.
- [D6.8] **Every `UNVERIFIED` entry across all phases carries a reviewer-approved `materiality:`,
  and every `BLOCKS-D6` item is resolved or explicitly accepted by Brent** (D-I). An unclassified
  entry fails the phase.
- [D6.9] **External feasibility inventoried, not assumed:** Bible text redistribution and
  attribution rights for the ten frozen translations in stored slides and exports; availability and
  approval lead time for English WhatsApp templates.
- [D6.10] **Neutrality, in two parts.** (a) `D6-verify.sh` asserts structural symmetry — every
  option has every heading and a non-empty "strongest argument against". (b) A **fresh-context
  neutrality read** by Brent or an independent reviewer judges whether framing, ordering or
  omission advocates. Part (b) is explicitly **not** script-verifiable and this plan does not claim
  otherwise; executor self-rereading does not satisfy it.
- [D6.11] Document gate set passes.

**Test plan:** the fixture refresh (D6.6), then `bash evidence/D6-verify.sh` — runs all eight
verifiers and fails on any non-zero; checks fixture recency; checks every referenced evidence file
exists; greps for `B1`–`B11`; asserts structural symmetry; fails on any unclassified `UNVERIFIED`.
Then the D6.10(b) neutrality read, recorded. Then `git diff --stat` and `npx tsc --noEmit`.

**Definition of done:** criteria checked, `D6-verify.sh` exits 0 against freshly refreshed fixtures,
the neutrality read is done and recorded, no open `BLOCKS-D6`, and the memo is in front of Brent.
**This phase closes the workstream.** The next step is a fresh `/plan-new` for the feature, seeded
by the evidence pack — not a continuation of any session here.

**Risks:** D6.10 is the criterion most likely to be violated in good faith; the structural half
catches crude cases, the read catches the rest. Phase-count estimates are estimates, labelled in the
template, and are the number most likely to be quoted back as measured. If D1–D5 make both options
untenable, saying so is the correct output — a memo that manufactures two viable options because the
template has two slots is worse than one saying the shape is wrong.

**Rollback:** delete the branch. The decision is not made until Brent makes it.

---

## Appendix A — exact commands for the verified-state table (D-B)

```bash
# V6, V10 — census surfaces and the shell trap. Run under bash, not zsh.
bash -c "cd /Users/brentcurtis/dev/casa-pilot && find src -regex '.* [0-9]\.tsx?' | wc -l"   # -> 0
bash -c "cd /Users/brentcurtis/dev/casa-pilot && find -E src -regex '.* [0-9]\.tsx?' | wc -l" # -> 18
# V6n — the disputed line count, five ways, all agreeing at 596 for this file:
f=src/components/liturgia-builder/editors/CuentacuentoEditor.tsx
grep -cE '[áéíóúñüÁÉÍÓÚÑÜ¿¡]' "$f"; grep -E '[áéíóúñüÁÉÍÓÚÑÜ¿¡]' "$f" | wc -l
LC_ALL=C grep -cE '[áéíóúñüÁÉÍÓÚÑÜ¿¡]' "$f"; LC_ALL=en_US.UTF-8 grep -cE '[áéíóúñüÁÉÍÓÚÑÜ¿¡]' "$f"
grep -cE '[áéíóúñüÁÉÍÓÚÑÜ¿¡ºª«»]' "$f"
# V7, V8, V9
which psql; ls /Users/brentcurtis/dev/casa-pilot/node_modules | wc -l; npx tsc --noEmit; echo $?
```

```sql
-- V1
select (select count(*) from liturgias), (select count(*) from liturgia_elementos),
       (select count(distinct tipo) from liturgia_elementos);

-- V2 / V3 — normalized JSON paths. ONE recursive term: Postgres rejects two references
-- to the recursive CTE (error 42P19). Swap e.slides for e.config to get V3.
with recursive paths(path, val) as (
  select k, v from liturgia_elementos e, jsonb_each(e.slides) as t(k,v)
    where jsonb_typeof(e.slides)='object'
  union all
  select p.path || c.suffix, c.v from paths p cross join lateral (
    select '.'||t.k, t.v from jsonb_each(p.val) as t(k,v) where jsonb_typeof(p.val)='object'
    union all
    select '[]', t.v from jsonb_array_elements(p.val) as t(v) where jsonb_typeof(p.val)='array'
  ) c(suffix, v)
) select count(distinct path) from paths;

-- V4 — JSON columns outside liturgia_elementos
select table_name, column_name from information_schema.columns
where table_schema='public' and data_type='jsonb'
  and table_name in ('liturgias','liturgia_lecturas','liturgia_oraciones','cuentacuentos_drafts');

-- V5 — recursive FK closure
with recursive g(depth, tbl, path) as (
  select 1, conrelid::regclass::text, conrelid::regclass::text
  from pg_constraint where contype='f' and confrelid='public.liturgias'::regclass
  union all
  select g.depth+1, c.conrelid::regclass::text, g.path||' <- '||c.conrelid::regclass::text
  from g join pg_constraint c on c.confrelid = g.tbl::regclass
  where c.contype='f' and g.depth < 4 and c.conrelid::regclass::text <> g.tbl
) select depth, tbl, min(path) from g group by depth, tbl order by depth, tbl;
```

---

## Decision log

| Date | Decision | Rationale | Raised by |
|---|---|---|---|
| 2026-08-10 | Own plan root at `docs/plan/bilingue/` | shared ledger has two other workstreams appending | SOP §1.2 |
| 2026-08-10 | Discovery-only plan ending at a decision | every feature phase depends on an unanswered question | PM |
| 2026-08-10 | L2–L8 dropped; **L1 re-frozen as D-G** | disputed on the merits / never evidence-tested; L1 sound and D1 depends on it | reviews 1–2 |
| 2026-08-10 | D-F narrowed to generated devotional prose | blanket form contradicted re-fetch, human-select, recomposition | review 2 [S1] |
| 2026-08-10 | D-H fixes the PII classification in the plan | a census scoped by the definition it tests proves nothing | review 2 [B8] |
| 2026-08-10 | **D-I strengthened:** every `UNVERIFIED` carries reviewer-approved `materiality:` | executor-chosen blocking labels are circular | review 3 [R2-B5] |
| 2026-08-10 | **D-C tightened:** shell verifiers never touch the DB; every DB fact reaches a fixture through the MCP step with a provenance header | draft 2 stated the rule then let D3.10 and D5 violate it | review 3 [R2-B3] |
| 2026-08-10 | **Fixture provenance + mandatory D6 refresh** | D6 could pass against stale fixtures | review 3 [R2-B4] |
| 2026-08-10 | **Default + kind-keyed exceptions; every `(field, kind)` pair must resolve** | one disposition per field cannot express songs vs readings vs canonical text vs prose | review 3 [R2-B2] |
| 2026-08-10 | **D2d added** for `portadas_config`, `presentation_styles`, `tiempos`, `story` | draft 2 had no home for them; `presentation_styles` cannot be dispositioned atomically | review 3 [R2-B4/B2] |
| 2026-08-10 | **D4 now precedes D3** | D3 consumes D4's asset inventory; draft 2 had it backwards | review 3 [R2-B6] |
| 2026-08-10 | **Definition of done + Rollback restored on every phase** | draft 2's rewrite dropped them against the SOP skeleton | review 3 [R2-B7] |
| 2026-08-10 | **D-J: derived lists beat asserted lists; unions of live data and code declarations** | `blank-slide` exists in 7 files with 0 rows; four asserted facts were wrong across two drafts | PM, review 3 [R2-B1] |
| 2026-08-10 | **Census method frozen byte-for-byte before counting; no line total is load-bearing** | two reviewers cannot reproduce each other's count — that is the finding | review 3 [R2-S1] |
| 2026-08-10 | Brent authorised draft 3 past the §1.5 cap **and** directed that Codex review it | the reviewer caught 4 of 4 unverified assertions; the PM caught 0 | Brent |

---

## PRE-SUBMISSION SELF-REVIEW

**What I got wrong in draft 2, verified before accepting:**

- **[R2-B1]** `blank-slide` is supported across seven source files with zero production rows. My
  five-shape list came from data alone. This is the fourth asserted-without-checking fact across
  three drafts, and it is why D-J now exists.
- **[R2-B7]** The rewrite dropped Definition of done and Rollback from six phases. Mechanical
  regression against the SOP skeleton; restored on all nine.
- **[R2-B6]** I added the D3/D4 dependency backwards. D4 now precedes D3 and hands off an explicit
  asset list (D4.6) that D3 must consume in full (D3.6).
- **[R2-B3] / [R2-B8]** I wrote D-C honestly and then let two phases violate it, and cited
  abbreviated commands in a table whose own rule forbids that. Both closed: shell verifiers never
  touch the database, and Appendix A carries every command in full.
- **[B1], again.** I told Brent the reviewer's `find -regex` diagnosis was wrong because it returned
  18 for me. It does — under zsh. Under bash, which the script's shebang selects, it returns 0. I
  generalised from one shell while correcting an error of exactly that kind. V10 records it and D1.1
  requires the shell be pinned.

**The 596 vs 601 disagreement is unresolved and I have stopped trying to win it.** My number is
stable across five methods, two locales and a widened character class; no combining accents exist in
the file; all non-ASCII lines total 683. I cannot reproduce 601. Rather than assert either, V6n
records the disagreement as the finding and **no line total in this plan is load-bearing** — D1
freezes the method before counting.

**Where I am still guessing, labelled:**
- That six dispositions suffice. A field needing a seventh is a finding, not a criterion to bend.
- That the ~700-pair split trigger for D2b/D2c is set near the right place. It is a guess on a
  better-chosen quantity than draft 2's path count, but still a guess.
- That D2d's four columns fit one phase. `cuentacuentos_drafts.story` may need its own; the phase is
  told to split and report rather than truncate.
- That the D3.11(a) pattern scan is implementable without unacceptable false positives.

**Weakest part of this plan:** D6.10(b), the neutrality read. It is the one criterion no script can
close, and the plan now says so plainly instead of claiming full executability. Second weakest: the
`(field, kind)` coverage enumeration is the load-bearing new mechanism across four phases and has
never been run — if it turns out expensive to compute, four phases feel it at once.

**What I did not verify this draft:** whether `npm ci` succeeds in `casa-pilot`; the contents of the
90 `config` paths or D2d's four columns; whether `church_podcast_episodes` holds language-dependent
content; the Bible redistribution position. Each is assigned to the phase that needs it, and none is
asserted here.
