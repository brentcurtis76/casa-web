import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VALID_FORM_TYPES = ["grupos_casa", "club_lectura", "apoyo_psicoemocional"];

const VALID_COMUNAS_GRUPOS_CASA = ["Las Condes", "La Reina"];

const VALID_SLOTS_APOYO = ["jueves_19", "martes_10"];

const DISPOSABLE_DOMAINS = [
  "mailinator.com",
  "tempmail.com",
  "guerrillamail.com",
  "throwaway.email",
  "yopmail.com",
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_HOURS = 1;
const MIN_SUBMIT_TIME_MS = 3000;

interface SignupPayload {
  form_type: string;
  full_name: string;
  email: string;
  phone?: string;
  comuna?: string;
  group_slot?: string;
  notes?: string;
  _honey?: string;
  _timestamp?: number;
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { success: false, error: "Metodo no permitido" },
      405
    );
  }

  try {
    const payload: SignupPayload = await req.json();

    // ── Anti-spam: honeypot ──────────────────────────────────────────────
    if (payload._honey) {
      // Silent 200 OK — bots think it succeeded
      return jsonResponse(
        { success: true, message: "Inscripcion registrada exitosamente" },
        200
      );
    }

    // ── Anti-spam: timing check ──────────────────────────────────────────
    if (payload._timestamp) {
      const elapsed = Date.now() - payload._timestamp;
      if (elapsed < MIN_SUBMIT_TIME_MS) {
        return jsonResponse(
          {
            success: false,
            error:
              "El formulario fue enviado demasiado rapido. Por favor, intentalo de nuevo.",
          },
          429
        );
      }
    }

    // ── Validation: form_type ────────────────────────────────────────────
    if (!VALID_FORM_TYPES.includes(payload.form_type)) {
      return jsonResponse(
        { success: false, error: "Tipo de formulario no valido." },
        400
      );
    }

    // ── Validation: full_name ────────────────────────────────────────────
    const fullName = (payload.full_name ?? "").trim();
    if (fullName.length < 2 || fullName.length > 100) {
      return jsonResponse(
        {
          success: false,
          error: "El nombre completo debe tener entre 2 y 100 caracteres.",
        },
        400
      );
    }

    // ── Validation: email ────────────────────────────────────────────────
    const email = (payload.email ?? "").trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      return jsonResponse(
        {
          success: false,
          error: "Por favor, ingresa un correo electronico valido.",
        },
        400
      );
    }

    // ── Anti-spam: disposable email domains ──────────────────────────────
    const emailDomain = email.split("@")[1];
    if (DISPOSABLE_DOMAINS.includes(emailDomain)) {
      return jsonResponse(
        {
          success: false,
          error:
            "No se permiten correos electronicos temporales. Usa un correo permanente.",
        },
        400
      );
    }

    // ── Conditional validation: comuna for grupos_casa ───────────────────
    if (payload.form_type === "grupos_casa") {
      if (
        !payload.comuna ||
        !VALID_COMUNAS_GRUPOS_CASA.includes(payload.comuna)
      ) {
        return jsonResponse(
          {
            success: false,
            error: `Para Grupos Casa, la comuna debe ser una de: ${VALID_COMUNAS_GRUPOS_CASA.join(", ")}.`,
          },
          400
        );
      }
    }

    // ── Conditional validation: group_slot for apoyo_psicoemocional ──────
    if (payload.form_type === "apoyo_psicoemocional") {
      if (
        !payload.group_slot ||
        !VALID_SLOTS_APOYO.includes(payload.group_slot)
      ) {
        return jsonResponse(
          {
            success: false,
            error: `Para Apoyo Psicoemocional, el horario debe ser uno de: ${VALID_SLOTS_APOYO.join(", ")}.`,
          },
          400
        );
      }
    }

    // ── Supabase client (service role — bypasses RLS) ────────────────────
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── Anti-spam: rate limiting by IP ───────────────────────────────────
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

    if (ip) {
      const windowStart = new Date(
        Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000
      ).toISOString();

      const { count, error: countError } = await supabaseClient
        .from("church_signups")
        .select("id", { count: "exact", head: true })
        .eq("ip_address", ip)
        .gte("created_at", windowStart);

      if (!countError && (count ?? 0) >= RATE_LIMIT_MAX) {
        return jsonResponse(
          {
            success: false,
            error:
              "Has excedido el limite de inscripciones. Intentalo mas tarde.",
          },
          429
        );
      }
    }

    // ── Duplicate check ──────────────────────────────────────────────────
    const { data: existing } = await supabaseClient
      .from("church_signups")
      .select("id")
      .eq("email", email)
      .eq("form_type", payload.form_type)
      .maybeSingle();

    if (existing) {
      return jsonResponse(
        {
          success: true,
          message:
            "Ya tienes una inscripcion registrada para este programa. No es necesario inscribirse nuevamente.",
        },
        200
      );
    }

    // ── Insert ───────────────────────────────────────────────────────────
    const { error: insertError } = await supabaseClient
      .from("church_signups")
      .insert({
        form_type: payload.form_type,
        full_name: fullName,
        email,
        phone: payload.phone?.trim() || null,
        comuna: payload.comuna?.trim() || null,
        group_slot: payload.group_slot || null,
        notes: payload.notes?.trim() || null,
        status: "pending",
        spam_score: 0,
        ip_address: ip,
      });

    if (insertError) {
      console.error("Error al insertar inscripcion:", insertError);
      return jsonResponse(
        {
          success: false,
          error: "Ocurrio un error al procesar tu inscripcion. Intentalo de nuevo.",
        },
        500
      );
    }

    return jsonResponse(
      { success: true, message: "Inscripcion registrada exitosamente" },
      200
    );
  } catch (error) {
    console.error("Error en public-signup:", error);
    return jsonResponse(
      {
        success: false,
        error: "Ocurrio un error inesperado. Intentalo de nuevo.",
      },
      500
    );
  }
});
