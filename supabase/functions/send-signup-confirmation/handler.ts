/**
 * send-signup-confirmation — request handler (La Mesa Abierta).
 *
 * Auth model (Codex publishable-key review): the project's publishable key
 * authenticates the app at the gateway, never a user. Authentication and
 * authorization are two DISTINCT stages here, and the order matters in two
 * different ways:
 *
 *   1. AUTHENTICATION BEFORE THE BODY. `requireUser` verifies a genuine user
 *      JWT before a single byte of the request is pulled. It proves only *who*
 *      is calling — it is NOT ownership authorization, and nothing about this
 *      participant is known yet.
 *
 *   2. OWNERSHIP/ADMIN AUTHORIZATION BEFORE ANY SENSITIVE WORK. The decision
 *      needs `participantId`, which only exists once the body is read, so it
 *      cannot precede the body — it precedes everything that *matters*. The
 *      caller must either
 *        (a) OWN the participant row (`mesa_abierta_participants.user_id`),
 *            which is how MesaAbiertaSignup.tsx invokes it right after
 *            inserting its own row; or
 *        (b) hold a Mesa Abierta admin role (`mesa_abierta_admin_roles`), the
 *            established privilege used by every admin-* Mesa function.
 *      Both run BEFORE the participant's PII is loaded, before the logo URL is
 *      signed, and before any email leaves the isolate. Unknown participant →
 *      404; someone else's → 403. Fail-closed: an admin lookup is consulted
 *      only when ownership already failed, and a false answer denies.
 *
 * The step between the two stages is a TIGHTLY bounded read: `MAX_BODY_BYTES`
 * is 2 KiB and is enforced BY the streaming read (`_shared/boundedBody.ts`),
 * which cancels the stream at the chunk that crosses the cap. The only
 * service-role read that precedes the authorization decision is the minimal
 * `user_id` lookup the decision itself needs.
 *
 * Logo isolation (unchanged): the signed URL is a request-local const passed
 * explicitly into rendering; signing failure sends the email without a logo.
 *
 * Output hygiene: every participant-derived string (name, dates, times) is
 * HTML-escaped before it enters the email markup, and the signed logo URL is
 * validated (http/https) and attribute-encoded. POST + OPTIONS only.
 *
 * Extracted from `index.ts` so tests can import the handler without a Supabase
 * client, Resend, the environment, or a server.
 */

import { readBoundedJson } from "../_shared/boundedBody.ts";
import { requireUser, type RequirePermissionDeps } from "../_shared/liturgyAuth.ts";

/**
 * The only legitimate body is `{ "participantId": "<uuid>" }` — well under
 * 100 bytes. 2 KiB is deliberately tight: it leaves room for an extra field a
 * future caller might add without ever letting an unauthenticated-shaped or
 * chunked upload buy isolate memory. Enforced by the read, not after it.
 */
export const MAX_BODY_BYTES = 2048;

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Escapes a participant-derived string for insertion into HTML text or a quoted attribute. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface SignupConfirmationRequest {
  participantId?: unknown;
}

// Logo de La Mesa Abierta: objeto estable del bucket "Media". La URL se firma en
// cada solicitud con el cliente de servicio (nunca se incrusta un token en el
// código) y vive en una constante local a esa solicitud que se pasa de forma
// explícita a las funciones de render: no existe estado mutable a nivel de
// módulo, así que solicitudes concurrentes no comparten ninguna URL firmada.
// Si la firma falla, el correo se envía sin logo.
export const MESA_LOGO_BUCKET = "Media";
export const MESA_LOGO_PATH = "La Mesa Abierta Logo.png";
export const MESA_LOGO_URL_TTL_SECONDS = 60 * 60 * 24 * 365; // los correos se leen mucho después de enviarse

export interface ParticipantOwner {
  userId: string;
}

export interface ParticipantDetails {
  email: string;
  fullName: string;
  rolePreference: string;
  hasPlusOne: boolean;
  dinnerDate: string;
  dinnerTime: string;
  registrationDeadline: string;
}

/** Signs the stable logo object. Bound to the service-role Storage client in production. */
export interface LogoSigner {
  createSignedUrl(
    path: string,
    ttlSeconds: number,
  ): PromiseLike<{ data: { signedUrl: string } | null; error: unknown }>;
}

export type SendEmail = (
  to: string,
  subject: string,
  html: string,
) => Promise<{ success: boolean; error?: string }>;

export interface HandlerDeps {
  authzDeps: Pick<RequirePermissionDeps, "getUser">;
  /** Minimal service-role read the ownership decision needs: who owns the row. */
  findParticipantOwner(participantId: string): Promise<ParticipantOwner | null>;
  /** Established Mesa Abierta privilege: a row in mesa_abierta_admin_roles. */
  isMesaAdmin(userId: string): Promise<boolean>;
  /** Full read (PII) — only after the caller is authorized. */
  loadParticipantDetails(participantId: string): Promise<ParticipantDetails | null>;
  logoSigner: LogoSigner;
  sendEmail: SendEmail;
}

