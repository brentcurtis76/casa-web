# CODEX REVIEW — D1a round 4

Received 2026-08-11. Reviewer: Codex `gpt-5.6-sol`, `model_reasoning_effort = high`.
Prompt: `docs/plan/bilingue/prompts/D1a-codex-review-r4.md`. Reviewed head: `2f0924f`
(pre-rebase; now `f306895` after the [B5] remediation).

VERDICT: **FAIL** — 5 BLOCKING, 1 SHOULD-FIX, 1 NIT.

## BLOCKING

- **[B1]** The surviving static-import claim remains broader than its command: the grep only
  recognizes `from '…_test'` and misses a statically written side-effect import such as
  `import './helper_test.ts'`. The listed limitations do not disclose this case —
  `CENSUS-METHOD.md:180` — D1a.9 / D-O — narrow the claim to the exact `from …_test` form searched
  or remove it; do not add a cleverer proof regex.
- **[B2]** The naming survey still launders bounded probes into absolutes: "no … naming convention
  beyond" is not established by searches for `test`, `[._]spec.`, `__mocks__`, and `/tests?/`.
  Nearby, "no name predicate could have reached it" is demonstrably false — a predicate could name
  the basename — and the next baseline's future name is untested — `CENSUS-METHOD.md:142`,
  `CENSUS-METHOD.md:205` — D1a.9 / D-O — report only the literal path shapes the commands searched
  and their observed output.
- **[B3]** The fourth stage-one exclusion is not given its own named failure case. The examples
  cover test-path predicates, but not a genuine production module whose basename intentionally ends
  in space plus a digit — `CENSUS-METHOD.md:48` — D1a.9 — explicitly state that this predicate can
  over-exclude such a production module.
- **[B4]** The only evidence that the live-tree-unexercised `no-literal-referrer` branch was tested
  uses placeholders and an ellipsis, not a literal runnable command; the ledger then repeats the
  result only in prose — `D1a-r4-review-request.md:97`, `LEDGER.md:1182` — D-M and the r4 evidence
  contract — paste the complete scratch harness and literal output, or remove the unsupported
  construction claim.
- **[B5]** D1a.8/A7 is objectively unmet: the branch diff includes `docs/plan/HANDOFF-PROCESS.md`
  and `docs/plan/SOP-PILOT.md`. Their ownership and documentation-only nature preserve D-A but do
  not satisfy the explicit branch-confinement criterion — `PLAN.md:305` — D1a.8 / A7 — rebuild the
  phase ancestry without `98f4e51`, or otherwise move that workflow commit outside this phase diff.

## SHOULD-FIX

- **[S1]** All artifacts label the pre-amendment freeze commit as `PLAN_SHA`, including artifacts
  modified under the approved amendment. This is misleading provenance, although the manifest and
  D1a merge anchor preserve integrity — `CENSUS-METHOD.md:6` — refresh the metadata and hashes, or
  explicitly relabel it as the original freeze SHA.

## NITS

- **[N1]** "two conventions" introduces three path conventions — `CENSUS-METHOD.md:42`.

## NOTES ON THE PLAN ITSELF

No re-plan is needed. The amended contract is sound. Independently verified: r4 stdout is
byte-identical to r3; manifest, syntax, selection, and TypeScript gates pass; collision-before-
referrers is the correct conservative ordering; and machine-readable stderr satisfies D1a.10.
Durable capture and exclusion enumeration can be enforced in D1b's verifier.

---

## Executor triage — all five accepted, none disputed

| ID | Verdict | Disposition |
|---|---|---|
| B1 | valid | Fixed. The probe is reported as the one specifier shape it searches; side-effect import, dynamic `import()`, runtime specifier, re-export chain, `require`, aliased specifier and out-of-root importers all named as unseen. No replacement regex (D-O). |
| B2 | valid | Fixed, both halves. The "beyond the three" claim is replaced by a report of two searches over four literal substrings, with the statement that a convention using none of them would appear in neither. "No name predicate could have reached it" is corrected — a literal-basename predicate could; what the name lacks is a *convention* to key on. |
| B3 | valid | Fixed. The fourth predicate gets its own named case: a production module whose basename legitimately ends in a space plus a digit (`Slide 2.tsx`) is over-excluded; the predicate reads shape, not provenance. |
| B4 | valid | Fixed. The complete runnable harness and its unedited output now appear in both the review request and the ledger, with a `sha256` of the extracted function so the run cannot be confused with one against an edited copy. |
| B5 | valid | Fixed by the first remedy Codex named. `98f4e51` preserved on `pilot/lean-v2` (pushed), phase ancestry rebuilt with `git rebase --onto f2be4f2 98f4e51`, force-pushed with lease. Authorised by Brent 2026-08-12; the SHA stays reachable so every citation to it still resolves. |
| S1 | valid | **Deferred** by Brent's decision — see the ledger backlog entry. Fixing it would touch two artifacts Codex passed and whose byte-identity is worth keeping; D1b.8 anchors provenance at D1a's merge commit. **Deferral accepted on re-review.** |
| N1 | valid | Fixed — "the two test-module conventions this repository uses, across three path shapes". |

