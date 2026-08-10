# PLAN — Bilingual liturgies (es / en)

META
- REPO / ROOT: `/Users/brentcurtis/dev/casa-web`
- PLAN DOCS: `docs/plan/` in-repo (same convention as `PLAN.md`)
- BRANCH CONVENTION: `phase/<id>-<slug>`, ≤20 chars total (Vercel preview DNS)
- PLAN FROZEN: **NO — draft v1, 2026-08-10. Awaiting adversarial plan review.**
- PILOT: runs under `SOP-PILOT.md`. This is the first phase-set to exercise the PLANNING loop;
  C2/C3 only ever touched execution.

## Goal

Let a church run services in more than one language from one system:

1. Choose the language when a liturgy is created, and have everything downstream honour it —
   generated prayers, the children's story, Bible readings, slides, print output.
2. Translate an existing liturgy into the other language, producing an independent duplicate
   the user can edit freely.
3. Let an English-speaking staff member operate the liturgy builder without reading Spanish.

## Non-goals

- Translating the whole app. Scope is the **liturgy builder** surface (36 files), not the 417
  `.tsx` files app-wide. Music, mesa, financial, member-facing pages are out.
- Languages beyond `es` and `en`. The model must not *forbid* a third, but nothing ships for one.
- Re-generating content in the target language. Brent chose translate-existing (2026-08-10):
  both services get the same service.
- Keeping the pair in sync after duplication. Independent copies, by decision.
- Translating existing stored liturgies in bulk. All 30 stay `es`.

## Verified current state (read from the code and the live DB, 2026-08-10)

| Fact | Value | Consequence |
|---|---|---|
| i18n infrastructure | **none** — no library, no locale, nothing in `package.json` | greenfield; library choice is a frozen decision |
| Stack | Vite 5 + React Router 6 SPA (not Next) | `react-i18next`, not a framework router locale |
| Builder surface | 36 files, 26,173 LOC, **~362 candidate Spanish strings** | ~4 extraction phases at ≤10 files each |
| `liturgias` schema | no language column; all-Spanish column names | additive migration; do NOT rename columns |
| Element types | 18 fixed + ~35 one-off `custom-<uuid>` | custom types carry user text — translation target |
| `tipo` slugs | used as identifiers 40+ times in source (`'cuentacuentos'` ×41, `'padre-nuestro'` ×21) | **slugs are keys, never translated** — labels are separate |
| Spanish system prompts | 7 edge functions | 5 are liturgy content; 2 (`transcribe-meeting`, `process-reflexion-pdf`) need triage |
| Bible source | bolls.life, **7 Spanish translations wired, 0 English** | API has **43 English** (NIV, ESV, NKJV, NLT, NASB, KJV…) — config, not integration |
| `liturgia_elementos.source_id` | exists, semantics unknown | **must be understood before P-DUP** — may already be a copy mechanism |
| Existing duplication | none found at liturgy level | P-DUP builds it |
| Song catalog | `music_songs` — **83 rows, all with lyrics, 0 CCLI numbers**, no language column | songs are selected from a catalog, not authored inline (L8) |
| Song selection UI | `liturgia-builder/editors/CancionSelector.tsx` reads `music_songs` | one file to make language-aware |
| `church_songs` | **0 rows, read by no source file — dead table** | backlog cleanup, out of scope here |

## Frozen architectural decisions