async function resolveMesaLogoUrl(signer: LogoSigner): Promise<string | null> {
  try {
    const { data, error } = await signer.createSignedUrl(MESA_LOGO_PATH, MESA_LOGO_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      console.warn("No se pudo firmar la URL del logo de La Mesa Abierta; el correo se envía sin logo");
      return null;
    }
    return data.signedUrl;
  } catch {
    console.warn("No se pudo firmar la URL del logo de La Mesa Abierta; el correo se envía sin logo");
    return null;
  }
}

function mesaLogoImg(logoUrl: string | null): string {
  const src = logoUrl ? logoSrcAttribute(logoUrl) : null;
  return src ? `<img src="${src}" alt="La Mesa Abierta Logo" />` : "";
}

/**
 * Encodes the signed URL for a quoted `src` attribute: only http(s) URLs are
 * accepted (anything else renders no logo), `URL.href` normalises and
 * percent-encodes what a URL cannot carry raw, and `escapeHtml` neutralises
 * `&`, quotes and angle brackets so the value cannot break out of the attribute.
 */
export function logoSrcAttribute(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  return escapeHtml(parsed.href);
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  return async function handler(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    // MesaAbiertaSignup.tsx invokes via supabase.functions.invoke({ body }) → POST.
    if (req.method !== "POST") {
      return json({ success: false, error: "Método no permitido" }, 405);
    }

    // ── Stage 1. AUTHENTICATION — strictly before the body is read, and before
    // any service-role read. This establishes WHO is calling; it authorizes
    // nothing about this participant.
    const authn = await requireUser(req, deps.authzDeps, corsHeaders);
    if (!authn.ok) {
      return authn.response;
    }
    const user = authn.user;

    try {
      // ── Bounded body read. MAX_BODY_BYTES is enforced BY the read: the
      // stream is cancelled at the chunk that crosses the cap and nothing past
      // it is pulled, decoded or parsed. A declared oversize never gets a first
      // pull. Failures are values, so no transport detail can reach the caller.
      const body = await readBoundedJson(req, MAX_BODY_BYTES);
      if (!body.ok) {
        return body.reason === "too_large"
          ? json({ success: false, error: "Solicitud demasiado grande" }, 413)
          : json({ success: false, error: "Cuerpo de la solicitud inválido" }, 400);
      }
      if (!body.value || typeof body.value !== "object" || Array.isArray(body.value)) {
        return json({ success: false, error: "Cuerpo de la solicitud inválido" }, 400);
      }
      const payload = body.value as SignupConfirmationRequest;
      const participantId = typeof payload?.participantId === "string" ? payload.participantId.trim() : "";
      if (!participantId) {
        return json({ success: false, error: "participantId is required" }, 400);
      }

      // ── Stage 2. OWNERSHIP / MESA-ADMIN AUTHORIZATION — the real access
      // decision. It needs participantId, so it cannot precede the body; it
      // does precede every sensitive downstream action below. Moving any of
      // those above this block would defeat the whole control.
      const owner = await deps.findParticipantOwner(participantId);
      if (!owner) {
        return json({ success: false, error: "Participant not found" }, 404);
      }
      if (owner.userId !== user.id && !(await deps.isMesaAdmin(user.id))) {
        return json({ success: false, code: "FORBIDDEN" }, 403);
      }

      // ── Stage 3. Only now: the participant's PII, the signed logo URL, and
      // the email. Nothing here runs for an unauthorized caller.
      const participant = await deps.loadParticipantDetails(participantId);
      if (!participant) {
        return json({ success: false, error: "Participant not found" }, 404);
      }

      // URL firmada local a ESTA solicitud (null si la firma falla → correo sin logo).
      const mesaLogoUrl = await resolveMesaLogoUrl(deps.logoSigner);

      const emailResult = await sendConfirmationEmail({
        to: participant.email,
        name: participant.fullName,
        rolePreference: participant.rolePreference,
        hasPlusOne: participant.hasPlusOne,
        dinnerDate: participant.dinnerDate,
        dinnerTime: participant.dinnerTime,
        registrationDeadline: participant.registrationDeadline,
        logoUrl: mesaLogoUrl,
      }, deps.sendEmail);

      if (!emailResult.success) {
        console.error("[send-signup-confirmation] el proveedor de correo rechazó el envío");
        return json({ success: false, error: "Failed to send email" }, 500);
      }

      return json({ success: true, message: "Confirmation email sent successfully" }, 200);
    } catch (error) {
      // Log hygiene: no participant data reaches the logs, only the error type.
      console.error("[send-signup-confirmation] Error:", error instanceof Error ? error.name : "unknown");
      return json({ success: false, error: "Unexpected error" }, 500);
    }
  };
}

