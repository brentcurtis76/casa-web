# D1b-1 · round 1 — review request

| | |
|---|---|
| Workstream | BILINGUE |
| Phase | **D1b-1** — recipient-facing channels |
| Attempt | 1 (cumulative) |
| Risk tier | `DISCOVERY` |
| Worktree | `/Users/brentcurtis/dev/casa-pilot` |
| Git common dir | `/Users/brentcurtis/dev/casa-web/.git` |
| Branch | `phase/d1b1-output` |
| Base | `pilot/sop-v2` @ `0fd80f2` (the contract commit) |
| Artifact SHA | `46f11e3cf6b898614a791b41effc1335d12786f6` |
| Gate baseline | `d5df247` — `evidence/BASE-GATES-d5df247.md` |
| Provenance anchor | `dee6a1a` ([D1b.8]) |
| Started / ended | `2026-08-12T14:05:58Z` / `2026-08-12T14:26:35Z` |
| Source diff | **zero lines** (D-A) |

**Review the cumulative diff `pilot/sop-v2...phase/d1b1-output`.** It is six new files, all under
`docs/plan/bilingue/evidence/`.

---

## 1. Gates — verbatim commands, unedited output

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

**4/4.** All four method artifacts are byte-identical to their D1a hashes; `census.sh` was run
unmodified and no method artifact appears in the diff.

### 1.2 The census, both streams ([D1b1.2], [D1b.14])

```bash
bash docs/plan/bilingue/evidence/census.sh \
  >  docs/plan/bilingue/evidence/D1-census-raw.txt \
  2> docs/plan/bilingue/evidence/D1-census-stderr.txt
echo "census exit=$?"
```

```text
census exit=0
re-run byte-identical to the committed artifacts
```

Runtime `3.242 s` total (`time bash …`), against the contract's `~3.6 s`. The gate block was run a
second time after committing and the re-run reproduced both files byte for byte
(`git diff --quiet -- D1-census-raw.txt D1-census-stderr.txt`, exit 0).

```bash
/usr/bin/grep -E '^PASS_[AB]_SUMMARY' docs/plan/bilingue/evidence/D1-census-raw.txt
/bin/cat docs/plan/bilingue/evidence/D1-census-stderr.txt
```

```text
PASS_A_SUMMARY	files=168	hits=1242
PASS_B_SUMMARY	files=173	hits=369	no_accent_hits=308
AMBIGUOUS_KEEP	src/data/elementos-fijos/index.json	reason=basename-collision
```

### 1.3 Candidate floor ([D1b1.3])

```bash
export LC_ALL=en_US.UTF-8
SINKS='jsPDF|jspdf|\.save\(|resend|sendEmail|nodemailer|sendText|sendTemplate|templateName|WA_TEMPLATES|toDataURL|getContext\(|fillText|window\.print|download|toast\(|sonner'
/usr/bin/grep -rlE "$SINKS" src supabase --include='*.ts' --include='*.tsx' \
  | /usr/bin/grep -vE '__tests__|\.test\.| [0-9]\.tsx?$' \
  | /usr/bin/grep -iE 'liturgia|cuentacuento|children|music|presentation|graphics|export|wa-|whatsapp|packet' \
  | /usr/bin/sort | /usr/bin/wc -l          # -> 62
# same pipeline without the liturgy-path filter                    -> 154
```

### 1.4 Diff confinement ([D1b1.10], [D1b.9])

```bash
git diff --stat pilot/sop-v2...HEAD
git diff --quiet e0c9342 -- src supabase && echo "source tree untouched"
```

```text
 docs/plan/bilingue/evidence/D1-census-raw.txt      | 343 ++++++++++++++
 docs/plan/bilingue/evidence/D1-census-stderr.txt   |   1 +
 docs/plan/bilingue/evidence/D1-exclusions.md       | 487 +++++++++++++++++++
 docs/plan/bilingue/evidence/D1-sink-triage.md      | 145 ++++++
 docs/plan/bilingue/evidence/D1-surfaces-output.md  | 526 +++++++++++++++++++++
 .../plan/bilingue/evidence/fixtures/D1-census.json | 364 ++++++++++++++
 6 files changed, 1866 insertions(+)
source tree untouched
```

