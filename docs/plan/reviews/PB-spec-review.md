CODEX SPEC REVIEW — PB — vs cc-downscale-a@185c370 + phase/pd-contract@db42745

VERDICT: EXECUTABLE WITH THE TEXT BELOW

The two-branch topology and the public `liturgia-images` contract change are sound. The draft is
not executable verbatim: its signed-form addition is not supported by a producer or live datum,
its `editorStateV1` description assigns image paths to the wrong persistence object, and its
partial-upload premise is false. At `185c370`, Storage failures are swallowed in both the draft
uploader and finalization service; a touched DB category can be shortened or cleared while the
write still resolves, and finalization can persist the failed field's original base64. Those
behaviors must be captured from the base and then intentionally replaced by fail-closed logical
writes.

Everything below is binding executor scope. It replaces the PB draft's unresolved gap block and
the struck text identified at the end of this review.

## INDEPENDENT FACT CHECK

I reviewed both bases with `git show`, without checking out either lineage.

- `185c370` contains `0e1d53b`; `db42745` does not. Neither final tip contains the other. Their
  changes since common base `2e9eeae` have no common paths.
- The hook has the stated drafts bucket, positional `upsert:true` uploader, prefix-based JPEG/PNG
  guess, eight upload-category switches, path-only DB payload, and DB-only deletes.
- The editor has the four stated positional `upsert:true` save callbacks.
- `liturgyService.uploadSingleImage` has the stated positional `liturgia-images` path and
  `upsert:true`; the portada and PDF uploaders are separate, out-of-scope producers.
- At `db42745`, `_shared/imageFetch.ts` accepts only the public and signed
  `cuentacuentos-drafts` prefixes on the configured Supabase origin. Both paid handlers use the
  same collector/materializer.
- The two frozen corpus blobs are exactly
  `91ec703355f3584701fe25da484370e4ba57b156` and
  `b73fa3c645e1f29b1c697fb1b7081001987a3d15`.
- A read-only live query on 2026-07-30 independently confirmed both buckets are public; drafts has
  a 52,428,800-byte limit and PNG/JPEG/WebP allowlist; `liturgia-images` has no bucket limits.
  Drafts writes are own-first-folder and `liturgia-images` writes are admin-only. The proposed
  drafts hash path therefore remains RLS-compatible without DDL.
- A second read-only live query found 29 persisted cuentacuentos elements: 23 contain a public
  drafts URL, 5 contain a public `liturgia-images` URL, and 0 contain a signed
  `liturgia-images` URL. These are counts only; no story content was read.
- `d79d329` has exactly the stated five live-main cuentacuentos-drafts `upsert:true` sites: hook
  once and editor four times. The post-release RLS-hardening deferral is therefore correct.

## SCOPE AND TOPOLOGY

### Decision

Confirm two coordinated branches with no pre-PREL cross-merge:

- `phase/pb-storage-fe` from `cc-downscale-a`@`185c370`.
- `phase/pb-storage-edge` from `phase/pd-contract`@`db42745`.

The edge half is an independently safe, narrow contract widening for an already-live first-party
producer and may stand alone at `db42745`; it does not need to ride PG or PH. Neither PB branch is
merged, deployed, or pushed to `main` in-phase. PREL integrates the two reviewed tips and sequences
the edge deployment before any frontend release that depends on it.

### Frontend scope

In scope:

- One new shared immutable-image primitive under `src/lib/cuentacuentos/`.
- `src/hooks/useCuentacuentosDraft.ts`.
- The four cuentacuentos save callbacks in
  `src/components/liturgia-builder/editors/CuentacuentoEditor.tsx`.
- Only `uploadSingleImage` and its cuentacuentos orchestration in
  `src/lib/liturgia/liturgyService.ts`.
- Focused characterization, unit, real-hook component-integration, liturgy-save, B1-coupling, and
  reload tests.

Out of scope:

- `uploadPortadaImage`, `uploadReflexionPdf`, and every non-cuentacuentos uploader.
- Schema, bucket, or RLS changes.
- Storage deletion or GC.
- Migration or rewrite of existing object paths.
- Changes to pipeline generation, cancellation, cost, or provider contracts.
- Deploy, merge, or `main` push.

