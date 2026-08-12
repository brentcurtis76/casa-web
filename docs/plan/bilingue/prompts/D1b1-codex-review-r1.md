# CODEX REVIEW — BILINGUE D1b-1 round 1

> Paste everything below the line into Codex (`gpt-5.6-sol`, `model_reasoning_effort = high`).
> Run from `/Users/brentcurtis/dev/casa-pilot`, branch `phase/d1b1-output`.
> **Under review: commits `46f11e3` (the five artifacts) and `eb20507` (review request + ledger).**
> The branch tip carries this prompt file on top of them; that commit is docs-only and is not part of
> the work being reviewed. Review the range `pilot/sop-v2...phase/d1b1-output` — naming a fixed head
> is what went stale in D1a's review prompt.
> Phase review under the lean overlay §4.3. Codex has final say on BLOCKING.

---

SESSION: BILINGUE · D1b-1 · r1 · REVIEW

Independent review of phase **D1b-1** for CASA BILINGUE, branch `phase/d1b1-output` in
`/Users/brentcurtis/dev/casa-pilot`, base `pilot/sop-v2` @ `0fd80f2`. The work under review is
commits `46f11e3` and `eb20507`; review the range, not a fixed head. You have final say on BLOCKING;
the phase does not close until you pass it. Cumulative executor attempt: **1**.

```bash
cd /Users/brentcurtis/dev/casa-pilot
git rev-parse --path-format=absolute --git-common-dir   # -> /Users/brentcurtis/dev/casa-web/.git
git log --oneline pilot/sop-v2..phase/d1b1-output       # -> the two work commits, plus this prompt
git diff --stat pilot/sop-v2...phase/d1b1-output        # -> docs/plan/bilingue/ only
```

The 8-file, +2293-line work diff is `git diff --stat pilot/sop-v2 46f11e3` plus `eb20507`. If the tip
also shows `prompts/D1b1-codex-review-r1.md`, that is this file and it is not under review.

## What this phase is, so you review the right thing

D1b-1 is a **`DISCOVERY`** phase. It produces evidence and **no source change of any kind** — the diff
is docs-only by frozen decision D-A. Its one question: of the text this codebase sends to a person by
**PDF, email, WhatsApp, file download or print**, what is emitted, from where, and which language axis
does each emission follow?

- "The inventory is incomplete" is **not** a finding. D-N says so explicitly and `PLAN.md`
  §"What D1 does not claim" says it again: no method fixed in advance can prove completeness.
- "The artifact **claims** completeness or safety it has not tested" **is** BLOCKING (D-O). Three
  executor rounds were lost to this in D1a.
- "A stated blind spot launders a real defect" is also BLOCKING — if a rule is unsound rather than
  merely unproven, the caveat gives it no cover.
- `slide render` and `toast/UI` records, `D1-verify.sh`, `D1-SUMMARY.md` and the combined surfaces
  document belong to **D1b-2**. Producing any of them here is BLOCKING. Confirm none appeared.

## Read, in this order

1. `~/.claude/agent-workflow/LEAN-WORKFLOW.md` — the workflow in force.
2. `docs/plan/bilingue/PLAN.md` §"Phase D1b-1" (the contract), §"Phase D1b" criteria
   [D1b.1]–[D1b.14], and §"Frozen architectural decisions" D-A, D-B, D-D, D-E, D-G, D-I, D-J, D-K,
   D-L, D-M, D-N, D-O.
3. `docs/plan/bilingue/prompts/D1b1-r1.md` — the round's contract, including its out-of-scope list and
   its §9 reference values.
4. The four hash-locked method artifacts under `docs/plan/bilingue/evidence/`. **`SURFACE-SCHEMA.md`
   §"Exact liturgy-path inclusion rule", §"Candidate-floor procedure" and §"Call-path audit" are the
   operative procedure** — richer than anything in `PLAN.md`, and the standard the work is measured
   against.
5. `docs/plan/bilingue/reviews/D1b1-r1-review-request.md` — the executor's evidence, its self-named
   weakest point, and three places it says the contract may be imperfect.
