/**
 * CASA Process Reflexion PDF Edge Function
 * Extrae texto de un PDF de reflexión y genera un resumen temático
 * usando Claude API con soporte nativo para documentos PDF.
 *
 * This file is the production entrypoint: it reads env vars, builds
 * dependencies, and starts the HTTP server. All request logic lives in
 * `handler.ts` so tests can import the handler without side effects.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

import { createSupabaseAuthzDeps } from "../_shared/liturgyAuth.ts";
import { createHandler } from "./handler.ts";

const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const authzDeps = createSupabaseAuthzDeps(supabaseAdmin);

serve(createHandler({ anthropicApiKey, authzDeps }));
