# Deploying to Vercel

This guide explains how to deploy the CASA website to Vercel.

> **Credential policy (read first).** All configuration comes from environment
> variables. Anything prefixed `VITE_` is inlined into the public browser bundle,
> so only the Supabase **anon/publishable** key may ever use that prefix.
> `service_role` keys, `sb_secret_*` keys, `sbp_*` access tokens, database URLs,
> and API keys for Google AI, Anthropic, Resend, Twilio, OpenAI, Spotify or
> Instagram must **never** be given a `VITE_` prefix, placed in a `.env*` file of
> this app, or committed. They belong exclusively to Supabase Edge Function
> secrets (`supabase secrets set ...`) on the CASA project (ref in
> `supabase/config.toml`).
>
> Two mechanisms enforce this: `vite.config.ts` refuses to build or serve unless
> `VITE_SUPABASE_URL` is exactly the CASA project (or a supported local stack)
> and `VITE_SUPABASE_ANON_KEY` is the CASA anon JWT or an `sb_publishable_*`
> key (see "Build-time enforcement"), and `npm run check:credentials` scans every
> tracked path (index and working tree) for credential-shaped literals and fails
> the quality gates on any hit.

## Prerequisites

- A [Vercel account](https://vercel.com/signup) (free tier is sufficient)
- The [Vercel CLI](https://vercel.com/docs/cli) installed (optional, for CLI deployment)

## Environment variables per CASA environment

The app reads exactly two variables (see `.env.example` and
`src/integrations/supabase/config.ts`). Use names and placeholders only when
documenting them; real values live in Vercel and in your local `.env.local`.

### Build-time enforcement

`vite.config.ts` registers `scripts/security/vite-supabase-env-guard.ts` as the
first plugin. Its `config` hook runs during configuration resolution, before Vite
transforms or emits any browser asset, for both `vite dev` and `vite build`. It
aborts the command when:

- either variable is missing;
- `VITE_SUPABASE_URL` is not exactly `https://<casa-project-ref>.supabase.co`
  (the ref is `project_id` in `supabase/config.toml`) or one of the supported
  local URLs (`http://127.0.0.1:54321`, `http://localhost:54321`); the FNE project
  and every other hosted project are refused, and local URLs are refused for
  production builds;
- `VITE_SUPABASE_ANON_KEY` is not a CASA anon JWT or an `sb_publishable_*` key
  (service_role JWTs, `sb_secret_*`, `sbp_*`, unknown roles, malformed JWT-shaped
  values and arbitrary formats are refused).

The error names the variable and the reason; it never prints the value. The same
policy runs again in the browser at startup (`client.ts`) as defense in depth, but
the build-time check is what prevents a secret from being bundled.

| Variable | Development (`.env.local`) | Preview (Vercel "Preview") | Production (Vercel "Production") |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | `http://127.0.0.1:54321` (local stack) or `https://<your-project-ref>.supabase.co` | `https://<your-project-ref>.supabase.co` | `https://<your-project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `<anon-or-publishable-key>` | `<anon-or-publishable-key-for-preview>` | `<anon-or-publishable-key-for-production>` |

- **Development**: copy `.env.example` to `.env.local` and fill in the values.
  `.env.local` is gitignored.
- **Preview**: branch and pull-request deployments. Set the variables in
  Vercel → Project → Settings → Environment Variables, scope **Preview**.
- **Production**: deployments from `main`. Set the same two variables with
  scope **Production**.

Both variables are required in every environment. Without them, or with a
wrong-project or privileged value, `vite build` fails before bundling (so a Vercel
deployment fails instead of shipping a broken or unsafe bundle). No fallback
values exist in the code.

## Method 1: Deploy via Vercel Dashboard (Recommended)

1. **Push your code to GitHub** (if not already done)
   - All configuration files are already in place

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your `casa-web` repository from GitHub

3. **Configure Environment Variables**
   - In the project settings, add the two variables for **each** environment
     you use (Production, Preview, and optionally Development), using the
     table above. Never paste a secret/service-role key here.
     ```
     VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
     VITE_SUPABASE_ANON_KEY=<anon-or-publishable-key>
     ```

4. **Deploy**
   - Click "Deploy"
   - Vercel will automatically detect the Vite framework and use the correct build settings

5. **Configure Custom Domain** (optional)
   - Go to Project Settings → Domains
   - Add the production custom domain (see "Custom Domain Setup" below for the
     open question about which domain that is)
   - Follow Vercel's instructions to update your DNS records

## Method 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   # For production deployment
   vercel --prod

   # Follow the prompts to configure your project
   ```

4. **Set Environment Variables** (you will be prompted for each value; never
   type a secret/service-role key)
   ```bash
   vercel env add VITE_SUPABASE_URL production
   vercel env add VITE_SUPABASE_ANON_KEY production
   vercel env add VITE_SUPABASE_URL preview
   vercel env add VITE_SUPABASE_ANON_KEY preview
   ```

## Project Configuration

The following files are configured for Vercel deployment:

- **vercel.json**: Vercel-specific configuration
  - Sets build command and output directory
  - Configures SPA routing (all routes redirect to index.html)
  - Sets cache headers for optimized asset delivery

- **.env.example**: Template for environment variables (names and placeholders only)
  - Copy this to `.env.local` for local development
  - Set actual values in the Vercel dashboard for Preview and Production

- **scripts/security/vite-supabase-env-guard.ts** (registered in
  `vite.config.ts`): build/start-time enforcement of the browser Supabase policy
  described above.

- **src/integrations/supabase/config.ts** and **client.ts**: the shared policy
  and the runtime re-check. There are no hardcoded fallback values.

- **scripts/security/credential-guard.mjs**: `npm run check:credentials` — part
  of the quality gates; scans every tracked path in the index and the working
  tree and fails when any contains a credential-shaped literal (JWTs,
  `sb_secret_*` keys, database URLs with passwords, API tokens, private keys).
  Values are never printed.

## Supabase Edge Function secrets (not Vercel)

Server-side secrets used by `supabase/functions/*` (for example
`GOOGLE_AI_API_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`,
`INSTAGRAM_ACCESS_TOKEN`) are configured with `supabase secrets set NAME=<value>`
on the CASA project only. They are never part of the Vercel configuration or of
the browser bundle. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the Supabase runtime.

The `generate-scene-images` function only accepts browser calls from an origin
allowlist. Preview deployments (`casa-web-*.vercel.app`) and `casa-web.vercel.app`
are built in; the production custom domain must be provided as the
`ALLOWED_ORIGINS` secret (comma-separated exact origins) before the function is
used from that domain. See `supabase/functions/generate-scene-images/README.md`.

## Automatic Deployments

Once connected to GitHub:
- Every push to the `main` branch triggers a production deployment
- Every push to other branches creates a preview deployment
- Pull requests get automatic preview URLs

## Custom Domain Setup

**Deployment blocker — production domain not established from committed
evidence.** `index.html` declares `https://anglicanasanandres.cl` as the
canonical/og URL, while `public/robots.txt` and earlier versions of this guide
mention `iglesia-casa.cl` (its sitemap line is commented out as "implement when
available"). Which domain (if any) is attached to the Vercel project cannot be
verified from the repository. Before relying on a custom domain:

1. Confirm the domain attached to the Vercel project (Settings → Domains).
2. Make `index.html` (canonical / og:url) and `public/robots.txt` agree with it.
3. Add it to the `ALLOWED_ORIGINS` secret of `generate-scene-images` on the CASA
   project; the function refuses browser calls from any other origin.

Generic steps once the domain is confirmed:

1. In Vercel Dashboard, go to your project
2. Navigate to Settings → Domains
3. Add the apex domain and its `www` variant
4. Update your DNS records with your domain registrar:
   - Apex: add an A record pointing to Vercel's IP
   - `www`: add a CNAME record pointing to `cname.vercel-dns.com`
5. Vercel will automatically provision an SSL certificate

## Troubleshooting

### Build Fails
- Check that all environment variables are set correctly in Vercel dashboard
- Verify Node.js version (Vercel uses Node 18+ by default)

### Build fails with "[casa-supabase-browser-env-guard] build aborted before bundling"
- The message names the variable and the reason (missing, wrong project, FNE
  project, privileged key, unsupported key format). Fix the variable for that
  Vercel environment (Preview and Production are configured separately) and
  redeploy. The value is never printed in the log.

### 404 Errors on Refresh
- This should be handled by the `vercel.json` rewrite rules
- If issues persist, check that `vercel.json` is committed to your repo

### Supabase Connection Issues
- Verify environment variables are set correctly
- Check Supabase dashboard to ensure the project is active
- Verify the API URL and anon key are correct

## Support

For more information:
- [Vercel Documentation](https://vercel.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
