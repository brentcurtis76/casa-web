CODEX CONFIRMATION — PC CAP — phase/pc-research@96cb2cc
DISPOSITION: CONFIRMED
RUNTIME + EVIDENCE:

- Runtime: `deno 2.7.11 (stable, release, aarch64-apple-darwin)`, V8 `14.7.173.7-rusty`, TypeScript `5.9.2`.
- Target shape: `96cb2cc` is one direct child of `04dd3d0`; the delta is exactly two files and `+3/-3`:

```text
1	1	supabase/functions/generate-story/handler.ts
2	2	supabase/functions/generate-story/handler_research_test.ts
```

- PC2 rerun at `96cb2cc`, using the committed function-level Deno config:

```text
$ deno test --config supabase/functions/deno.json --allow-read supabase/functions/generate-story/handler_research_test.ts --filter PC2
running 1 test from ./supabase/functions/generate-story/handler_research_test.ts
PC2 both research calls pin thinkingLevel LOW and maxOutputTokens 2048 ... ok (9ms)

ok | 1 passed | 0 failed | 31 filtered out (13ms)
```

- The runtime constant has exactly the two intended consumers:

```text
75:const RESEARCH_MAX_OUTPUT_TOKENS = 2048;
395:        maxOutputTokens: RESEARCH_MAX_OUTPUT_TOKENS,
518:        maxOutputTokens: RESEARCH_MAX_OUTPUT_TOKENS,
```

- Residual check:

```text
$ rg -n '1024' supabase/functions/generate-story
<no matches>
```

- The corpus baseline is untouched:

```text
04dd3d0 91ec703355f3584701fe25da484370e4ba57b156
96cb2cc 91ec703355f3584701fe25da484370e4ba57b156
```

- Cap sizing is sane against the recorded authenticated canary. The production-shaped request consumed `thoughtsTokenCount: 768` and terminated `MAX_TOKENS` at the old 1024 cap. Allowing roughly 450 tokens for the requested Spanish answer gives about 1,218 output tokens, leaving about 830 tokens of headroom under 2,048. The official Gemini 3.5 Flash model specification documents a 65,536-token output limit, so 2,048 is valid and conservative: https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash
- The delta is complete for the mandated change: it updates the single shared runtime constant, both call sites inherit it, and PC2 asserts the value on both emitted Gemini request bodies. No other `generate-story/` code consumes the old literal.

NOTES (non-verdict): none
