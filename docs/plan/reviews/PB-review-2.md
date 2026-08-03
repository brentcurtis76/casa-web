CODEX REVIEW — PB ROUND 2/2 FINAL — phase/pb-storage-fe@5f7b6bd +
phase/pb-storage-edge@10d1190

VERDICT: PASS / CONFIRMED

All five round-1 blocking items are fixed. The remediation is confined to the five declared
frontend files, with `liturgyService.ts` the only production file changed; I found no new defect
in the rewritten story transformation, the two new boundary controls, or the G5 proof. The
unchanged EDGE half retains the binding round-1 PASS findings and corpus pins.

## REVIEW TARGETS AND METHOD

- FE target: `5f7b6bdb5095351a2da3f4d5e530f16673e6c626`; exact merge-base
  `185c370f27c018fb8058b34d210a50a63d7651b3`.
- EDGE target: `10d1190321246595de14d55815804900670c1983`; exact merge-base
  `db427454c3d9d1950075e99f6abf10d7c8797514`.
- Runtime for every FE execution: Node `v22.22.0`.
- I ran `jb list` before creating detached disposable worktrees. Production and committed tests
  were read with `git show` at the pinned SHAs. No provider call, checkout of a protected ref,
  deploy, merge, or code change was made.
- Remediation scope is exactly five files: the G5 suite, G7 wiring suite, `pbBoundary.ts`,
  `pbCriteria.test.tsx`, and `liturgyService.ts`. `supabase/**` has zero remediation diff.
- Frozen blobs remain exact: FE fixture
  `70204600a10ad1e43595da9a93856b4a6b34b459`; EDGE corpora
  `91ec703355f3584701fe25da484370e4ba57b156` and
  `b73fa3c645e1f29b1c697fb1b7081001987a3d15`.

## Q1 — REMEDIATION MATRIX

| Item | Ruling | Independent evidence |
|---|---|---|
| B1 | **FIXED** | `updateStoryWithImageUrls` now rewrites each of the four option arrays in order: HTTP(S) entries pass through, the selected inline entry is replaced in place by its uploaded URL, and other inline entries are dropped. `stripInlineImageRefs` explicitly cleans character, scene, cover, end, landmark, and prop image fields. Both the upload and re-save branches call it. The production G5 suite passed 5/5, including the complete persisted-payload walk and real persisted-story reopen. My temporary adversarial probe passed 3/3: (1) a selected inline option also used by a landmark scalar became the finalized option URL while the non-uploaded landmark scalar was removed; (2) a selected HTTP option survived exactly once; (3) dirty re-save arrays and landmark/prop scalars were scrubbed while all HTTP references and order survived. The probe was removed after execution. |
| B2 | **FIXED** | The G7/T-B.8 wiring suite no longer mocks `use-toast`; the production hook runs without a provider. Its five production paths and four-control inventory all passed as part of the 104/104 focused run. The five per-site mutation record is credible and unchanged in substance: each site still has its distinct-byte exact Storage-boundary assertion, while the corrected inventory label accurately covers the four manual controls and does not substitute for path 5. |
| B3 | **FIXED** | The production draft write receives two representations of identical decoded bytes. The boundary's synchronous created-path set gives real `upsert:false` semantics: first call creates; the repeated path returns structural `statusCode:'409'`. The test pins two boundary calls, the same path twice in persisted paths and returned URLs, length two, order, logical success, and zero removals. Focused execution passed. My production mutation `isDuplicateConflict => false` made the group-success case fail while its non-409 control stayed green; widening the classifier to accept every error left the 409 success green and made the same-message non-409 control fail. |
| B4 | **FIXED** | The criteria suite now drives production `saveLiturgy` with a captured structural 409 on the final cover path and proves success, the exact deterministic public URL, all four final calls with `upsert:false`, a complete zero-inline walk, one element upsert, and zero removals. Its same-path/same-message 500 control proves failure and no element upsert. Both passed normally. The same two independent classifier mutations respectively failed the 409-success case and the non-409 control while leaving the opposite case green. |
| B5 | **FIXED** | The dead `base64ToBlob` implementation is gone; its remaining occurrence is explanatory prose. In the cuentacuentos production surface, decoding, magic-byte MIME detection, hashing, Blob construction, and immutable upload are owned by `immutableImageUpload.ts`; no in-scope `upsert:true` call remains. The two named residual uploaders are outside this surface and are byte-identical to `185c370`: `uploadPortadaImage` hash `64401cde…14e38`, `uploadReflexionPdf` hash `3f45c23e…0e9d3`. |

