/**
 * Offline tests for the generate-scene-images handler.
 * No network is used: Supabase Auth, PostgREST, Storage and Gemini are replaced
 * by an in-memory fetch router. All tokens/keys are synthetic values built at
 * runtime (never real credentials).
 *
 * Run: deno test --no-remote --no-npm supabase/functions/generate-scene-images/
 */
import assert from 'node:assert/strict';
import {
  CASA_PROJECT_REF,
  DEFAULT_LIMITS,
  GEMINI_ENDPOINT,
  REQUIRED_PERMISSION,
  createHandler,
  isAllowedOrigin,
  isCasaProjectUrl,
  parseOriginList,
  type FetchLike,
  type Limits,
} from './handler.ts';

const SUPABASE_URL = `https://${CASA_PROJECT_REF}.supabase.co`;
const ANON_KEY = 'unit-test-anon-key';
const GOOGLE_KEY = 'unit-test-google-key';
const USER_ID = '11111111-2222-4333-8444-555555555555';
const ORIGIN = 'https://casa-web.vercel.app';
const ENDPOINT = 'https://edge.test/functions/v1/generate-scene-images';

function b64url(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fakeToken(payload: Record<string, unknown>): string {
  return [b64url({ alg: 'HS256', typ: 'JWT' }), b64url(payload), 'x'.repeat(43)].join('.');
}

const USER_TOKEN = fakeToken({ sub: USER_ID, role: 'authenticated', aud: 'authenticated' });
const ANON_TOKEN = fakeToken({ role: 'anon', iss: 'supabase' });
const SERVICE_TOKEN = fakeToken({ role: 'service_role', iss: 'supabase' });

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngBytes(size = 64): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(size));
  bytes.set(PNG_SIGNATURE);
  return bytes;
}

const PNG_B64 = btoa(String.fromCharCode(...pngBytes()));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function geminiImageResponse(): Response {
  return jsonResponse(200, {
    candidates: [{ content: { parts: [{ text: 'ok' }, { inlineData: { mimeType: 'image/png', data: PNG_B64 } }] } }],
  });
}

interface Call {
  url: string;
  init: RequestInit;
}

type Responder = (init: RequestInit, index: number) => Response | Promise<Response>;

interface Routes {
  auth?: Responder;
  rpc?: Responder;
  gemini?: Responder;
  storage?: Responder;
}

function makeFetch(routes: Routes, calls: Call[]): FetchLike {
  const counters = { auth: 0, rpc: 0, gemini: 0, storage: 0 };
  return (input, init = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (url.startsWith(`${SUPABASE_URL}/auth/v1/user`)) {
      const index = counters.auth++;
      return Promise.resolve(routes.auth ? routes.auth(init, index) : jsonResponse(200, { id: USER_ID, role: 'authenticated' }));
    }
    if (url.startsWith(`${SUPABASE_URL}/rest/v1/rpc/has_permission`)) {
      const index = counters.rpc++;
      return Promise.resolve(routes.rpc ? routes.rpc(init, index) : jsonResponse(200, true));
    }
    if (url.startsWith(GEMINI_ENDPOINT)) {
      const index = counters.gemini++;
      return Promise.resolve(routes.gemini ? routes.gemini(init, index) : geminiImageResponse());
    }
    if (url.startsWith(`${SUPABASE_URL}/storage/`)) {
      const index = counters.storage++;
      return Promise.resolve(
        routes.storage
          ? routes.storage(init, index)
          : new Response(pngBytes(), { status: 200, headers: { 'content-type': 'image/png' } }),
      );
    }
    return Promise.reject(new Error(`unexpected fetch to ${url}`));
  };
}

interface Harness {
  handler: (req: Request) => Promise<Response>;
  calls: Call[];
  logs: string[];
}

function setup(
  routes: Routes = {},
  envOverrides: Record<string, string | undefined> = {},
  limits: Partial<Limits> = {},
): Harness {
  const calls: Call[] = [];
  const logs: string[] = [];
  const envValues: Record<string, string | undefined> = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY: ANON_KEY,
    GOOGLE_AI_API_KEY: GOOGLE_KEY,
    ...envOverrides,
  };
  const handler = createHandler({
    env: { get: (name) => envValues[name] },
    fetch: makeFetch(routes, calls),
    log: (event, fields) => logs.push(JSON.stringify({ event, ...fields })),
    limits,
  });
  return { handler, calls, logs };
}