6. `docs/plan/bilingue/LEDGER.md` — the D1b-1 r1 entry and the bootstrap entry above it.
7. The five output artifacts: `evidence/D1-surfaces-output.md`, `evidence/D1-sink-triage.md`,
   `evidence/D1-exclusions.md`, `evidence/fixtures/D1-census.json`, and the two committed census
   streams.

`docs/plan/SOP-PILOT.md` on this branch is the superseded v1. Ignore it.

## The three places this review is most likely to earn its cost

The executor named all three itself. Do not take its framing on trust — that is the point of an
independent review — but do not spend the review elsewhere either.

1. **The boundary exclusion of `OracionesAntifonalesGenerator.tsx` + `SlideGenerator.tsx`**
   (`D1-exclusions.md` §3 Group 3). The executor excluded both and says this is the verdict it most
   expects to be overturned. `SlideGenerator.tsx` downloads prayer PNGs and PDFs with Spanish
   filenames (351-395, 417, 442) and paints prayer text with 4 `fillText` calls. The exclusion rests
   on `SURFACE-SCHEMA.md` clause 1 anchoring on "a liturgy that begins at
   `ConstructorLiturgiasPage.tsx`", plus the observation that the builder has its own prayer path at
   `editors/OracionEditor.tsx:326`. **Rule on it explicitly.** If you overturn it, both files become
   `D1b-1` and gain `PDF` and `file download` records in *this* phase, not D1b-2's.
2. **Seven records carrying `UNVERIFIED (materiality: BLOCKS-REPLAN)`** on the axis question
   (`D1-surfaces-output.md` §0, six email records plus the music packet PDF). The argument: the
   schema offers `UI copy` (operator locale) and `stored-or-output copy` (liturgy language), and
   neither describes an email to a musician, so the axis is genuinely unresolved and resolving it
   could require a per-recipient language column — a data-shape change, hence `BLOCKS-REPLAN` rather
   than `DETAIL`. **D-I makes materiality yours to approve.** Three ways this could be wrong: the
   materiality should be `DETAIL`; `stored-or-output copy` was the right label all along and
   `UNVERIFIED` is being used to avoid a judgement; or the schema really cannot express this, in
   which case the correct verdict is `FINDINGS` and a return to D1a, not a patch here.
3. **Filenames recorded as `file download` emissions** — `Liturgia_…`, `…_Actividad_Ninos.pdf`,
   `…_cuento.pdf`, and the presentation export name. Four of the 35 records depend on the position
   that a filename is user-visible copy. If you hold it is metadata, say so; it is a clean, bounded
   correction.

## Check

1. **Gate integrity, reproduced not read.** Run the contract's gate block yourself:

   ```bash
   cd /Users/brentcurtis/dev/casa-pilot
   ( cd docs/plan/bilingue/evidence \
     && /usr/bin/shasum -a 256 -c <(/usr/bin/grep -E '^[0-9a-f]{64}' METHOD-MANIFEST.txt) )
   bash docs/plan/bilingue/evidence/census.sh > /tmp/raw.txt 2> /tmp/err.txt; echo "exit=$?"
   /usr/bin/diff /tmp/raw.txt docs/plan/bilingue/evidence/D1-census-raw.txt && echo RAW-IDENTICAL
   /usr/bin/diff /tmp/err.txt docs/plan/bilingue/evidence/D1-census-stderr.txt && echo ERR-IDENTICAL
   git diff --quiet e0c9342 -- src supabase && echo "source tree untouched"
   ```

   4/4 hashes, exit 0, both streams byte-identical to the committed artifacts, source tree clean. Any
   drift is BLOCKING.

2. **[D1b1.2] — the `2>/dev/null` prohibition.** `/usr/bin/grep -rn '2>/dev/null' $(git diff --name-only pilot/sop-v2...HEAD)`
   returns exactly one hit, `D1-exclusions.md:269`, which is prose stating the redirect is forbidden.
   Confirm no *command* in any artifact uses it, and confirm `D1-census-stderr.txt` is the real
   captured stream rather than a transcription.

