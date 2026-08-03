CODEX REVIEW — PF FINAL — fase-f@7d32182
VERDICT: FAIL
RUNTIME:
deno 2.7.11 (stable, release, aarch64-apple-darwin)
v8 14.7.173.7-rusty
typescript 5.9.2

GATES RE-RUN: `deno test` → 131 passed / 0 failed (9s); `deno lint` → base
2e9eeae 101 problems, tip 7d32182 95 problems; `deno check **/*.ts` identity
delta vs 2e9eeae → base 47, tip 46, 1 removed
(`TS18046 generate-story/index.ts:831:16`), 0 added. Method: redirect stdout and
stderr, pair each `TS#### [ERROR]` with its following `at file://` line, strip
the worktree prefix through `supabase/functions/`, then `sort -u` and `comm`.

FINDINGS:

[B1] BLOCKING — `consumed` is parallel bookkeeping and marks fields the selected handler branch never reads
     `_shared/imageFetch.ts:1130` (also `generate-scene-images/handler.ts:789`)
     claim: `collectSceneImageRefs` marks all recognized fields consumed without
     considering `payload.type`, refine activation, `scene.landmarkVisible`, or
     the later handler trim; pass 2 therefore fetches unused URLs and pass 1
     charges unused inline images. This regresses a request served by the
     behavioral base.
     repro: from the tip functions directory, run `deno eval --config deno.json`
     importing `createHandler`, `runCorpusCase`, and
     `makeAuthzDeps`/`PNG_B64`, then run these two `type:"prop"` payloads against
     the scene handler:
     `payload={type:"prop",styleId:"storybook",prop:{name:"Farol",kind:"prop",visualDescription:"farol de bronce"},count:1,sceneReferenceImage:"https://proj.supabase.co/storage/v1/object/public/cuentacuentos-drafts/unused.png"}`
     and the same base payload with
     `characters:[{name:"Ana",visualDescription:"niña",referenceImage:PNG_B64(6_000_001)}]`.
     Observed at 7d32182:
     `unused bucket on type=prop {status:200,fetched:[".../unused.png"],providerImages:0,providerCalls:1}`
     and
     `oversized unused character on type=prop {status:413,code:"IMAGE_TOO_LARGE",fetched:[],providerCalls:0}`.
     The identical oversized payload run through `createHandler` at b241eaf
     with an allowed auth stub and a successful Gemini stub produced
     `status 200`, `success:true`, `referenceImagesCount:0`.
     contract-coupled: no

[B2] BLOCKING — the image-slot ceiling runs after the unbounded collection it claims to bound
     `_shared/imageFetch.ts:676` (collectors begin at `:1130`)
     claim: `maxImageSlots` is checked only after every client-controlled array
     has been fully traversed and copied into `slots`, so it does not bound
     pass-1 work. The branch adds this traversal even for fields the selected
     type ignores.
     repro: `deno eval --config deno.json 'import {collectSceneImageRefs,prevalidateImageRefs,DEFAULT_IMAGE_LIMITS} from "./_shared/imageFetch.ts"; const count=500_000; const payload={type:"prop",characters:Array.from({length:count},()=>({referenceImage:0}))}; const jsonBytes=new TextEncoder().encode(JSON.stringify(payload)).byteLength; const started=performance.now(); const slots=collectSceneImageRefs(payload); let rejection="none"; try{prevalidateImageRefs(slots,{limits:DEFAULT_IMAGE_LIMITS,supabaseUrl:"https://proj.supabase.co"})}catch(err){rejection=`${err.code} after collection`} console.log({jsonBytes,maxBodyBytes:DEFAULT_IMAGE_LIMITS.maxBodyBytes,inputEntries:count,collectedEntries:slots.length,maxImageSlots:DEFAULT_IMAGE_LIMITS.maxImageSlots,collectMs:Math.round(performance.now()-started),rejection})'`
     observed: `{jsonBytes:10500030,maxBodyBytes:20000000,inputEntries:500000,collectedEntries:500000,maxImageSlots:512,collectMs:23,rejection:"TOO_MANY_IMAGES after collection"}`.
     contract-coupled: no

