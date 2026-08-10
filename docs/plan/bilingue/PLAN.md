# PLAN — BILINGUE, phases D1a and D1b

META
- REPO / ROOT: `casa-web`, branch `pilot/sop-v2`, worktree `/Users/brentcurtis/dev/casa-pilot`.
- SOURCE SNAPSHOT: every number in this plan was measured at `pilot/sop-v2` = **`e0c9342`**.
- MEASUREMENT ENVIRONMENT: macOS (Darwin 24.3.0), `/usr/bin/grep` (BSD), `/usr/bin/find` (BSD),
  locale `en_US.UTF-8` available and used. Numbers are OS- and locale-dependent — see D-K.
- PLAN ROOT: `docs/plan/bilingue/`. **Never write BILINGUE entries into `docs/plan/LEDGER.md`.**
- BRANCHES: `phase/d1a-method`, then `phase/d1b-census`, base `pilot/sop-v2`.
- PLAN FROZEN: **YES — draft 5 + review-6 corrections, 2026-08-10, by Brent's explicit decision.**
  Codex review 6 returned FAIL (6 BLOCKING). Brent elected to **stop the plan-review loop and
  execute**, after six reviews and a trajectory of 11 → 10 → 8 → 7 → 5 → 6 findings. This is a
  logged SOP §1.5 override: the reviewer does not agree this plan is ready, and that disagreement
  stands on the record. All six findings were verified by the PM and **corrected in place below**
  rather than deferred — none is a new PM assertion; each is a reviewer-confirmed fact.
  **Known accepted risk:** D1's inventory is best-effort, not provably complete. See "What D1 does
  not claim".
- HISTORY: drafts 1–4 (`5ee2f17`, `98ab364`, `eaed6f5`, `e0c9342`) FAILed with 10, 8, 7 and 5
  BLOCKING. Reviews in `reviews/`. Draft 4 was the first whose numeric claims all reproduced for
  the reviewer.
- SOP: `~/.claude/agent-workflow/AGENT-WORKFLOW.md`; amendments `docs/plan/SOP-PILOT.md`.

---

## Why two phases, and why the split is the fix

Draft 4 planned one phase. Review 5 found three things that make one phase wrong:

- **The surface derivation was off by a factor of three.** Its sink regex found 19 files; the
  corrected regex finds **62** in the liturgy path, including a confirmed live emission the old one
  missed entirely (below).
- **Pass B was not actually frozen** — the word list ended in an ellipsis, and the same executor
  would write the method and run it, so nothing could prove the method was not tuned after seeing
  the totals.
- **The derivation counts files, not surfaces.** One file emits on several language axes at once.

The split answers all three. **D1a locks the method and produces no numbers.** It is reviewed and
merged before any counting happens, which is the method-lock review 5 asked for. **D1b runs the
locked method and produces the inventory.** An executor cannot tune a method that was frozen and
reviewed in a previous phase.

---

## Goal

A verified, reproducible inventory of every emission of user-visible text in the liturgy path,
classified by whether it follows the operator's locale or the liturgy's language — with a method
anyone can re-run to the digit.

**Then stop.** D1b ends at a re-plan gate.

## Non-goals

- Any source change, schema change, or database write.
- Deciding how any surface should be made bilingual.
- Planning the rest of discovery. That is drafted after D1b, from D1b's output.

---

## Verified current state

Every command below was **executed** at `e0c9342` and its real output is recorded. Where draft 4
showed a result without its command, the command is now here — that was review 5's [D4-B1].

### D-K in practice: the instrument, and the locale

```bash
type -a grep   # -> shell function from ~/.claude/shell-snapshots/snapshot-zsh-*.sh  (NOT /usr/bin/grep)
type -a find   # -> shell function from the same snapshot

export LC_ALL=en_US.UTF-8   # exported once, so every process in every pipeline inherits it
f=src/components/liturgia-builder/editors/CuentacuentoEditor.tsx
LC_ALL=C           /usr/bin/grep -cE '[áéíóúñüÁÉÍÓÚÑÜ¿¡]' "$f"   # -> 601
LC_ALL=en_US.UTF-8 /usr/bin/grep -cE '[áéíóúñüÁÉÍÓÚÑÜ¿¡]' "$f"   # -> 596
```

`en_US.UTF-8` is correct; `C` over-matches because it compares **bytes**, not characters. The five
extra lines are 328, 333, 1035, 4542, 4908. Their matched bytes, measured:

