# PLAN — BILINGUE, discovery workstream

META
- REPO / ROOT: `casa-web`. Plan docs live on branch `pilot/sop-v2`, checked out at
  `/Users/brentcurtis/dev/casa-pilot`.
- PLAN ROOT: `docs/plan/bilingue/` — own `LEDGER.md`, `reviews/`, `evidence/`, `prompts/`.
  **Never write BILINGUE entries into `docs/plan/LEDGER.md`**; that file is shared by CUENTOS
  and MATERIALES and both are appending to it.
- BRANCH CONVENTION: `phase/<id>-<slug>`, base `pilot/sop-v2`, ≤20 chars (Vercel preview DNS).
- PLAN FROZEN: **NO — draft 2, 2026-08-10.** Draft 1 (`5ee2f17`) failed Codex plan review round 1
  with 10 BLOCKING (`reviews/BILINGUE-PLAN-review-2.md`). This draft answers all ten.
- SOP: `~/.claude/agent-workflow/AGENT-WORKFLOW.md` (canonical). Amendments:
  `docs/plan/SOP-PILOT.md` (C1–C4 active).
- SUPERSEDES: nothing. `docs/plan/PLAN-BILINGUE.md` failed review
  (`docs/plan/reviews/BILINGUE-PLAN-review-1.md`, 11 BLOCKING) and is retained as history only.
  **No phase, decision or estimate from that document is carried forward.**

---

## Goal

Produce the verified inventory that a bilingual-liturgy feature plan can be built on, and put the
scope decision in front of Brent with costs attached.

That is the whole goal. This plan **does not build the feature.** It ends at a decision point.

### Why this plan is discovery-only

The previous attempt was rejected for asserting facts nobody had checked — six of which were each
answerable by one query. Writing feature phases now would repeat that, because the phases depend on
answers nobody has: which surfaces emit stored output copy, what each field does on duplication,
where personal data flows, which images have text baked into their pixels, and what publishing a
second language does to the first.

**The scope decision — full feature vs English-creation-only — is made in D6 from D1–D5, not
before.** Roughly four of the eleven original blockers live in the duplication half, so narrowing
scope reduces the feature plan but does not remove the need for any discovery phase.

---

## Non-goals

- **Any source-code change.** Every phase touches `docs/plan/bilingue/**` and nothing else.
  A diff touching `src/`, `supabase/functions/` or `supabase/migrations/` is an automatic BLOCKING
  finding, whatever else it does.
- **Any schema change**, and any database write. Discovery is read-only.
- **Deciding scope.** D6 presents options with costs; Brent decides.
- **Choosing an i18n library, a translation provider, or a storage model.**
- **Writing the feature plan.** After D6, a fresh `/plan-new` drafts it from the evidence pack.

---

## Verified current state

Everything below carries the command or query that produced it, run on 2026-08-10 against
`pilot/sop-v2` and the live CASA project (`mulsqxfhxxdsadxsljss`). Facts corrected in round 2 are
marked ⚠ with what draft 1 got wrong.

### Schema

| Fact | Value | Query |
|---|---|---|
| `liturgias` has no language column | 16 columns | `information_schema.columns` |
| PII-bearing columns on `liturgias` | `celebrante` 21/30 non-null, `predicador` 29/30, `created_by` always | `count(*) filter (where … is not null)` |
| `liturgia_elementos` columns | 13, incl. `source_id`, `slides jsonb`, `edited_slides jsonb`, `config jsonb`, `custom_content text` | `information_schema.columns` |
| `published_resources` has no language column | 14 columns | `information_schema.columns` |
| One active published resource per type, **system-wide** | `CREATE UNIQUE INDEX idx_published_resources_active_unique ON published_resources (resource_type) WHERE (is_active = true)` | `select indexdef from pg_indexes where tablename='published_resources'` |
| `published_resources.resource_type` constrained | `CHECK (resource_type = ANY ('{cuentacuento,reflexion}'))` | `pg_get_constraintdef` |
| `liturgias` UPDATE policy has **no `WITH CHECK`** | `USING (auth.uid() = created_by)`, `with_check = null` | `pg_policies` |
| `music_songs` has no language column | 17 columns; `ccli_number`, `lyrics jsonb` | `information_schema.columns` |
| Nine **direct** FK children of `liturgias` | `liturgia_elementos`, `liturgia_lecturas`, `liturgia_oraciones`, `cuentacuentos_drafts`, `presentation_sessions` (CASCADE); `church_children_lessons`, `church_children_publication_state`, `church_podcast_episodes`, `music_publication_state` (SET NULL) | `pg_constraint where confrelid='public.liturgias'::regclass` |
| ⚠ **The reachable graph is 15 tables, not 9** — draft 1 stopped at depth 1 | +`church_children_calendar`, `church_children_lesson_materials`, `church_children_packet_deliveries`, `music_packet_deliveries` (depth 2); `church_children_attendance`, `church_children_session_assignments` (depth 3) | recursive CTE over `pg_constraint`, depth ≤4 — recorded in full in D5 |

`church_podcast_episodes` appears in no prior document.

### Data

| Fact | Value | Query |
|---|---|---|
| Liturgies · elements · distinct `tipo` · songs | 30 · 574 · 52 · 83 | `count(*)` / `count(distinct tipo)` |
| 52 decomposes to 18 + 32 + 2 | 18 fixed slugs at 30 rows each; 32 `custom-<uuid>` at 1 row each; `contenido-adicional` (1), `anuncio-adicional` (1) | `group by case when tipo like 'custom-%' …` |
| ⚠ **The 32 `custom-*` rows are five shapes, not one kind** — draft 1 asserted homogeneity it had not checked | `title-slide` 12 · `image-slide` 11 · `text-slide` 5 · `call-response` 2 · untyped 2 | `select coalesce(config->>'customType','(none)'), count(*) from liturgia_elementos where tipo like 'custom-%' group by 1` |
| `source_id` non-null | 142 | `count(*) where source_id is not null` |
| `slides` is a JSON **object**, not an array | 539/539 `jsonb_typeof='object'` | `select jsonb_typeof(slides), count(*) … group by 1` |
| `edited_slides` populated on **zero** rows | 0 | `count(*) where edited_slides is not null` |
| ⚠ **145 normalized JSON paths**, not the "11 config keys" draft 1 implied | `slides` 55 + `config` 90 | recursive CTE, single recursive term (see D2b) |
| `custom_content` is not used by `custom-*` types | 54 non-null rows, all `oracion-gratitud` / `oracion-invocacion` / `oracion-arrepentimiento` (18 each); zero `custom-*` | `count(*) filter (where custom_content is not null) group by tipo-group` |
| Related artifacts | children lessons 18 · children publication state 18 · lesson materials 18 · children packet deliveries 1 · music publication state 2 · music packet deliveries 0 · cuentacuentos drafts 3 · presentation sessions 0 · reflexion PDFs 2 · covers 15 | per-table `count(*)` |

