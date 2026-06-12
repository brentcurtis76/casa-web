// Payload grammar + opt-out detection — Deno-side copy of src/lib/whatsapp/payload.ts.
// Keep in sync with src/lib/whatsapp/payload.ts.

export type ButtonAction = "confirm" | "decline";
export type ButtonDomain = "music" | "children" | "rehearsal";

export type ParsedPayload = {
  action: ButtonAction;
  domain: ButtonDomain;
  id: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildPayload(
  action: ButtonAction,
  domain: ButtonDomain,
  id: string,
): string {
  const out = `${action}:${domain}:${id}`;
  if (out.length > 128) {
    throw new Error(`payload too long (${out.length}) — max 128`);
  }
  return out;
}

export function parsePayload(raw: string | null | undefined): ParsedPayload | null {
  if (!raw) return null;
  const parts = raw.trim().split(":");
  if (parts.length !== 3) return null;
  const [action, domain, id] = parts;
  if (action !== "confirm" && action !== "decline") return null;
  if (domain !== "music" && domain !== "children" && domain !== "rehearsal") {
    return null;
  }
  if (!UUID_RE.test(id)) return null;
  return { action, domain, id };
}

// Word-boundary matching: "BAJA" / "dar de baja" opt out, but ordinary words
// that merely contain a keyword ("trabaja", "rebaja", "bajada") must not.
const STOP_RE = /\b(stop|baja|no enviar mas|no quiero recibir)\b/;

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function isOptOutMessage(text: string | null | undefined): boolean {
  if (!text) return false;
  const norm = stripDiacritics(text.toLowerCase()).trim();
  return STOP_RE.test(norm);
}