| Line | Char | Matched byte | Collides with |
|---|---|---|---|
| 328 | 🚨 | `9a` — a **continuation** byte | `Ú` = `c3 9a` |
| 333, 1035 | ✅ | `9c` — a **continuation** byte | `Ü` = `c3 9c` |
| 4542, 4908 | · | `c2` — a **lead** byte | `¿` = `c2 bf`, `¡` = `c2 a1` |

*Draft 4 said all five collided on lead bytes. That was wrong — three collide on continuation
bytes. Review 5 [D4-S2]; the conclusion is unchanged.*

```bash
/usr/bin/find    src -regex '.* [0-9]\.tsx?' | /usr/bin/wc -l   # -> 0   (bash and zsh)
/usr/bin/find -E src -regex '.* [0-9]\.tsx?' | /usr/bin/wc -l   # -> 18  (bash and zsh)
```

### Pass A — the accent census, complete command

```bash
#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=en_US.UTF-8
G=/usr/bin/grep; F=/usr/bin/find
ACCENT='[áéíóúñüÁÉÍÓÚÑÜ¿¡]'
COMMENT='^[[:space:]]*(//|\*|/\*)'
T=0; TF=0
surface () {
  local name="$1"; shift
  local n=0 f=0
  while IFS= read -r file; do
    f=$((f+1)); n=$(( n + $("$G" -E "$ACCENT" "$file" | "$G" -vcE "$COMMENT" || true) ))
  done < <("$F" -E "$@" -type f -regex '.*\.(ts|tsx|json)$' \
             -not -path '*__tests__*' -not -name '*.test.*' \
             -not -regex '.* [0-9]\.(ts|tsx)' 2>/dev/null | /usr/bin/sort)
  T=$((T+n)); TF=$((TF+f)); printf '%-30s files=%-4s copy=%s\n' "$name" "$f" "$n"
}
surface "liturgia-builder"     src/components/liturgia-builder
surface "liturgia"             src/components/liturgia
surface "lib/liturgia"         src/lib/liturgia
surface "pages (constructor)"  src/pages/ConstructorLiturgiasPage.tsx
surface "data/elementos-fijos" src/data/elementos-fijos
surface "presentation"         src/components/presentation src/lib/presentation src/hooks/presentation
surface "cuentacuentos lib"    src/lib/cuentacuentos
surface "children-ministry"    src/lib/children-ministry
surface "music-planning"       src/lib/music-planning
surface "edge: content"        supabase/functions/generate-story supabase/functions/refine-story \
  supabase/functions/generate-oraciones supabase/functions/generate-children-lesson \
  supabase/functions/refine-children-lesson supabase/functions/fetch-bible-passage \
  supabase/functions/process-reflexion-pdf
surface "edge: packets/notify" supabase/functions/send-children-service-packet \
  supabase/functions/send-music-service-packet supabase/functions/wa-send \
  supabase/functions/wa-reminders supabase/functions/_shared/whatsapp
printf '%-30s files=%-4s copy=%s\n' "TOTAL" "$TF" "$T"
```

Executed output: liturgia-builder 19/427 · liturgia 11/55 · lib/liturgia 3/33 · constructor page
1/2 · elementos-fijos 7/33 · presentation 59/171 · cuentacuentos 15/73 · children-ministry 11/21 ·
music-planning 19/29 · edge content 26/566 · edge packets 9/8 — **TOTAL 180 files / 1,418 lines.**

### Pass B — the frozen word list, and what Pass A misses

The list is committed here in full. It deliberately **excludes** words that are also English or
ambiguous (`Error`, `Total`, `Ver`, `Sin`, `Con`, `Para`, `Tipo`, `Lista`, `Estado`, `Hora`), which
is a precision-over-recall choice and is itself a lower bound.

```bash
WORDS='Guardar|Guardando|Cancelar|Cerrar|Buscar|Eliminar|Editar|Nuevo|Nueva|Crear|Agregar|Borrar|Aceptar|Volver|Siguiente|Anterior|Enviar|Enviando|Descargar|Cargando|Cargar|Seleccionar|Elegir|Filtrar|Ordenar|Mostrar|Ocultar|Copiar|Confirmar|Continuar|Salir|Ayuda|Nombre|Fecha|Archivo|Imagen|Todos|Todas|Ninguno|Ninguna|Mensaje|Correo|Usuario|Cantidad|Actualizar|Activar|Desactivar|Duplicar|Vista previa'
# matched with \b(...)\b, comment lines excluded, over the same file set as Pass A plus src/lib/whatsapp
```

