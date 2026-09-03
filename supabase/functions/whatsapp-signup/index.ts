/**
 * whatsapp-signup — production entrypoint (intentionally public, see handler.ts).
 *
 * Reads env vars, builds the Resend sender, and starts the HTTP server. All
 * request logic and abuse protection live in `handler.ts`.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

import { createHandler, type OutgoingEmail } from "./handler.ts";

const DESTINATION_EMAIL = "brentcurtis76@gmail.com";

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

serve(createHandler({ sendEmail }));
