/**
 * fetch-bible-passage — production entrypoint.
 *
 * Reads env vars, builds the Supabase authz backend (service-role client used
 * ONLY to verify the caller's JWT and evaluate `has_permission`), and starts the
 * HTTP server. All request logic lives in `handler.ts` so tests can import it
 * without side effects. Documentación del proveedor: https://bolls.life/api/
 */

import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

import { createSupabaseAuthzDeps } from "../_shared/liturgyAuth.ts";
import { createHandler } from "./handler.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const authzDeps = createSupabaseAuthzDeps(supabaseAdmin);

serve(createHandler({ authzDeps }));