### Code

| Fact | Value | Command |
|---|---|---|
| No i18n dependency of any kind | zero matches | `node -e` over `package.json` deps |
| Gate commands | `npx tsc --noEmit` · `npm run lint` · `npm test` (vitest) · `npm run build` (vite) · `npx playwright test` | `package.json` `scripts` |
| `npx tsc --noEmit` passes today | exit 0 | run in a checkout with deps |
| `/Users/brentcurtis/dev/casa-pilot` has **no `node_modules`** | 0 entries | `ls node_modules \| wc -l` |
| Builder creates through `ContextoTransversal` | `src/components/liturgia-builder/ContextoTransversal.tsx` (938 lines) | `find` |
| `LiturgiaForm` is a separate surface | `src/components/liturgia/LiturgiaForm.tsx` — antifonal-prayer flow | `find` |
| ⚠ Canonical texts are repo JSON: **6 content files + `index.json`** (7 files), 46 slides | `src/data/elementos-fijos/` — `la-paz`, `padre-nuestro`, `santa-cena`, `accion-de-gracias`, `ofrenda`, `bendicion-final` | `cat src/data/elementos-fijos/index.json` |
| PDF generators in the liturgy path | `lib/liturgia/exportService.ts` · `lib/cuentacuentos/storyPdfExporter.ts` · `lib/children-ministry/childrenLessonPdfExporter.ts` · `components/liturgia/SlideGenerator.tsx` | `grep -rln 'jsPDF\|jspdf'` |
| Music packet | `lib/music-planning/packetGenerationService.ts` + `supabase/functions/send-music-service-packet` | `grep` |
| **Cover generation bakes the preacher's name into pixels** | `Portadas.tsx:449` `subtitle: context.preacher`; `:458` `textBakedIn: true` | `grep -nE 'subtitle\|textBakedIn' src/components/liturgia-builder/Portadas.tsx` |
| `textBakedIn` honoured by compositor | `templateCompositor.ts:2067`; declared `types/shared/slide.ts:77` | `grep -rn 'textBakedIn'` |
| Orphan duplicate files (spaces in name) | 18 repo-wide; 8 inside census surfaces | `find -E src -regex '.* [0-9]\.tsx?'` |

### The string census

⚠ **Draft 1's census was wrong twice and the reviewer caught both.**

1. **The orphan exclusion silently failed.** `find … -not -regex '.* [0-9]\.tsx?'` works when run
   standalone but does not exclude inside the script's function; the census counted 8 orphan files
   it claimed to exclude. Verified by dumping the script's own file list: 21 files for
   `liturgia-builder`, against 19 from the same `find` run directly. The fix is to stop relying on
   `find -regex` dialect behaviour and filter the stream with `grep -vE`, which has no such
   ambiguity. **Corrected totals: 166 files / 1,402 copy-lines** (was 174 / 1,414).
2. **The metric was described backwards.** Draft 1 called accent-bearing lines an "upper bound on
   inspection cost". They are a **lower-bound candidate set**: `Guardar`, `Cancelar`, `Presentar`,
   `Error desconocido` are Spanish with no accent and are invisible to this heuristic. The census
   therefore *undercounts* and cannot be the sole sizing input.

```bash
#!/usr/bin/env bash
# docs/plan/bilingue/evidence/string-census.sh
# Lower-bound candidate set: NON-COMMENT lines bearing Spanish-only orthography.
# Orphan filtering is done with grep -vE on the stream — find -regex dialects differ.
set -euo pipefail
ACCENT='[áéíóúñüÁÉÍÓÚÑÜ¿¡]'
COMMENT='^[[:space:]]*(//|\*|/\*)'
ORPHAN=' [0-9]\.tsx?$'
TOT=0; TOTF=0
surface () {
  local name="$1"; shift
  local n=0 f=0
  while IFS= read -r file; do
    f=$((f+1)); n=$(( n + $(grep -E "$ACCENT" "$file" | grep -vcE "$COMMENT" || true) ))
  done < <(find "$@" -type f \( -name '*.ts' -o -name '*.tsx' \) \
             -not -path '*__tests__*' -not -name '*.test.*' 2>/dev/null \
           | grep -vE "$ORPHAN" | sort)
  TOT=$((TOT+n)); TOTF=$((TOTF+f))
  printf '%-32s files=%-4s copy-lines=%s\n' "$name" "$f" "$n"
}
surface "liturgia-builder"        src/components/liturgia-builder
surface "liturgia (antifonal)"    src/components/liturgia
surface "lib/liturgia"            src/lib/liturgia
surface "presentation components" src/components/presentation
surface "presentation lib+hooks"  src/lib/presentation src/hooks/presentation
surface "cuentacuentos lib"       src/lib/cuentacuentos
surface "children-ministry lib"   src/lib/children-ministry
surface "music-planning lib"      src/lib/music-planning
surface "edge: liturgy content"   supabase/functions/generate-story supabase/functions/refine-story \
        supabase/functions/generate-oraciones supabase/functions/generate-children-lesson \
        supabase/functions/refine-children-lesson supabase/functions/fetch-bible-passage \
        supabase/functions/process-reflexion-pdf
surface "edge: packets/notify"    supabase/functions/send-children-service-packet \
        supabase/functions/send-music-service-packet supabase/functions/wa-send \
        supabase/functions/wa-reminders
printf '%-32s files=%-4s copy-lines=%s\n' "TOTAL" "$TOTF" "$TOT"
```

Output on `pilot/sop-v2`, 2026-08-10:

| Surface | Files | Copy-lines |
|---|---:|---:|
| liturgia-builder | 19 | 439 |
| liturgia (antifonal) | 11 | 56 |
| lib/liturgia | 3 | 33 |
| presentation components | 43 | 153 |
| presentation lib+hooks | 16 | 25 |
| cuentacuentos lib | 15 | 75 |
| children-ministry lib | 11 | 24 |
| music-planning lib | 19 | 29 |
| edge: liturgy content | 25 | 567 |
| edge: packets/notify | 4 | 1 |
| **TOTAL** | **166** | **1,402** |

