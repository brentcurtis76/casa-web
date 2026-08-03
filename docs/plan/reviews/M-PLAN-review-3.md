CODEX REVIEW — PLAN-MATERIALES ROUND 3 — `main`@`d79d329`

VERDICT: PASS

The round-3 revision closes all four round-2 findings without introducing a new
blocking, acceptance, sequencing, or sizing problem. The plan is internally coherent,
executable by the named fresh phases, and suitable to freeze. I would be willing to be
held to this plan.

I ran the required `jb list` before any repository action. The repository remained on
`main` at exact commit `d79d32913a7efca6aa73c1250c380950a8744003`, with only the
stated ambient `.gitignore` modification. I made no checkout, worktree, branch, code
change, deploy, or provider call. This review is the only file written.

## ROUND-2 REMEDIATION MATRIX

| Round-2 item | Ruling | Evidence in the revision |
|---|---|---|
| B1-R — canonical fixed point and mutation witness | **FIXED** | M-D5 truncates to 120 UTF-16 code units, then re-trims/drops before dedupe; case folding is frozen to locale-less `String.prototype.toLowerCase()`. V9 exercises truncation onto whitespace, V10 uses literal U+0000 at test runtime so step 2 cannot mask removal of step 1, and V11 exercises accented case folding. M1 [A6]/[A7] require all V1-V11 results, every-input fixed-point checks, boundary idempotence, and the V10 mutation failure. |
| B2-R — refine snapshot qualification | **FIXED** | M-D11 now requires string-array shape, one FE canonicalization, and a non-empty result. The same result owns both the refine body and rewritten content; invalid/canonical-empty input removes only the snapshot key while preserving siblings. M2 text and [A6]/[A7] explicitly cover scalar, mixed, empty, whitespace-only, noncanonical, and >60 cases with body/content equality. |
| S1-R — Continuar/network wording | **FIXED** | M3b now says Continuar causes no generation/invoke and that inventory loading begins on materials entry. That exactly matches M-D10 and [A2]/[A3]. |
| S2-R — deterministic ordering | **FIXED** | M-D12 defines category order, inventory response/name order within category, extras entry order, and first-60 canonical-distinct semantics. The Goal cap consequence, M3a rendering, and M3b pre-check/effective-list criteria all cite that contract. |

## BLOCKING

None.

## SHOULD-FIX

None.

## NITS

None.

## NOTES ON THE PLAN ITSELF

- I independently evaluated the stated M-D5 procedure against V1-V11. Every expected
  output matches, and applying the algorithm again leaves every result unchanged. V9
  has the stated arithmetic: 119 `a` code units plus `" bc"` is 122; slicing at 120
  retains the space as unit 120; the second trim removes it. V10's textual `\u0000`
  is appropriate specification notation for a JavaScript test literal and the plan
  file contains no literal NUL byte.
- The fixed-point claim is coherent beyond the named examples: after step 5, emitted
  values contain no leading/trailing whitespace, are at most 120 UTF-16 units, and
  have already had controls/whitespace normalized. Dedupe and the 60-item cap preserve
  that form on a second application. A sliced surrogate half remains stable under the
  explicitly chosen UTF-16-unit contract; the UI `maxLength`, hint threshold, FE
  implementation, and Deno implementation all use the same unit.
- M-D11 now agrees with M-D2 and M-D3. `[]` and whitespace-only arrays canonicalize to
  absent; hand-edited duplicate or >60 arrays heal to the canonical effective snapshot;
  invalid shapes do not leak into either the EF body or rewritten JSON; unrelated
  content keys survive.
- M-D12 is compatible with the M3a props boundary. The parent owns ordered inventory,
  checked ids, extras, cap state, and callbacks; the props-only view can group/render
  those values in the fixed order without data access. Canonical collisions select the
  first occurrence and do not consume additional effective-list slots.
- The >60 rule is now deterministic and visible: first 60 canonical-distinct names in
  M-D12 order, disabled unchecked additions at the cap, an explicit notice, and a
  counter. This is a coherent consequence of the hard cap. Brent's open veto concerns
  product preference, not plan executability.
- M-REL1 remains an honest release gate. Generate receives a behavior smoke through
  preview mode. Refine receives exact-SHA, exact-command, and before/after deployed
  version evidence; the plan correctly labels this version evidence rather than a
  runtime behavior smoke and reserves a paid invocation for Brent's authorization.
- Phase sizing is credible: M1 and M2 are focused contract/service phases; M3a is an
  inert two-file presentational phase; M3b confines the 905-line-dialog risk to wiring
  and permits collaborator mocks everywhere except one composed real-service proof.
- Acceptance criteria remain behavioral and verifiable: exact prompt bytes, canonical
  vectors and mutations, invoke/body/snapshot equality, additive JSON preservation,
  deferred loading, routing, quick-add terminal behavior, context reset, and one
  UI-to-persistence proof. D6 remains delta-based and D7 does not use file absence as
  fake behavioral red evidence.
- The verified code map, permission conclusion, lenient EF interoperability, sequential
  post-merge bases, and separate deploy authority remain sound. No frozen Brent product
  decision needs relitigation for technical correctness.

FREEZE RECOMMENDATION: FREEZE PLAN-MATERIALES at this round-3 text, subject only to
Brent's explicitly retained product vetoes on the visible >60 behavior and whether to
require a paid refine smoke. Either veto would be a product decision-log amendment, not
a defect in the reviewed plan.