3. **[D1b1.3] — the candidate floor.** Re-run the literal `SURFACE-SCHEMA.md` block. Expect 62
   liturgy-path and 154 repo-wide. Then confirm the triage table covers exactly that set:

   ```bash
   export LC_ALL=en_US.UTF-8
   SINKS='jsPDF|jspdf|\.save\(|resend|sendEmail|nodemailer|sendText|sendTemplate|templateName|WA_TEMPLATES|toDataURL|getContext\(|fillText|window\.print|download|toast\(|sonner'
   /usr/bin/grep -rlE "$SINKS" src supabase --include='*.ts' --include='*.tsx' \
     | /usr/bin/grep -vE '__tests__|\.test\.| [0-9]\.tsx?$' \
     | /usr/bin/grep -iE 'liturgia|cuentacuento|children|music|presentation|graphics|export|wa-|whatsapp|packet' \
     | /usr/bin/sort > /tmp/floor.txt
   /usr/bin/wc -l < /tmp/floor.txt                          # -> 62
   /usr/bin/grep -E '^\| [0-9]+ \| `' docs/plan/bilingue/evidence/D1-sink-triage.md \
     | /usr/bin/sed -E 's/^\| [0-9]+ \| `([^`]+)`.*/\1/' | /usr/bin/sort > /tmp/triaged.txt
   /usr/bin/diff /tmp/floor.txt /tmp/triaged.txt            # -> no output
   ```

4. **[D1b1.5] — the two named boundary probes, on evidence not path name.** `D1-exclusions.md` §3
   Group 1 excludes all 15 `children-ministry` admin components, Group 5 excludes `whatsapp-signup`.
   Re-run the greps quoted there. Attack them: is the import-graph argument complete? Is there a lazy
   or dynamically composed route that would not appear? For Group 1 the executor also argues the
   packet email composes from `church_children_*` rows rather than component literals — verify that
   at `send-children-service-packet/index.ts:338-362`. Note that even overturned, Group 1's emissions
   are all `toast(` and would land in D1b-2, so the stakes there are lower than Group 3's.

5. **[D1b1.6]/[D1b1.7] — the reverse audit, which the plan itself calls the criterion most likely to
   be satisfied shallowly.** The executor's answer has two halves and both need testing.
   - *File level:* it swept the repo for terminal calls with a `TERM` pattern set
     (`D1-surfaces-output.md` §1a), found 24 files, 8 outside the 62, and excluded all 8 on clause 1.
     **Is `TERM` adequate?** A helper wrapping `fetch` to an email vendor, a dynamically imported PDF
     library, a Graph call assembled from fragments — each would be invisible. Try to construct or
     find one. If you find a real in-scope emitter outside both lists, that is the single most
     valuable finding available in this review.
   - *Record level:* four audit finds are claimed (R-05 `wa-reminders` `formatDateEs` + `"voluntario"`
     into template variables; R-24 `UniversalSlide.tsx:486`; R-25 `Portadas.tsx:315,449`; and
     `_shared/whatsapp/payload.ts:42` deliberately recorded as a **non**-record). Verify each chain.
     Is the payload.ts call right — the schema records emissions, and this code only recognises
     inbound text — or is that an evasion?
   - *Mandatory seeds:* `WA_TEMPLATES` and a WhatsApp **reply** handler, not only outbound sends.
     Confirm both are actually traced, not merely mentioned.

6. **[D1b1.8] / [D1b.5].** `wa-webhook/index.ts` and `src/lib/whatsapp/templates.ts` must both carry
   records, and the **24–48 h re-approval lead time** must be recorded as a constraint on an English
   rollout, not merely as a string. Judge whether the executor's split — `templates.ts` as
   `declaration/registry in source` versus `send-core.ts` as `external registry`, on the ground that
   the copy a recipient reads lives in WhatsApp Manager and can drift from the repo — is a real
   distinction or record inflation.

