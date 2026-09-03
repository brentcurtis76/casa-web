/**
 * Tests for scripts/security/credential-guard.mjs (offline, Deno, no dependencies).
 * Every credential-shaped sample is assembled at runtime from harmless parts, and
 * regression fixtures are generated into temporary Git repositories, so this file
 * and the repository contain no credential-shaped literal and no path allowlist.
 * Run: npm run test:security
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as guard from './credential-guard.mjs';

const { DEFAULT_MAX_FILE_BYTES, RULES, isPlaceholder, listIndexEntries, listTrackedFiles, locateWorktreeEntry, scanText } = guard;

interface Finding {
  ruleId: string;
  file: string;
  line: number;
  column: number;
  source: 'index' | 'worktree' | 'both';
}

interface JsonResult {
  ok: boolean;
  error?: string;
  findings: Finding[];
  totalPaths: number;
  scannedFiles: number;
  scannedBlobs: number;
  scannedSymlinks: number;
  skippedBinary: number;
  missingWorktree: number;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const GUARD = join(HERE, 'credential-guard.mjs');

function b64url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fakeJwt(payload: Record<string, unknown>, signature = 's'.repeat(43)): string {
  return [b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), b64url(JSON.stringify(payload)), signature].join('.');
}

function ruleIds(findings: Array<{ ruleId: string }>): string[] {
  return [...new Set(findings.map((finding) => finding.ruleId))].sort();
}

function runGuard(args: string[], cwd = REPO_ROOT, env: Record<string, string> = {}) {
  const result = spawnSync('node', [GUARD, ...args], {
    cwd,
    encoding: 'utf8',
    env: { PATH: Deno.env.get('PATH') ?? '/usr/bin:/bin', HOME: Deno.env.get('HOME') ?? '/tmp', ...env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function git(dir: string, ...args: string[]): void {
  const result = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
}

function tempGitRepo(files: Record<string, string | Uint8Array>): string {
  const dir = mkdtempSync(join(tmpdir(), 'casa-guard-'));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  git(dir, 'init', '-q');
  if (Object.keys(files).length > 0) git(dir, 'add', '-A');
  return dir;
}

function jsonRun(dir: string, env: Record<string, string> = {}): { status: number | null; json: JsonResult; stdout: string } {
  const result = runGuard(['--json', '--root', dir], REPO_ROOT, env);
  return { status: result.status, json: JSON.parse(result.stdout) as JsonResult, stdout: result.stdout };
}

/** A directory OUTSIDE any temp repository, standing in for a target the guard must never read. */
function externalDir(): string {
  return mkdtempSync(join(tmpdir(), 'casa-guard-external-'));
}

const RANDOMISH = 'Zq9T7pL2mW8vR4kN6bH3xJ5cF1yD0sA';

const DETECTION_SAMPLES: Array<[string, string]> = [
  ['jwt-literal', `const SUPABASE_KEY = "${fakeJwt({ role: 'anon', ref: 'unit' })}";`],
  ['jwt-fragment', `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify({ role: 'anon', ref: 'unit-test' }))}`],
  ['supabase-secret-key', `SUPABASE_SECRET_KEY=${['sb', 'secret', 'Q7m'.padEnd(30, 'k')].join('_')}`],
  ['supabase-publishable-key-literal', `const key = '${['sb', 'publishable', 'Q7m'.padEnd(30, 'k')].join('_')}';`],
  ['supabase-access-token', `SUPABASE_ACCESS_TOKEN=${'sbp_' + 'a1'.repeat(15)}`],
  ['service-role-assignment', `SUPABASE_SERVICE_ROLE_KEY = "${RANDOMISH}"`],
  ['service-role-assignment', `const serviceRoleKey = '${RANDOMISH}';`],
  ['postgres-url-with-password', `DATABASE_URL=postgresql://postgres.abc:${'Gu4rd' + 'P4ss' + 'w0rd'}@db.internal.test:5432/postgres`],
  ['private-key-block', ['-----BEGIN RSA PRIVATE', 'KEY-----\nMIIE\n-----END RSA PRIVATE', 'KEY-----'].join(' ')],
  ['google-api-key', `GOOGLE_AI_API_KEY=${'AIza' + 'Q'.repeat(35)}`],
  ['google-oauth-client-secret', `client_secret: ${'GOCSPX-' + 'q1'.repeat(12)}`],
  ['openai-anthropic-key', `ANTHROPIC_API_KEY=${'sk-ant-api03-' + 'Rt5'.padEnd(30, '9')}`],
  ['openai-anthropic-key', `OPENAI_API_KEY=${'sk-proj-' + 'Rt5'.padEnd(30, '9')}`],
  ['github-token', `token: ${'ghp_' + 'A1'.repeat(18)}`],
  ['github-token', `token: ${'github_pat_' + 'A1'.repeat(15)}`],
  ['slack-token', `SLACK_TOKEN=${'xoxb-' + '1234567890-abcdefghij'}`],
  ['aws-access-key-id', `AWS_ACCESS_KEY_ID=${'AKIA' + 'Q'.repeat(16)}`],
  ['meta-graph-token', `const accessToken = "${'EAA' + 'Q7'.repeat(25)}";`],
  ['resend-api-key', `RESEND_API_KEY=${'re_' + 'Ab12Cd' + '_' + 'Q1'.repeat(10)}`],
  ['stripe-secret-key', `STRIPE_SECRET_KEY=${'sk_live_' + 'Q1'.repeat(10)}`],
  ['generic-secret-assignment', `api_key: "${'A1b2C3d4E5f6G7h8I9j0KlMn'}"`],
  ['generic-secret-assignment', `TWILIO_AUTH_TOKEN = "${'9f2ab6c1d4e7f8a0b3c5d6e7f8091a2b'}"`],
];

