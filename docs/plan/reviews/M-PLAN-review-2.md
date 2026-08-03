CODEX REVIEW — PLAN-MATERIALES ROUND 2 — `main`@`d79d329`

VERDICT: FAIL

The revision closes eight of the ten round-1 findings as intended. B2, B3, B4, S1,
S3, S4, S5, and S6 are fixed. B1 and S2 are only partially fixed because the new
canonical algorithm is not idempotent for all permitted input, and M-D11 defines
empty and noncanonical string arrays as valid snapshots. Those are not theoretical
editorial gaps: each breaks the newly frozen equality between the FE snapshot and
the EF prompt. Two smaller ambiguities should also be removed before freeze.

I ran the required `jb list` before any repository action. The repository remained on
`main` at exact commit `d79d32913a7efca6aa73c1250c380950a8744003`, with only the
stated ambient `.gitignore` modification. I made no checkout, worktree, branch, code
change, deploy, or provider call. This review is the only file written.

## ROUND-1 REMEDIATION MATRIX

| Round-1 item | Ruling | Evidence in the revision |
|---|---|---|
| B1 canonical effective list | **PARTIAL** | M-D3/M-D5, V1-V8, M2 [A3]/[A4], the cap UI, and M3b [A4] establish the right topology. The algorithm/vector defect in [B1-R] still permits the EF to reshape the FE-canonical list. |
| B2 loading escape | **FIXED** | M-D10 and M3b [A3] bind disabled generation to a deferred first fetch, then separately permit success/empty/error settlement. |
| B3 type/base contradiction | **FIXED** | M2 explicitly adds `requestId?: string`; M-D8 and the phase index use sequential post-merge bases. |
| B4 M3 sizing/topology | **FIXED** | M3a is mandatory, inert, props-only, and service-free. M3b permits collaborator mocks except for exactly one real-M2 boundary proof. Both are credible fresh-session phases. |
| S1 RBAC map | **FIXED** | M-D9, the verified map, and Backlog include the later Liturgist read/write grant and accurately distinguish volunteer/equipo pastoral behavior. |
| S2 additive content safety | **PARTIAL** | Unknown-key preservation and mixed-array rejection are now explicit, but empty/whitespace/noncanonical string arrays contradict the canonical snapshot contract; see [B2-R]. |
| S3 empty prompt goldens | **FIXED** | M-D2 and M1 [A3]/[A5] directly cover both `undefined` and `[]` in both builders. |
| S4 quick-add terminal state | **FIXED** | M-D6 and M3b [A6]/[A7] define terminal success, duplicate selection/no-insert, in-flight repeat protection, and one-name generation. |
| S5 context reset | **FIXED** | M3b behavior and [A8] cover every new state, stale old settlement, and successful active-context settlement. |
| S6 release gate/config | **FIXED** | M-REL1 records command, CLI, SHA, before/after versions, and generate smoke; the config/default-JWT wording now matches the repository. Version-only refine evidence is coherent because the exact two-function command and deployed SHA bind the artifact; a paid runtime smoke properly remains Brent-authorized. |

## BLOCKING

### [B1-R] M-D5's ordered algorithm is not idempotent, and its named strip mutation cannot fail

The new topology is correct, but the normative seven steps do not always produce a
canonical fixed point. Step 3 trims, then step 5 truncates without trimming again. A
permitted input of 119 `a` characters followed by `" bc"` becomes 119 `a` characters
plus a trailing space at the FE. When the EF applies the same algorithm, step 3 removes
that trailing space. The observable result is:

```text
FE canonical/invoke/snapshot length: 120 (ends in U+0020)
EF canonical/prompt length:          119
```

That directly falsifies M-D5's `invoke body = persisted snapshot = prompt bullets`
claim. V1-V8 do not exercise truncation onto whitespace, and the stated idempotence
checks only those outputs, so every mandated test can pass while the contract fails.

The D7 mutation in M1 [A7] has a second concrete problem. It says that dropping the
control-replacement step must make the sanitizer suite red, but V3 uses a newline.
Even with step 1 removed, step 2's whitespace collapse transforms the newline into the
same single space, so V3 stays green. No other normative vector contains a
non-whitespace control character. The required mutation proof is therefore impossible
from the named suite.

Required amendment:

- Make truncation itself canonical, for example step 5 = truncate to the defined
  120-character unit **then trim again** before dedupe. Add a vector whose 120th unit
  becomes whitespace after truncation and assert first-pass/second-pass equality.
- Add a vector with a non-whitespace control such as U+0000 or U+007F, whose canonical
  output contains a space. Then dropping control replacement genuinely fails.
- Define what "char" means. Using UTF-16 code units aligns JavaScript `.slice(0, 120)`
  with HTML `maxLength`; choosing Unicode code points is also possible, but both
  implementations and the UI must use the same stated unit.
- Freeze the case-fold operation (`toLowerCase()` or a named locale) and add an accented
  Spanish case pair. "Case-insensitive" alone permits two conforming-looking
  implementations to disagree outside V4's ASCII input.

