# Cuentacuentos Overhaul — External Code Review Brief

**Branch under review:** `cc-cleanup` (stacked on `cc-entity-sheets` ← `cc-auto-pipeline` ← `cc-fast-defaults` ← `main`)
**Scope:** 5 commits, 21 files, +2,457 / −3,842 lines
**Author:** Claude (Fable 5), Direct Execution authorized by Brent Curtis, July 2026
**App:** CASA church platform (Vite SPA, React Router 6, TypeScript strict, Supabase edge functions in Deno, Vercel hosting)

---

## 1. Goal

The "Cuentacuentos" feature generates an illustrated children's story (12–16 scenes)
for the Sunday liturgy: Claude writes the story, Gemini illustrates it. The owner
reported three problems:

1. **Slow and clunky** — ~22 manual click-and-wait cycles per story (one per character
   sheet, one per scene behind a global UI lock, plus cover and end card), each
   generating 4 candidate images on `gemini-3-pro-image-preview` (the slowest, most
   expensive tier), followed by a draft save that re-uploaded **every** previously
   generated image and issued one HTTP HEAD request per file (O(N²) as scenes accumulate).
2. **Recurring places and things drift visually** — characters got generated,
   style-matched reference sheets; places/objects (a car, a church) had a data model
   (`StoryProp`) but **no UI in the real editor to create them**, no auto-detection,
   and no generated reference sheets, so the image model redrew them differently in
   every scene.
3. **Model question** — is "Codex" a better image model than Gemini?

Target outcome: ~US$2 and ~5 mostly-unattended minutes per story (vs ~US$12 and
~22 waits), with characters **and** places/objects visually consistent across scenes.

## 2. Model decision (research summary)

- "Codex" is OpenAI's agentic **coding** product, not an image model. OpenAI's image
  line is the GPT Image family (`gpt-image-2` flagship as of April 2026).
- `gpt-image-2` leads single-image quality benchmarks (LMArena/Artificial Analysis,
  mid-2026) but is weaker at multi-entity scene-to-scene consistency (OpenAI's own
  docs concede this), slower (20–120 s/image), and rate-limited harder at low tiers.
- Google's Gemini image family natively separates **character / object / style
  reference slots**, which maps 1:1 onto this feature's needs.
- **Decision:** stay on Gemini; replace the preview model with
  `gemini-3.1-flash-image` (Nano Banana 2) as the default engine and
  `gemini-3-pro-image` (stable Nano Banana Pro) for cover/end/refinements.
  Both overridable via env vars (`GEMINI_IMAGE_MODEL_FLASH` / `GEMINI_IMAGE_MODEL_PRO`)
  so model-id churn never requires a client redeploy.

## 3. The plan (4 phases, one branch each)

| Phase | Branch | Theme |
|---|---|---|
| 0 | `cc-fast-defaults` | Model routing, cheaper defaults, O(N²) save fix, edge-fn hygiene |
| 1 | `cc-auto-pipeline` | Auto-generation pipeline with concurrency pool + progress UI |
| 2 | `cc-entity-sheets` | Places/objects as first-class visual entities with generated reference sheets |
| 3 | `cc-cleanup` | Delete the dead duplicate standalone flow; final review fixes |

Each phase passed the full quality-gate suite and a **multi-agent adversarial
review** (independent finder agents per lens → one adversarial verifier per finding
instructed to refute it) before its commit. A final high-effort review of the whole
stack ran at the end (see §6).

## 4. What was implemented