async function sendConfirmationEmail(data: {
  to: string;
  name: string;
  rolePreference: string;
  hasPlusOne: boolean;
  dinnerDate: string;
  dinnerTime: string;
  registrationDeadline: string;
  /** URL firmada del logo para esta solicitud, o null para enviar sin logo. */
  logoUrl: string | null;
}, sendEmail: SendEmail) {
  const subject = "¡Inscripción Confirmada! - La Mesa Abierta";

  const roleText = data.rolePreference === "host"
    ? "como <strong>anfitrión(a)</strong>"
    : data.hasPlusOne
    ? "como <strong>invitado(a) + 1 acompañante</strong>"
    : "como <strong>invitado(a)</strong>";

  const deadlineDate = new Date(data.registrationDeadline);
  const formattedDeadline = deadlineDate.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  const dinnerDateObj = new Date(data.dinnerDate + "T" + data.dinnerTime);
  const formattedDinnerDate = dinnerDateObj.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #000000; background-color: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ffffff; color: #000000; padding: 30px 20px; text-align: center; border-bottom: 2px solid #000000; }
        .header img { max-width: 120px; margin-bottom: 15px; }
        .header h1 { margin: 0; font-size: 28px; color: #000000; }
        .header p { margin: 5px 0 0 0; font-size: 14px; color: #666666; }
        .content { padding: 30px 20px; background: #ffffff; }
        .content h2 { color: #000000; margin-top: 0; }
        .info-box { background: #f5f5f5; padding: 20px; margin: 20px 0; border-left: 4px solid #000000; }
        .info-box h3 { margin-top: 0; color: #000000; }
        .info-box p { margin: 10px 0; }
        .highlight { background: #fff3cd; padding: 15px; margin: 20px 0; border-left: 4px solid #ffc107; }
        .content ul { padding-left: 20px; }
        .content ul li { margin: 8px 0; }
        .footer { text-align: center; padding: 20px; color: #666666; font-size: 12px; border-top: 1px solid #cccccc; }
        .button { display: inline-block; padding: 12px 30px; background-color: #000000; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          ${mesaLogoImg(data.logoUrl)}
          <h1>La Mesa Abierta</h1>
          <p>Confirmación de Inscripción</p>
        </div>
        <div class="content">
          <h2>¡Hola ${escapeHtml(data.name)}!</h2>
          <p>Confirmamos que te has inscrito exitosamente ${roleText} para nuestra próxima edición de La Mesa Abierta.</p>

          <div class="info-box">
            <h3>📅 Detalles del Evento</h3>
            <p><strong>Fecha de la cena:</strong> ${escapeHtml(formattedDinnerDate)}</p>
            <p><strong>Hora:</strong> ${escapeHtml(data.dinnerTime)}</p>
            <p><strong>Tu rol:</strong> ${data.rolePreference === "host" ? "Anfitrión(a)" : "Invitado(a)"}${data.hasPlusOne ? " + 1 acompañante" : ""}</p>
          </div>

          <div class="highlight">
            <p><strong>⏰ Fecha límite de inscripción:</strong> ${escapeHtml(formattedDeadline)}</p>
            <p style="margin: 5px 0 0 0; font-size: 14px;">Después de esta fecha no se aceptarán más inscripciones y se realizará el emparejamiento.</p>
          </div>

          <h3>¿Qué sigue ahora?</h3>
          <ul>
            <li><strong>El lunes anterior al evento</strong> recibirás un email con los detalles completos de tu cena</li>
            ${data.rolePreference === "host"
              ? "<li>Como anfitrión, recibirás información sobre tus invitados y las restricciones alimentarias</li>"
              : "<li>Como invitado, recibirás la dirección del anfitrión y tu asignación de comida</li>"}
            <li>Recuerda: ¡la identidad de los demás participantes es un misterio hasta que llegues! 🤫</li>
          </ul>

          <p><strong>¿Necesitas cancelar o modificar tu inscripción?</strong></p>
          <p>Puedes gestionar tu participación desde tu panel de usuario en cualquier momento antes de la fecha límite de inscripción.</p>

          <a href="https://relajona.cl/mesa-abierta/dashboard" class="button">Ver Mi Participación</a>

          <p style="margin-top: 30px;">¡Esperamos que disfrutes de una hermosa velada llena de comunidad y conexión!</p>
        </div>
        <div class="footer">
          <p>CASA - Comunidad de Amor, Servicio y Adoración</p>
          <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(data.to, subject, html);
}