`lint`, `test`, `build`, Playwright and `tsc` are excluded by the contract, not skipped: the source
diff is zero lines by D-A, and `npx tsc --noEmit` compiles zero files in this repository. See
`evidence/BASE-GATES-d5df247.md`. `npm ci` was **not** run; `node_modules` holds 360 entries.

### 1.5 Every reference value reproduced

| Quantity | Contract §9 | Measured | |
|---|---:|---:|---|
| `census.sh` exit / runtime | `0` / ~3.6 s | `0` / 3.24 s | ✓ |
| `PASS_A_SUMMARY` | 168 / 1242 | 168 / 1242 | ✓ |
| `PASS_B_SUMMARY` | 173 / 369 / 308 | 173 / 369 / 308 | ✓ |
| `AMBIGUOUS_KEEP` records | 1, `elementos-fijos/index.json`, basename-collision | identical | ✓ |
| Candidate floor | 154 repo / 62 liturgy | 154 / 62 | ✓ |
| Of the 62: `children-ministry` admin | 15 | 15 | ✓ |
| Exclusions for [D1b.13] | 77 = 76 + 1 | 250 → 174 → 173; 76 + 1 = 77 | ✓ |

**No discrepancy arose, so nothing needed reporting under D-K.**

---

## 2. Criteria

### D1b-1-specific

| ID | Verdict | Evidence |
|---|---|---|
| [D1b1.1] `census.sh` unmodified, integrity proven first | **met** | §1.1 — 4/4 recorded before §1.2 ran. |
| [D1b1.2] both streams captured, no `2>/dev/null` | **met** | §1.2. `D1-census-raw.txt` (343 lines) and `D1-census-stderr.txt` (1 line) are committed verbatim. See §5 for the one prose occurrence of the string. |
| [D1b1.3] candidate floor run literally, output retained | **met** | §1.3; the 62 paths are the table in `D1-sink-triage.md`, and a `diff` proves that table covers exactly the floor (§3 below). |
| [D1b1.4] all 62 triaged | **met** | `D1-sink-triage.md` — 62 rows, 16 `D1b-1` / 17 `D1b-2` / 29 `no surface`, each with a reason. |
| [D1b1.5] both boundary probes decided by evidence chain | **met** | `D1-exclusions.md` §3 Group 1 (15 `children-ministry`) and Group 5 (`whatsapp-signup`). Both record the chain before the verdict; both exclude. |
| [D1b1.6] reverse audit over all five channels | **met** | `D1-surfaces-output.md` §1a (repo-wide terminal sweep), §2 (`WA_TEMPLATES` seed; `wa-webhook` inbound reply seed), §5 (`print`: four probes, no terminal). |
| [D1b1.7] audit-found surfaces listed first and unmissably | **met** | `D1-surfaces-output.md` §1, before any record. Answer has two halves and both are stated. |
| [D1b1.8] `wa-webhook` + `templates.ts` records; 24–48 h lead time as a constraint | **met** | §2 — 2 records each for `templates.ts` (body, buttons) and `wa-webhook` (confirmation, opt-out). The lead time is recorded as a gate on any English rollout, per template. |
| [D1b1.9] no PII values | **met** | §4 below. |
| [D1b1.10] diff confined | **met** | §1.4. |
| [D1b1.11] blind spot stated, with direction | **met** | `D1-surfaces-output.md` §6 — seven items, each with its error direction and a named extension. |

### [D1b.1]–[D1b.14], scoped to the five channels