### Phase 0 — speed fundamentals
- **`supabase/functions/generate-scene-images/index.ts`**: `modelTier: 'flash' | 'pro'`
  request field routes to the right Gemini model (default flash); default candidate
  count 4→2; per-request timeout (60 s flash / 150 s pro) + one retry on 429/5xx/network
  honoring `Retry-After`; request-size guards (15 MB body / 6 MB per reference image,
  HTTP 413/error in Spanish); chunked base64 conversion (the old byte-by-byte loop
  burned the edge runtime's 2 s CPU budget); rate-limited failures now return HTTP 429
  so clients can throttle.
- **`supabase/functions/generate-story/index.ts`**: location research + landmark/prop
  photo analyses parallelized (`Promise.all`, previously serial); story output moved
  to a **forced Claude tool call** (`emit_story` with a JSON schema), replacing a
  fragile 4-attempt regex parse cascade (one plain-text fallback retained);
  `max_tokens` 16384 with an explicit truncation check.
- **`src/hooks/useCuentacuentosDraft.ts`**: session-level cache of verified storage
  paths (kills the per-save HEAD storm); uploads flattened and run 6-wide in parallel
  with order-preserving slots; `saveDraftNow` returns the uploaded public URLs so the
  editor and the retained draft swap base64→URL after every save (subsequent saves
  upload only new images).
- **`src/components/liturgia-builder/editors/CuentacuentoEditor.tsx`**: `modelTier`
  per call site; 2 candidates + a "2 más" append button that adds without discarding;
  selection cleared when options are replaced (stale index protection); cross-locks
  between generate and refine controls (a confirmed data-loss race).

### Phase 1 — the auto-pipeline
- **`src/hooks/useStoryImagePipeline.ts`** (new): generic task pipeline — worker pool
  of 3 with 400 ms stagger, per-task retry with backoff, concurrency drops to 1 when a
  429 is detected, `cancel()`, `retryFailed()` (preserves completed items),
  `markResolved()` (manual fixes clear stale error badges), `isBusy()` sync check.
- **Editor integration**: shared "core" functions (`generateCharacterSheetCore`,
  `generateSceneImageCore`) used by both manual buttons and pipeline tasks; ref
  mirrors of option/selection state so concurrent tasks never clobber each other from
  stale closures; a **serialized save queue** so pipeline saves never interleave;
  a `storyId` guard so in-flight results are discarded if the story is reset/deleted
  mid-generation (reset paths also cancel the pipeline).
- **Auto-kick**: entering a step via a **forward approval transition only**
  (story→characters, characters→scenes, scenes→cover) auto-generates everything
  missing in that step. Never fires on mount, draft recovery, back-navigation, or
  "edit existing story" — those show a "Generar todos (N)" button instead.
- **Progress UI (Spanish)**: per-step banners ("Generando referencias… 3 de 7 listas",
  Cancelar, Reintentar fallidas), per-scene badges (En cola / Generando / Error),
  approve buttons disabled while a batch runs.

### Phase 2 — places/objects as visual entities
- **`generate-story`**: the story schema now includes `props[]` — every place/object
  appearing in 2+ scenes, with a canonical, verbatim-repeatable `visualDescription`
  and `sceneNumbers`. Server dedupes against user-defined props (name normalization
  strips Spanish articles) and returns the remainder as `suggestedProps`.
- **`generate-scene-images`**: new `type: 'prop'` request generating a canonical
  reference sheet in the story's illustration style — establishing shot for
  locations, product shot for objects, no characters, no text; optional real photos
  attached as additional references. Scene prompts gained a "Do NOT redesign any
  character, landmark or prop" invariant.
- **`src/components/liturgia-builder/editors/PropSheetSection.tsx`** (new): the UI —
  per-prop card (generate sheet / upload photo / pick candidate / edit canonical
  description (committed on blur) / remove), plus an add-manual form. Prop sheets
  generate in the same auto-batch as character sheets.
- **Selection semantics**: the chosen sheet becomes `referenceImages[0]`
  (`sheetGenerated` flag ensures re-selection **replaces** the old sheet); the
  existing `getPropsForScene` plumbing already forwards it to every scene and cover
  request, subject to the edge function's reference-image cap.
- **Gate**: "Aprobar personajes" requires every recurring prop to have a chosen
  reference (or be removed) — the human approval gate is the consistency mechanism.

### Phase 3 — cleanup
- Deleted `src/components/cuentacuentos/` (9 components + index): a parallel
  standalone flow whose story generation was **mocked** and which nothing imported.

## 5. Files changed / created

| File | Status | Role |
|---|---|---|
| `supabase/functions/generate-scene-images/index.ts` | modified | All image generation (character/prop sheets, scenes, cover, end, refine) |
| `supabase/functions/generate-story/index.ts` | modified | Story generation (Claude) + location/photo analyses (Gemini) |
| `src/components/liturgia-builder/editors/CuentacuentoEditor.tsx` | modified (~5,800 lines) | The real editor: 5-step wizard, all orchestration |
| `src/components/liturgia-builder/editors/PropSheetSection.tsx` | **new** | Places/objects UI section |
| `src/hooks/useStoryImagePipeline.ts` | **new** | Concurrency pipeline hook |
| `src/hooks/useCuentacuentosDraft.ts` | modified | Draft persistence (uploads, URL swap, selection sanitization) |
| `src/lib/cuentacuentos/concurrency.ts` | **new** | `runWithConcurrency` / `retryWithBackoff` |
| `src/components/shared/ImageUploadButton.tsx` | **new** | Shared upload button (deduplicated) |
| `src/types/shared/story.ts` | modified | `modelTier`, `type:'prop'` request, `SuggestedStoryProp`, `sheetGenerated`, `sceneReferenceMode` fix |
| `src/hooks/__tests__/useStoryImagePipeline.test.ts` | **new** | 5 pipeline tests |
| `src/lib/cuentacuentos/__tests__/concurrency.test.ts` | **new** | 6 concurrency tests |
| `src/components/cuentacuentos/*` (10 files) | **deleted** | Dead duplicate flow |
| `docs/CUENTACUENTOS_OVERHAUL_REVIEW.md` | **new** | This document |

No database migrations. No new tables. All draft-schema additions live inside
existing JSONB columns (`cuentacuentos_drafts.story` / `image_paths`).

## 6. Review process and findings

Every phase diff went through a multi-agent adversarial review before commit
(finder agents per lens → per-finding verifier instructed to *refute*):

| Review | Raw | Confirmed | Fixed |
|---|---|---|---|
| Phase 0 diff | 8 | 5 | 5 |
| Phase 1 diff | 13 | 11 | 10 (1 accepted: preview-slide rebuild churn) |
| Phase 2 diff | 9 | 7 | 7 |
| **Final full-stack review** (8 angles: line-scan, removed-behavior, cross-file, reuse, simplification, efficiency, altitude, CLAUDE.md conventions; recall-biased verify) | 37 | 28 | 17 |

Representative fixes from the final review (commit `a2014e4`):
- Out-of-range persisted selection indices sanitized on draft load (partial upload
  failure could silently finalize a scene with no image).
- Prop reference images gained the base64→URL in-session swap channel (previously
  re-uploaded on every save and forwarded as multi-MB base64 to scene requests,
  risking the new 15 MB request guard).
- `retryFailed()` re-reads the **current** edited prompt via refs (was retrying with
  the prompt captured when the batch was created).
- `refine.sourceImage` now accepts URLs in the edge function — after the URL swap,
  refine had silently degraded into full regeneration.
- Same-location ("pov") / cover / end style references are no longer mislabeled as
  *character* references in the Gemini prompt.
- Cover/end generation gained the `storyId` orphan-guard; `handleRegenerate` clears
  prop state; prop description edits persist; edge-function errors surface real
  status + detail instead of "non-2xx status code".

### Accepted debt (documented, deliberately not fixed now)
1. `enqueueCharacterSave`/`enqueueSceneSave`, the two generate cores, and the two
   step banners are structural near-duplicates — the planned editor decomposition
   (deferred phase) is the right fix, not piecemeal extraction inside a 5,800-line file.
2. The retry-fetch wrapper is duplicated between the two edge functions — Supabase
   functions are deployed standalone here (only `_shared/adminAuth.ts` exists); a
   shared module is worth doing when a third consumer appears.
3. `swapOptionsWithUploadedUrls` (editor) vs `swapRecord` (hook) encode the same
   invariant on either side of the API boundary.
4. The `onStoryProgress` effect rebuilds all preview slides once per pipeline task
   completion (pre-existing effect; amplified by batching; pure perf).
5. Each draft save issues a SELECT of `image_paths` before the upsert (pre-existing
   read-merge-write pattern; saves are serialized so it is correct, just chatty).
6. Prop sheet **candidates** are ephemeral (not persisted); the approve gate prevents
   losing work, and the chosen sheet is persisted. Character candidates, by contrast,
   are persisted — a unified "entity" abstraction is future work.

## 7. Expected outcomes

| Metric | Before | After (expected) |
|---|---|---|
| Cost per story | ~US$12 (all images on Pro-preview ×4) | ~US$1.5–2.5 (flash ×2 for drafts, pro for cover/end) |
| Editor wall-clock | ~22 sequential click+wait cycles | ~5 min mostly unattended (3-wide parallel batches) |
| Draft save time | grows O(N²), 10–60 s late-story | uploads only new images, ~1–3 s |
| Character consistency | reference sheets (existing) | unchanged mechanism, faster model |
| Place/object consistency | none in practice | canonical generated sheet (or photos) attached to every scene |
| Story JSON parse failures | 4-attempt regex cascade, occasional total loss | forced tool call, schema-validated |

## 8. Tests and verification

**Quality gates, run after every phase and after the final review fixes** (all in the
`casa-wt-cuentos` worktree):

- `npx tsc --noEmit` — clean.
- `npm run lint` — repo has a pre-existing baseline (~116 errors, verified identical
  on clean `origin/main`); the stack introduces **zero new findings** (verified by
  running eslint on the changed files at base and head).
- `npx vitest run` — 257 passed / 6 failed; the 6 failures are pre-existing
  `MesaAbiertaDashboard` tests, verified failing identically on clean `origin/main`.
  11 new tests added (pipeline pool, cancel, retryFailed, markResolved; concurrency
  limit/order/backoff).
- `npm run build` — clean.
- `npx playwright test` — **not runnable locally**: the suite requires `.env.test`
  credentials that exist in no local checkout, and it covers only the financial
  module (no cuentacuentos specs exist).

**Not yet verified (requires deployment):** a full end-to-end story run against the
real Claude/Gemini APIs — the edge functions in this stack are not deployed. This is
the main remaining risk; see §9. Recommended smoke script after deploy: create a test
liturgy → generate story (verify `suggestedProps` appear) → approve → sheets
auto-generate (verify flash model in edge logs) → pick sheets incl. one prop →
scenes auto-generate 3-wide → force one failure → Reintentar → cover/end (verify pro
model) → finalize → reload mid-run to verify resume → verify the saved liturgy JSON
contains no base64.

## 9. Production checklist (owner actions)

1. **Merge**: `cc-cleanup` → `main` (it contains all four phases; Vercel auto-deploys
   the frontend on merge).
2. **Deploy both edge functions in the same window** (`supabase functions deploy
   generate-story generate-scene-images`). Order caveats, both benign but known:
   - New frontend + old `generate-scene-images`: `modelTier` is ignored → everything
     still generates on the old preview model at count 2. Works, no speed gain yet.
   - Old frontend + new functions: requests omit `modelTier` → default flash tier for
     ALL images (including covers). Works, silently changes image model.
   Deploying at merge time closes both windows.
3. **Env vars** (Supabase → Edge Functions): no new required vars
   (`GOOGLE_AI_API_KEY`, `ANTHROPIC_API_KEY` already set). Optional overrides:
   `GEMINI_IMAGE_MODEL_FLASH`, `GEMINI_IMAGE_MODEL_PRO`.
4. **Verify Gemini quota tier**: the pipeline runs 3-wide × 2 candidates; Tier 1
   (~10 images/min) will trigger the built-in backoff frequently. Tier 2+ recommended.
5. **Run the smoke script** from §8 on the first real story (supervised).
6. **Rollback**: revert the merge commit and redeploy the previous edge functions
   (`supabase functions deploy` from `main@{1}`); no migrations to unwind.

## 10. Where a reviewer should look hardest

1. **`CuentacuentoEditor.tsx` concurrency model** — ref mirrors + serialized save
   queue + storyId guards. The invariants are documented inline; the risk area is any
   *new* state setter added later that bypasses the refs.
2. **`useCuentacuentosDraft.ts` merge semantics** — `saveDraftToSupabase` merges new
   paths over existing JSONB; the "story.props wins over draft.propReferenceImages"
   precedence (fixed in review) is load-bearing for prop re-selection after reload.
3. **Edge-function reference assembly** (`generate-scene-images`) — the 12-image cap
   and trim priority interact with character + landmark + prop + style references;
   the `isStyleReferenceDesc` markers are string conventions shared between the
   handler and `generateImage`.
4. **Auto-kick effect** — forward-transitions-only logic and the per-story/step gate;
   the failure mode of a bug here is unwanted paid API calls.
5. **`sheetGenerated` convention** — `referenceImages[0]` is the generated sheet iff
   the flag is set; upload/restore preserves array order, which this depends on.
