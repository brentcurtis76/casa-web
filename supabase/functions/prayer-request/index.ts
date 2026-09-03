/**
 * prayer-request — production entrypoint.
 *
 * Reads env vars, builds the Resend sender and the Supabase authz backend, and
 * starts the HTTP server. All request logic lives in `handler.ts` so tests can
 * import it without side effects.
 */

import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "npm:resend@2.0.0";

import { createSupabaseAuthzDeps } from "../_shared/liturgyAuth.ts";
import { createHandler, type OutgoingEmail } from "./handler.ts";

const DESTINATION_EMAIL = "brentcurtis76@gmail.com";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const authzDeps = createSupabaseAuthzDeps(supabaseAdmin);

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const sendEmail = resend
  ? async ({ subject, html }: OutgoingEmail) => {
    const { error } = await resend.emails.send({
      from: "Anglicana San Andrés <onboarding@resend.dev>",
      to: [DESTINATION_EMAIL],
      subject,
      html,
    });
    return { error: error ?? null };
  }
  : null;

serve(createHandler({ authzDeps, sendEmail }));
