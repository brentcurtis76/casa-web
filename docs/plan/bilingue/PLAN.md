# PLAN — BILINGUE, discovery workstream

META
- REPO / ROOT: `casa-web`. Plan docs live on branch `pilot/sop-v2`, checked out at
  `/Users/brentcurtis/dev/casa-pilot`.
- PLAN ROOT: `docs/plan/bilingue/` — own `LEDGER.md`, `reviews/`, `evidence/`, `prompts/`.
  **Never write BILINGUE entries into `docs/plan/LEDGER.md`**; that file is shared by CUENTOS
  and MATERIALES and both are appending to it.
- BRANCH CONVENTION: `phase/<id>-<slug>`, base `pilot/sop-v2`, ≤20 chars (Vercel preview DNS).
- PLAN FROZEN: **NO — draft 1, 2026-08-10.** Awaiting Codex plan review (SOP §3.2).
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

The previous attempt was not rejected for bad judgement. It was rejected for asserting facts
nobody had checked — six of which were each answerable by one query. Writing feature phases now
would repeat that, because the phases depend on answers nobody has: which surfaces emit stored
output copy, what each field does on duplication, where personal data sits, which images have
text baked into their pixels, and what publishing a second language does to the first.

The reviewer's first missing phase was a discovery/contract phase. This is it, sized into six.

**The scope decision — full feature vs English-creation-only — is made in D6 from D1–D5, not
before.** Roughly four of the eleven blockers live in the duplication half, so narrowing scope
reduces the feature plan but does not remove the need for any of D1–D5.

---

## Non-goals

- **Any source-code change.** Every phase here touches `docs/plan/bilingue/**` and nothing else.
  A diff that touches `src/`, `supabase/functions/` or `supabase/migrations/` is an automatic
  BLOCKING finding, whatever else it does.
- **Any schema change.** No migration is written, applied or drafted in this workstream.
- **Deciding scope.** D6 presents options with costs; Brent decides.
- **Choosing an i18n library, a translation provider, or a storage model.** Those are the next
  plan's decisions and they depend on findings that do not exist yet.
- **Writing the feature plan.** After D6, a fresh `/plan-new` session drafts it from the evidence
  pack. Continuing this conversation into that draft would carry over its assumptions.

---

## Verified current state

Everything below was produced by the listed command or query on 2026-08-10 against branch
`pilot/sop-v2` and the live CASA project (`mulsqxfhxxdsadxsljss`). Nothing here is recalled or
estimated. Rows marked **UNVERIFIED** are labelled inline and are not used for sizing.

### Schema

| Fact | Value | Query |
|---|---|---|
| `liturgias` has no language column | 16 columns, none language-related | `select column_name from information_schema.columns where table_name='liturgias'` |
| PII-bearing columns on `liturgias` | `celebrante` (21/30 non-null), `predicador` (29/30), `created_by` | `select count(*) filter (where celebrante is not null), count(*) filter (where predicador is not null) from liturgias` |
| `liturgia_elementos` columns | 13: incl. `source_id varchar`, `slides jsonb`, `edited_slides jsonb`, `config jsonb`, `custom_content text` | `information_schema.columns` |
| `published_resources` has no language column | 14 columns | `information_schema.columns` |
| **One active published resource per type, system-wide** | `CREATE UNIQUE INDEX idx_published_resources_active_unique ON published_resources (resource_type) WHERE (is_active = true)` | `select indexdef from pg_indexes where tablename='published_resources'` |
| `published_resources.resource_type` is constrained | `CHECK (resource_type = ANY ('{cuentacuento,reflexion}'))` | `pg_get_constraintdef` on `published_resources` |
| `liturgias` UPDATE policy has **no `WITH CHECK`** | `USING (auth.uid() = created_by)`, `with_check = null` | `select cmd, qual, with_check from pg_policies where tablename='liturgias'` |
| `music_songs` has no language column | 17 columns; has `ccli_number`, `lyrics jsonb` | `information_schema.columns` |
| **Nine** tables carry an FK to `liturgias` | `liturgia_elementos`, `liturgia_lecturas`, `liturgia_oraciones`, `cuentacuentos_drafts`, `presentation_sessions` (all `ON DELETE CASCADE`); `church_children_lessons`, `church_children_publication_state`, `church_podcast_episodes`, `music_publication_state` (all `ON DELETE SET NULL`) | `select conrelid::regclass, pg_get_constraintdef(oid) from pg_constraint where contype='f' and confrelid='public.liturgias'::regclass` |

The `published_resources` unique index is **stricter than the review characterised it.** It is not
one active resource per type per liturgy — it is one per type across the entire system. Publishing
an English cuentacuento would deactivate the Spanish one globally, for every user.

`church_podcast_episodes` is a ninth FK child that appears in no prior document.

### Data