With those changes, idempotence over every vector plus the adversarial truncation case
is a meaningful compositional proof for M3b [A4].

### [B2-R] M-D11 contradicts M-D2/M-D3 for empty, whitespace, and noncanonical string arrays

M-D11 says a snapshot is valid iff it is an array whose every element is a string.
That definition makes all of these valid:

```text
[]
["   "]
["Papel", "papel"]
61 distinct strings
```

But the rest of the plan requires different outcomes:

- M-D2 and M2 [A5] say empty/canonical-empty means the key is absent.
- M-D3 says stored content is the canonical effective list, not merely a string array.
- M-D5 canonicalizes the latter three examples to `[]`, `["Papel"]`, and the first 60.
- M2's refine text currently only validates and forwards/re-serializes the raw array;
  it applies `buildEffectiveMaterialsList` once on the publish path, not the refine
  path.

This matters because `LessonEditDialog` exposes raw content editing and the service must
also tolerate manually or historically shaped JSON. For example, `["   "]` would be
re-serialized as a present snapshot while the EF reduces it to no constraint. A
61-string snapshot would remain 61 strings in content while only 60 reach the prompt.
That recreates the exact snapshot/prompt mismatch B1 was meant to close.

Required amendment: define a usable refine snapshot as (1) an array with every entry a
string, (2) canonicalized once through the FE M-D5 implementation, and (3) non-empty
after canonicalization. The same canonical non-empty result must be used for the refine
invoke body and `newContent`; invalid or canonical-empty input must remove/omit only
`availableMaterials` while preserving every sibling key. Extend M2 [A6]/[A7] with
`[]`, whitespace-only, a valid-but-noncanonical V4/V5 input, and a >60 input, asserting
`refine body === rewritten snapshot` in each applicable case.

## SHOULD-FIX

### [S1-R] "Continuar — NO network" contradicts the mandatory lazy fetch on entry

M3b behavior says Continuar navigates with "NO network", then says the dialog starts a
lazy inventory fetch on first materials entry. Those happen as one user transition.
M3b [A2] correctly specifies the intended invariant as zero `functions.invoke` calls,
not zero network calls. Replace the behavior shorthand with "no generation/invoke;
inventory fetch begins on materials entry" so an executor is not asked to suppress the
request M-D10 is designed to gate.

### [S2-R] The >60 rule needs one explicit visual/input ordering contract

The plan says to pre-check the first 60 "in display order" and later construct checked
names plus extras "in display order." `getInventory()` returns globally name-sorted
rows, while `MaterialsStepView` renders them under a fixed category order. Those are not
the same order. With more than 60 rows, different reasonable implementations therefore
pre-check different items and produce different prompt order.

Name the order once—for example fixed category order
`craft, book, supply, equipment, other`, then inventory query/name order within each
category, then extras in entry order—and use it for rendering, initial first-60
selection, bulk selection, and effective-list construction. Also say whether the first
60 means raw rows or first 60 canonical-distinct names; the latter better matches the
effective-list cap and avoids under-filling when two inventory names collapse to one.
The acknowledged narrowing of "pre-check all" is coherent and visibly handled once
this deterministic order is bound; its desirability remains Brent's veto.

## NITS

None.

## NOTES ON THE PLAN ITSELF

- The M3 split is now credible. M3a's two-file presentational slice is comfortably
  bounded; M3b's collaborator-mock allowance removes the giant all-purpose chain fake,
  while one full-stack proof retains the load-bearing wiring evidence. The approximate
  600-line cap is reasonable after this split rather than an invitation to omit tests.
- M1 and M2 remain appropriately sized for fresh executors. The sequential bases remove
  the prior review/tree mismatch and make M2's field-for-field criterion verifiable.
- M-REL1 is technically coherent. Generate's preview provides a zero-model behavior
  smoke. For refine, the recorded exact SHA + two-function deploy command + before/after
  version is adequate version evidence; not pretending it is a behavior smoke is the
  honest choice. Brent may still require the paid call.
- Unknown content-key preservation is correctly designed: spread the parsed object,
  overwrite the three model-owned keys, and then explicitly set or remove only the
  canonical snapshot key. [B2-R] changes snapshot qualification, not that ownership
  model.
- The behavior tests continue to target real evidence: prompt bytes, invoke bodies,
  persisted JSON, deferred fetch gating, routing, and one composed UI-to-persistence
  path. No new criterion is merely "code runs."
- No product decision requires relitigation. Prompt-only strictness, the explicit
  unconstrained fallback, manual per-item save, all refinement types, the visible cap,
  and version-only refine evidence all have their consequences stated. The remaining
  blockers are internal contract inconsistencies, not product taste.

I would pass a revision that makes M-D5 a true fixed point, makes the control-step
mutation observable, and canonicalizes/omits refine snapshots consistently. I would not
freeze the current text because it still permits the exact FE/snapshot/EF divergence the
round-1 B1 remediation was meant to eliminate.
