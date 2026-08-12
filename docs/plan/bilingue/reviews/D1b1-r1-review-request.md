# D1b-1 · rounds 1–3 — review request and FINDINGS

| | |
|---|---|
| Workstream | BILINGUE |
| Phase | **D1b-1** — recipient-facing channels |
| Attempt | **2** (cumulative); round 1 = `FAIL(4)`, this is the remediation |
| Risk tier | `DISCOVERY` |
| Worktree | `/Users/brentcurtis/dev/casa-pilot` |
| Git common dir | `/Users/brentcurtis/dev/casa-web/.git` |
| Branch | `phase/d1b1-output` |
| Base | `pilot/sop-v2` @ `0fd80f2` (the contract commit) |
| Round 1 artifacts | `46f11e3`, `eb20507` |
| Round 2 remediation | see `git log pilot/sop-v2..phase/d1b1-output` |
| Gate baseline | `d5df247` — `evidence/BASE-GATES-d5df247.md` |
| Provenance anchor | `dee6a1a` ([D1b.8]) |
| Round 1 | started `2026-08-12T14:05:58Z`, ended `2026-08-12T14:26:35Z` |
| Round 2 | started `2026-08-12T20:12:40Z`, ended `2026-08-12T20:44:21Z` |
| Source diff | **zero lines** (D-A) |

**Review the cumulative diff `pilot/sop-v2...phase/d1b1-output`.**

---

## 0. Round 1 remediation — what changed and why

Codex returned `FAIL(4)`. **All four blockers were verified against source before any edit, all four
were accepted, and two turned out to be worse than reported.** Nothing was argued down.

### [B1] — the `WA_TEMPLATES` chain does not exist · **ACCEPTED, and worse**

Verified:

```bash
/usr/bin/grep -rn "WA_TEMPLATES\|getTemplate\|whatsapp/templates" src supabase \
  --include='*.ts' --include='*.tsx' | /usr/bin/grep -v '^src/lib/whatsapp/templates.ts'
# src/types/shared/liturgy.ts:422 — an unrelated same-named getTemplate for liturgy templates.
# No importer of WA_TEMPLATES exists anywhere.
```

Round 1's record asserted `WA_TEMPLATES[name].name → SendInput.templateName → sendTemplate`. Every
send site hardcodes its own string literal instead (`send-music-service-packet:558`,
`wa-reminders:57`). Two further facts the review did not have:

- **The runtime boundary makes the claimed flow impossible.** `templates.ts` is a browser module under
  `src/`; every sender is a Deno edge function under `supabase/functions/`, and no edge function
  imports from `src/`.
- **Three of the six declared templates are named by no sender at all** — `cambio_servicio`,
  `solicitud_disponibilidad`, and `opt_in_bienvenida`. The command and its literal output are in
  `D1-surfaces-output.md` §2.0.

The third of those has a knock-on: round 1's `wa-webhook:150` record called that emission "the
compliance leg of the opt-out promise made by `opt_in_bienvenida`". **That template is sent by no code
path here**, so the promise is not made by this codebase. That reason is corrected too.

Fix: `D1-surfaces-output.md` §2.0 is a new subsection that traces the value in both directions and
states plainly that `templates.ts` is a hand-maintained mirror of registry copy, not a link in any
emission path. The two `templates.ts` records survive — [D1b.5]/[D1b1.8] require this file to appear —
but they now say what the file is, and the record for the copy a recipient actually reads is the
`external registry` one on `send-core.ts`. §6.2 adds this as a new **blind spot with the opposite error
direction**: a mirror invites recording a chain that does not exist, which is exactly what round 1 did.

### [B2] — composite payloads not split per origin · **ACCEPTED, all four instances**

`SURFACE-SCHEMA.md` §"Record syntax" requires one record per origin even when one API call sends the
payload. Round 1 violated it four times, and in two of those it said so in its own reason text. Fixed
by splitting, and by stating the rule once in a new §0.1 so it is applied uniformly rather than per
record:

| Round 1 | Round 2 |
|---|---|
| music song list as one `database content` record that listed `Enlace` / `Referencia` / `Stems disponibles` inside it | two records — literals (312-317, 333, 341) and database content (319-350) |
| children role word + subject line in one record "two further literal emissions" | two records — 354 and 389-391 |
| recipient display names folded into both email-body records | two new `database content` records — `send-music…:437`, `send-children…:135` |
| WhatsApp fan-out as one `declaration/registry in source` record | three records — `external registry` (558), source-literal date variable (560/377), database variables (560) |

### [B3] — axis contradictions · **ACCEPTED, and extended by one the review did not cite**

`channel-fixed` is reserved for copy "fixed independently by an **external registry**". Three records
used it for registry-free `sendText` literals — `graph.ts:106-116`, `wa-webhook:137`, `wa-webhook:150`
— and those are now `UNVERIFIED (materiality: BLOCKS-REPLAN)`, the same treatment the reviewer approved
for email copy.

**Extended:** the same defect applies to `wa-reminders`' `formatDateEs` and to the fan-out's
`formattedDate`. A template *variable* is not registry-fixed — Meta approves the body, not the
substitutions — so both moved to `UNVERIFIED (BLOCKS-REPLAN)` as well. Codex did not cite these; the
rule it stated covers them.

The locale-date half is fixed by splitting rather than relabelling. `packetGenerationService`'s
`serviceDateLabel` is not database text: it is generated at `ExportPanel.tsx:311` by
`toLocaleDateString('es-CL', …)` and passed through params (31, 41, 240) to `drawText` at 84. Same for
the children's PDF date at `ExportPanel.tsx:484`. Both are now their own `literal in source` records
with the axis of the document that displays them, per a new §0.2 rule. Proper nouns — which follow no
language at all — now carry `UNVERIFIED (materiality: DETAIL)` rather than being asserted into an axis.

### [B4] — the closest-call exclusion rested on a false distinction · **ACCEPTED; verdict survives on a narrower fact**

Codex was right that `liturgias` and `liturgia_lecturas` are shared. Round 1's phrase "the legacy
`liturgias` table rather than the builder's liturgy" is **retracted**. The full table map is now in
`D1-exclusions.md` §3 Group 3, derived with a loop over four tables, and it shows two real chains
round 1 denied: a row the generator writes to `liturgias` **is** listed by `listLiturgies` and loadable
by `loadLiturgy`, and the readings it writes **are** read by `loadLiturgy:828` into the celebrant PDF.

The decisive fact is the one Codex predicted:

```bash
/usr/bin/sed -n '810,914p' src/lib/liturgia/liturgyService.ts | /usr/bin/grep -nE "\.from\("
#  5:      .from('liturgias')
# 19:      .from('liturgia_lecturas')
# 26:      .from('liturgia_elementos')
```

The prayer text is in none of them. It goes to `liturgia_oraciones`, which `loadLiturgy` never queries.
**One correction to the finding:** that table is not readerless — `SavedLiturgias.tsx:66,140` reads it,
and loops the prayers back into the same standalone page. That reader is inside the graph, so the
verdict holds, but it makes the exclusion narrower than "nothing reads it" and that is now recorded,
together with its error direction: a future builder read of that table would silently pull prayer text
into the export path and nothing here would flag it.

### Executor-found while working [B4] — not a Codex finding

Tracing Group 3 exposed a defect the review did not raise. Round 1 labelled `BiblePassageFetcher.tsx`
(#30) and `SavedLiturgias.tsx` (#32) as `D1b-2` while giving as their reason the very referrer chain
that excludes them — **the stated reason contradicted the assigned label.** Both are now `no surface`
on the Group 3 chain. Tallies re-derived: `D1b-2` 17 → 15, `no surface` 29 → 31, boundary exclusions
26 → 28.

Six stale cross-references in the triage's reason column were also corrected (`#48`→`#45`,
`#46`→`#47`, `#49`→`#48`, `#52`→`#51` twice, `#57`→`#58`, `#51`→`#52`). They were off-by-N pointers to
neighbouring rows — a D-B/D-M defect, found by mapping every `#n` in the file against the row it names.

### [S1], [S2], [N1], [N2] — all applied

