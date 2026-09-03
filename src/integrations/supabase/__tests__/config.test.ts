import { describe, expect, it } from 'vitest';
import {
  CASA_PROJECT_REF,
  CASA_SUPABASE_URL,
  FORBIDDEN_PROJECT_REFS,
  SUPABASE_ANON_KEY_ENV,
  SUPABASE_URL_ENV,
  SupabaseConfigError,
  readJwtRole,
  resolveSupabaseBrowserConfig,
} from '../config.ts';

// Key material is assembled at runtime from harmless parts, so this file
// contains no credential-shaped literal (see scripts/security/credential-guard.mjs).
const base64url = (value: unknown): string =>
  btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fakeJwt = (payload: Record<string, unknown>): string =>
  [base64url({ alg: 'HS256', typ: 'JWT' }), base64url(payload), 'f'.repeat(43)].join('.');

const CASA_ANON_JWT = fakeJwt({ iss: 'supabase', ref: CASA_PROJECT_REF, role: 'anon' });
const SERVICE_JWT = fakeJwt({ iss: 'supabase', ref: CASA_PROJECT_REF, role: 'service_role' });
const OTHER_PROJECT_ANON_JWT = fakeJwt({ iss: 'supabase', ref: 'someotherprojectref0', role: 'anon' });
const PUBLISHABLE_KEY = ['sb', 'publishable', 'unit-test-'.padEnd(30, 'k')].join('_');
const SECRET_KEY = ['sb', 'secret', 'unit-test-'.padEnd(30, 'k')].join('_');

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(SupabaseConfigError);
    return (error as SupabaseConfigError).code;
  }
  throw new Error('expected SupabaseConfigError');
}

describe('resolveSupabaseBrowserConfig (runtime defense in depth)', () => {
  it('returns trimmed url and anon key for the CASA project', () => {
    const config = resolveSupabaseBrowserConfig({
      VITE_SUPABASE_URL: `  ${CASA_SUPABASE_URL}  `,
      VITE_SUPABASE_ANON_KEY: ` ${CASA_ANON_JWT} `,
    });
    expect(config).toEqual({ url: CASA_SUPABASE_URL, anonKey: CASA_ANON_JWT, target: 'casa' });
  });

  it('accepts a modern publishable key', () => {
    expect(
      resolveSupabaseBrowserConfig({ VITE_SUPABASE_URL: CASA_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: PUBLISHABLE_KEY }).anonKey,
    ).toBe(PUBLISHABLE_KEY);
  });

  it('accepts the explicitly supported local Supabase stack', () => {
    for (const local of ['http://127.0.0.1:54331', 'http://localhost:54331', 'http://127.0.0.1:54321']) {
      expect(
        resolveSupabaseBrowserConfig({ VITE_SUPABASE_URL: local, VITE_SUPABASE_ANON_KEY: CASA_ANON_JWT }).target,
      ).toBe('local');
    }
  });

  it('refuses the local stack for every build command (any mode) but not for the dev server or at runtime', () => {
    const env = { VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: CASA_ANON_JWT };
    for (const mode of ['production', 'staging', 'development']) {
      expect(codeOf(() => resolveSupabaseBrowserConfig(env, { command: 'build', mode }))).toBe('url-local-in-build');
    }
    expect(codeOf(() => resolveSupabaseBrowserConfig(env, { mode: 'production' }))).toBe('url-local-in-production');
    expect(resolveSupabaseBrowserConfig(env, { command: 'serve', mode: 'development' }).target).toBe('local');
    expect(resolveSupabaseBrowserConfig(env).target).toBe('local');
    expect(resolveSupabaseBrowserConfig({ VITE_SUPABASE_URL: CASA_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: CASA_ANON_JWT }, { command: 'build', mode: 'staging' }).target).toBe('casa');
  });

  it('fails clearly when a variable is missing, naming the variable only', () => {
    try {
      resolveSupabaseBrowserConfig({ VITE_SUPABASE_ANON_KEY: CASA_ANON_JWT });
      throw new Error('expected SupabaseConfigError');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain(SUPABASE_URL_ENV);
      expect(message).not.toContain(CASA_ANON_JWT);
    }
    expect(codeOf(() => resolveSupabaseBrowserConfig({ VITE_SUPABASE_URL: CASA_SUPABASE_URL }))).toBe('missing');
  });

  it('rejects the FNE project and every other hosted project', () => {
    expect(
      codeOf(() =>
        resolveSupabaseBrowserConfig({
          VITE_SUPABASE_URL: `https://${FORBIDDEN_PROJECT_REFS[0]}.supabase.co`,
          VITE_SUPABASE_ANON_KEY: CASA_ANON_JWT,
        }),
      ),
    ).toBe('url-forbidden-project');
    expect(
      codeOf(() =>
        resolveSupabaseBrowserConfig({
          VITE_SUPABASE_URL: 'https://someotherprojectref0.supabase.co',
          VITE_SUPABASE_ANON_KEY: CASA_ANON_JWT,
        }),
      ),
    ).toBe('url-other-project');
  });

  it('never accepts a service_role JWT or a secret key in the browser', () => {
    expect(
      codeOf(() => resolveSupabaseBrowserConfig({ VITE_SUPABASE_URL: CASA_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: SERVICE_JWT })),
    ).toBe('key-service-role');
    expect(
      codeOf(() => resolveSupabaseBrowserConfig({ VITE_SUPABASE_URL: CASA_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: SECRET_KEY })),
    ).toBe('key-secret');
  });

  it('rejects an anon key that belongs to a different project', () => {
    expect(
      codeOf(() =>
        resolveSupabaseBrowserConfig({ VITE_SUPABASE_URL: CASA_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: OTHER_PROJECT_ANON_JWT }),
      ),
    ).toBe('key-other-project');
  });

  it('error messages never echo the offending key', () => {
    try {
      resolveSupabaseBrowserConfig({ VITE_SUPABASE_URL: CASA_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: SERVICE_JWT });
      throw new Error('expected SupabaseConfigError');
    } catch (error) {
      expect((error as Error).message).toContain(SUPABASE_ANON_KEY_ENV);
      expect((error as Error).message).not.toContain(SERVICE_JWT.split('.')[1]);
    }
  });
});

describe('readJwtRole', () => {
  it('reads the role claim of a JWT-shaped key', () => {
    expect(readJwtRole(CASA_ANON_JWT)).toBe('anon');
    expect(readJwtRole(SERVICE_JWT)).toBe('service_role');
  });

  it('returns undefined for non-JWT keys and malformed payloads', () => {
    expect(readJwtRole(PUBLISHABLE_KEY)).toBeUndefined();
    expect(readJwtRole('a.b')).toBeUndefined();
    expect(readJwtRole('a.!!!.c')).toBeUndefined();
  });
});