interface PostOptions {
  auth?: string | null;
  origin?: string | null;
  method?: string;
}

function post(body: unknown, options: PostOptions = {}): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const auth = options.auth === undefined ? USER_TOKEN : options.auth;
  if (auth) headers.authorization = `Bearer ${auth}`;
  const origin = options.origin === undefined ? ORIGIN : options.origin;
  if (origin) headers.origin = origin;
  return new Request(ENDPOINT, {
    method: options.method ?? 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function sceneBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'scene',
    styleId: 'ghibli',
    count: 2,
    scene: {
      text: 'Ana camina por la playa con su perro Tito.',
      visualDescription: 'Una niña y su perro en la playa al atardecer',
    },
    characters: [
      { name: 'Ana', visualDescription: 'niña de 7 años, pelo negro' },
      { name: 'Tito', visualDescription: 'perro pequeño café', referenceImage: PNG_B64 },
    ],
    location: { name: 'Valparaíso', description: 'cerros con casas de colores' },
    ...overrides,
  };
}

function geminiCalls(calls: Call[]): Call[] {
  return calls.filter((call) => call.url.startsWith(GEMINI_ENDPOINT));
}

function storageCalls(calls: Call[]): Call[] {
  return calls.filter((call) => call.url.startsWith(`${SUPABASE_URL}/storage/`));
}

function inlineParts(call: Call): Array<Record<string, unknown>> {
  const payload = JSON.parse(String(call.init.body));
  return payload.contents[0].parts.filter((part: Record<string, unknown>) => 'inlineData' in part);
}

const STORAGE_PNG = `${SUPABASE_URL}/storage/v1/object/public/cuentacuentos-drafts/ref.png`;

/** Distinctive upstream text that must never surface in a response or a log line. */
const TEXT_ONLY_MARKER = 'upstream-text-only-marker-7Q2';

function geminiTextOnlyResponse(): Response {
  return jsonResponse(200, { candidates: [{ content: { parts: [{ text: TEXT_ONLY_MARKER }] }, finishReason: 'STOP' }] });
}

function landmarkBody(referenceImages: string[]): Record<string, unknown> {
  return sceneBody({
    count: 1,
    scene: { text: 'Ana frente a la iglesia.', visualDescription: 'niña frente a una iglesia', landmarkVisible: true },
    characters: [],
    landmarks: [{ name: 'Iglesia', visualDescription: 'torre blanca con campanario', referenceImages }],
  });
}

function headerOf(init: RequestInit, name: string): string | undefined {
  const headers = init.headers as Record<string, string> | undefined;
  return headers?.[name];
}

// ─── CORS ────────────────────────────────────────────────────────────────────

Deno.test('OPTIONS preflight from an allowed CASA origin returns CORS headers', async () => {
  const { handler } = setup();
  const res = await handler(new Request(ENDPOINT, { method: 'OPTIONS', headers: { origin: ORIGIN } }));
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
  assert.equal(res.headers.get('vary'), 'Origin');
  assert.match(res.headers.get('access-control-allow-headers') ?? '', /authorization/);
});

