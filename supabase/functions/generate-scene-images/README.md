# generate-scene-images (CASA only)

Edge Function that generates children's-story illustrations (character and prop
sheets, scenes, covers, end cards, refinements) with Google Gemini. It is a
**cost-bearing, authenticated** endpoint bound to the **CASA** Supabase project
(`project_id` in `supabase/config.toml`). It must never be deployed to any other
project.

## Security model

| Layer | Mechanism |
| --- | --- |
| Gateway | `verify_jwt = true` under `[functions.generate-scene-images]` in `supabase/config.toml`. Requests without a valid project JWT never reach the handler. |
| Authentication + authorization | `requireLiturgyWriter` (`_shared/liturgyAuth.ts`) runs before the body is read, before any download and before any provider call: the bearer token is verified with Supabase Auth and `has_permission(user, 'liturgy_builder', 'write')` is evaluated. Missing/invalid token → 401, denied → 403, backend failure → 503 (fail closed). Tokens whose `role` claim is `service_role` or `anon` are refused without a network call. |
| Project binding | The entrypoint (`index.ts`) refuses to start unless `SUPABASE_URL` is the CASA project or a local dev stack (`_shared/projectBinding.ts`). |
| Upstream key | `GOOGLE_AI_API_KEY` is read from the environment and sent in the `x-goog-api-key` header, never in a URL. |
| Input | `_shared/imageFetch.ts`: bounded body (20 MB), per-image cap (6 MB), aggregate image budget (14 MB decoded, reserved synchronously across at most 4 concurrent downloads), per-field entry cap, slot ceiling. Reference URLs must sit on the project's own storage origin and an allow-listed bucket prefix; redirects are refused (`redirect: "error"`); downloads are streamed with a cut-off and a 20 s timeout. |
| Upstream result | A provider response that carries no usable image is an upstream failure: 500 (or 429 on rate limiting) when every variation fails, otherwise a 200 with the successful images plus an `errors` list. |
| Logging | Shape and counts only (request type classified, text lengths, image counts); never tokens, prompts, URLs or image data. |

## Environment (names only — values are Supabase secrets)

| Name | Source |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Injected by the Supabase runtime; the service-role client is used only inside the shared authz adapter (`auth.getUser` + `has_permission`). |
| `GOOGLE_AI_API_KEY` | `supabase secrets set GOOGLE_AI_API_KEY=<value> --project-ref <casa-ref>` |
| `GEMINI_IMAGE_MODEL_FLASH`, `GEMINI_IMAGE_MODEL_PRO` (optional) | Model overrides for the two tiers. |

## Develop, test, deploy

```bash
npm run check:functions        # deno check (offline) of the handler and the shared guard/fetch modules
npm run test:functions         # deno test (--cached-only: never fetches; run `cd supabase/functions && deno cache _shared/*_test.ts` once online)
npm run deploy:check:scene-images   # verify CASA binding + verify_jwt without deploying
npm run deploy:scene-images         # supabase functions deploy generate-scene-images --project-ref <casa-ref>
```

The deploy script (`scripts/security/deploy-generate-scene-images.sh`) refuses
to run when any resolved project reference is not CASA — explicitly including
the unrelated FNE project — when `verify_jwt` is not `true`, or when
`--no-verify-jwt` is requested.