Deno.test('every credential class is detected', () => {
  for (const [ruleId, sample] of DETECTION_SAMPLES) {
    const findings = scanText(sample, 'sample.txt');
    assert.ok(findings.some((finding: Finding) => finding.ruleId === ruleId), `expected ${ruleId} for a sample; got ${JSON.stringify(ruleIds(findings))}`);
  }
});

Deno.test('every rule has a detection sample; findings carry location and source but never the value', () => {
  const covered = new Set(DETECTION_SAMPLES.map(([ruleId]) => ruleId));
  for (const rule of RULES) assert.ok(covered.has(rule.id), `rule ${rule.id} has no detection sample`);
  const findings = scanText(DETECTION_SAMPLES[0][1], 'sample.txt', 'index') as Finding[];
  assert.deepEqual(Object.keys(findings[0]).sort(), ['column', 'file', 'line', 'ruleId', 'source']);
  assert.equal(findings[0].source, 'index');
});

Deno.test('a full JWT is reported once (fragment and generic rules do not double-report)', () => {
  const findings = scanText(`SUPABASE_SERVICE_ROLE_KEY = "${fakeJwt({ role: 'service_role' })}"`, 'x.env') as Finding[];
  assert.deepEqual(ruleIds(findings), ['jwt-literal', 'service-role-assignment']);
  assert.equal(findings.filter((finding) => finding.ruleId === 'jwt-literal').length, 1);
});

Deno.test('whole-value placeholders are allowed', () => {
  const placeholders = [
    'VITE_SUPABASE_ANON_KEY=<your-supabase-anon-or-publishable-key>',
    'SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here"',
    'SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"',
    'SUPABASE_SERVICE_ROLE_KEY="REPLACE_WITH_SERVICE_ROLE_KEY"',
    'SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}',
    'psql "postgresql://postgres:[YOUR-PASSWORD]@db.projectref.supabase.co:5432/postgres"',
    'DATABASE_URL=postgresql://postgres:<password>@db.example.internal:5432/postgres',
    'DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@db.example.internal:5432/postgres',
    'DATABASE_URL=postgresql://postgres:PASSWORD@db.example.internal:5432/postgres',
    'RESEND_API_KEY = "re_123"',
    'supabase secrets set RESEND_API_KEY=<your-resend-api-key>',
    "const key = Deno.env.get('GOOGLE_AI_API_KEY');",
    'OPENAI_API_KEY=sk-your-key-here-xxxxxxxxxxxxxxxxxxxx',
    'SLACK_TOKEN=xoxb-your-bot-token-here',
    'api_key: "REPLACE_WITH_YOUR_API_KEY_VALUE"',
    'api_key: "xxxxxxxxxxxxxxxxxxxxxxxxxxxx"',
    'password: "Contraseña incorrecta, intenta de nuevo"',
    "token: 'refresh_token_expired_please_login_again'",
  ];
  for (const line of placeholders) {
    assert.deepEqual(scanText(line, 'doc.md'), [], `unexpected finding for placeholder: ${line}`);
  }
  assert.equal(isPlaceholder('<your-key>'), true);
  assert.equal(isPlaceholder('[YOUR-PASSWORD]'), true);
  assert.equal(isPlaceholder('${SECRET}'), true);
  assert.equal(isPlaceholder('your_service_role_key_here'), true);
  assert.equal(isPlaceholder('REPLACE_ME'), true);
  assert.equal(isPlaceholder('xxxxxxxxxxxx'), true);
});