**Known gaps in this script**, which D1 must close: `supabase/functions/_shared/whatsapp/`,
`src/pages/ConstructorLiturgiasPage.tsx`, and the canonical JSON in `src/data/elementos-fijos/`
are all outside the surface list. The `.json` files are not covered by the `*.ts`/`*.tsx` filter at
all.

**Why the number still cannot size a phase alone.** Excluding comments changes the raw accent count
3× (2,728 → 1,402) because this codebase is commented in Spanish — in `CuentacuentoEditor.tsx`, 434
of 596 accent-bearing lines are comments. So any census that does not state its comment policy is
incomparable to any other, which is why the earlier "~362" and "396 + 120" cannot be reconciled with
each other or with this. And 567 of the 1,402 are edge-function AI prompts — generation
instructions, not extractable copy.

---

## Corrections to the handoff brief

One claim in the brief is contradicted by query, and is corrected here rather than worked around:

**"Every field that can hold personal data, including inside `custom_content`."** Correct that
`custom_content` matters, but not where implied: all 54 populated rows are on the three `oracion-*`
types and **zero** `custom-*` rows use it.

The brief's other framing — "a field-by-field translation matrix across all **52** distinct `tipo`
values" — is closer to right than draft 1 allowed. Draft 1 reduced 52 to "20 kinds plus one custom
rule" on an assumption it had not tested. The `custom-*` family is **five** shapes, so the matrix
is **25 rows minimum** (18 fixed + 2 stragglers + 5 custom shapes), and that is before the 145 JSON
paths are counted. See D2a–D2c.

Also worth stating: **`edited_slides` is populated on zero rows.** Whether that means "unused
feature" or "recently added" is D2a's to establish.

---

## Frozen architectural decisions

| # | Decision | Rationale |
|---|---|---|
| **D-A** | **No phase modifies source, schema or configuration, and no phase writes to the database.** Diffs are confined to `docs/plan/bilingue/**`. | Any code in the diff means the executor answered a question by changing the answer. |
| **D-B** | **Every numeric or structural claim carries the command or query that produced it, inline.** A claim without one is labelled `UNVERIFIED` in place. | This is the failure that sank both prior drafts. Making it frozen makes violating it BLOCKING. |
| **D-C** | **Verification is two mechanisms, and the plan claims only what each can do.** (1) `D<n>-verify.sh` mechanically diffs the evidence document against committed **JSON fixtures** under `evidence/fixtures/`, and re-runs all filesystem and grep claims. It exits non-zero on any mismatch. (2) Fixtures are refreshed from the database by re-running the recorded queries through the Supabase MCP — a documented manual step, because `psql` is not installed (`which psql` → not found) and a shell script cannot call an MCP. **The shell script proves the document matches its evidence; it does not prove the evidence matches the database.** That second link is a reviewer step, named as such. | Draft 1's D-C promised automation its own test plans could not perform — the reviewer's sharpest finding. Splitting the claim is the honest fix. |
| **D-D** | **Discovery records field paths, shapes and counts — never personal-data values**, in documents, fixtures, ledger entries or prompts. Examples are synthetic or redacted to shape. | Discovery reads exactly the fields the feature must protect. An evidence file quoting real values is read by every later agent. |
| **D-E** | **D1–D5 findings are descriptive, not prescriptive.** They record what is true and what the options cost. They do not choose. | A discovery phase that recommends gets its recommendation frozen without review. |
| **D-F** | Brent's product decisions stand: scope is liturgy output **and** builder UI; independent copies, no sync; language fixed at birth with duplication the only route to the other language; ten English Bible translations; English songs uploaded to the catalog, never machine-translated. **"Translate rather than regenerate" applies to generated devotional prose only** — not to Bible text (re-fetched in the target edition), canonical liturgical texts (curated), songs (re-selected), or assets (recomposed). | Decided 2026-08-10. The narrowing is round 2: the blanket form contradicted D2's own `re-fetch` and `human-select` dispositions and D4's recomposition outcomes. |
| **D-G** | **UI locale and liturgy content language are independent axes.** The operator's interface language and the liturgy's language are never coupled; either can be set without changing the other. | D1's whole taxonomy depends on this distinction, so leaving it unfrozen made the classification rest on an unstated product rule. The prior review found this sound as `L1`; it is the one decision from the failed plan worth carrying forward, and it is carried forward explicitly rather than by inheritance. |
| **D-H** | **The PII classification is fixed here, not chosen by an executor.** Personal data = any value identifying or contactable to a natural person: names (celebrant, preacher, presenter, volunteer, musician, member, podcast speaker), contact details (email, phone, WhatsApp number), auth/user identifiers (`created_by`, `published_by`, any `*_by`/`user_id`/`volunteer_id`/`musician_id`), free text authored by or about an identified person, and any of the above rendered into an asset or a log line. **Member PII never reaches a translation provider, an AI prompt, or a log.** | Draft 1 let D3 invent the definition during the census — the census would then be scoped by the definition it was meant to test. |
| **D-I** | **An unresolved fact that materially changes feasibility, scope, or phase count blocks D6.** `UNVERIFIED` is a legitimate output for a detail; it is not a legitimate output for anything that moves the scope decision. Each phase lists such facts under `BLOCKS-D6` in its report. | Draft 1 allowed every phase to mark itself Done with open `UNVERIFIED` rows, so the workstream could close without producing the verified inventory in its own goal. |

**Explicitly not carried forward:** L1–L8 from `docs/plan/PLAN-BILINGUE.md`, except L1, which is
re-frozen on its merits as D-G above.

---

## Phase index

| ID | Name | Status | Branch | Depends on |
|----|------|--------|--------|-----------|
| D1 | Output-surface inventory + two-method string census | TODO | `phase/d1-surfaces` | — |
| D2a | Stored-field contract: scalar columns, all liturgy tables | TODO | `phase/d2a-scalars` | D1 |
| D2b | `slides` schema: 55 paths × element kind | TODO | `phase/d2b-slides` | D2a |
| D2c | `config`, `custom_content` and the five `custom-*` shapes | TODO | `phase/d2c-config` | D2a |
| D3 | PII dataflow audit and translator boundary | TODO | `phase/d3-pii` | D1 |
| D4 | Asset reality — text baked into pixels | TODO | `phase/d4-assets` | D1, D3 |
| D5 | Downstream policy — the recursive 15-table graph | TODO | `phase/d5-downstream` | D1 |
| D6 | Scope decision memo and re-plan input pack | TODO | `phase/d6-scope` | D1–D5 |