- **[S1]** [D1b.8] no longer reads "not applicable". It reads "D1b-1 half met — manifest verified 4/4
  and provenance anchor recorded; `D1-verify.sh` and reconciliation deferred to D1b-2."
- **[S2]** `D1-surfaces-output.md` §1a now pastes the literal 24-file output and both `comm`
  derivations with their output (16 in both, 8 outside the floor).
- **[N1]** "Four probes" → "Three probes", in §5 and in the criteria table below.
- **[N2]** The [D1b.1] row now says explicitly that it is the same check as [D1b1.1] rather than a
  second one.

### One round-1 claim of mine that was imprecise, corrected here

Round 1 said `2>/dev/null` "appears exactly once in the whole diff". Measured properly over **added
lines**, it appears five times — in the ledger entry, `D1-exclusions.md:269`, the review prompt, and
this file — every one of them prose *about* the prohibition. The precise statement, with its command,
is in §4 below. The claim was true of the evidence artifacts and false as written.

---

## 0-bis. Round 3 — **FINDINGS, phase BLOCKED.** Codex round 2 = `FAIL(2)`

**No third remediation batch was attempted, and none should be.** Codex round 2 returned two blockers,
both in round-1 categories, and closed with: *"This is the second consecutive failure in the round-1
[B2]/[B3]/[B4] categories. Overlay §5 therefore requires a hypothesis change or phase split before
round 3; another prose-only batch correction is not sufficient."* That is also this repository's rule
(`LEAN-WORKFLOW.md` §5) and the executor prompt's own instruction to stop with FINDINGS when a
load-bearing plan assumption is false. Three such assumptions are false.

### What round 3 did do — truth corrections only, no model changes

Three statements in the committed artifacts were **known to be false** once the verdict landed, and
leaving them would itself violate D-B/D-M. They are corrected; nothing else was touched.

| Codex item | Correction | Verified |
|---|---|---|
| [B1] | `D1-sink-triage.md` row #31 still carried the retracted "legacy `liturgias` table, not into the builder's liturgy". Replaced with the narrower table trace and an explicit retraction note. | `/usr/bin/grep -rn 'legacy \`liturgias\`' docs/plan/bilingue/` now returns only the two retraction paragraphs and the historical round-1 ledger entry. |
| [S1] | Row #30 cited an unquoted `fetch-bible-passage` grep whose output has four lines, one a doc comment. Replaced with the quoted pattern and its literal three invocation sites. | `liturgia/BiblePassageFetcher.tsx:68`, `presentation/BibleVerseCreator.tsx:86`, `liturgia-builder/ContextoTransversal.tsx:213`. |
| [S2] | Rows #25, #57 and #58 asserted record counts the artifact no longer matches (four email vs six, one WhatsApp vs three, two downloads vs one). Counts replaced by pointers; a BLOCKED banner added to both artifacts. | Confirmed against `grep -c '^- path: '` per file. |

**The record model itself was not touched.** Fixing it is the changed-hypothesis work, and two of its
inputs are not this phase's to decide.

### FINDINGS — three load-bearing assumptions that are false

**F1 — [D1b.5]/[D1b1.8] require records for a file the schema forbids recording.**
The criteria name `src/lib/whatsapp/templates.ts` and demand it "appear with records". §2.0 proves,
with commands, that it has no importer, that no edge function can import from `src/`, and that three
of its six templates are named by no sender. `SURFACE-SCHEMA.md` records **emissions**. Codex:
*"Mirror records are not acceptable as emission records."* Round 2 kept two of them and flagged the
tension; that was the wrong call and it is now a contract question, not an editing question.
*Resolution needed:* amend the criteria so `templates.ts` is audited in a **non-record subsection**
while the actual bodies and buttons are recorded once as `external registry` emissions.

**F2 — `text-origin` has no truthful value for platform-locale output, and the enum is hash-locked.**
Three records (`exportService.ts:761`, `ExportPanel.tsx:311`, `:484`) emit text produced by
`toLocaleDateString('es-CL', …)`. The artifact says in prose that this text is CLDR data and *not* a
repository string, while carrying `text-origin: literal in source` — a self-contradiction no legal
value resolves. The enum lives in `SURFACE-SCHEMA.md`, one of the four hash-locked artifacts, so under
D-L and [D1b.1] changing it is **a return to D1a, not an edit here**.
*Resolution needed:* add a platform-locale origin to the schema in a method phase, or define an
approved mapping onto an existing value.