Deno.test('placeholder exemption is whole-value only: random values containing marker words are still flagged', () => {
  assert.equal(isPlaceholder('Zq9yourXxxT7insertR3sample99'), false);
  assert.equal(isPlaceholder('A1b2C3d4E5f6G7h8I9j0KlMn'), false);
  assert.equal(isPlaceholder('ex4mple7Q9zRtV2kLm8nP0'), false);
  const sneaky = [
    `SUPABASE_SERVICE_ROLE_KEY = "${'Zq9yourXxxT7insertR3sample99Ab'}"`,
    `OPENAI_API_KEY=${'sk-' + 'Q7yourT9xxxR2hereK4mple1zP'}`,
    `DATABASE_URL=postgresql://postgres:${'Xx9your0Pass7xxx2Q'}@db.internal.test:5432/postgres`,
    `const key = "${fakeJwt({ role: 'anon' }, 'xxxxxyourxxxxxexamplexxxxxxsamplexxxxxxxxxx')}";`,
  ];
  for (const line of sneaky) {
    assert.ok(scanText(line, 'x.txt').length > 0, `expected a finding for: ${line.slice(0, 40)}...`);
  }
});

Deno.test('repository templates and docs contain no credential-shaped literal', () => {
  for (const file of ['.env.example', 'VERCEL_DEPLOYMENT.md', 'supabase/functions/generate-scene-images/README.md']) {
    const text = readFileSync(join(REPO_ROOT, file), 'utf8');
    assert.deepEqual(scanText(text, file), [], `unexpected finding in ${file}`);
  }
});

Deno.test('regression fixtures (generated at runtime) reproduce the removed mistakes and are all detected', () => {
  const serviceJwt = fakeJwt({ iss: 'guard-fixture', ref: 'guardfixtureref00000', role: 'service_role' }, 'F1xtureS1gnatureNotACredential0000000000000');
  const anonJwt = fakeJwt({ iss: 'guard-fixture', ref: 'guardfixtureref00000', role: 'anon' }, 'F1xtureS1gnatureNotACredential0000000000000');
  const repo = tempGitRepo({
    'check_months.js': [
      "const { createClient } = require('@supabase/supabase-js');",
      "const SUPABASE_URL = 'https://guardfixtureref00000.supabase.co';",
      `const SUPABASE_SERVICE_ROLE_KEY = '${serviceJwt}';`,
      'createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);',
      '',
    ].join('\n'),
    'src/integrations/supabase/client.ts': [
      'const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://guardfixtureref00000.supabase.co";',
      `const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "${anonJwt}";`,
      '',
    ].join('\n'),
    'VERCEL_DEPLOYMENT.md': `VITE_SUPABASE_URL=https://guardfixtureref00000.supabase.co\nVITE_SUPABASE_ANON_KEY=${anonJwt}\n`,
    'supabase/.temp/pooler-url': `postgresql://postgres.guardfixtureref00000:${'Gu4rdF1xtur3P4ssNotReal'}@aws-0-us-east-1.pooler.supabase.com:6543/postgres\n`,
    'secrets.env': [
      `SUPABASE_SECRET_KEY=${'sb_secret_' + 'F1xtureNotARealKey000000000000'}`,
      `GOOGLE_AI_API_KEY=${'AIza' + 'F1xtureNotARealKey'.padEnd(35, '0')}`,
      `ANTHROPIC_API_KEY=${'sk-ant-api03-' + 'F1xtureNotARealKey0000000000000'}`,
      `META_ACCESS_TOKEN=${'EAA' + 'F1xtureNotARealToken' + '0'.repeat(30)}`,
      `RESEND_API_KEY=${'re_' + 'F1xtur3' + '_' + 'NotARealResendKey00000'}`,
      ['-----BEGIN PRIVATE', 'KEY-----'].join(' '),
      'F1xtureNotAKey',
      ['-----END PRIVATE', 'KEY-----'].join(' '),
      '',
    ].join('\n'),
    'README.md': '# fixture repo\n',
  });
  const { status, json, stdout } = jsonRun(repo);
  assert.equal(status, 1);
  assert.equal(json.ok, false);
  const byFile = new Map<string, string[]>();
  for (const finding of json.findings) byFile.set(finding.file, [...(byFile.get(finding.file) ?? []), finding.ruleId]);
  const expect = (file: string, rules: string[]) => {
    const got = [...new Set(byFile.get(file) ?? [])];
    for (const rule of rules) assert.ok(got.includes(rule), `${file}: expected ${rule}, got ${got.join(', ')}`);
  };
  expect('check_months.js', ['jwt-literal', 'service-role-assignment']);
  expect('src/integrations/supabase/client.ts', ['jwt-literal']);
  expect('VERCEL_DEPLOYMENT.md', ['jwt-literal']);
  expect('supabase/.temp/pooler-url', ['postgres-url-with-password']);
  expect('secrets.env', ['supabase-secret-key', 'google-api-key', 'openai-anthropic-key', 'meta-graph-token', 'resend-api-key', 'private-key-block']);
  assert.equal(byFile.has('README.md'), false);
  assert.equal(stdout.includes('F1xture'), false, 'output must never contain matched values');
  assert.equal(stdout.includes(anonJwt.split('.')[1]), false);
});