### Edge scope

In scope:

- `_shared/imageFetch.ts`: one additional exact public bucket prefix and its comment.
- New focused PB test files driving the production `generate-story` and
  `generate-scene-images` handlers.

Out of scope:

- Handler production logic, request/response envelopes, D4 degradation rules, model calls, auth,
  corpus cases, and corpus baselines.

## G1 — D3 / A7a CONTRACT

### Decision

Add exactly:

```text
/storage/v1/object/public/liturgia-images/
```

to the pinned-origin allowlist. Retain both existing drafts prefixes. Do not add
`/storage/v1/object/sign/liturgia-images/`.

The public addition is warranted by both code and live state. The exact chain is:

1. Editor finalization commits the selected story to the parent. Selected fields that are still
   base64 remain base64 at this point.
2. On the later parent liturgy save, `saveLiturgy` detects those non-HTTP selected fields,
   `uploadCuentacuentosImages` writes them through `uploadSingleImage`, and
   `updateStoryWithImageUrls` puts public `liturgia-images` URLs in the element config.
3. Reopening the saved element passes that config as `initialStory`.
4. The editor seeds its character/scene/cover/end option state from those URLs.
5. Each of the four refine factories copies the selected URL verbatim to
   `refine.sourceImage`.
6. `generate-scene-images` treats that field as consumed and fail-closed. The current
   drafts-only allowlist therefore returns `FORBIDDEN_BUCKET` before fetch/provider use.

The draft's shorthand “finalization rewrites” is too early in the lifecycle, but the regression
it names is real. The five live elements carrying public `liturgia-images` URLs independently
confirm that this is not a hypothetical producer.

The signed form is not warranted: the bucket is public, `uploadSingleImage` calls
`getPublicUrl`, there is no `createSignedUrl` producer for this bucket in either base, and the
live count is zero. D3 requires an explicit, proven allowlist—not symmetry with the drafts
bucket. A future signed producer requires a separate D3 contract change.

### Exact D3 test shape

Shared provenance tests:

- Accept a same-origin URL whose pathname begins exactly
  `/storage/v1/object/public/liturgia-images/`.
- Reject the sign form for `liturgia-images` with 422 `FORBIDDEN_BUCKET`.
- Reject prefix collisions such as `liturgia-images-evil`.
- Reject a third bucket on the pinned origin.
- Reject `%2f` and `%5c` encoded-separator traversal from either allowed bucket toward the other
  bucket.
- Retain wrong-origin, credentials, fragment, and HTTP rejection tests.

Production-consumer test for `generate-story`:

- Put a public `liturgia-images` URL in a consumed live field,
  `landmarks[0].referenceImages[0]` (the same test may repeat for a prop).
- Drive `createHandler` with a real `Request`; mock only auth, Storage/network, and providers.
- Return known PNG bytes for that exact URL.
- Assert one exact Storage fetch, HTTP 200, and that the Gemini analysis request contains those
  bytes as one `inlineData` part with sniffed `image/png`. A status-only assertion is
  insufficient.
- In the same production handler suite, put a third-bucket URL and each encoded traversal in a
  recognized field; assert 422 `FORBIDDEN_BUCKET`, the exact field, zero fetches, and zero
  provider calls.

Production-consumer test for `generate-scene-images`:

- Put a public `liturgia-images` URL in `refine.sourceImage` with non-empty feedback.
- Return known PNG bytes for that exact URL.
- Assert one exact Storage fetch, HTTP 200, and that slot 0 of the Gemini request is the
  materialized PNG bytes. Also assert the request is still a refine, not a fallback
  regeneration.
- Repeat third-bucket and encoded-traversal rejection through this handler with 422, exact
  field, zero fetches, and zero provider calls.

D4 compatibility is explicit: a 404 public `liturgia-images` landmark/prop entry in
`generate-story` is reported in `skippedImages` and generation continues; a 404
`refine.sourceImage` returns the existing precise refine failure. Adding the bucket must not
change degradation classification.

Mutation proofs:

- Remove the new public prefix: both handler consumer tests fail.
- Change either consumed field to an unconsumed field or sever its read-set entry: the relevant
  provider-byte assertion fails.
