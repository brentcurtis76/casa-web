import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CASA_PROJECT_REF, CASA_SUPABASE_URL, SupabaseConfigError } from '@/integrations/supabase/config';
import { supabase } from '@/integrations/supabase/client';
import { triggerTranscription } from '../transcriptionService';

/**
 * Regression: the transcribe-meeting invocation must build its endpoint and
 * `apikey` header from the VALIDATED browser configuration resolved at call
 * time (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY), never from a constant.
 *
 * Against HEAD 6068da0 the fetch line still referenced the deleted
 * SUPABASE_URL / SUPABASE_ANON_KEY identifiers, so the call below threw a
 * ReferenceError before reaching fetch and every assertion here failed.
 */

// Key material is assembled at runtime from harmless parts, so this file
// contains no credential-shaped literal (see scripts/security/credential-guard.mjs).
const base64url = (value: unknown): string =>
  btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fakeJwt = (payload: Record<string, unknown>): string =>
  [base64url({ alg: 'HS256', typ: 'JWT' }), base64url(payload), 'f'.repeat(43)].join('.');

const CASA_ANON_JWT = fakeJwt({ iss: 'supabase', ref: CASA_PROJECT_REF, role: 'anon' });
const LOCAL_DEMO_ANON_JWT = fakeJwt({ iss: 'supabase-demo', role: 'anon' });
const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54331';
const USER_ACCESS_TOKEN = 'unit-test-user-access-token';
const RECORDING_ID = 'rec-0001';

// The shared client is mocked globally in src/test/setup.ts; only the session
// lookup needs a concrete answer here.
const getSessionMock = vi.mocked(supabase.auth.getSession);

function getSessionResolvesWith(accessToken: string): void {
  getSessionMock.mockImplementation(
    async () =>
      ({ data: { session: { access_token: accessToken } }, error: null }) as unknown as Awaited<
        ReturnType<typeof supabase.auth.getSession>
      >,
  );
}

interface CapturedRequest {
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

function captureRequest(fetchMock: ReturnType<typeof vi.fn>): CapturedRequest {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return {
    url,
    headers: init.headers as Record<string, string>,
    body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body,
  };
}

describe('triggerTranscription — validated browser configuration', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    getSessionResolvesWith(USER_ACCESS_TOKEN);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    getSessionMock.mockReset();
  });

  it('invokes transcribe-meeting on the validated CASA URL with the validated anon key and the user token', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', CASA_SUPABASE_URL);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', CASA_ANON_JWT);

    await expect(triggerTranscription(RECORDING_ID)).resolves.toBeUndefined();

    const request = captureRequest(fetchMock);
    expect(request.url).toBe(`${CASA_SUPABASE_URL}/functions/v1/transcribe-meeting`);
    expect(request.headers.apikey).toBe(CASA_ANON_JWT);
    expect(request.headers.Authorization).toBe(`Bearer ${USER_ACCESS_TOKEN}`);
    expect(request.body).toEqual({ recording_id: RECORDING_ID });
  });

  it('follows the environment, not a constant: a supported local stack changes both the URL and the apikey', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', LOCAL_SUPABASE_URL);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', LOCAL_DEMO_ANON_JWT);

    await triggerTranscription(RECORDING_ID);

    const request = captureRequest(fetchMock);
    expect(request.url).toBe(`${LOCAL_SUPABASE_URL}/functions/v1/transcribe-meeting`);
    expect(request.headers.apikey).toBe(LOCAL_DEMO_ANON_JWT);
    expect(request.headers.apikey).not.toBe(CASA_ANON_JWT);
    expect(request.headers.Authorization).toBe(`Bearer ${USER_ACCESS_TOKEN}`);
  });

  it('normalises the configured URL the same way the shared client does (trailing slash removed)', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', `${CASA_SUPABASE_URL}/`);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', CASA_ANON_JWT);

    await triggerTranscription(RECORDING_ID);

    expect(captureRequest(fetchMock).url).toBe(`${CASA_SUPABASE_URL}/functions/v1/transcribe-meeting`);
  });

  it('refuses to invoke with a privileged key: no fetch, no fallback credential, the key is never echoed', async () => {
    const serviceRoleJwt = fakeJwt({ iss: 'supabase', ref: CASA_PROJECT_REF, role: 'service_role' });
    vi.stubEnv('VITE_SUPABASE_URL', CASA_SUPABASE_URL);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', serviceRoleJwt);

    const failure = await triggerTranscription(RECORDING_ID).then(
      () => null,
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(SupabaseConfigError);
    expect((failure as SupabaseConfigError).code).toBe('key-service-role');
    expect((failure as Error).message).not.toContain(serviceRoleJwt);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses to invoke without configuration instead of falling back to a hard-coded endpoint', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    const failure = await triggerTranscription(RECORDING_ID).then(
      () => null,
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(SupabaseConfigError);
    expect((failure as SupabaseConfigError).code).toBe('missing');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