| # | Decision | Rationale |
|---|---|---|
| **L1** | **UI language and content language are two independent axes.** `liturgias.idioma` is the *content* language. The builder UI language follows a *user* preference. They are never coupled. | A Spanish-speaking staffer must be able to build an English liturgy, and vice versa. Conflating them is the classic i18n bug and it is very expensive to unpick later. |
| **L2** | Element `tipo` values stay Spanish slugs forever. They are database keys and appear 40+ times in source as literals. Only *display labels* are translated, via a label map keyed by slug. | Translating identifiers breaks every query and comparison in the app. |
| **L3** | **Canonical liturgical texts are never machine-translated.** `padre-nuestro`, `santa-cena`, `bendicion`, creeds and any received formula come from a curated bilingual text table. The translator is forbidden from touching them. | CASA is Anglican. An English congregation expects the received text, not a re-translation of the Spanish. A machine-translated Lord's Prayer is a liturgical failure, not a typo. |
| **L4** | Language is stored as `text` with a CHECK constraint, `NOT NULL DEFAULT 'es'`. Not an enum type. | Additive, reversible, and adding a third language later is a constraint change rather than a type migration. Existing 30 rows become `es` with no backfill. |
| **L5** | Translation produces an **independent** liturgy: `origen_liturgia_id` is nullable, records provenance only, and carries no sync, no cascade, no FK-driven behaviour. | Brent's decision, 2026-08-10. Keeps P-DUP a copy operation rather than a distributed-state problem. |
| **L6** | Every generator takes language as an **explicit parameter**, defaulting to `es`. No generator infers language from content, user, or context. | Implicit inference is untestable and fails silently. An explicit parameter is assertable in a contract test. |
| **L7** | No column renames, no destructive migrations, no changes to the 11 Life OS tables. | Existing hard rule (CLAUDE.md). |
| **L8** | **Songs are selected from the catalog, never translated.** The four `cancion-*` element types carry real worship songs with lyrics (`music_songs`, 83 rows). Translation must never render song lyrics into the target language. An English liturgy gets songs chosen from English catalog entries. | The English "version" of a song is a *different song*, or does not exist. Translated lyrics do not scan to the melody, and the result is unsingable. There is also licensing: the table has a `ccli_number` column (currently unpopulated) precisely because these are licensed works, not free text. Caught 2026-08-10 — v1 of this plan would have machine-translated them. |

## Phase index

| ID | Name | Status | Depends on |
|----|------|--------|-----------|
| B1 | Language on the data model | TODO | — |
| B2 | Language chosen at creation | TODO | B1 |
| B3 | i18n foundation + user locale (L1) | TODO | — |
| B4a | Extract strings: builder shell | TODO | B3 |
| B4b | Extract strings: element editors 1 | TODO | B3 |
| B4c | Extract strings: element editors 2 | TODO | B3 |
| B4d | Extract strings: dialogs + shared | TODO | B3 |
| B5 | Element label map (L2) | TODO | B3 |
| B6 | Bible: English translations | TODO | B1 |
| B7a | Generators: story + refine | TODO | B1 |
| B7b | Generators: oraciones | TODO | B1 |
| B7c | Generators: children lesson | TODO | B1 |
| B8 | Canonical liturgical text table (L3) | TODO | B1 |
| B10 | Song catalog language + filtered selection (L8) | TODO | B1 |
| B9 | Translate + duplicate | TODO | B1, B5, B8, B10 |

Independent tracks: **{B1→B2, B6, B7*, B10}**, **{B3→B4*, B5}**, **B8**. B9 is the only true join.
Three tracks can run in parallel worktrees — the shape the research supports.

**Start B8 and B10 first despite their numbers.** Both block B9 and both block on a human:
B8 needs Brent's English liturgical texts, B10 needs him to upload English songs. Engineering
can finish and the phase still sits waiting on content.

---

## Phase B1 — Language on the data model

**Scope:** one additive migration + regenerated types.
- `liturgias.idioma text NOT NULL DEFAULT 'es'` with `CHECK (idioma IN ('es','en'))`
- `liturgias.origen_liturgia_id uuid NULL REFERENCES liturgias(id) ON DELETE SET NULL`
- regenerate `src/integrations/supabase/types.ts`

**Out of scope:** any UI, any read of the new columns, any RLS change, any backfill.

**Acceptance criteria**
- [B1.1] Migration is additive only — no DROP, TRUNCATE, destructive ALTER, no column rename.
- [B1.2] All 30 existing rows read `idioma = 'es'` after migration; none has `origen_liturgia_id`.
- [B1.3] `idioma` rejects a value outside `('es','en')`.
- [B1.4] Deleting a source liturgy sets its translations' `origen_liturgia_id` to NULL, and does
  **not** delete them (L5).