- Widen to origin-only, add the sign prefix, or omit the trailing-slash exactness: a negative
  provenance test fails.
- Decode/normalize an encoded separator into the other allowed bucket: traversal tests fail.

## G2 — ONE FRONTEND IMMUTABLE-UPLOAD PRIMITIVE

Create one exported production primitive under `src/lib/cuentacuentos/`. It owns:

- data-URL prefix removal and strict base64 decode;
- magic-byte MIME detection for PNG, JPEG, and WebP;
- SHA-256 over decoded bytes;
- the first 32 lowercase hex characters of that digest;
- `Blob` construction with the sniffed MIME;
- one `.upload(..., {contentType, upsert:false})` call;
- duplicate-conflict classification; and
- public-URL resolution.

Callers supply only an internal bucket/path prefix and semantic `key`; they do not supply a
user-controlled bucket allowlist. The final paths are:

```text
cuentacuentos-drafts:
${userId}/${liturgyId}/${category}/${key}_${hash32}.${ext}

liturgia-images:
liturgias/${liturgyId}/cuentacuentos/${category}/${key}_${hash32}.${ext}
```

Existing HTTP(S) entries do not enter the upload primitive. Their existing URL/path and array
position are carried through unchanged. The hook, all four editor callbacks, and
`liturgyService.uploadSingleImage` must call this same primitive; a second hashing/sniffing/upload
implementation is not allowed.

## G3 — IDEMPOTENCY AND THE 409 CHOICE

Use upload-first conflict handling, not a pre-upload existence check.

An existence check has a check/write race, adds one network operation, depends on read policy,
and still cannot make `upsert:true` safe. Content addressing makes the conflict meaningful:
same path means the same decoded bytes under the specified hash contract.

The pinned frontend dependency is `@supabase/storage-js` 2.90.1. The executor must capture the
real duplicate error object from an approved non-production Storage runtime before writing the
classifier. The classifier must use the runtime's structural conflict field—expected shape
`StorageApiError.statusCode === "409"`—and must not match English message text. If an approved
runtime cannot be exercised, the executor reports FINDINGS; it may not invent a message.

Required evidence:

- Record the runtime/library version and the serialized duplicate error fields.
- Feed that captured object through the production primitive and prove success.
- Feed a non-conflict error with the same message but a different status code and prove failure.
- Feed a 409 code with different/opaque message text and prove success.
- Mutation: classify by message, treat `"409"` as failure, or treat all Storage errors as
  success; the tests fail.

A 409 is an idempotent success, not proof that this attempt created the object. The primitive
returns the deterministic path/public URL in either the created or already-present case.

## G4 — CURRENT AND TARGET PARTIAL-FAILURE SEMANTICS

### Base behavior that must be captured

At `185c370`, the exact current behavior is:

- Hook categories `characterSheets`, `sceneImages`, `cover`, `end`, `props`,
  `sceneReferences`, `coverReference`, and `endReference` all continue after an individual
  decode/upload/URL-check failure because `uploadImage` catches and returns `null`.
- Array groups filter out `null`, compacting positions. The touched DB category is then replaced
  with the filtered result. A partial failure can shorten/reindex a stored list; an all-failure
  group can persist empty.
- The React swap is different from the DB write: character/scene/prop/cover/end arrays swap only
  when every expected URL exists, while scalar reference slots retain their in-memory previous
  value on `null`. This can leave React state preserving a value that `image_paths` just dropped.
- The overall hook write still resolves and the DB upsert still runs. Therefore the pipeline's
  A2 save-failed channel does not see an individual Storage failure today.
- A preliminary `image_paths` SELECT error aborts before upload/upsert. A DB upsert error rejects
  after any Storage uploads have occurred.
- Each of the four manual editor save callbacks handles one image. A decode/upload/verification
  exception aborts only that callback's local replacement, leaves the selected option in state,
  and shows its existing error message. Other editor work continues.
- Finalization categories `characters`, `scenes`, `cover`, and `end` all continue after an
  individual `uploadSingleImage` failure. The failed URL is omitted, later categories are still
  attempted, and `updateStoryWithImageUrls` falls back to the original field—which can be
  base64. `saveLiturgy` can then persist that original field and report success.

