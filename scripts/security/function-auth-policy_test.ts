/**
 * Function authorization policy — publishable-key review (Codex), round 2.
 *
 * A Supabase publishable key authenticates the application at the gateway,
 * never a user. This suite pins, from committed source only:
 *   1. the complete inventory of Functions the browser bundle references, and
 *      that supabase/config.toml states an explicit verify_jwt policy for each
 *      one — `true` for every Function that expects a signed-in user, `false`
 *      ONLY for the endpoints deliberately public (no user session exists);
 *   2. each function corrected in this review AUTHENTICATES the caller in its
 *      own handler before the request body is read, and its entrypoint wires
 *      the shared Supabase authz backend. Authentication is not authorization:
 *      `requireUser` proves WHO is calling and nothing more, so where a
 *      per-object decision is required it is pinned separately — see the
 *      send-signup-confirmation ordering test, which pins ownership/Mesa-admin
 *      authorization BEFORE the participant's PII, the signed logo URL and the
 *      email, and fails if any of those moves above the decision;
 *   3. the public whatsapp-signup endpoint and its single active caller agree
 *      on the anti-bot contract (honeypot + required timestamp) and neither
 *      logs personal data;
 *   4. no live browser code sends the publishable key as a substitute bearer
 *      token, and no live caller targets a Function that does not exist
 *      (generate-prayer, generate-graphic — orphaned callers removed);
 *   5. the handlers corrected in round 3 read the request (and, where there is
 *      one, the untrusted provider reply) through the STREAMING caps in
 *      `_shared/boundedBody.ts` rather than `req.json()` / `response.json()` /
 *      `response.text()`, and their logs and error responses are value-
 *      suppressed: fixed text and a stable code, never a caught exception, a
 *      provider body, a prompt, or member/application content.
 * Committed configuration describes intent; it does not prove the provider-side
 * deployment setting, and a verify_jwt entry alone says nothing about what a
 * handler does after the gateway. Value-free: no credentials, no network.
 * Run: npm run test:security
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const read = (file: string) => readFileSync(join(REPO_ROOT, file), 'utf8');

/**
 * Functions that expect a signed-in user and must be gated at the gateway
 * (verify_jwt = true). Two groups:
 *   - reviewed: the handler verifies the user JWT itself (see CORRECTED_HANDLERS
 *     and the generate-* / process-* suites under supabase/functions);
 *   - browser-invoked, not reviewed here: the gateway policy is pinned; what the
 *     handler does afterwards is out of this suite's scope.
 */
const AUTHENTICATED_FUNCTIONS = [
  // reviewed — handler verifies the user JWT
  'send-signup-confirmation',
  'generate-children-lesson',
  'refine-children-lesson',
  'prayer-request',
  'fetch-bible-passage',
  'generate-scene-images',
  'generate-story',
  'refine-story',
  'process-reflexion-pdf',
  'generate-oraciones',
  // browser-invoked — gateway policy pinned only
  'admin-add-participant',
  'admin-user-management',
  'create-mesa-matches',
  'generate-illustration',
  'podcast-backfill',
  'send-children-service-packet',
  'send-mesa-notifications',
  'send-mesa-whatsapp',
  'send-music-service-packet',
  'transcribe-meeting',
] as const;

/** The only endpoints deliberately reachable without a user session. */
const INTENTIONALLY_PUBLIC_FUNCTIONS = [
  'podcast-rss', // public feed
  'wa-webhook', // Meta webhook, signature-verified in code
  'wa-reminders', // pg_cron with a shared secret, not a platform JWT
  'public-signup', // anonymous community signup (honeypot/timing/rate limit in code)
  'whatsapp-signup', // anonymous broadcast-list signup (same protections)
] as const;

/**
 * Every Function the browser bundle references (src/**, tests excluded), as
 * inventoried from source. The dynamic scan below must produce exactly this
 * set, so adding a caller forces an explicit policy decision here.
 */
const BROWSER_REFERENCED_FUNCTIONS = [
  'admin-add-participant',
  'admin-user-management',
  'create-mesa-matches',
  'fetch-bible-passage',
  'generate-children-lesson',
  'generate-illustration',
  'generate-oraciones',
  'generate-scene-images',
  'generate-story',
  'podcast-backfill',
  'podcast-rss',
  'prayer-request',
  'process-reflexion-pdf',
  'public-signup',
  'refine-children-lesson',
  'refine-story',
  'send-children-service-packet',
  'send-mesa-notifications',
  'send-mesa-whatsapp',
  'send-music-service-packet',
  'send-signup-confirmation',
  'transcribe-meeting',
  'whatsapp-signup',
] as const;

