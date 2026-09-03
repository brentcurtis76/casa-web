#!/usr/bin/env node
/**
 * CASA credential guard
 * ---------------------
 * Scans every Git-tracked path for credential-shaped literals, in BOTH the index
 * (staged blob) and the working tree, so a staged secret cannot hide behind an
 * unstaged clean version and a deleted-but-tracked file is still inspected.
 *
 * Detected classes: JSON Web Tokens (Supabase legacy anon/service_role keys,
 * storage signed-URL tokens), modern Supabase `sb_secret_*` / `sb_publishable_*`
 * keys and `sbp_*` access tokens, service_role assignments, PostgreSQL URLs that
 * embed a password, PEM private keys and common API-token formats (Google,
 * OpenAI/Anthropic, GitHub, Slack, AWS, Meta, Resend, Stripe), plus high-entropy
 * literals assigned to secret-like names.
 *
 * Placeholders are exempt only when the WHOLE value is an obvious placeholder
 * form (`<...>`, `[...]`, `{...}`, `${VAR}`, `your_..._here`, `REPLACE_ME`,
 * `xxxx`, `...`, `changeme`, ...). A substring such as "xxx" or "your" inside an
 * otherwise random value never exempts it. Structurally real values (a full JWT,
 * an AIza key, a PEM block) are never exempt. There is NO path allowlist.
 *
 * Repository-bounded: the working tree is read WITHOUT dereferencing any
 * filesystem symlink. Every path component is inspected with lstat; a tracked
 * path whose final component is a symlink contributes only its link-path text
 * (the same text Git stores as its index blob), and a symlinked intermediate
 * directory or any path that would resolve outside the canonical repository root
 * is refused before anything is read. Regular files are opened with O_NOFOLLOW
 * after their resolved parent has been proven to lie inside the root.
 *
 * Fail-closed rules (exit 2, never 0): not a Git repository, zero tracked paths,
 * zero text files scanned, a tracked text file that could not be read from either
 * source, a text file larger than the hard ceiling, a tracked path that cannot be
 * proven to stay inside the repository root, or a working-tree file that exists
 * but cannot be opened/read (permission error, I/O error): the index copy alone is
 * never trusted in its place. Only a genuinely missing/deleted working-tree file
 * falls back to the index copy.
 *
 * Paths come from `git ls-files -z`, whose separator is always "/". A backslash is
 * a legal POSIX filename character and is never treated as a separator.
 *
 * Usage:  node scripts/security/credential-guard.mjs [--json] [--root <dir>]
 * Exit:   0 clean · 1 findings · 2 scan cannot be trusted
 * Output never contains a matched value — only rule, file:line:column and source.
 *
 * Plain Node (>= 18), no dependencies. Also importable from tests.
 */
import { Buffer } from 'node:buffer';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, constants as fsConstants, lstatSync, openSync, readFileSync, readlinkSync, realpathSync, statSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {{ ruleId: string, file: string, line: number, column: number, source: 'index' | 'worktree' | 'both' }} Finding
 * @typedef {{ findings: Finding[], totalPaths: number, scannedFiles: number, scannedBlobs: number,
 *   scannedSymlinks: number, skippedBinary: number, skippedSubmodules: number, missingWorktree: number,
 *   problems: string[] }} ScanResult
 * @typedef {{ kind: 'file', path: string, size: number } | { kind: 'symlink', linkText: string } |
 *   { kind: 'missing' } | { kind: 'unsafe', reason: string }} WorktreeLocation
 */

/** Hard ceiling for a single text file; larger files are a fail-closed problem, never silently skipped. */
export const DEFAULT_MAX_FILE_BYTES = 64 * 1024 * 1024;

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.icns', '.bmp', '.tif', '.tiff',
  '.pdf', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp3', '.mp4', '.m4a', '.wav', '.ogg',
  '.mov', '.webm', '.zip', '.gz', '.tgz', '.bz2', '.7z', '.jar', '.lockb', '.bin', '.psd', '.ai',
  '.sketch', '.pptx', '.docx', '.xlsx', '.pyc', '.class', '.wasm',
]);

// ─── Placeholder policy (whole-value forms only) ─────────────────────────────

const VENDOR_PREFIX = /^(?:sk-ant-api\d{2}-|sk-ant-|sk-proj-|sk-|[sr]k_(?:live|test)_|xox[baprs]-|re_|sbp_|sb_secret_|sb_publishable_|AIza|GOCSPX-|gh[pousr]_|github_pat_|EAA|AKIA|ASIA)/;