Deno.test('OPTIONS preflight from a foreign origin is refused without CORS headers', async () => {
  const { handler } = setup();
  const res = await handler(new Request(ENDPOINT, { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }));
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

Deno.test('Vercel preview deployments of casa-web and ALLOWED_ORIGINS extras are allowed; wildcard never used', () => {
  assert.equal(isAllowedOrigin('https://casa-web-git-feat-x-brent.vercel.app'), true);
  assert.equal(isAllowedOrigin('https://other-app.vercel.app'), false);
  assert.equal(isAllowedOrigin('*'), false);
  assert.equal(isAllowedOrigin('https://staging.casa.test', parseOriginList('https://staging.casa.test, nonsense')), true);
  assert.deepEqual(parseOriginList(undefined), []);
});

Deno.test('the production custom domain is not assumed: it is refused until supplied via ALLOWED_ORIGINS', async () => {
  for (const candidate of ['https://anglicanasanandres.cl', 'https://iglesia-casa.cl']) {
    assert.equal(isAllowedOrigin(candidate), false);
    const { handler } = setup();
    const refused = await handler(new Request(ENDPOINT, { method: 'OPTIONS', headers: { origin: candidate } }));
    assert.equal(refused.status, 403);
    const { handler: configured } = setup({}, { ALLOWED_ORIGINS: candidate });
    const allowed = await configured(new Request(ENDPOINT, { method: 'OPTIONS', headers: { origin: candidate } }));
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get('access-control-allow-origin'), candidate);
  }
});

Deno.test('POST from a foreign origin is refused before authentication', async () => {
  const { handler, calls } = setup();
  const res = await handler(post(sceneBody(), { origin: 'https://evil.example' }));
  assert.equal(res.status, 403);
  assert.equal(calls.length, 0);
});

Deno.test('GET is not allowed', async () => {
  const { handler } = setup();
  const res = await handler(new Request(ENDPOINT, { method: 'GET', headers: { origin: ORIGIN } }));
  assert.equal(res.status, 405);
});

// ─── Project binding & configuration ─────────────────────────────────────────

Deno.test('isCasaProjectUrl accepts CASA and local stacks only', () => {
  assert.equal(isCasaProjectUrl(SUPABASE_URL), true);
  assert.equal(isCasaProjectUrl('http://127.0.0.1:54321'), true);
  assert.equal(isCasaProjectUrl('http://kong:8000'), true);
  assert.equal(isCasaProjectUrl('https://someotherprojectref.supabase.co'), false);
  assert.equal(isCasaProjectUrl('not a url'), false);
});

Deno.test('refuses to run when SUPABASE_URL is not the CASA project (fails closed, no upstream calls)', async () => {
  const { handler, calls } = setup({}, { SUPABASE_URL: 'https://someotherprojectref.supabase.co' });
  const res = await handler(post(sceneBody()));
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.error, /CASA/);
  assert.equal(calls.length, 0);
});

Deno.test('refuses to run without GOOGLE_AI_API_KEY (no upstream calls)', async () => {
  const { handler, calls } = setup({}, { GOOGLE_AI_API_KEY: undefined });
  const res = await handler(post(sceneBody()));
  assert.equal(res.status, 500);
  assert.equal(calls.length, 0);
});

// ─── Authentication ──────────────────────────────────────────────────────────

Deno.test('unauthenticated request (no Authorization header) is rejected with 401 and nothing is called', async () => {
  const { handler, calls } = setup();
  const res = await handler(post(sceneBody(), { auth: null }));
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { success: false, error: 'Se requiere autenticación.', images: [] });
  assert.equal(calls.length, 0);
});

Deno.test('the anon key presented as a bearer token is rejected (401) without contacting Auth', async () => {
  const { handler, calls } = setup();
  const res = await handler(post(sceneBody(), { auth: ANON_TOKEN }));
  assert.equal(res.status, 401);
  assert.equal(calls.length, 0);
});

Deno.test('a service_role credential presented by a caller is rejected (401) without contacting Auth', async () => {
  const { handler, calls } = setup();
  const res = await handler(post(sceneBody(), { auth: SERVICE_TOKEN }));
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'Credencial no permitida para esta función.');
  assert.equal(calls.length, 0);
});

Deno.test('a malformed bearer token is rejected (401)', async () => {
  const { handler, calls } = setup();
  const res = await handler(post(sceneBody(), { auth: 'not.a.jwt.at.all' }));
  assert.equal(res.status, 401);
  assert.equal(calls.length, 0);
});

Deno.test('a token Supabase Auth does not recognise is rejected (401) and Gemini is never called', async () => {
  const { handler, calls } = setup({ auth: () => jsonResponse(401, { message: 'invalid JWT' }) });
  const res = await handler(post(sceneBody()));
  assert.equal(res.status, 401);
  assert.equal(geminiCalls(calls).length, 0);
});

Deno.test('a verified user whose id differs from the token subject is rejected (401)', async () => {
  const { handler, calls } = setup({ auth: () => jsonResponse(200, { id: 'someone-else' }) });
  const res = await handler(post(sceneBody()));
  assert.equal(res.status, 401);
  assert.equal(geminiCalls(calls).length, 0);
});

Deno.test('Auth outage yields 503, not access', async () => {
  const { handler, calls } = setup({ auth: () => jsonResponse(500, {}) });
  const res = await handler(post(sceneBody()));
  assert.equal(res.status, 503);
  assert.equal(geminiCalls(calls).length, 0);
});

// ─── Authorization ───────────────────────────────────────────────────────────