[B3] BLOCKING — raw prompt and provider strings bypass log redaction
     `generate-scene-images/handler.ts:1287` (same class at
     `generate-story/handler.ts:684-696`)
     claim: log hygiene only protects selected image/error paths. User-controlled
     prompt fields, names, locations, and provider text/error bodies are logged
     raw, so a URL, query token, or base64 payload reaches logs through ordinary
     text fields.
     repro: run the scene handler under `withCapturedLogs`/`runCorpusCase` with
     `type:"prop"` and
     `prop.visualDescription:"https://secret.example/photo.png?token=SIGNEDTOKEN123"`,
     then filter captured lines for `SIGNEDTOKEN123` or `https://`.
     observed:
     `[generate-scene-images] Prompt (prop): ... Object: https://secret.example/photo.png?token=SIGNEDTOKEN123 ...`.
     contract-coupled: no

[B4] BLOCKING — story error responses lose `skippedImages` after an entry was dropped
     `generate-story/handler.ts:929`
     claim: after image materialization, the outer catch has no access to
     `skippedImages`; a normal downstream Anthropic failure therefore returns a
     response without the dropped-image report, breaking the response contract
     PFE consumed.
     repro: run `createHandler` with an allowed auth stub, a story payload
     containing `props[0].referenceImages:[HEIC_B64()]` and
     `previewPromptOnly:false`, a successful Gemini text stub, and an Anthropic
     `Response("provider rejected",{status:400})`.
     observed logs first report
     `1 image(s) skipped: props[0].referenceImages[0]=NOT_IMAGE`, but the response
     is `{status:500,keys:["success","error"],body:{success:false,error:"Error de Claude API: 400"}}`.
     contract-coupled: yes

[S1] SHOULD-FIX — two corpus origins still describe non-live request shapes
     `_shared/corpus.ts:102`, `:230`, `:428`
     claim: `story-with-prop-photos` still uses `DATA_PNG`/`DATA_JPEG` even though
     the live upload sites strip the data-URL prefix, and
     `scene-landmark-visible` cites the editor even though no live
     `generate-scene-images` invocation sends `landmarks`. A later raw-base64
     story case keeps the live flow covered, so this is bounded corpus honesty
     debt rather than a second blocking gap.
     repro: `git show fase-f:src/components/liturgia-builder/editors/CuentacuentoEditor.tsx | rg -n "handleUploadPropPhoto|split\\(','\\)\\[1\\]|landmarks:"`
     observed the upload handler and three `split(',')[1]` sites, and no
     `landmarks:` request member. `rg -n "DATA_(PNG|JPEG)|scene-landmark-visible" _shared/corpus.ts`
     observed the stale data-URL fixture at line 428 and the landmark case at
     line 230.
     contract-coupled: no

[S2] SHOULD-FIX — the corpus never reaches either production count boundary
     `_shared/corpus.ts:264` and `:440`
     claim: the editor has no photo-count cap, but the largest corpus request has
     41 slots / 21 consumed entries. No captured case documents the old-200 to
     production-ceiling rejection at 64 consumed images or the 512-slot
     traversal boundary; T-F.11 only exercises an injected smaller limit.
     repro: run a `deno eval` mapping every `CORPUS` entry through the relevant
     collector and sort by slot count.
     observed: production ceilings `{consumed:64,slots:512}`; largest cases were
     `draft-with-many-prop-photos {slots:41,consumed:21}` and
     `story-with-many-prop-photos {slots:30,consumed:24}`.
     contract-coupled: no

NIT: none

LOW-CONFIDENCE (non-verdict): none

NOTES ON THE PLAN: D4 should distinguish fatal inline size/budget failures from
skippable pass-2 download size/budget failures; its current shorthand says
“per-image + aggregate size” are fatal and conflicts with the implemented
degradation contract. D6 should record the exact Deno check invocation and
identity-extraction method beside the baseline: `deno check **/*.ts` produces
47→46 here, while the older absolute 43→42/“known 42” count comes from a
different invocation. The PF focus correctly identified `consumed` as parallel
bookkeeping risk, but the plan should require the collector to share a
single-sourced consumption plan with handler control flow and require the slot
guard to short-circuit during collection, not afterward.

TEST-HONESTY NOTES: on Deno 2.7.11 a real local 302 produced
`TypeError: Fetch failed: Encountered redirect while redirect mode is set to 'error'`,
verbatim-equal to `redirectErrorFixture`; a real timeout produced
`TimeoutError: Signal timed out.`, matching the test fixture; a real DNS failure
included the URL as the suites assume. Mutating the story outer catch to
`console.error("...", error)` made R10 fail with
`AssertionError: outer catch leaked a URL`. Renaming the preview response field
to `skippedImagez` made R8-story fail with
`AssertionError: response must carry skippedImages`. Adding a baseline-only key
and, separately, a corpus-only case each made the corpus consistency test fail
with the expected array diff. All mutations were reverted.