Deno.test('the guard has no path allowlist or exemption list', () => {
  assert.equal('FIXTURE_ALLOWLIST' in guard, false);
  const source = readFileSync(GUARD, 'utf8');
  for (const token of ['FIXTURE_ALLOWLIST', 'skippedAllowlisted', 'allowlist.some', 'ALLOWLIST']) {
    assert.equal(source.includes(token), false, `guard source must not contain ${token}`);
  }
});

Deno.test('a staged secret hidden behind a clean working-tree version is still found (index scan)', () => {
  const token = fakeJwt({ role: 'service_role', ref: 'index-test' });
  const repo = tempGitRepo({ 'README.md': '# clean\n', 'src/config.ts': `export const KEY = "${token}";\n` });
  writeFileSync(join(repo, 'src/config.ts'), 'export const KEY = import.meta.env.VITE_KEY;\n');
  const { status, json } = jsonRun(repo);
  assert.equal(status, 1);
  assert.deepEqual(json.findings, [{ ruleId: 'jwt-literal', file: 'src/config.ts', line: 1, column: 21, source: 'index' }]);
  assert.equal(json.scannedFiles, 2);
  assert.equal(json.scannedBlobs, 2);
});

Deno.test('an unstaged working-tree secret with a clean index is found (worktree scan)', () => {
  const repo = tempGitRepo({ 'README.md': '# clean\n', 'src/config.ts': 'export const KEY = import.meta.env.VITE_KEY;\n' });
  writeFileSync(join(repo, 'src/config.ts'), `export const KEY = "${fakeJwt({ role: 'anon', ref: 'wt-test' })}";\n`);
  const { status, json } = jsonRun(repo);
  assert.equal(status, 1);
  assert.equal(json.findings.length, 1);
  assert.equal(json.findings[0].source, 'worktree');
});

Deno.test('a tracked file deleted from the working tree is still scanned from the index', () => {
  const repo = tempGitRepo({ 'README.md': '# clean\n', 'leak.js': `const KEY = "${fakeJwt({ role: 'anon' })}";\n` });
  rmSync(join(repo, 'leak.js'));
  const { status, json } = jsonRun(repo);
  assert.equal(status, 1);
  assert.equal(json.findings[0].file, 'leak.js');
  assert.equal(json.findings[0].source, 'index');
  assert.equal(json.missingWorktree, 1);
});

