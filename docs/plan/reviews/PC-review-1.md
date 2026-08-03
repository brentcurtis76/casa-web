CODEX REVIEW — PC ROUND 1/2 — phase/pc-research@7d3baaf

VERDICT: FAIL

RUNTIME:

```text
deno 2.7.11 (stable, release, aarch64-apple-darwin)
v8 14.7.173.7-rusty
typescript 5.9.2
```

GATES RE-RUN:

- Detached review tip: `7d3baaf5c5e83bd4cba3f71145f787a2277eb54c`; merge-base with the review base: `c496490a38bfbe38beab2e56c629f92564105752`.
- `deno test --allow-all .` from `supabase/functions/`: `ok | 192 passed | 0 failed (24s)`.
- `deno lint .` at `c496490` and `7d3baaf`: `Found 95 problems` on both. I extracted the D6 multiset identity `error[rule] + message + normalized relative file` with line/column removed and multiplicity retained: `95 ↔ 95`, `comm -3` empty.
- `deno check .` at `c496490` and `7d3baaf`: `Found 46 errors` on both. I paired each `TS#### [ERROR]` with its following normalized `file://` location, retained line/column, sorted uniquely, and compared: `46 ↔ 46`, `comm -3` empty.
- `git diff --check c496490..7d3baaf`: clean. Scope is the reported six files and `+1069/-88`.
- F4 mutation: added `finishReason:"STOP"` to the shared Gemini corpus stub without changing the baseline, then ran `deno test --allow-all generate-scene-images/corpus_test.ts`: `ok | 31 passed | 0 failed`. The mutation was reverted.
- Corpus baseline integrity: the `corpus_baseline.json` blob is `91ec703355f3584701fe25da484370e4ba57b156` both at PF's capture commit `b1a9c6d` and at `7d3baaf`.
- Independent accepted-shape hygiene plant: a temporary focused test put `CODEXSOL_PC_SECRET` in provider `finishReason`; it failed `0 passed | 1 failed`. Verbatim evidence is in [B1]. The test was reverted.
- All review mutations were reverted; the detached review worktree was clean before removal. No live provider API was called.

ANSWERS:

Q1. [PC1]–[PC5] hold, and the functional portions of [PC6] hold, but [PC6] and the inherited PF hygiene invariant do not hold completely because of [B1].

- The result union exposes exactly the frozen seven failure codes. `NO_IMAGES` is the only `skipped` code, and `toWarning()` emits warnings only for `failed`.
- `MAX_TOKENS` and every other non-`STOP` result discard extracted text; failed and skipped results contribute empty prompt text. I found no partial-text path.
- Non-empty warnings are present on preview, story-success, and post-research error envelopes and omitted when empty. `skippedImages` retains PF's existing success/preview behavior and is preserved when non-empty on the outer error envelope.
- `index.ts` alone reads `GEMINI_RESEARCH_MODEL ?? 'gemini-3.5-flash'`; `handler.ts` has no `Deno.env` access. The injected model reaches the single shared Gemini caller used by both research paths.
- Both research request bodies send `thinkingLevel:'LOW'` and `maxOutputTokens:1024`.
- No result path produces a code outside the frozen set, no skipped result produces a warning, and no failed result contributes truncated/blocked text. The exception is the hygiene channel in [B1]: an arbitrary provider-controlled value that matches the permissive uppercase shape reaches both a log and `warnings.finishReason`.

Q2.

- (a) ACCEPT. A terminal 5xx is still an HTTP response with a useful status, so after its retry it is `PROVIDER_HTTP_ERROR + httpStatus`. `PROVIDER_UNAVAILABLE` is reserved for transport/timeout attempts that produce no response.
- (b) ACCEPT. A malformed 200 JSON body has neither usable text nor a classifiable candidate, so `EMPTY_RESPONSE` is the least-invented frozen code.
- (c) ACCEPT. Missing `finishReason` is not `STOP`, so `OUTPUT_BLOCKED` is correct; omitting the optional key is more truthful than inventing a value.
- (d) ACCEPT. No images means no analysis was requested. Checking `NO_IMAGES` first prevents a missing key from manufacturing warnings for photoless entities.
- (e) ACCEPT. `source` identifies the research call site consumed by PC-UI, not the entity's internal `kind`; a location-kind prop therefore remains `source:'prop'`.
- (f) ACCEPT. One warning per failed result preserves failure multiplicity and deterministic call order. Deduplication would silently erase how many independent analyses failed.
- (g) ACCEPT. Joining all non-thought text parts preserves the full candidate answer and can only widen `ok` relative to reading `parts[0]`; trimming and finish-reason precedence remain intact.

Q3. ACCEPT D-1 through D-5 as in-scope.