**F3 — the contract specifies a record's *shape* but never how to *derive the set*.** That gap is why
two rounds of hand-written records produced inconsistent splits: round 1 under-split, round 2
over-split in some places and under-split in others, and both totals were unreliable. Codex prescribes
the fix and it is a method, not a prose edit: *"change the hypothesis from prose-by-prose splitting to
a derived reconciliation keyed by actual emission route, sink, origin, and axis."* Under D-L a
counting-and-classification method is committed and reviewed in a phase that produces **no results**,
before the phase that produces them. That is D1a's job description.

### What survived round 2, and should not be re-litigated

Codex confirmed all of this explicitly:

- **Mechanical and privacy gates pass** — manifest 4/4, census exit 0 with both streams byte-identical,
  168/1242 and 173/369/308 unchanged, floor 154/62, exact triage path coverage, source tree untouched,
  diff confined, **no personal-data value found**.
- **The Group 3 exclusion now holds.** Codex searched for views, RPCs, embedded relations,
  `presentationService` and `saveToLiturgyService` and found no read carrying
  `liturgia_oraciones.tiempos` into the builder or export path. Rows #30 and #32 correctly moved to
  `no surface`; all `#n` pointers now identify the intended rows.
- **Materiality rulings (D-I):** `BLOCKS-REPLAN` **approved** for registry-free WhatsApp copy and
  template variables — which was round 2's unrequested extension, and it was right. `DETAIL`
  **approved** for proper-noun-only records, **not approved** for the combined display-name/role
  record. That one combination is part of F3's rework.
- **The audit yield (§1), the `print` finding (§5) and the nine blind spots (§6) were not challenged.**
- The `outside boundary` triage label stays a **D1b-2** contract amendment.

### Recommended shape of the re-plan — the PM's call, not the executor's

Recorded because the overlay asks for a named hypothesis change rather than "try again". Two options,
and I recommend the first:

1. **Split the phase.** `D1b-1a` — a method phase that produces **no records**: amend `SURFACE-SCHEMA.md`
   for F1 and F2, and specify the derivation for F3 (the route × sink × origin × axis table, plus a
   script that emits the record list from it so the count is derived and not typed). `D1b-1b` — re-run
   the inventory under the new method. This is exactly the D1a/D1b shape that already worked once in
   this workstream, applied one level down, and it keeps D-L intact.
2. **Amend D1b-1 in place** with the three resolutions and re-dispatch. Cheaper, but it puts a schema
   change inside a results phase, which is the thing D-L exists to prevent.

Either way the surviving evidence — the census, the floor, the 62-row triage, the exclusions, the audit
yield and the blind spots — is reusable as-is. What is rebuilt is `D1-surfaces-output.md` §§2–4 and §7.


---

## 1. Gates — verbatim commands, unedited output, re-run after remediation

### 1.1 Method integrity, before anything was measured ([D1b1.1])

```bash
cd /Users/brentcurtis/dev/casa-pilot
( cd docs/plan/bilingue/evidence \
  && /usr/bin/shasum -a 256 -c <(/usr/bin/grep -E '^[0-9a-f]{64}' METHOD-MANIFEST.txt) )
```

```text
CENSUS-METHOD.md: OK
census.sh: OK
SURFACE-SCHEMA.md: OK
wordlist-passB.txt: OK
shasum exit=0
```

### 1.2 The census, both streams ([D1b1.2], [D1b.14])

```bash
bash docs/plan/bilingue/evidence/census.sh \
  >  docs/plan/bilingue/evidence/D1-census-raw.txt \
  2> docs/plan/bilingue/evidence/D1-census-stderr.txt
echo "census exit=$?"
git diff --quiet -- docs/plan/bilingue/evidence/D1-census-raw.txt \
                    docs/plan/bilingue/evidence/D1-census-stderr.txt
```