**⚠ These numbers are superseded and must be re-derived in D1b.** The PM ran Pass B over **135**
files (nine roots) while describing it as "the same file set as Pass A plus `src/lib/whatsapp`",
which is **185** files — the run silently omitted `src/pages/ConstructorLiturgiasPage.tsx`,
`src/data/elementos-fijos`, `src/hooks/presentation` and all twelve edge-function directories.
Measured both ways:

| File set | Files | Pass B hits | Of those, no accent on the line |
|---|---:|---:|---:|
| What the PM ran (9 roots) | 135 | 338 | 285 |
| What the PM described (Pass A ∪ `lib/whatsapp`) | **185** | **376** | **316** |

Both are honest counts; the prose was not. **D1b uses the 185-file set** and re-derives all three
numbers. The finding that survives either way: **Pass A cannot see roughly 300 lines of Spanish
copy**, ~20% above its own 1,418 — the "lower bound" caveat is measured, not asserted.
*(Review 6 [D5-B1]. This was the third consecutive draft in which a command's prose drifted from
the command actually run; D-M below is the response.)*

### The corrected sink derivation

Draft 4's regex had `sendTemplate` but not `sendText`, and missed a live emission:

```bash
# supabase/functions/wa-webhook/index.ts ~line 137, sent to a real person over WhatsApp:
#   await sendText(creds, { body: "¡Gracias! Quedó registrada tu respuesta." })
```

It also missed `src/lib/whatsapp/templates.ts`, the approved-template registry — which hardcodes
`language: 'es'`, carries Spanish bodies and button labels, and whose header notes that editing a
body **triggers WhatsApp re-approval of 24–48h.** That is a lead-time constraint on any English
rollout, not merely a string.

Corrected derivation, executed:

```bash
export LC_ALL=en_US.UTF-8
SINKS='jsPDF|jspdf|\.save\(|resend|sendEmail|nodemailer|sendText|sendTemplate|templateName|WA_TEMPLATES|toDataURL|getContext\(|fillText|window\.print|download|toast\(|sonner'
/usr/bin/grep -rlE "$SINKS" src supabase --include='*.ts' --include='*.tsx' \
  | /usr/bin/grep -vE '__tests__|\.test\.| [0-9]\.tsx?$' \
  | /usr/bin/grep -iE 'liturgia|cuentacuento|children|music|presentation|graphics|export|wa-|whatsapp|packet' \
  | /usr/bin/sort
```

**154 hits repo-wide; 62 in the liturgy path** — against draft 4's 19. The 43 new files include
`wa-webhook/index.ts`, `src/lib/whatsapp/templates.ts`, `ContextoTransversal.tsx`, `Portadas.tsx`,
`ExportPanel.tsx`, `CuentacuentoEditor.tsx`, `liturgyService.ts`, `exportImport.ts`,
`ConstructorLiturgiasPage.tsx`, and fifteen `children-ministry` admin components.

**This regex is a candidate floor, not a contract.** It was wrong once by 3×; assuming it is now
complete would be the same mistake. D1b.4 requires a call-path audit on top of it.

### Environment

```bash
which psql                                                   # -> not found
/bin/ls /Users/brentcurtis/dev/casa-pilot/node_modules | /usr/bin/wc -l   # -> 0  (npm ci needed)
npx tsc --noEmit; echo $?                                    # -> 0  (clean base)
```

---

## Frozen architectural decisions

