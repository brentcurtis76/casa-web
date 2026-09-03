/// <reference types="vite/client" />

/**
 * Browser-side Supabase configuration. Both fields are optional here because
 * their presence and validity are enforced by src/integrations/supabase/config.ts
 * (at build time via vite.config.ts and at runtime via client.ts); the type only
 * documents which VITE_ variables this app reads.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

declare const __APP_VERSION__: string;