```text
census exit=0
re-run byte-identical to the committed artifacts
PASS_A_SUMMARY	files=168	hits=1242
PASS_B_SUMMARY	files=173	hits=369	no_accent_hits=308
AMBIGUOUS_KEEP	src/data/elementos-fijos/index.json	reason=basename-collision
```

Round 1 runtime 3.242 s against the contract's ~3.6 s. The remediation touched no method artifact, so
the census output is unchanged and byte-identical on re-run.

### 1.3 Candidate floor ([D1b1.3]), and that the triage still covers exactly it

```bash
export LC_ALL=en_US.UTF-8
SINKS='jsPDF|jspdf|\.save\(|resend|sendEmail|nodemailer|sendText|sendTemplate|templateName|WA_TEMPLATES|toDataURL|getContext\(|fillText|window\.print|download|toast\(|sonner'
/usr/bin/grep -rlE "$SINKS" src supabase --include='*.ts' --include='*.tsx' \
  | /usr/bin/grep -vE '__tests__|\.test\.| [0-9]\.tsx?$' \
  | /usr/bin/grep -iE 'liturgia|cuentacuento|children|music|presentation|graphics|export|wa-|whatsapp|packet' \
  | /usr/bin/sort > /tmp/floor.txt
/usr/bin/wc -l < /tmp/floor.txt                      # -> 62   (154 without the path filter)
/usr/bin/grep -E '^\| [0-9]+ \| `' docs/plan/bilingue/evidence/D1-sink-triage.md \
  | /usr/bin/sed -E 's/^\| [0-9]+ \| `([^`]+)`.*/\1/' | /usr/bin/sort > /tmp/triaged.txt
/usr/bin/diff /tmp/floor.txt /tmp/triaged.txt        # -> no output: EXACT MATCH
```

### 1.4 Diff confinement ([D1b1.10], [D1b.9])

```bash
git diff --stat pilot/sop-v2...HEAD
git diff --quiet e0c9342 -- src supabase && echo "source tree untouched"
```

```text
source tree untouched
```

The diff lists `docs/plan/bilingue/` only. `lint`, `test`, `build`, Playwright and `tsc` are excluded
by the contract, not skipped: the source diff is zero lines by D-A, and `npx tsc --noEmit` compiles
zero files in this repository (`evidence/BASE-GATES-d5df247.md`). `npm ci` was not run.

### 1.5 Every reference value still reproduces

| Quantity | Contract §9 | Measured | |
|---|---:|---:|---|
| `census.sh` exit / runtime | `0` / ~3.6 s | `0` / 3.24 s | ✓ |
| `PASS_A_SUMMARY` | 168 / 1242 | 168 / 1242 | ✓ |
| `PASS_B_SUMMARY` | 173 / 369 / 308 | 173 / 369 / 308 | ✓ |
| `AMBIGUOUS_KEEP` records | 1, basename-collision | identical | ✓ |
| Candidate floor | 154 repo / 62 liturgy | 154 / 62 | ✓ |
| Of the 62: `children-ministry` admin | 15 | 15 | ✓ |
| Exclusions for [D1b.13] | 77 = 76 + 1 | 250 → 174 → 173; 76 + 1 | ✓ |

---

## 2. Criteria

### D1b-1-specific

| ID | Verdict | Evidence |
|---|---|---|
| [D1b1.1] `census.sh` unmodified, integrity proven first | met | §1.1 — 4/4 recorded before §1.2 ran. |
| [D1b1.2] both streams captured, no `2>/dev/null` | met | §1.2; the precise measurement is §4. |
| [D1b1.3] candidate floor run literally, output retained | met | §1.3 — floor and triage `diff` clean. |
| [D1b1.4] all 62 triaged | met | `D1-sink-triage.md` — 62 rows, 16 / 15 / 31, each with a reason. |
| [D1b1.5] both boundary probes decided by evidence chain | met | `D1-exclusions.md` §3 Group 1 and Group 5. Both record the chain before the verdict; both exclude. |
| [D1b1.6] reverse audit over all five channels | met | `D1-surfaces-output.md` §1a (literal 24-file sweep + `comm`), §2 (`WA_TEMPLATES` seed, now with a corrected trace; `wa-webhook` inbound reply seed), §5 (`print`: **three** probes, no terminal). |
| [D1b1.7] audit-found surfaces listed first and unmissably | met | §1, before any record. Five findings now, R-01 added by the [B1] work. |
| [D1b1.8] `wa-webhook` + `templates.ts` records; 24–48 h lead time as a constraint | met | §2 — 2 records each, plus §2.0 on what `templates.ts` actually is. The lead time is recorded as a gate on any English rollout **and** as moot for the mirror. |
| [D1b1.9] no PII values | met | §4. |
| [D1b1.10] diff confined | met | §1.4. |
| [D1b1.11] blind spot stated, with direction | met | §6 — nine items now; R-01 added one that fails toward over-report. |