| # | Decision | Rationale |
|---|---|---|
| **D-A** | **No source, schema or configuration change; no database write.** Diff touches `docs/plan/bilingue/**` only. | Code in the diff means the question was answered by changing the answer. |
| **D-B** | **Every claim carries the exact runnable command that produced it, and that command has been executed with its output recorded.** | Drafts 1–3 violated both halves; draft 4 showed the census result without its command. |
| **D-K** | **Measurement hygiene.** Absolute binary paths for **every** process in a pipeline (`/usr/bin/grep`, `/usr/bin/find -E`, `/usr/bin/sort`, `/usr/bin/wc`, `/usr/bin/comm`), `LC_ALL` **exported once** rather than prefixed on the first command only, and the invocation recorded verbatim. Every artifact records the **source SHA** and the **OS/locale** it was measured on. **When a reviewer's number disagrees, suspect the instrument before defending the number.** | The wrapped `grep`/`find` cost three failed reviews and three wrong diagnoses of one discrepancy. |
| **D-D** | **Record paths, shapes and counts — never personal-data values.** | D1 reads surfaces carrying celebrant and preacher data. |
| **D-E** | **D1 describes; it does not prescribe.** | A discovery phase that recommends gets its recommendation frozen without review. |
| **D-G** | **UI locale and liturgy content language are independent axes.** | D1's entire classification rests on this. Both reviewers found it sound. |
| **D-I** | **Every `UNVERIFIED` carries `materiality: BLOCKS-REPLAN \| DETAIL`**, checked mechanically, classification approved by the phase reviewer rather than self-applied. | Confirmed a real gate by review 4. |
| **D-J** | **A derived list beats an asserted list; the derivation command is supplied in full and executed.** A derivation that has been wrong once is a **candidate floor**, and must be paired with an audit that can exceed it. | The sink regex was wrong by 3×. Treating a regex as a contract is how `wa-webhook` was missed. |
| **D-L** | **Method before measurement.** Any counting or classification method is committed and independently reviewed in a phase that produces **no results**, before the phase that produces results. What this buys is **method immutability after review** — it does **not** prove measurement never happened, and this plan does not claim it does: preliminary totals are already published above. | Review 5 [D4-B4]; overclaim corrected per review 6 [D5-B2]. |
| **D-M** | **Never describe a command in prose. Paste the literal script and its literal output.** A summary of what a command did is not evidence that it did it; three consecutive drafts had prose that drifted from the run, most recently Pass B's file set (135 vs the 185 described). | Review 6 [D5-B1]. This is the last surviving form of the failure that produced six FAILed reviews. |
| **D-N** | **D1 produces a best-effort inventory with a measured blind spot, not a proven-complete one.** Every artifact states what the method provably cannot see, and how to extend it. | Six reviews each found a further missed surface, because finding surfaces is the work. Claiming completeness is unprovable in advance; characterising the gap is not. |

---

## Phase D1a — Lock the method

**Branch:** `phase/d1a-method` from `pilot/sop-v2`.

**One question:** what exactly will be counted and classified, decided before anything is counted?

**This phase produces no numbers.** That is the point (D-L).

### Scope — four documents, no results

1. **`evidence/CENSUS-METHOD.md`** — pins: absolute binary paths for every process · `LC_ALL`
   exported once · the Pass A character class as codepoints · the comment regex · extensions
   including `.json` · the orphan exclusion via `find -E` · the Pass B word list **complete, no
   ellipsis** · word-boundary and case rules · the precision-over-recall exclusion list and its
   justification · and whether the two passes are reported separately or unioned.
2. **`evidence/census.sh`** — implements it. Runs under `bash` from a clean checkout. Prints
   results but is **not run for the record in this phase.**
3. **`evidence/SURFACE-SCHEMA.md`** — the surface record definition (below).
4. **`evidence/wordlist-passB.txt`** — the Pass B list as a committed file.
5. **`evidence/METHOD-MANIFEST.txt`** — `sha256` of every artifact above, so D1b can verify the
   whole method rather than only `census.sh`. *(Review 6 [D5-B2]: locking one file left the word
   list, the schema, the inclusion rule and the audit procedure mutable.)*

**Roots must include `src/types/shared/liturgy.ts`.** It declares `LITURGY_ORDER` with
user-visible Spanish labels (`'Portada Principal'`, `'Oración de Invocación'`) that
`ConstructorLiturgias.tsx:50` imports and renders. Neither the census roots nor the sink regex
reaches it, because it is a **declaration**, not an emission — which is why the schema now has a
`declaration/registry in source` origin. *(Review 6 [D5-B4].)*

### The surface record — review 5 [D4-B3]

A file is not a surface. `CuentacuentoEditor.tsx` emits toast text (UI copy) *and* story content
(stored copy); `downscaleImage.ts` matches a canvas sink but emits no text at all. Each record is:

```
path · symbol-or-line · sink/channel · audience · text-origin · language-axis · reason
```

- **sink/channel** — PDF · email · WhatsApp · slide render · toast/UI · file download · print
- **audience** — a **set**, not a single value: operator · congregation · recipient (a named person)
- **text-origin** — literal in source · **declaration/registry in source** (e.g. `LITURGY_ORDER`
  labels, `WA_TEMPLATES` bodies — text that is *declared* in one file and *rendered* in another) ·
  database content · AI-generated · canonical JSON · external registry
