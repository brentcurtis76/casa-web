CODEX REVIEW — PB ROUND 1/2 — phase/pb-storage-fe@c79ea87 +
phase/pb-storage-edge@10d1190

VERDICT: FAIL

The immutable-upload implementation, fail-closed draft/finalization behavior, B1
compare-and-delete identity, and public-only edge widening are substantively sound. The phase
does not yet meet the frozen spec in full. One production behavior admitted as PB-F7 directly
contradicts G5/T-B.9, and four required topology/evidence items are incomplete: the G7 suite
mocks an internal production hook outside the permitted boundary list, T-B.2 lacks its
two-entry created-plus-409 group proof, T-B.9 never sends a captured 409 through production
`saveLiturgy`, and the old cuentacuentos base64/MIME helper remains as a second production
implementation beside the G2 primitive.

This is round 1 of 2. The complete consolidated remediation scope is recorded below; gate 7
requires the eventual fix-list to be scoped from this file in full.

## REVIEW TARGETS AND RUNTIMES

- FE target: `c79ea877dd4701638c654a3354097acaf23a9d2f`; exact merge-base
  `185c370f27c018fb8058b34d210a50a63d7651b3`.
- EDGE target: `10d1190321246595de14d55815804900670c1983`; exact merge-base
  `db427454c3d9d1950075e99f6abf10d7c8797514`.
- FE canonical runtime used for my focused reruns: Node `v22.22.0`.
- EDGE runtime: Deno `2.7.11`, V8 `14.7.173.7-rusty`, TypeScript `5.9.2`.
- The FE fixture is still blob
  `70204600a10ad1e43595da9a93856b4a6b34b459`.
- The EDGE corpus blobs remain exactly
  `91ec703355f3584701fe25da484370e4ba57b156` and
  `b73fa3c645e1f29b1c697fb1b7081001987a3d15` at base and head.
- I read behavior/payload claims from `git show` at the pinned SHAs. No live provider call was
  made and no code worktree was modified.

## FOCUSED REPRODUCTIONS

FE, under Node 22.22.0 and `--no-file-parallelism`:

```text
pbBaseCapture.test.tsx                         1/0
CuentacuentoEditor.pb.g5.test.tsx              4/0
CuentacuentoEditor.pb.wiring.test.tsx          6/0
immutableImageUpload.test.ts                  27/0
pbCriteria.test.tsx                           53/0
pbNoDelete.test.tsx                            8/0
```

The first two suites together completed in 43.01s; the criteria/primitive/no-delete set
completed in 17.51s; the wiring suite completed in 7.87s.

Independent D5 divergence reproduction:

- From the immutable fixture at `94ef5f7`,
  `hook.characterSheets.midFailure` resolves, emits three positional
  `upsert:true` upload attempts, persists only `char1_0.png` and `char1_2.png`,
  and publishes the shortened URL set.
- `git show 185c370:src/hooks/useCuentacuentosDraft.ts` independently explains that outcome:
  `uploadImage` catches the middle error and returns `null`, then
  `slots.filter(Boolean)` compacts the group and the write continues.
- At `c79ea87`, the declared new result is rejection, no draft upsert, and no React/URL swap.
  The focused comparator produced exactly that result and passed.

This ratifies the use of upload calls as a multiset and the declared divergence for this
case. The 204-entry table is not a cryptographic defense against a malicious co-edit:
`assertNewValueInvariants` independently constrains only the 54 `uploads` values. It is,
however, an adequate G6 review artifact because it pins every old value to the immutable
fixture, pins the exact new value, removes only case-local declared top-level fields, compares
the rest exactly, and is supplemented by the dedicated criteria/mutation suites. It must not
be described as making semantic rubber-stamping impossible without review.

EDGE:

```text
imageFetch_provenance_test.ts
generate-story/handler_pb_storage_test.ts
generate-scene-images/handler_pb_storage_test.ts

ok | 28 passed | 0 failed
Checked 3 files
```

