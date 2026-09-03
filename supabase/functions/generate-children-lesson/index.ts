/**
 * generate-children-lesson — production entrypoint.
 *
 * Reads env vars, builds the Supabase authz backend, and starts the HTTP
 * server. All request logic lives in `handler.ts` so tests can import the
 * handler without side effects.
 */

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';

import { createSupabaseAuthzDeps } from '../_shared/liturgyAuth.ts';
import { createHandler } from './handler.ts';

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const authzDeps = createSupabaseAuthzDeps(supabaseAdmin);

serve(createHandler({ anthropicApiKey, authzDeps }));