---

# CODEX RE-REVIEW — D1a round 4 remediation

Received 2026-08-12. Same reviewer and settings. Prompt:
`docs/plan/bilingue/prompts/D1a-codex-rereview-r4.md`. Reviewed head: `0d2802f`.

VERDICT: **FAIL** — 2 BLOCKING, 2 SHOULD-FIX, 0 NIT. B1, B3, B5 and N1 of the first review confirmed
fixed; A7 confirmed satisfied; `98f4e51` confirmed reachable; stdout confirmed byte-identical;
manifest, syntax, TypeScript and diff checks confirmed passing; the harness confirmed to exercise
all four outcomes.

## BLOCKING

- **[B1]** The B2 absolute still survives in two earlier locations: "a captured baseline follows no
  naming convention" and "no name predicate can reach it." A literal-basename predicate can reach
  it, as the later corrected paragraph now acknowledges — `CENSUS-METHOD.md:68`, `census.sh:87` —
  D1a.9 / D-O — replace both with the tested statement that the current path matches none of stage
  one's four predicates and stage two therefore classifies it by referrers.
- **[B2]** The supposedly complete harness ends with `/bin/rm` and contains no command that prints
  `harness exit=0`, yet that line is presented as unedited literal output in both evidence
  locations. I reproduced the hash and all four branch outcomes, but the displayed exit line was not
  produced — `D1a-r4-review-request.md:129`, `D1a-r4-review-request.md:135`, `LEDGER.md:1210` —
  D-M / original B4 — add a literal status-printing command and rerun, or remove the unsupported
  line and "exit status included" claim.

## SHOULD-FIX

- **[S1]** The `PLAN_SHA` deferral is accepted. It causes no integrity failure that the manifest and
  D1b.8 merge-commit anchor do not already prevent; retain it in the backlog.
- **[S2]** The importer-probe disclosure says it cannot see "a re-export chain," but a direct
  re-export such as `export { x } from "./helper_test.ts"` does match the shown regex. This
  understates the probe rather than laundering safety, so it is non-blocking —
  `CENSUS-METHOD.md:201` — qualify this as a chain whose written specifiers do not end in `_test`,
  or remove that item.

## NOTES ON THE PLAN ITSELF

No plan defect or re-plan is needed.

## Executor triage — both accepted, neither disputed

| ID | Verdict | Disposition |
|---|---|---|
| B1 | valid — the fix was applied to the corrected paragraph and not to the two earlier statements of the same claim | Fixed at both sites. `CENSUS-METHOD.md`'s stage-two introduction and `census.sh`'s function header now say the live case matches none of stage one's four predicates, that a literal-basename predicate *would* reach it, and that nothing fixes what the next baseline is called — so stage two classifies by referrers. |
| B2 | valid, and it is the same failure class this phase keeps repeating: presenting as literal output a line the pasted command cannot produce. `harness exit=0` came from the invoking shell | Fixed. The harness now ends with `printf 'loop exit=%s\n' "$?"` before the cleanup, and was re-run; every line of the pasted output is produced by a command in the pasted script. Both evidence locations updated, and both record what the earlier revision got wrong. |
| S1 | deferral accepted by the reviewer | Retained in the ledger backlog, unchanged. |
| S2 | valid | Fixed. The disclosure now reads "a re-export chain **whose written specifiers do not end in `_test`**", and states explicitly that a direct `export { x } from './helper_test.ts'` *does* match — the probe is not blind to that one. |

The [B1] edit to `census.sh` is comment-only. Verified two ways: stdout remains byte-identical to
the r3 script, and the `sha256` of the function text the harness extracts is unchanged
(`ca6e9ce7…`), because both `sed` ranges begin below the edited comment block. `CENSUS-METHOD.md`
and `census.sh` were both rehashed in `METHOD-MANIFEST.txt`.