| ID | Verdict | Evidence |
|---|---|---|
| [D1b.1] | met | §1.1. |
| [D1b.2] | met | `fixtures/D1-census.json` reports both passes separately with a `note` field stating both are lower bounds and why; `D1-surfaces-output.md` §6.2 measures the Pass A gap on this phase's own files. |
| [D1b.3] | met | = [D1b1.4]. |
| [D1b.4] | met | = [D1b1.6]/[D1b1.7]. The call-out into `D1-SUMMARY.md` is D1b-2's to carry; §1 is written so it can be lifted. |
| [D1b.5] | met | = [D1b1.8]. |
| [D1b.6] seven fields, no blanks | met | §3 below — mechanically checked. |
| [D1b.7] every `UNVERIFIED` carries `materiality:` | met | 7 of 35 records; all seven carry it. §3. |
| [D1b.8] | **not applicable to this phase** | `D1-verify.sh` is D1b-2's deliverable and producing it here is a BLOCKING finding. The hash check it must perform was nonetheless executed here (§1.1) and the anchor `dee6a1a` is recorded above. |
| [D1b.9] | met | §1.4. |
| [D1b.10] `D1-SUMMARY.md` | **out of scope** | D1b-2's, by the contract. Not produced. |
| [D1b.11] Pass B over Pass A roots ∪ `src/lib/whatsapp` | met | Run by the locked `census.sh`, which defines `PASS_B_ROOTS=("${PASS_A_ROOTS[@]}" src/lib/whatsapp)`. 173 files. **No stale total from `PLAN.md` or the six plan reviews is carried forward** — all four superseded figures were checked against and none appears in any artifact. |
| [D1b.12] | met | = [D1b1.11]. |
| [D1b.13] `D1-exclusions.md` | met | §3 below — 77 census exclusions enumerated and attributed, plus the 1 ambiguity keep, plus 26 boundary exclusions inside the 62 and 8 outside it. |
| [D1b.14] stderr captured | met | = [D1b1.2]. |

---

## 3. Counts, all derived rather than asserted

```bash
# records and their seven fields
/usr/bin/grep -c '^- path: ' docs/plan/bilingue/evidence/D1-surfaces-output.md          # -> 35
/usr/bin/grep '^  sink/channel: ' docs/plan/bilingue/evidence/D1-surfaces-output.md \
  | /usr/bin/sort | /usr/bin/uniq -c
#   14 `PDF`   9 `WhatsApp`   8 `email`   4 `file download`      (print: 0, see §5 of that doc)
/usr/bin/grep '^  language-axis: ' docs/plan/bilingue/evidence/D1-surfaces-output.md \
  | /usr/bin/sort | /usr/bin/uniq -c
#    8 `{UI copy}`  7 `{UNVERIFIED (materiality: BLOCKS-REPLAN)}`
#    8 `{channel-fixed}`  12 `{stored-or-output copy}`
/usr/bin/grep -nE "^[- ] *(path|symbol-or-line|sink/channel|audience|text-origin|language-axis|reason): *$" \
  docs/plan/bilingue/evidence/D1-surfaces-output.md      # exit 1, no output — no blank field

# triage covers exactly the 62, no extras and no omissions
/usr/bin/grep -E '^\| [0-9]+ \| `' docs/plan/bilingue/evidence/D1-sink-triage.md \
  | /usr/bin/sed -E 's/^\| [0-9]+ \| `([^`]+)`.*/\1/' | /usr/bin/sort > /tmp/triaged.txt
/usr/bin/diff /tmp/floor62.txt /tmp/triaged.txt         # -> no output: EXACT MATCH
/usr/bin/grep -E '^\| [0-9]+ \| `' docs/plan/bilingue/evidence/D1-sink-triage.md \
  | /usr/bin/awk -F' \\| ' '{print $3}' | /usr/bin/sort | /usr/bin/uniq -c
#   16 `D1b-1`   17 `D1b-2`   29 `no surface`

