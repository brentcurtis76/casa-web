/**
 * whatsapp-signup — request handler.
 *
 * Intentionally PUBLIC: visitors of the home page ask to join the WhatsApp
 * broadcast list without an account, so no user JWT exists to verify
 * (`verify_jwt = false` in supabase/config.toml). Abuse protection therefore
 * lives here, mirroring `public-signup`:
 *   - POST only, a body bounded by a STREAMING cap (`_shared/boundedBody.ts`):
 *     the cap stops the read at the chunk that crosses it, so a chunked or
 *     headerless payload can never be materialised first and judged after;
 *   - honeypot field (`_honey`) answered with a silent 200;
 *   - timing check (`_timestamp`, REQUIRED): the caller (InstagramFeed.tsx) sends
 *     the instant the form was presented; a submission under 3 s later is a bot,
 *     and a missing, malformed, future or stale value is a malformed request —
 *     so the check cannot be skipped by omitting the field. The value is
 *     client-supplied: it stops naïve scripted posts, not a bot that reads the
 *     form and forges it;
 *   - per-IP rate limit, plus a bounded SHARED bucket for requests that carry
 *     no `x-forwarded-for` at all. An unidentifiable caller used to skip the
 *     limiter outright, which made omitting the header the cheapest way past
 *     it; now it costs the shared budget instead. The IP itself is never
 *     logged or returned. Best effort either way (in-memory, per isolate — a
 *     durable limit needs a table like `church_signups.ip_address`, out of
 *     scope here).
 * Privacy: names, phone numbers, and request bodies are never logged, and
 * responses carry no provider payloads or stack traces.
 *
 * Extracted from `index.ts` so tests can import it without Resend or a server.
 */

import { readBoundedJson } from "../_shared/boundedBody.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const NAME_MIN_CHARS = 2;
export const NAME_MAX_CHARS = 100;
/** Digits after normalisation (E.164 allows up to 15). */
export const PHONE_MIN_DIGITS = 8;
export const PHONE_MAX_DIGITS = 15;
export const MIN_SUBMIT_TIME_MS = 3000;
/** A `_timestamp` older than this is stale (the form was not presented "now"). */
export const MAX_TIMESTAMP_AGE_MS = 24 * 60 * 60 * 1000;
/** Tolerated client clock skew for a `_timestamp` slightly in the future. */
export const MAX_CLOCK_SKEW_MS = 60 * 1000;
export const RATE_LIMIT_MAX = 3;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
export const MAX_BODY_BYTES = 4096;
/** Upper bound on tracked IPs so the limiter cannot grow without limit. */
export const RATE_LIMIT_MAX_TRACKED_KEYS = 1000;
/**
 * Budget for the single bucket every caller without an `x-forwarded-for` shares.
 * Deliberately looser than the per-IP budget — one bucket stands in for an
 * unknown number of callers — but bounded, which is the whole point: the
 * previous code let those requests through unlimited.
 */
export const SHARED_RATE_LIMIT_MAX = 30;
/** The one key the shared bucket uses. Not an IP, and never logged. */
export const SHARED_RATE_LIMIT_KEY = "sin-origen";

export interface OutgoingEmail {
  subject: string;
  html: string;
}

export interface EmailSendResult {
  error?: { message?: string } | null;
}

export interface RateLimiter {
  /** Records a hit and returns true when `key` is over its budget. */
  isLimited(key: string, now: number): boolean;
}

export interface HandlerDeps {
  /** Bound email sender (Resend in production). `null` when RESEND_API_KEY is unset. */
  sendEmail: ((email: OutgoingEmail) => Promise<EmailSendResult>) | null;
  rateLimiter?: RateLimiter;
  /** Bucket for callers with no determinable IP. Separate budget, own memory. */
  sharedRateLimiter?: RateLimiter;
  now?: () => number;
}

interface WhatsappSignupPayload {
  name?: unknown;
  phone?: unknown;
  _honey?: unknown;
  _timestamp?: unknown;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Accepts digits with optional leading `+`, ignoring spaces, dots, dashes and
 * parentheses. Returns the normalised number or `null` when invalid.
 */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const compact = raw.replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(compact)) return null;
  const digits = compact.replace(/^\+/, "");
  if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) return null;
  return compact;
}

// Control characters have no place in a person's name (nor in an email subject).
// deno-lint-ignore no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export function normalizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (CONTROL_CHARS.test(raw)) return null;
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < NAME_MIN_CHARS || name.length > NAME_MAX_CHARS) return null;
  return name;
}

