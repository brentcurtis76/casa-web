# PLAN — BILINGUE, phase D1

META
- REPO / ROOT: `casa-web`, branch `pilot/sop-v2`, worktree `/Users/brentcurtis/dev/casa-pilot`.
- PLAN ROOT: `docs/plan/bilingue/`. **Never write BILINGUE entries into `docs/plan/LEDGER.md`** —
  shared by CUENTOS and MATERIALES.
- BRANCH: `phase/d1-surfaces`, base `pilot/sop-v2`.
- PLAN FROZEN: **NO — draft 4, 2026-08-10.** Awaiting Codex review of D1 alone.
- HISTORY: drafts 1–3 (`5ee2f17`, `98ab364`, `eaed6f5`) all FAILed Codex plan review — 10, 8 and 7
  BLOCKING. Reviews in `reviews/`. **This draft plans one phase instead of nine**, by Brent's
  decision of 2026-08-10 (see "Why this plan is one phase").
- SOP: `~/.claude/agent-workflow/AGENT-WORKFLOW.md`; amendments `docs/plan/SOP-PILOT.md`.

---

## Why this plan is one phase

Three drafts tried to specify nine discovery phases in advance. Each failed, and the findings were
valid every time: 11 → 10 → 8 → 7 BLOCKING. The root cause was found in round 5 and is mechanical,
not a matter of judgement:

1. **The measuring instrument was wrapped.** `grep` and `find` resolve to shell functions injected
   by `~/.claude/shell-snapshots/snapshot-zsh-*.sh` in the planning session. They change results.
   Every count published in drafts 1–3 was taken through an instrument no reviewer has, and three
   different wrong diagnoses of the same discrepancy were published defending them.
2. **Commands were written into the plan without being executed.** Each was one run from correct.

Fixing those two makes a plan's *claims* sound. It does not make a nine-phase discovery
methodology specifiable in advance — the last review's deepest finding ([D3-B3]) was that the
`(path, kind)` fixture D2b and D2c are built on **cannot be constructed from the query the plan
supplied**, and finding that out required running the query. At that point writing the plan and
doing the discovery are the same activity, and the plan is the more expensive way to do it.

**So this plan freezes the one phase whose method genuinely must be fixed in advance.** D1's
content *is* reproducibility: a census whose number changes with the reader's locale is not a
census. Everything downstream is investigation, and investigations get planned after D1, against
D1's output plus the substantial evidence the three reviews already produced (Appendix B).

Both reviewers stated the discovery-only boundary is sound. That is unchanged; only the planning
horizon has shortened.

---

## Goal

Produce a verified, reproducible inventory of every surface in the liturgy path that emits
user-visible text, classified by whether it follows the operator's locale or the liturgy's
language — and a census whose numbers anyone can re-derive to the digit.

**Then stop.** D1 ends at a re-plan gate, not at more phases.

## Non-goals

- Any source change, schema change, or database write.
- Deciding how any surface should be made bilingual.
- Planning D2–D6. Those are drafted after D1, from D1's output.
- Choosing an i18n library, translation provider, or storage model.

---

## Verified current state

**Every command below was executed in this planning session and its real output is recorded.**
That is new in draft 4; drafts 1–3 asserted several commands without running them and were wrong
about four of them.

### The instrument problem, and how the numbers land once it is fixed

```bash
# grep and find are WRAPPED in the planning session — they are not the real binaries:
type -a grep     # -> grep is a shell function from ~/.claude/shell-snapshots/snapshot-zsh-*.sh
type -a find     # -> find is a shell function from ~/.claude/shell-snapshots/snapshot-zsh-*.sh

# With the real binary, the accent count is LOCALE-DEPENDENT. Both numbers are "right":
f=src/components/liturgia-builder/editors/CuentacuentoEditor.tsx
LC_ALL=C           /usr/bin/grep -cE '[áéíóúñüÁÉÍÓÚÑÜ¿¡]' "$f"   # -> 601
LC_ALL=en_US.UTF-8 /usr/bin/grep -cE '[áéíóúñüÁÉÍÓÚÑÜ¿¡]' "$f"   # -> 596
# Identical in zsh and bash. The reviewer measured 601; the PM measured 596; the variable is locale.
```