### PB target behavior

Replace those semantics as follows:

- In one logical draft write, every recognized new inline image in every touched category must
  either produce its deterministic path (created or duplicate-409) or reject the logical write.
- A non-409 decode/MIME/Storage failure aborts before the draft DB upsert. No React URL swap,
  success callback, or successful pipeline persist result is published. Existing state/DB paths
  remain authoritative. Storage objects already created by sibling concurrent jobs may remain
  as allowed PB orphans; PB never compensates with deletion.
- Explicit empty patch values remain successful clears and perform zero uploads. This is not an
  upload failure.
- Manual editor saves retain their present user-facing failure behavior: no option/selection
  replacement and the existing Spanish error surface.
- During `saveLiturgy`, any non-409 cuentacuentos final-image failure makes the save return
  failure before `liturgia_elementos` is upserted. The parent therefore does not consume the B1
  confirmation closure, and the draft stays recoverable. Successful sibling uploads may remain
  as allowed orphans.
- Existing HTTP(S) values continue unchanged; PB does not download, migrate, or re-upload them.

This is an intentional base-to-target behavior change, not corpus parity. It is required to make
the draft's claimed “preserve + surface rejection” outcome true.

## G5 — FINALIZATION AND B1 COMPARE-AND-DELETE

Content hashes do not become finalization tokens. Preserve B1 exactly:

- The draft authoritative upsert still returns its atomic `updated_at` witness.
- The one-use confirmation closure still captures `story.id + expectedUpdatedAt`.
- The parent still calls it only after `onSave` has succeeded.
- The delete remains serialized behind the draft write queue and matches liturgy, user,
  `story->>id`, and `updated_at`.

Re-finalizing changed bytes writes a new hash path and a new draft `updated_at`. An older
confirmation closure therefore deletes zero rows even if its older object still exists. There is
no stale-ack coupling to object names, and PB must not add one.

Required integration proof:

1. Finalize A with bytes/hash H1 and capture closure/witness T1.
2. Before invoking it, change the selected bytes and re-finalize the same story, producing H2
   and T2.
3. Invoke the T1 closure: the compare-and-delete removes zero rows; the T2 draft and H2
   reference survive.
4. Save the parent successfully: the `liturgia_elementos` payload contains the H2 public URL,
   not H1 and not base64; only then may the T2 closure delete the matching draft.
5. Repeat the save with a non-409 final-image failure: no element upsert and no confirmation
   call; the draft survives.

Mutations using a hash/path as the delete witness, dropping `updated_at`, consuming the closure
before save success, or allowing failed final-image upload to reach element upsert must fail.

## G6 — D5 FRONTEND BEHAVIOR CAPTURE

The a1/a2/a3 suites are useful but not a PB behavior corpus. They pin patch presence, DB errors,
queueing, provenance, path-only JSON, and reload behavior; they do not inject individual Storage
upload failures, exercise all eight upload categories, drive the four manual save callbacks, or
cover `uploadCuentacuentosImages`.

Before changing any production uploader, add a capture harness while the relevant production
files are byte-identical to `185c370`. Payloads and stories must be transcribed from `git show
185c370:<path>` call sites, never from the executor's later working tree. Save the deterministic
output as a checked-in fixture named for the base, for example:

```text
src/lib/cuentacuentos/__tests__/pb_fe_base_185c370.json
```

Record its Git blob SHA in the executor report. Once captured, the fixture is read-only and is
never regenerated to green a comparison.

The capture matrix must include:

- one live-shape patch for each hook category: character sheets, scene images, cover, end,
  props-from-story, props-from-`propReferenceImages`, scene references, cover reference, and end
  reference;
- mixed URL + raw base64 + data URL inputs, including array order and URL pass-through;
- per category: all-success, one middle upload failure, all-upload failure, decode failure, and
  explicit empty;
- preliminary SELECT failure and final DB-upsert failure;
- the exact emitted upload calls/options, returned `uploadedUrls`, persisted `image_paths`,
  whether the promise resolves/rejects, and the post-write React swap result;
- each manual editor callback: existing-URL short circuit, successful upload/state collapse,
  upload failure/state preservation, and user-visible message;