Deno.test('authenticated user without liturgy_builder/write is rejected (403) and Gemini is never called', async () => {
  const { handler, calls } = setup({ rpc: () => jsonResponse(200, false) });
  const res = await handler(post(sceneBody()));
  assert.equal(res.status, 403);
  assert.equal(geminiCalls(calls).length, 0);
  const rpcCall = calls.find((call) => call.url.includes('/rest/v1/rpc/has_permission'));
  assert.ok(rpcCall);
  assert.deepEqual(JSON.parse(String(rpcCall.init.body)), {
    p_user_id: USER_ID,
    p_resource: REQUIRED_PERMISSION.resource,
    p_action: REQUIRED_PERMISSION.action,
  });
  assert.equal(headerOf(rpcCall.init, 'Authorization'), `Bearer ${USER_TOKEN}`);
  assert.equal(headerOf(rpcCall.init, 'apikey'), ANON_KEY);
});

Deno.test('authorization RPC failure fails closed with 503', async () => {
  const { handler, calls } = setup({ rpc: () => jsonResponse(500, { message: 'boom' }) });
  const res = await handler(post(sceneBody()));
  assert.equal(res.status, 503);
  assert.equal(geminiCalls(calls).length, 0);
});

// ─── Input validation ────────────────────────────────────────────────────────

Deno.test('malformed JSON is rejected with 400', async () => {
  const { handler, calls } = setup();
  const res = await handler(post('{not json'));
  assert.equal(res.status, 400);
  assert.equal(geminiCalls(calls).length, 0);
});

Deno.test('non-object JSON body is rejected with 400', async () => {
  const { handler } = setup();
  const res = await handler(post('[1,2,3]'));
  assert.equal(res.status, 400);
});

Deno.test('unknown type, missing fields and bad count are rejected with 400', async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(post({ type: 'poster' }))).status, 400);
  assert.equal((await handler(post({ type: 'scene', scene: { visualDescription: 'x' } }))).status, 400);
  assert.equal((await handler(post(sceneBody({ count: 0 })))).status, 400);
  assert.equal((await handler(post(sceneBody({ count: 9 })))).status, 400);
  assert.equal((await handler(post(sceneBody({ count: 1.5 })))).status, 400);
  assert.equal((await handler(post({ type: 'character', character: { name: 'Ana' } }))).status, 400);
  assert.equal((await handler(post({ type: 'cover', title: 'T', protagonist: {}, location: { name: 'X' } }))).status, 400);
  assert.equal(geminiCalls(calls).length, 0);
});

Deno.test('oversized text fields are rejected with 400', async () => {
  const { handler, calls } = setup();
  const res = await handler(post(sceneBody({
    scene: { text: 'x'.repeat(5001), visualDescription: 'ok' },
  })));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /máximo/);
  assert.equal(geminiCalls(calls).length, 0);
});

Deno.test('oversized request bodies are rejected with 413 before upstream calls', async () => {
  const { handler, calls } = setup({}, {}, { maxBodyBytes: 512 });
  const res = await handler(post(sceneBody({ scene: { text: 'y'.repeat(1000), visualDescription: 'ok' } })));
  assert.equal(res.status, 413);
  assert.equal(geminiCalls(calls).length, 0);
});

Deno.test('oversized reference images are rejected with 400', async () => {
  const { handler } = setup({}, {}, { maxImageBase64Chars: 32 });
  const res = await handler(post(sceneBody()));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /referencia/);
});

Deno.test('too many reference images are rejected with 400', async () => {
  const { handler, calls } = setup({}, {}, { maxReferenceImages: 1 });
  const res = await handler(post(sceneBody({
    characters: [
      { name: 'Ana', visualDescription: 'a', referenceImage: PNG_B64 },
      { name: 'Tito', visualDescription: 'b', referenceImage: PNG_B64 },
    ],
  })));
  assert.equal(res.status, 400);
  assert.equal(geminiCalls(calls).length, 0);
});

Deno.test('reference image URLs outside the CASA storage host are refused (no SSRF)', async () => {
  const { handler, calls } = setup();
  const res = await handler(post(sceneBody({
    characters: [{ name: 'Ana', visualDescription: 'a', referenceImage: 'https://evil.example/steal.png' }],
  })));
  assert.equal(res.status, 400);
  assert.equal(calls.some((call) => call.url.startsWith('https://evil.example')), false);
  assert.equal(geminiCalls(calls).length, 0);
});

