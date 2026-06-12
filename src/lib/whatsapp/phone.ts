// Chile phone normalization for WhatsApp Cloud API.
// Graph API accepts digits only (no '+').
// Goal: turn '+56 9 1234 5678', '569 1234-5678', '912345678' etc. into '56912345678'.

export type NormalizedPhone = {
  ok: true;
  e164: string; // digits only, no plus, e.g. "56912345678"
  display: string; // human form, e.g. "+56 9 1234 5678"
};

export type NormalizationError = {
  ok: false;
  reason: string;
};

export type PhoneResult = NormalizedPhone | NormalizationError;

const DIGITS_ONLY = /[^\d]/g;

export function normalizeChilePhone(input: string | null | undefined): PhoneResult {
  if (!input) return { ok: false, reason: 'Sin número de teléfono' };

  const digits = String(input).replace(DIGITS_ONLY, '');

  if (digits.length === 0) {
    return { ok: false, reason: 'Sin dígitos en el número' };
  }

  let e164: string;

  if (digits.startsWith('569') && digits.length === 11) {
    // already in 56 + 9 + 8 digits form
    e164 = digits;
  } else if (digits.startsWith('56') && digits.length === 11) {
    // 56 followed by 9 digit mobile (first must be 9)
    if (digits[2] !== '9') {
      return { ok: false, reason: 'Solo se aceptan móviles chilenos (deben empezar con 9)' };
    }
    e164 = digits;
  } else if (digits.startsWith('9') && digits.length === 9) {
    // local mobile without country code
    e164 = `56${digits}`;
  } else if (digits.length === 8) {
    // 8-digit local without leading 9 — assume missing
    return { ok: false, reason: 'Número incompleto, falta el prefijo móvil 9' };
  } else {
    return { ok: false, reason: `Formato no reconocido (${digits.length} dígitos)` };
  }

  // Sanity: must be exactly 11 digits starting with 569
  if (!/^569\d{8}$/.test(e164)) {
    return { ok: false, reason: 'No se pudo normalizar a +56 9 XXXX XXXX' };
  }

  const a = e164.slice(3, 7);
  const b = e164.slice(7);
  return { ok: true, e164, display: `+56 9 ${a} ${b}` };
}