7. **[D1b.6]/[D1b.7] — schema conformance, mechanically.** 35 records, seven fields each, no blanks,
   every `UNVERIFIED` carrying `materiality:`. The review request §3 gives the commands; run them.
   Then read a sample of records against `SURFACE-SCHEMA.md` §"Fields and allowed values": are the
   `audience`, `text-origin` and `language-axis` members legal, spelled as the table spells them, and
   in the order the table gives? Is any record a composite payload that should have been split per
   origin, or two records that are really one emission?

8. **[D1b.13] — the exclusions enumeration.** Re-derive the arithmetic: 250 candidates → 174 after
   stage one → 173 after stage two; 76 + 1 = 77. Check the predicate attribution, including the
   claim that **P2 (`-not -name '*.test.*'`) excludes nothing on its own** because P1 claims every
   such file first. Check the ambiguity keep is the one `census.sh` actually recorded. Then ask the
   question the criterion exists for: reading this list, was anything real dropped?

9. **The census gap the artifacts claim to have measured.** `D1-surfaces-output.md` §6.2 asserts the
   Pass A blind spot is worst on exactly this phase's channels because the edge functions are written
   without accents — `send-children-service-packet/index.ts` at `PASS_A hits=0` while carrying a full
   Spanish email, `send-music-service-packet/index.ts` at `1` over 606 lines. Verify against
   `D1-census-raw.txt` and the source. If true this is the phase's most decision-useful number; if
   overstated, it is a D-B/D-M violation.

10. **D-D / privacy, which outranks every other criterion here.** No personal-data value anywhere in
    the diff. Two source files hardcode a personal Gmail destination and are cited by path and line
    only (`whatsapp-signup/index.ts:49`, `prayer-request/index.ts:49`) — confirm the value is not
    reproduced anywhere, including in `D1-census-raw.txt`. Confirm no database was queried.

11. **D-E — describes, does not prescribe.** 35 records and three long prose artifacts are a lot of
    surface for a recommendation to hide in. Does any sentence tell someone how a surface *should* be
    made bilingual? The §0 axis convention and the §7 "contract may be imperfect" section are the two
    places most at risk.

12. **D-B / D-M.** Every claim carries the literal command that produced it, executed, with its
    literal output. Three consecutive D1a drafts failed on prose drifting from the run. Spot-check the
    counts in the review request against the artifacts — the executor corrected its own record tally
    from 34 to 35 and its triage tally from 16/21/25 to 16/17/29 after checking mechanically, so the
    committed numbers should all be derived. Verify they are.

13. **Scope and next-phase cost.** Only the five contracted artifacts plus the review request and
    ledger entry. Nothing from D1b-2 produced. Then: **is `D1-sink-triage.md` actually usable as
    D1b-2's starting input?** The executor flags that the triage vocabulary has no label for "emits,
    but outside the boundary" — 26 of the 62 are in that state and carry `no surface`, which is
    misleading on its face. Rule on whether that is a BLOCKING mislabel, a SHOULD-FIX, or correct
    given the contract's fixed vocabulary.

14. **[D1b.8] — rule on this.** The criterion requires `D1-verify.sh` to verify every manifest
    artifact. That script is D1b-2's deliverable and producing it here is BLOCKING under the D1b-1
    scope. The executor ran the hash check itself (4/4, §1.1) and deferred the script. Satisfied in
    substance, or does the criterion bind this phase?

Review against the contract, not your preferences. Taste disagreements are NITs. Only correctness,
contract violations, privacy/security violations and architectural violations are BLOCKING.

If your verdict is that the **contract** is wrong rather than the work — most plausibly on the
`language-axis` gap in item 2, or the triage vocabulary in item 13 — return `FINDINGS` rather than
`FAIL`. That routes to a re-plan, not to another executor round.

Output using the CODEX REVIEW format:

```
## CODEX REVIEW — D1b-1 round 1
VERDICT: PASS | FAIL | FINDINGS
BLOCKING:
- [B1] <finding> — <file:line> — <violated criterion or invariant> — <smallest safe correction>
SHOULD-FIX:
- [S1] ...
NITS:
- [N1] ...
NOTES ON THE PLAN ITSELF: <if the plan, not the work, is the problem>
```
