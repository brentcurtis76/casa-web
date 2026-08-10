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
| B9 | Translate + duplicate | TODO | B1, B5, B8 |

Independent tracks: **{B1→B2, B6, B7*}**, **{B3→B4*, B5}**, **B8**. B9 is the only true join.
Three tracks can run in parallel worktrees — the shape the research supports.

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
**Out of scope:** anything downstream *honouring* it — that is B6/B7. Editing language after
creation is out (see Risks).

**Acceptance criteria**
- [B2.1] Creation form offers exactly `es` / `en`, defaulting to `es`.
- [B2.2] The chosen value is persisted and re-read correctly.
- [B2.3] Creating without touching the control yields `es` — existing behaviour unchanged.
- [B2.4] The control is keyboard reachable and labelled.

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

**Acceptance criteria**
- [B6.1] An `en` liturgy defaults to an English translation; `es` still defaults to NVI.
- [B6.2] The version actually used is persisted per reading.
- [B6.3] An unknown version falls back to the language's default, not to NVI unconditionally.
- [B6.4] Existing Spanish readings are byte-identical to before.

**Risk:** which English translation is the pastoral default is **Brent's call, not the executor's** —
NIV, ESV and NRSVCE carry different denominational expectations. Blocked until he answers.

---

## Phases B7a–B7c — Generators take a language parameter (L6)

- **B7a** `generate-story` + `refine-story` — they now share `_shared/storyContract.ts` (PD-REFINE),
  so language belongs beside it.
- **B7b** `generate-oraciones`
- **B7c** `generate-children-lesson` + `refine-children-lesson`

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

**Risk — the largest in the plan:** `liturgia_elementos.source_id` already exists and its semantics
are unknown. It may already encode a copy relationship that conflicts with `origen_liturgia_id`.
**An executor that finds this true must STOP and report FINDINGS** (SOP §1.6), not invent a
reconciliation.
**Second risk:** covers may have Spanish text baked into the image. Unverified. If true, B9.5 is
wrong and images need regeneration for those element types.

---

## Open questions for Brent (blocking the phases named)

1. **Which English Bible translation is the default?** NIV, ESV, NRSVCE and NLT carry different
   denominational expectations. — blocks **B6**
2. **The English canonical texts** — BCP, Common Worship, or CASA's own? Please supply them.
   — blocks **B8**
3. **Can a liturgy's language be changed after creation, or is it fixed at birth?** Currently
   planned as fixed; changing it later means re-running every generator. — affects **B2**
4. **`process-reflexion-pdf` and `transcribe-meeting`** — part of the liturgy path or not?
   — affects **B7** sizing

## Decision log

| Date | Decision | Rationale | Raised by |
|---|---|---|---|
| 2026-08-10 | Scope = liturgy output **and** builder UI, not the whole app | 362 strings vs 1,208 | Brent |
| 2026-08-10 | Translate existing content, do not regenerate | both services get the same service | Brent |
| 2026-08-10 | Independent copies, no sync | simplest model that meets the need | Brent |
| 2026-08-10 | L1 — UI locale and content language are independent axes | a Spanish speaker must be able to build an English liturgy | PM |
| 2026-08-10 | L3 — canonical liturgical texts are curated, never machine-translated | Anglican congregations expect the received text | PM |

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