### [D1b.1]–[D1b.14], scoped to the five channels

| ID | Verdict | Evidence |
|---|---|---|
| [D1b.1] | met | **The same check as [D1b1.1], not a second one** — §1.1. |
| [D1b.2] | met | `fixtures/D1-census.json` reports both passes separately with a `note` stating both are lower bounds and why; §6.3 measures the Pass A gap on this phase's own files. |
| [D1b.3] | met | = [D1b1.4]. |
| [D1b.4] | met | = [D1b1.6]/[D1b1.7]. The `D1-SUMMARY.md` call-out is D1b-2's to carry; §1 is written so it can be lifted. |
| [D1b.5] | met | = [D1b1.8]. |
| [D1b.6] seven fields, no blanks, one record per origin | met | §3 — mechanically checked, and the splitting rule now stated in §0.1. |
| [D1b.7] every `UNVERIFIED` carries `materiality:` | met | 21 of 43 records; all 21 carry it. §3. |
| [D1b.8] | **D1b-1 half met** | Manifest verified 4/4 (§1.1) and provenance anchor `dee6a1a` recorded above — that is this phase's half. `D1-verify.sh` and the reconciliation are D1b-2's deliverable, and producing them here is BLOCKING under the D1b-1 scope. Wording corrected per [S1]. |
| [D1b.9] | met | §1.4. |
| [D1b.10] `D1-SUMMARY.md` | out of scope | D1b-2's, by the contract. Not produced. |
| [D1b.11] Pass B over Pass A roots ∪ `src/lib/whatsapp` | met | Run by the locked `census.sh`. 173 files. No stale total from `PLAN.md` or the six plan reviews is carried forward. |
| [D1b.12] | met | = [D1b1.11]. |
| [D1b.13] `D1-exclusions.md` | met | 77 census exclusions enumerated and attributed, 1 ambiguity keep, 28 boundary exclusions inside the 62 and 8 outside it. |
| [D1b.14] stderr captured | met | = [D1b1.2]. |

---

## 3. Counts, all derived rather than asserted

```bash
/usr/bin/grep -c '^- path: ' docs/plan/bilingue/evidence/D1-surfaces-output.md          # -> 43
/usr/bin/grep '^  sink/channel: ' docs/plan/bilingue/evidence/D1-surfaces-output.md \
  | /usr/bin/sort | /usr/bin/uniq -c
#   16 `PDF`   12 `email`   11 `WhatsApp`   4 `file download`     (print: 0, §5 of that doc)
/usr/bin/grep '^  text-origin: ' docs/plan/bilingue/evidence/D1-surfaces-output.md \
  | /usr/bin/sort | /usr/bin/uniq -c
#    1 `AI-generated`   13 `database content`   3 `declaration/registry in source`
#    2 `external registry`   24 `literal in source`
/usr/bin/grep '^  language-axis: ' docs/plan/bilingue/evidence/D1-surfaces-output.md \
  | /usr/bin/sort | /usr/bin/uniq -c
#    8 `{UI copy}`   15 `{UNVERIFIED (materiality: BLOCKS-REPLAN)}`
#    6 `{UNVERIFIED (materiality: DETAIL)}`   4 `{channel-fixed}`   10 `{stored-or-output copy}`
for k in 'path' 'symbol-or-line' 'sink/channel' 'audience' 'text-origin' 'language-axis' 'reason'; do
  /usr/bin/grep -cE "^([- ]) *${k}: " docs/plan/bilingue/evidence/D1-surfaces-output.md
done                                                       # -> 43 ×7
/usr/bin/grep -nE "^[- ] *(path|symbol-or-line|sink/channel|audience|text-origin|language-axis|reason): *$" \
  docs/plan/bilingue/evidence/D1-surfaces-output.md         # exit 1, no output

/usr/bin/grep -E '^\| [0-9]+ \| `' docs/plan/bilingue/evidence/D1-sink-triage.md \
  | /usr/bin/awk -F' \\| ' '{print $3}' | /usr/bin/sort | /usr/bin/uniq -c
