/**
 * Vite plugin: build/start-time enforcement of the CASA browser Supabase policy.
 *
 * Runs in the `config` hook, i.e. during config resolution, before Vite starts
 * the dev server or the Rollup build. A misconfigured environment (missing
 * variables, wrong or FNE project, service_role / sb_secret_ / sbp_ key, unknown
 * JWT role, malformed JWT, arbitrary format) throws, so `vite dev` and
 * `vite build` abort before any browser asset is transformed or emitted.
 * The error names the variable and the reason; it never prints a value.
 *
 * The plugin object is typed structurally (no import from 'vite') so it can be
 * unit-tested offline with Deno.
 */
import {
  SupabaseConfigError,
  assertBrowserSupabaseEnv,
  type SupabaseBrowserEnv,
} from '../../src/integrations/supabase/config.ts';

export interface ConfigHookEnv {
  readonly command: 'build' | 'serve';
  readonly mode: string;
}

export interface SupabaseEnvGuardPlugin {
  readonly name: string;
  readonly enforce: 'pre';
  config(userConfig: unknown, hookEnv: ConfigHookEnv): void;
}

export const PLUGIN_NAME = 'casa-supabase-browser-env-guard';

export class ViteEnvGuardError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ViteEnvGuardError';
    this.code = code;
  }
}

/**
 * @param env  Environment as loaded by Vite (`loadEnv(mode, root, 'VITE_')`, which
 *             merges .env* files with process.env). Only the two VITE_SUPABASE_*
 *             entries are read; nothing is logged.
 */
export function supabaseBrowserEnvGuard(env: Record<string, string | undefined>): SupabaseEnvGuardPlugin {
  const browserEnv: SupabaseBrowserEnv = {
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY,
  };
  return {
    name: PLUGIN_NAME,
    enforce: 'pre',
    config(_userConfig: unknown, hookEnv: ConfigHookEnv): void {
      try {
        assertBrowserSupabaseEnv(browserEnv, { mode: hookEnv.mode });
      } catch (error) {
        if (error instanceof SupabaseConfigError) {
          throw new ViteEnvGuardError(
            error.code,
            `[${PLUGIN_NAME}] ${hookEnv.command} aborted before bundling (mode "${hookEnv.mode}"): ${error.message}`,
          );
        }
        throw error;
      }
    },
  };
}
