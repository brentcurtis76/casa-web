# CODEX RE-REVIEW — BILINGUE D1b-1 round 2

> Paste everything below the line into Codex (`gpt-5.6-sol`, `model_reasoning_effort = high`).
> Run from `/Users/brentcurtis/dev/casa-pilot`, branch `phase/d1b1-output`.
> **Under review: the cumulative diff `pilot/sop-v2...phase/d1b1-output`**, i.e. round 1 (`46f11e3`,
> `eb20507`) plus the remediation commit `6254538`. The branch tip may carry this prompt file on top;
> that commit is docs-only and is not part of the work.
> Re-review under the lean overlay §4.3. Codex has final say on BLOCKING.

---

SESSION: BILINGUE · D1b-1 · r2 · RE-REVIEW

You reviewed this phase once and returned `FAIL(4)`. The same executor fixed all four blockers as one
batch, in the same conversation, per the lean overlay. **Re-review the cumulative diff**, not just the
remediation commit — the overlay requires the whole phase diff to pass, and a fix can break something
it did not touch.

Cumulative attempt: **2**. Two consecutive failures in the same defect category would require a
hypothesis change or a phase split before more work (overlay §5), so if you fail this round, say
explicitly whether your blockers are the same category as round 1's.

```bash
cd /Users/brentcurtis/dev/casa-pilot
git log --oneline pilot/sop-v2..phase/d1b1-output
git diff --stat pilot/sop-v2...phase/d1b1-output    # docs/plan/bilingue/ only
git diff eb20507..6254538 -- docs/plan/bilingue/    # the remediation alone, if useful
```

## What you found, and what the executor did with it

**All four blockers were accepted. None was argued down.** Two were reported as worse than your
verdict stated, and two changes were made that you did **not** ask for. Read
`reviews/D1b1-r1-review-request.md` §0 first — it is the remediation log, blocker by blocker, with the
verifying command and its output for each.

| | Your finding | Disposition |
|---|---|---|
| [B1] | `WA_TEMPLATES` chain does not exist | Accepted. Executor adds: **no edge function imports from `src/` at all**, so the flow is impossible across a runtime boundary, and **three of the six templates are named by no sender** — including `opt_in_bienvenida`, which invalidated a second record's reason. New `D1-surfaces-output.md` §2.0. |
| [B2] | composite payloads not split per origin | Accepted, all four. Split into 8 additional records; rule stated once in a new §0.1. |
| [B3] | axis contradictions | Accepted. **Extended without being asked** to template *variables* (`wa-reminders` `formatDateEs`, the fan-out `formattedDate`), on the ground that Meta approves the body and not the substitutions. Locale dates split out rather than relabelled. |
| [B4] | false persistence distinction | Accepted; round 1's claim retracted. Verdict survives on `loadLiturgy` not querying `liturgia_oraciones`. **Executor corrects your finding**: that table is not readerless — `SavedLiturgias.tsx:66,140` reads it. |
| [S1] [S2] [N1] [N2] | | All applied. |

Two changes you did not ask for, both disclosed as executor-found:

- Triage rows **#30 `BiblePassageFetcher.tsx`** and **#32 `SavedLiturgias.tsx`** moved from `D1b-2` to
  `no surface`. Round 1 had labelled them `D1b-2` while giving as their reason the referrer chain that
  excludes them.
- Six off-by-N `#n` cross-references in the triage's reason column corrected.

And one round-1 claim the executor retracted on its own: `2>/dev/null` "appears exactly once in the
whole diff" was false as written — five occurrences over added lines, all prose about the prohibition.

## Read

1. `reviews/D1b1-r1-review-request.md` — **§0 is the remediation log**; §1 the re-run gates; §5 the
   self-named weakest points.
2. `LEDGER.md` — the D1b-1 round 2 entry, then round 1's above it.
3. The changed artifacts: `evidence/D1-surfaces-output.md` (§0, §1, §2.0, §2–§4, §6, §7 all moved),
   `evidence/D1-exclusions.md` §3 Group 3 (rewritten), `evidence/D1-sink-triage.md` (rows 30, 32,
   tallies, cross-references).