- [B1.5] Types regenerate cleanly; `npx tsc --noEmit` passes.
- [B1.6] Existing RLS on `liturgias` is unchanged and still enforced.

**Test plan:** pgTAP for B1.2–B1.4; `npx tsc --noEmit` for B1.5.
**Rollback:** drop the two columns; nothing reads them yet.
**Risk:** none material — no consumer exists at this point. This is deliberately the safest phase.

---

## Phase B2 — Language chosen at creation

**Scope:** `LiturgiaForm` asks the language; the value persists to `liturgias.idioma`.
**Out of scope:** anything downstream *honouring* it — that is B6/B7.

**Language is fixed at birth** (Brent, 2026-08-10). Once a liturgy exists its `idioma` never
changes. Wanting the other language means duplicating via B9, which is the whole point of B9.

**Acceptance criteria**
- [B2.1] Creation form offers exactly `es` / `en`, defaulting to `es`.
- [B2.2] The chosen value is persisted and re-read correctly.
- [B2.3] Creating without touching the control yields `es` — existing behaviour unchanged.
- [B2.4] The control is keyboard reachable and labelled.
- [B2.5] **After creation the language control is absent or disabled in every edit surface**, and
  an update that attempts to change `idioma` is rejected. Fixed at birth must be enforced, not
  merely un-offered in the UI.

**Test plan:** component tests on `LiturgiaForm`; one Playwright path creating an `en` liturgy.
**Rollback:** hide the control; column keeps its default.

---

## Phase B3 — i18n foundation + user locale (L1)

**Scope:** install `i18next` + `react-i18next`; provider at the app root; `es` as the default and
complete bundle; an `en` bundle that may be partial; user locale persisted; a language switcher in
the builder shell only. **No string extraction in this phase** — the plumbing must land green and
mergeable on its own.

**Out of scope:** touching the 362 strings; any non-builder surface; server-side locale.

**Acceptance criteria**
- [B3.1] With no stored preference the app renders exactly as today (Spanish, byte-identical copy).
- [B3.2] Switching UI locale to `en` does **not** alter any liturgy's `idioma` (L1 — this is the
  load-bearing test of the whole plan).
- [B3.3] A missing `en` key falls back to the `es` string, never to a raw key or blank.
- [B3.4] Locale preference survives reload.
- [B3.5] Bundle size increase is recorded in the ledger.

**Test plan:** unit tests for fallback + persistence; an explicit L1 independence test for B3.2.
**Rollback:** remove the provider; strings are still literals at this point.
**Risk:** B3.2 is the decision that is expensive to reverse. It gets a dedicated test.

---

## Phases B4a–B4d — String extraction (≤10 files each)

**Scope per phase:** replace literal Spanish strings with `t()` keys in one slice of the builder;
add both `es` and `en` resource entries. Split by directory so no two phases touch one file.

**Acceptance criteria (each)**
- [B4x.1] No user-visible Spanish literal remains in the phase's files.
- [B4x.2] Every new key exists in **both** bundles.
- [B4x.3] Rendered Spanish output is unchanged from before the phase — snapshot-compared.
- [B4x.4] No `tipo` slug, DB value, route, or test id was altered (L2).

**Test plan:** snapshot tests asserting Spanish output is identical pre/post; a lint rule or script
that fails on a bare Spanish literal in the covered directories.
**Risk:** ~362 is a **regex estimate, not a count**. First phase must produce the real number and
the plan must be re-sized from it. If the true count is materially higher, split further.

---

## Phase B5 — Element label map (L2)

**Scope:** a single map from `tipo` slug → translated display label, covering the 18 fixed types;
every UI reading a raw slug for display goes through it. Custom `custom-<uuid>` types carry
user-authored titles and are **not** in the map.

**Acceptance criteria**
- [B5.1] All 18 fixed slugs have `es` and `en` labels.
- [B5.2] No slug value changed anywhere — DB, source literals, tests (L2).
- [B5.3] An unknown or custom slug renders its stored `titulo`, never a raw slug or blank.

