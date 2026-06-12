// WhatsApp Cloud API webhook receiver.
// GET = subscription handshake. POST = signed payloads (messages + statuses).
// verify_jwt must be false for this function (public-facing).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { verifyMetaSignature } from "../_shared/whatsapp/signature.ts";
import { isOptOutMessage, parsePayload, type ParsedPayload } from "../_shared/whatsapp/payload.ts";
import { sendText } from "../_shared/whatsapp/graph.ts";

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";
const APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";

function getCreds() {
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!accessToken || !phoneNumberId) return null;
  return { accessToken, phoneNumberId };
}

function makeSupabase(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function handleVerification(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

async function applyAssignmentUpdate(
  supabase: SupabaseClient,
  parsed: ParsedPayload,
): Promise<void> {
  const confirmed = parsed.action === "confirm";
  const now = new Date().toISOString();

  if (parsed.domain === "music") {
    await supabase
      .from("music_service_assignments")
      .update({ confirmed, confirmed_at: now })
      .eq("id", parsed.id);
    return;
  }
  if (parsed.domain === "children") {
    await supabase
      .from("church_children_session_assignments")
      .update({ status: confirmed ? "confirmed" : "declined" })
      .eq("id", parsed.id);
    return;
  }
  if (parsed.domain === "rehearsal") {
    await supabase
      .from("music_rehearsal_attendees")
      .update({ rsvp_status: confirmed ? "accepted" : "declined" })
      .eq("id", parsed.id);
  }
}

async function suppressByPhone(
  supabase: SupabaseClient,
  rawPhone: string,
): Promise<void> {
  // The webhook 'from' arrives as digits only (e.g. "56912345678").
  // We try a few likely stored shapes: as-is, with leading +, with spaces.
  const digits = rawPhone.replace(/[^\d]/g, "");
  const candidates = new Set<string>([
    digits,
    `+${digits}`,
    digits.startsWith("56") ? digits.slice(2) : digits,
  ]);

  // Pull all musicians/volunteers and match by normalized digits (cheap — pilot scale).
  const norm = (p: string | null | undefined) =>
    p ? p.replace(/[^\d]/g, "") : "";

  const { data: musicians } = await supabase
    .from("music_musicians")
    .select("id, phone");
  for (const m of musicians || []) {
    if (norm(m.phone) === digits || candidates.has(m.phone ?? "")) {
      await supabase
        .from("music_musicians")
        .update({ whatsapp_suppressed: true })
        .eq("id", m.id);
    }
  }

  const { data: vols } = await supabase
    .from("church_children_volunteers")
    .select("id, phone");
  for (const v of vols || []) {
    if (norm(v.phone) === digits || candidates.has(v.phone ?? "")) {
      await supabase
        .from("church_children_volunteers")
        .update({ whatsapp_suppressed: true })
        .eq("id", v.id);
    }
  }
}

async function processIncomingMessage(
  supabase: SupabaseClient,
  msg: Record<string, unknown>,
): Promise<void> {
  const from = typeof msg.from === "string" ? msg.from : "";
  const type = typeof msg.type === "string" ? msg.type : "";

  // Button reply from a template quick-reply: messages[].button.payload
  // Interactive reply from an in-session button: messages[].interactive.button_reply.id
  let payloadRaw: string | null = null;
  if (type === "button") {
    const btn = msg.button as { payload?: string } | undefined;
    payloadRaw = btn?.payload ?? null;
  } else if (type === "interactive") {
    const inter = msg.interactive as { button_reply?: { id?: string } } | undefined;
    payloadRaw = inter?.button_reply?.id ?? null;
  }

  const parsed = parsePayload(payloadRaw);
  const creds = getCreds();

  if (parsed) {
    await applyAssignmentUpdate(supabase, parsed);
    if (creds && from) {
      await sendText(creds, {
        to: from,
        body: "¡Gracias! Quedó registrada tu respuesta.",
      });
    }
    return;
  }

  if (type === "text") {
    const text = (msg.text as { body?: string } | undefined)?.body ?? "";
    if (isOptOutMessage(text)) {
      await suppressByPhone(supabase, from);
      if (creds && from) {
        await sendText(creds, {
          to: from,
          body: "Listo. No volverás a recibir mensajes. Si cambias de opinión, avísale al coordinador.",
        });
      }
      return;
    }
    // Log unknown text for coordinator review (no PII beyond what's already in the message itself).
    console.log("wa-webhook: text inbound (no action)", { from, len: text.length });
  }
}

async function processStatusUpdate(
  supabase: SupabaseClient,
  s: Record<string, unknown>,
): Promise<void> {
  const wamid = typeof s.id === "string" ? s.id : null;
  const status = typeof s.status === "string" ? s.status : null;
  const timestampStr = typeof s.timestamp === "string" ? s.timestamp : null;
  if (!wamid || !status) return;

  const tsSec = timestampStr ? Number(timestampStr) : NaN;
  const tsIso = Number.isFinite(tsSec)
    ? new Date(tsSec * 1000).toISOString()
    : new Date().toISOString();

  const errors = s.errors as Array<{ title?: string; message?: string }> | undefined;
  const failureReason = errors && errors.length > 0
    ? errors.map((e) => e.message || e.title).filter(Boolean).join("; ")
    : null;

  const patch: Record<string, unknown> = {};
  if (status === "sent") {
    patch.status = "sent";
    patch.sent_at = tsIso;
  } else if (status === "delivered") {
    patch.status = "delivered";
    patch.delivered_at = tsIso;
  } else if (status === "read") {
    // status enum has no 'read' value — record read_at only.
    patch.read_at = tsIso;
  } else if (status === "failed") {
    patch.status = "failed";
    if (failureReason) patch.failure_reason = failureReason;
  } else {
    return;
  }

  await supabase
    .from("music_notification_logs")
    .update(patch)
    .eq("external_id", wamid);
}

async function handleWebhookPayload(rawBody: string): Promise<void> {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return;
  }
  if (!payload || typeof payload !== "object") return;

  const supabase = makeSupabase();
  const entries = (payload as { entry?: unknown[] }).entry ?? [];

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] }).changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> }).value;
      if (!value) continue;

      const messages = (value.messages as Record<string, unknown>[] | undefined) ?? [];
      for (const msg of messages) {
        try {
          await processIncomingMessage(supabase, msg);
        } catch (err) {
          console.error("wa-webhook: message processing error", err);
        }
      }

      const statuses = (value.statuses as Record<string, unknown>[] | undefined) ?? [];
      for (const s of statuses) {
        try {
          await processStatusUpdate(supabase, s);
        } catch (err) {
          console.error("wa-webhook: status processing error", err);
        }
      }
    }
  }
}

serve(async (req) => {
  if (req.method === "GET") {
    return handleVerification(req);
  }
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const valid = await verifyMetaSignature(rawBody, signature, APP_SECRET);
  if (!valid) {
    return new Response("invalid signature", { status: 401 });
  }

  // Acknowledge immediately so Meta does not retry; process inline best-effort.
  handleWebhookPayload(rawBody).catch((err) => {
    console.error("wa-webhook: unhandled error", err);
  });
  return new Response("ok", { status: 200 });
});