const PLACEHOLDER_WORDS = new Set([
  'changeme', 'change_me', 'change-me', 'placeholder', 'redacted', 'example', 'sample', 'dummy',
  'todo', 'tbd', 'password', 'passwd', 'secret', 'token', 'apikey', 'api_key', 'api-key', 'key',
  'value', 'null', 'none', 'undefined', 'string', 'here', 'replace_me', 'replace-me', 'replaceme',
]);

/**
 * True only when the ENTIRE value is an obvious documented placeholder.
 * A real random credential cannot satisfy any of these forms.
 */
export function isPlaceholder(rawValue) {
  if (typeof rawValue !== 'string') return true;
  const value = rawValue.trim();
  if (value.length === 0) return true;
  // Whole value wrapped in placeholder brackets or a template reference.
  if (/^<[^<>]*>$/.test(value) || /^\[[^[\]]*\]$/.test(value) || /^\{\{?[^{}]*\}?\}$/.test(value)) return true;
  if (/^\$\{?[A-Za-z_][A-Za-z0-9_]*\}?$/.test(value) || /^%[A-Za-z_][A-Za-z0-9_]*%$/.test(value)) return true;
  if (/^(?:process\.env|import\.meta\.env|Deno\.env\.get|os\.environ|env)[.([]/.test(value)) return true;
  // Vendor prefix followed by a placeholder body, e.g. sk-your-key-here, re_your_api_key_here.
  const body = value.replace(VENDOR_PREFIX, '');
  const lower = body.toLowerCase();
  if (lower.length === 0) return true;
  if (/^(?:your|my|the|our|insert|paste|enter|put|add|replace)[-_ ]/.test(lower)) return true;
  if (/^(?:x+|\*+|\.+|_+|-+|#+|0+)$/.test(lower)) return true;
  if (PLACEHOLDER_WORDS.has(lower)) return true;
  if (/^[a-z]+(?:[-_](?:key|token|secret|password|value|id|url|here))+$/.test(lower)) return true;
  // ALL_CAPS identifier-style placeholders without digits (REPLACE_WITH_YOUR_KEY, YOUR_API_KEY).
  if (/^[A-Z][A-Z_-]{3,}$/.test(body)) return true;
  return false;
}

/** Shannon entropy in bits per character. */
export function shannonEntropy(value) {
  if (!value) return 0;
  const counts = new Map();
  for (const ch of value) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function looksRandom(value) {
  if (!/\d/.test(value)) return false;
  const mixedCase = /[a-z]/.test(value) && /[A-Z]/.test(value);
  return shannonEntropy(value) >= 3.5 && (mixedCase || value.length >= 32);
}

// ─── Rules ───────────────────────────────────────────────────────────────────

function rule(id, description, pattern, options = {}) {
  return {
    id,
    description,
    pattern,
    valueGroups: options.valueGroups ?? [],
    allowPlaceholder: options.allowPlaceholder === true,
    requireRandom: options.requireRandom === true,
  };
}

export const RULES = Object.freeze([
  rule('jwt-literal', 'JSON Web Token literal (Supabase legacy anon/service_role keys, storage signed-URL tokens)',
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g),
  rule('jwt-fragment', 'Partial JSON Web Token (header.payload without signature)',
    /\beyJhbGciOi[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b(?!\.)/g),
  rule('supabase-secret-key', 'Supabase secret API key (sb_secret_...)',
    /\bsb_secret_[A-Za-z0-9_-]{16,}/g),
  rule('supabase-publishable-key-literal', 'Supabase publishable key literal (must come from the environment, not source)',
    /\bsb_publishable_[A-Za-z0-9_-]{16,}/g),
  rule('supabase-access-token', 'Supabase personal access token (sbp_...)',
    /\bsbp_[A-Za-z0-9]{20,}\b/g),
  rule('service-role-assignment', 'service_role credential assigned to a string literal',
    /\b(?:supabase[_-]?)?service[_-]?role(?:[_-]?key)?\b\s*[:=]\s*["'`]([^"'`\s]{16,})["'`]/gi,
    { valueGroups: [1], allowPlaceholder: true }),
  rule('postgres-url-with-password', 'PostgreSQL connection URL embedding a password',
    /\bpostgres(?:ql)?:\/\/[^:\s@"'`/]+:([^@\s"'`]+)@[^\s"'`]+/gi,
    { valueGroups: [1], allowPlaceholder: true }),
  rule('private-key-block', 'PEM private key block',
    /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/g),
  rule('google-api-key', 'Google API key (AIza...)',
    /\bAIza[0-9A-Za-z_-]{35}\b/g),
  rule('google-oauth-client-secret', 'Google OAuth client secret (GOCSPX-...)',
    /\bGOCSPX-[A-Za-z0-9_-]{20,}\b/g),
  rule('openai-anthropic-key', 'OpenAI / Anthropic secret key (sk-...)',
    /\bsk-(?:proj-|ant-(?:api\d{2}-)?)?[A-Za-z0-9_-]{20,}\b/g, { allowPlaceholder: true }),
  rule('github-token', 'GitHub token (ghp_/gho_/ghu_/ghs_/ghr_/github_pat_)',
    /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/g),
  rule('slack-token', 'Slack token (xox...)',
    /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, { allowPlaceholder: true }),
  rule('aws-access-key-id', 'AWS access key id (AKIA/ASIA...)',
    /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g),
  rule('meta-graph-token', 'Meta / Facebook Graph API access token (EAA...)',
    /\bEAA[A-Za-z0-9]{40,}\b/g),
  rule('resend-api-key', 'Resend API key (re_xxxxxxxx_...)',
    /\bre_[A-Za-z0-9]{6,}_[A-Za-z0-9]{16,}\b/g, { allowPlaceholder: true }),
  rule('stripe-secret-key', 'Stripe secret / restricted key',
    /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}\b/g, { allowPlaceholder: true }),
  rule('generic-secret-assignment', 'High-entropy literal assigned to a secret-like name',
    /\b[A-Za-z0-9_]*(?:api[_-]?key|apikey|secret|token|password|passwd|auth[_-]?token|access[_-]?token|client[_-]?secret|private[_-]?key)[A-Za-z0-9_]*\s*[:=]\s*["'`]([A-Za-z0-9+/=_.-]{20,})["'`]/gi,
    { valueGroups: [1], allowPlaceholder: true, requireRandom: true }),
]);

const OVERLAP_LOSERS = new Set(['jwt-fragment', 'generic-secret-assignment']);

function pickValue(ruleDef, match) {
  for (const group of ruleDef.valueGroups) {
    if (typeof match[group] === 'string' && match[group].length > 0) return match[group];
  }
  return match[0];
}

function lineStartsOf(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

function locate(lineStarts, index) {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, column: index - lineStarts[lo] + 1 };
}

function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

/**
 * Scans a text and returns findings. The matched value is intentionally not part of the result.
 * @param {string} text
 * @param {string} file
 * @param {'index' | 'worktree' | 'both'} [source]
 * @returns {Finding[]}
 */
export function scanText(text, file, source = 'worktree') {
  /** @type {Array<Finding & { start: number, end: number }>} */
  const raw = [];
  const lineStarts = lineStartsOf(text);
  for (const ruleDef of RULES) {
    const pattern = new RegExp(ruleDef.pattern.source, ruleDef.pattern.flags);
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[0].length === 0) {
        pattern.lastIndex += 1;
        continue;
      }
      const value = pickValue(ruleDef, match);
      if (ruleDef.allowPlaceholder && isPlaceholder(value)) continue;
      if (ruleDef.requireRandom && !looksRandom(value)) continue;
      const { line, column } = locate(lineStarts, match.index);
      raw.push({ ruleId: ruleDef.id, file, line, column, source, start: match.index, end: match.index + match[0].length });
    }
  }
  const kept = raw.filter((finding) =>
    !OVERLAP_LOSERS.has(finding.ruleId) ||
    !raw.some((other) => other !== finding && !OVERLAP_LOSERS.has(other.ruleId) && overlaps(finding, other)));
  kept.sort((a, b) => a.start - b.start || a.ruleId.localeCompare(b.ruleId));
  return kept.map(({ ruleId, file: f, line, column, source: s }) => ({ ruleId, file: f, line, column, source: s }));
}

// ─── Git access ──────────────────────────────────────────────────────────────

/**
 * Lists index entries: { path, oid, mode }. Throws when `root` is not inside a Git repository.
 * @param {string} root
 */
export function listIndexEntries(root) {
  const output = execFileSync('git', ['-C', root, 'ls-files', '-s', '-z'], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const entries = [];
  for (const record of output.split('\0')) {
    if (!record) continue;
    const tab = record.indexOf('\t');
    const [mode, oid] = record.slice(0, tab).split(' ');
    entries.push({ path: record.slice(tab + 1), oid, mode });
  }
  return entries;
}

/** Lists Git-tracked paths (repo-relative). */
export function listTrackedFiles(root) {
  return listIndexEntries(root).map((entry) => entry.path);
}

/**
 * Reads index blobs in one `git cat-file --batch` call.
 * @param {string} root
 * @param {string[]} oids
 * @returns {Map<string, Buffer>}
 */
export function readIndexBlobs(root, oids) {
  const blobs = new Map();
  if (oids.length === 0) return blobs;
  const result = spawnSync('git', ['-C', root, 'cat-file', '--batch'], {
    input: `${oids.join('\n')}\n`,
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error('git cat-file --batch failed');
  const out = result.stdout;
  let offset = 0;
  while (offset < out.length) {
    const newline = out.indexOf(10, offset);
    if (newline < 0) break;
    const header = out.subarray(offset, newline).toString('utf8');
    offset = newline + 1;
    const [oid, type, sizeText] = header.split(' ');
    if (type === 'missing' || type === undefined) continue;
    const size = Number(sizeText);
    blobs.set(oid, out.subarray(offset, offset + size));
    offset += size + 1; // trailing newline after content
  }
  return blobs;
}

function gitBlobOid(buffer) {
  return createHash('sha1').update(`blob ${buffer.length}\0`).update(buffer).digest('hex');
}

function looksBinary(buffer, path) {
  if (BINARY_EXTENSIONS.has(extname(path).toLowerCase())) return true;
  return buffer.subarray(0, 8000).includes(0);
}

function toPosix(path) {
  return path.split(sep).join('/');
}

// ─── Working-tree containment (no symlink is ever dereferenced) ──────────────

/** True when `candidate` (an absolute, resolved path) is `canonicalRoot` or lies beneath it. */
export function isInsideRoot(canonicalRoot, candidate) {
  const rel = relative(canonicalRoot, candidate);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}

/**
 * Locates a tracked path inside the working tree without following any symlink.
 *  - Every intermediate component is inspected with lstat. A symlinked directory
 *    (wherever it points) or a traversal component is `unsafe`: nothing beneath it is read.
 *  - The parent directory is then independently resolved and must remain inside the
 *    canonical root.
 *  - A final symlink yields only its link-path text (`readlink`), never the target.
 *  - Only a regular file reached this way may be opened, and only with O_NOFOLLOW.
 * @param {string} canonicalRoot  realpath of the repository root
 * @param {string} relPath        repo-relative path as listed by Git
 * @returns {WorktreeLocation}
 */
export function locateWorktreeEntry(canonicalRoot, relPath) {
  // Git always reports repository-relative paths with "/" separators; a backslash is
  // an ordinary character of a POSIX filename and must not be reinterpreted.
  const parts = relPath.split('/').filter((part) => part.length > 0);
  if (parts.length === 0 || parts.some((part) => part === '.' || part === '..')) {
    return { kind: 'unsafe', reason: 'path contains a traversal component' };
  }
  let parent = canonicalRoot;
  for (const part of parts.slice(0, -1)) {
    parent = join(parent, part);
    let stats;
    try {
      stats = lstatSync(parent);
    } catch {
      return { kind: 'missing' };
    }
    if (stats.isSymbolicLink()) {
      return { kind: 'unsafe', reason: 'an intermediate directory is a symlink; the working-tree copy was not read' };
    }
    if (!stats.isDirectory()) return { kind: 'missing' };
  }
  let parentReal;
  try {
    parentReal = realpathSync(parent);
  } catch {
    return { kind: 'missing' };
  }
  if (!isInsideRoot(canonicalRoot, parentReal)) {
    return { kind: 'unsafe', reason: 'parent directory resolves outside the repository root' };
  }
  const target = join(parent, parts[parts.length - 1]);
  let stats;
  try {
    stats = lstatSync(target);
  } catch {
    return { kind: 'missing' };
  }
  if (stats.isSymbolicLink()) {
    try {
      return { kind: 'symlink', linkText: readlinkSync(target, 'utf8') };
    } catch {
      return { kind: 'unsafe', reason: 'symlink could not be inspected' };
    }
  }
  if (!stats.isFile()) return { kind: 'missing' };
  if (!isInsideRoot(canonicalRoot, target)) {
    return { kind: 'unsafe', reason: 'file resolves outside the repository root' };
  }
  return { kind: 'file', path: target, size: stats.size };
}

/** Reads a regular file that was just lstat-verified, refusing to follow a symlink raced into its place. */
function readRegularFileNoFollow(path) {
  const flags = fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0);
  const fd = openSync(path, flags);
  try {
    return readFileSync(fd);
  } finally {
    closeSync(fd);
  }
}

// ─── Repository scan ─────────────────────────────────────────────────────────

/**
 * Scans the given index entries under `root`, reading index blobs and working-tree files.
 * The working tree is only ever read inside the canonical (realpath) root and no symlink
 * is dereferenced: a final symlink contributes its link-path text, an unsafe path is a
 * fail-closed problem.
 * @param {Array<{ path: string, oid: string, mode: string }>} entries
 * @param {{ root?: string, maxFileBytes?: number }} [options]
 * @returns {ScanResult}
 */
export function scanEntries(entries, { root = process.cwd(), maxFileBytes = DEFAULT_MAX_FILE_BYTES } = {}) {
  /** @type {ScanResult} */
  const result = {
    findings: [],
    totalPaths: entries.length,
    scannedFiles: 0,
    scannedBlobs: 0,
    scannedSymlinks: 0,
    skippedBinary: 0,
    skippedSubmodules: 0,
    missingWorktree: 0,
    problems: [],
  };
  const canonicalRoot = realpathSync(resolve(root));
  const regular = entries.filter((entry) => entry.mode !== '160000');
  result.skippedSubmodules = entries.length - regular.length;
  const blobs = readIndexBlobs(canonicalRoot, regular.map((entry) => entry.oid));

  for (const entry of regular) {
    const file = toPosix(entry.path);
    const indexBlob = blobs.get(entry.oid);
    let worktree = null;
    let worktreeIsSymlink = false;
    const located = locateWorktreeEntry(canonicalRoot, entry.path);
    if (located.kind === 'unsafe') {
      result.problems.push(`${file}: refused to read the working-tree copy (${located.reason})`);
      continue;
    }
    if (located.kind === 'symlink') {
      worktree = Buffer.from(located.linkText, 'utf8');
      worktreeIsSymlink = true;
    } else if (located.kind === 'file') {
      if (located.size > maxFileBytes) {
        result.problems.push(`${file}: working-tree file exceeds the ${maxFileBytes}-byte ceiling and was not scanned`);
        continue;
      }
      try {
        worktree = readRegularFileNoFollow(located.path);
      } catch (error) {
        const code = error && typeof error.code === 'string' ? error.code : 'unknown error';
        if (code === 'ELOOP') {
          result.problems.push(`${file}: refused to read the working-tree copy (became a symlink)`);
          continue;
        }
        if (code === 'ENOENT') {
          // Deleted between lstat and open: genuinely missing, the index copy is still scanned.
          result.missingWorktree += 1;
        } else {
          // Exists but unreadable (EACCES, EPERM, EIO, ...): never fall back to the index copy.
          result.problems.push(`${file}: working-tree file could not be read (${code}); the index copy alone is not trusted`);
          continue;
        }
      }
    } else {
      result.missingWorktree += 1;
    }
    if (indexBlob === undefined && worktree === null) {
      result.problems.push(`${file}: tracked file could not be read from the index or the working tree`);
      continue;
    }
    if (indexBlob !== undefined && indexBlob.length > maxFileBytes) {
      result.problems.push(`${file}: index blob exceeds the ${maxFileBytes}-byte ceiling and was not scanned`);
      continue;
    }

    // Symlink entries hold link-path text: their name's extension says nothing about the content.
    const binaryName = worktreeIsSymlink || entry.mode === '120000' ? '' : entry.path;
    const sample = worktree ?? indexBlob;
    if (looksBinary(sample, binaryName) && (indexBlob === undefined || looksBinary(indexBlob, binaryName))) {
      result.skippedBinary += 1;
      continue;
    }
    if (worktreeIsSymlink) result.scannedSymlinks += 1;

    const sameContent = indexBlob !== undefined && worktree !== null &&
      (indexBlob.equals(worktree) || (entry.oid.length === 40 && gitBlobOid(worktree) === entry.oid));

    if (sameContent) {
      result.scannedFiles += 1;
      result.scannedBlobs += 1;
      result.findings.push(...scanText(worktree.toString('utf8'), file, 'both'));
      continue;
    }
    if (worktree !== null && !looksBinary(worktree, binaryName)) {
      result.scannedFiles += 1;
      result.findings.push(...scanText(worktree.toString('utf8'), file, 'worktree'));
    }
    if (indexBlob !== undefined && !looksBinary(indexBlob, binaryName)) {
      result.scannedBlobs += 1;
      result.findings.push(...scanText(indexBlob.toString('utf8'), file, 'index'));
    }
  }
  return result;
}

/**
 * Scans all tracked paths of the repository at `root` (index + working tree).
 * Throws when nothing trustworthy can be scanned or when a tracked text file could not be inspected.
 * @param {{ root?: string, maxFileBytes?: number }} [options]
 * @returns {ScanResult}
 */
export function scanRepository({ root = process.cwd(), maxFileBytes = DEFAULT_MAX_FILE_BYTES } = {}) {
  const entries = listIndexEntries(root);
  if (entries.length === 0) {
    throw new Error('git ls-files returned zero tracked paths; refusing to report a vacuous pass');
  }
  const result = scanEntries(entries, { root, maxFileBytes });
  if (result.scannedFiles === 0 && result.scannedBlobs === 0) {
    throw new Error('zero text files were scanned; refusing to report a vacuous pass');
  }
  if (result.problems.length > 0) {
    throw new Error(`refusing to report a result: ${result.problems.join('; ')}`);
  }
  return result;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const options = { json: false, root: process.cwd(), maxFileBytes: DEFAULT_MAX_FILE_BYTES };
  const envCeiling = Number(process.env.CREDENTIAL_GUARD_MAX_FILE_BYTES ?? '');
  if (Number.isFinite(envCeiling) && envCeiling > 0) options.maxFileBytes = envCeiling;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--root') options.root = resolve(argv[++i] ?? '.');
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

export function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`credential-guard: ${error.message}\n`);
    return 2;
  }
  let result;
  try {
    result = scanRepository(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.json) process.stdout.write(`${JSON.stringify({ ok: false, error: message })}\n`);
    else process.stderr.write(`credential-guard: cannot scan — ${message}\n`);
    return 2;
  }
  const failed = result.findings.length > 0;
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ ok: !failed, ...result })}\n`);
    return failed ? 1 : 0;
  }
  const summary = `CASA credential guard — ${result.totalPaths} tracked paths: ${result.scannedFiles} working-tree files and ` +
    `${result.scannedBlobs} index blobs scanned (${result.scannedSymlinks} symlinks scanned as link text only, ` +
    `${result.skippedBinary} binary skipped, ${result.missingWorktree} missing from working tree but scanned from index, ` +
    `${result.skippedSubmodules} submodules)`;
  if (!failed) {
    process.stdout.write(`${summary}\nOK — no credential-shaped literals found.\n`);
    return 0;
  }
  const lines = result.findings.map((f) =>
    `  ${f.ruleId.padEnd(34)} ${f.file}:${f.line}:${f.column}${f.source === 'both' ? '' : ` [${f.source}]`}`);
  process.stdout.write(`${summary}\nFAIL — ${result.findings.length} credential-shaped literal(s):\n${lines.join('\n')}\n` +
    'Matched values are never printed. Remove each literal (from the index AND the working tree), load it from the ' +
    'environment, and rotate the credential if it was ever real.\n');
  return 1;
}

/**
 * True only when this module file IS the script Node was asked to run.
 *
 * Node canonicalises the ESM entry point (import.meta.url is the realpath) while
 * process.argv[1] keeps whatever alias the caller typed, so a plain string
 * comparison of the two fails whenever the guard is reached through a symlinked
 * or otherwise noncanonical directory (e.g. macOS /var → /private/var) — and a
 * failed comparison meant main() never ran and the process exited 0 in silence.
 * Both sides are therefore reduced to their canonical filesystem identity:
 * realpath first, then device+inode as a second, independent proof. Any
 * resolution failure yields false, i.e. "imported as a module", never a run.
 */
export function isDirectInvocation(argv1 = process.argv[1], moduleUrl = import.meta.url) {
  if (typeof argv1 !== 'string' || argv1.length === 0) return false;
  let entryPath;
  let selfPath;
  try {
    entryPath = realpathSync(resolve(argv1));
    selfPath = realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
  if (entryPath === selfPath) return true;
  try {
    const entry = statSync(entryPath);
    const self = statSync(selfPath);
    return entry.isFile() && self.isFile() && entry.dev === self.dev && entry.ino === self.ino;
  } catch {
    return false;
  }
}

if (isDirectInvocation()) {
  process.exit(main());
}