- **language-axis** — a **set**: `UI copy` (operator locale) · `stored-or-output copy` (liturgy
  language) · `channel-fixed` (recipient-facing copy whose language is fixed by an external
  registry — approved WhatsApp templates follow *neither* axis) · `generation instruction` ·
  `UNVERIFIED` + `materiality:`

**Multiple records per file are expected and correct.** Where a single emission genuinely carries
two axes — presentation surfaces combine operator chrome with projected liturgy content — the
record takes both values rather than being forced into one or into `UNVERIFIED`.
*(Review 6 [D5-B5]: scalar fields could not express the presentation or WhatsApp cases.)*

### Out of scope

- Running the census or producing any count. Any number in a D1a artifact is a BLOCKING finding.
- Classifying any actual surface.
- Non-liturgy surfaces. `whatsapp-signup` and the fifteen `children-ministry` admin components are
  probable exclusions — D1a states the **rule** for inclusion, D1b applies it.

### Acceptance criteria

- [D1a.1] `CENSUS-METHOD.md` pins every element in scope item 1. No ellipsis anywhere in it.
- [D1a.2] `wordlist-passB.txt` is complete and committed; `CENSUS-METHOD.md` states the exclusion
  policy and why precision was chosen over recall.
- [D1a.3] `census.sh` uses absolute paths for **every** process and exports `LC_ALL` once (D-K).
- [D1a.4] `SURFACE-SCHEMA.md` defines all seven fields with their allowed values, and states
  explicitly that one file may yield many records.
- [D1a.5] It states the **inclusion rule** for "the liturgy path" — precise enough that two people
  applying it to `whatsapp-signup` and to `children-ministry` admin get the same answer.
- [D1a.6] **No artifact records a measurement result.** The mechanical check applies **only to the
  prose artifacts** (`CENSUS-METHOD.md`, `SURFACE-SCHEMA.md`) and looks for recorded-result shapes —
  a digit adjacent to `files`/`lines`/`hits`/`matches`/`total`, a Markdown table row of counts, or a
  JSON `count` field. **`census.sh` is excluded**: it necessarily contains its own output format
  strings (`files=`, `copy=`, `TOTAL`), and draft 5's grep flagged it twice. The **authoritative**
  check is independent diff review confirming D1a contains methodology and no run output — a grep
  cannot prove absence of tuning and is not claimed to. *(Review 6 [D5-B3].)*
- [D1a.7] Every artifact records the source SHA and the OS/locale it targets (D-K, [D4-S1]).
- [D1a.8] `git diff --stat pilot/sop-v2...HEAD` lists only `docs/plan/bilingue/`.

### Test plan

```bash
cd /Users/brentcurtis/dev/casa-pilot && npm ci
bash -n docs/plan/bilingue/evidence/census.sh     # syntax-checks without running it
/usr/bin/grep -rnE '^\s*[A-Za-z ]+\s*=\s*[0-9]+|files=|copy=|TOTAL' docs/plan/bilingue/evidence/ \
  && echo "FAIL: D1a produced a result" || echo "OK: no results in D1a"
git diff --stat pilot/sop-v2...HEAD
npx tsc --noEmit
```

### Definition of done

All criteria checked · `census.sh` parses · **no counts present** · diff confined · `tsc` exit 0 ·
**Codex has reviewed and passed the method** — this review is the method-lock and D1b may not start
without it · branch merged.

### Risks

- The inclusion rule (D1a.5) is the hard part and the most likely thing to be vague. If it cannot
  be made precise, say so and propose the boundary as a question for Brent rather than inventing one.
- Pass B's list is frozen from the PM's draft; if D1a's author believes a word is wrong, change it
  **in this phase** — that is what this phase is for. Changing it in D1b is a BLOCKING finding.

### Rollback

Delete the branch.

### Dependencies

None.

---

## Phase D1b — Run it and classify

**Pre-split into two phases** — review 6 [D5-B6] measured 62 sink files ∪ 180 census files =
**211 unique candidates** (215 with `lib/whatsapp`), already past draft 5's ~200-record trigger
before execution began. "Split and report when it runs long" is not a plan; this is the split:

| ID | Branch | Covers | Owns |
|---|---|---|---|
| **D1b-1** | `phase/d1b1-output` | Recipient-facing channels: PDF, email, WhatsApp, print/download | its own records + fixture |
| **D1b-2** | `phase/d1b2-ui` | Operator-facing: UI/toast, slide render, and source **declarations/registries** | its records, **plus** the combined fixture, `D1-verify.sh` and `D1-SUMMARY.md` |

