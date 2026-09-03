/**
 * Offline tests for the CASA browser Supabase policy (src/integrations/supabase/config.ts)
 * and its build-time Vite guard (scripts/security/vite-supabase-env-guard.ts).
 * All keys are synthetic values assembled at runtime. Run: npm run test:security
 */
import assert from 'node:assert/strict';
import {
  CASA_PROJECT_REF,
  CASA_SUPABASE_URL,
  FORBIDDEN_PROJECT_REFS,
  LOCAL_SUPABASE_URLS,
  SupabaseConfigError,
  readJwtRole,
  resolveSupabaseBrowserConfig,
  validateBrowserKey,
  validateSupabaseUrl,
} from '../../src/integrations/supabase/config.ts';
import { PLUGIN_NAME, ViteEnvGuardError, supabaseBrowserEnvGuard } from './vite-supabase-env-guard.ts';

function b64url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jwt(payload: Record<string, unknown>): string {
  return [b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), b64url(JSON.stringify(payload)), 's'.repeat(43)].join('.');
}

const FNE_REF = FORBIDDEN_PROJECT_REFS[0];
const CASA_ANON = jwt({ iss: 'supabase', ref: CASA_PROJECT_REF, role: 'anon' });
const CASA_SERVICE = jwt({ iss: 'supabase', ref: CASA_PROJECT_REF, role: 'service_role' });
const FNE_ANON = jwt({ iss: 'supabase', ref: FNE_REF, role: 'anon' });
const OTHER_ANON = jwt({ iss: 'supabase', ref: 'someotherprojectref0', role: 'anon' });
const UNKNOWN_ROLE = jwt({ iss: 'supabase', ref: CASA_PROJECT_REF, role: 'authenticated' });
const LOCAL_ANON = jwt({ iss: 'supabase-demo', role: 'anon' });
const MALFORMED_JWT = [b64url(JSON.stringify({ alg: 'HS256' })), b64url('this is not json'), 's'.repeat(43)].join('.');
const PUBLISHABLE = 'sb_publishable_' + 'k7'.repeat(12);
const SECRET = 'sb_secret_' + 'k7'.repeat(12);
const ACCESS_TOKEN = 'sbp_' + 'a1'.repeat(15);
const FNE_URL = `https://${FNE_REF}.supabase.co`;
const OTHER_URL = 'https://someotherprojectref0.supabase.co';

function expectError(fn: () => unknown, code: string, ...mustNotContain: string[]): SupabaseConfigError {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof SupabaseConfigError, `expected SupabaseConfigError, got ${String(error)}`);
    assert.equal(error.code, code);
    for (const value of mustNotContain) {
      assert.equal(error.message.includes(value), false, `message must not echo the value (${code})`);
    }
    return error;
  }
  throw new Error(`expected SupabaseConfigError ${code}`);
}

// ─── URL policy ──────────────────────────────────────────────────────────────

Deno.test('URL: exactly the hosted CASA URL is accepted (trailing slash tolerated)', () => {
  assert.deepEqual(validateSupabaseUrl(CASA_SUPABASE_URL), { url: CASA_SUPABASE_URL, target: 'casa' });
  assert.deepEqual(validateSupabaseUrl(`${CASA_SUPABASE_URL}/`), { url: CASA_SUPABASE_URL, target: 'casa' });
});

Deno.test('URL: explicitly supported local Supabase URLs are accepted', () => {
  for (const local of LOCAL_SUPABASE_URLS) assert.equal(validateSupabaseUrl(local).target, 'local');
  assert.deepEqual([...LOCAL_SUPABASE_URLS], ['http://127.0.0.1:54321', 'http://localhost:54321']);
});

Deno.test('URL: the FNE project is explicitly refused', () => {
  const error = expectError(() => validateSupabaseUrl(FNE_URL), 'url-forbidden-project');
  assert.match(error.message, /FNE/);
});

