/**
 * Tests for scripts/security/deploy-generate-scene-images.sh.
 * --check / --dry-run are exercised against fixtures and against the real
 * repository; --deploy is exercised ONLY with a fake `supabase` executable placed
 * first on PATH (it records how it was invoked and performs nothing), so no
 * real deployment can ever happen here.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const SCRIPT = join(HERE, 'deploy-generate-scene-images.sh');
const CASA = 'mulsqxfhxxdsadxsljss';
const FNE = 'sxlogxqzmarhqsblxmtj';
const CANONICAL_REPO_ROOT = realpathSync(REPO_ROOT);
const CANONICAL_FUNCTION_DIR = `${CANONICAL_REPO_ROOT}/supabase/functions/generate-scene-images`;

interface Fixture {
  projectId?: string;
  linkedRef?: string;
  rootVerifyJwt?: string;
  functionVerifyJwt?: string;
  withIndex?: boolean;
  symlinkFunctionTo?: string;
}

/** Creates a supabase-like directory; returns its path. */
function fixture(options: Fixture = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'casa-deploy-guard-'));
  const projectId = options.projectId ?? CASA;
  const rootVerify = options.rootVerifyJwt ?? 'true';
  writeFileSync(
    join(dir, 'config.toml'),
    `project_id = "${projectId}"\n\n[functions.other-function]\nverify_jwt = false\n\n[functions.generate-scene-images]\nverify_jwt = ${rootVerify}\n`,
  );
  mkdirSync(join(dir, 'functions'), { recursive: true });
  const fnDir = join(dir, 'functions', 'generate-scene-images');
  if (options.symlinkFunctionTo) {
    symlinkSync(options.symlinkFunctionTo, fnDir);
  } else {
    mkdirSync(fnDir, { recursive: true });
    if (options.withIndex !== false) writeFileSync(join(fnDir, 'index.ts'), '// FIXTURE implementation — must never be deployed\n');
    if (options.functionVerifyJwt !== undefined) {
      writeFileSync(join(fnDir, 'config.toml'), `[functions.generate-scene-images]\nverify_jwt = ${options.functionVerifyJwt}\n`);
    }
  }
  if (options.linkedRef !== undefined) {
    mkdirSync(join(dir, '.temp'), { recursive: true });
    writeFileSync(join(dir, '.temp', 'project-ref'), `${options.linkedRef}\n`);
  }
  return dir;
}

/** A foreign working directory that carries its own (FNE) supabase/ tree and function implementation. */
function foreignWorkdir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'casa-foreign-cwd-'));
  const supabaseDir = join(dir, 'supabase');
  mkdirSync(join(supabaseDir, 'functions', 'generate-scene-images'), { recursive: true });
  writeFileSync(join(supabaseDir, 'config.toml'), `project_id = "${FNE}"\n[functions.generate-scene-images]\nverify_jwt = false\n`);
  writeFileSync(join(supabaseDir, 'functions', 'generate-scene-images', 'index.ts'), '// FOREIGN implementation — must never be deployed\n');
  writeFileSync(join(dir, 'package.json'), '{"name":"foreign"}\n');
  return dir;
}

/** Fake `supabase` CLI: records cwd and args to MARKER, never contacts anything. */
function fakeSupabaseBin(marker: string): string {
  const bin = mkdtempSync(join(tmpdir(), 'casa-fake-supabase-'));
  const exe = join(bin, 'supabase');
  writeFileSync(exe, `#!/bin/bash\nprintf '%s\\n' "$(pwd -P)" "$*" > "${marker}"\nexit 0\n`);
  chmodSync(exe, 0o755);
  return bin;
}

interface RunOptions {
  cwd?: string;
  supabaseDir?: string;
  env?: Record<string, string>;
  pathPrefix?: string;
}

function run(args: string[], options: RunOptions = {}) {
  const basePath = Deno.env.get('PATH') ?? '/usr/bin:/bin';
  const env: Record<string, string> = {
    PATH: options.pathPrefix ? `${options.pathPrefix}:${basePath}` : basePath,
    HOME: Deno.env.get('HOME') ?? '/tmp',
    ...(options.supabaseDir ? { SUPABASE_DIR: options.supabaseDir } : {}),
    ...(options.env ?? {}),
  };
  const result = spawnSync('bash', [SCRIPT, ...args], { cwd: options.cwd ?? REPO_ROOT, encoding: 'utf8', env });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

// ─── Fixture-based policy checks (--check / --dry-run only) ──────────────────

Deno.test('passes --check for the CASA project with verify_jwt = true everywhere', () => {
  const result = run(['--check'], { supabaseDir: fixture({ linkedRef: CASA, functionVerifyJwt: 'true' }) });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`project=${CASA}`));
});

Deno.test('defaults to --check and never deploys without --deploy', () => {
  const result = run([], { supabaseDir: fixture() });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Deploying/);
});