| Fact | Value | Query |
|---|---|---|
| Liturgies | 30 | `select count(*) from liturgias` |
| Elements | 574 | `select count(*) from liturgia_elementos` |
| Distinct `tipo` | 52 | `select count(distinct tipo) from liturgia_elementos` |
| **52 decomposes to 18 + 32 + 2** | 18 fixed slugs at exactly 30 rows each; 32 `custom-<uuid>` slugs at 1 row each; `contenido-adicional` (1) and `anuncio-adicional` (1) | `select case when tipo like 'custom-%' then '(custom-*)' else tipo end, count(*), count(distinct tipo) from liturgia_elementos group by 1` |
| `source_id` non-null | 142 | `select count(*) from liturgia_elementos where source_id is not null` |
| `slides` is a JSON **object**, not an array | 539/539 rows `jsonb_typeof='object'` | `select jsonb_typeof(slides), count(*) from liturgia_elementos where slides is not null group by 1` |
| `edited_slides` is populated on **zero** rows | 0 | `select count(*) from liturgia_elementos where edited_slides is not null` |
| `config` populated | 80 rows, 11 distinct top-level keys | `select count(distinct k) from liturgia_elementos e, jsonb_object_keys(e.config) k where jsonb_typeof(e.config)='object'` |
| **`custom_content` is not used by `custom-*` types** | 54 non-null rows, all on `oracion-gratitud` (18), `oracion-invocacion` (18), `oracion-arrepentimiento` (18). Zero `custom-*` rows have it. | `select case when tipo like 'custom-%' then '(custom-*)' else tipo end, count(*) filter (where custom_content is not null) from liturgia_elementos group by 1` |
| Related artifacts | children lessons 18 · children publication state 18 · children lesson materials 18 · children packet deliveries 1 · music publication state 2 · music packet deliveries 0 · cuentacuentos drafts 3 · presentation sessions 0 · liturgies with a reflexion PDF 2 · with a cover image 15 | per-table `count(*)` |
| Songs | 83 | `select count(*) from music_songs` |

### Code

| Fact | Value | Command |
|---|---|---|
| No i18n dependency of any kind | zero matches in `dependencies` + `devDependencies` | `node -e "const p=require('./package.json');const a={...p.dependencies,...p.devDependencies};console.log(Object.keys(a).filter(k=>/i18n\|intl\|local\|lang\|translat/i.test(k)))"` |
| Gate commands | `npx tsc --noEmit` · `npm run lint` (eslint) · `npm test` (vitest) · `npm run build` (vite) · `npx playwright test` | `package.json` `scripts` |
| `npx tsc --noEmit` passes clean today | exit 0, no output | run in `/Users/brentcurtis/dev/casa-web` |
| **`/Users/brentcurtis/dev/casa-pilot` has no `node_modules`** | 0 entries | `ls node_modules \| wc -l` |
| Builder creates through `ContextoTransversal` | `src/components/liturgia-builder/ContextoTransversal.tsx` (938 lines) | `find src -name 'ContextoTransversal*'` |
| `LiturgiaForm` is a separate surface | `src/components/liturgia/LiturgiaForm.tsx` — the antifonal-prayer flow | `find src -name 'LiturgiaForm*'` |
| Canonical liturgical texts are **repo JSON, not a table** | `src/data/elementos-fijos/` — 6 files (`la-paz`, `padre-nuestro`, `santa-cena`, `accion-de-gracias`, `ofrenda`, `bendicion-final`), 46 slides total, Spanish `content` strings | `cat src/data/elementos-fijos/index.json` |
| PDF generators in the liturgy path | `src/lib/liturgia/exportService.ts` · `src/lib/cuentacuentos/storyPdfExporter.ts` · `src/lib/children-ministry/childrenLessonPdfExporter.ts` · `src/components/liturgia/SlideGenerator.tsx` | `grep -rln 'jsPDF\|jspdf' src supabase --include='*.ts' --include='*.tsx'` |
| Music packet is generated server-side | `src/lib/music-planning/packetGenerationService.ts`; delivery via `supabase/functions/send-music-service-packet` (606 lines) | `grep -rln 'packet' src --include='*.ts' \| grep -i music` |
| **Cover generation bakes the preacher's name into the image** | `Portadas.tsx:449` sets `subtitle: context.preacher`, `:458` sets `textBakedIn: true` | `grep -nE 'subtitle\|textBakedIn' src/components/liturgia-builder/Portadas.tsx` |
| `textBakedIn` is honoured by the compositor | `src/components/graphics/templateCompositor.ts:2067`; declared at `src/types/shared/slide.ts:77` | `grep -rn 'textBakedIn' src --include='*.ts' --include='*.tsx'` |
| Presentation module exists and is large | 47 components + 18 lib/hooks files | `find src -ipath '*presentation*' -name '*.ts*'` |
| Orphan duplicate files with spaces in the name | `UniversalSlide 2.tsx`, `UniversalSlide 3.tsx`, `PresenterView 2/3/4.tsx`, `SlidePreview 2.tsx`, `types 2/3.ts` | `find src -regex '.* [0-9]\.tsx?'` — excluded from every count below |

### The string census

The previous plan's "~362" was an unreproducible regex estimate; the review's "396 plus 120" was
a different unreproducible count. Neither can size a phase. This is the command, and it is
committed as D1's first deliverable so the number can be re-derived and diffed.