- finalization characters/scenes/cover/end: success, one category failure followed by later
  categories, output story fields, whether element upsert occurs, and save result;
- current legacy positional paths and mixed positional/hash-shaped path reload;
- `editorStateV1` plus `image_paths` round trip with no base64/data URL in persisted JSON.

The post-change comparator must retain every field except the explicit PB divergences listed in
G2–G4. Each divergence is represented case-locally as old outcome, required new outcome, and
reason; it is not implemented by editing the captured old outcome. Any other difference is a
FINDING.

Characterization cases that are already green use D7 mutation evidence. New immutable/fail-closed
claims must be base-red at `185c370`.

## G7 — EDITOR INTEGRATION BAR

The shared primitive is the right topology; the hook's private `uploadImage` is not a suitable
shared dependency for the editor or `liturgyService`.

T-B.8 cannot be satisfied by:

- testing the immutable helper alone;
- mocking `useCuentacuentosDraft`;
- mocking the immutable helper and asserting it was called;
- source-text/import assertions;
- calling extracted callbacks directly; or
- rendering a test-only wrapper that does not use `CuentacuentoEditor`.

The required suite renders the production `CuentacuentoEditor` with the production
`useCuentacuentosDraft` and production immutable helper. Only external boundaries—Supabase
auth/table/storage, paid function invocation, timers, and browser file input—may be mocked.

Drive five independent production paths:

1. the character save control;
2. the scene save control;
3. the cover save control;
4. the end save control; and
5. a real component action that causes the hook to persist an inline generated/manual option.

For each path, assert at the Supabase Storage boundary: exact bucket, exact RLS-compatible hash
path, sniffed content type, `upsert:false`, public URL propagated to the real editor/hook state,
and absence of the former positional path. Plant a distinct byte fixture per site so one site's
call cannot satisfy another site's assertion.

D7 wiring proof is per-site: temporarily restore that one production site to its old inline
positional `upsert:true` call while leaving the helper and tests unchanged. Its corresponding
component case must fail. Five mutations, five recorded failures. This is the minimum bar for
“all four sites + hook route through one helper.”

`uploadSingleImage` is proven separately through production `saveLiturgy`, not by calling the
private helper directly.

## REPLACEMENT ACCEPTANCE CRITERIA

- **T-B.1 — Mixed-group preservation.** A live-shape group
  `[base64A, existingPublicUrl, base64B]` produces `[hashPathA, existingPathOrUrl, hashPathB]`
  in the same order. The URL is not uploaded and no write targets its object path. Drafts paths
  retain `userId` as segment 1. Mutations routing the URL to upload or compacting/reordering the
  group fail.

- **T-B.2 — Duplicate idempotency.** Two inputs with identical decoded bytes produce the same
  path. Exercise one created result and one captured duplicate conflict; both logical entries
  succeed and order/length are preserved. A non-conflict error with duplicate-like message
  rejects. Mutations treating 409 as failure or another error as success fail.

- **T-B.3 — Hash decoded bytes.** Two data URLs with different declared MIME prefixes but
  identical decoded PNG bytes produce the same lowercase 32-hex hash path and `image/png`.
  Mutations hashing the encoded string, prefix, `Blob`, or path fail.

- **T-B.4 — MIME truth.** Exact PNG, JPEG, and WebP fixtures produce `.png`/`image/png`,
  `.jpg`/`image/jpeg`, and `.webp`/`image/webp`. A misleading data-URL declaration does not win.
  Mutations restoring prefix inference or omitting WebP fail.

- **T-B.5 — Explicit empty and reload.** Each collection category distinguishes absent from
  explicitly empty. Empty writes the matching empty JSONB value, performs zero uploads, and
  reload does not resurrect old entries. Mutation replacing own-key presence with truthiness or
  length fails.

- **T-B.6 — Reselection/regeneration.** Changed decoded bytes produce a different path; only the
  new path is targeted, the new reference is persisted, and the old object is neither uploaded
  nor deleted. The same assertion covers character, scene, cover, and end representative paths.
  Restoring positional naming fails.