/**
 * Handlers corrected in this review and the guard each must call BEFORE the
 * body is read.
 *
 * `authorizes` records what the guard actually decides. `requireLiturgyWriter`
 * and `requireAnyPermission` settle access outright — the permission is the
 * whole decision, and no request value is needed to reach it. `requireUser`
 * does NOT: it authenticates and stops there. For those two entries this test
 * proves ordering of AUTHENTICATION against the body read, and nothing more;
 * send-signup-confirmation's per-object decision is pinned by its own ordering
 * test below, prayer-request has no per-object resource to authorize.
 */
const CORRECTED_HANDLERS: ReadonlyArray<
  { fn: string; guard: string; authorizes: 'access' | 'identity-only' }
> = [
  { fn: 'send-signup-confirmation', guard: 'requireUser(', authorizes: 'identity-only' },
  { fn: 'generate-children-lesson', guard: 'requireLiturgyWriter(', authorizes: 'access' },
  { fn: 'refine-children-lesson', guard: 'requireLiturgyWriter(', authorizes: 'access' },
  { fn: 'prayer-request', guard: 'requireUser(', authorizes: 'identity-only' },
  { fn: 'fetch-bible-passage', guard: 'requireAnyPermission(', authorizes: 'access' },
];

/**
 * Tracked duplicate files (editor copies) that also invoke a Function. They
 * are recorded here so the inventory is honest; they are NOT modified in this
 * round. Removing one is fine — the assertion only applies while it exists.
 */
const TRACKED_DUPLICATE_CALLERS: ReadonlyArray<{ file: string; fn: string }> = [
  { file: 'src/components/mesa-abierta/MesaAbiertaSignup 2.tsx', fn: 'send-signup-confirmation' },
  { file: 'src/components/mesa-abierta/MesaAbiertaAdmin 2.tsx', fn: 'create-mesa-matches' },
  { file: 'src/components/mesa-abierta/MesaAbiertaAdmin 2.tsx', fn: 'send-mesa-notifications' },
  { file: 'src/components/mesa-abierta/MesaAbiertaAdmin 2.tsx', fn: 'send-mesa-whatsapp' },
];

