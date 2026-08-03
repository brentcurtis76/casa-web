CODEX REVIEW — PF REMEDIATION RE-REVIEW — pf-fix-7d32182@0066c0f
VERDICT: FAIL
ESCALATION: This is PF's second FAIL. Per PLAN, Brent decides accept / re-plan / backlog; no
additional Codex remediation round is authorized.

RUNTIME:
deno 2.7.11 (stable, release, aarch64-apple-darwin)
v8 14.7.173.7-rusty
typescript 5.9.2

SCOPE:
Reviewed the six commits in `7d32182..0066c0f` from a clean detached worktree. The diff is
confined to seven files under `supabase/functions/**` (+1434/-121). `fase-f` and `main` were not
checked out, changed, merged, pushed, or deployed.

GATES RE-RUN:
- `deno test --allow-all .` from `supabase/functions/`:
  159 passed / 0 failed (13s), including 30 corpus cases plus the corpus↔baseline consistency
  test.
- `deno lint .`: 95 existing problems / 60 files, matching the submitted and PLAN baseline.
- `deno check .`: 46 existing errors, matching the submitted and PLAN baseline.
- `git diff --check 7d32182..0066c0f`: clean.

FINDINGS:

[B3-R] BLOCKING — the log-hygiene remediation still interpolates an untrusted request scalar
verbatim
     `supabase/functions/generate-scene-images/handler.ts:820-822`
     (the same value is logged again at `:933-935` and `:1010`; related raw request scalars remain
     at `:815` and `:844`)

     claim: `sceneReferenceMode` is read directly from client JSON with no type or enum
     validation, then inserted verbatim into the `REQUEST CHECK` log. A malicious but otherwise
     valid scene request can therefore place a full URL and signed query token in logs while the
     handler succeeds. This is the same invariant and finding class as the original [B3], not a
     new scope expansion. The remediation report's claim that every user-text channel is closed
     is false.

     repro: instantiate the production `createHandler` with the normal allowed-auth and Gemini
     stubs, wrap it in `withCapturedLogs`, and POST:

     `{"type":"scene","styleId":"storybook","scene":{"text":"Ana","visualDescription":"muelle"},"location":{"name":"Valparaiso","description":"puerto"},"characters":[],"count":1,"sceneReferenceMode":"https://secret.example/photo.png?token=SIGNEDTOKEN_REVIEW_7d32182"}`

     observed at both frozen tip `7d32182` and remediation tip `0066c0f`:

     `[generate-scene-images] REQUEST CHECK - mode=https://secret.example/photo.png?token=SIGNEDTOKEN_REVIEW_7d32182, images validated=0`

     Both responses were HTTP 200. The full signed URL and token reached the log.

     test gap: `T-F.13c` plants the secret in `type`, `styleId`, and prop text; `T-F.13d` covers
     scene narrative, entity text, and refine feedback. Neither plants it in
     `sceneReferenceMode`, `count`, or `scene.landmarkVisible`, even though those values are still
     logged raw. The 159/0 suite is therefore green while the security invariant is false.

     required disposition: classify or shape every logged request/provider value before it
     reaches `console.*`; at minimum, validate/classify `sceneReferenceMode` and add a production
     handler regression that plants the URL/token in that field. Audit the sibling raw scalar
     sites cited above instead of patching only the exhibited line.

     contract-coupled: no

REMEDIATION MATRIX:
- Prior [B1] request-type-blind consumption: FIXED. The shared read-set drives collector
  accounting and handler access; irrelevant entries retain provenance validation without fetch or
  size charge. Handler, collector, wiring, and corpus cases are present and green.
- Prior [B2] post-traversal slot guard: FIXED. The collector throws as each slot crosses the
  ceiling; proxy-count tests pin bounded traversal on both handlers, and exactly-at/one-over edges
  are covered.
- Prior [B3] raw logs: PARTIAL / STILL BLOCKING. Prompt, entity-text, error-body, and common
  provider-text channels were converted to shapes, but the request-mode channel above was missed.
- Prior [B4] lost `skippedImages`: FIXED. Both outer catches retain non-empty drop reports and keep
  no-drop envelopes unchanged.
- Prior [S1] corpus fidelity: FIXED. Raw-base64 live upload shapes and honest capability-pin
  annotations are present.
- Prior [S2] production boundaries: FIXED. The corpus includes the 500-slot / 50-consumed case;
  injected tests pin exactly-at and one-over behavior for both ceilings.

CONTRACT FOLLOW-UP:
The [B4] change is additive-only: `skippedImages` appears on error envelopes only when drops exist;
existing keys, codes, values, and statuses remain pinned. `cc-downscale-a@185c370` already parses
`InvokeError.skippedImages` on the story error path in `CuentacuentoEditor.tsx`, so the PLAN's PFE
compatibility follow-up can close as harmless/consumed.

NIT: none
LOW-CONFIDENCE (non-verdict): none

TEST-HONESTY NOTES:
The full submitted suite was run, not inferred. The new finding was then exercised through the
production handler with captured real console calls and a successful provider stub, on both
`7d32182` and `0066c0f`. No mutation or reproduction edit was made to either worktree.