Deno.test('URL: every other hosted project, plain-http CASA, paths and garbage are refused', () => {
  expectError(() => validateSupabaseUrl(OTHER_URL), 'url-other-project', 'someotherprojectref0');
  expectError(() => validateSupabaseUrl(`http://${CASA_PROJECT_REF}.supabase.co`), 'url-not-allowed');
  expectError(() => validateSupabaseUrl(`${CASA_SUPABASE_URL}/rest/v1`), 'url-not-allowed');
  expectError(() => validateSupabaseUrl('https://example.org'), 'url-not-allowed');
  expectError(() => validateSupabaseUrl('http://localhost:9999'), 'url-not-allowed');
  expectError(() => validateSupabaseUrl('not a url'), 'url-invalid');
});

// ─── Key policy ──────────────────────────────────────────────────────────────

Deno.test('key: a CASA anon JWT or an sb_publishable_ key is accepted', () => {
  assert.equal(validateBrowserKey(CASA_ANON, 'casa'), CASA_ANON);
  assert.equal(validateBrowserKey(PUBLISHABLE, 'casa'), PUBLISHABLE);
  assert.equal(validateBrowserKey(PUBLISHABLE, 'local'), PUBLISHABLE);
});

Deno.test('key: service_role JWTs are refused even for CASA', () => {
  expectError(() => validateBrowserKey(CASA_SERVICE, 'casa'), 'key-service-role', CASA_SERVICE.split('.')[1]);
  expectError(() => validateBrowserKey(CASA_SERVICE, 'local'), 'key-service-role');
});

Deno.test('key: sb_secret_ and sbp_ credentials are refused', () => {
  expectError(() => validateBrowserKey(SECRET, 'casa'), 'key-secret', SECRET);
  expectError(() => validateBrowserKey(ACCESS_TOKEN, 'casa'), 'key-access-token', ACCESS_TOKEN);
});

Deno.test('key: unknown JWT roles, malformed JWT-shaped values and arbitrary formats are refused', () => {
  expectError(() => validateBrowserKey(UNKNOWN_ROLE, 'casa'), 'key-unknown-role');
  expectError(() => validateBrowserKey(MALFORMED_JWT, 'casa'), 'key-malformed-jwt', MALFORMED_JWT);
  expectError(() => validateBrowserKey('hello-world-not-a-key', 'casa'), 'key-unsupported-format', 'hello-world-not-a-key');
  expectError(() => validateBrowserKey('a.b.c', 'casa'), 'key-malformed-jwt');
});

Deno.test('key: anon JWTs of FNE or any other project are refused for the CASA target', () => {
  expectError(() => validateBrowserKey(FNE_ANON, 'casa'), 'key-other-project', FNE_ANON);
  expectError(() => validateBrowserKey(OTHER_ANON, 'casa'), 'key-other-project', OTHER_ANON);
});

Deno.test('key: local target accepts the demo anon JWT and the CASA anon JWT, never another project', () => {
  assert.equal(validateBrowserKey(LOCAL_ANON, 'local'), LOCAL_ANON);
  assert.equal(validateBrowserKey(CASA_ANON, 'local'), CASA_ANON);
  expectError(() => validateBrowserKey(OTHER_ANON, 'local'), 'key-other-project');
});

Deno.test('readJwtRole reads roles and returns undefined for non-JWT keys', () => {
  assert.equal(readJwtRole(CASA_ANON), 'anon');
  assert.equal(readJwtRole(CASA_SERVICE), 'service_role');
  assert.equal(readJwtRole(PUBLISHABLE), undefined);
  assert.equal(readJwtRole(MALFORMED_JWT), undefined);
});

// ─── Combined resolution ─────────────────────────────────────────────────────

Deno.test('resolve: valid CASA configuration resolves with trimmed values', () => {
  const config = resolveSupabaseBrowserConfig({ VITE_SUPABASE_URL: ` ${CASA_SUPABASE_URL} `, VITE_SUPABASE_ANON_KEY: ` ${CASA_ANON} ` });
  assert.deepEqual(config, { url: CASA_SUPABASE_URL, anonKey: CASA_ANON, target: 'casa' });
});

Deno.test('resolve: missing variables fail naming only the variable', () => {
  const error = expectError(() => resolveSupabaseBrowserConfig({ VITE_SUPABASE_ANON_KEY: CASA_ANON }), 'missing', CASA_ANON);
  assert.match(error.message, /VITE_SUPABASE_URL/);
  expectError(() => resolveSupabaseBrowserConfig({ VITE_SUPABASE_URL: CASA_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: '   ' }), 'missing');
});

