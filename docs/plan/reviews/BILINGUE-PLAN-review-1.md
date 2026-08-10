# CODEX PLAN REVIEW — PLAN-BILINGUE v2 — round 1

Reviewer: Codex `gpt-5.6-sol`, `model_reasoning_effort = high`
Date: 2026-08-10
Prompt: `docs/plan/prompts/BILINGUE-codex-plan-review.md`

**VERDICT: FAIL** — 11 BLOCKING · 10 SHOULD-FIX · 4 NITS · 11 missing phases · 2 frozen decisions
disputed. Verdict accepted by the PM without contest.

---

## WHAT THE REVIEWER VERIFIED ITSELF

On clean branch `pilot/sop-v2`: read the plan, SOP, migrations, generated types, builder,
presentation, export, publication, notification, song and generator paths.

| The plan claimed | The reviewer found |
|---|---|
| 36 builder files | **33** active files; the reported 26,173 LOC excludes the active 520-line `ConstructorLiturgiasPage.tsx` |
| ~362 Spanish strings | **396** accent-bearing lines in that set **plus 120** in omitted related surfaces; the estimate is not reproducible and unusable for sizing |
| `source_id` semantics unknown — executor must STOP | **Resolved by one query.** 142 non-null = 116 song slugs (all join `music_songs.slug`) + 26 cuentacuentos ids |
| Cover images *may* have baked-in text (risk) | **Confirmed fact.** 60 cover elements with images; 30 carry `textBakedIn=true`; `Portadas.tsx` bakes title/subtitle into every newly generated cover |
| B1 "risk: none material" | `supabase gen types` produces **6,185 lines vs the checked-in 920** — a +5,265-line diff |
| `transcribe-meeting` in the liturgy path (per Brent) | **False.** Only caller is the leadership recording path; it never writes `liturgias.reflexion_texto` |
| 18 fixed element types | **52 distinct `tipo`**, 574 elements, 32 `custom-*` rows |
| — | 18 linked children lessons, 18 children publication records, 2 music publications, 3 cuentacuentos drafts — all omitted from B9 |
| — | `docs/plan/AGENT-WORKFLOW.md`, required by the plan and SOP, **did not exist in this repo** |
| 10 English Bible codes available | Confirmed: all ten returned 36 verses for John 3; Bolls lists 43 English translations |

No files or database rows were changed by the review.

## BLOCKING

- **[B1] B2 targets the wrong creation surface.** The builder creates through `ContextoTransversal`
  via `ConstructorLiturgias`; `LiturgiaForm` belongs to the separate antifonal-prayer flow. Both
  creation paths need covering, language must enter the domain model, and immutability must be
  enforced in the database — owner RLS currently permits arbitrary updates, so B2.5 cannot be met
  by hiding a control.
- **[B2] L1 is declared but not architected.** A global `t()` follows UI locale, yet files assigned
  to B4 also construct *stored output* copy (`exportService.ts` emits the celebrant guide;
  `UniversalSlide.tsx` renders content labels). Routing those through the UI translator makes
  output depend on operator locale — violating L1. Needs separate APIs/namespaces for `uiLocale`
  vs explicit `contentLanguage`, plus a four-combination integration test.
- **[B3] Required downstream surfaces are missing.** Celebrant PDF, story PDF, children-activity
  PDF, music packet PDF, presentation navigation/dates, children/music email and WhatsApp all emit
  independent Spanish copy. Worse: `published_resources` has **no language column and permits only
  one active resource per type**, so publishing an English story deactivates the Spanish one.
- **[B4] B9.5 is factually wrong.** Covers have title/subtitle baked into pixels. Reusing the
  references produces visibly Spanish "English" duplicates. Covers must be recomposed/regenerated,
  or replaced by text-free art plus deterministic overlays.
- **[B5] B9 is not an executable phase.** It combines translation policy, AI integration,
  authorization, structured-JSON transformation, transactional DB copying, asset policy,
  UI/progress/error handling, publication gating and review UX. No field-by-field translation
  matrix exists for `reflexion_pdf_url`, `source_id`, ids/URLs inside JSON, announcements, legacy
  types, publication state or derived children artifacts. B9.8 also needs one transactional RPC;
  browser-side inserts cannot guarantee atomicity.
- **[B6] B9 has no privacy design.** Liturgy rows and arbitrary announcements/custom content may
  carry celebrant, preacher, presenter, contact or member information. Sending whole records to a
  translator violates *"member PII never enters AI prompts."* Needs explicit excluded fields,
  placeholder redaction/restoration, provider-byte tests, logging restrictions, prompt-injection
  containment and a safe fallback.
- **[B7] Canonical content is not connected to creation or duplication correctly.**
  `ElementoFijoEditor` loads structured Spanish JSON from `/data/elementos-fijos`; B8 describes only
  a text table and never changes that read path — nor specifies segment order, speaker roles,
  variants or duplicated assets. B9 also appears to machine-translate `liturgia_lecturas`; Bible
  text should be **re-fetched** in the target-language edition instead.
- **[B8] B6 is under-scoped.** Adding version codes does not make English readings work: the parser
  recognises only Spanish book names, formatted references stay Spanish, several separate client
  version lists must change, and the builder must receive and pass content language. "All ten
  resolve" could pass with `Juan 3` while an English staffer's `John 3` still fails.
