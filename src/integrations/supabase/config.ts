/**
 * Browser-side Supabase configuration policy (CASA).
 *
 * Used in two places with the same rules:
 *   1. BUILD/START TIME — vite.config.ts runs `assertBrowserSupabaseEnv()` in a
 *      `config` hook (scripts/security/vite-supabase-env-guard.ts) before Vite
 *      transforms or emits any browser asset. `vite dev` and `vite build` abort
 *      when the environment is missing, points at the wrong project, or holds a
 *      privileged key, so a secret can never be bundled. EVERY `vite build`
 *      (whatever `--mode` says: production, staging, development, ...) also
 *      refuses a local Supabase URL; only the dev server (`serve`) may use it.
 *   2. RUNTIME — src/integrations/supabase/client.ts re-validates with
 *      `resolveSupabaseBrowserConfig()` as defense in depth.
 *
 * Policy:
 *   - VITE_SUPABASE_URL must be exactly the hosted CASA project URL or one of the
 *     explicitly supported local Supabase URLs. FNE and every other hosted project
 *     are rejected. A local URL is rejected for any build command and for
 *     production mode; it is accepted for the development server and at runtime.
 *   - VITE_SUPABASE_ANON_KEY must be a legacy anon JWT that belongs to CASA (or to
 *     the local demo stack when a local URL is used) or an `sb_publishable_*` key.
 *     service_role JWTs, `sb_secret_*`, `sbp_*`, unknown roles, malformed
 *     JWT-shaped values and arbitrary formats are rejected.
 *   - Error messages name the variable and the reason. They never echo a value.
 *
 * No imports: this module is shared by the browser bundle, the Vite config
 * (Node) and offline Deno tests.
 */

export const CASA_PROJECT_REF = 'mulsqxfhxxdsadxsljss';
export const CASA_SUPABASE_URL = `https://${CASA_PROJECT_REF}.supabase.co`;

/** Project refs that must be refused explicitly (unrelated FNE project). */
export const FORBIDDEN_PROJECT_REFS: readonly string[] = ['sxlogxqzmarhqsblxmtj'];

/** Local `supabase start` API URLs that are explicitly supported. */
export const LOCAL_SUPABASE_URLS: readonly string[] = [
  'http://127.0.0.1:54321',
  'http://localhost:54321',
];

export const SUPABASE_URL_ENV = 'VITE_SUPABASE_URL';
export const SUPABASE_ANON_KEY_ENV = 'VITE_SUPABASE_ANON_KEY';

export type SupabaseTarget = 'casa' | 'local';

export interface SupabaseBrowserEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

export interface SupabaseBrowserConfig {
  readonly url: string;
  readonly anonKey: string;
  readonly target: SupabaseTarget;
}

export type SupabaseConfigErrorCode =
  | 'missing'
  | 'url-invalid'
  | 'url-forbidden-project'
  | 'url-other-project'
  | 'url-not-allowed'
  | 'url-local-in-build'
  | 'url-local-in-production'
  | 'key-secret'
  | 'key-access-token'
  | 'key-service-role'
  | 'key-unknown-role'
  | 'key-malformed-jwt'
  | 'key-other-project'
  | 'key-unsupported-format';

export class SupabaseConfigError extends Error {
  readonly code: SupabaseConfigErrorCode;

  constructor(code: SupabaseConfigErrorCode, message: string) {
    super(message);
    this.name = 'SupabaseConfigError';
    this.code = code;
  }
}

const MAX_VALUE_LENGTH = 4096;
const JWT_SEGMENT = /^[A-Za-z0-9_-]+$/;
const PUBLISHABLE_KEY = /^sb_publishable_[A-Za-z0-9_-]{10,}$/;

function readRequired(env: SupabaseBrowserEnv, name: keyof SupabaseBrowserEnv): string {
  const raw = env[name];
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) {
    throw new SupabaseConfigError(
      'missing',
      `Falta la variable de entorno ${name}. Defínela en .env.local (desarrollo) o en las ` +
        'variables de entorno de Vercel (Preview / Production). Ver .env.example.',
    );
  }
  if (value.length > MAX_VALUE_LENGTH || /\s/.test(value)) {
    throw new SupabaseConfigError('missing', `La variable de entorno ${name} tiene un formato inválido.`);
  }
  return value;
}

function projectRefOfHost(hostname: string): string | undefined {
  const match = /^([a-z0-9]{20})\.supabase\.co$/i.exec(hostname);
  return match ? match[1].toLowerCase() : undefined;
}

/** Validates the URL against the exact CASA / local allowlist. Never echoes the value. */
export function validateSupabaseUrl(rawUrl: string): { url: string; target: SupabaseTarget } {
  const url = rawUrl.trim().replace(/\/+$/, '');
  if (url === CASA_SUPABASE_URL) return { url, target: 'casa' };
  if (LOCAL_SUPABASE_URLS.includes(url)) return { url, target: 'local' };

  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    throw new SupabaseConfigError('url-invalid', `${SUPABASE_URL_ENV} no es una URL válida.`);
  }
  const ref = projectRefOfHost(hostname);
  if (ref && FORBIDDEN_PROJECT_REFS.includes(ref)) {
    throw new SupabaseConfigError(
      'url-forbidden-project',
      `${SUPABASE_URL_ENV} apunta al proyecto FNE. Este sitio solo puede usar el proyecto Supabase de CASA.`,
    );
  }
  if (ref === CASA_PROJECT_REF) {
    throw new SupabaseConfigError(
      'url-not-allowed',
      `${SUPABASE_URL_ENV} debe ser exactamente ${CASA_SUPABASE_URL} (sin rutas, con https).`,
    );
  }
  if (ref) {
    throw new SupabaseConfigError(
      'url-other-project',
      `${SUPABASE_URL_ENV} apunta a un proyecto Supabase distinto de CASA. Solo se permite ${CASA_SUPABASE_URL}.`,
    );
  }
  throw new SupabaseConfigError(
    'url-not-allowed',
    `${SUPABASE_URL_ENV} no está permitida. Usa ${CASA_SUPABASE_URL} o una URL local soportada (${LOCAL_SUPABASE_URLS.join(', ')}).`,
  );
}

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return globalThis.atob(padded);
}