**`en_US.UTF-8` is the correct semantic and `C` over-matches.** Demonstrated, not asserted — the
five extra lines under `C` are emoji and a middot (`🚨`, `✅`, `·`) whose UTF-8 lead bytes collide
with the accent class when the class is interpreted as bytes:

```bash
LC_ALL=C           /usr/bin/grep -nE '[áéíóúñüÁÉÍÓÚÑÜ¿¡]' "$f" | cut -d: -f1 > /tmp/c.txt
LC_ALL=en_US.UTF-8 /usr/bin/grep -nE '[áéíóúñüÁÉÍÓÚÑÜ¿¡]' "$f" | cut -d: -f1 > /tmp/u.txt
comm -23 /tmp/c.txt /tmp/u.txt    # -> 328 333 1035 4542 4908, all emoji/middot lines
```

The orphan-file filter has the same shape of problem — `find -regex` needs `-E`:

```bash
/usr/bin/find    src -regex '.* [0-9]\.tsx?' | wc -l   # -> 0   (both zsh and bash)
/usr/bin/find -E src -regex '.* [0-9]\.tsx?' | wc -l   # -> 18  (both zsh and bash)
```

### The census, run correctly

Executed 2026-08-10 with `/usr/bin/grep`, `/usr/bin/find -E`, `LC_ALL=en_US.UTF-8`, `.json`
included, tests and the 18 orphan `* N.tsx` duplicates excluded:

| Surface | Files | Copy-lines |
|---|---:|---:|
| liturgia-builder | 19 | 427 |
| liturgia (antifonal) | 11 | 55 |
| lib/liturgia | 3 | 33 |
| `ConstructorLiturgiasPage.tsx` | 1 | 2 |
| `data/elementos-fijos` (JSON) | 7 | 33 |
| presentation (components + lib + hooks) | 59 | 171 |
| cuentacuentos lib | 15 | 73 |
| children-ministry lib | 11 | 21 |
| music-planning lib | 19 | 29 |
| edge: liturgy content | 26 | 566 |
| edge: packets/notify (incl. `_shared/whatsapp`) | 9 | 8 |
| **TOTAL** | **180** | **1,418** |

Higher than draft 3's 166/1,402 because three surfaces the earlier script omitted are now in
(`ConstructorLiturgiasPage.tsx`, `data/elementos-fijos`, `_shared/whatsapp`) and `.json` is
covered. **This number is still a lower bound** — `Guardar`, `Cancelar`, `Presentar` are Spanish
without accents and no accent class finds them. That is D1.2's whole reason for existing.

566 of the 1,418 are edge-function AI prompts — generation instructions, not extractable copy.

### The surface derivation, run correctly

A surface list must be *derived*, not typed from memory — that is what draft 3 failed on
([D3-B1]). This command derives files that **emit to a human**, by output sink:

```bash
LC_ALL=en_US.UTF-8 /usr/bin/grep -rlE \
  "jsPDF|jspdf|\.save\(|resend|sendEmail|nodemailer|templateName|sendTemplate|toDataURL|canvas\.getContext|window\.print" \
  src supabase --include='*.ts' --include='*.tsx' \
  | /usr/bin/grep -vE '__tests__|\.test\.| [0-9]\.tsx?$' \
  | /usr/bin/grep -iE 'liturgia|cuentacuento|children|music|presentation|graphics|export|wa-|whatsapp|packet' \
  | sort
```

Executed output — **19 emitting surfaces**, including two the PM never named in three drafts
(`canvasCompositor.ts`, `slideRenderer.tsx`) and one that is probably out of the liturgy path and
needs triage (`whatsapp-signup`):