/** Sliding-window limiter, bounded in memory. Per isolate, so best effort. */
export function createRateLimiter(
  opts: { max?: number; windowMs?: number; maxTrackedKeys?: number } = {},
): RateLimiter {
  const max = opts.max ?? RATE_LIMIT_MAX;
  const windowMs = opts.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const maxTrackedKeys = opts.maxTrackedKeys ?? RATE_LIMIT_MAX_TRACKED_KEYS;
  const hits = new Map<string, number[]>();
  return {
    isLimited(key, now) {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return true;
      }
      recent.push(now);
      hits.delete(key); // re-insert so insertion order doubles as recency
      hits.set(key, recent);
      while (hits.size > maxTrackedKeys) {
        const oldest = hits.keys().next().value;
        if (oldest === undefined) break;
        hits.delete(oldest);
      }
      return false;
    },
  };
}

export function clientIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const OK_BODY = { success: true, message: "Solicitud recibida correctamente" };

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  const now = deps.now ?? (() => Date.now());
  const rateLimiter = deps.rateLimiter ?? createRateLimiter();
  const sharedRateLimiter = deps.sharedRateLimiter ??
    createRateLimiter({ max: SHARED_RATE_LIMIT_MAX, maxTrackedKeys: 1 });

  return async function handler(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return json({ success: false, error: "Método no permitido" }, 405);
    }

    // MAX_BODY_BYTES is enforced by the read itself: the stream is cancelled at
    // the chunk that crosses it and nothing past it is pulled, decoded or
    // parsed. Reasons are values, so no transport detail can reach the client.
    const parsed = await readBoundedJson(req, MAX_BODY_BYTES);
    if (!parsed.ok) {
      return parsed.reason === "too_large"
        ? json({ success: false, error: "Solicitud demasiado grande" }, 413)
        : json({ success: false, error: "Cuerpo de la solicitud inválido" }, 400);
    }
    if (!parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) {
      return json({ success: false, error: "Cuerpo de la solicitud inválido" }, 400);
    }
    const payload = parsed.value as WhatsappSignupPayload;

    // ── Anti-spam: honeypot (silent 200 — bots think it succeeded) ──────────
    if (payload._honey) {
      return json(OK_BODY, 200);
    }

    // ── Anti-spam: timing check (see header: required, client-supplied) ─────
    const submittedAt = payload._timestamp;
    const currentTime = now();
    if (
      typeof submittedAt !== "number" || !Number.isFinite(submittedAt) ||
      submittedAt > currentTime + MAX_CLOCK_SKEW_MS ||
      currentTime - submittedAt > MAX_TIMESTAMP_AGE_MS
    ) {
      return json({ success: false, error: "Cuerpo de la solicitud inválido" }, 400);
    }
    if (currentTime - submittedAt < MIN_SUBMIT_TIME_MS) {
      return json(
        { success: false, error: "El formulario fue enviado demasiado rápido. Por favor, inténtalo de nuevo." },
        429,
      );
    }

    // ── Validation ──────────────────────────────────────────────────────────
    const name = normalizeName(payload.name);
    const phone = normalizePhone(payload.phone);
    if (!name || !phone) {
      return json({ success: false, error: "Se requiere un nombre y un teléfono válidos" }, 400);
    }

    // ── Anti-spam: rate limit (best effort, see header comment) ────────────
    // Charged only once a valid, bounded payload exists, so a rejected body
    // cannot consume anyone's budget. A caller with no determinable IP is
    // charged to the shared bucket rather than waved through.
    const ip = clientIp(req);
    const limited = ip
      ? rateLimiter.isLimited(ip, now())
      : sharedRateLimiter.isLimited(SHARED_RATE_LIMIT_KEY, now());
    if (limited) {
      return json(
        { success: false, error: "Has excedido el límite de solicitudes. Inténtalo más tarde." },
        429,
      );
    }

    // Log hygiene: no personal data and no request content is ever logged.
    console.log("[whatsapp-signup] solicitud válida recibida");

    if (!deps.sendEmail) {
      console.error("[whatsapp-signup] RESEND_API_KEY no está configurada");
      return json({ success: false, error: "El servicio de correo no está configurado" }, 500);
    }

    try {
      const result = await deps.sendEmail({
        subject: `Agrega a ${name} a la lista de difusión de CASA`,
        html: `
          <h1>Nueva solicitud para lista de difusión</h1>
          <p><strong>Nombre:</strong> ${escapeHtml(name)}</p>
          <p><strong>Teléfono:</strong> ${escapeHtml(phone)}</p>
          <p>Por favor agrega este contacto a la lista de difusión de WhatsApp.</p>
        `,
      });
      if (result.error) {
        console.error("[whatsapp-signup] el proveedor de correo rechazó el envío");
        return json({ success: false, error: "Error al enviar el email" }, 500);
      }
    } catch {
      console.error("[whatsapp-signup] error al enviar el email");
      return json({ success: false, error: "Error al enviar el email" }, 500);
    }

    return json(OK_BODY, 200);
  };
}
