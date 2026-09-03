/**
 * Supabase browser client.
 *
 * Configuration comes exclusively from Vite environment variables
 * (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). The same policy in ./config.ts
 * is enforced at build/start time by vite.config.ts (so a privileged key or a
 * wrong project can never be bundled) and re-checked here at runtime as
 * defense in depth. No URL or key is committed in this repository.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types.ts';
import { resolveSupabaseBrowserConfig } from './config.ts';

const { url, anonKey } = resolveSupabaseBrowserConfig(import.meta.env);

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(url, anonKey);