```
src/components/graphics/GraphicsGeneratorV2.tsx      src/lib/children-ministry/childrenLessonPdfExporter.ts
src/components/graphics/canvasCompositor.ts          src/lib/cuentacuentos/downscaleImage.ts
src/components/graphics/templateCompositor.ts        src/lib/cuentacuentos/storyPdfExporter.ts
src/components/liturgia-builder/UniversalSlide.tsx   src/lib/liturgia/exportService.ts
src/components/liturgia/SlideGenerator.tsx           src/lib/liturgia/slideRenderer.tsx
src/components/music-scheduling/ServiceDateManager.tsx  src/lib/music-planning/packetGenerationService.ts
supabase/functions/_shared/whatsapp/graph.ts         supabase/functions/send-children-service-packet/index.ts
supabase/functions/_shared/whatsapp/send-core.ts     supabase/functions/send-music-service-packet/index.ts
supabase/functions/wa-reminders/index.ts             supabase/functions/wa-send/index.ts
supabase/functions/whatsapp-signup/index.ts
```

### Environment

```bash
which psql                                            # -> not found
ls /Users/brentcurtis/dev/casa-pilot/node_modules | wc -l   # -> 0  (npm ci needed)
npx tsc --noEmit; echo $?                             # -> 0  (clean base)
```

---

## Frozen architectural decisions

Only the decisions D1 needs. Downstream decisions are deliberately not frozen — they belong to the
plan written after D1.

| # | Decision | Rationale |
|---|---|---|
| **D-A** | **No source, schema or configuration change; no database write.** The diff touches `docs/plan/bilingue/**` only. | Code in the diff means the question was answered by changing the answer. |
| **D-B** | **Every claim carries the exact command that produced it, runnable as written, and that command has been executed with its real output recorded.** Abbreviations do not satisfy this; neither does an unexecuted command. | Drafts 1–3 violated both halves. Four supplied queries did not return what the plan said. |
| **D-K** | **Measurement hygiene.** Every count uses the **absolute binary path** (`/usr/bin/grep`, `/usr/bin/find -E`) and an **explicitly exported `LC_ALL`**, and records the invocation verbatim. When a reviewer's number disagrees, **suspect the instrument before defending the number.** | The wrapped `grep`/`find` cost three failed reviews and three wrong diagnoses of one discrepancy. This is the finding of the whole planning effort. |
| **D-D** | **Record paths, shapes and counts — never personal-data values**, in documents, fixtures, ledger or prompts. | D1 reads surfaces that carry celebrant and preacher data. |
| **D-E** | **D1 describes; it does not prescribe.** It records what emits text and which language axis governs it. It does not propose how to translate anything. | A discovery phase that recommends gets its recommendation frozen without review. |
| **D-G** | **UI locale and liturgy content language are independent axes.** Either can be set without changing the other. | D1's entire classification rests on this. Carried forward from the failed plan's `L1`, which both reviewers found sound. |
| **D-I** | **Every `UNVERIFIED` entry carries `materiality: BLOCKS-REPLAN \| DETAIL`**, verified mechanically, and the classification is approved by the phase reviewer rather than self-applied. | Confirmed a real gate by review 4. Renamed from `BLOCKS-D6` since D6 is no longer planned. |
| **D-J** | **A derived list beats an asserted list, and the derivation command must be supplied in full, executed, with its output recorded.** Where live data and code declarations can disagree, both commands are named and both must run. | Review 4's [D3-B1]: seven criteria said "by a recorded command" without supplying one, which is the unreviewed-assertion problem D-J exists to remove. |

---

## Phase D1 — Surface inventory and reproducible census

**Branch:** `phase/d1-surfaces` from `pilot/sop-v2`.

**One question:** which code paths emit user-visible text, and does each follow the operator's
locale or the liturgy's language (D-G)?

### Scope