The three new files pass `deno fmt --check`. `_shared/imageFetch.ts` remains format-dirty at
both base and head. My independent formatter transform has the same size on both sides:
27 unified-diff hunks and 239 added/49 removed formatting lines at each SHA. Thus the
zero-new-dirt conclusion is correct. If the executor's “46↔46 hunks” meant unified diff
hunks, that literal count is not reproduced by the canonical `diff -u` method and should be
corrected; it does not affect the invariant.

## BLOCKING FINDINGS

### [B1] PB-F7 contradicts the frozen G5/T-B.9 final payload contract

Locations:

- `src/components/liturgia-builder/editors/CuentacuentoEditor.tsx:3765-3767`
  at `c79ea87`
- `src/lib/liturgia/liturgyService.ts:250-265` at `c79ea87`
- `src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.pb.g5.test.tsx:444-504`
  at `c79ea87`

The production editor copies `coverImageOptions`/`endImageOptions` into the finalized story.
`updateStoryWithImageUrls` rewrites the selected `coverImageUrl`/`endImageUrl` only. The G5
step-4 test then observes and positively pins raw H2 bytes in
`storyData.coverImageOptions[]` inside the `liturgia_elementos` upsert.

That is not an acceptable out-of-scope pin. Frozen G5 requires the step-4 element payload to
contain H2's public URL, “not H1 and not base64”; T-B.9 says the saved element contains only
the new public URL. The test's opening contract also says “nada de base64,” then narrows its
assertion to four selected reference fields and expressly permits the raw option-array leak.
Pre-existence at `185c370` does not override an acceptance criterion written specifically for
the PB finalization proof.

Required remediation:

1. Ensure the finalized `liturgia_elementos.config.storyData` contains no raw base64/data URL
   in image option arrays. Preserve usable HTTP(S) options and the selected finalized public
   URL as needed for reopen behavior; do not discard the selected H2 reference.
2. Tighten the production G5 step-4 assertion to walk the complete persisted `storyData` and
   require zero inline-image fields, while still asserting H2 (not H1) in the selected final
   field and correct post-upsert acknowledgement ordering.
3. Add/retain a reopen assertion proving the cleaned option representation does not break the
   finalized editor's selected cover/end state.

CONTRACT-COUPLED: NO response-envelope change; this is a persisted frontend payload correction.

### [B2] G7's production integration bar is missed by an internal-hook mock

Location:

- `src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.pb.wiring.test.tsx:55-70`
  at `c79ea87`

The five paths are otherwise genuine and surgical: each renders the production editor, uses
the production draft hook and immutable primitive, drives a distinct real action, plants
distinct bytes, and asserts the exact Storage boundary plus real DOM state. But the suite
also executes:

```text
vi.mock('@/hooks/use-toast', ...)
```

G7 permits mocking only external boundaries: Supabase auth/table/storage, paid invocation,
timers, and browser file input. `use-toast` is an internal production React hook and is not on
that list. It needs no provider and is usable directly. Calling it a boundary in the test
header does not amend G7.

Required remediation:

1. Remove the `use-toast` mock from the G7/T-B.8 wiring suite and run the production hook.
2. Keep the same five independent component paths and external-boundary assertions.
3. Re-run the five per-site old-wiring mutations against the corrected suite and record that
   each mutation fails its own corresponding case while the other four path cases remain
   green. The inventory case may additionally fail; it is not a substitute for the per-site
   result.

CONTRACT-COUPLED: NO.

### [B3] T-B.2's required two-entry group proof is absent

Locations:

- `src/lib/cuentacuentos/__tests__/immutableImageUpload.test.ts:237-266`
- `src/lib/cuentacuentos/__tests__/pbCriteria.test.tsx:575-591`

The helper suite proves a created call and a later captured-409 call return the same path, but
they are independent helper invocations. The criteria suite injects 409 into a one-entry
cover write. Neither test exercises the frozen T-B.2 shape: two identical decoded-byte inputs
in one logical group, one created and one duplicate conflict, both succeeding with the
group's order and length preserved.

Required remediation:

1. Add a production draft-write test with a two-entry collection containing identical
   decoded bytes.