Deno.test('reference image URLs on the CASA storage host are downloaded with a bounded read', async () => {
  const { handler, calls } = setup();
  const res = await handler(post(sceneBody({
    count: 1,
    characters: [{
      name: 'Ana',
      visualDescription: 'a',
      referenceImage: `${SUPABASE_URL}/storage/v1/object/public/cuentacuentos-drafts/ana.png`,
    }],
  })));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.referenceImagesCount, 1);
  const upstream = JSON.parse(String(geminiCalls(calls)[0].init.body));
  const inlineParts = upstream.contents[0].parts.filter((part: Record<string, unknown>) => 'inlineData' in part);
  assert.equal(inlineParts.length, 1);
});

Deno.test('a redirect from the approved storage host is refused: the destination is never contacted nor sent to Gemini', async () => {
  for (const status of [301, 302, 307, 308]) {
    const { handler, calls, logs } = setup({
      storage: () => new Response(null, { status, headers: { location: 'https://evil.example/exfil.png' } }),
    });
    const res = await handler(post(sceneBody({
      count: 1,
      characters: [{ name: 'Ana', visualDescription: 'a', referenceImage: `${SUPABASE_URL}/storage/v1/object/public/cuentacuentos-drafts/ana.png` }],
    })));
    assert.equal(res.status, 200);
    assert.equal((await res.json()).referenceImagesCount, 0);
    assert.equal(calls.some((call) => call.url.includes('evil.example')), false, 'redirect destination must never be fetched');
    const storageCall = calls.find((call) => call.url.startsWith(`${SUPABASE_URL}/storage/`));
    assert.ok(storageCall);
    assert.equal(storageCall.init.redirect, 'manual', 'downloads must never follow redirects');
    const payload = JSON.parse(String(geminiCalls(calls)[0].init.body));
    assert.equal(payload.contents[0].parts.some((part: Record<string, unknown>) => 'inlineData' in part), false);
    assert.ok(logs.some((line) => line.includes('redirect_refused')));
  }
});

Deno.test('every outbound call disables redirect following', async () => {
  const { handler, calls } = setup();
  await handler(post(sceneBody({ count: 1 })));
  assert.ok(calls.length >= 3);
  for (const call of calls) assert.equal(call.init.redirect, 'manual', `redirect must be manual for ${call.url}`);
});

Deno.test('a failed storage download is skipped, generation still proceeds', async () => {
  const { handler } = setup({ storage: () => new Response('nope', { status: 404 }) });
  const res = await handler(post(sceneBody({
    count: 1,
    characters: [{ name: 'Ana', visualDescription: 'a', referenceImage: `${SUPABASE_URL}/storage/v1/object/public/x.png` }],
  })));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).referenceImagesCount, 0);
});

// ─── Upstream failures ───────────────────────────────────────────────────────

Deno.test('upstream timeout yields 504 with success:false and an images array', async () => {
  const { handler } = setup({
    gemini: (init) => new Promise<Response>((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }),
  }, {}, { upstreamTimeoutMs: 20 });
  const res = await handler(post(sceneBody({ count: 1 })));
  assert.equal(res.status, 504);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.deepEqual(body.images, []);
  assert.match(body.error, /Tiempo de espera/);
});

Deno.test('upstream 5xx yields 502 without leaking upstream details', async () => {
  const { handler, logs } = setup({ gemini: () => new Response('internal secret details', { status: 500 }) });
  const res = await handler(post(sceneBody({ count: 1 })));
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.doesNotMatch(body.error, /internal secret details/);
  assert.equal(logs.some((line) => line.includes('internal secret details')), false);
});

Deno.test('upstream rate limiting yields 429', async () => {
  const { handler } = setup({ gemini: () => new Response('', { status: 429 }) });
  const res = await handler(post(sceneBody({ count: 1 })));
  assert.equal(res.status, 429);
});

Deno.test('upstream safety block yields 422', async () => {
  const { handler } = setup({ gemini: () => jsonResponse(200, { promptFeedback: { blockReason: 'SAFETY' } }) });
  const res = await handler(post(sceneBody({ count: 1 })));
  assert.equal(res.status, 422);
});

Deno.test('partial upstream failure still returns the successful images with errors listed', async () => {
  const { handler } = setup({
    gemini: (_init, index) => index === 0 ? geminiImageResponse() : new Response('', { status: 500 }),
  });
  const res = await handler(post(sceneBody({ count: 2 })));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.images.length, 1);
  assert.equal(body.validCount, 1);
  assert.equal(body.requestedCount, 2);
  assert.equal(body.errors.length, 1);
});