# census fixture is internally consistent with its own summaries
/usr/bin/python3 -c "import json;d=json.load(open('docs/plan/bilingue/evidence/fixtures/D1-census.json'));\
print(len(d['pass_a']),len(d['pass_b']),d['pass_a_summary'],d['pass_b_summary'],d['ambiguous_keep'])"
# 168 173 {'files': 168, 'hits': 1242} {'files': 173, 'hits': 369, 'no_accent_hits': 308}
#     [{'path': 'src/data/elementos-fijos/index.json', 'reason': 'basename-collision'}]
```

| Channel | Records |
|---|---:|
| PDF | 14 |
| WhatsApp | 9 |
| email | 8 |
| file download | 4 |
| print | 0 |
| **Total** | **35** |

Far below the 200-record split trigger, as the contract's sizing predicted.

Triage over the 62: **16 `D1b-1`**, **17 `D1b-2`**, **29 `no surface`** — of the last, 3 are regex
false positives with no emission at all and 26 emit but fall outside the inclusion boundary.

---

## 4. Security and privacy

- **No personal-data value appears anywhere in the diff.** Celebrant, preacher, musician and volunteer
  identities are recorded as field names and positions — `liturgyContext.celebrant`,
  `liturgyContext.preacher`, `music_musicians.display_name`, `variables[0]` — never as values (D-D).
- Two source files hardcode a personal Gmail address as an email destination
  (`supabase/functions/whatsapp-signup/index.ts:49`, `supabase/functions/prayer-request/index.ts:49`).
  Both are referenced by path and line; **the address is not reproduced**, and it is recorded as a
  shape finding in `D1-exclusions.md` §3 Group 5.
- `census.sh` never prints source-line contents, so `D1-census-raw.txt` carries paths and integers
  only. Verified by inspection of the committed file: every line is `PASS_A|PASS_B|…_SUMMARY` + path +
  counts.
- **No database access.** No Supabase MCP call, no `psql`, no migration. D1 has no DB-derived facts and
  the CASA project is shared with Life OS.
- Nothing merged, nothing pushed to `main`, nothing deployed. `phase/d1b1-output` exists locally.

---

## 5. The weakest part of this diff, named plainly

**The inclusion-boundary exclusion of `OracionesAntifonalesGenerator.tsx` + `SlideGenerator.tsx`
(`D1-exclusions.md` §3 Group 3).** It is the one verdict I would expect a reviewer to overturn.

The case for excluding: the pair is reachable only from `/admin/liturgia/oraciones`, it persists to the
legacy `liturgias` table rather than to the builder's liturgy, and the builder has its own prayer path
(`editors/OracionEditor.tsx:326`) reaching the same edge function. Clause 1 of the inclusion rule
anchors on "a liturgy that begins at `ConstructorLiturgiasPage.tsx`", and none of that chain does.

The case against: `SlideGenerator.tsx` downloads prayer PNGs and PDFs with Spanish file names and
paints prayer text into canvases with 4 `fillText` calls. If a reviewer reads clause 1's third bullet —
"producing a story, **prayer**, …" — as covering any prayer artefact rather than only builder-sourced
ones, this becomes a `D1b-1` file and gains `PDF` and `file download` records **in this phase**.

I decided it by the rule's own instruction that where no chain is found, exclusion is required. I do
not think the rule is ambiguous; I think it is easy to read the other way, and the cost of being wrong
lands here rather than in D1b-2.

Two further soft spots, ranked below that one:

1. **The `{UNVERIFIED (materiality: BLOCKS-REPLAN)}` axis on the six email records plus the packet
   PDF.** `SURFACE-SCHEMA.md` offers `UI copy` (operator locale) and `stored-or-output copy` (liturgy
   language) and neither describes an email to a musician. I used `UNVERIFIED` + `BLOCKS-REPLAN` rather
   than forcing a fit or returning FINDINGS, and stated the reasoning once in §0 instead of improvising
   per record. **D-I says the reviewer approves materiality — this is the call I most want checked.**
   If the reviewer holds that the schema simply cannot express a recipient-preference axis, that is a
   FINDINGS return to D1a, not something to patch here.
2. **Filenames counted as `file download` emissions.** `Liturgia_…`, `…_Actividad_Ninos.pdf`,
   `…_cuento.pdf` and the presentation export name are user-visible Spanish delivered by the download,
   so I recorded them. A reviewer could reasonably hold that a filename is metadata, not copy. Four
   records depend on this; none of the other 31 does.

**A note so a mechanical check does not misfire:** `/usr/bin/grep -rn '2>/dev/null'` over the diff
returns exactly one hit, `D1-exclusions.md:269`, which is prose stating that the redirect is forbidden.
No command in any artifact uses it.

---

## 6. What I could not verify

| Item | Materiality | Why |
|---|---|---|
| The WhatsApp copy a recipient actually reads | `BLOCKS-REPLAN` | It lives in WhatsApp Business Manager. I recorded the accessor and the template key and never read a body (`SURFACE-SCHEMA.md` forbids copying it). The in-repo `WA_TEMPLATES` declaration can have drifted from the approved copy and nothing in this repository would detect it. This is what the 24–48 h re-approval constraint attaches to. |
| Text baked into pixels by `slideRenderer` and `Portadas` | `BLOCKS-REPLAN` | After `html2canvas` the slide text and the preacher name are image data. No static method can enumerate them; `SURFACE-SCHEMA.md` names OCR as the extension. |
| Whether the eight `UniversalSlide 2/3.tsx`-style P4 exclusions are live or dead | `DETAIL` | The predicate reads the basename shape, not provenance. Two of them shadow a file that holds a recorded surface. Enumerated in `D1-exclusions.md` §1. |
| Whether any `.json` reached by a runtime-assembled path was dropped by stage two | `DETAIL` | The named failure mode of stage two. Undetectable by the rule; `census.sh`'s ambiguity branch recorded one keep and does not claim to catch this case. |
| Whether a `print` path exists behind an alias or dynamic import | `DETAIL` | Three probes returned nothing (`D1-surfaces-output.md` §5). Browser Cmd-P on any rendered page is outside all of them and outside this repository's ability to observe. |

Every one of these is stated in `D1-surfaces-output.md` §6 with its error direction. **Six of the seven
blind spots fail toward under-reporting**; only runtime instrumentation would fail the other way, and
that is a method extension, not something this pass could do.

---

## 7. Where I think the contract may be imperfect

Not blockers — I completed the phase as specified. Recorded because a `FINDINGS` return is cheaper than
a wrong inventory, and because D1b-2's contract will inherit these.

1. **The triage vocabulary has no label for "emits, but outside the boundary."** The contract allows
   `D1b-1`, `D1b-2`, `no surface`. Twenty-six of the 62 emit real Spanish and are excluded on the
   inclusion rule — `templateCompositor.ts` bakes text into pixels at 21 sites and downloads the
   result. Calling that "no surface" is the closest available label and it is misleading on its face,
   so every such row spells the reason out and `D1-exclusions.md` §3 re-derives all 26. **D1b-2's
   contract should add a fourth label.**
2. **[D1b.8] cannot be discharged in D1b-1.** It requires `D1-verify.sh`, which the D1b-1 scope
   explicitly makes a BLOCKING finding if produced here. I read the criterion as satisfied in substance
   by §1.1 and deferred the script to D1b-2; the contract could say so directly.
3. **The `language-axis` vocabulary has no member for recipient-preferred language.** See §5.2. The
   `UNVERIFIED` + materiality escape hatch covers it honestly, but seven of 35 records leaning on an
   escape hatch is a signal about the schema, not about those seven emissions.

---

## 8. Not done / open

- `D1-verify.sh`, `D1-SUMMARY.md`, the combined surfaces document, `slide render` and `toast/UI`
  records, and the `LITURGY_ORDER` seed — **all D1b-2's**, deliberately not produced (§5 of the
  contract makes producing them here BLOCKING).
- Backlog **[S1]** (`PLAN_SHA=c842161` vs `f2be4f2` in the five method artifacts) — deferred by Brent,
  to close at D1b-2's close, not here.
- Handed to D1b-2 and recorded in `D1-sink-triage.md` §"What D1b-2 inherits": the 17 `D1b-2` files, the
  toast/slide-render halves of four `D1b-1` files, and one audit find outside the 62
  (`supabase/functions/_shared/whatsapp/phone.ts` — six Spanish rejection reasons reaching an operator
  toast).

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