2. Make one Storage boundary call succeed and the other return the captured structural
   `statusCode:"409"` conflict.
3. Assert one deterministic path appears twice in the persisted group and returned URL group,
   with exact length two and original order, and that the logical write succeeds.
4. Record the named mutations required by T-B.2: treating 409 as failure and treating the
   duplicate-like non-409 as success must make this evidence red.

CONTRACT-COUPLED: NO.

### [B4] T-B.9 never proves duplicate success through production `saveLiturgy`

Locations:

- `src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.pb.g5.test.tsx`
- `src/lib/cuentacuentos/__tests__/pbCriteria.test.tsx:653-697`

The G5 suite proves normal final upload success and non-409 final upload failure. The only
captured-409 cases in the repository are helper or draft-hook cases. Frozen T-B.9 explicitly
requires production `saveLiturgy` to write all final categories with `upsert:false` and for a
duplicate conflict to succeed.

Required remediation:

1. Drive production `saveLiturgy` with a final cuentacuentos image whose
   `liturgia-images` upload returns the captured structural 409.
2. Assert success, the exact deterministic public URL in `liturgia_elementos`, no inline
   fallback, `upsert:false`, and no compensating removal.
3. Add a non-409 same-message control on the same production path and assert no element
   upsert.

CONTRACT-COUPLED: NO.

### [B5] The old finalization decode/MIME helper remains beside the G2 primitive

Location:

- `src/lib/liturgia/liturgyService.ts:139-154` at `c79ea87`

`base64ToBlob` is now unused, but it is still a second production implementation of data-URL
prefix removal, base64 decoding, prefix-based MIME inference, and Blob construction in an
in-scope file. G2 says the new primitive owns those responsibilities and does not allow a
second hashing/sniffing/upload implementation. Leaving the obsolete, incorrect PNG/JPEG
inference beside the magic-byte implementation defeats that single-source topology even
though no current caller reaches it.

Required remediation:

1. Remove the unused `base64ToBlob` cuentacuentos helper from `liturgyService.ts`.
2. Re-run the in-scope production inventory and record that the shared immutable primitive is
   the only cuentacuentos decode/MIME/hash/Blob/upload implementation.
3. Leave `uploadPortadaImage` and `uploadReflexionPdf` unchanged; they are the two expressly
   out-of-scope residual uploaders.

CONTRACT-COUPLED: NO.

## CONSOLIDATED REMEDIATION — ROUND 2/2 SCOPE

All five items below are required in the one remediation:

1. Fix the finalized option-array inline-byte leak and strengthen G5 step 4 to require no
   inline image anywhere in persisted `storyData`, plus reopen preservation.
2. Remove the internal `use-toast` mock from G7, preserve the five real paths, and re-record
   the five surgical per-site wiring mutations.
3. Add the exact T-B.2 two-entry created-plus-409 group/order/length proof and its two error
   mutations.
4. Add production-`saveLiturgy` captured-409 success and same-message non-409 failure proofs.
5. Remove the unused legacy `base64ToBlob` implementation and renew the unique-primitive
   inventory.

Do not edit or regenerate `pb_fe_base_185c370.json`, either frozen EDGE corpus, or their
blobs. Do not broaden the edge allowlist, add signed `liturgia-images`, add Storage deletion,
change response shapes, merge branches, deploy, or push `main`.

Round 2 must re-run the affected focused suites under Node 22.22.0 serially, the full FE D6
gates like-for-like, and the unchanged EDGE gates/corpus pins if the EDGE tip is included in
the re-review target.

## RATIFICATION / STRIKE DECISIONS

### FE deviations

- **F3 upload-order multiset: RATIFY.** `crypto.subtle.digest` makes arrival order at Storage
  non-contractual under concurrency. Persisted group order and length remain strict and are
  tested independently.
- **F4 failed HEAD probe carries URL verbatim: RATIFY.** G2/G4 require existing HTTP(S)
  entries to pass through unchanged. Returning `null` would reintroduce T-B.1's forbidden
  compaction.