// ─── Success paths & contract ────────────────────────────────────────────────

Deno.test('scene generation: response shape, CORS, key in header (not URL), metadata-only logs', async () => {
  const { handler, calls, logs } = setup();
  const res = await handler(post(sceneBody()));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
  assert.equal(res.headers.get('content-type'), 'application/json');

  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.images.length, 2);
  assert.ok(body.images.every((image: string) => image.startsWith('iVBORw0KGgo')));
  assert.equal(body.validCount, 2);
  assert.equal(body.requestedCount, 2);
  assert.equal(body.referenceImagesCount, 1);
  assert.deepEqual(body.charactersDetected, ['Ana', 'Tito']);
  assert.equal(body.errors, undefined);
  assert.equal('prompt' in body, false);

  const upstream = geminiCalls(calls);
  assert.equal(upstream.length, 2);
  for (const call of upstream) {
    assert.equal(call.url.includes('key='), false, 'API key must never be in the URL');
    assert.equal(headerOf(call.init, 'x-goog-api-key'), GOOGLE_KEY);
    assert.ok(call.init.signal, 'upstream calls must carry a timeout signal');
    const payload = JSON.parse(String(call.init.body));
    assert.equal(payload.generationConfig.imageConfig.aspectRatio, '4:3');
    assert.equal(payload.contents[0].parts.filter((part: Record<string, unknown>) => 'inlineData' in part).length, 1);
  }

  const authCall = calls.find((call) => call.url.startsWith(`${SUPABASE_URL}/auth/v1/user`));
  assert.ok(authCall);
  assert.equal(headerOf(authCall.init, 'Authorization'), `Bearer ${USER_TOKEN}`);

  const joined = logs.join('\n');
  assert.ok(logs.some((line) => line.includes('"event":"completed"')));
  assert.equal(joined.includes(USER_TOKEN), false, 'logs must not contain the user token');
  assert.equal(joined.includes(GOOGLE_KEY), false, 'logs must not contain the Google key');
  assert.equal(joined.includes(ANON_KEY), false, 'logs must not contain the anon key');
  assert.equal(joined.includes('Ana camina'), false, 'logs must not contain prompt text');
  assert.equal(joined.includes(PNG_B64), false, 'logs must not contain image data');
});