4. Unchanged and still governing: `PLAN.md` §"Phase D1b-1", the four hash-locked method artifacts,
   `prompts/D1b1-r1.md`. `prompts/D1b1-codex-review-r1.md` is your round-1 prompt, kept for history.

The frozen decisions still bind: D-A (no source change), D-B/D-M (literal command, literal output),
D-D (no PII values), D-E (describe, do not prescribe), D-I (materiality is yours to approve), D-J,
D-N/D-O (no untested absolutes; a stated blind spot does not launder a real defect).

## Check — the four fixes first

1. **[B1] — is the corrected account of `templates.ts` right, and is it now recorded honestly?**
   Re-run §2.0's three commands. Confirm no importer, confirm the three unreferenced template names,
   confirm the runtime boundary. Then judge the disposition: the file **keeps two records** although it
   emits nothing, because [D1b.5]/[D1b1.8] name it explicitly. The executor calls this out as a weakest
   point (§5) and argues that deleting the records would discharge a criterion by deleting its subject.
   **Rule on it.** Is "records that describe a mirror" acceptable under the schema, which records
   *emissions* — or should they go, with [D1b.5] marked as resting on a false premise? Also check the
   knock-on: does the `wa-webhook:150` record still claim anything about `opt_in_bienvenida` that the
   trace does not support?

2. **[B2] — did splitting actually fix it, or just multiply records?** The count went 35 → 43. For each
   of the four splits, confirm the two halves really have different origins and that no *new* composite
   was created in the process. Then sweep the other 35 records with the same lens — §0.1 claims the rule
   is now applied uniformly, and that is a stronger claim than fixing four instances. Is there a
   remaining record whose `reason` names two origins?

3. **[B3] — check the extension, not only the fix.** Three `sendText` literals moved off
   `channel-fixed`; verify. Then rule on the executor's unrequested extension: **is a template variable
   really not `channel-fixed`?** The argument is that Meta approves the body and not the substitutions,
   so nothing external fixes the variable's language. If you disagree, this is a fresh blocker in the
   same category as [B3] and you should say so — that is what triggers the overlay's two-failures rule.
   Also verify the locale-date splits at `ExportPanel.tsx:311` and `:484` land on the right axis:
   `:311` feeds a recipient-facing packet PDF, `:484` an operator-read guide, and they were given
   different axes for that reason. Four `channel-fixed` records survive — are those four right?

4. **[B4] — is the narrower verdict sound, and is the correction to your finding correct?**
   Re-derive the table map (`D1-exclusions.md` §3 Group 3 gives the loop). Confirm `loadLiturgy` reads
   exactly `liturgias`, `liturgia_lecturas`, `liturgia_elementos`. Confirm `SavedLiturgias.tsx:66,140`
   is the only other toucher of `liturgia_oraciones` and that it loops back inside the graph rather than
   into the builder. **Then attack the remaining exclusion**: four files now rest on one negative fact
   about one function's read set. Is there any other path — a view, an RPC, a `select` with an embedded
   relation, `presentationService`, `saveToLiturgyService` — by which prayer text reaches an export? If
   there is, this is BLOCKING and `SlideGenerator.tsx` gains `PDF` and `file download` records in this
   phase.

## Check — what the fixes might have broken

5. **Executor-found triage moves.** #30 and #32 → `no surface`. Verify the referrer chains
   (`BiblePassageFetcher` ← `LiturgiaForm` ← `OracionesAntifonalesGenerator`; `SavedLiturgias` ←
   `OracionesAntifonalesGenerator`). Verify the claim added to #30 that the builder reaches
   `fetch-bible-passage` through `ContextoTransversal.tsx:213` instead, and that there are exactly three
   call sites. Then check the tallies re-derived from it: 16 / 15 / 31, boundary exclusions 28.

6. **Cross-reference integrity.** Six `#n` pointers were corrected. Map **every** `#n` in
   `D1-sink-triage.md` against the row it names and confirm none is still wrong — the class of defect
   matters more than the six instances.

