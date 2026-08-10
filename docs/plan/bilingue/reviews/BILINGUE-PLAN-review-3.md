# CODEX PLAN REVIEW — BILINGUE discovery plan — round 2 of 2

Reviewer: Codex Sol
Date: 2026-08-10
Plan reviewed: `docs/plan/bilingue/PLAN.md` at `98ab364b902b99b6b72a54b192acd8ede1fc2d3a`

**VERDICT: FAIL** — 8 BLOCKING · 3 SHOULD-FIX · 0 NIT.
"The remediation is substantial, but several fixes remain internally unenforceable or incomplete.
Per SOP §1.5, this now goes to Brent rather than another automatic loop."

Verdict accepted by the PM; every finding verified or accepted on reading before the response draft.
Brent authorised draft 3 past the cap **and** directed that Codex review it rather than override.

---

## WHAT THE REVIEWER VERIFIED ITSELF

- Clean worktree at exactly `98ab364b902b99b6b72a54b192acd8ede1fc2d3a`.
- Corrected census reproduces: **166 files / 1,402 accent-bearing non-comment lines**. Orphan
  filtering now works — 18 numbered duplicates repo-wide, 8 in census surfaces, none included.
- `CuentacuentoEditor.tsx` still contradicts the plan: **601** accent-bearing lines = 434 matching
  the comment filter + 167 non-comment, not "434 of 596".
- Live database, read-only transactions: `slides` 55 normalized paths; `config` 90; total **145**.
  `slides` **617 distinct path/kind pairs**, average 11.22 kinds per path; `config` 96 pairs,
  average 1.07. Recursive closure exactly **15** reachable tables. Custom rows: four declared types
  plus two untyped, across eight config-key sets; **the two untyped rows have different slide
  schemas — one image-shaped, one video-shaped.**
- **Code supports a fifth declared subtype absent from production: `blank-slide`** — in the type,
  picker, editor, converter, exporter and tests.
- The D2b recursive SQL printed in the plan executes and returns 55.
- Other stored JSON: `liturgias.portadas_config` 8 paths; `liturgias.presentation_styles` 15
  populated paths, with code also declaring translatable `textOverlayState.overlays[].content`;
  `liturgia_oraciones.tiempos` — `lider` and `congregacion` text paths;
  `cuentacuentos_drafts.story` 40 paths.
- No repository files or database rows were changed.

## FIX STATUS — B1–B10 (from review 2)

| Finding | Status | Assessment |
|---|---|---|
| **B1** | Partially fixed | Orphan exclusion and 166/1,402 fixed; accent pass honestly described as a lower bound. The stopword pass mitigates but does not solve completeness, and its list/normalisation/union policy is unspecified. The plan retains the false 596 claim and a false diagnosis that the original regex works standalone — **it returns zero unless `find -E` is used.** |
| **B2** | **Not fixed** | "Five shapes / 25 rows minimum" matches neither code nor data. Code supports five declared subtypes including zero-row `blank-slide`; production adds two structurally different untyped legacy rows. Minimum defensible taxonomy: 20 regular kinds + 5 declared custom subtypes + 2 legacy shapes = **27**, unless D2c proves a different grouping. |
| **B3** | Partially fixed | Pre-splitting was correct, and path-oriented D2b is plausible (55 paths, not a 1,375-cell dense grid). But the artifact does not require every one of the **617 observed `(path, kind)` pairs** to resolve through a default or explicit exception. "Choose the organisation up front" is hope unless the default/exception schema and coverage check are acceptance criteria. |
| **B4** | Partially fixed | D2a now covers all four core tables, but treats JSON columns atomically — which cannot correctly disposition `presentation_styles`, whose overlay content is translated while IDs, positions, visibility, scope and styling are copied. Live-only enumeration also misses code-supported zero-row paths such as `blank-slide.backgroundColor` and overlay `content`. |
| **B5** | **Actually fixed** | The 15-table recursive closure reproduces; D5 requires depth/path/disposition coverage. |
| **B6** | **Not fixed** | D-C itself is honest, but phase test plans violate it: D3.10 says a shell verifier reads live PII, and D5's shell test re-runs live counts. Under the stated environment the database is reachable only through the manual MCP step. |
| **B7** | Partially fixed | The invariant/observation split resolves the conceptual contradiction but not execution: a script comparing documents with **old** fixtures cannot detect current structural drift, and cannot prove `SET TRANSACTION READ ONLY`. That proof must come from a fresh manual transcript/fixture refresh at phase review and again before D6. |
| **B8** | Partially fixed | D-H is a strong fix and D3 is now a dataflow audit. But D3.10 remains unimplementable under D-C, and the 16-table census excludes non-FK dataflows such as `published_resources.published_by` and notification recipient records supplying musician/volunteer/WhatsApp PII. |
| **B9** | Partially fixed | `BLOCKS-D6` blocks declared items, but nothing forces every `UNVERIFIED` to receive an independently reviewed materiality classification. An executor can omit the label or call a material unknown a detail. |
| **B10** | **Actually fixed** | Structural symmetry plus a recorded fresh-context neutrality read is an acceptable contract. Semantic neutrality cannot be fully mechanised; the plan now says so and assigns it to an independent reviewer rather than executor self-review. |