D1b-2 depends on D1b-1 and performs the reconciliation. Criteria below apply to **both** unless
marked. Where a criterion names a deliverable D1b-2 owns, D1b-1 produces its half.

**One question:** what does the locked method actually find, and how does each emission classify?

### Scope

1. **`evidence/D1-surfaces.md`** — one record per emission, per the D1a schema.
2. **`evidence/fixtures/D1-census.json`** — both passes' totals, with source SHA and environment.
3. **`evidence/D1-verify.sh`** — pure shell; re-derives every number, exits non-zero on drift.
4. **`evidence/D1-SUMMARY.md`** — one page, plain language, for Brent.

### Acceptance criteria

- [D1b.1] `census.sh` is run **unmodified** from D1a. If it must change, that is a FINDINGS report
  and a return to D1a — not an edit here (D-L).
- [D1b.2] Both passes reported separately, neither called "the" count. The document states, next to
  the numbers, that both are lower bounds and why — Pass A misses unaccented Spanish, Pass B trades
  recall for precision.
- [D1b.3] Every one of the **62** sink-derived files in "Verified current state" is triaged: either
  it yields ≥1 surface record, or the document says why it yields none (as `downscaleImage.ts`
  plausibly does).
- [D1b.4] **A call-path audit is run on top of the regex** (D-J): for each sink/channel in the
  schema, the executor traces at least one emission end-to-end and reports any route the regex does
  not match. **A surface found by the audit and not by the regex is the single most valuable output
  of this phase** and must be called out in `D1-SUMMARY.md`.
- [D1b.5] `wa-webhook/index.ts` and `src/lib/whatsapp/templates.ts` both appear with records. The
  template registry's 24–48h re-approval lead time is recorded as a constraint.
- [D1b.6] Every record carries all seven schema fields. No blanks.
- [D1b.7] Every `UNVERIFIED` carries `materiality:` (D-I); `D1-verify.sh` fails on a missing field.
- [D1b.8] `D1-verify.sh` verifies **every** artifact in `METHOD-MANIFEST.txt` against its `sha256`
  from D1a's merge commit, and records that commit SHA. Checking `census.sh` alone would leave the
  word list, schema, inclusion rule and audit procedure mutable ([D5-B2]).
- [D1b.11] Pass B is run over the **185-file** set (Pass A ∪ `src/lib/whatsapp`), not the 135-file
  set the PM used, and all three of its numbers are re-derived ([D5-B1]).
- [D1b.12] **The blind spot is stated and, where possible, measured** (D-N): what the method
  structurally cannot see. Known already — text *declared* in one file and *rendered* in another
  (`LITURGY_ORDER`, `WA_TEMPLATES`), and unaccented Spanish outside the frozen word list. Say what
  else, and say how a future pass would extend the method.
- [D1b.9] `git diff --stat pilot/sop-v2...HEAD` lists only `docs/plan/bilingue/`.
- [D1b.10] **`D1-SUMMARY.md`**: one page, no jargon, readable by someone who has not read the
  codebase. States how many **surfaces** (records, not files), which follow which language axis,
  which are ambiguous and why, what the audit found that the regex missed, and the three things
  most likely to make this feature harder than expected.

### Test plan

```bash
cd /Users/brentcurtis/dev/casa-pilot && npm ci
bash docs/plan/bilingue/evidence/D1-verify.sh    # must exit 0
git diff --stat pilot/sop-v2...HEAD              # only docs/plan/bilingue/
npx tsc --noEmit                                 # catches a source file leaked into the diff
```

`D1-verify.sh` must: assert `census.sh` matches D1a byte-for-byte; re-run both passes and diff
against the fixture; assert every path in `D1-surfaces.md` exists; assert every record has all
seven fields; assert no `UNVERIFIED` lacks `materiality:`. Pure shell, no database — D1 has no
DB-derived facts, so the two-mechanism problem that broke drafts 2 and 3 cannot arise.

`lint`/`test`/`build`/Playwright are excluded: the source diff is zero lines. If `npm ci` fails,
report BLOCKED.

### Definition of done

All criteria checked · `D1-verify.sh` exits 0 · diff confined · `tsc` exit 0 · every `materiality:`
reviewer-approved · **`D1-SUMMARY.md` read by Brent (or a named fresh-context reader) and their
confirmation that it is understandable and decision-useful recorded in the ledger** ([D4-S3]) ·
branch mergeable.

### Risks

