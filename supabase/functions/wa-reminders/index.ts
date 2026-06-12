// wa-reminders — daily cron job that nudges unconfirmed music assignments
// 7 days out (recordatorio_semana) and 1 day out (recordatorio_dia).
// Skips: confirmed, suppressed, not opted in, or already-reminded today.
// MUST be deployed public (verify_jwt = false): the pg_cron caller authenticates
// with WA_REMINDERS_CRON_SECRET, which is not a platform JWT.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  loadGraphCreds,
  makeServiceClient,
  sendWhatsAppOne,
} from "../_shared/whatsapp/send-core.ts";
import { buildPayload } from "../_shared/whatsapp/payload.ts";

type ReminderKind = "reminder_1week" | "reminder_1day";

function targetIsoDate(daysAhead: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function formatDateEs(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${d.getUTCDate()} de ${months[d.getUTCMonth()]}`;
}

type AssignmentRow = {
  id: string;
  musician_id: string;
  assigned_instrument: string | null;
  assigned_role: string | null;
  service_date_id: string;
  confirmed: boolean | null;
  music_service_dates: { id: string; date: string } | null;
  music_musicians: {
    id: string;
    display_name: string;
    whatsapp_enabled: boolean | null;
    whatsapp_suppressed: boolean | null;
    phone: string | null;
  } | null;
};

async function runRemindersForKind(kind: ReminderKind): Promise<{
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
}> {
  const daysAhead = kind === "reminder_1week" ? 7 : 1;
  const templateName = kind === "reminder_1week" ? "recordatorio_semana" : "recordatorio_dia";
  const targetDate = targetIsoDate(daysAhead);

  const supabase = makeServiceClient();
  const credsOrErr = loadGraphCreds();
  if ("error" in credsOrErr) {
    console.error("wa-reminders: missing creds", credsOrErr.error);
    return { attempted: 0, sent: 0, skipped: 0, failed: 0 };
  }
  const creds = credsOrErr;

  const { data: serviceDates, error: sdErr } = await supabase
    .from("music_service_dates")
    .select("id, date")
    .eq("date", targetDate);

  if (sdErr || !serviceDates || serviceDates.length === 0) {
    return { attempted: 0, sent: 0, skipped: 0, failed: 0 };
  }

  const serviceDateIds = serviceDates.map((s: { id: string }) => s.id);

  const { data: assignments, error: aErr } = await supabase
    .from("music_service_assignments")
    .select(
      `id, musician_id, assigned_instrument, assigned_role, service_date_id, confirmed,
       music_service_dates(id, date),
       music_musicians(id, display_name, whatsapp_enabled, whatsapp_suppressed, phone)`,
    )
    .in("service_date_id", serviceDateIds);

  if (aErr || !assignments) {
    console.error("wa-reminders: assignment query error", aErr);
    return { attempted: 0, sent: 0, skipped: 0, failed: 0 };
  }

  const result = { attempted: 0, sent: 0, skipped: 0, failed: 0 };

  for (const raw of assignments) {
    const a = raw as unknown as AssignmentRow;
    if (a.confirmed) {
      result.skipped++;
      continue;
    }
    const musician = a.music_musicians;
    if (!musician || !musician.whatsapp_enabled || musician.whatsapp_suppressed || !musician.phone) {
      result.skipped++;
      continue;
    }

    // Idempotency: skip if we've already logged this reminder type for this
    // recipient in the past 24h.
    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: existing } = await supabase
      .from("music_notification_logs")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", musician.id)
      .eq("notification_type", kind)
      .gte("created_at", sinceIso);

    if ((existing ?? 0) > 0) {
      result.skipped++;
      continue;
    }

    result.attempted++;

    const fecha = a.music_service_dates ? formatDateEs(a.music_service_dates.date) : "";
    const rol = a.assigned_instrument || a.assigned_role || "voluntario";

    const outcome = await sendWhatsAppOne(supabase, creds, {
      recipientType: "musician",
      recipientId: musician.id,
      templateName,
      notificationType: kind,
      variables: [musician.display_name, fecha, rol],
      buttons: [
        { index: 0, payload: buildPayload("confirm", "music", a.id) },
        { index: 1, payload: buildPayload("decline", "music", a.id) },
      ],
    });

    if (outcome.sent) result.sent++;
    else result.failed++;
  }

  return result;
}

serve(async (req) => {
  // Lightweight auth: require either service-role bearer OR explicit cron secret.
  const auth = req.headers.get("authorization") ?? "";
  const cronSecret = Deno.env.get("WA_REMINDERS_CRON_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const bearer = auth.replace(/^Bearer\s+/i, "");
  const ok = (cronSecret && bearer === cronSecret) ||
    (serviceKey && bearer === serviceKey);
  if (!ok) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const week = await runRemindersForKind("reminder_1week");
  const day = await runRemindersForKind("reminder_1day");

  return new Response(
    JSON.stringify({ ok: true, week, day }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