7. **Gates, reproduced not read.** Nothing in the remediation touched a method artifact, so the census
   must be unchanged. Verify:

   ```bash
   cd /Users/brentcurtis/dev/casa-pilot
   ( cd docs/plan/bilingue/evidence \
     && /usr/bin/shasum -a 256 -c <(/usr/bin/grep -E '^[0-9a-f]{64}' METHOD-MANIFEST.txt) )
   bash docs/plan/bilingue/evidence/census.sh > /tmp/raw.txt 2> /tmp/err.txt; echo "exit=$?"
   /usr/bin/diff /tmp/raw.txt docs/plan/bilingue/evidence/D1-census-raw.txt && echo RAW-IDENTICAL
   /usr/bin/diff /tmp/err.txt docs/plan/bilingue/evidence/D1-census-stderr.txt && echo ERR-IDENTICAL
   git diff --quiet e0c9342 -- src supabase && echo "source tree untouched"
   ```

   Then the floor and the triage coverage, with the block in `D1-sink-triage.md`: 62 / 154, and
   `diff` between the floor and the triage table's path column must be empty.

8. **Counts, all of them, derived from the artifacts rather than from the review request.** 43 records;
   16 PDF / 12 email / 11 WhatsApp / 4 file download / 0 print; seven fields on all 43 with no blanks;
   21 records carrying `materiality:`. The commands are in `reviews/D1b1-r1-review-request.md` §3. Round
   1's tallies were wrong twice before the executor re-derived them, so verify rather than read.

9. **D-D, which outranks everything here.** The remediation **added six records that are about personal
   data** — display names in two emails and two WhatsApp variable slots, celebrant and preacher on the
   PDF cover, the preacher name in cover pixels. Confirm every one names column and position only and
   that no value appears anywhere in the diff, including `D1-census-raw.txt`. Confirm the [B4] table map
   was derived from source and migrations, not from a database query.

10. **D-E, on the new prose.** §0.1, §0.2, §2.0 and the rewritten Group 3 add a lot of explanation.
    Does any of it cross from describing into prescribing how a surface should be made bilingual?

11. **D-B / D-M on the remediation itself.** Every new claim should carry the literal command and its
    literal output. The executor found and corrected one of its own unsupported assertions mid-fix (a
    claim about which builder component fetches Bible passages). Is there another? Spot-check §2.0's
    template-name loop and Group 3's table map by running them.

12. **Materiality, yours to approve (D-I).** You approved `BLOCKS-REPLAN` for the email copy and the
    packet PDF chrome at round 1. Round 2 adds two new uses: `BLOCKS-REPLAN` on registry-free WhatsApp
    copy and template variables, and **`DETAIL` on six proper-noun records** under a new §0.2 rule that
    a name follows no language axis. Approve, adjust, or reject each.

13. **Next-phase cost.** `D1-sink-triage.md` is D1b-2's starting input and its labels moved. Is it still
    usable? The `outside boundary` label you asked for was **not** added — the executor carried it to
    D1b-2's contract instead, on the ground that D1b-1's contract fixes the three labels. Confirm that
    is the right place for it, or rule that it belongs here.

Review against the contract, not your preferences. Taste disagreements are NITs. Only correctness,
contract violations, privacy/security violations and architectural violations are BLOCKING.

If your remaining objection is to the **contract** rather than the work — most plausibly [D1b.5]
naming a file that turns out not to be on the send path (check 1), or the triage vocabulary (check 13)
— return `FINDINGS` rather than `FAIL`.

Output using the CODEX REVIEW format:

```
## CODEX REVIEW — D1b-1 round 2 (re-review)
VERDICT: PASS | FAIL | FINDINGS
BLOCKING:
- [B1] <finding> — <file:line> — <violated criterion or invariant> — <smallest safe correction>
SHOULD-FIX:
- [S1] ...
NITS:
- [N1] ...
ROUND-1 BLOCKERS: <for each of round 1's [B1]-[B4]: resolved | not resolved | newly broken>
SAME-CATEGORY REPEAT: <yes/no — does any new blocker fall in a round-1 category?>
NOTES ON THE PLAN ITSELF: <if the plan, not the work, is the problem>
```
