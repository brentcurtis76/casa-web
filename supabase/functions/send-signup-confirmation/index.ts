/**
 * send-signup-confirmation — production entrypoint.
 *
 * Reads env vars, builds the service-role client (used ONLY after the handler
 * has authenticated and authorized the caller), the Resend sender, and starts
 * the HTTP server. All request logic lives in `handler.ts`.
 */

import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

import { createSupabaseAuthzDeps } from "../_shared/liturgyAuth.ts";
import {
  createHandler,
  MESA_LOGO_BUCKET,
  type ParticipantDetails,
  type ParticipantOwner,
} from "./handler.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const authzDeps = createSupabaseAuthzDeps(supabaseAdmin);

async function findParticipantOwner(participantId: string): Promise<ParticipantOwner | null> {
  const { data, error } = await supabaseAdmin
    .from("mesa_abierta_participants")
    .select("user_id")
    .eq("id", participantId)
    .maybeSingle();
  if (error || !data?.user_id) return null;
  return { userId: data.user_id as string };
}

async function isMesaAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("mesa_abierta_admin_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

async function loadParticipantDetails(participantId: string): Promise<ParticipantDetails | null> {
  const { data: participant, error } = await supabaseAdmin
    .from("mesa_abierta_participants")
    .select(`
      id,
      email,
      role_preference,
      has_plus_one,
      mesa_abierta_months!inner(
        dinner_date,
        dinner_time,
        registration_deadline
      ),
      profiles!inner(
        full_name
      )
    `)
    .eq("id", participantId)
    .single();
  if (error || !participant) return null;
  return {
    email: participant.email,
    fullName: participant.profiles.full_name,
    rolePreference: participant.role_preference,
    hasPlusOne: participant.has_plus_one,
    dinnerDate: participant.mesa_abierta_months.dinner_date,
    dinnerTime: participant.mesa_abierta_months.dinner_time,
    registrationDeadline: participant.mesa_abierta_months.registration_deadline,
  };
}

const logoSigner = {
  createSignedUrl: (path: string, ttlSeconds: number) =>
    supabaseAdmin.storage.from(MESA_LOGO_BUCKET).createSignedUrl(path, ttlSeconds),
};

async function sendEmail(to: string, subject: string, html: string) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "La Mesa Abierta <noreply@relajona.cl>",
        to: [to],
        subject,
        html,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, data };
    } else {
      const error = await res.text();
      return { success: false, error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

serve(createHandler({
  authzDeps,
  findParticipantOwner,
  isMesaAdmin,
  loadParticipantDetails,
  logoSigner,
  sendEmail,
}));