Deno.test('refuses (exit 3) when config.toml, the linked ref, or the environment resolve to the FNE project', () => {
  assert.equal(run(['--check'], { supabaseDir: fixture({ projectId: FNE }) }).status, 3);
  const linked = run(['--check'], { supabaseDir: fixture({ linkedRef: FNE }) });
  assert.equal(linked.status, 3);
  assert.match(linked.stderr, /FNE project/);
  assert.equal(run(['--check'], { supabaseDir: fixture(), env: { SUPABASE_PROJECT_REF: FNE } }).status, 3);
});

Deno.test('refuses (exit 2) any project that is not CASA', () => {
  assert.equal(run(['--check'], { supabaseDir: fixture({ projectId: 'someotherprojectref0' }) }).status, 2);
  assert.equal(run(['--check'], { supabaseDir: fixture({ linkedRef: 'someotherprojectref0' }) }).status, 2);
});

Deno.test('refuses (exit 5) when verify_jwt is not true', () => {
  assert.equal(run(['--check'], { supabaseDir: fixture({ rootVerifyJwt: 'false' }) }).status, 5);
  assert.equal(run(['--check'], { supabaseDir: fixture({ functionVerifyJwt: 'false' }) }).status, 5);
  const noBlock = mkdtempSync(join(tmpdir(), 'casa-deploy-guard-noblock-'));
  writeFileSync(join(noBlock, 'config.toml'), `project_id = "${CASA}"\n`);
  mkdirSync(join(noBlock, 'functions', 'generate-scene-images'), { recursive: true });
  writeFileSync(join(noBlock, 'functions', 'generate-scene-images', 'index.ts'), '// test\n');
  assert.equal(run(['--check'], { supabaseDir: noBlock }).status, 5);
});

Deno.test('refuses (exit 4) --no-verify-jwt and unknown arguments', () => {
  assert.equal(run(['--no-verify-jwt'], { supabaseDir: fixture() }).status, 4);
  assert.equal(run(['--force'], { supabaseDir: fixture() }).status, 4);
});

Deno.test('refuses (exit 6) a missing entrypoint or a function directory that escapes the source via symlink', () => {
  assert.equal(run(['--check'], { supabaseDir: fixture({ withIndex: false }) }).status, 6);
  const outside = mkdtempSync(join(tmpdir(), 'casa-outside-fn-'));
  writeFileSync(join(outside, 'index.ts'), '// outside\n');
  const result = run(['--check'], { supabaseDir: fixture({ symlinkFunctionTo: outside }) });
  assert.equal(result.status, 6);
  assert.match(result.stderr, /escapes/);
});

// ─── Source anchoring ────────────────────────────────────────────────────────

Deno.test('the deployment source is anchored to this repository, not to the caller working directory', () => {
  const foreign = foreignWorkdir();
  const result = run(['--dry-run'], { cwd: foreign });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`source=${CANONICAL_FUNCTION_DIR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.equal(result.stdout.includes(foreign), false, 'the foreign supabase/ tree must be ignored');
  assert.match(result.stdout, new RegExp(`--project-ref ${CASA} --workdir ${CANONICAL_REPO_ROOT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(result.stdout, /DRY RUN \(cwd would be /);
  assert.doesNotMatch(result.stdout, /no-verify-jwt/);
});

Deno.test('--deploy refuses (exit 6) any SUPABASE_DIR, so an alternate source can never be substituted', () => {
  const marker = join(mkdtempSync(join(tmpdir(), 'casa-marker-')), 'invoked');
  const fake = fakeSupabaseBin(marker);
  const foreign = foreignWorkdir();
  for (const supabaseDir of [fixture(), join(foreign, 'supabase'), 'supabase']) {
    const result = run(['--deploy'], { cwd: foreign, supabaseDir, pathPrefix: fake });
    assert.equal(result.status, 6, result.stderr);
    assert.match(result.stderr, /SUPABASE_DIR is not allowed with --deploy/);
    assert.doesNotMatch(result.stdout, /Deploying/);
  }
  assert.equal(existsSync(marker), false, 'the CLI must not be invoked when the source is refused');
});

Deno.test('--deploy from a foreign working directory invokes the CLI from the repository root against the repository source (fake CLI)', () => {
  const marker = join(mkdtempSync(join(tmpdir(), 'casa-marker-')), 'invoked');
  const fake = fakeSupabaseBin(marker);
  const foreign = foreignWorkdir();
  const result = run(['--deploy'], { cwd: foreign, pathPrefix: fake });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`source=${CANONICAL_FUNCTION_DIR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.ok(existsSync(marker), 'fake CLI should have been invoked');
  const [recordedCwd, recordedArgs] = readFileSync(marker, 'utf8').trim().split('\n');
  assert.equal(recordedCwd, CANONICAL_REPO_ROOT, 'CLI must run from the canonical repository root');
  assert.equal(recordedArgs, `functions deploy generate-scene-images --project-ref ${CASA} --workdir ${CANONICAL_REPO_ROOT}`);
  assert.equal(recordedArgs.includes(foreign), false);
});

Deno.test('the real repository passes --check (CASA bound, verify_jwt = true) from any working directory', () => {
  assert.equal(run(['--check']).status, 0);
  assert.equal(run(['--check'], { cwd: tmpdir() }).status, 0);
});