Four files, all under `docs/plan/bilingue/`:

1. **`evidence/CENSUS-METHOD.md`** — the method, frozen **before any counting**, pinning:
   absolute binary paths · exported `LC_ALL` (`en_US.UTF-8`, with the C-locale over-match
   documented) · the character class as codepoints · the comment-line regex · file extensions
   including `.json` · the orphan exclusion using `find -E` · tokenisation and case-folding for
   the second pass · the stopword/verb list as a committed file · and whether the two passes are
   unioned or reported separately.
2. **`evidence/census.sh`** — implements it. Runs from a clean checkout under `bash`.
3. **`evidence/D1-surfaces.md`** — the inventory: one row per emitting surface, each classified
   **UI copy** (follows operator locale) / **stored-or-output copy** (follows liturgy language) /
   **generation instruction** (an AI prompt — neither), with a one-line reason.
4. **`evidence/D1-verify.sh`** — pure shell, re-derives every number and exits non-zero on drift.

Plus **`evidence/D1-SUMMARY.md`**: one page, plain language, for Brent — see D1.9.

### Out of scope

- How any surface should be made bilingual (D-E).
- Non-liturgy surfaces: financial, mesa, member-facing, RBAC admin. `whatsapp-signup` appears in
  the sink derivation and is probably one of these — triage it and say which.
- Fixing the 18 orphan `* N.tsx` duplicates. Record, leave.
- Any field-level, PII, asset, or downstream-table analysis. Those are the next plan's.

### Acceptance criteria

- [D1.1] `CENSUS-METHOD.md` pins every element listed in scope item 1. `census.sh` implements it,
  uses absolute binary paths and an exported `LC_ALL`, and `D1-verify.sh` asserts it does (D-K).
- [D1.2] **Two passes run, both reported, neither called "the" count.** Pass A is the accent class
  above. Pass B is a Spanish-stopword/UI-verb pass catching unaccented copy (`Guardar`, `Cancelar`,
  `Presentar`, `Cerrar`, `Buscar`, `Error`, …). The document states, adjacent to both numbers, that
  Pass A is a **lower bound** and why.
- [D1.3] The surface list is **derived by the two commands in "Verified current state"** — the
  sink-based derivation and the census file set — unioned, with both outputs pasted (D-J). A
  surface reached by neither, but included, carries the command that found it.
- [D1.4] Every path in the document exists; `D1-verify.sh` exits non-zero on any miss.
- [D1.5] Every surface classified against D-G with a one-line reason. No blank rows. The 19
  sink-derived surfaces above all appear or the document says why one does not.
- [D1.6] The three surfaces drafts 1–3 omitted — `ConstructorLiturgiasPage.tsx`,
  `data/elementos-fijos`, `_shared/whatsapp` — are present and classified.
- [D1.7] Every `UNVERIFIED` carries `materiality:` (D-I); `D1-verify.sh` fails on a missing field.
- [D1.8] `git diff --stat pilot/sop-v2...HEAD` lists only `docs/plan/bilingue/`.
- [D1.9] **`D1-SUMMARY.md` exists: one page, no jargon, readable by someone who has not read the
  codebase.** It states how many surfaces there are, which follow which language axis, which are
  ambiguous and why, and the three things most likely to make the feature harder than expected.
  This is the phase's report to Brent, and it is a deliverable, not a courtesy.

### Test plan

```bash
cd /Users/brentcurtis/dev/casa-pilot && npm ci        # required: no node_modules (verified)
bash docs/plan/bilingue/evidence/D1-verify.sh          # must exit 0
git diff --stat pilot/sop-v2...HEAD                    # must list only docs/plan/bilingue/
npx tsc --noEmit                                       # catches a source file leaked into the diff
```