Deno.test('requests without an Origin header (non-browser) succeed without CORS headers', async () => {
  const { handler } = setup();
  const res = await handler(post(sceneBody({ count: 1 }), { origin: null }));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

Deno.test('character sheet generation returns the caller contract', async () => {
  const { handler, calls } = setup();
  const res = await handler(post({
    type: 'character',
    styleId: 'pixar',
    count: 4,
    character: { name: 'Ana', description: 'protagonista', visualDescription: 'niña de 7 años, pelo negro, vestido amarillo' },
  }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.images.length, 4);
  assert.equal(body.referenceImagesCount, 0);
  assert.equal(body.charactersDetected, undefined);
  assert.equal(geminiCalls(calls).length, 4);
});

Deno.test('cover generation with custom prompt and style reference works; end generation works', async () => {
  const { handler, calls } = setup();
  const cover = await handler(post({
    type: 'cover',
    styleId: 'storybook',
    count: 1,
    title: 'Ana y el mar',
    protagonist: { visualDescription: 'niña de 7 años' },
    location: { name: 'Valparaíso', description: 'puerto' },
    characters: [{ name: 'Ana', visualDescription: 'niña', referenceImage: PNG_B64 }],
    sceneReferenceImage: `data:image/png;base64,${PNG_B64}`,
    customPrompt: 'Ana mirando el mar desde un cerro',
  }));
  assert.equal(cover.status, 200);
  const coverBody = await cover.json();
  assert.equal(coverBody.success, true);
  assert.equal(coverBody.referenceImagesCount, 2);
  const coverPayload = JSON.parse(String(geminiCalls(calls)[0].init.body));
  assert.match(coverPayload.contents[0].parts[0].text, /STYLE REFERENCE/);

  const end = await handler(post({ type: 'end', styleId: 'watercolor', count: 1, referenceImage: PNG_B64 }));
  assert.equal(end.status, 200);
  const endBody = await end.json();
  assert.equal(endBody.success, true);
  assert.equal(endBody.referenceImagesCount, 1);
});

Deno.test('invalid reference base64 is skipped rather than sent upstream', async () => {
  const { handler, calls } = setup();
  const res = await handler(post(sceneBody({
    count: 1,
    characters: [{ name: 'Ana', visualDescription: 'a', referenceImage: 'definitely-not-an-image' }],
  })));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).referenceImagesCount, 0);
  const payload = JSON.parse(String(geminiCalls(calls)[0].init.body));
  assert.equal(payload.contents[0].parts.some((part: Record<string, unknown>) => 'inlineData' in part), false);
});

// ─── Cumulative reference payload budget ─────────────────────────────────────

Deno.test('the default reference budget is conservative and consistent with the per-reference caps', () => {
  const budget = DEFAULT_LIMITS.maxTotalReferenceBase64Chars;
  assert.equal(budget, 10 * 1024 * 1024);
  assert.ok(budget >= DEFAULT_LIMITS.maxImageBase64Chars, 'one maximum inline reference must fit');
  assert.ok(budget >= Math.ceil(DEFAULT_LIMITS.maxDownloadBytes / 3) * 4, 'one maximum download must fit');
  assert.ok(budget < DEFAULT_LIMITS.maxReferenceImages * DEFAULT_LIMITS.maxImageBase64Chars, 'the budget must bind');
  assert.ok(budget <= DEFAULT_LIMITS.maxBodyBytes);
});

Deno.test('inline references over the total budget are rejected with 413 and zero Gemini calls', async () => {
  const { handler, calls, logs } = setup({}, {}, { maxTotalReferenceBase64Chars: PNG_B64.length * 2 - 1 });
  const res = await handler(post(sceneBody({
    count: 2,
    sceneReferenceImage: `data:image/png;base64,${PNG_B64}`,
    characters: [{ name: 'Ana', visualDescription: 'a', referenceImage: PNG_B64 }],
  })));
  assert.equal(res.status, 413);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.deepEqual(body.images, []);
  assert.match(body.error, /tamaño total/);
  assert.equal(geminiCalls(calls).length, 0);
  assert.equal(storageCalls(calls).length, 0);
  assert.ok(logs.some((line) => line.includes('reference_budget_exceeded')));
  assert.equal(logs.join('\n').includes(PNG_B64), false, 'logs must not contain image data');
});

Deno.test('downloaded references over the total budget are rejected with 413, downloads are sequential and stop early', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const { handler, calls } = setup({
    storage: async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return new Response(pngBytes(), { status: 200, headers: { 'content-type': 'image/png' } });
    },
  }, {}, { maxTotalReferenceBase64Chars: PNG_B64.length + 8 });
  const res = await handler(post(sceneBody({
    count: 2,
    characters: [
      { name: 'Ana', visualDescription: 'a', referenceImage: STORAGE_PNG },
      { name: 'Tito', visualDescription: 'b', referenceImage: STORAGE_PNG },
      { name: 'Lulú', visualDescription: 'c', referenceImage: STORAGE_PNG },
    ],
  })));
  assert.equal(res.status, 413);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.error, /tamaño total/);
  assert.equal(geminiCalls(calls).length, 0);
  assert.equal(storageCalls(calls).length, 2, 'the third download must never start once the allowance is spent');
  assert.equal(maxInFlight, 1, 'downloads must resolve one at a time');
});

Deno.test('a declared content-length above the remaining allowance is refused before its body is read', async () => {
  let pulled = false;
  const { handler, calls } = setup({
    storage: (_init, index) => {
      if (index === 0) return new Response(pngBytes(), { status: 200, headers: { 'content-type': 'image/png' } });
      // highWaterMark 0: pull() runs only when someone actually reads, never at construction.
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          pulled = true;
          controller.enqueue(pngBytes());
          controller.close();
        },
      }, { highWaterMark: 0 });
      return new Response(body, { status: 200, headers: { 'content-type': 'image/png', 'content-length': '64' } });
    },
  }, {}, { maxTotalReferenceBase64Chars: PNG_B64.length + 8 });
  const res = await handler(post(sceneBody({
    count: 1,
    characters: [
      { name: 'Ana', visualDescription: 'a', referenceImage: STORAGE_PNG },
      { name: 'Tito', visualDescription: 'b', referenceImage: STORAGE_PNG },
    ],
  })));
  assert.equal(res.status, 413);
  assert.equal(pulled, false, 'the oversized body must not be read');
  assert.equal(geminiCalls(calls).length, 0);
});

