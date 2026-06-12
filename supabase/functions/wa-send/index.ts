// wa-send — internal sender for WhatsApp utility templates.
// Caller passes recipientType/recipientId; this function gates by opt-in
// and suppression, normalizes phone, sends the template, and writes a
// music_notification_logs row (for musician recipients only).
// Deployed with verify_jwt = true (default): the platform validates the
// caller's JWT before this code runs.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  loadGraphCreds,
  makeServiceClient,
  sendWhatsAppOne,
  type SendInput,
} from "../_shared/whatsapp/send-core.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Authorization required" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  let input: SendInput;
  try {
    input = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  if (
    !input ||
    (input.recipientType !== "musician" && input.recipientType !== "children_volunteer") ||
    !input.recipientId ||
    !input.templateName ||
    !input.notificationType ||
    !Array.isArray(input.variables)
  ) {
    return new Response(JSON.stringify({ error: "missing/invalid fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const creds = loadGraphCreds();
  if ("error" in creds) {
    return new Response(JSON.stringify({ sent: false, fallback: "email", reason: creds.error }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const supabase = makeServiceClient();

  try {
    const outcome = await sendWhatsAppOne(supabase, creds, input);
    return new Response(JSON.stringify(outcome), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "error desconocido";
    return new Response(
      JSON.stringify({ sent: false, fallback: "email", reason }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS },
      },
    );
  }
});