`D1-verify.sh` must: assert `census.sh` uses absolute binaries and an exported `LC_ALL`; re-run
both passes and diff totals against `evidence/fixtures/D1-census.json`; assert every path in
`D1-surfaces.md` exists; assert no unclassified row; assert no `UNVERIFIED` lacks `materiality:`.
It is pure shell and touches no database — D1 has no database-derived facts, so the two-mechanism
problem that broke drafts 2 and 3 does not arise here.

`npm run lint`, `npm test`, `npm run build` and Playwright are excluded: the source diff is zero
lines, so they would re-test `pilot/sop-v2`, not the phase. If `npm ci` fails, report BLOCKED —
do not run gates in another checkout.

### Definition of done

All criteria checked · `D1-verify.sh` exits 0 · `git diff --stat` confined · `npx tsc --noEmit`
exit 0 · every `materiality:` classification reviewer-approved · `D1-SUMMARY.md` written ·
branch mergeable.

### Risks / unknowns

- The presentation module (59 files) renders liturgy content inside operator chrome and may need
  both classifications. If the three-way taxonomy cannot express that, **add a category and say
  why** — do not force-fit.
- Pass B will produce false positives on Spanish identifiers. Report precision honestly rather than
  tuning the list until the number looks tidy.
- **Guess, labelled:** that the sink regex in D1.3 catches every emission path. It found two
  surfaces the PM had missed across three drafts, which is evidence it works and not evidence it
  is complete. A surface found by neither derivation is the most valuable thing D1 can report.
- `whatsapp-signup` is probably out of scope; triage rather than assume.

### Rollback

Delete the branch. Nothing outside the plan tree was touched.

### Dependencies

None. D1 is the first and, in this plan, the only phase.

---

## The re-plan gate

D1 does not lead to D2. When D1 passes Codex review and merges:

1. A **fresh `/plan-new BILINGUE-2`** session drafts the remaining discovery, seeded by
   `evidence/D1-surfaces.md`, `D1-SUMMARY.md`, and Appendix B below.
2. That session inherits **D-A, D-B, D-K, D-D, D-E, D-G, D-I, D-J** and must run every command it
   writes (D-B) with hygienic measurement (D-K).
3. It decides its own phase count from D1's real surface list rather than from an estimate. Draft 3
   guessed nine phases; the guess is not carried forward.

**Nothing about the feature is decided by this plan.** The scope question — full feature versus
English-creation-only — is still open and still Brent's, and it now gets asked with a real surface
inventory in hand rather than an estimated one.

---

## Appendix B — findings the reviews already produced

These came out of the three Codex plan reviews and this session's verification. They are **inputs
to the next planning round, not established facts**: each was produced by a reviewer or by the PM
under the old instrument, and must be re-derived under D-K before use. Recorded here so the next
planner does not repay for them.

| Area | Reported | Status |
|---|---|---|
| JSON paths | `liturgia_elementos.slides` 55, `config` 90 | re-derive; the query used returns `count(distinct path)` only and **cannot produce the paths themselves** |
| `(path, kind)` pairs | raw `tipo`: 1,205 slides / 187 config. Collapsed to `customType`: 617 / 96 | re-derive; "kind" was never defined, and 617 merges two structurally distinct untyped rows |
| Custom shapes | 4 declared + 1 untyped bucket (2 rows, one image-shaped, one video-shaped) live; **5** in code incl. `blank-slide` | union of live and code required; the draft-3 grep matched unrelated `prayer-response`/`liturgy-response` |
| JSONB columns outside `liturgia_elementos` | **8**, not the 4 draft 3 scoped: `portadas_config`, `presentation_styles`, `tiempos`, `story`, plus `cuentacuentos_drafts.config`, `image_paths`, `selected_character_sheets`, `selected_scene_images` | needs a reproducible rule for which participate in duplication |
| FK closure of `liturgias` | 15 distinct tables (9 direct + 4 + 2) — but the recursive query as written returns **19** rows; 15 needs a `min(depth)` reduction | re-derive with the reduction stated |
| `published_resources` | `UNIQUE (resource_type) WHERE is_active` — one active resource per type **system-wide** | re-derive |
| `liturgias` RLS | UPDATE policy has `USING (auth.uid() = created_by)` and **no `WITH CHECK`** | re-derive |
| Assets | `Portadas.tsx` bakes `subtitle: context.preacher` into cover pixels with `textBakedIn: true` | re-derive; PII-in-asset, which no column census finds |
| `edited_slides` | populated on zero rows | re-derive |
| `custom_content` | 54 rows, all on the three `oracion-*` types; zero on `custom-*` | re-derive |