The B1 adversarial result is intentionally asymmetric when the same inline bytes also occur in a
landmark/prop selected scalar: only one of the four final categories is uploaded, so its selected
option receives the new URL; an unrelated scalar that was never uploaded is removed rather than
being falsely rebound to that category's URL. This satisfies the no-inline contract without
inventing cross-field identity semantics.

## Q2 — F3 `use-toast` RULING

**ACCEPTABLE RESIDUE FOR THIS PHASE.** My G7 ruling does not extend to every PB suite that happens
to mount the production editor. Frozen G7 defines the non-negotiable T-B.8 evidence as *the
required wiring suite* and requires that suite to render the production editor, draft hook,
immutable helper, and real internal hooks while mocking only external boundaries. That suite now
does exactly that.

The G5, criteria, base-capture, and no-delete suites still mock `use-toast`, but none is offered as
the T-B.8 wiring proof. Their persistence, finalization, capture, and no-delete claims observe
Storage/table/DOM consequences that do not depend on toast-store behavior. They therefore remain
valid for their stated contracts. The G5 header's phrase that it mocks “only external boundaries”
while naming `use-toast` is inaccurate documentation and must not be cited as G7 evidence, but it
does not falsify an executable acceptance claim and is non-blocking in this bounded final round.

## Q3 — F1 / F2 CONCURRENCE

- **F1 CONCUR.** T-B.14's combined evidence is non-substitutive: the inventory case executes the
  four manual controls; path 5 independently calls `assertImmutableBoundary`, including
  `upsert:false`; the primitive suite separately pins both draft and final buckets. Correcting the
  inventory label changed no coverage.
- **F2 CONCUR.** The frozen G6 capture stories contain no option arrays, so its comparator cannot
  detect B1. Leaving the immutable fixture untouched was correct. B1 instead rests on the
  production G5 complete walk/reopen, the recorded base-red result, direct code inspection, and
  my three adversarial transformations.

## Q4 — REMEDIATION RESIDUE SWEEP

No new remediation defect found.

- The `updateStoryWithImageUrls` signature remains a two-argument exported function and has one
  production caller. Its new work is deterministic, non-mutating, and followed by the explicit
  scrub. `createPreviewSlideGroup` receives the cleaned story in both save branches.
- `conflictOnRepeatPath` models creation and repeat conflict at the Storage boundary, records both
  attempts before classification, is bucket/path-specific, and clears its state in
  `resetBoundary`. `duplicateLikeMessageWhenPathIncludes` changes only the structural status
  control. Neither imports or duplicates production logic.
- The G5 rewrite preserves H2-not-H1, full no-inline persistence, selected option representation,
  parent-save-before-confirm ordering, failure-before-element-upsert, and real-editor reopen.
- `git diff --check c79ea87..5f7b6bd` is clean. The disposable review worktree returned to a clean
  tracked state after both classifier mutations and the temporary adversarial test.

## Q5 — GATE CONCURRENCE

Focused FE run, serial under Node 22.22.0:

```text
pbBaseCapture.test.tsx
CuentacuentoEditor.pb.g5.test.tsx
CuentacuentoEditor.pb.wiring.test.tsx
immutableImageUpload.test.ts
pbCriteria.test.tsx
pbNoDelete.test.tsx

6 files passed; 104 tests passed; 0 failed
```

Full FE D6, like-for-like:

```text
Vitest base 185c370: 650 passed / 6 failed = 656 total
Vitest head 5f7b6bd: 754 passed / 6 failed = 760 total
Both failure sets: the same six MesaAbiertaDashboard tests

tsc base/head: 1041 / 1041 diagnostics
position-insensitive, worktree-normalized identity diff: 0 removed / 0 added

ESLint base/head: 159 / 159 (116 errors, 43 warnings)
rule + message + relative-file multiset diff: 0 removed / 0 added
```

EDGE gates were not re-run: the tip is byte-identical to the already reviewed and ratified
`10d1190`, its merge-base and both frozen corpus blobs were rechecked, and the final brief
expressly permits relying on the prior run when EDGE is unchanged.

## FINAL CLOSE

- B1–B5: **FIXED**.
- F3: **acceptable non-G7 residue**, with the inaccurate G5 header noted above.
- F1/F2: **concur**.
- New remediation defects: **none found**.
- FE gates: **concur / pass under D6**. Unchanged EDGE evidence remains binding.

PB is confirmed for the recorded PASS close path. No blocking or low-confidence item remains.