---

## Phase B6 — Bible: English translations

**Scope:** add English translations to `BIBLE_VERSIONS` in `fetch-bible-passage`; pick the default
by liturgy language; persist the chosen version to `liturgia_lecturas.version`.

**Translations to wire** (Brent, 2026-08-10 — all confirmed present on bolls.life, which carries 43):

```
NIV · KJV · NKJV · ESV · NLT · NASB · NRSVCE · MSG · AMP · WEB
```

**Default for `en`: NIV** — pending Brent's confirmation. Flagged because NRSV is the usual
Anglican lectionary translation, and the default is a pastoral choice, not an engineering one.
`es` keeps NVI unchanged.

**Acceptance criteria**
- [B6.1] All ten English translations resolve and return text.
- [B6.2] An `en` liturgy defaults to the chosen English default; `es` still defaults to NVI.
- [B6.3] The version actually used is persisted per reading.
- [B6.4] An unknown version falls back to the *language's* default, not to NVI unconditionally.
- [B6.5] Existing Spanish readings are byte-identical to before.

---

## Phases B7a–B7c — Generators take a language parameter (L6)

- **B7a** `generate-story` + `refine-story` — they now share `_shared/storyContract.ts` (PD-REFINE),
  so language belongs beside it.
- **B7b** `generate-oraciones`
- **B7c** `generate-children-lesson` + `refine-children-lesson`
- **B7d** `process-reflexion-pdf` + `transcribe-meeting` — **both confirmed in the liturgy path**
  by Brent, 2026-08-10. `process-reflexion-pdf` feeds `liturgias.reflexion_texto`, so an `en`
  liturgy with a Spanish-processed reflection fails the goal.

**Acceptance criteria (each)**
- [B7x.1] Language is an explicit parameter defaulting to `es` (L6).
- [B7x.2] Omitting it reproduces today's Spanish behaviour exactly.
- [B7x.3] `en` produces English output — asserted on the **bytes sent to the provider**, not on
  provider output.
- [B7x.4] The existing strict output contract still holds in both languages.
- [B7x.5] The banned-community-names rule still applies in both languages.

**Risk:** `generate-story`'s prompt hardcodes Spanish pedagogical framing and a Chilean name
blocklist. English output needs a reviewed prompt, not a translated one.
**Triage needed:** `process-reflexion-pdf` and `transcribe-meeting` — in or out of the liturgy path?

---

## Phase B8 — Canonical liturgical text table (L3)