**Parallelism:** D1 first. Then D2a, D3 and D5 in parallel; D2b and D2c both follow D2a and are
parallel to each other; D4 follows D3 (it cross-references the PII classification). D6 joins.

**"One architectural concern" for a discovery phase means one question answered.** Each phase below
answers exactly one and touches at most four files.

### The gate set for this workstream

No phase changes source, so the full project gate set does not apply and pretending it does would
be theatre. The **document gate set** is:

```bash
git diff --stat pilot/sop-v2...HEAD    # must show only docs/plan/bilingue/
bash docs/plan/bilingue/evidence/D<n>-verify.sh
npx tsc --noEmit                        # proves no source leaked into the diff
```

`npm run lint`, `npm test`, `npm run build` and Playwright are **deliberately excluded**: with a
zero-line source diff they re-test `pilot/sop-v2`, not the phase. `npx tsc --noEmit` is kept
precisely because it would catch a source file that leaked in.

`/Users/brentcurtis/dev/casa-pilot` has no `node_modules` (verified). The executor must run
`npm ci` there and run the gates **against the phase commit** — not in another checkout. If
`npm ci` cannot complete, that is a BLOCKED report, not a reason to run gates elsewhere.

---

## Phase D1 — Output-surface inventory + two-method string census

**One question:** which code paths emit user-visible text, and does each follow the *operator's*
locale (D-G) or the *liturgy's* language?

**Scope**
- `evidence/D1-surfaces.md` — every surface emitting user-visible text in the liturgy path: path,
  what it emits, who reads it, and the classification **UI copy** / **stored-or-output copy** /
  **generation instruction** (an AI prompt — neither).
- `evidence/string-census.sh` — the script above, committed, with the three known gaps closed
  (`_shared/whatsapp/`, `src/pages/ConstructorLiturgiasPage.tsx`, `src/data/elementos-fijos/*.json`).
- **A second census method**, because the accent heuristic is a lower bound: a Spanish-stopword and
  known-UI-verb pass (`Guardar`, `Cancelar`, `Presentar`, `Cerrar`, `Error`, `Buscar`, …) over the
  same file set. Both numbers reported; neither presented as *the* count.
- `evidence/D1-verify.sh`, `evidence/fixtures/D1-*.json`.

Surfaces known to exist and needing a row: celebrant guide (`lib/liturgia/exportService.ts`), story
PDF (`lib/cuentacuentos/storyPdfExporter.ts`), children-activity PDF
(`lib/children-ministry/childrenLessonPdfExporter.ts`), slide generator
(`components/liturgia/SlideGenerator.tsx`), music packet
(`lib/music-planning/packetGenerationService.ts` + `send-music-service-packet`), children packet
(`send-children-service-packet`), WhatsApp (`wa-send`, `wa-reminders`, `_shared/whatsapp/`),
presentation mode (43 components + 16 lib/hooks), the seven liturgy-content edge functions, and the
canonical JSON. A floor, not a ceiling.

**Out of scope**
- How any surface should be made bilingual (D-E). Classify and count only.
- Non-liturgy surfaces: financial, mesa, member-facing, RBAC admin.
- Fixing the 18 orphan `* N.tsx` duplicates. Record, leave.

**Acceptance criteria**
- [D1.1] Every surface above has a row, or the document states why it emits no copy.
- [D1.2] Every path in the document exists — `D1-verify.sh` exits non-zero on any miss.
- [D1.3] Every row is classified against D-G, with a one-line reason. No blank rows.
- [D1.4] Both census methods run from a clean checkout; both outputs pasted verbatim with the SHA.
- [D1.5] The three known gaps are closed, evidenced by the surface list diff before/after.
- [D1.6] The document states, near the numbers, that the accent method is a **lower bound** and why.
- [D1.7] Any surface whose classification would change the scope decision is listed under
  `BLOCKS-D6` (D-I), not left as a bare `UNVERIFIED` row.
- [D1.8] Document gate set passes; raw output pasted.

**Test plan**
- `bash evidence/D1-verify.sh` — asserts every path exists, re-runs both census methods, diffs
  totals against `fixtures/D1-census.json`. Exit 0 required.
- `git diff --stat pilot/sop-v2...HEAD`; `npx tsc --noEmit`.

**Definition of done:** criteria checked, verify exits 0, gates green, no open `BLOCKS-D6` item
left unlisted.

**Risks / unknowns**
- The presentation module (59 files) is genuinely ambiguous: it renders liturgy content inside an
  operator chrome. Expect rows that need both classifications; if the taxonomy cannot express that,
  add a category and say why.
- The stopword method will produce false positives (Spanish words in identifiers). Report precision
  informally rather than tuning until the number looks good.
- **Guess:** that three categories suffice. A surface fitting none is a finding worth having.

**Rollback:** delete the branch.

---

## Phase D2a — Stored-field contract: scalar columns, all liturgy tables

**One question:** for every scalar column a liturgy owns, what happens to it on duplication?

⚠ Draft 1 scoped D2 to `liturgia_elementos` alone and named `liturgia_lecturas` /
`liturgia_oraciones` only in passing. That is not a field-by-field contract.

**Scope** — `evidence/D2a-scalars.md`, one row per column across:
- `liturgias` — including `titulo`, `resumen`, `reflexion_texto`, `reflexion_pdf_url`,
  `portada_imagen_url`, `portadas_config`, `presentation_styles`, `celebrante`, `predicador`,
  `estado`, `porcentaje_completado`, `fecha`, timestamps, `created_by`
- `liturgia_elementos` scalars — `titulo`, `tipo`, `orden`, `status`, `source_id`, `custom_content`,
  timestamps, ids/FKs
- `liturgia_lecturas` — `cita`, `texto`, `version`, `orden`
- `liturgia_oraciones` — `tipo`, `tiempos`, `aprobada`

Each cell is one of: **translate** · **re-fetch** · **copy verbatim** · **clear** ·
**human-select** · **regenerate**. Plus `evidence/D2a-verify.sh` and fixtures.