- **[B9] The sequencing/parallel-track claim is false.** B2, B6, B7d, B8 and B10 all need language
  propagated through builder state and cannot depend on B1 alone. They also overlap B4 files
  (`ContextoTransversal`, `CuentacuentoEditor`, `OracionEditor`, `ChildrenActivityDialog`,
  `ElementoFijoEditor`, `CancionSelector`). Every B4 phase additionally touches shared locale
  bundles unless resources are deliberately sharded. B9 is not the only join.
- **[B10] Phase sizing violates the governing SOP.** Type regeneration adds ~5,265 lines in B1;
  `CuentacuentoEditor.tsx` alone is 7,262 lines with 161 accent-bearing string lines; B9 is several
  architectural concerns with no test plan. None can meet ≤600 net lines / one concern / one green
  mergeable session.
- **[B11] The execution contract is unavailable.** Both the review prompt and `SOP-PILOT.md`
  incorporate `docs/plan/AGENT-WORKFLOW.md` §1–§4, but that file was absent from this repo and its
  history. *(Fixed 2026-08-10 — copied in from `~/dev/fne-lms`.)*

## SHOULD-FIX

- **[S1]** Replace the "unknown `source_id`" stop condition with the verified contract: song slugs +
  cuentacuentos ids. Song-slot duplication must explicitly clear `source_id`, lyrics/slides and
  song-specific config; cuentacuentos provenance needs its own rule.
- **[S2]** B3.2 is not the load-bearing test claimed — at B3 no content-language consumer exists, so
  the assertion is trivial. The real invariant must be tested after wiring: UI text follows user
  locale while generators, canonical lookup, preview, export and notifications follow liturgy
  language.
- **[S3]** Acceptance criteria need executable specifications. B2's tests never exercise DB
  rejection; B4 defines no regex, allowlist, file manifest or pre-change snapshots; "reviewed text"
  in B8 has no artifact/hash; B9 has no test plan at all; B9.10 does not enumerate export entry
  points.
- **[S4]** Split B8's human dependency — engineering cannot both "start first" and finish green
  while waiting on pastoral copy.
- **[S5]** B10 does not actually block on English uploads; its criteria explicitly allow the empty
  state. Catalog population is a release-readiness gate, not an open phase.
- **[S6]** Re-triage `transcribe-meeting` — only caller is leadership transcription. Otherwise it is
  scope creep.
- **[S7]** Add a Bible rights/attribution decision. API availability ≠ permission to redistribute
  copyrighted NIV/ESV/NLT/NASB text in stored slides and exports.
- **[S8]** Replace destructive rollback instructions — "drop the column" conflicts with the
  additive-only rule. Disable consumers instead.
- **[S9]** Define duplicate initial state and authorization: target ownership, source read authz,
  `estado='borrador'`, recomputed completion, no copied publication/delivery/session records,
  idempotent double-click handling, explicit translation-review gate before publishing.
- **[S10]** Resolve the default English Bible choice before freezing.

## NITS

- **[N1]** B7d exists in prose but is absent from the phase index and dependency graph.
- **[N2]** B9 refers to a nonexistent phase name `P-DUP`; META still says "draft v1" despite the v2
  addendum.
- **[N3]** The backlog suggestion to drop `church_songs` contradicts the additive-only rule.
- **[N4]** "Risk: none material" in B1 is not credible while type regeneration, immutability
  enforcement, self-FK behaviour and RLS verification are unresolved.

## MISSING PHASES

1. Discovery/contract phase: inventory every translatable field and JSON path by element type;
   classify UI copy vs stored/output copy; resolve source/asset semantics; define PII handling.
2. Builder-language propagation + DB immutability (`ContextoTransversal`, page/list badges, domain
   types, save/load, both creation paths, trigger/RPC test).
3. Canonical structured-text integration for new liturgies — language-specific fixed-element
   documents, segment/speaker structure, version/provenance.
4. English Bible-reference parsing + target-edition re-fetch during duplication.
5. Content-locale output phases: celebrant PDF, story PDF, children PDF, music PDF, presentation
   mode, filenames, date formatting.
6. Notification localisation — children/music email and WhatsApp, recipient-locale vs
   liturgy-language policy, approved English WhatsApp templates.
7. Baked-cover handling for liturgy covers and story covers.
8. Language-aware publication/archive behaviour; `published_resources` needs language-aware
   uniqueness and consumers.
9. Split duplication: translation contract/provider boundary; PII-safe structured translation;
   atomic DB-copy RPC; UI/review workflow; centralised publication/export validation.
10. Related-artifact policy for 18 children lessons/publications, cuentacuentos drafts, music
    publication state, reflection PDFs, presentation sessions — copy / translate / detach / clear.
11. End-to-end matrix: all four `uiLocale × contentLanguage` combinations, both directions, English
    book references, canonical source selection, empty songs, baked covers, exports, notifications,
    source deletion, injected mid-copy failure.

## FROZEN DECISIONS THE REVIEWER DISPUTES

- **L4** — `CHECK (idioma IN ('es','en'))` contradicts "the model must not forbid a third language,"
  and changing it later conflicts with additive-only. Use an additive languages table/FK or a
  validated language-code model.
- **L6** — explicit language is right; **defaulting every generator to `es` is not.** A default lets
  a missed caller silently generate Spanish for an English liturgy — precisely the failure this
  plan exists to prevent. Use a temporary compatibility wrapper for legacy behaviour, but make the
  final contracts require and validate language.
- **L1, L2, L3, L5, L7, L8** — sound. The plan fails to *implement* L1/L3/L8 completely, but the
  decisions themselves are correct.
