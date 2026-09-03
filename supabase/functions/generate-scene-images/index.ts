/**
 * CASA Scene Image Generator Edge Function
 * Genera imágenes para escenas de cuentos usando la familia Gemini Image:
 *  - flash (default): gemini-3.1-flash-image (Nano Banana 2) — borradores/escenas
 *  - pro: gemini-3-pro-image (Nano Banana Pro) — portada/fin/refinamientos
 *
 * This file is the production entrypoint: it reads env vars, builds
 * dependencies, and starts the HTTP server. All request logic lives in
 * `handler.ts` so tests can import the handler without side effects.
 */

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';

import { createSupabaseAuthzDeps } from '../_shared/liturgyAuth.ts';
import { assertCasaProject } from '../_shared/projectBinding.ts';
import { createHandler } from './handler.ts';

const apiKey = Deno.env.get('GOOGLE_AI_API_KEY') ?? '';
// Overrides por env var para poder cambiar de modelo sin redesplegar clientes
const flashModel = Deno.env.get('GEMINI_IMAGE_MODEL_FLASH') ?? 'gemini-3.1-flash-image';
const proModel = Deno.env.get('GEMINI_IMAGE_MODEL_PRO') ?? 'gemini-3-pro-image';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
// CASA project binding: refuse to boot on any other project (or an unset URL)
// before a client is built or the server starts. See _shared/projectBinding.ts.
assertCasaProject(supabaseUrl, 'generate-scene-images');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const authzDeps = createSupabaseAuthzDeps(supabaseAdmin);

serve(createHandler({ apiKey, flashModel, proModel, authzDeps, supabaseUrl }));