- D-1 is the minimum compile-forced corpus-test dependency injection and changes no expectation.
- D-2 is stub fidelity, not expectation editing. Once PC makes `STOP` a condition for consuming text, the two existing success stubs need the real successful candidate shape. The deliberately missing-reason case remains in PC3e, and the executor recorded R11b-story's failure before changing the stub.
- D-3 is acceptable because importing the production entrypoint would bind `serve()` at module scope. The source assertion is narrow and is backed by required dependency typing, `deno check`, and the recorded mutations.
- D-4 is an appropriate extraction correction: non-thought parts collectively form the answer. See [N1] for the absent focused test.
- D-5 matches the established PF boundary. `previewPromptOnly` intentionally echoes the caller's prompt in the preview field; PC6f correctly constrains its no-leak assertion to logs and the new warnings channel.

Q4. FIX IN PC REMEDIATION.

The neutrality claim is verified. With only `finishReason:"STOP"` added to `_shared/corpusRunner.ts`, all 31 corpus tests stayed green against the unchanged captured baseline. On the old side, `b241eaf`'s story handler has zero `finishReason` references, so the added field is ignored. Authorize the one-line fixture correction in the consolidated PC remediation; do not recapture or edit `corpus_baseline.json`.

Q5. The baseline, skipped-image, corpus, and D4 degradation boundaries survive, but log hygiene does not: [B1] demonstrates verbatim provider-controlled text in a new log channel and response warning. My URL-shaped plants, the existing PF tests, and the full corpus otherwise stayed green; the corpus baseline is unchanged.

FINDINGS:

[B1] BLOCKING — `supabase/functions/generate-story/handler.ts:170-172,300-304` — `safeFinishReason()` treats every 1–40 character uppercase/underscore string as safe. Therefore an arbitrary provider-controlled token that happens to match that broad shape is logged verbatim and returned verbatim in `warnings.finishReason`. The existing PC6a URL and PC6b lowercase plants exercise only rejected shapes; they do not prove the accepted branch hygienic. This violates frozen [PC6] and the inherited PF rule that provider/request text must not reach logs verbatim.

Verbatim focused repro:

```text
CODEX-R1 enum-shaped provider token reaches neither log nor response ... FAILED (11ms)

error: AssertionError: log leaked enum-shaped provider token: [generate-story] investigación de ubicación: OUTPUT_BLOCKED (finishReason CODEXSOL_PC_SECRET); warning={"source":"location","code":"OUTPUT_BLOCKED","message":"El servicio de investigación visual no completó la respuesta en la investigación del lugar. El cuento se generó sin esa información.","finishReason":"CODEXSOL_PC_SECRET"}

FAILED | 0 passed | 1 failed | 29 filtered out (18ms)
```

Required remediation: replace the regex-only classifier with an explicit safe provider-domain allowlist, mapping every unrecognized value—including accepted-shape strings—to `DESCONOCIDO`; add a production-handler test that plants an uppercase/underscore token and asserts absence from both captured logs and the serialized response. Preserve `OUTPUT_BLOCKED` and the existing warning shape.

CONTRACT-COUPLED: NO — the failure-code set and warning shape need not change.

[S1] SHOULD-FIX — `supabase/functions/generate-story/handler.ts:145-148`; pinned by `handler_research_test.ts:677-692` — every warning says `El cuento se generó sin esa información.` This is false on two envelopes the frozen contract explicitly requires: prompt preview does not generate a story, and the downstream-error envelope reports that story generation failed.

Verbatim observations:

```text
CODEX_PREVIEW_WARNING {"source":"location","code":"MODEL_NOT_FOUND","message":"El modelo de investigación visual no está disponible en la investigación del lugar. El cuento se generó sin esa información.","httpStatus":404}
CODEX_ERROR_WARNING {"source":"location","code":"MODEL_NOT_FOUND","message":"El modelo de investigación visual no está disponible en la investigación del lugar. El cuento se generó sin esa información.","httpStatus":404}
```

Backlog origin: PC review round 1. Prefer envelope-neutral copy such as `No se pudo incorporar esa información.` and test it on preview, success, and downstream-error envelopes before PC-UI renders it.

CONTRACT-COUPLED: NO — this changes message content, not the frozen code set or warning shape.

[N1] NIT — `supabase/functions/generate-story/handler.ts:221-230`; `handler_research_test.ts` — accepted D-4 behavior has no direct focused test. The suite's successful candidate fixtures use one text part and contain no `thought:true` fixture, so removing multi-part joining or thought exclusion would not be caught. Add one candidate with a thought part plus two non-thought text parts and assert that only the two visible parts reach the prompt.

CONTRACT-COUPLED: NO.

LOW-CONFIDENCE (non-verdict): none.

NOTES ON THE PLAN:

- Clarify `PROVIDER_UNAVAILABLE (retry exhaustion/timeout)` to `transport retry exhaustion/timeout`; a terminal HTTP response, including a retried 5xx, remains `PROVIDER_HTTP_ERROR`.
- [PC6]'s planted-token wording was too weak in practice. For any classifier that admits a “safe” domain, hygiene acceptance must plant both obviously malformed values and a fresh value that matches the accepted lexical shape but is outside the semantic allowlist. [B1] is the same shape-vs-domain lesson as PF [B3-R].