Deno.test('resolve: a local URL is refused for production builds but accepted otherwise', () => {
  const env = { VITE_SUPABASE_URL: LOCAL_SUPABASE_URLS[0], VITE_SUPABASE_ANON_KEY: LOCAL_ANON };
  expectError(() => resolveSupabaseBrowserConfig(env, { mode: 'production' }), 'url-local-in-production');
  assert.equal(resolveSupabaseBrowserConfig(env, { mode: 'development' }).target, 'local');
  assert.equal(resolveSupabaseBrowserConfig(env).target, 'local');
});

// ─── Vite build/start-time guard ─────────────────────────────────────────────

Deno.test('vite guard: enforcement lives in the config hook (before any transform or emit), enforce=pre', () => {
  const plugin = supabaseBrowserEnvGuard({ VITE_SUPABASE_URL: CASA_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: CASA_ANON });
  assert.equal(plugin.name, PLUGIN_NAME);
  assert.equal(plugin.enforce, 'pre');
  assert.equal(typeof plugin.config, 'function');
  for (const later of ['transform', 'buildStart', 'generateBundle', 'writeBundle', 'load']) {
    assert.equal(later in plugin, false, `guard must not defer to the ${later} hook`);
  }
  plugin.config({}, { command: 'build', mode: 'production' });
  plugin.config({}, { command: 'serve', mode: 'development' });
});

Deno.test('vite guard: a privileged key aborts vite build before bundling without echoing the key', () => {
  for (const key of [CASA_SERVICE, SECRET, ACCESS_TOKEN, UNKNOWN_ROLE, MALFORMED_JWT, 'random-string-key']) {
    const plugin = supabaseBrowserEnvGuard({ VITE_SUPABASE_URL: CASA_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: key });
    assert.throws(
      () => plugin.config({}, { command: 'build', mode: 'production' }),
      (error: unknown) =>
        error instanceof ViteEnvGuardError &&
        /aborted before bundling/.test(error.message) &&
        !error.message.includes(key.slice(-20)),
    );
    assert.throws(() => plugin.config({}, { command: 'serve', mode: 'development' }), ViteEnvGuardError);
  }
});

Deno.test('vite guard: the FNE project and every other project abort vite build and vite dev', () => {
  for (const url of [FNE_URL, OTHER_URL, 'https://example.org']) {
    const plugin = supabaseBrowserEnvGuard({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: CASA_ANON });
    assert.throws(() => plugin.config({}, { command: 'build', mode: 'production' }), ViteEnvGuardError);
    assert.throws(() => plugin.config({}, { command: 'serve', mode: 'development' }), ViteEnvGuardError);
  }
  const fne = supabaseBrowserEnvGuard({ VITE_SUPABASE_URL: FNE_URL, VITE_SUPABASE_ANON_KEY: FNE_ANON });
  assert.throws(() => fne.config({}, { command: 'build', mode: 'production' }), (error: unknown) =>
    error instanceof ViteEnvGuardError && error.code === 'url-forbidden-project');
});

Deno.test('vite guard: missing variables abort, and the error carries the policy code', () => {
  const plugin = supabaseBrowserEnvGuard({});
  assert.throws(() => plugin.config({}, { command: 'build', mode: 'production' }), (error: unknown) =>
    error instanceof ViteEnvGuardError && error.code === 'missing' && /VITE_SUPABASE_URL/.test(error.message));
});

Deno.test('vite guard: a local stack is allowed for vite dev but not for a production build', () => {
  const plugin = supabaseBrowserEnvGuard({ VITE_SUPABASE_URL: LOCAL_SUPABASE_URLS[1], VITE_SUPABASE_ANON_KEY: LOCAL_ANON });
  plugin.config({}, { command: 'serve', mode: 'development' });
  assert.throws(() => plugin.config({}, { command: 'build', mode: 'production' }), (error: unknown) =>
    error instanceof ViteEnvGuardError && error.code === 'url-local-in-production');
});