Deno.test('several small references within the total budget are all forwarded, in order, to every Gemini request', async () => {
  const { handler, calls } = setup();
  const res = await handler(post(sceneBody({
    count: 2,
    sceneReferenceImage: `data:image/png;base64,${PNG_B64}`,
    characters: [
      { name: 'Ana', visualDescription: 'a', referenceImage: PNG_B64 },
      { name: 'Tito', visualDescription: 'b', referenceImage: STORAGE_PNG },
      { name: 'Lulú', visualDescription: 'c', referenceImage: STORAGE_PNG },
    ],
  })));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.referenceImagesCount, 4);
  assert.equal(storageCalls(calls).length, 2);
  const upstream = geminiCalls(calls);
  assert.equal(upstream.length, 2);
  for (const call of upstream) {
    assert.equal(inlineParts(call).length, 4);
    const payload = JSON.parse(String(call.init.body));
    assert.match(payload.contents[0].parts[0].text, /STYLE REFERENCE/);
    assert.match(payload.contents[0].parts[1].text, /STYLE REFERENCE IMAGE/);
  }
});

// ─── Landmark reference limit ────────────────────────────────────────────────

Deno.test('landmark references: two are accepted under the default limit and both reach Gemini', async () => {
  assert.equal(DEFAULT_LIMITS.maxLandmarkReferences, 2);
  const { handler, calls } = setup();
  const res = await handler(post(landmarkBody([STORAGE_PNG, STORAGE_PNG])));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).referenceImagesCount, 2);
  assert.equal(storageCalls(calls).length, 2);
  const [call] = geminiCalls(calls);
  assert.equal(inlineParts(call).length, 2);
  const payload = JSON.parse(String(call.init.body));
  assert.match(payload.contents[0].parts[0].text, /LANDMARK/);
});

Deno.test('landmark references: three are rejected with 400 before any download or Gemini call', async () => {
  const { handler, calls } = setup();
  const res = await handler(post(landmarkBody([STORAGE_PNG, STORAGE_PNG, STORAGE_PNG])));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.error, /referencia.*máximo 2/);
  assert.equal(storageCalls(calls).length, 0);
  assert.equal(geminiCalls(calls).length, 0);
});

// ─── Image-less upstream 200 ─────────────────────────────────────────────────

Deno.test('a 200 upstream response without an image is a failure: 502 with success:false when every variation lacks one', async () => {
  const responses = [
    () => geminiTextOnlyResponse(),
    () => jsonResponse(200, { candidates: [] }),
    () => jsonResponse(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'not-an-image' } }] } }] }),
  ];
  for (const gemini of responses) {
    const { handler, logs } = setup({ gemini });
    const res = await handler(post(sceneBody({ count: 2 })));
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.deepEqual(body.images, []);
    assert.match(body.error, /no devolvió una imagen/);
    assert.equal(body.errors.length, 2);
    assert.equal(JSON.stringify(body).includes(TEXT_ONLY_MARKER), false, 'upstream text must not be returned');
    const joined = logs.join('\n');
    assert.equal(joined.includes(TEXT_ONLY_MARKER), false, 'upstream text must not be logged');
    assert.equal(joined.includes('Ana camina'), false, 'prompt text must not be logged');
    assert.ok(logs.some((line) => line.includes('"event":"upstream_no_image"')));
    assert.ok(logs.some((line) => line.includes('"event":"failed"') && line.includes('"status":502')));
  }
});

Deno.test('image-less variations are reported as partial failures while successful images are preserved', async () => {
  const { handler, logs } = setup({
    gemini: (_init, index) => index === 1 ? geminiImageResponse() : geminiTextOnlyResponse(),
  });
  const res = await handler(post(sceneBody({ count: 3 })));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.images.length, 1);
  assert.ok(body.images[0].startsWith('iVBORw0KGgo'));
  assert.equal(body.validCount, 1);
  assert.equal(body.requestedCount, 3);
  assert.equal(body.errors.length, 2);
  assert.ok(body.errors.every((message: string) => /no devolvió una imagen/.test(message)));
  assert.equal(JSON.stringify(body).includes(TEXT_ONLY_MARKER), false);
  assert.equal(logs.join('\n').includes(TEXT_ONLY_MARKER), false);
});