**Scope:** a curated bilingual table for received texts (Lord's Prayer, communion, blessing, creeds),
keyed by `tipo` slug + language, seeded with texts **Brent supplies**. The translator in B9 must
consult it and refuse to machine-translate a covered slug.

**Acceptance criteria**
- [B8.1] Every covered slug has a reviewed `es` and `en` text.
- [B8.2] A covered slug is served from the table, never from the translator (L3).
- [B8.3] An uncovered slug falls through to normal translation.

**Risk:** the seed content is a **pastoral decision, not an engineering one**. This phase cannot
start until Brent provides the English texts. It is the most likely phase to block on a human.

---

## Phase B10 — Song catalog language + filtered selection (L8)

**Scope:** `music_songs.idioma text NOT NULL DEFAULT 'es'` with a CHECK constraint (same shape as
L4); `CancionSelector.tsx` filters the catalog by the liturgy's `idioma`; the music-library editor
lets a song's language be set on upload.

**Out of scope:** the rest of the 22-table music module — setlists, rehearsals, stems,
arrangements, musicians. Only the catalog gains a language. Also out: `church_songs`, which has
0 rows and no readers (backlog: drop it).

**Acceptance criteria**
- [B10.1] All 83 existing songs read `idioma = 'es'` after migration; no lyrics are altered.
- [B10.2] `CancionSelector` in an `es` liturgy shows exactly the songs it shows today.
- [B10.3] `CancionSelector` in an `en` liturgy shows only `en` songs — and shows an explicit empty
  state, not a blank list, when none exist yet.
- [B10.4] A song's language is settable on create and edit in the music library.
- [B10.5] No setlist, rehearsal, or packet behaviour changes.

**Test plan:** pgTAP for B10.1; component tests for B10.2–B10.4; the existing music suites must
stay green for B10.5.
**Rollback:** drop the column; the selector filter is behind it.
**Risk:** B10.3's empty state is the phase's real content. Until Brent uploads English songs, every
English liturgy has empty song slots — that is correct behaviour, and the UI must say so clearly
rather than looking broken.

---

## Phase B9 — Translate + duplicate

**Scope:** duplicate a liturgy into the other language — `liturgias` row, `liturgia_elementos`
(including `slides`, `edited_slides`, `config`, `custom_content`), `liturgia_lecturas`,
`liturgia_oraciones` — translating text, reusing images, honouring B8 for canonical texts, setting
`origen_liturgia_id`.

**Acceptance criteria**
- [B9.1] The duplicate is independent: editing either never affects the other (L5).
- [B9.2] `origen_liturgia_id` points at the source; the source is unmodified.
- [B9.3] Every `tipo` slug is preserved exactly (L2).
- [B9.4] Canonical slugs come from B8, not the translator (L3).
- [B9.5] Image references are reused, not regenerated or re-uploaded.
- [B9.6] Element `orden` and structure are preserved.
- [B9.7] Duplicating an `en` liturgy to `es` works symmetrically.
- [B9.8] A partial failure leaves **no** half-built liturgy.
- [B9.9] **No `cancion-*` element carries lyrics across (L8).** Song elements are duplicated as
  empty slots that preserve position, `tipo` and `orden`, and are visibly marked as needing a
  song from the target-language catalog.
- [B9.10] A duplicate containing unfilled song slots **cannot be published or exported** as
  finished. It must be impossible to project a liturgy with blank song slides by accident.

**Risk — the largest in the plan:** `liturgia_elementos.source_id` already exists and its semantics
are unknown. It may already encode a copy relationship that conflicts with `origen_liturgia_id`.
**An executor that finds this true must STOP and report FINDINGS** (SOP §1.6), not invent a
reconciliation.
**Second risk:** covers may have Spanish text baked into the image. Unverified. If true, B9.5 is
wrong and images need regeneration for those element types.

---

## Open questions

**Answered 2026-08-10 (Brent):**
1. ~~Which English Bible translations?~~ → NIV, KJV, NKJV, ESV, NLT, NASB, NRSVCE, MSG, AMP, WEB.
2. ~~Language changeable after creation?~~ → **Fixed at birth.** B2.5 enforces it.
3. ~~`process-reflexion-pdf` / `transcribe-meeting` in the liturgy path?~~ → **Yes, both.** B7d.
4. ~~Songs?~~ → English songs will be **uploaded to the catalog**, not translated. L8 + B10.

**Still blocking:**
1. **The default English Bible translation.** NIV is planned; NRSV is the usual Anglican
   lectionary choice. One word from Brent. — blocks **B6**
2. **The English canonical liturgical texts** — BCP, Common Worship, or CASA's own wording, for
   the Lord's Prayer, the Peace, the communion dialogue, the blessing, and any creed in use.
   Please supply the actual text. — blocks **B8**
3. **English songs uploaded to `music_songs`.** Engineering can finish B10 without them, but no
   English liturgy is usable until the catalog has entries. — blocks **useful** B9 output
4. **Unverified surfaces** — print/PDF export, presentation-mode slide rendering, and
   email/WhatsApp notification copy. Nobody has checked whether these emit Spanish independently
   of the builder. If they do, this plan is missing phases. — **must be checked before freeze**

## Decision log

| Date | Decision | Rationale | Raised by |
|---|---|---|---|
| 2026-08-10 | Scope = liturgy output **and** builder UI, not the whole app | 362 strings vs 1,208 | Brent |
| 2026-08-10 | Translate existing content, do not regenerate | both services get the same service | Brent |
| 2026-08-10 | Independent copies, no sync | simplest model that meets the need | Brent |
| 2026-08-10 | L1 — UI locale and content language are independent axes | a Spanish speaker must be able to build an English liturgy | PM |
| 2026-08-10 | L3 — canonical liturgical texts are curated, never machine-translated | Anglican congregations expect the received text | PM |
| 2026-08-10 | Language is fixed at birth; duplication is the only route to the other language | avoids re-running every generator on an existing liturgy | Brent |
| 2026-08-10 | Ten English Bible translations wired; default still open | breadth over a single opinionated choice | Brent |
| 2026-08-10 | `process-reflexion-pdf` and `transcribe-meeting` are in the liturgy path | reflexion feeds `liturgias.reflexion_texto` | Brent |
| 2026-08-10 | L8 — songs are selected from the catalog, never translated; English songs get uploaded | a translated worship song is unsingable and licensed separately | Brent + PM |

---

## PRE-SUBMISSION SELF-REVIEW (pilot C2, applied to planning)

*The planner answering the plan-reviewer's rubric before the review, not after.*

- **Does the plan match reality?** Every table row above was read from the code or queried against
  the live DB today, not recalled. Three items are explicitly *unverified* and marked as risks:
  the 362 string estimate (regex, not a count), `source_id` semantics, and whether cover images
  carry baked-in Spanish text.
- **Sequencing:** B9 is the only real join. B1→B2, B6, B7* and B3→B4*/B5 are independent and can run
  in parallel worktrees. B8 blocks B9 and blocks on a human, so it should start earliest despite
  its late number.
- **Sizing:** B4 is the phase set I least trust. It is sized from an estimate, and the first
  extraction phase must produce the real count and re-size the rest. B9 is large and may need
  splitting once `source_id` is understood.
- **Unverifiable criteria:** B7x.3 deliberately asserts on bytes sent to the provider rather than on
  provider output, because provider output is not deterministic. B3.2 is the single most important
  test in the plan — it pins L1, the decision that is most expensive to reverse.
- **Missing phases — the honest list:** no phase covers print/PDF output, presentation-mode slide
  rendering, or email/WhatsApp notification copy. If any of those emit Spanish for an `en` liturgy,
  the goal is not met and this plan is incomplete. **I did not verify those surfaces and I am
  flagging it rather than assuming.**
- **Where I am guessing:** that `react-i18next` is the right library (Vite SPA convention, not
  measured); that 4 extraction phases suffice; that translation quality on devotional prose is
  acceptable without a human review step — B8 covers only *canonical* texts, and a reviewed prayer
  is not the same as a received one.
- **Weakest part of this plan:** B9. It joins every track, its main risk (`source_id`) is unresolved,
  and its rollback story is the thinnest. If anything forces a re-plan, it will be B9.

### v2 addendum (2026-08-10, after Brent's answers)

- **A real defect in v1, caught by asking rather than by review:** v1 would have machine-translated
  worship-song lyrics. Four of the eighteen element types are `cancion-*`, and they hold licensed
  songs with lyrics on slides (`music_songs`, 83 rows). Translated lyrics do not scan to a melody
  and the English "version" of a song is usually a different song. This produced L8 and B10, and
  changed B9. **I did not catch this by reading the schema — I only found it because I queried the
  actual rows and saw song titles.** The general lesson for this plan: element *types* look
  homogeneous in the schema and are not homogeneous in content.
- **Content-vs-engineering blockers are now the critical path, not the code.** B8 needs Brent's
  English liturgical texts; B10 needs him to upload English songs. Both can be engineered to
  completion and still deliver nothing usable. They carry high phase numbers and should start
  first — that inversion is stated in the phase index and is easy to lose.
- **What I still have not verified, and it is the same gap as v1:** print/PDF export,
  presentation-mode rendering, and notification copy. If they emit Spanish independently, phases
  are missing. This should be the plan reviewer's first target — a reviewer that only checks the
  phases I wrote will not find the phases I failed to write.