#   16 `D1b-1`   15 `D1b-2`   31 `no surface`

/usr/bin/python3 -c "import json;d=json.load(open('docs/plan/bilingue/evidence/fixtures/D1-census.json'));\
print(len(d['pass_a']),len(d['pass_b']),d['pass_a_summary'],d['pass_b_summary'],d['ambiguous_keep'])"
# 168 173 {'files': 168, 'hits': 1242} {'files': 173, 'hits': 369, 'no_accent_hits': 308}
#     [{'path': 'src/data/elementos-fijos/index.json', 'reason': 'basename-collision'}]
```

**35 → 43 records.** No record was removed. Eight added by splitting composite payloads per origin
([B2]); five reclassified off `channel-fixed` ([B3]); six proper-noun and locale-date records moved to
their own entries.

**Triage 16 / 17 / 29 → 16 / 15 / 31**, from the two mislabelled rows in §0.

---

## 4. Security and privacy

- **No personal-data value appears anywhere in the diff** (D-D). The remediation added six records that
  are *about* personal data — display names in two emails and two WhatsApp variable slots, celebrant
  and preacher on the PDF cover, the preacher name baked into cover pixels — and every one names the
  column and the position only.
- Two source files hardcode a personal Gmail destination (`whatsapp-signup/index.ts:49`,
  `prayer-request/index.ts:49`), referenced by path and line; **the address is not reproduced**.
- `census.sh` never prints source-line contents, so `D1-census-raw.txt` carries paths and integers only.
- **No database access.** No Supabase MCP call, no `psql`, no migration. The [B4] table map was derived
  by reading `.from('…')` call sites in source and the two migration files, never by querying.
- Nothing merged, nothing pushed to `main`, nothing deployed.
- **`2>/dev/null`, measured precisely this time** ([D1b1.2]):

  ```bash
  git diff pilot/sop-v2 -- docs/plan/bilingue/ | /usr/bin/grep -E '^\+' | /usr/bin/grep -c '2>/dev/null'
  # -> 5
  ```

  All five are prose *about* the prohibition — one in the ledger entry, one at
  `D1-exclusions.md:269`, one in the review prompt, two in this file. **No command in any artifact uses
  the redirect.** A `grep -rn` over whole *files* rather than added lines also surfaces D1a-era
  commands in `LEDGER.md` (lines 728–1554); those predate this phase and are not in its diff.

---

## 5. The weakest part of this diff, named plainly

**Still the Group 3 exclusion, and now for a sharper reason than round 1 had.** The verdict survives
[B4], but only on one fact: `loadLiturgy` queries three tables and `liturgia_oraciones` is not among
them. That is a single line of evidence carrying a four-file exclusion, and it is a fact about this
commit rather than a property of the design — the generator and the builder already share two tables,
so nothing structural stops a third from being read tomorrow. If the reviewer wants that exclusion to
rest on more, the honest answer is that there is no more to be had from static reading.

Second: **§0.2's rule that a proper noun carries `UNVERIFIED (materiality: DETAIL)`.** Six records
depend on it. The alternative reading is that a name has no axis at all and the schema should not force
one, which would be a `FINDINGS` observation rather than something to fix here. I chose the escape
hatch the schema provides over inventing a value it does not define.

Third: **`templates.ts` keeps two records for a file that emits nothing.** [D1b.5]/[D1b1.8] name it
explicitly, so removing the records would violate a criterion; keeping them means two of 43 records
describe a mirror rather than an emission, and §2.0 has to carry that weight in prose. A reviewer could
reasonably hold that the records should go and the criterion be marked as resting on a false premise.
I did not take that route because it would discharge a criterion by deleting its subject.

---

## 6. What I could not verify

| Item | Materiality | Why |
|---|---|---|
| The WhatsApp copy a recipient actually reads | `BLOCKS-REPLAN` | It lives in WhatsApp Business Manager. [B1] makes this sharper than round 1 knew: the in-repo mirror is not merely unverified, it is *unconnected*, and three of its six entries correspond to no send at all. |
| Text baked into pixels by `slideRenderer` and `Portadas` | `BLOCKS-REPLAN` | After `html2canvas` it is image data. `SURFACE-SCHEMA.md` names OCR as the extension. |
| The strings emitted by `toLocaleDateString('es-CL', …)` at three sites | `DETAIL` | CLDR data, not repository text. Not enumerable from this codebase at all. |
| Whether `liturgia_oraciones` stays unread by the builder | `BLOCKS-REPLAN` | The whole Group 3 exclusion rests on it. Static reading cannot bound the future. |
| Whether the eight `UniversalSlide 2/3.tsx`-style P4 exclusions are live or dead | `DETAIL` | The predicate reads basename shape, not provenance. Two shadow a file that holds a recorded surface. |
| Whether a `print` path exists behind an alias or dynamic import | `DETAIL` | Three probes returned nothing. Browser Cmd-P is outside all of them. |

All are stated in `D1-surfaces-output.md` §6 with their error direction. **Eight of the nine blind
spots fail toward under-reporting**; R-01's fails the other way, and round 1 fell into it.

---

## 7. Where I think the contract may be imperfect

Not blockers. Recorded because D1b-2's contract inherits them, and because the reviewer already ruled
on two of the three at round 1.

1. **The triage vocabulary has no label for "emits, but outside the boundary."** 28 of the 62 are in
   that state and carry `no surface`. The reviewer agreed: *"The triage vocabulary should nevertheless
   gain an `outside boundary` label before D1b-2."* Not changed here — the contract fixes the three
   labels — so it is carried to D1b-2's contract.
2. **[D1b.5] presumes `templates.ts` is on the send path.** [B1] shows it is not. The criterion is
   still dischargeable (records exist, the lead time is recorded), so this is a note, not a `FINDINGS`.
3. **The `language-axis` vocabulary has no member for recipient-preferred language.** The reviewer
   approved `UNVERIFIED (materiality: BLOCKS-REPLAN)` for this at round 1 and confirmed the schema can
   represent the question. Round 2 extends the same treatment to registry-free WhatsApp copy, which is
   the same gap on a different channel.

---

## 8. Not done / open

- `D1-verify.sh`, `D1-SUMMARY.md`, the combined surfaces document, `slide render` and `toast/UI`
  records, and the `LITURGY_ORDER` seed — **all D1b-2's**, deliberately not produced.
- Backlog **[S1-plan]** (`PLAN_SHA=c842161` vs `f2be4f2` in the five method artifacts) — deferred by
  Brent, to close at D1b-2's close.
- Handed to D1b-2, recorded in `D1-sink-triage.md` §"What D1b-2 inherits": the 15 `D1b-2` files, the
  toast/slide-render halves of four `D1b-1` files, one audit find outside the 62
  (`_shared/whatsapp/phone.ts`), and the `outside boundary` label the reviewer asked for.

---

## 9. Deliverables

| Artifact | Criterion |
|---|---|
| `docs/plan/bilingue/evidence/D1-surfaces-output.md` | scope 1, [D1b1.6]–[D1b1.8], [D1b1.11] |
| `docs/plan/bilingue/evidence/fixtures/D1-census.json` | scope 2, [D1b.2] |
| `docs/plan/bilingue/evidence/D1-census-raw.txt` | scope 3, [D1b1.2] |
| `docs/plan/bilingue/evidence/D1-census-stderr.txt` | scope 3, [D1b1.2], [D1b.14] |
| `docs/plan/bilingue/evidence/D1-sink-triage.md` | scope 4, [D1b1.4] |
| `docs/plan/bilingue/evidence/D1-exclusions.md` | scope 5, [D1b.13] |
| this file | [D1b1] definition of done |