---

## Decision log

| Date | Decision | Rationale | Raised by |
|---|---|---|---|
| 2026-08-10 | Own plan root `docs/plan/bilingue/` | shared ledger has two other workstreams appending | SOP §1.2 |
| 2026-08-10 | Discovery before any feature work | every feature phase depends on an unanswered question | PM, both reviewers |
| 2026-08-10 | **Plan one phase, not nine** | three drafts failed; the deepest finding required running a query to discover the plan's own fixture was unbuildable — at which point planning and doing are the same activity | Brent, after review 4 |
| 2026-08-10 | **D-K: measurement hygiene — absolute binaries, pinned locale, suspect the instrument first** | wrapped `grep`/`find` produced three failed reviews and three wrong diagnoses of one discrepancy | PM, round 5 |
| 2026-08-10 | **D-B extended: a command in a plan must have been executed** | four supplied queries did not return what the plan claimed | review 4 |
| 2026-08-10 | `LC_ALL=en_US.UTF-8` is the census locale | `C` over-matches: its 5 extra lines are emoji and a middot colliding on UTF-8 lead bytes — demonstrated | PM |
| 2026-08-10 | D2–D6 not planned; a re-plan gate replaces them | their contracts kept failing on facts only execution produces | Brent |
| 2026-08-10 | `D1-SUMMARY.md` is a deliverable | Brent said he lacks the visibility to judge this work; an inventory he cannot read does not fix that | Brent, PM |

---

## PRE-SUBMISSION SELF-REVIEW

**What is different about this draft, concretely:** every command in it was executed in this
session and its real output is pasted. Drafts 1–3 did not do that, and it is why four of their
supplied queries were wrong. The census number moved from 1,402 to 1,418 and the file count from
166 to 180 purely as a result — three surfaces had been silently missing.

**What I got wrong across three drafts, and the actual cause:** I published three different
diagnoses of one 8-file discrepancy — the regex dialect, then bash-versus-zsh, then a PATH
difference — and defended each. All three were wrong. `grep` and `find` are shell functions in my
session. The reviewer's 601 and my 596 are both correct; the variable is locale, exactly as they
said the first time. I have written this to memory because it invalidates every count I have taken
in this repo, not only BILINGUE's.

**Sizing.** Four files, no source change, one architectural concern. Comfortably inside the caps.

**Are the criteria verifiable?** D1.1–D1.8 are checked by `D1-verify.sh` plus `git diff --stat`.
D1.9 is not script-checkable — a one-page summary being *readable* is a judgement — and I am not
claiming otherwise. It is checked by Brent reading it, which is the point of it existing.

**Where I am guessing, labelled:** that the sink regex is complete (it found two surfaces I had
missed in three drafts, which argues it works, not that it is exhaustive); that the three-way
taxonomy suffices; that Pass B's stopword list can be specified without excessive false positives.

**Weakest part of this plan:** D1.3's derivation is only as good as the sink regex. If a surface
emits text by a route the regex does not match — a template string handed to a library I did not
grep for — D1 will miss it and no criterion catches that. The mitigation is that D1 reports any
surface found by neither derivation as its most valuable output, but that depends on the executor
looking beyond the commands, which is exactly the kind of thing a plan cannot enforce.

**What I did not verify:** whether `npm ci` succeeds in `casa-pilot`. It is D1's first step and a
BLOCKED report if it fails.
