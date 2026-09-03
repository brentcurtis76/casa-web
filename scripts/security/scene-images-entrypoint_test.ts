/**
 * Source-level regression test for the generate-scene-images entrypoint.
 *
 * `index.ts` imports remote modules (std/http, supabase-js) and starts a server,
 * so it cannot be imported by an offline unit test. These checks pin, from the
 * source text, the two properties the remediation depends on:
 *   1. the CASA project binding runs at boot, before any client is built or
 *      the server starts;
 *   2. the production wiring passes no `imageLimits` override, so the shared
 *      production limits apply.
 * Value-free: no credentials, no network. Run: npm run test:security
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ENTRYPOINT = 'supabase/functions/generate-scene-images/index.ts';

Deno.test(`${ENTRYPOINT}: binds to the CASA project before building clients or serving`, () => {
  const text = readFileSync(join(REPO_ROOT, ENTRYPOINT), 'utf8');
  assert.match(text, /import \{ assertCasaProject \} from '\.\.\/_shared\/projectBinding\.ts';/);
  const bind = text.indexOf("assertCasaProject(supabaseUrl, 'generate-scene-images');");
  const client = text.indexOf('createClient(');
  const serve = text.indexOf('serve(createHandler(');
  assert.ok(bind >= 0, 'the entrypoint must call assertCasaProject');
  assert.ok(client > bind, 'the binding must run before the service-role client is constructed');
  assert.ok(serve > bind, 'the binding must run before the server starts');
});

Deno.test(`${ENTRYPOINT}: production wiring keeps the shared production limits`, () => {
  const text = readFileSync(join(REPO_ROOT, ENTRYPOINT), 'utf8');
  assert.doesNotMatch(text, /imageLimits/, 'index.ts must not override DEFAULT_IMAGE_LIMITS');
  assert.match(text, /'x-goog-api-key'|GOOGLE_AI_API_KEY/, 'the Gemini key is read from the environment');
  assert.doesNotMatch(text, /[?&]key=/, 'the Gemini key must never travel in a URL');
});