## FIX STATUS — S1–S5

| Finding | Status | Assessment |
|---|---|---|
| **S1** | Actually fixed | D-F correctly narrows "translate, do not regenerate" to devotional prose. |
| **S2** | Actually fixed | D-G freezes UI locale and content language as independent axes. |
| **S3** | **Newly broken by the fix** | The dependency was added in the wrong direction. D3 audits PII flowing into images, so it needs D4's complete asset inventory. With D4 after D3, a newly discovered PII-bearing asset arrives after the audit is complete. **D4 should precede D3**, or a reconciliation criterion must update D3 after D4. |
| **S4** | Actually fixed | Document-only gate set is explicit, runs at the phase SHA after `npm ci`, and uses the diff check for source confinement. |
| **S5** | Actually fixed | D6.8 includes Bible redistribution/attribution and English WhatsApp-template availability/lead time. |

## BLOCKING

- **[R2-B1] The custom-kind correction is still factually incomplete.** `blank-slide` is a supported
  creation path absent from production; the two untyped production rows are different image/video
  schemas. D2 must inventory **code-supported** shapes as well as populated database shapes.
- **[R2-B2] The stored-field contract cannot represent kind-specific or nested dispositions.** A
  single disposition for `source_id`, `titulo` or a shared slide path is insufficient — songs, Bible
  readings, canonical texts, announcements and generated prose require different outcomes. Likewise
  `presentation_styles` mixes translatable overlay content with copied styling and identifiers.
  Require every observed or code-declared `(field/path, kind)` pair to resolve through an explicit
  default or exception.
- **[R2-B3] D-C is contradicted by D3.10 and D5's test plan.** The shell verifier cannot query live
  PII or re-run live counts through an MCP. Move those into the named manual step and commit only
  redacted structural results plus provenance, or specify a real non-MCP read-only runner.
- **[R2-B4] D5.8/D6.6 can pass against stale fixtures.** D6 merely re-runs fixture comparison and
  never requires a fresh evidence↔database refresh. Require fixture provenance — project ref, query
  hash, timestamp, `transaction_read_only=true` — and a refresh at D6 before the scripts run.
- **[R2-B5] D-I is not yet a closed gate.** Require every `UNVERIFIED` entry to carry
  `materiality: BLOCKS-D6 | DETAIL`, require an independent reviewer to approve the classification,
  and make D6 fail on an unclassified entry. Checking only voluntarily-raised labels is circular.
- **[R2-B6] D3/D4 sequencing is backwards.** D4 discovers all text-bearing assets; D3 must consume
  that inventory. As written, D4 can discover a new PII-in-pixels path after D3 has closed.
- **[R2-B7] The rewrite newly removed required phase contracts.** D2a, D2b, D2c, D3, D4 and D5 have
  no explicit Definition of Done or rollback; D6 also lacks rollback. Draft 1 had them. This
  violates the governing SOP plan skeleton.
- **[R2-B8] D-B is already violated inside the revised plan.** Several "Verified current state"
  entries cite abbreviations — `find`, `count(*)`, "recursive CTE recorded in D5" — rather than the
  exact command D-B requires. The retained "434 of 596" claim also does not reproduce: it is
  434 of 601.

## SHOULD-FIX

- **[R2-S1]** Freeze the second census method before D1 execution: exact case-folding, token
  boundaries, stopword/verb list, comment handling, file extensions, and whether totals are unioned
  or reported separately. Two unspecified lower bounds are not a reproducible census.
- **[R2-S2]** D6.6 and D6's test plan must name every verifier explicitly — D1, D2a, D2b, D2c, D3,
  D4, D5. "D1–D5" is ambiguous after the split.
- **[R2-S3]** Include `published_resources` and non-FK notification-recipient sources in D3's
  dataflow scope even though they sit outside the recursive FK closure.

## NITS

None.

## MISSING PHASES

No new top-level discovery phase is inherently required; the discovery-only boundary remains sound.
The unresolved work can be repaired by expanding D2a–D2c to union live database paths with
code-declared schemas and cover every field/path-kind pair; reversing the D3/D4 dependency or adding
an explicit reconciliation; and making manual database refresh/provenance part of every applicable
phase and D6.

## FROZEN DECISIONS THE REVIEWER DISPUTES

- **D-C** — the two-mechanism model is sound, but its phase contracts still violate it.
- **D-I** — the intended gate is sound, but the plan must classify every unresolved item rather than
  trusting executors to apply the blocking label.

D-A, D-B, D-D, D-E, narrowed D-F, D-G and D-H are sound **once the plan itself complies with them**.