function parseVerifyJwt(toml: string): Map<string, boolean> {
  const policy = new Map<string, boolean>();
  let current: string | null = null;
  for (const raw of toml.split('\n')) {
    const line = raw.trim();
    const section = line.match(/^\[functions\.([A-Za-z0-9_-]+)\]$/);
    if (section) {
      current = section[1];
      continue;
    }
    if (/^\[/.test(line)) {
      current = null;
      continue;
    }
    const kv = line.match(/^verify_jwt\s*=\s*(true|false)\s*(#.*)?$/);
    if (kv && current) {
      assert.equal(policy.has(current), false, `${current} must declare verify_jwt once`);
      policy.set(current, kv[1] === 'true');
    }
  }
  return policy;
}

// ---------------------------------------------------------------------------
// Browser-side inventory
// ---------------------------------------------------------------------------

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const SRC_FILES = walk(join(REPO_ROOT, 'src')).map((f) => relative(REPO_ROOT, f));
const isTestFile = (file: string) => /(^|\/)__tests__\/|\.test\.tsx?$/.test(file);
/** Live (non-test) browser sources, tracked duplicates included. */
const LIVE_SRC_FILES = SRC_FILES.filter((f) => !isTestFile(f));

/** Function names a browser module references, by invoke() name or /functions/v1/ URL. */
function referencedFunctions(text: string): string[] {
  const names = new Set<string>();
  const invoke = /functions\s*\.\s*invoke(?:<[^>]*>)?\s*\(\s*['"`]([A-Za-z0-9_-]+)['"`]/g;
  const url = /functions\/v1\/([A-Za-z0-9_-]+)/g;
  for (const re of [invoke, url]) {
    for (const m of text.matchAll(re)) names.add(m[1]);
  }
  return [...names];
}

const BROWSER_INVENTORY = new Map<string, string[]>(); // fn → files
for (const file of LIVE_SRC_FILES) {
  for (const fn of referencedFunctions(read(file))) {
    BROWSER_INVENTORY.set(fn, [...(BROWSER_INVENTORY.get(fn) ?? []), file]);
  }
}

Deno.test('browser inventory: the set of Functions referenced from src/ is exactly the recorded one', () => {
  assert.deepEqual([...BROWSER_INVENTORY.keys()].sort(), [...BROWSER_REFERENCED_FUNCTIONS].sort());
  for (const fn of BROWSER_REFERENCED_FUNCTIONS) {
    assert.ok(existsSync(join(REPO_ROOT, 'supabase/functions', fn, 'index.ts')), `${fn} is referenced by the browser but has no Function`);
  }
});

Deno.test('supabase/config.toml: every browser-referenced Function has an explicit verify_jwt policy — true unless intentionally public', () => {
  const policy = parseVerifyJwt(read('supabase/config.toml'));
  const publicSet = new Set<string>(INTENTIONALLY_PUBLIC_FUNCTIONS);
  const authenticatedSet = new Set<string>(AUTHENTICATED_FUNCTIONS);
  for (const fn of BROWSER_REFERENCED_FUNCTIONS) {
    assert.ok(policy.has(fn), `[functions.${fn}] must declare verify_jwt explicitly`);
    if (publicSet.has(fn)) {
      assert.equal(policy.get(fn), false, `${fn} is intentionally public`);
    } else {
      assert.ok(authenticatedSet.has(fn), `${fn} must be classified as authenticated or intentionally public`);
      assert.equal(policy.get(fn), true, `[functions.${fn}] must declare verify_jwt = true`);
    }
  }
});

Deno.test('supabase/config.toml: verify_jwt is explicit and true for every function that expects a signed-in user', () => {
  const policy = parseVerifyJwt(read('supabase/config.toml'));
  for (const fn of AUTHENTICATED_FUNCTIONS) {
    assert.equal(policy.get(fn), true, `[functions.${fn}] must declare verify_jwt = true`);
  }
  // Classification sanity: no Function is both.
  for (const fn of AUTHENTICATED_FUNCTIONS) {
    assert.ok(!(INTENTIONALLY_PUBLIC_FUNCTIONS as readonly string[]).includes(fn), `${fn} cannot be both authenticated and public`);
  }
});

Deno.test('supabase/config.toml: verify_jwt = false is limited to the intentionally public endpoints', () => {
  const policy = parseVerifyJwt(read('supabase/config.toml'));
  const publicInConfig = [...policy.entries()].filter(([, v]) => v === false).map(([k]) => k).sort();
  assert.deepEqual(publicInConfig, [...INTENTIONALLY_PUBLIC_FUNCTIONS].sort());
  for (const fn of INTENTIONALLY_PUBLIC_FUNCTIONS) {
    assert.ok(existsSync(join(REPO_ROOT, 'supabase/functions', fn, 'index.ts')), `${fn} must exist`);
  }
});

for (const { fn, guard, authorizes } of CORRECTED_HANDLERS) {
  Deno.test(`${fn}: the handler authenticates the caller before the body, and the entrypoint wires the real backend`, () => {
    const handler = read(`supabase/functions/${fn}/handler.ts`);
    assert.match(handler, /from ['"]\.\.\/_shared\/liturgyAuth\.ts['"]/, 'must use the shared fail-closed guard');
    const guardAt = handler.indexOf(guard);
    const bodyAt = handler.search(
      /await req\.(?:json|text)\(|await readBoundedJson\(req\b/,
    );
    assert.ok(guardAt >= 0, `${fn} must call ${guard}`);
    assert.ok(bodyAt > guardAt, 'the guard must run before the request body is read');
    assert.doesNotMatch(handler, /Deno\.env\.get\(/, 'handlers read no environment; index.ts injects dependencies');

    // A guard that only authenticates settles nothing about the object being
    // acted on. Recording that here keeps the next reader from mistaking this
    // assertion for proof of authorization.
    if (authorizes === 'identity-only') {
      assert.equal(guard, 'requireUser(', `${fn} is classified identity-only, so its guard must be requireUser`);
    } else {
      assert.notEqual(guard, 'requireUser(', `${fn} is classified access-deciding, so requireUser is not enough`);
    }

    const index = read(`supabase/functions/${fn}/index.ts`);
    assert.match(index, /createSupabaseAuthzDeps\(/, 'the entrypoint must bind the guard to auth.getUser');
    assert.match(index, /serve\(createHandler\(/, 'the entrypoint only wires and serves');
  });
}

// ---------------------------------------------------------------------------
// send-signup-confirmation: the ORDER of the three stages
//
// Codex round 3: `requireUser` was being presented as if it were ownership
// authorization. It is not. Because the ownership decision needs participantId,
// it cannot precede the body — so what has to be pinned is that (a) nothing is
// read before authentication, (b) the read between the stages is tightly
// bounded, and (c) the real decision precedes every sensitive action. This test
// fails if the PII load, the logo signing or the email moves above the
// ownership/Mesa-admin check, or if the check is weakened away from fail-closed.
// ---------------------------------------------------------------------------

Deno.test('send-signup-confirmation: authentication precedes the bounded body read, and ownership/admin precedes PII, signing and email', () => {
  const handler = read('supabase/functions/send-signup-confirmation/handler.ts');

  // (a) Authentication before any byte of the body.
  const authnAt = handler.indexOf('await requireUser(req');
  const bodyAt = handler.indexOf('await readBoundedJson(req, MAX_BODY_BYTES)');
  assert.ok(authnAt >= 0, 'the handler must authenticate with requireUser');
  assert.ok(bodyAt > authnAt, 'the body must not be read before authentication');
  assert.doesNotMatch(handler, /await req\.(?:json|text)\(/, 'the unbounded read must be gone');

  // (b) The read between the stages is tightly bounded, by the read itself.
  const cap = handler.match(/export const MAX_BODY_BYTES = ([\d_]+);/);
  assert.ok(cap, 'MAX_BODY_BYTES must be declared and exported');
  const capBytes = Number(cap[1].replace(/_/g, ''));
  assert.ok(capBytes > 0 && capBytes <= 4096, `a {participantId} body needs no more than 4 KiB (declared ${capBytes})`);
  assert.match(handler, /from ['"]\.\.\/_shared\/boundedBody\.ts['"]/, 'reuses the shared streaming reader');
  assert.match(handler, /"too_large"/, 'an over-cap body maps to its own fixed response');

  // (c) The ownership decision precedes every sensitive action.
  const ownerAt = handler.indexOf('await deps.findParticipantOwner(participantId)');
  const adminAt = handler.indexOf('await deps.isMesaAdmin(user.id)');
  const forbiddenAt = handler.indexOf('code: "FORBIDDEN" }, 403');
  const piiAt = handler.indexOf('await deps.loadParticipantDetails(participantId)');
  const signAt = handler.indexOf('await resolveMesaLogoUrl(deps.logoSigner)');
  const emailAt = handler.indexOf('await sendConfirmationEmail(');

  for (const [label, at] of [['owner lookup', ownerAt], ['admin check', adminAt], ['403', forbiddenAt]] as const) {
    assert.ok(at >= 0, `${label} must be present`);
    assert.ok(at > bodyAt, `${label} follows the bounded read (it needs participantId)`);
  }
  for (const [label, at] of [['PII load', piiAt], ['logo signing', signAt], ['email', emailAt]] as const) {
    assert.ok(at >= 0, `${label} must be present`);
    assert.ok(at > ownerAt, `the ownership lookup must precede the ${label}`);
    assert.ok(at > adminAt, `the Mesa-admin check must precede the ${label}`);
    assert.ok(at > forbiddenAt, `the 403 must be returned before the ${label}`);
  }

  // Fail-closed shape: admin is an OR-fallback consulted only once ownership
  // fails, and a false answer denies. `!(await ...)` is what makes that so.
  assert.match(
    handler,
    /if \(owner\.userId !== user\.id && !\(await deps\.isMesaAdmin\(user\.id\)\)\) \{/,
    'ownership OR Mesa-admin, denying when neither holds',
  );
  assert.match(handler, /return json\(\{ success: false, error: "Participant not found" \}, 404\)/, 'unknown participant is 404');

  // The distinction itself is documented, so it cannot be quietly re-conflated.
  assert.match(handler, /AUTHENTICATION BEFORE THE BODY/, 'stage 1 is labelled as authentication');
  assert.match(handler, /OWNERSHIP\/ADMIN AUTHORIZATION BEFORE ANY SENSITIVE WORK/, 'stage 2 is labelled as authorization');
  assert.match(handler, /it is NOT ownership authorization/, 'requireUser is explicitly not presented as authorization');
});

// ---------------------------------------------------------------------------
// Streaming caps and value-suppressed logs/errors (Codex round 3)
// ---------------------------------------------------------------------------

/**
 * EVERY corrected handler that reads a request body, with the ceiling its cap
 * must stay under. This is the general pin: `readBoundedJson` cancels the
 * stream at the chunk that crosses the cap, so the cap IS the read. A
 * character-level limit applied afterwards (prayer-request's
 * MAX_REQUEST_CHARS was the case that slipped through the first pass) is not a
 * bound on the upload — the string it measures has already been materialised.
 *
 * The set is asserted to equal CORRECTED_HANDLERS below, so a handler cannot be
 * added to the corrected set without an explicit decision about its cap.
 */
const BODY_BOUNDED_HANDLERS: ReadonlyArray<{ fn: string; ceilingBytes: number }> = [
  { fn: 'send-signup-confirmation', ceilingBytes: 4_096 }, // {participantId}
  { fn: 'generate-children-lesson', ceilingBytes: 131_072 }, // liturgy + story + inventory
  { fn: 'refine-children-lesson', ceilingBytes: 131_072 }, // lesson + feedback + inventory
  { fn: 'prayer-request', ceilingBytes: 65_536 }, // one petition + a name
  { fn: 'fetch-bible-passage', ceilingBytes: 4_096 }, // {reference, version}
];

Deno.test('every corrected handler that reads a body is covered by the bounded-read inventory', () => {
  assert.deepEqual(
    BODY_BOUNDED_HANDLERS.map((h) => h.fn).sort(),
    CORRECTED_HANDLERS.map((h) => h.fn).sort(),
    'a corrected handler must either appear here with a cap, or stop reading a body',
  );
});

for (const { fn, ceilingBytes } of BODY_BOUNDED_HANDLERS) {
  Deno.test(`${fn}: the request body is read through the shared streaming cap, never materialised first`, () => {
    const handler = read(`supabase/functions/${fn}/handler.ts`);

    assert.match(
      handler,
      /from ['"]\.\.\/_shared\/boundedBody\.ts['"]/,
      'reuses _shared/boundedBody.ts — no competing reader',
    );
    assert.match(handler, /readBoundedJson\(req, MAX_BODY_BYTES\)/, 'the request is stream-bounded');
    assert.doesNotMatch(
      handler,
      /await req\.(?:json|text)\(/,
      'no unbounded request read may survive: it materialises the upload before judging it',
    );

    const declared = handler.match(/export const MAX_BODY_BYTES = ([\d_]+);/);
    assert.ok(declared, 'MAX_BODY_BYTES must be declared, exported and documented');
    const bytes = Number(declared[1].replace(/_/g, ''));
    assert.ok(
      bytes > 0 && bytes <= ceilingBytes,
      `MAX_BODY_BYTES must be a conservative bound for ${fn} (declared ${bytes}, ceiling ${ceilingBytes})`,
    );

    // An over-cap body gets its own answer, distinct from "malformed": the two
    // are different facts and collapsing them hides the limit from callers.
    assert.match(handler, /['"]too_large['"]/, 'the over-cap reason maps to its own fixed response');
    assert.match(handler, /413/, 'an over-cap body is 413, not 400');
  });
}

/** Handlers that talk to Anthropic: both directions must be stream-bounded. */
const PROVIDER_BOUNDED_HANDLERS = ['generate-children-lesson', 'refine-children-lesson'] as const;

/**
 * Drops block comments and whole-line `//` comments. Used where an assertion
 * must be about the CODE: these handlers document the shapes they refuse
 * ("never echo error.message"), and prose naming a defect is not the defect.
 * Only whole-line `//` is removed, so a URL's `//` inside a string survives.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
}

for (const fn of PROVIDER_BOUNDED_HANDLERS) {
  Deno.test(`${fn}: the request and the provider reply are read through streaming caps, never materialised first`, () => {
    const handler = read(`supabase/functions/${fn}/handler.ts`);
    assert.match(handler, /from ['"]\.\.\/_shared\/boundedBody\.ts['"]/, 'reuses the shared reader, no competing one');
    assert.match(handler, /readBoundedJson\(req, MAX_BODY_BYTES\)/, 'the request is stream-bounded');
    assert.match(
      handler,
      /readBoundedJson\(response, MAX_PROVIDER_RESPONSE_BYTES\)/,
      'the untrusted provider reply is stream-bounded too',
    );
    assert.doesNotMatch(handler, /await req\.(?:json|text)\(/, 'no unbounded request read may survive');
    assert.doesNotMatch(handler, /await response\.(?:json|text)\(/, 'no unbounded provider read may survive');
    // A failed provider reply is abandoned, not read: its body can quote the prompt back.
    assert.match(handler, /await response\.body\?\.cancel\(\)/, 'a failed provider reply is cancelled unread');
    assert.match(handler, /'too_large'/, 'an over-cap body maps to its own fixed response');

    for (const constant of ['MAX_BODY_BYTES', 'MAX_PROVIDER_RESPONSE_BYTES']) {
      const declared = handler.match(new RegExp(`export const ${constant} = ([\\d_]+);`));
      assert.ok(declared, `${constant} must be declared, exported and documented`);
      const bytes = Number(declared[1].replace(/_/g, ''));
      assert.ok(bytes > 0 && bytes <= 2_000_000, `${constant} must be a conservative bound (declared ${bytes})`);
    }
  });

  Deno.test(`${fn}: logs carry fixed text plus at most the provider status, and no failure echoes a caught value`, () => {
    const handler = read(`supabase/functions/${fn}/handler.ts`);

    // Structural, not a vocabulary blocklist: a log call must take exactly ONE
    // argument, that argument must be a quoted literal spanning the whole
    // argument list, and the only interpolation allowed inside it is the
    // provider's HTTP status. Nothing that is not fixed text can reach a log
    // under those three rules — including values nobody thought to blocklist.
    const SINGLE_LITERAL =
      /^(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)$/;
    const logCalls = handler.match(/console\.(log|warn|error|info)\([^)]*\)/g) ?? [];
    assert.ok(logCalls.length > 0, 'the handler still logs its events');
    for (const call of logCalls) {
      const args = call.slice(call.indexOf('(') + 1, call.lastIndexOf(')')).trim();
      assert.match(
        args,
        SINGLE_LITERAL,
        `a log takes one quoted literal — no second argument, no bare value: ${call}`,
      );
      assert.doesNotMatch(
        args,
        /\$\{(?!response\.status\})/,
        `only the provider HTTP status may be interpolated into a log: ${call}`,
      );
    }

    // No caught value can reach a log or a response, because no catch binds
    // one. Checked against CODE only — the header comment names the shapes it
    // rules out, and a comment saying "never echo error.message" must not read
    // as an occurrence of it.
    const code = stripComments(handler);
    assert.doesNotMatch(code, /catch \(/, 'every catch is unbound — an unbound catch cannot echo the exception');
    assert.doesNotMatch(code, /error\.message/, 'no exception message is echoed');
    assert.doesNotMatch(code, /\.stack/, 'no stack is echoed');
    assert.doesNotMatch(code, /String\(err/i, 'no exception is stringified');

    // Every failure response comes from the fixed table, and the table itself
    // holds only literals — no interpolation, so no value can slip in.
    const start = handler.indexOf('export const FAILURES = {');
    const end = handler.indexOf('} as const;', start);
    assert.ok(start >= 0 && end > start, 'the fixed failure table must be present');
    const table = handler.slice(start, end);
    assert.doesNotMatch(table, /\$\{|`/, 'every failure message is a literal, never interpolated');
    assert.match(handler, /function fail\(code: FailureCode\): Response \{/, 'failures go through one helper');
    assert.match(handler, /JSON\.stringify\(\{ success: false, error, code \}\)/, 'a failure body is message + stable code');
  });
}

Deno.test('fetch-bible-passage: any-of authorization names exactly the three workflow permissions, and the provider is contacted only after it', () => {
  const handler = read('supabase/functions/fetch-bible-passage/handler.ts');
  for (const perm of ['{ resource: "presenter", action: "read" }', '{ resource: "liturgy_builder", action: "write" }', '{ resource: "oraciones", action: "write" }']) {
    assert.ok(handler.includes(perm), `fetch-bible-passage must accept ${perm}`);
  }
  const guardAt = handler.indexOf('requireAnyPermission(');
  const providerAt = handler.indexOf('fetchImpl(apiUrl');
  assert.ok(guardAt >= 0 && providerAt > guardAt, 'Bolls.life is called only after authorization');
  assert.match(handler, /req\.method !== "POST"/, 'POST only');
  const logCalls = handler.match(/console\.(log|warn|error|info)\([^)]*\)/g) ?? [];
  assert.ok(logCalls.length > 0);
  for (const call of logCalls) {
    assert.doesNotMatch(call, /reference|text|data|payload|body|error\)|\$\{(?!response\.status)/, `log statement must carry no reference, text, or body: ${call}`);
  }
});

Deno.test('send-signup-confirmation: participant-derived strings are escaped and the logo URL is attribute-encoded', () => {
  const handler = read('supabase/functions/send-signup-confirmation/handler.ts');
  assert.match(handler, /export function escapeHtml\(/);
  assert.match(handler, /\$\{escapeHtml\(data\.name\)\}/, 'fullName must be escaped');
  assert.match(handler, /\$\{escapeHtml\(data\.dinnerTime\)\}/);
  assert.match(handler, /\$\{escapeHtml\(formattedDinnerDate\)\}/);
  assert.match(handler, /\$\{escapeHtml\(formattedDeadline\)\}/);
  assert.doesNotMatch(handler, /\$\{data\.name\}/, 'no raw fullName interpolation');
  assert.match(handler, /logoSrcAttribute\(logoUrl\)/, 'the signed URL goes through the attribute encoder');
  assert.match(handler, /req\.method !== "POST"/, 'POST only');
});

// ---------------------------------------------------------------------------
// whatsapp-signup: the public handler AND its active caller
// ---------------------------------------------------------------------------

const WHATSAPP_CALLER = 'src/components/sections/InstagramFeed.tsx';

Deno.test('whatsapp-signup: public handler carries abuse protection, requires the timing field, and never logs personal data', () => {
  const handler = read('supabase/functions/whatsapp-signup/handler.ts');
  for (const marker of ['_honey', '_timestamp', 'isLimited(', 'normalizePhone(', 'normalizeName(', 'MAX_BODY_BYTES', 'MAX_TIMESTAMP_AGE_MS', 'MAX_CLOCK_SKEW_MS']) {
    assert.ok(handler.includes(marker), `whatsapp-signup must implement ${marker}`);
  }
  assert.doesNotMatch(handler, /if \(typeof payload\._timestamp === "number"\)/, 'the timing check must not be optional');
  assert.match(handler, /typeof submittedAt !== "number"/, 'a missing or non-numeric _timestamp is rejected');
  const logCalls = handler.match(/console\.(log|warn|error|info)\([^)]*\)/g) ?? [];
  assert.ok(logCalls.length > 0);
  for (const call of logCalls) {
    assert.doesNotMatch(call, /\$\{|name|phone|payload|body/, `log statement must carry no personal data: ${call}`);
  }
  assert.doesNotMatch(handler, /stack:|emailStatus|details:/, 'responses carry no stacks or provider payloads');
});

Deno.test('whatsapp-signup: InstagramFeed.tsx is the only active caller, sends the anti-bot fields, and logs nothing', () => {
  assert.deepEqual(BROWSER_INVENTORY.get('whatsapp-signup'), [WHATSAPP_CALLER]);
  const caller = read(WHATSAPP_CALLER);
  assert.match(caller, /functions\.invoke\("whatsapp-signup"/);
  assert.match(caller, /_honey: values\._honey \?\? ""/, 'the honeypot value is sent');
  assert.match(caller, /_timestamp: presentedAt/, 'the presentation timestamp is sent');
  assert.match(caller, /form\.register\("_honey"\)/, 'a real hidden _honey field is registered');
  assert.match(caller, /setPresentedAt\(Date\.now\(\)\)/, 'the timestamp is refreshed after reset');
  assert.doesNotMatch(caller, /console\.(log|info|warn|error|debug)\(/, 'the caller logs nothing: values, responses and raw errors stay out of the console');
});

// ---------------------------------------------------------------------------
// Tracked duplicates and orphaned callers
// ---------------------------------------------------------------------------

Deno.test('tracked duplicate files that invoke Functions are recorded (not modified in this round)', () => {
  for (const { file, fn } of TRACKED_DUPLICATE_CALLERS) {
    if (!existsSync(join(REPO_ROOT, file))) continue; // removing a duplicate is fine
    assert.ok(referencedFunctions(read(file)).includes(fn), `${file} is recorded as a caller of ${fn}`);
    assert.ok(BROWSER_INVENTORY.get(fn)?.includes(file), `${file} must appear in the inventory for ${fn}`);
  }
  // Every " 2." duplicate that references a Function must be recorded above.
  for (const [fn, files] of BROWSER_INVENTORY) {
    for (const file of files.filter((f) => / 2\.tsx?$/.test(f))) {
      assert.ok(
        TRACKED_DUPLICATE_CALLERS.some((d) => d.file === file && d.fn === fn),
        `unrecorded tracked duplicate caller: ${file} → ${fn}`,
      );
    }
  }
});

/** The only browser modules allowed to touch the publishable key. */
const ANON_KEY_ALLOWLIST = new Set([
  'src/integrations/supabase/config.ts',
  'src/integrations/supabase/client.ts',
  'src/integrations/supabase/__tests__/config.test.ts',
  'src/vite-env.d.ts',
]);

Deno.test('orphaned generate-prayer / generate-graphic callers are gone and no live caller references them', () => {
  assert.equal(existsSync(join(REPO_ROOT, 'src/lib/prayerGenerator.ts')), false, 'prayerGenerator.ts (dead, anon-key bearer) must be removed');
  assert.equal(existsSync(join(REPO_ROOT, 'src/components/graphics/GraphicsGenerator.tsx')), false, 'legacy GraphicsGenerator.tsx must be removed');
  assert.equal(existsSync(join(REPO_ROOT, 'supabase/functions/generate-prayer')), false);
  assert.equal(existsSync(join(REPO_ROOT, 'supabase/functions/generate-graphic')), false);
  assert.equal(BROWSER_INVENTORY.has('generate-prayer'), false);
  assert.equal(BROWSER_INVENTORY.has('generate-graphic'), false);
  for (const file of SRC_FILES) {
    const text = read(file);
    assert.doesNotMatch(text, /['"`]generate-prayer['"`]|functions\/v1\/generate-prayer/, `${file} references the nonexistent generate-prayer Function`);
    assert.doesNotMatch(text, /['"`]generate-graphic['"`]|functions\/v1\/generate-graphic/, `${file} references the nonexistent generate-graphic Function`);
  }
  const page = read('src/pages/GraphicsGeneratorPage.tsx');
  assert.match(page, /GraphicsGeneratorV2/, 'the active graphics page keeps using GraphicsGeneratorV2');
  assert.doesNotMatch(page, /from ['"]@\/components\/graphics\/GraphicsGenerator['"]/);
});

Deno.test('no live browser code sends the publishable key as a substitute user bearer token', () => {
  for (const file of SRC_FILES) {
    if (ANON_KEY_ALLOWLIST.has(file)) continue;
    if (isTestFile(file)) continue; // unit tests exercise config helpers
    const text = read(file);
    assert.doesNotMatch(text, /VITE_SUPABASE_ANON_KEY/, `${file} must not read the publishable key directly`);
    assert.doesNotMatch(text, /Bearer \$\{[^}]*(anon|publishable)[^}]*\}/i, `${file} must not present the publishable key as a bearer token`);
  }
});

// ---------------------------------------------------------------------------
// Route guard for the presenter (the browser side of presenter/read)
// ---------------------------------------------------------------------------

Deno.test('src/appRoutes.tsx: /presenter is wrapped in ProtectedRoute presenter:read and /output stays public', () => {
  const routes = read('src/appRoutes.tsx');
  assert.match(
    routes,
    /path: "\/presenter", element: <ProtectedRoute requires=\{\{ resource: 'presenter', action: 'read' \}\}><PresenterPage \/><\/ProtectedRoute>/,
  );
  assert.match(routes, /path: "\/output", element: <OutputPage \/> \}/, '/output is the projector window and stays public');
});