- **Sizing.** 62 sink files plus 180 census files, at possibly several records each, is the real
  workload — draft 4 described this as "produce four documents", which understated it ([D4-N1],
  [D4-B3]). If the record count exceeds ~200, split by channel (PDF/email/WhatsApp first, then
  UI/render) and report rather than truncating.
- The presentation module may need two axes per record. If the schema cannot express that, that is
  a FINDINGS return to D1a, not an improvisation here.
- **Guess, labelled:** that the call-path audit in D1b.4 is achievable in one session. It is the
  criterion most likely to be done shallowly, because the regex output looks complete.

### Rollback

Delete the branch. D1a stands on its own.

### Dependencies

D1a, merged and Codex-passed.

---

## What D1 does not claim

D-N, stated plainly because it is the accepted risk in freezing this plan over a FAIL verdict.

**D1 does not produce a provably complete inventory of every emission of user-visible text.** No
method fixed in advance can. Six adversarial reviews each found one more surface the method missed —
`wa-webhook`'s `sendText` reply in review 5, `LITURGY_ORDER`'s labels in review 6 — because finding
surfaces *is* the work, and a root list plus a regex is incomplete by construction.

What D1 does produce: a reproducible method, an inventory built by it, and **an explicit statement
of what that method structurally cannot see.** The next plan treats the inventory as a floor that
grows, not a closed set. Any phase that assumes D1 found everything is built on a false premise, and
that premise is recorded here rather than discovered later.

## The re-plan gate

When D1b passes and merges, a **fresh `/plan-new BILINGUE-2`** drafts the remaining discovery,
seeded by `D1-surfaces.md`, `D1-SUMMARY.md`, and both appendices below. It inherits
**D-A, D-B, D-K, D-D, D-E, D-G, D-I, D-J, D-L**, and decides its own phase count from the real
inventory rather than an estimate.

### Appendix A — Brent's product decisions, still in force

Review 5 [D4-B5]: the shrink from nine phases dropped these, and they are **Brent's decisions, not
failed methodology.** They carry forward unchanged and a fresh planner must not reopen or lose them.

- Scope is liturgy **output and the builder UI** — not the whole app.
- **Independent copies**, no sync, no cascade between a liturgy and its translation.
- **Language is fixed at creation.** Duplication is the only route to the other language.
- Ten English Bible translations: NIV, KJV, NKJV, ESV, NLT, NASB, NRSVCE, MSG, AMP, WEB.
- **English songs are uploaded to the catalog, never machine-translated.**
- **"Translate rather than regenerate" applies to generated devotional prose only** — not Bible
  text (re-fetched in the target edition), canonical liturgical texts (curated), songs
  (re-selected), or assets (recomposed).

Still open and still Brent's: full feature vs English-creation-only · the default English Bible
translation · the English liturgical texts for the six canonical elements in
`src/data/elementos-fijos/`. These get asked with the real inventory in hand.

### Appendix B — technical findings from the reviews, provisional

**Inputs, not facts.** The SQL results and several code findings below were independently
reproduced by Codex on unwrapped tooling; others came from the PM under the wrapped instrument.
All need re-derivation under **D-B** before use — and the SQL ones need a database evidence
mechanism the next plan must choose, since **D-K governs shell hygiene, not SQL** ([D4-S4]).

| Area | Reported | Caveat |
|---|---|---|
| JSON paths | `slides` 55, `config` 90 | the query used returns `count(distinct path)` only and **cannot produce the paths themselves** |
| `(path, kind)` pairs | raw `tipo` 1,205 / 187; collapsed to `customType` 617 / 96 | "kind" was never defined; 617 merges two structurally distinct untyped rows |
| Custom shapes | **4 populated `customType` values** + 1 untyped bucket (2 rows: one image-shaped, one video-shaped) live; **5 declared in code** incl. `blank-slide` | union of live and code required |
| JSONB columns outside `liturgia_elementos` | **8**: `portadas_config`, `presentation_styles`, `tiempos`, `story`, plus `cuentacuentos_drafts.config`, `image_paths`, `selected_character_sheets`, `selected_scene_images` | needs a reproducible rule for which participate in duplication |
| FK closure of `liturgias` | 15 distinct tables — but the recursive query as written returns **19** rows; 15 needs a `min(depth)` reduction | re-derive with the reduction stated |
| `published_resources` | `UNIQUE (resource_type) WHERE is_active` — one active resource per type **system-wide** | Codex-reproduced |
| `liturgias` RLS | UPDATE policy has `USING (auth.uid() = created_by)` and **no `WITH CHECK`** | Codex-reproduced |
| Assets | `Portadas.tsx` bakes `subtitle: context.preacher` into cover pixels, `textBakedIn: true` | PII-in-asset; no column census finds it |
| `edited_slides` / `custom_content` | zero rows populated / 54 rows, all `oracion-*`, zero `custom-*` | Codex-reproduced |
| WhatsApp templates | `src/lib/whatsapp/templates.ts` hardcodes `language: 'es'`; body edits need **24–48h re-approval** | a lead-time constraint on any English rollout |
| **Bible text rights** | The ten frozen English translations (NIV, KJV, NKJV, ESV, NLT, NASB, NRSVCE, MSG, AMP, WEB) are **available** via bolls.life — availability is not permission | **Redistribution and attribution rights are unverified.** Storing copyrighted translation text in slides and exporting it to PDF is a different act from fetching it for display. Flagged in three reviews; dropped from draft 5's handoff. Re-verify before any phase depends on a specific translation. ([D5-S1]) |

