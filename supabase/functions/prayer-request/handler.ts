/**
 * prayer-request — request handler.
 *
 * The browser only offers this form to signed-in users (PrayerRequestForm
 * opens the auth modal otherwise). The function enforces the same rule itself:
 * a genuine user JWT is required BEFORE the body is read and before any email
 * is sent. The project's publishable/anon key authenticates the application at
 * the gateway, never a user, and is refused with 401.
 *
 * Bounded read (Codex round 3): the body is read through the STREAMING cap in
 * `_shared/boundedBody.ts`. The cap IS the read — it cancels the stream at the
 * chunk that crosses it, so nothing past that chunk is pulled, decoded or
 * parsed. `MAX_REQUEST_CHARS` was never a limit on the upload: it was a check
 * applied to a string that had already been materialised in full, so a chunked
 * or headerless body of any size was buffered first and judged afterwards.
 * Both bounds now apply, in the right order — bytes at the read, characters
 * once there is a value.
 *
 * Log and error hygiene (unchanged, re-pinned by the tests): the petition text
 * and the petitioner's name never reach a log, and every failure answers with a
 * fixed Spanish message — no provider detail, no stack, no request content.
 *
 * Extracted from `index.ts` so tests can import the handler without Resend, a
 * Supabase client, the environment, or a server. `index.ts` wires production
 * dependencies and calls `serve()`.
 */

import { readBoundedJson } from "../_shared/boundedBody.ts";
import { requireUser, type RequirePermissionDeps } from "../_shared/liturgyAuth.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Longest prayer request accepted (characters). */
export const MAX_REQUEST_CHARS = 5000;
export const MAX_NAME_CHARS = 100;
/**
 * Byte cap on the upload, enforced by the read itself.
 *
 * Sized from the handler's own character limits, not from the browser form
 * (which stops at 500 characters — the handler is the authority, and another
 * caller may legitimately use the full 5000). Worst case is a petition where
 * every character is JSON-escaped to `\uXXXX`: 5000 x 6 = 30,000 bytes, plus a
 * 100-character name at 6 bytes each and ~60 bytes of keys and braces, i.e.
 * ~30.7 KB. 32 KiB clears that with headroom and is still tight enough that no
 * upload can buy isolate memory.
 *
 * One deliberate consequence: `name` has no length check before its `slice`, so
 * an unbounded name used to be accepted and silently truncated. It now costs a
 * 413 past 32 KiB. No legitimate name is affected.
 */
export const MAX_BODY_BYTES = 32_768;

export interface OutgoingEmail {
  subject: string;
  html: string;
}

export interface EmailSendResult {
  error?: { message?: string } | null;
}

export interface HandlerDeps {
  authzDeps: Pick<RequirePermissionDeps, "getUser">;
  /** Bound email sender (Resend in production). `null` when RESEND_API_KEY is unset. */
  sendEmail: ((email: OutgoingEmail) => Promise<EmailSendResult>) | null;
}

interface PrayerRequestData {
  request?: unknown;
  name?: unknown;
  isAnonymous?: unknown;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
      return new Response(null, { headers: corsHeaders });
    }

    // Fail-closed authentication: runs BEFORE the first byte of the body is
    // pulled, and before Resend.
    const authn = await requireUser(req, deps.authzDeps, corsHeaders);
    if (!authn.ok) {
      return authn.response;
    }

    // Bounded, streamed read. MAX_BODY_BYTES is enforced BY the read: an
    // over-cap upload is cut at the chunk that crosses it and never decoded or
    // parsed, and a declared oversize never gets a first pull. Failures are
    // values, not exceptions, so no transport detail can reach the caller — and
    // none of this costs an email.
    const body = await readBoundedJson(req, MAX_BODY_BYTES);
    if (!body.ok) {
      return body.reason === "too_large"
        ? json({ success: false, error: "Solicitud demasiado grande" }, 413)
        : json({ success: false, error: "Cuerpo de la solicitud inválido" }, 400);
    }
    if (!body.value || typeof body.value !== "object" || Array.isArray(body.value)) {
      return json({ success: false, error: "Cuerpo de la solicitud inválido" }, 400);
    }
    const payload = body.value as PrayerRequestData;

    const request = typeof payload?.request === "string" ? payload.request.trim() : "";
    if (!request) {
      return json({ success: false, error: "Se requiere una petición de oración" }, 400);
    }
    if (request.length > MAX_REQUEST_CHARS) {
      return json({ success: false, error: "La petición es demasiado larga" }, 400);
    }
    const isAnonymous = payload.isAnonymous === true;
    const name = !isAnonymous && typeof payload.name === "string"
      ? payload.name.trim().slice(0, MAX_NAME_CHARS)
      : "";

    // Log hygiene: neither the name nor the request text is logged.
    console.log(`[prayer-request] petición recibida (anónima: ${isAnonymous ? "sí" : "no"})`);

    if (!deps.sendEmail) {
      console.error("[prayer-request] RESEND_API_KEY no está configurada");
      return json({ success: false, error: "El servicio de correo no está configurado" }, 500);
    }

    const fromLine = !isAnonymous && name
      ? `<p><strong>De:</strong> ${escapeHtml(name)}</p>`
      : "<p><strong>Petición anónima</strong></p>";
    const subject = !isAnonymous && name
      ? `Nueva petición de oración de ${name}`
      : "Nueva petición de oración anónima";
    const html = `
      <h1>Nueva petición de oración</h1>
      ${fromLine}
      <p><strong>Petición:</strong></p>
      <p>${escapeHtml(request).replace(/\n/g, "<br />")}</p>
    `;

    try {
      const result = await deps.sendEmail({ subject, html });
      if (result.error) {
        console.error("[prayer-request] el proveedor de correo rechazó el envío");
        return json({ success: false, error: "Error al enviar el email" }, 500);
      }
    } catch {
      console.error("[prayer-request] error al enviar el email");
      return json({ success: false, error: "Error al enviar el email" }, 500);
    }

    return json({ success: true, message: "Petición de oración recibida correctamente" }, 200);
  };
}