interface JwtClaims {
  readonly role?: string;
  readonly ref?: string;
  readonly iss?: string;
}

function isJwtShaped(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 3 && parts.every((part) => part.length > 0 && JWT_SEGMENT.test(part));
}

/** Decodes the claims of a JWT-shaped value; returns null when the payload is not valid JSON. */
export function readJwtClaims(value: string): JwtClaims | null {
  if (!isJwtShaped(value)) return null;
  try {
    const payload: unknown = JSON.parse(decodeBase64Url(value.split('.')[1]));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const record = payload as Record<string, unknown>;
    return {
      role: typeof record.role === 'string' ? record.role : undefined,
      ref: typeof record.ref === 'string' ? record.ref : undefined,
      iss: typeof record.iss === 'string' ? record.iss : undefined,
    };
  } catch {
    return null;
  }
}

/** Returns the `role` claim of a JWT-shaped key, or undefined when it is not a decodable JWT. */
export function readJwtRole(key: string): string | undefined {
  return readJwtClaims(key)?.role;
}

/**
 * Validates that a key may be shipped to browsers for the given target.
 * Accepts only a CASA (or local demo) anon JWT or an sb_publishable_* key.
 */
export function validateBrowserKey(rawKey: string, target: SupabaseTarget): string {
  const key = rawKey.trim();
  const name = SUPABASE_ANON_KEY_ENV;

  if (key.startsWith('sb_secret_')) {
    throw new SupabaseConfigError(
      'key-secret',
      `${name} contiene una clave secreta (sb_secret_). Solo la clave anon/publishable puede usarse en el navegador.`,
    );
  }
  if (key.startsWith('sbp_')) {
    throw new SupabaseConfigError(
      'key-access-token',
      `${name} contiene un token de acceso personal de Supabase (sbp_). Nunca lo expongas en el navegador.`,
    );
  }
  if (PUBLISHABLE_KEY.test(key)) return key;

  if (isJwtShaped(key)) {
    const claims = readJwtClaims(key);
    if (!claims) {
      throw new SupabaseConfigError('key-malformed-jwt', `${name} tiene forma de JWT pero no se puede decodificar.`);
    }
    if (claims.role === 'service_role') {
      throw new SupabaseConfigError(
        'key-service-role',
        `${name} contiene una clave service_role. Nunca expongas credenciales privilegiadas en el navegador.`,
      );
    }
    if (claims.role !== 'anon') {
      throw new SupabaseConfigError('key-unknown-role', `${name} contiene un JWT con un rol no permitido para el navegador.`);
    }
    if (target === 'casa') {
      if (claims.ref !== CASA_PROJECT_REF) {
        throw new SupabaseConfigError(
          'key-other-project',
          `${name} es una clave anon de otro proyecto Supabase; se requiere la clave anon del proyecto CASA.`,
        );
      }
      return key;
    }
    // Local stack: the demo anon key carries iss "supabase-demo" and no ref. A CASA anon key is also tolerated.
    if (claims.ref === undefined || claims.ref === CASA_PROJECT_REF) return key;
    throw new SupabaseConfigError('key-other-project', `${name} es una clave anon de otro proyecto Supabase.`);
  }

  throw new SupabaseConfigError(
    'key-unsupported-format',
    `${name} no tiene un formato soportado (se espera una clave anon JWT de CASA o una clave sb_publishable_).`,
  );
}

export interface ValidateOptions {
  /**
   * Vite command. `build` refuses local Supabase URLs regardless of the mode
   * name (`vite build --mode staging|development|...` included); `serve` (the
   * development server) may use the local stack.
   */
  readonly command?: 'build' | 'serve';
  /** Vite mode. Local Supabase URLs are additionally refused in production mode. */
  readonly mode?: string;
}

/**
 * Resolves and validates the browser configuration. Throws SupabaseConfigError
 * (never echoing a value) when misconfigured.
 */
export function resolveSupabaseBrowserConfig(
  env: SupabaseBrowserEnv,
  options: ValidateOptions = {},
): SupabaseBrowserConfig {
  const rawUrl = readRequired(env, SUPABASE_URL_ENV);
  const rawKey = readRequired(env, SUPABASE_ANON_KEY_ENV);
  const { url, target } = validateSupabaseUrl(rawUrl);
  if (target === 'local' && options.command === 'build') {
    throw new SupabaseConfigError(
      'url-local-in-build',
      `${SUPABASE_URL_ENV} apunta a una instancia local; ningún \`vite build\` puede empaquetar contra Supabase local, ` +
        'sea cual sea el modo (production, staging, development, ...). Solo el servidor de desarrollo puede usarla.',
    );
  }
  if (target === 'local' && options.mode === 'production') {
    throw new SupabaseConfigError(
      'url-local-in-production',
      `${SUPABASE_URL_ENV} apunta a una instancia local; no está permitido en modo production.`,
    );
  }
  const anonKey = validateBrowserKey(rawKey, target);
  return { url, anonKey, target };
}

/** Build/start-time entry point used by the Vite guard. Same policy, same error type. */
export function assertBrowserSupabaseEnv(env: SupabaseBrowserEnv, options: ValidateOptions = {}): SupabaseBrowserConfig {
  return resolveSupabaseBrowserConfig(env, options);
}
