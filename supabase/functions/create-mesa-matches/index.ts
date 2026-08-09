/**
 * CASA La Mesa Abierta — create-mesa-matches Edge Function.
 *
 * This file is the production entrypoint: it reads env vars, builds
 * dependencies, and starts the HTTP server. All request logic lives in
 * `handler.ts` so tests can import the handler without side effects.
 */

import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

import { createHandler } from "./handler.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

serve(createHandler({ supabase }));