**Out of scope:** JSON interiors of `slides` (D2b) and `config`/`custom_content` (D2c). Designing
the copy mechanism, transaction or RPC (D-E).

**Acceptance criteria**
- [D2a.1] The column list is re-derived by query into `fixtures/D2a-columns.json`; the document is
  diffed against it. A column in one and not the other fails the verify.
- [D2a.2] Every column has exactly one disposition or `UNVERIFIED` + the question. No blanks.
- [D2a.3] The `source_id` contract is stated with the join that proves it, **run fresh** — 142
  non-null rows, expected to resolve to `music_songs.slug` plus `cuentacuentos` ids. Do not inherit.
- [D2a.4] `edited_slides`'s disposition accounts for zero population **and** states whether code
  reads it, with the grep.
- [D2a.5] Every **clear** carries a one-line reason. A bare "clear" is not a finding.
- [D2a.6] `portadas_config` and `presentation_styles` are dispositioned, not deferred as "JSON".
- [D2a.7] No personal-data value anywhere (D-D).
- [D2a.8] Scope-moving unknowns listed under `BLOCKS-D6` (D-I).
- [D2a.9] Document gate set passes.

**Test plan:** `bash evidence/D2a-verify.sh` (column-list diff, disposition-vocabulary check, no
blank cells); `git diff --stat`; `npx tsc --noEmit`.

**Risks:** the six dispositions are my taxonomy, not one the codebase implies; a field needing a
seventh is a finding. `tiempos` is jsonb on a table I have only counted (3 rows) — it may belong in
D2b instead, and moving it is correct behaviour if so.

**Depends on:** D1.

---

## Phase D2b — `slides` schema: 55 paths × element kind

**One question:** what is in the `slides` object, and what happens to each path on duplication?

**Scope** — `evidence/D2b-slides.md`: the 55 normalized `slides` paths (verified by the recursive
CTE below), each dispositioned, and each attributed to the element kinds that use it. Plus
`evidence/D2b-verify.sh` and `fixtures/D2b-paths.json`.

The path enumeration query, which must be re-run rather than trusted — note the **single**
recursive term, since Postgres rejects two references to the recursive CTE:

```sql
with recursive paths(path, val) as (
  select k, v from liturgia_elementos e, jsonb_each(e.slides) as t(k,v)
    where jsonb_typeof(e.slides)='object'
  union all
  select p.path || c.suffix, c.v from paths p cross join lateral (
    select '.'||t.k, t.v from jsonb_each(p.val) as t(k,v) where jsonb_typeof(p.val)='object'
    union all
    select '[]', t.v from jsonb_array_elements(p.val) as t(v) where jsonb_typeof(p.val)='array'
  ) c(suffix, v)
) select count(distinct path) from paths;   -- 55 on 2026-08-10
```

**Out of scope:** `config` and `custom_content` (D2c); scalar columns (D2a); the copy mechanism.

**Acceptance criteria**
- [D2b.1] All 55 paths present; the set is re-derived into the fixture and diffed. Drift in the
  path count is reported with the new number, not silently absorbed.
- [D2b.2] Each path carries a disposition from the D2a vocabulary, or `UNVERIFIED` + the question.
- [D2b.3] Paths holding text are distinguished from paths holding ids, URLs, ordering or styling —
  this is the distinction the whole matrix exists to make.
- [D2b.4] Image/asset paths are cross-referenced to D4 by path name.
- [D2b.5] Paths that appear in only some element kinds say which, with the query.
- [D2b.6] No personal-data value anywhere (D-D).
- [D2b.7] Scope-moving unknowns listed under `BLOCKS-D6`.
- [D2b.8] Document gate set passes.

**Test plan:** `bash evidence/D2b-verify.sh` (path-set diff against fixture, vocabulary check);
`git diff --stat`; `npx tsc --noEmit`.

**Risks:** 55 paths × 25 kinds is a large grid if filled densely. If most paths are kind-independent
the document should be organised by path with kind exceptions noted, not as a full cross-product —
choosing that shape is the executor's call and should be stated up front. If the grid still exceeds
one session, split by top-level `slides` key and report it.

**Depends on:** D2a (for the disposition vocabulary).

---

## Phase D2c — `config`, `custom_content`, and the five `custom-*` shapes

**One question:** what is in `config` and `custom_content`, and are the `custom-*` rows one thing
or several?

⚠ This phase exists because draft 1 asserted the 32 `custom-*` rows were one homogeneous kind
without looking. They are five shapes: `title-slide` 12, `image-slide` 11, `text-slide` 5,
`call-response` 2, and 2 rows with no `customType`.

**Scope** — `evidence/D2c-config.md`: the 90 normalized `config` paths (same recursive query,
`e.config` in place of `e.slides`), each dispositioned; the `custom_content` contract for the 54
`oracion-*` rows; and a per-shape rule for each of the five `custom-*` shapes plus the two untyped
rows. Plus `evidence/D2c-verify.sh` and fixtures.

**Out of scope:** `slides` (D2b); scalar columns (D2a); the copy mechanism.

**Acceptance criteria**
- [D2c.1] All 90 `config` paths present; re-derived into the fixture and diffed.
- [D2c.2] The five `custom-*` shapes each have a rule; the two untyped rows are accounted for
  explicitly, not folded into a shape they do not declare.
- [D2c.3] The shape breakdown is re-derived by the recorded query, not typed.
- [D2c.4] `custom_content`'s contract states what the 54 `oracion-*` rows hold structurally — shape
  only, no values (D-D).
- [D2c.5] Every path and rule carries a disposition or `UNVERIFIED` + the question.
- [D2c.6] Paths that are ids, URLs or styling are marked **copy verbatim** with the reason.
- [D2c.7] Scope-moving unknowns listed under `BLOCKS-D6`.
- [D2c.8] Document gate set passes.

**Test plan:** `bash evidence/D2c-verify.sh` (path-set and shape-set diffs, vocabulary check);
`git diff --stat`; `npx tsc --noEmit`.

**Risks:** the two untyped `custom-*` rows may be data corruption rather than a shape. Either
answer is fine; asserting the convenient one is not. 90 paths is the larger half of D2 — if it runs
long, split at the top-level `config` key and report.

**Depends on:** D2a.

---

## Phase D3 — PII dataflow audit and translator boundary