```bash
#!/usr/bin/env bash
# docs/plan/bilingue/evidence/string-census.sh
# Counts NON-COMMENT lines bearing Spanish-only orthography, per surface.
# Excludes tests and the orphan " N.tsx" duplicate copies.
set -euo pipefail
ACCENT='[áéíóúñüÁÉÍÓÚÑÜ¿¡]'
COMMENT='^[[:space:]]*(//|\*|/\*)'
TOT=0; TOTF=0
surface () {
  local name="$1"; shift
  local n=0 f=0
  while IFS= read -r file; do
    f=$((f+1))
    n=$(( n + $(grep -E "$ACCENT" "$file" | grep -vcE "$COMMENT" || true) ))
  done < <(find "$@" -type f \( -name '*.ts' -o -name '*.tsx' \) \
             -not -path '*__tests__*' -not -name '*.test.*' \
             -not -regex '.* [0-9]\.tsx?' 2>/dev/null | sort)
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
| liturgia-builder | 21 | 449 |
| liturgia (antifonal) | 11 | 56 |
| lib/liturgia | 3 | 33 |
| presentation components | 47 | 155 |
| presentation lib+hooks | 18 | 25 |
| cuentacuentos lib | 15 | 75 |
| children-ministry lib | 11 | 24 |
| music-planning lib | 19 | 29 |
| edge: liturgy content | 25 | 567 |
| edge: packets/notify | 4 | 1 |
| **TOTAL** | **174** | **1,414** |

**What this number is, and is not.** It is a line-level *inspection cost* — an upper bound on the
lines a human or agent must read. It is **not** a count of translatable strings: a line may hold
none (a Spanish identifier) or several. Two things it exposes:

- **Excluding comments changes the answer by 3×.** The raw accent-line count is 2,728; the
  codebase is commented in Spanish. In `CuentacuentoEditor.tsx` alone, 434 of 596 accent-bearing
  lines are comments. Any census that does not state its comment policy is not comparable to any
  other census, which is why the two prior numbers cannot be reconciled.
- **567 of the 1,414 are edge-function AI prompts**, concentrated in `generate-story` (169),
  `refine-children-lesson` (151), `generate-children-lesson` (95), `refine-story` (61). These are
  not UI strings and are not "translated" — they are generation instructions needing a language
  parameter or a second reviewed prompt. Classifying them as extractable copy would be a
  category error, and it is the largest single block in the census.

---

## Corrections to the handoff brief

Two claims in the brief are contradicted by the queries above. Recorded here because acting on
either would mis-size a phase.

1. **"A field-by-field translation matrix across all 52 distinct `tipo` values — not the 18 fixed
   ones."** 52 is the correct count of distinct slugs, but 32 of them are single-row
   `custom-<uuid>` values — one kind, 32 instances — and 2 more are one-row stragglers
   (`contenido-adicional`, `anuncio-adicional`) that no prior document names. The matrix needs
   **20 kind rows plus one rule for the `custom-*` family**, not 52 rows. D2 is sized on 20.

2. **"Every field that can hold personal data, including inside `custom_content`."** Correct that
   `custom_content` matters, but not where the brief implies: all 54 populated rows are on the
   three `oracion-*` types, and **zero** `custom-*` rows use it. D3 looks in the prayer editors.

Also worth stating because it inverts an assumption: **`edited_slides` is populated on zero rows.**
The column exists and is read by code, but no production liturgy has ever used it. Whether that
means "unused feature" or "recently added" is D2's to establish — it is not evidence of either yet.

---

## Frozen architectural decisions

No phase may violate these without a Decision Log entry. They are deliberately few: this plan
decides how discovery is done, not how the feature works.

| # | Decision | Rationale |
|---|---|---|
| **D-A** | **No phase in this workstream modifies source, schema, or configuration.** Diffs are confined to `docs/plan/bilingue/**`. | The output is an inventory. Any code in the diff means the executor answered a question by changing the answer. |
| **D-B** | **Every numeric or structural claim carries the command or query that produced it, inline, in a fenced block.** A claim without one is not a finding; it is a guess, and must be labelled `UNVERIFIED` in place. | This is the single failure that sank the previous plan. Making it a frozen decision makes violating it a BLOCKING finding rather than a style note. |
| **D-C** | **Every phase ships a `D<n>-verify.sh` that re-derives its shell-checkable numbers and exits non-zero on drift.** SQL-derived claims instead carry the query verbatim plus its raw result, re-runnable by any session with the Supabase MCP. | Turns "is this document true?" into a command the reviewer runs, instead of a judgement call. `psql` is not installed on this machine (`which psql` → not found), so shell and SQL claims are verified by different mechanisms; pretending otherwise would give a verify script that cannot run. |
| **D-D** | **Discovery records field paths, shapes and counts — never personal-data values.** Where an example is needed it is synthetic or redacted to shape (`"<nombre>, <nombre> y 3 más"`). No `celebrante`, `predicador`, member name, phone or email value is written into any evidence file, ledger entry or prompt. | Discovery reads exactly the fields the feature must protect. CASA's hard rule is that member PII never enters AI prompts; an evidence file that quotes real values is read by every later agent, which is the same exposure with extra steps. |
| **D-E** | **Findings are descriptive, not prescriptive.** A discovery document records what is true and what the options are with their costs. It does not choose an approach, freeze a decision, or specify an implementation. | A discovery phase that recommends is a planning phase wearing a disguise, and its recommendation gets frozen without review. Design decisions belong to the next plan, after Codex has seen the evidence. |
| **D-F** | Brent's product decisions stand and are not re-litigated: scope is liturgy output **and** builder UI; translate existing content rather than regenerate; independent copies with no sync; language fixed at birth with duplication the only route to the other language; ten English Bible translations (NIV, KJV, NKJV, ESV, NLT, NASB, NRSVCE, MSG, AMP, WEB); English songs uploaded to the catalog, never machine-translated. | Decided 2026-08-10. Discovery may report a cost or a conflict these create — that is D6 material — but may not reverse one. |

**Explicitly not carried forward:** L1–L8 from `docs/plan/PLAN-BILINGUE.md`. The reviewer disputed
L4 and L6 on the merits and the rest were never tested against evidence. The next plan re-derives
its own decisions from D1–D5. Re-freezing them here would launder unreviewed choices through a
document that was never meant to hold them.

---

## Phase index

| ID | Name | Status | Branch | Depends on |
|----|------|--------|--------|-----------|
| D1 | Output-surface inventory + committed string census | TODO | `phase/d1-surfaces` | — |
| D2 | Element and field translation matrix | TODO | `phase/d2-matrix` | D1 |
| D3 | Personal-data census and translator boundary | TODO | `phase/d3-pii` | D1 |
| D4 | Asset reality — text baked into pixels | TODO | `phase/d4-assets` | D1 |
| D5 | Downstream record policy — publication and the nine FK children | TODO | `phase/d5-downstream` | D1 |
| D6 | Scope decision memo and re-plan input pack | TODO | `phase/d6-scope` | D1–D5 |

**D2, D3, D4 and D5 are independent of one another** and can run in parallel worktrees once D1
fixes the surface vocabulary. They read disjoint things: D2 the element schema, D3 the personal-data
fields, D4 the image pipeline, D5 the related tables. They share only D1's classification.

**"One architectural concern" for a discovery phase means one question answered.** The sizing rule
is not being dodged: each phase below answers exactly one, and none touches more than three files.

### Operational note for every phase

`/Users/brentcurtis/dev/casa-pilot` has **no `node_modules`** (verified: `ls node_modules | wc -l`
→ 0). Gate commands cannot run there until `npm ci` completes. Since no phase here changes source,
the executor may instead run the gates in a checkout that already has dependencies — but must say
which checkout it used and paste the real output. An unrun gate reported as passing is a BLOCKING
finding.

---

## Phase D1 — Output-surface inventory + committed string census

**One question:** which code paths emit user-visible text, and does each follow the *operator's*
locale or the *liturgy's* language?

**Scope**
- `docs/plan/bilingue/evidence/D1-surfaces.md` — every surface that emits user-visible text in the
  liturgy path, one row each: path, what it emits, who reads it, and the classification
  **UI copy** (follows operator locale) / **stored-or-output copy** (follows liturgy language) /
  **generation instruction** (an AI prompt — neither).
- `docs/plan/bilingue/evidence/string-census.sh` — the script from this plan, committed verbatim,
  extended to cover any surface the inventory finds that it currently misses.
- `docs/plan/bilingue/evidence/D1-verify.sh`.

Surfaces already known to exist and needing a row, from the verification above: celebrant guide
(`src/lib/liturgia/exportService.ts`), story PDF (`src/lib/cuentacuentos/storyPdfExporter.ts`),
children-activity PDF (`src/lib/children-ministry/childrenLessonPdfExporter.ts`), slide generator
(`src/components/liturgia/SlideGenerator.tsx`), music packet
(`src/lib/music-planning/packetGenerationService.ts` +
`supabase/functions/send-music-service-packet`), children packet
(`supabase/functions/send-children-service-packet`), WhatsApp (`supabase/functions/wa-send`,
`wa-reminders`, `_shared/whatsapp/`), presentation mode (47 components + 18 lib/hooks), and the
seven liturgy-content edge functions. This list is a floor, not a ceiling.

**Out of scope**
- Any judgement about *how* a surface should be made bilingual. Classify and count only (D-E).
- Non-liturgy surfaces: financial, mesa, member-facing pages, RBAC admin.
- Fixing the orphan `* N.tsx` duplicates. Record them, leave them.
- Changing the census methodology to make a number look better.

**Acceptance criteria**
- [D1.1] Every surface listed above has a row, or the document states why it does not emit copy.
- [D1.2] Every row carries a file path that exists: `bash evidence/D1-verify.sh` checks each path
  and exits non-zero on any miss.
- [D1.3] Every row is classified UI copy / stored-or-output copy / generation instruction, with a
  one-line reason. No row is unclassified; an uncertain row is classified `UNVERIFIED` with the
  specific question that would settle it.
- [D1.4] `string-census.sh` runs from a clean checkout and prints a total; its output is pasted
  verbatim into `D1-surfaces.md` with the commit SHA it was run against.
- [D1.5] The census covers every surface in the inventory classified UI copy or
  stored-or-output copy. A surface in the inventory but not the census is a defect.
- [D1.6] The document states the census's comment policy and its known limitation (a line is not
  a string), in its own words, near the number.
- [D1.7] `git diff --stat` shows changes only under `docs/plan/bilingue/`.
- [D1.8] Gates pass and the raw output is pasted: `npx tsc --noEmit`, `npm run lint`, `npm test`.

**Test plan**
- `bash docs/plan/bilingue/evidence/D1-verify.sh` — asserts every path in `D1-surfaces.md` exists,
  re-runs `string-census.sh`, and diffs its total against the recorded one. Exit 0 required.
- `git diff --stat pilot/sop-v2...HEAD` — asserts the D1.7 confinement.
- `npx tsc --noEmit && npm run lint && npm test` in a checkout with dependencies installed.

**Definition of done:** all criteria checked, `D1-verify.sh` exits 0, gates green, branch mergeable.

**Risks / unknowns**
- The inventory may be materially larger than the floor above. The presentation module alone is 65
  files and no prior document accounted for it. If the surface count exceeds ~40 rows, D1 should
  split at the module boundary rather than run long — say so in the report rather than truncating.
- Classification of the presentation module is genuinely ambiguous: it renders liturgy content
  (stored copy) inside an operator chrome (UI copy). Expect `UNVERIFIED` rows there; that is the
  correct output, not a failure.
- I am guessing that "UI copy / stored-or-output copy / generation instruction" is a sufficient
  taxonomy. If a surface fits none, the executor should add a category and say why.

**Rollback:** delete the branch. Nothing outside the plan tree was touched.

**Depends on:** nothing.

---

## Phase D2 — Element and field translation matrix

**One question:** for each element kind, what happens to each of its fields when a liturgy is
copied into the other language?

**Scope**
- `docs/plan/bilingue/evidence/D2-field-matrix.md` — a matrix with **20 kind rows** (the 18 fixed
  slugs, plus `contenido-adicional` and `anuncio-adicional`) plus **one rule for the `custom-*`
  family**, and one column per field: `titulo`, `tipo`, `source_id`, `status`, `custom_content`,
  and each JSON path inside `slides` and `config`.
- Each cell is one of: **translate** · **re-fetch** (get the target-language edition from source)
  · **copy verbatim** (identifiers, URLs, ordering) · **clear** (must not carry over) ·
  **human-select** (a person chooses; no automatic answer exists).
- `docs/plan/bilingue/evidence/D2-verify.sh`.

Starting facts, verified: `slides` is a JSON **object** on all 539 populated rows, not an array —
the enumeration is over object paths. `edited_slides` is populated on zero rows. `config` has 11
distinct top-level keys across 80 rows. `custom_content` is populated on 54 rows, all
`oracion-*`. `source_id` is non-null on 142 rows; the review established these are 116 song slugs
joining `music_songs.slug` plus 26 cuentacuentos ids — **re-verify that join rather than inheriting
it**, since it is the fact the previous plan got most wrong in the other direction.

**Out of scope**
- Designing the copy mechanism, the transaction, or the RPC. Matrix only (D-E).
- Deciding whether duplication ships at all — that is D6.
- The `liturgia_lecturas` / `liturgia_oraciones` tables' own rows beyond naming which columns exist
  and their disposition; their Bible-edition re-fetch design belongs to the next plan.
- Quoting any real `custom_content` value (D-D).

**Acceptance criteria**
- [D2.1] All 20 kind rows present; the kind list is re-derived by the recorded query, not typed.
- [D2.2] The `custom-*` family has one stated rule and evidence for why one rule suffices — or,
  if the 32 rows are not homogeneous, a documented breakdown and a rule per group.
- [D2.3] Every cell holds exactly one of the five dispositions, or `UNVERIFIED` plus the question.
  No cell is blank.
- [D2.4] Every JSON path in the matrix is re-derived by a recorded query whose raw output is pasted.
- [D2.5] The `source_id` contract is stated with the join that proves it, run fresh.
- [D2.6] `edited_slides`'s disposition accounts for its being unpopulated, and states whether code
  reads it (with the grep that shows so).
- [D2.7] Cells marked **clear** carry a one-line reason. This is the column that silently breaks
  things, so a bare "clear" is not a finding.
- [D2.8] No real personal-data value appears anywhere in the document (D-D).
- [D2.9] `git diff --stat` shows changes only under `docs/plan/bilingue/`.
- [D2.10] Gates pass; raw output pasted.

**Test plan**
- `bash docs/plan/bilingue/evidence/D2-verify.sh` — re-derives the 20-kind list and the JSON path
  set, diffs against the matrix, and fails on any row or path present in one and not the other.
- A grep asserting no cell is blank and every cell value is in the allowed set of six.
- `git diff --stat pilot/sop-v2...HEAD`; `npx tsc --noEmit && npm run lint && npm test`.

**Definition of done:** all criteria checked, verify exits 0, gates green, branch mergeable.

**Risks / unknowns**
- **The largest unknown in this workstream:** whether the 32 `custom-*` rows are homogeneous. I did
  not look inside them — 32 distinct slugs, one row each, and `custom_content` is null on all of
  them, so their text is somewhere in `slides` or `titulo` and I have not established where. If
  they turn out to be heterogeneous, D2.2 becomes several rules and the phase may need splitting.
- **Split trigger, stated in advance:** if the enumerated JSON path set exceeds ~40 paths, split
  into D2a (scalar columns + `custom_content` + `source_id`) and D2b (`slides` / `config` paths)
  rather than running long. Deciding this mid-phase and reporting it is correct behaviour.
- `config`'s 11 keys are counted, not read. Their meaning is unestablished.
- The five dispositions are my taxonomy, not one the codebase implies. A field needing a sixth is a
  finding worth having; add it and say why.

**Rollback:** delete the branch.

**Depends on:** D1 (for the UI-copy vs stored-copy vocabulary the disposition column relies on).

---

## Phase D3 — Personal-data census and translator boundary

**One question:** where can personal data reach, and what must never leave the system?

**Scope**
- `docs/plan/bilingue/evidence/D3-pii.md` — every field in the liturgy path that can hold personal
  data: table, column, JSON path where relevant, what kind of data, how many rows hold it today,
  and whether it is free text (unbounded) or structured (bounded).
- A stated **translator boundary**: the fields that may be sent to a translation provider, the
  fields that must never be, and the fields that require redaction first — as a list, with the
  reason for each. This is a description of the constraint, not a design for enforcing it (D-E).
- `docs/plan/bilingue/evidence/D3-verify.sh`.

Starting facts, verified: `liturgias.celebrante` non-null on 21/30, `liturgias.predicador` on
29/30, `liturgias.created_by` always. `custom_content` is free text on 54 `oracion-*` rows.
`Portadas.tsx:449` writes `context.preacher` into a cover image as baked-in pixels — personal data
in an asset, not a column, which no field-level census would find.

**Out of scope**
- Designing redaction, placeholder substitution, or provider selection. The next plan does that.
- Auditing non-liturgy PII (members, finance, mesa).
- Writing any real value into the document, the ledger, or a prompt (D-D — this phase is where
  that rule is most likely to be broken).

**Acceptance criteria**
- [D3.1] Every column across the nine FK-child tables and `liturgias` is triaged as
  personal-data-bearing or not; the column list is re-derived by query, not typed.
- [D3.2] Free-text fields are identified as such, with the count of populated rows.
- [D3.3] The announcement path (`Anuncios.tsx`, `anuncios` / `anuncio-adicional` elements) is
  covered specifically — it is unbounded operator-authored text.
- [D3.4] The baked-into-image case is recorded, with the file and line.
- [D3.5] The translator boundary lists every field in one of three buckets — sendable / never /
  redact-first — with a one-line reason each. No field is unbucketed.
- [D3.6] **No real personal-data value appears in the document.** Verified by a grep for the
  celebrant and preacher values present in the database returning zero hits in the plan tree; the
  grep is recorded in `D3-verify.sh` in a form that does not itself embed a value.
- [D3.7] Prompt-injection surface is noted: which of these free-text fields would reach an AI
  prompt, since operator-authored text becomes model input.
- [D3.8] `git diff --stat` shows changes only under `docs/plan/bilingue/`.
- [D3.9] Gates pass; raw output pasted.

**Test plan**
- `bash docs/plan/bilingue/evidence/D3-verify.sh` — re-derives the column list, diffs against the
  triage table, and runs the D3.6 leak check. Exit 0 required.
- `git diff --stat pilot/sop-v2...HEAD`; `npx tsc --noEmit && npm run lint && npm test`.

**Definition of done:** all criteria checked, verify exits 0 including the leak check, gates green.

**Risks / unknowns**
- **D3.6 is awkward to implement without defeating itself** — a leak check that greps for real
  names must not record those names. The intended shape is a script that reads the values from the
  database at run time and greps the plan tree for them, storing nothing. If the executor cannot
  do that safely, it should say so and propose an alternative rather than embedding values.
- I have not established whether any current AI prompt already receives `celebrante` or
  `predicador`. D3.7 may find an existing violation of CASA's hard rule that predates this work.
  That would be a finding worth raising immediately, not filing.
- "Personal data" has no formal definition in this repo. The executor should state the one it used.

**Rollback:** delete the branch.

**Depends on:** D1.

---

## Phase D4 — Asset reality: text baked into pixels

**One question:** which images in the liturgy path carry text in their pixels, and what does the
generator do on every new one?

**Scope**
- `docs/plan/bilingue/evidence/D4-assets.md` — every image-bearing surface in the liturgy path;
  for each: where the image comes from, whether text is composited into the pixels or overlaid at
  render time, and how many existing assets are affected.
- The cover generator's behaviour characterised from the code: what it bakes, when, and what the
  `textBakedIn` flag changes downstream.
- `docs/plan/bilingue/evidence/D4-verify.sh`.

Starting facts, verified: `Portadas.tsx` sets `textBakedIn: true` at lines 327, 436 and 458, with
`subtitle: seasonName` at 427 and `subtitle: context.preacher` at 449.
`templateCompositor.ts:2067` branches on the flag. `slide.ts:77` declares it. `GraphicsGeneratorV2.tsx`
defaults `textBakedIn` to `true` (line 348). 15 of 30 liturgies have a `portada_imagen_url`. The
previous review reported 60 cover elements with images, 30 with `textBakedIn=true` — **re-derive
that, do not inherit it.**

**Out of scope**
- Designing a fix — text-free art plus overlays, regeneration, or anything else (D-E).
- Non-liturgy image pipelines (financial, mesa, member-facing).
- Generating, regenerating or deleting any asset.

**Acceptance criteria**
- [D4.1] Every image-bearing surface in the liturgy path has a row with its source path.
- [D4.2] The count of existing assets with baked-in text is re-derived by a recorded query whose
  raw output is pasted; it is not inherited from the prior review.
- [D4.3] The generator's baking behaviour is described with file and line references that
  `D4-verify.sh` confirms still exist and still match.
- [D4.4] The document states, per surface, whether producing the same asset in another language
  requires regeneration, recomposition, or nothing.
- [D4.5] Story covers and liturgy covers are distinguished — they are different pipelines.
- [D4.6] The personal-data-in-pixels case (`subtitle: context.preacher`) is cross-referenced to D3.
- [D4.7] No asset is created, modified or deleted: `D4-verify.sh` asserts the storage object count
  is unchanged, or the document states why that check is not possible.
- [D4.8] `git diff --stat` shows changes only under `docs/plan/bilingue/`.
- [D4.9] Gates pass; raw output pasted.

**Test plan**
- `bash docs/plan/bilingue/evidence/D4-verify.sh` — asserts each cited file:line still contains the
  cited symbol (grep with line anchor), and re-runs the asset counts.
- `git diff --stat pilot/sop-v2...HEAD`; `npx tsc --noEmit && npm run lint && npm test`.

**Definition of done:** all criteria checked, verify exits 0, gates green.

**Risks / unknowns**
- Line-anchored assertions break on any unrelated edit to those files. If `pilot/sop-v2` moves
  under the phase, D4.3 should assert on symbol presence within a window rather than exact line.
- I do not know whether images live in Supabase Storage, an external CDN, or both. D4.7's
  feasibility depends on that, which is why it has an explicit escape.
- Whether a cover with baked Spanish text is *acceptable* on an English liturgy is a taste
  question, not a technical one. D4 records the fact; Brent decides in D6.

**Rollback:** delete the branch.

**Depends on:** D1.

---

## Phase D5 — Downstream record policy: publication and the nine FK children

**One question:** what happens to everything hanging off a liturgy when a second liturgy in another
language exists?

**Scope**
- `docs/plan/bilingue/evidence/D5-downstream.md` — one row per FK child of `liturgias` (nine
  verified) plus `published_resources` (which has no FK but is keyed by `liturgy_id`), stating for
  each: current row count, delete behaviour, whether it holds language-dependent content, and the
  disposition options on duplication — **copy / translate / detach / clear** — with the cost and
  consequence of each. Options, not a choice (D-E).
- The `published_resources` uniqueness behaviour characterised precisely, including what happens
  today when a second resource of the same type is activated.
- `docs/plan/bilingue/evidence/D5-verify.sh`.

Starting facts, verified: the nine FK children and their delete behaviours are in the table above.
`idx_published_resources_active_unique` is `UNIQUE (resource_type) WHERE is_active = true` — one
active resource per type **system-wide**, and `resource_type` is CHECK-constrained to
`cuentacuento` and `reflexion`. Counts: children lessons 18, children publication state 18,
children lesson materials 18 (indirect), children packet deliveries 1, music publication state 2,
music packet deliveries 0, cuentacuentos drafts 3, presentation sessions 0, podcast episodes
unqueried.

**Out of scope**
- Designing a language-aware uniqueness scheme or writing a migration (D-A, D-E).
- Choosing dispositions. Enumerate options with costs; D6 and Brent choose.
- The children/music notification *copy* — that is D1's inventory, not this phase.

**Acceptance criteria**
- [D5.1] All nine FK children plus `published_resources` have a row; the FK list is re-derived by
  the recorded `pg_constraint` query, not typed.
- [D5.2] `church_podcast_episodes` is included and its row count established — it appears in no
  prior document.
- [D5.3] Each row states current count, delete behaviour, and whether it holds language-dependent
  content, each with its query.
- [D5.4] Each row lists at least two dispositions with a stated consequence; a row with one option
  states why no alternative exists.
- [D5.5] The `published_resources` conflict is described concretely: what a user sees today, and
  what they would see if an English resource were activated. Stated as observed behaviour or
  labelled `UNVERIFIED` — not inferred from the index definition alone.
- [D5.6] Tables reachable only indirectly (e.g. `church_children_lesson_materials` via
  `church_children_lessons`) are included, with the join that reaches them.
- [D5.7] No row is written, updated or deleted in any table: the document states that the phase was
  read-only and `D5-verify.sh` re-runs the counts to show they are unchanged.
- [D5.8] `git diff --stat` shows changes only under `docs/plan/bilingue/`.
- [D5.9] Gates pass; raw output pasted.

**Test plan**
- `bash docs/plan/bilingue/evidence/D5-verify.sh` — re-derives the FK child list and diffs against
  the document's rows; fails on any table in one and not the other.
- The counts in D5.3 re-run and compared; drift is reported, not silently updated (this is a live
  system and drift is information).
- `git diff --stat pilot/sop-v2...HEAD`; `npx tsc --noEmit && npm run lint && npm test`.

**Definition of done:** all criteria checked, verify exits 0, gates green.

**Risks / unknowns**
- `presentation_sessions` is at 0 rows today and cascades on delete. A zero count is weak evidence
  about behaviour; the executor should read the code path rather than conclude from the count.
- D5.5 asks for observed behaviour, which may require exercising the publish path. If that cannot
  be done without writing a row, D5.7 wins and the claim is labelled `UNVERIFIED` — do not
  publish a test resource against production to satisfy a criterion.
- `music_packet_deliveries` at 0 and `church_children_packet_deliveries` at 1 mean the delivery
  paths are barely exercised. Their behaviour is probably under-tested, which is a finding for the
  next plan rather than this one.

**Rollback:** delete the branch.

**Depends on:** D1.

---

## Phase D6 — Scope decision memo and re-plan input pack

**One question:** given D1–D5, what are the scope options, what does each cost, and what does Brent
need to decide?

**Scope**
- `docs/plan/bilingue/evidence/D6-scope-memo.md` — the consolidated pack:
  - **Option A: full feature** (English creation + duplication) and **Option B: English creation
    only** (no duplication), each with the surfaces it touches, the phases it implies at the SOP's
    sizing rules, and the open questions it leaves. A third option is welcome if the evidence
    suggests one.
  - Which of the eleven original BLOCKING findings each option removes, reduces, or leaves intact.
  - The questions only Brent can answer, each tagged with the option and phase it blocks. Known
    already: the default English Bible translation, and the English liturgical texts for the six
    canonical elements in `src/data/elementos-fijos/`.
  - Anything D1–D5 found that changes the product question rather than the engineering one.
- `docs/plan/bilingue/evidence/D6-verify.sh`.

**Out of scope**
- **Recommending an option.** The memo presents; Brent decides. An executor that picks one has
  exceeded its role (D-E).
- Writing the feature plan, or any phase of it. That is a fresh `/plan-new` after the decision.
- Re-opening D-F.

**Acceptance criteria**
- [D6.1] Both options are specified in enough detail to be costed: surfaces touched, approximate
  phase count at ≤10 files and ≤600 net lines each, and the human-dependency blockers.
- [D6.2] Every claim in the memo traces to a D1–D5 evidence file by filename and section. A claim
  with no antecedent is either removed or labelled a new finding with its own command.
- [D6.3] All eleven original BLOCKING findings are addressed by ID (B1–B11) with their status under
  each option.
- [D6.4] The questions for Brent are a numbered list, each with the phase it blocks, each answerable
  without reading the codebase — no question is asked that a query could answer.
- [D6.5] The memo states which findings **surprised** the workstream — where reality differed from
  what the handoff or the prior review assumed. This is the highest-value output for the next
  planner and is the first thing lost if the memo is written as a summary.
- [D6.6] `D1-verify.sh` through `D5-verify.sh` all still exit 0 at D6's commit; the memo records
  any that do not and why.
- [D6.7] The memo recommends nothing (D-E). A reviewer finding a recommendation raises it BLOCKING.
- [D6.8] `git diff --stat` shows changes only under `docs/plan/bilingue/`.
- [D6.9] Gates pass; raw output pasted.

**Test plan**
- `bash docs/plan/bilingue/evidence/D6-verify.sh` — runs D1–D5's verify scripts in sequence and
  fails if any exits non-zero; checks that every `evidence/D*.md` referenced by the memo exists.
- A grep for the eleven finding IDs `B1`–`B11` confirming each appears in the memo.
- `git diff --stat pilot/sop-v2...HEAD`; `npx tsc --noEmit && npm run lint && npm test`.

**Definition of done:** all criteria checked, D6-verify exits 0, gates green, and the memo is in
front of Brent. **This phase closes the workstream.** The next step is a fresh `/plan-new` for the
feature, seeded by the evidence pack — not a continuation of any session in this workstream.

**Risks / unknowns**
- D6.7 is the criterion most likely to be violated in good faith. Presenting two options with
  honest costs makes one look better, and the drift from "presenting" to "advocating" is gradual.
  The executor should re-read its own memo for it before submitting.
- The phase-count estimates in D6.1 are estimates and must be labelled as such. They are the
  single number most likely to be quoted back as though it were measured.
- If D1–D5 surface something that makes both options untenable, saying so is the correct output.
  A memo that manufactures two viable options because the template has two slots is worse than a
  memo that says the shape is wrong.

**Rollback:** delete the branch. The decision is not made until Brent makes it.

**Depends on:** D1, D2, D3, D4, D5 — all complete and merged.

---

## What this plan does not cover, and why that is not a missing phase

A reviewer checking "is anything required for the goal uncovered?" should read the goal as stated:
the goal is the inventory and the decision, not the feature. Against that goal, D1–D6 are complete.

Against the *feature*, this plan is missing everything — builder language propagation, DB
immutability enforcement, canonical text integration, English Bible parsing, content-locale output,
notification localisation, cover handling, language-aware publication, the duplication split, the
related-artifact policy, and the end-to-end matrix. Those are the eleven phases the review named.
**They are deliberately absent**, because every one of them depends on an answer D1–D5 produces.
Writing them now would be the previous plan's mistake with better formatting.

---

## Decision log

| Date | Decision | Rationale | Raised by |
|---|---|---|---|
| 2026-08-10 | BILINGUE gets its own plan root at `docs/plan/bilingue/` | The shared `docs/plan/LEDGER.md` is being appended to by CUENTOS and MATERIALES concurrently | SOP §1.2 |
| 2026-08-10 | This plan is discovery-only and ends at a decision | Every feature phase depends on an unanswered question; the previous plan failed for answering them by assertion | PM |
| 2026-08-10 | L1–L8 from `PLAN-BILINGUE.md` are not carried forward | Two were disputed on the merits; the rest were never tested against evidence | PM, per review |
| 2026-08-10 | D-B/D-C: every claim carries its command; every phase ships a verify script | Makes "is this true?" a command the reviewer runs instead of a judgement call | PM |
| 2026-08-10 | D-D: discovery records shapes and counts, never personal-data values | Discovery reads exactly the fields the feature must protect | PM |
| 2026-08-10 | D-E: discovery describes, never prescribes | A discovery phase that recommends gets its recommendation frozen without review | PM |
| 2026-08-10 | The matrix is sized at 20 kinds + one `custom-*` rule, not 52 rows | 32 of the 52 distinct `tipo` values are one-row `custom-<uuid>` instances of a single kind | PM, verified |

---

## PRE-SUBMISSION SELF-REVIEW (pilot C2, applied to planning)

*Answering the §3.2 plan-reviewer's rubric before the review, not after. The previous plan's
self-review named its own blind spot and shipped anyway; naming a gap here is only worth
something if the gap is closed or the phase is cut.*

**1. Does the plan match reality?** Every fact in "Verified current state" carries the command or
query that produced it, run today. Three claims from prior documents are deliberately **not**
inherited and are re-derivation criteria instead: the `source_id` join (D2.5), the baked-cover
counts (D4.2), and the FK child list (D5.1). Two claims in the handoff brief are contradicted by
my own queries and corrected in place rather than worked around.

**2. Sequencing.** D1 fixes the vocabulary the other four classify against; D2–D5 are mutually
independent and parallelisable; D6 joins. No phase depends on anything a later phase builds.

**3. Sizing.** Every phase touches two or three files, all documents. None can leave the tree
broken, because none touches the tree. D2 is the only phase I think might exceed one session, and
it has a stated split trigger rather than an assurance.

**4. Unverifiable criteria — the hard part of this plan.** Document phases invite self-graded
criteria, which is how discovery normally rots. The mechanism against it is D-C: each phase ships
a script that re-derives its own numbers and exits non-zero on drift. Where that is impossible —
SQL claims, since `psql` is not installed — the criterion instead requires the query verbatim plus
raw pasted output, which a reviewer with the Supabase MCP can re-run. I have named which claims
fall in which bucket rather than pretending one mechanism covers both.

**5. Do the test plans test behaviour?** For a document, "behaviour" is *the numbers are still
true*. The verify scripts test exactly that, and they fail on drift rather than silently updating.
D5's counts will legitimately drift on a live system — the criterion says report the drift, which
is the honest handling.

**6. Missing phases.** Against this plan's goal, none. Against the feature, all eleven the review
named — deliberately, with the reason stated in its own section so the omission is a decision on
the record rather than an oversight.

**7. Architecture.** Six frozen decisions, all procedural. I deliberately froze nothing about how
the feature works, because I do not know yet and freezing it is what made the last plan expensive
to reject.

**Where I am guessing, plainly:**
- That D1's three-way taxonomy is sufficient. Each phase is told to add a category and say why
  rather than force-fit.
- That the 32 `custom-*` rows are homogeneous. **I did not look inside them.** This is the single
  largest unknown here and it is D2's stated top risk, not a footnote.
- That D5.5 can be established without writing a row to production. If it cannot, the criterion
  yields to read-only.
- That six phases is the right decomposition. D2 may become two.

**Weakest part of this plan:** D6. Its central criterion (D6.7 — present, do not recommend) is the
one a competent executor is most likely to violate while trying to be helpful, and the one hardest
to check mechanically. If a round is lost anywhere, it will be there.

**What I did not verify:** the contents of the 32 `custom-*` rows; what the 11 `config` keys mean;
whether `church_podcast_episodes` holds language-dependent content; whether `npm run lint`,
`npm test` and `npm run build` currently pass (only `npx tsc --noEmit` was run, exit 0, in
`/Users/brentcurtis/dev/casa-web` on `phase/pd-refine`). Each is assigned to the phase that needs
it rather than asserted here.
