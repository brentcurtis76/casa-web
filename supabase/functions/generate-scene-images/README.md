# generate-scene-images (CASA only)

Edge Function that generates children's-story illustrations (character sheets,
scenes, covers, end cards) with Google Gemini. It is a **cost-bearing,
authenticated** endpoint bound to the **CASA** Supabase project
(`project_id` in `supabase/config.toml`). It must never be deployed to any other
project.

## Security model

| Layer | Mechanism |
| --- | --- |
| Gateway | `verify_jwt = true` in `supabase/config.toml` (and in this folder's `config.toml`). Requests without a valid project JWT never reach the handler. |
| Authentication | Handler decodes the bearer token, requires `role = authenticated` + `sub`, and verifies it with Supabase Auth (`GET /auth/v1/user`). The anon key or a `service_role` credential presented by a caller is rejected (401). The function never uses a service-role key. |
| Authorization | `has_permission(user, 'liturgy_builder', 'write')` via the CASA RBAC RPC, executed with the caller's own JWT. `general_admin` passes implicitly. |
| Project binding | `SUPABASE_URL` must point at the CASA project (or a local dev stack); otherwise every request fails closed with 500. |
| Upstream key | `GOOGLE_AI_API_KEY` is read from the function environment and sent in the `x-goog-api-key` header, never in a URL. |
| Input | Strict validation; bounded body (25 MB), text fields, counts (1–4), reference images (≤ 14 in total, ≤ 2 per landmark, ≤ 8 MB base64 each, and **≤ 10 MiB of base64 for all references combined**, see below). Reference URLs may only point at the project's own storage host (`ALLOWED_IMAGE_HOSTS` adds more) and are downloaded with size and time limits. Redirects are never followed (`redirect: "manual"` on every outbound call): a 3xx from the approved host is discarded, so a redirect can never reach an unapproved host or feed Gemini. |
| Upstream result | A `200` from Gemini that contains no usable image is an upstream failure: `502` when every variation lacks an image, or a `200` with the successful images plus a safe `errors` list when only some do. Upstream bodies are never logged or echoed. |
| Timeouts | Auth/RPC 10 s, downloads 15 s, Gemini 60 s (`UPSTREAM_TIMEOUT_MS`, clamped). Timeouts map to 504, upstream failures to 502/429/422. |
| CORS | Origin allowlist: `casa-web.vercel.app`, `casa-web-*.vercel.app` previews and the Vite dev server are built in; the production custom domain MUST be supplied via the `ALLOWED_ORIGINS` secret (see deployment blocker below). No wildcard. |
| Logging | Metadata only: event, type, counts, status codes, durations. Never headers, tokens, prompts, or image data. |

### Cumulative reference-image budget

Every reference image (inline base64, `data:` URL or a URL downloaded from the
storage host) is copied, as base64, into each of the up to four Gemini requests
of one call. To keep that payload bounded, the function enforces a single
**total budget of 10 MiB of base64 characters (≈ 7.5 MB of image bytes) per
request** (`DEFAULT_LIMITS.maxTotalReferenceBase64Chars`) on top of the
per-reference caps (8 MB base64 inline, 6 MB per download):

- inline and `data:` references are counted first, without any I/O;
- URL references are then downloaded **one at a time** and each read is bounded
  by the remaining allowance, so at most one bounded download is buffered and
  downloading stops as soon as the allowance is exhausted;
- exceeding the budget at any point returns a deterministic `413`
  (`success: false`) with **zero Gemini calls**;
- many small references (e.g. a style reference plus several character and
  landmark photos) still fit comfortably.

## Environment (names only — values are Supabase secrets)

| Name | Source |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Injected by the Supabase runtime. |
| `GOOGLE_AI_API_KEY` | `supabase secrets set GOOGLE_AI_API_KEY=<value> --project-ref <casa-ref>` |
| `ALLOWED_ORIGINS` (required for the production custom domain) | Comma-separated exact origins, e.g. the production site. Committed evidence about the production domain is contradictory (`index.html` says `https://anglicanasanandres.cl`, `robots.txt`/`VERCEL_DEPLOYMENT.md` mention `iglesia-casa.cl`), so it is not hardcoded. |
| `ALLOWED_IMAGE_HOSTS` (optional) | Comma-separated extra hosts for reference-image downloads. |
| `UPSTREAM_TIMEOUT_MS` (optional) | Gemini timeout override (10–300000). |

## Request / response contract (unchanged for the six UI callers)

`POST` JSON with `type` ∈ `scene | character | cover | end`, `styleId`, `count`
(1–4) and the type-specific fields (`scene`, `characters`, `location`,
`sceneReferenceImage`, `landmarks`, `character`, `title`, `protagonist`,
`customPrompt`, `referenceImage`). Success (200):

```json
{
  "success": true,
  "images": ["<base64>"],
  "validCount": 2,
  "requestedCount": 2,
  "referenceImagesCount": 1,
  "charactersDetected": ["Ana"]
}
```

Optional fields are omitted when they do not apply: `errors` (a list of safe,
generic messages) is present only when some variations failed while others
succeeded, and `charactersDetected` only for `type: "scene"`.

Failures return `{ "success": false, "error": "...", "images": [] }` with 400
(validation, including more than 2 reference images per landmark), 401
(unauthenticated), 403 (unauthorized / origin), 413 (oversized body or
reference payload over the cumulative budget), 422 (safety block), 429
(upstream quota), 502/503/504 (upstream or verification failures, including a
Gemini `200` that returned no image for any variation). Multi-variation failure
responses also carry an `errors` list. The previous `prompt` echo field was
removed (no caller read it).

## Deployment blockers (not resolvable from the repository)

- **Production origin**: set `ALLOWED_ORIGINS` to the confirmed production domain
  before users call the function from it; until then such calls are refused.
- **Secrets**: `GOOGLE_AI_API_KEY` must be set on the CASA project.

## Develop, test, deploy

```bash
npm run check:functions        # deno check --no-config --no-lock --no-remote --no-npm (offline, deterministic)
npm run test:functions         # deno test  --no-config --no-lock --no-remote --no-npm (offline; no real Supabase/Google calls)
npm run deploy:check:scene-images   # verify CASA binding + verify_jwt without deploying
npm run deploy:scene-images         # supabase functions deploy generate-scene-images --project-ref <casa-ref>
```

The deploy script (`scripts/security/deploy-generate-scene-images.sh`) refuses
to run when any resolved project reference is not CASA — explicitly including
the unrelated FNE project — when `verify_jwt` is not `true`, or when
`--no-verify-jwt` is requested.
