// Shared send pipeline used by wa-send (publication / on-demand), wa-reminders
// (cron) and send-music-service-packet (publication fan-out). Keeps phone
// normalization, gating, Graph API call, and notification log writes in a
// single place.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { normalizeChilePhone } from "./phone.ts";
import { sendTemplate, type GraphCreds, type QuickReplyButton } from "./graph.ts";

export type RecipientType = "musician" | "children_volunteer";

export type SendInput = {
  recipientType: RecipientType;
  recipientId: string;
  templateName: string;
  notificationType: string; // matches music_notification_logs.notification_type enum
  variables: string[];
  buttons?: QuickReplyButton[];
};

export type SendOutcome =
  | { sent: true; wamid: string; phone: string }
  | { sent: false; fallback: "email"; reason: string };

type Recipient = {
  id: string;
  display_name: string;
  phone: string | null;
  whatsapp_enabled: boolean | null;
  whatsapp_suppressed: boolean | null;
};

async function loadRecipient(
  supabase: SupabaseClient,
  type: RecipientType,
  id: string,
): Promise<Recipient | null> {
  const table = type === "musician" ? "music_musicians" : "church_children_volunteers";
  const { data, error } = await supabase
    .from(table)
    .select("id, display_name, phone, whatsapp_enabled, whatsapp_suppressed")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as Recipient;
}

export function loadGraphCreds(): GraphCreds | { error: string } {
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!accessToken || !phoneNumberId) {
    return { error: "WhatsApp Graph API credentials not configured" };
  }
  return { accessToken, phoneNumberId };
}

export function makeServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function sendWhatsAppOne(
  supabase: SupabaseClient,
  creds: GraphCreds,
  input: SendInput,
): Promise<SendOutcome> {
  const recipient = await loadRecipient(supabase, input.recipientType, input.recipientId);
  if (!recipient) {
    return { sent: false, fallback: "email", reason: "destinatario no encontrado" };
  }
  if (recipient.whatsapp_suppressed) {
    return { sent: false, fallback: "email", reason: "destinatario suspendido (opt-out)" };
  }
  if (!recipient.whatsapp_enabled) {
    return { sent: false, fallback: "email", reason: "WhatsApp no habilitado para el destinatario" };
  }
  if (!recipient.phone) {
    return { sent: false, fallback: "email", reason: "destinatario sin teléfono" };
  }
  const phone = normalizeChilePhone(recipient.phone);
  if (!phone.ok) {
    return { sent: false, fallback: "email", reason: `teléfono inválido: ${phone.reason}` };
  }

  const result = await sendTemplate(creds, {
    to: phone.e164,
    templateName: input.templateName,
    languageCode: "es",
    bodyVariables: input.variables,
    buttons: input.buttons,
  });

  // Only musician recipients have a row in music_notification_logs (recipient_id FK).
  const canLog = input.recipientType === "musician";

  if (!result.ok) {
    if (canLog) {
      await supabase.from("music_notification_logs").insert({
        recipient_id: input.recipientId,
        notification_type: input.notificationType,
        channel: "whatsapp",
        subject: input.templateName,
        message_content: `template=${input.templateName} vars=${JSON.stringify(input.variables)}`,
        status: "failed",
        failure_reason: result.error,
      });
    }
    return { sent: false, fallback: "email", reason: result.error };
  }

  if (canLog) {
    await supabase.from("music_notification_logs").insert({
      recipient_id: input.recipientId,
      notification_type: input.notificationType,
      channel: "whatsapp",
      subject: input.templateName,
      message_content: `template=${input.templateName} vars=${JSON.stringify(input.variables)}`,
      external_id: result.wamid,
      status: "sent",
      sent_at: new Date().toISOString(),
    });
  }

  return { sent: true, wamid: result.wamid, phone: phone.e164 };
}