- **T-B.7 — No-delete boundary.** Production delete story, delete draft record, prop purge,
  regeneration/reset, and re-finalization flows execute with a `storage.remove` spy and make
  zero cuentacuentos-object removals. A PB diff sweep shows no newly added `storage.remove`.
  Planting a removal in each exercised flow fails its test. The pre-existing reflection-PDF
  removal is out of scope and is not misclassified.

- **T-B.8 — Production wiring.** The five real component paths satisfy G7. Helper-only or
  mocked-hook evidence does not count. The in-scope production source contains one
  hashing/sniffing/upload implementation. Each per-site old-path wiring mutation fails.

- **T-B.9 — Finalized storage + B1.** Production `saveLiturgy` writes cuentacuentos character,
  scene, cover, and end bytes to hash paths in `liturgia-images` with `upsert:false`; duplicate
  conflict succeeds. Re-finalization with changed bytes and stale/fresh acknowledgements
  satisfies the five-step G5 proof. The saved element contains only the new public URL.
  Positional naming, early acknowledgement, or base64 fallback mutations fail.

- **T-B.10 — Edge D3 consumer contract.** The exact shared and two-handler tests in G1 pass.
  Public `liturgia-images` is accepted; its sign form, a third bucket, prefix collision, and
  encoded traversal are rejected. Both handlers prove actual provider consumption, not merely
  status. D4 404/refine behavior is unchanged. Both corpus blobs remain byte-identical; no
  corpus file or corpus case is edited.

- **T-B.11 — Unsupported bytes and non-conflict failures.** Unsupported magic bytes and every
  non-409 Storage error reject the logical draft/finalization write with no draft/element
  upsert, no React success swap, and no successful pipeline result. Existing user state remains.
  Mutations defaulting unknown bytes to PNG or swallowing the error fail.

- **T-B.12 — Complete failure matrix.** Every hook category, all four manual callbacks, and all
  four finalization categories satisfy G4's target behavior. The test matrix proves later
  categories are not silently persisted after logical failure and that already-created sibling
  objects are left alone. Restoring `return null`/filter-and-continue at any category fails.

- **T-B.13 — Legacy and combined recovery contract.** Legacy positional paths, new hash paths,
  and mixed records all reload without migration. `editorStateV1` buffers/selections and
  `image_paths` image/reference paths round-trip together; persisted story/editor JSON contains
  no raw base64/data URL. Removing either persistence source or assuming a hash filename on read
  fails.

- **T-B.14 — Immutability inventory.** All six in-scope production entry points—the hook
  uploader route, four editor save callbacks, and `uploadSingleImage`—emit `upsert:false`; no
  in-scope positional upload remains. The two named non-cuentacuentos uploaders remain unchanged
  and are reported as out-of-scope residuals. A mutation setting any in-scope call to
  `upsert:true` fails an external-boundary assertion.

## GATES AND EVIDENCE

Frontend:

- Base is exactly `185c370`; record `node --version`, reference v22.22.0.
- Apply D6 like-for-like: tsc identity comparison against 1041 base diagnostics, ESLint against
  159 problems, and Vitest with only the six named pre-existing `MesaAbiertaDashboard`
  failures.
- Record every new base-red or mutation proof, including the five T-B.8 wiring mutations.
- Run focused capture/comparator, component integration, hook, liturgy service, B1, A4, and
  recovery suites.
- Verify WebCrypto SHA-256 in the actual Vitest/jsdom runtime. If unavailable, report FINDINGS;
  do not substitute a production hash algorithm.

Edge:

- Base is exactly `db42745`; record Deno 2.7.11.
- Canonical D6 gates from `supabase/functions/`: 297/0 tests, lint 94, check 46, zero new
  identities.
- Touched files pass `deno fmt --check`.
- Both corpus blob SHAs remain exact and the corpus comparison remains green.
- No live provider call.

No gate authorizes a deploy, merge, cross-merge, RLS change, or `main` push.

## STRIKE / REPLACE

### Strike 1 — B5 location

STRIKE:

> **B5 is already built** ... `editorStateV1` v:1 embedded in `story` with the full field set
> (`recoverySnapshot.ts:40-75`) ...

REPLACE WITH:

> **The combined B5 recovery contract is already built and PB preserves it.**
> `story.editorStateV1` v1 carries selections and editor buffers/mirrors
> (`recoverySnapshot.ts:40-75`); manual/generated image option paths and scene/cover/end/prop
> reference paths live separately in `image_paths`. `stripImageRef` +
> `scrubImageRefsDeep` keep base64/data URLs out of persisted story/editor JSON, and reload joins
> `editorStateV1` with `image_paths`, with safe defaults for legacy rows. PB changes only the
> write-time filename/upload semantics and re-proves this combined round trip; it does not
> redesign B5.

Reason: `EditorStateV1Extended` does not contain manual upload or reference-image path fields.
Calling its own interface the “full field set” is factually false even though the combined
persistence contract satisfies the recovery requirement.

### Strike 2 — D3 chain timing

STRIKE:

> finalization rewrites story image URLs to `liturgia-images`

REPLACE WITH:

> editor finalization hands the selected story to the parent; on the later successful parent
> liturgy save, any selected fields still encoded inline are uploaded by
> `uploadCuentacuentosImages` and rewritten by `updateStoryWithImageUrls` to public
> `liturgia-images` URLs before the element config is persisted

Reason: the rewrite happens in `saveLiturgy`, not in the editor's finalization commit. The
downstream reopen/refine regression remains real.

### Strike 3 — signed `liturgia-images`

STRIKE every PB instruction that adds or expects:

> `liturgia-images` (public + sign forms)

REPLACE WITH:

> Add only the exact public prefix
> `/storage/v1/object/public/liturgia-images/`. Keep the existing public+signed drafts prefixes.
> Explicitly test that `sign/liturgia-images` remains `FORBIDDEN_BUCKET`.

Reason: no producer, code path, or live persisted element supports the sign form. Adding it would
violate D3's evidence-bound widening rule.

### Strike 4 — partial-upload premise

STRIKE:

> per-image failure ⇒ `null` ⇒ preserve previous + surface rejection (existing :439-440 merge +
> A2 pipeline)

REPLACE WITH G4 in full.

Reason: `:439-440` covers only in-memory scalar-reference fallback. The DB merge replaces touched
categories with filtered upload results, and the resolved promise does not reach A2's rejection
channel.

### Strike 5 — executor choice on existence checks

STRIKE:

> 409-as-success (or a pre-upload existence check — executor choice)

REPLACE WITH:

> Always attempt `upsert:false`; treat only the captured structural duplicate conflict as
> idempotent success. Do not pre-check existence and do not match English error text.

### Strike 6 — original T-B block

STRIKE T-B.1–T-B.10 in the draft and replace them with T-B.1–T-B.14 above. The old block lacked
unsupported/non-conflict failure coverage, complete category failure semantics, honest combined
recovery, the finalization/B1 ordering proof, and an external-boundary component bar strong enough
to prove production wiring.

## FINAL ANSWERS TO THE FROZEN QUESTIONS

- **Q1:** With these amendments PB is coherent with D3–D7, D9, PREL authority, and the operating
  gates. “Preserve B5/A4, do not rebuild” is correct only under the combined
  `editorStateV1 + image_paths` wording above.
- **Q2:** Confirm the two coordinated branches. The edge branch stands alone at `db42745`; it
  does not ride another phase. PREL owns their integration and release order.
- **Q3:** The refine-on-finalized chain is real, and public `liturgia-images` must be added.
  Signed `liturgia-images` is rejected. G1 is the exact provenance/cross-bucket/consumer-test
  contract for both handlers.
- **Q4:** The original ten criteria are not complete or all mutation-honest. Replace them with
  T-B.1–T-B.14; G7 is the non-negotiable T-B.8 bar.
- **Q5:** G4 and G5 resolve all three issues: B1 remains witness-based and path-independent;
  upload-first structural 409 wins over an existence check; and the exact current
  abort/continue matrix is recorded before its intentional fail-closed rewrite.
- **Q6:** G6 is the required frontend D5 capture, including fixture form, capture timing,
  immutable baseline, live-call-site provenance, and allowed-divergence method.
- **Q7:** The three factual premise defects are the B5 storage location, finalization timing, and
  partial-failure claim. The signed-form recommendation is an unsupported contract expansion.
  All four are struck above. I found no other false claim in the verified-current-state block.