**One question:** where does personal data *flow*, and what must never leave the system?

⚠ Draft 1 asked only "which fields hold PII" and let the executor define the term. D-H now fixes the
definition, and this phase follows values rather than listing columns.

**Scope** — `evidence/D3-pii.md`:
- **Field census** — every column across the 15 reachable tables (D5's graph) plus `liturgias`,
  triaged against D-H's definition. Free text flagged as unbounded, with populated-row counts.
- **Dataflow** — for each PII-bearing field, where its value can travel: AI prompts, translation
  providers, email, WhatsApp, PDFs, images, logs, derived records. This is the part draft 1 missed.
- **Translator boundary** — every field bucketed **sendable** / **never** / **redact-first**, with
  a reason each. Descriptive (D-E): the constraint, not its enforcement design.
- `evidence/D3-verify.sh`, fixtures.

Known starting facts: `celebrante` 21/30, `predicador` 29/30, `created_by` always; `custom_content`
free text on 54 `oracion-*` rows; `Portadas.tsx:449` writes `context.preacher` into cover **pixels**
— PII in an asset, which no column-level census finds.

**Out of scope:** designing redaction, placeholders or provider selection. Non-liturgy PII.

**Acceptance criteria**
- [D3.1] Column list for all 16 tables re-derived into a fixture and diffed against the triage.
- [D3.2] Every column triaged against **D-H's** definition; the document quotes D-H rather than
  restating it in the executor's own words.
- [D3.3] Free-text fields identified with populated-row counts.
- [D3.4] The announcement path (`Anuncios.tsx`, `anuncios` / `anuncio-adicional`) covered — it is
  unbounded operator-authored text.
- [D3.5] The dataflow section covers, per PII field: AI prompts, translation providers, email,
  WhatsApp, PDFs, images, logs, derived records. A destination not applicable is stated as such.
- [D3.6] The baked-into-pixels case recorded with file:line, and **D3 owns this cross-reference**
  (D4 records the asset fact; D3 owns the PII reading of it).
- [D3.7] Every field bucketed sendable / never / redact-first, with a reason. None unbucketed.
- [D3.8] Prompt-injection surface noted: which free-text fields reach an AI prompt, since
  operator-authored text becomes model input.
- [D3.9] **Existing violations of D-H are reported immediately as `BLOCKS-D6`, not filed.** If a
  current prompt already receives `celebrante` or `predicador`, that predates this work and Brent
  needs to know during the phase, not at D6.
- [D3.10] **Leak check:** `D3-verify.sh` reads PII values from the database at run time, greps the
  plan tree for them, stores nothing, and exits non-zero on any hit. It covers names, emails and
  phone numbers across all triaged fields — not only celebrant and preacher. If it cannot be
  implemented without persisting a value, the executor reports BLOCKED and proposes an alternative
  rather than embedding one.
- [D3.11] Document gate set passes.

**Test plan:** `bash evidence/D3-verify.sh` (column-list diff, bucket completeness, leak check);
`git diff --stat`; `npx tsc --noEmit`.

**Risks:** D3.10 is awkward by construction — a leak check for real names must not record them.
The intended shape is read-from-DB-at-runtime, grep, discard. Phone numbers may live in JSON paths
rather than columns, so the field census alone will not find them; the dataflow pass is what
catches that.

**Depends on:** D1.

---

## Phase D4 — Asset reality: text baked into pixels

**One question:** which images carry text in their pixels, and what does the generator do?

**Scope** — `evidence/D4-assets.md`: every image-bearing surface in the liturgy path; per surface,
where the image comes from, whether text is composited into pixels or overlaid at render, and how
many existing assets are affected. The cover generator characterised from code. Plus
`evidence/D4-verify.sh` and fixtures.

Starting facts: `Portadas.tsx` sets `textBakedIn: true` at 327, 436, 458, with `subtitle: seasonName`
at 427 and `subtitle: context.preacher` at 449. `templateCompositor.ts:2067` branches on the flag;
`slide.ts:77` declares it; `GraphicsGeneratorV2.tsx:348` defaults it to `true`. 15/30 liturgies have
a `portada_imagen_url`. The prior review reported 60 cover elements with images and 30 with
`textBakedIn=true` — **re-derive, do not inherit.**

**Out of scope:** designing a fix (D-E). Non-liturgy image pipelines. Creating, regenerating or
deleting any asset. The PII reading of baked-in names — that is D3.6.

**Acceptance criteria**
- [D4.1] Every image-bearing surface has a row with its source path.
- [D4.2] The baked-in-text asset count re-derived by recorded query into a fixture; not inherited.
- [D4.3] Generator behaviour described with file:line refs that `D4-verify.sh` confirms still
  contain the cited symbol — matched within a ±10-line window, not an exact line, so an unrelated
  edit upstream does not fail the phase.
- [D4.4] Per surface: does producing the same asset in another language require regeneration,
  recomposition, or nothing?
- [D4.5] Story covers and liturgy covers distinguished — different pipelines.
- [D4.6] The `subtitle: context.preacher` fact is recorded and **handed to D3**, which owns its PII
  classification.
- [D4.7] Read-only confirmed: no asset created, modified or deleted. If storage-object counts
  cannot be read, the document states why and the claim is `UNVERIFIED` — a count alone would not
  prove it anyway, since update-in-place preserves counts.
- [D4.8] Scope-moving unknowns listed under `BLOCKS-D6`.
- [D4.9] Document gate set passes.

**Test plan:** `bash evidence/D4-verify.sh` (windowed symbol assertions, asset-count fixture diff);
`git diff --stat`; `npx tsc --noEmit`.

**Risks:** whether a cover with baked Spanish text is *acceptable* on an English liturgy is a taste
question. D4 records the fact; Brent decides at D6. I do not know whether images live in Supabase
Storage, an external CDN, or both — which is why D4.7 has an explicit escape.

**Depends on:** D1, D3 (D4.6 hands off to D3's classification).

---

## Phase D5 — Downstream policy: the recursive 15-table graph

**One question:** what happens to everything hanging off a liturgy when a second liturgy in another
language exists?

⚠ Draft 1 stopped at depth 1. The reachable graph is 15 tables.

**Scope** — `evidence/D5-downstream.md`: one row per table in the recursive FK closure of
`liturgias` (depth ≤4, verified: 9 direct + `church_children_calendar`,
`church_children_lesson_materials`, `church_children_packet_deliveries`, `music_packet_deliveries`
at depth 2; `church_children_attendance`, `church_children_session_assignments` at depth 3), plus
`published_resources` (no FK, keyed by `liturgy_id`). Per row: depth and path from `liturgias`,
current count, delete behaviour, whether it holds language-dependent content, and the disposition
options — **copy / translate / detach / clear** — with cost and consequence. Options, not a choice
(D-E). Plus `evidence/D5-verify.sh` and fixtures.

The closure query is recorded in the document; the verify script diffs the document's table list
against `fixtures/D5-graph.json`.

**Out of scope:** designing language-aware uniqueness or writing a migration. Choosing dispositions.
Notification *copy* (that is D1).

**Acceptance criteria**
- [D5.1] The table list is the **recursive** closure, re-derived into the fixture and diffed. A
  table in the graph but not the document fails the verify.
- [D5.2] Each row states depth and the FK path from `liturgias`.
- [D5.3] `church_podcast_episodes` included with its row count — it appears in no prior document.
- [D5.4] Each row states count, delete behaviour, and language-dependence, each with its query.
- [D5.5] Each row lists ≥2 dispositions with consequences; a single-option row says why.
- [D5.6] The `published_resources` conflict described concretely: what a user sees today, and what
  they would see if an English resource were activated. **Stated as observed behaviour or labelled
  `UNVERIFIED`** — never inferred from the index definition alone, and never established by
  publishing a test resource against production (D-A wins).
- [D5.7] **Read-only is proven by mechanism, not by counts.** The phase runs its queries in a
  read-only transaction (`SET TRANSACTION READ ONLY`) or under a read-only role, and says which.
  Counts are recorded as timestamped observations, not invariants.
- [D5.8] **Drift handling is explicit:** structural claims (table set, FK paths, delete behaviour)
  are invariants and fail the verify on change; row counts are observations and are reported with
  both values, never failing the verify. This is why D6.6 can require exit 0 without a legitimate
  production insert blocking the workstream.
- [D5.9] Scope-moving unknowns listed under `BLOCKS-D6`.
- [D5.10] Document gate set passes.

**Test plan:** `bash evidence/D5-verify.sh` — diffs the recursive table set against the fixture
(fails on structural drift), re-runs counts and prints old-vs-new without failing.
`git diff --stat`; `npx tsc --noEmit`.

**Risks:** `presentation_sessions` is at 0 rows and cascades; a zero count is weak evidence about
behaviour, so read the code path rather than concluding from the count. `music_packet_deliveries` 0
and `church_children_packet_deliveries` 1 mean those paths are barely exercised and probably
under-tested — a finding for the next plan.

**Depends on:** D1.

---

## Phase D6 — Scope decision memo and re-plan input pack

**One question:** given D1–D5, what are the scope options, what does each cost, and what does Brent
need to decide?

**Scope** — `evidence/D6-scope-memo.md`, in a **fixed symmetric structure** so that neutrality is
partly structural rather than purely a matter of tone. Every option gets the same headings, in the
same order, and no option may have a heading the others lack:

```
### Option <X> — <name>
- Surfaces touched:            (list, from D1)
- Stored fields affected:      (count, from D2a–D2c)
- Downstream tables affected:  (count, from D5)
- PII exposure introduced:     (from D3)
- Asset work implied:          (from D4)
- Estimated phases:            (n, at ≤10 files / ≤600 net lines — ESTIMATE, not measured)
- Human-dependency blockers:   (list)
- Original BLOCKING findings removed / reduced / intact: (B1–B11 by ID)
- Open questions this option leaves:
- Strongest argument against this option:
```

Options: **A — full feature** (English creation + duplication); **B — English creation only**.
A third is welcome if the evidence suggests one. Plus: the questions only Brent can answer, each
tagged with the option and phase it blocks — known already are the default English Bible translation
and the English liturgical texts for the six canonical elements in `src/data/elementos-fijos/`.
Plus `evidence/D6-verify.sh`.

**Out of scope:** recommending an option (D-E). Writing the feature plan. Re-opening D-F.

**Acceptance criteria**
- [D6.1] Every option uses the template above with every heading present and non-empty.
- [D6.2] Every claim traces to a D1–D5 evidence file by filename and section. An untraceable claim
  is removed or promoted to a new finding with its own command.
- [D6.3] All eleven original BLOCKING findings addressed by ID (B1–B11) under each option.
- [D6.4] Questions for Brent are numbered, each with the phase it blocks, each answerable without
  reading the codebase — no question is asked that a query could answer.
- [D6.5] The memo states which findings **surprised** the workstream — where reality differed from
  what the handoff or either prior review assumed. Highest-value output for the next planner.
- [D6.6] `D1`–`D5` verify scripts all exit 0 at D6's commit. Per D5.8 this tests structural
  invariants only, so ordinary production drift does not block.
- [D6.7] **Every `BLOCKS-D6` item raised by D1–D5 is resolved or explicitly accepted by Brent**
  (D-I). An open one blocks the phase.
- [D6.8] **External feasibility is inventoried, not assumed:** Bible text redistribution and
  attribution rights for the ten frozen translations in stored slides and exports; availability and
  approval lead time for English WhatsApp templates. Both affect cost and feasibility even though
  implementation is out of scope.
- [D6.9] **Neutrality:** the memo recommends nothing. Checked in two parts — (a) `D6-verify.sh`
  asserts structural symmetry: every option has every heading, and the "strongest argument against"
  section is non-empty for each; (b) a **fresh-context human or reviewer read** judges whether the
  framing, ordering or omissions advocate. Part (b) is explicitly **not** script-verifiable, and
  this plan does not claim otherwise.
- [D6.10] Document gate set passes.

**Test plan:** `bash evidence/D6-verify.sh` — runs D1–D5's verifiers in sequence and fails on any
non-zero; checks every referenced `evidence/D*.md` exists; greps for `B1`–`B11`; asserts the
structural symmetry in D6.9(a). Then the D6.9(b) neutrality read, by Brent or a fresh reviewer.
`git diff --stat`; `npx tsc --noEmit`.

**Definition of done:** criteria checked, `D6-verify.sh` exits 0, the neutrality read is done and
recorded, and the memo is in front of Brent. **This phase closes the workstream.** The next step is
a fresh `/plan-new` for the feature, seeded by the evidence pack.

**Risks / unknowns**
- D6.9 is the criterion most likely to be violated in good faith: presenting two options with honest
  costs makes one look better, and "presenting" drifts into "advocating" gradually. The structural
  half catches the crude cases; the read catches the rest. Executor self-rereading is self-grading
  and does not count.
- The phase-count estimates in D6.1 are estimates, labelled as such in the template, and are the
  number most likely to be quoted back as though measured.
- If D1–D5 make both options untenable, saying so is the correct output. A memo that manufactures
  two viable options because the template has two slots is worse than one that says the shape is
  wrong.

**Depends on:** D1–D5, all complete and merged.

---

## What this plan does not cover, and why that is not a missing phase

Judged against the goal — the inventory and the decision — D1–D6 are complete, and round 1's
reviewer agreed the discovery-only boundary is sound.

Against the *feature*, this plan is missing everything the first review named: builder language
propagation, DB immutability enforcement, canonical text integration, English Bible parsing,
content-locale output, notification localisation, cover handling, language-aware publication, the
duplication split, related-artifact policy, and the end-to-end matrix. **Deliberately absent** —
each depends on an answer D1–D5 produces.

The four gaps round 1's reviewer identified *within* the narrower goal are now closed by splitting
rather than by new top-level phases: the complete stored-field contract is D2a–D2c; the recursive
downstream graph is D5; the PII dataflow audit is D3; external feasibility is D6.8.

---

## Decision log

| Date | Decision | Rationale | Raised by |
|---|---|---|---|
| 2026-08-10 | BILINGUE gets its own plan root at `docs/plan/bilingue/` | The shared `docs/plan/LEDGER.md` has two other workstreams appending to it | SOP §1.2 |
| 2026-08-10 | Discovery-only plan, ending at a decision | Every feature phase depends on an unanswered question | PM |
| 2026-08-10 | L2–L8 not carried forward; **L1 re-frozen as D-G** | Two were disputed on the merits; L1 was found sound and D1's taxonomy depends on it | PM, per reviews 1 and 2 |
| 2026-08-10 | D-B/D-C: every claim carries its command; verification is two named mechanisms | Draft 1's D-C promised automation its test plans could not perform | Codex review 2 [B6] |
| 2026-08-10 | D-D: record shapes and counts, never personal-data values | Discovery reads exactly the fields the feature must protect | PM |
| 2026-08-10 | D-E: D1–D5 describe, never prescribe | A discovery phase that recommends gets it frozen without review | PM |
| 2026-08-10 | **D-F narrowed:** "translate not regenerate" applies to generated devotional prose only | The blanket form contradicted re-fetch, human-select and recomposition | Codex review 2 [S1] |
| 2026-08-10 | **D-G:** UI locale and content language are independent axes | D1's taxonomy rested on an unstated product rule | Codex review 2 [S2] |
| 2026-08-10 | **D-H:** the PII classification is fixed in the plan, not chosen by an executor | A census scoped by the definition it was meant to test | Codex review 2 [B8] |
| 2026-08-10 | **D-I:** scope-moving unknowns block D6; `UNVERIFIED` is for details only | Draft 1 could close without producing the inventory in its own goal | Codex review 2 [B9] |
| 2026-08-10 | **D2 pre-split into D2a/D2b/D2c** | 145 JSON paths against a ~40 split trigger — known blown before the phase starts | Codex review 2 [B3] |
| 2026-08-10 | **The `custom-*` family is five shapes, not one kind** — draft 1's "20 kinds" correction retracted | `title-slide` 12 · `image-slide` 11 · `text-slide` 5 · `call-response` 2 · untyped 2 | Codex review 2 [B2], verified |
| 2026-08-10 | **Document-only gate set defined and justified** | Running the full suite on a zero-line source diff re-tests the base branch, not the phase | Codex review 2 [S4] |

---

## PRE-SUBMISSION SELF-REVIEW (pilot C2, applied to planning)

**Round 2 changed the plan substantially. What I got wrong in draft 1, verified myself before
accepting:**

- **[B1] My own census was broken in the way I was criticising.** The orphan exclusion silently
  failed inside the script — 21 files where the same `find` run directly gives 19. Corrected to
  166/1,402 and rewritten to filter with `grep -vE`. I also had the metric backwards: accent-bearing
  lines are a *lower* bound, not an upper one. The reviewer's stated cause (that the command
  "returns no files") is not what I observed — it returns 18 standalone — but the conclusion and
  the corrected numbers are exactly right, and the mechanism is now one without dialect ambiguity.
- **[B2] I asserted the 32 `custom-*` rows were one kind while my own risk section said I had not
  looked.** That contradiction is the same failure that sank the first plan. Verified: five shapes.
- **[B3] 145 JSON paths against my ~40 split trigger.** I counted 11 *top-level* config keys and let
  that imply the surface was small. D2 is now pre-split three ways.
- **[B5] I stopped at depth 1 of the FK graph.** 15 tables, not 9.
- **[B6] D-C promised shell verification of database facts a shell script cannot reach.** Rewritten
  to claim only what each mechanism does: fixtures make document↔evidence mechanical; evidence↔DB
  is a named manual MCP step.
- **[B7] D5's drift handling contradicted D6.6.** Now split into invariants (fail) and observations
  (report), which resolves it without weakening either.

**Where I did not simply defer:** on the CuentacuentoEditor detail the review says 434 of 601; I
measure 434 of 596 and the 596 stands. It changes nothing.

**Remaining honest weaknesses:**
- **D6.9 is still not fully mechanical, and the plan now says so** rather than claiming every
  criterion is executable. Structural symmetry is checkable; framing is not. This is the likeliest
  place to lose a round.
- **D2b's 55 paths × 25 kinds** could still be too large. The phase is told to choose an
  organisation up front and to split by top-level key if it runs long, rather than truncating.
- **D3.10's leak check** is awkward by construction and may come back BLOCKED. That is an acceptable
  outcome; embedding a real value to make it pass is not.
- **Guesses, labelled:** that six dispositions suffice; that three surface categories suffice; that
  the two untyped `custom-*` rows are meaningful rather than corrupt; that D5.6 can be established
  without a production write.

**What I did not verify this round:** whether `npm ci` succeeds in `casa-pilot`; the contents of the
90 `config` paths; whether `church_podcast_episodes` holds language-dependent content; the Bible
redistribution rights position. Each is assigned to the phase that needs it.
