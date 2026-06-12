// Quick-reply button payload grammar: "<action>:<domain>:<uuid>"
// Action: confirm | decline. Domain: music | children | rehearsal.
// Payload max 128 chars (Meta limit). UUID is the assignment / attendee id.

export type ButtonAction = 'confirm' | 'decline';
export type ButtonDomain = 'music' | 'children' | 'rehearsal';

export type ParsedPayload = {
  action: ButtonAction;
  domain: ButtonDomain;
  id: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildPayload(action: ButtonAction, domain: ButtonDomain, id: string): string {
  const out = `${action}:${domain}:${id}`;
  if (out.length > 128) {
    throw new Error(`payload too long (${out.length}) — max 128`);
  }
  return out;
}

export function parsePayload(raw: string | null | undefined): ParsedPayload | null {
  if (!raw) return null;
  const parts = raw.trim().split(':');
  if (parts.length !== 3) return null;
  const [action, domain, id] = parts;
  if (action !== 'confirm' && action !== 'decline') return null;
  if (domain !== 'music' && domain !== 'children' && domain !== 'rehearsal') return null;
  if (!UUID_RE.test(id)) return null;
  return { action, domain, id };
}

// Case- and diacritic-insensitive match for opt-out keywords.
const STOP_KEYWORDS = ['stop', 'baja', 'no enviar mas'];

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function isOptOutMessage(text: string | null | undefined): boolean {
  if (!text) return false;
  const norm = stripDiacritics(text.toLowerCase()).trim();
  return STOP_KEYWORDS.some((kw) => norm.includes(kw));
}