Deno.test('CLI exits 2 (never 0) when there is nothing trustworthy to scan', () => {
  const notGit = mkdtempSync(join(tmpdir(), 'casa-guard-nogit-'));
  assert.equal(runGuard(['--root', notGit]).status, 2);
  assert.equal(runGuard(['--root', tempGitRepo({})]).status, 2);
  const onlyBinary = tempGitRepo({ 'image.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3]) });
  assert.equal(runGuard(['--root', onlyBinary]).status, 2);
});

Deno.test('CLI fails closed (exit 2) instead of skipping a tracked text file that exceeds the size ceiling', () => {
  const repo = tempGitRepo({ 'README.md': '# clean\n', 'big.txt': 'a'.repeat(500) });
  const { status, json } = jsonRun(repo, { CREDENTIAL_GUARD_MAX_FILE_BYTES: '100' });
  assert.equal(status, 2);
  assert.equal(json.ok, false);
  assert.match(json.error ?? '', /ceiling/);
  assert.ok(DEFAULT_MAX_FILE_BYTES > 1024 * 1024);
});

Deno.test('CLI exits 1 with rule and location (never the value) when a tracked file leaks a credential', () => {
  const token = fakeJwt({ role: 'service_role', ref: 'leak-test' });
  const repo = tempGitRepo({ 'README.md': '# clean\n', 'src/leak.ts': `export const KEY = "${token}";\n` });
  const { status, json, stdout } = jsonRun(repo);
  assert.equal(status, 1);
  assert.deepEqual(json.findings, [{ ruleId: 'jwt-literal', file: 'src/leak.ts', line: 1, column: 21, source: 'both' }]);
  assert.equal(stdout.includes(token), false);
  const human = runGuard(['--root', repo]);
  assert.equal(human.status, 1);
  assert.match(human.stdout, /FAIL — 1 credential-shaped literal/);
  assert.match(human.stdout, /jwt-literal\s+src\/leak\.ts:1:21/);
  assert.equal(human.stdout.includes(token), false);
});

Deno.test('CLI exits 0 on a clean repository and skips binary files', () => {
  const binary = new Uint8Array(64);
  binary.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const repo = tempGitRepo({
    'README.md': '# clean\nVITE_SUPABASE_ANON_KEY=<your-anon-key>\n',
    'logo.png': binary,
    'blob.dat': new Uint8Array([0x00, ...new TextEncoder().encode(fakeJwt({ role: 'anon' }))]),
  });
  const { status, json } = jsonRun(repo);
  assert.equal(status, 0);
  assert.equal(json.ok, true);
  assert.equal(json.scannedFiles, 1);
  assert.equal(json.skippedBinary, 2);
});

Deno.test('the guard scans this repository (integration)', () => {
  assert.ok(listTrackedFiles(REPO_ROOT).length > 100);
  const result = runGuard(['--json']);
  const parsed = JSON.parse(result.stdout) as JsonResult;
  assert.ok(parsed.scannedFiles > 100);
  assert.ok([0, 1].includes(result.status ?? -1));
});

// ─── Repository containment (no symlink is ever dereferenced) ────────────────

Deno.test('a tracked final symlink contributes only its link-path text: the external target is never read or detected', () => {
  const token = fakeJwt({ role: 'service_role', ref: 'symlink-target-test' });
  const outside = externalDir();
  const target = join(outside, 'notes.md');
  writeFileSync(target, `SUPABASE_SERVICE_ROLE_KEY = "${token}"\n`);
  const repo = tempGitRepo({ 'README.md': '# clean\n' });
  symlinkSync(target, join(repo, 'link.md'));
  git(repo, 'add', '-A');
  assert.equal(listIndexEntries(repo).find((entry: { path: string }) => entry.path === 'link.md')?.mode, '120000');

  const { status, json, stdout } = jsonRun(repo);
  assert.equal(status, 0, 'the credential inside the external target must not be found');
  assert.equal(json.ok, true);
  assert.deepEqual(json.findings, []);
  assert.equal(json.scannedSymlinks, 1);
  assert.equal(json.scannedFiles, 2);
  assert.equal(json.scannedBlobs, 2);
  assert.equal(stdout.includes(token.split('.')[1]), false);

  // The locator takes the canonical root (scanEntries canonicalises via realpath before use).
  const located = locateWorktreeEntry(realpathSync(repo), 'link.md');
  assert.equal(located.kind, 'symlink');
  assert.equal(located.linkText, target);
});

Deno.test('credential-shaped text inside a symlink link path is still detected from the index and the working tree', () => {
  const repo = tempGitRepo({ 'README.md': '# clean\n' });
  symlinkSync(`../vault/${'sk-ant-api03-' + 'Lnk7'.repeat(8)}.txt`, join(repo, 'link.txt'));
  git(repo, 'add', '-A');
  const { status, json } = jsonRun(repo);
  assert.equal(status, 1);
  assert.deepEqual(ruleIds(json.findings), ['openai-anthropic-key']);
  assert.equal(json.findings[0].file, 'link.txt');
  assert.equal(json.findings[0].source, 'both');
});

Deno.test('a symlinked parent directory fails closed (exit 2) and nothing outside the repository is read', () => {
  const token = fakeJwt({ role: 'anon', ref: 'escape-test' });
  const outside = externalDir();
  writeFileSync(join(outside, 'config.ts'), `export const KEY = "${token}";\n`);
  const repo = tempGitRepo({ 'README.md': '# clean\n', 'sub/config.ts': 'export const KEY = import.meta.env.VITE_KEY;\n' });
  rmSync(join(repo, 'sub'), { recursive: true });
  symlinkSync(outside, join(repo, 'sub'));

  const { status, json, stdout } = jsonRun(repo);
  assert.equal(status, 2);
  assert.equal(json.ok, false);
  assert.match(json.error ?? '', /sub\/config\.ts: refused .* symlink/);
  assert.equal('findings' in json, false);
  assert.equal(stdout.includes(token.split('.')[1]), false);
  assert.equal(stdout.includes(outside), false, 'the external location must not be echoed');

  const located = locateWorktreeEntry(realpathSync(repo), 'sub/config.ts');
  assert.equal(located.kind, 'unsafe');

  // An intermediate symlink that stays INSIDE the repository is refused the same way (never dereferenced).
  const inside = tempGitRepo({ 'README.md': '# clean\n', 'real/a.txt': 'clean\n', 'alias/b.txt': 'clean\n' });
  rmSync(join(inside, 'alias'), { recursive: true });
  symlinkSync('real', join(inside, 'alias'));
  assert.equal(jsonRun(inside).status, 2);
});

Deno.test('a traversal component or a root outside the working tree is never resolved', () => {
  const repo = realpathSync(tempGitRepo({ 'README.md': '# clean\n' }));
  assert.equal(locateWorktreeEntry(repo, '../README.md').kind, 'unsafe');
  assert.equal(locateWorktreeEntry(repo, 'a/../README.md').kind, 'unsafe');
  assert.equal(locateWorktreeEntry(repo, 'README.md').kind, 'file');
  assert.equal(locateWorktreeEntry(repo, 'absent.md').kind, 'missing');
  // A non-canonical root (behind a symlinked temp dir) is refused rather than resolved through the link.
  const viaSymlink = tempGitRepo({ 'README.md': '# clean\n' });
  if (realpathSync(viaSymlink) !== viaSymlink) assert.equal(locateWorktreeEntry(viaSymlink, 'README.md').kind, 'unsafe');
  assert.equal(guard.isInsideRoot('/repo', '/repo'), true);
  assert.equal(guard.isInsideRoot('/repo', '/repo/a/b'), true);
  assert.equal(guard.isInsideRoot('/repo', '/repository/a'), false);
  assert.equal(guard.isInsideRoot('/repo', '/other'), false);
});

Deno.test('regular staged and unstaged files still scan correctly alongside a tracked symlink', () => {
  const stagedToken = fakeJwt({ role: 'service_role', ref: 'staged-test' });
  const worktreeToken = fakeJwt({ role: 'anon', ref: 'worktree-test' });
  const repo = tempGitRepo({
    'README.md': '# clean\n',
    'src/staged.ts': `export const A = "${stagedToken}";\n`,
    'src/wt.ts': 'export const B = import.meta.env.B;\n',
  });
  writeFileSync(join(repo, 'src/staged.ts'), 'export const A = import.meta.env.A;\n');
  writeFileSync(join(repo, 'src/wt.ts'), `export const B = "${worktreeToken}";\n`);
  symlinkSync('README.md', join(repo, 'alias.md'));
  git(repo, 'add', 'alias.md');

  const { status, json, stdout } = jsonRun(repo);
  assert.equal(status, 1);
  assert.deepEqual(
    json.findings.map((finding) => [finding.file, finding.ruleId, finding.source]).sort(),
    [['src/staged.ts', 'jwt-literal', 'index'], ['src/wt.ts', 'jwt-literal', 'worktree']],
  );
  assert.equal(json.scannedSymlinks, 1);
  assert.equal(json.scannedFiles, 4);
  assert.equal(json.scannedBlobs, 4);
  assert.equal(stdout.includes(stagedToken.split('.')[1]), false);
  assert.equal(stdout.includes(worktreeToken.split('.')[1]), false);
});