---

## Decision log

| Date | Decision | Rationale | Raised by |
|---|---|---|---|
| 2026-08-10 | Own plan root; discovery before feature work | shared ledger; every feature phase depends on an unanswered question | SOP §1.2, both reviewers |
| 2026-08-10 | Plan one phase, not nine | three drafts failed; planning and doing had become the same activity | Brent |
| 2026-08-10 | **D-K** measurement hygiene, extended to every process in a pipeline | wrapped `grep`/`find`; draft 4 still used unqualified `wc`, `sort`, `cut`, `comm` | PM, review 5 [D4-B1] |
| 2026-08-10 | `LC_ALL=en_US.UTF-8` pinned | `C` compares bytes and over-matches — demonstrated per-byte | PM |
| 2026-08-10 | **D-L: method before measurement — D1 splits into D1a and D1b** | an executor who writes and runs a method in one phase can tune it after seeing totals | review 5 [D4-B4] |
| 2026-08-10 | **A surface record is not a file**; seven fields, many records per file | one file emits on several axes; `downscaleImage.ts` emits no text | review 5 [D4-B3] |
| 2026-08-10 | **The sink regex is a candidate floor, paired with a call-path audit (D-J extended)** | it was wrong by 3× and missed a live WhatsApp emission | review 5 [D4-B2] |
| 2026-08-10 | **Brent's product decisions restored as Appendix A** | the shrink dropped them; they are decisions, not methodology | review 5 [D4-B5] |
| 2026-08-10 | `D1-SUMMARY.md` requires **recorded** human acceptance in the DoD | Brent said he lacked visibility to judge; "written" is not "understood" | review 5 [D4-S3] |

---

## PRE-SUBMISSION SELF-REVIEW

**What review 5 changed, concretely.** The sink derivation went from 19 files to **62** — it had
missed a live WhatsApp reply (`"¡Gracias! Quedó registrada tu respuesta."`) because the regex had
`sendTemplate` but not `sendText`. Pass B, previously an ellipsis, is now a committed list, and
running it shows **285 lines of Spanish copy Pass A cannot see** — the "lower bound" claim is now
measured, at roughly 20%. And the phase split in two, because a method written and run by the same
executor cannot be shown not to have been tuned.

**What I got wrong and the reviewer got right.** The lead-byte explanation: three of the five
C-locale extras collide on *continuation* bytes (`9a`, `9c`), not lead bytes. Corrected with the
per-line byte measurement. And draft 4 claimed every command was executed while omitting the census
command itself — the one that mattered most.

**Sizing, honestly.** D1a is four documents with no results; small and clearly one session. D1b is
the bigger half and I have said so rather than repeating draft 4's "produce four documents": the
real workload is triaging 62 sink files plus 180 census files at possibly several records each, with
a stated split trigger at ~200 records.

**Are the criteria verifiable?** D1a's are, including D1a.6 — "no counts present" is greppable, and
it is what makes the method-lock real. D1b's are, except D1b.10, which is a human read; the plan
says so and now requires the acceptance be *recorded*, not just the document written.

**Where I am guessing, labelled:** that the D1b.4 call-path audit fits one session; that the seven
schema fields are the right seven; that D1a.5's inclusion rule can be made precise enough that two
people agree on `children-ministry` admin.

**Weakest part of this plan:** D1b.4. The regex output will look complete, and the audit is the only
thing standing between that appearance and another 3× miss. It is the criterion a competent
executor is most likely to satisfy shallowly, and no script can tell the difference.