- **F5 fixture-only repairs: RATIFY.** The diff changes only malformed image literals to real
  PNG fixtures; no assertion line changed.
- **F6 `_selected` suffix retirement: RATIFY.** G2's exact path is
  `${key}_${hash32}.${ext}`; retaining `_selected` would violate it.
- **PB-F7 raw option-array leak: STRIKE.** It violates G5/T-B.9; see [B1].
- **PB-F8 N3a/N3b split: RATIFY.** The real remove-prop route and the separately reachable A4a
  orphan-accounting route both preserve bytes, and each now has a load-bearing planted-remove
  mutation.
- **PB-F9 Node/WebCrypto agreement: RATIFY.** Independent Node/Python hashes agree with
  WebCrypto in the actual Vitest runtime.

### EDGE findings

- **F1 formatting substitute: RATIFY IN SUBSTANCE.** New files are clean and the existing
  formatting transform is identical at base/head. Correct the literal “46 unified hunks”
  description if that is what was intended; my canonical count is 27 on each side.
- **F2 `DRAFTS_BUCKET_PATH` documentation correction: RATIFY.** It corrects a newly false
  one-bucket comment/label and changes no behavior.
- **F3 PB-I3b base-red reclassification: RATIFY.** At `db42745`, collector order reaches the
  disallowed refine source before the planted character field, so the head expectation is
  genuinely base-red rather than a coverage-only green case.

### D6 amendment

**RATIFY.** `npx vitest run --no-file-parallelism` is a valid canonical D6 command when used
identically at base and head under Node 22.22.0. It removes CPU-contention ordering/flakiness
from the comparison without hiding a head-only failure.

## FROZEN-QUESTION ANSWERS

### Q1 — verdict / G1-G7

- G1: MET.
- G2: NOT MET IN FULL because the obsolete second decode/MIME helper remains; [B5].
- G3: MET. The captured structural `statusCode` discriminator, duplicate controls, upload-first
  path, and no message matching are sound.
- G4: MET for the specified logical write/failure matrix. I found no non-409 upload failure
  that reaches a draft/element upsert, React success swap, successful pipeline result, or
  manual success message in the exercised in-scope paths.
- G5: NOT MET because the final payload still contains H2 inline bytes and production
  finalization lacks the required 409 proof; [B1], [B4]. The deletion identity itself is
  correct and contains no hash/path: it remains `story.id + updated_at`.
- G6: MET, with the comparator qualification recorded above.
- G7: NOT MET because of the internal `use-toast` mock; [B2]. The five actions and their
  distinct-byte Storage assertions are otherwise genuine.

### Q2 — FE deviations

F3/F4/F5/F6 and PB-F8/PB-F9 are ratified. PB-F7 is struck and is remediation, not backlog.

### Q3 — EDGE findings

F1/F2/F3 are ratified. F1's invariant is correct; its literal hunk-count label should use the
measurement method stated above.

### Q4 — D6 amendment

Ratified.

### Q5 — contract coupling

No EDGE handler, response-envelope, warning, skipped-image, or error-code production file
changed. The sole behavior change is validation admission of the exact public
`liturgia-images` prefix. The focused tests prove:

- 404 landmark/prop entries still continue with `skippedImages`;
- 404 refine still returns `REFINE_SOURCE_UNAVAILABLE`;
- unsupported refine still returns `NOT_IMAGE`;
- sign form, third bucket, prefix collision, and encoded traversal still return the existing
  typed 422 failures before fetch/provider use.

`skippedImages`, `warnings`, and error response shapes are unchanged. D4 classification is
unchanged after admission.

### Q6 — completeness against T-B.1-T-B.14

- T-B.1, T-B.3-T-B.7, T-B.10-T-B.14: MET.
- T-B.8: NOT MET because the G7 suite mocks an internal hook; [B2].
- T-B.2: incomplete exact group proof; [B3].
- T-B.9: incomplete and behaviorally violated; [B1], [B4].

No other required G1-G7/T-B.1-T-B.14 item was found missing.

LOW-CONFIDENCE / NON-VERDICT: none.
